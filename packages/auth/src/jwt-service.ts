import { randomUUID } from 'node:crypto';

import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';

import type { JwtPayload, JwtServiceConfig, RefreshTokenClaims } from './types';
import { AuthError } from './types';

interface SignedToken {
  token: string;
  expiresAt: Date;
}

/**
 * Emissao e verificacao de JWTs (HS256). Access token curto e refresh token
 * longo com jti unico (base da rotacao/deteccao de reuso — D-029). Segredos
 * separados para access e refresh.
 */
export class JwtTokenService {
  private readonly accessKey: Uint8Array;
  private readonly refreshKey: Uint8Array;

  constructor(private readonly config: JwtServiceConfig) {
    this.accessKey = new TextEncoder().encode(config.accessSecret);
    this.refreshKey = new TextEncoder().encode(config.refreshSecret);
  }

  newJti(): string {
    return randomUUID();
  }

  async signAccessToken(input: { accountId: string; sessionId: string }): Promise<SignedToken> {
    const expiresAt = new Date(Date.now() + this.config.accessTtlSeconds * 1000);
    const token = await new SignJWT({ sessionId: input.sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(input.accountId)
      .setIssuer(this.config.issuer)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.accessKey);
    return { token, expiresAt };
  }

  async signRefreshToken(input: {
    accountId: string;
    sessionId: string;
    jti: string;
  }): Promise<SignedToken> {
    const expiresAt = new Date(Date.now() + this.config.refreshTtlSeconds * 1000);
    const token = await new SignJWT({ sessionId: input.sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(input.accountId)
      .setIssuer(this.config.issuer)
      .setJti(input.jti)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.refreshKey);
    return { token, expiresAt };
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const { payload } = await jwtVerify(token, this.accessKey, { issuer: this.config.issuer });
      return { ...payload, sub: payload.sub ?? '', sessionId: String(payload.sessionId ?? '') };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.refreshKey, { issuer: this.config.issuer });
      if (!payload.sub || !payload.jti || typeof payload.sessionId !== 'string') {
        throw new AuthError('Refresh token sem claims obrigatorios', 'INVALID_TOKEN');
      }
      return { sub: payload.sub, sessionId: payload.sessionId, jti: payload.jti };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private mapError(error: unknown): AuthError {
    if (error instanceof AuthError) {
      return error;
    }
    if (error instanceof joseErrors.JWTExpired) {
      return new AuthError('Token expirado', 'TOKEN_EXPIRED');
    }
    return new AuthError('Token invalido', 'INVALID_TOKEN');
  }
}
