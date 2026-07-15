import type { JwtTokenService } from './jwt-service';
import type {
  AuthService,
  AuthTokens,
  JwtPayload,
  RefreshRotationResult,
  RefreshTokenStore,
} from './types';
import { AuthError } from './types';

/**
 * Orquestra a autenticacao (D-029): emite o par access+refresh, rotaciona o
 * refresh a cada uso, detecta reuso (revoga a familia) e revoga sessao.
 */
export class DefaultAuthService implements AuthService {
  constructor(
    private readonly jwt: JwtTokenService,
    private readonly store: RefreshTokenStore,
    private readonly refreshTtlSeconds: number,
  ) {}

  async issueTokens(input: { accountId: string; sessionId: string }): Promise<AuthTokens> {
    const jti = this.jwt.newJti();
    const [access, refresh] = await Promise.all([
      this.jwt.signAccessToken(input),
      this.jwt.signRefreshToken({ ...input, jti }),
    ]);
    await this.store.startSession(input.sessionId, jti, this.refreshTtlSeconds);
    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      accessExpiresAt: access.expiresAt,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  async rotateRefreshToken(refreshToken: string): Promise<RefreshRotationResult> {
    const claims = await this.jwt.verifyRefreshToken(refreshToken);
    const newJti = this.jwt.newJti();
    const outcome = await this.store.rotate(
      claims.sessionId,
      claims.jti,
      newJti,
      this.refreshTtlSeconds,
    );

    if (outcome === 'reuse') {
      throw new AuthError(
        'Reuso de refresh token detectado — sessao revogada',
        'REFRESH_REUSE_DETECTED',
      );
    }
    if (outcome === 'revoked') {
      throw new AuthError('Sessao revogada ou expirada', 'SESSION_REVOKED');
    }

    const [access, refresh] = await Promise.all([
      this.jwt.signAccessToken({ accountId: claims.sub, sessionId: claims.sessionId }),
      this.jwt.signRefreshToken({
        accountId: claims.sub,
        sessionId: claims.sessionId,
        jti: newJti,
      }),
    ]);
    return {
      tokens: {
        accessToken: access.token,
        refreshToken: refresh.token,
        accessExpiresAt: access.expiresAt,
        refreshExpiresAt: refresh.expiresAt,
      },
      revokedFamily: false,
    };
  }

  verifyAccessToken(accessToken: string): Promise<JwtPayload> {
    return this.jwt.verifyAccessToken(accessToken);
  }

  revokeSession(sessionId: string): Promise<void> {
    return this.store.revoke(sessionId);
  }
}
