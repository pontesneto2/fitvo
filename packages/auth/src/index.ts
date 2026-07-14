/**
 * @fitvo/auth — contratos de autenticacao propria (D-029): JWT com access
 * curto + refresh com rotacao, deteccao de reuso, revogacao de sessao e
 * hashing. Interfaces apenas; a implementacao (Argon2, Redis, JWT) e Fase 2.
 */

export interface JwtPayload {
  /** accountId (identidade — D-041). */
  sub: string;
  /** Sessao a que o token pertence (base para revogacao). */
  sessionId: string;
  [claim: string]: unknown;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

/** Resultado da rotacao de refresh; sinaliza revogacao de familia em caso de reuso. */
export interface RefreshRotationResult {
  tokens: AuthTokens;
  revokedFamily: boolean;
}

export interface AuthService {
  issueTokens(input: { accountId: string; sessionId: string }): Promise<AuthTokens>;
  rotateRefreshToken(refreshToken: string): Promise<RefreshRotationResult>;
  verifyAccessToken(accessToken: string): Promise<JwtPayload>;
  revokeSession(sessionId: string): Promise<void>;
}

/** Hashing de senha (Argon2 na implementacao). */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}
