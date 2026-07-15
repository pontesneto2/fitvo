/**
 * @fitvo/auth — contratos de autenticacao (D-029). Ver implementacoes nos
 * demais arquivos do pacote; o dominio depende destas interfaces.
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
  /** Revoga TODAS as sessoes de uma conta (troca/recuperacao de senha — D-029). */
  revokeAllSessions(accountId: string): Promise<void>;
}

/** Hashing de senha (Argon2 na implementacao). */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export interface JwtServiceConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  issuer: string;
}

/** Claims do refresh token (jti unico por token, base da rotacao). */
export interface RefreshTokenClaims {
  sub: string;
  sessionId: string;
  jti: string;
}

export type RotateOutcome = 'ok' | 'reuse' | 'revoked';

/**
 * Rastreamento de refresh tokens por sessao/familia (Redis na producao — D-029).
 * Permite rotacao, deteccao de reuso e revogacao real de sessao.
 */
export interface RefreshTokenStore {
  /**
   * Inicia a sessao registrando o primeiro jti valido e indexando a sessao sob
   * a conta (base para revogar todas as sessoes numa troca de senha — D-029).
   */
  startSession(
    sessionId: string,
    accountId: string,
    jti: string,
    ttlSeconds: number,
  ): Promise<void>;
  /**
   * Rotaciona o refresh: se `oldJti` nao for o jti atual da sessao, e reuso —
   * revoga a familia inteira e devolve 'reuse'. Se a sessao estiver revogada,
   * devolve 'revoked'. Caso ok, grava `newJti` como atual e devolve 'ok'.
   */
  rotate(
    sessionId: string,
    oldJti: string,
    newJti: string,
    ttlSeconds: number,
  ): Promise<RotateOutcome>;
  /** Revoga a sessao inteira (logout, troca de senha, suspeita de roubo). */
  revoke(sessionId: string): Promise<void>;
  /** Revoga TODAS as sessoes da conta (troca/recuperacao de senha — D-029). */
  revokeAllForAccount(accountId: string): Promise<void>;
  /** Sessao ativa (existe e nao revogada)? */
  isActive(sessionId: string): Promise<boolean>;
}

/** Finalidade de um token de uso unico enviado por e-mail (D-029). */
export type VerificationPurpose = 'email_verification' | 'password_reset';

/** Token opaco emitido para o usuario, com validade. */
export interface IssuedVerificationToken {
  /** Segredo em claro — enviado ao usuario; NUNCA persistido em claro. */
  token: string;
  expiresAt: Date;
}

/**
 * Rastreamento de tokens de uso unico e curta duracao (Redis na producao —
 * D-029): verificacao de e-mail e recuperacao de senha. O token e guardado
 * apenas como hash; consumir e atomico (uso unico real).
 */
export interface VerificationTokenStore {
  /** Emite um token de uso unico atrelado a um `subject` (ex.: accountId), com TTL. */
  issue(
    purpose: VerificationPurpose,
    subject: string,
    ttlSeconds: number,
  ): Promise<IssuedVerificationToken>;
  /**
   * Consome o token (uso unico): remove e devolve o `subject`, ou `null` se
   * invalido/expirado/ja usado.
   */
  consume(purpose: VerificationPurpose, token: string): Promise<string | null>;
}

/** Erros de dominio da autenticacao. */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      'INVALID_TOKEN' | 'REFRESH_REUSE_DETECTED' | 'SESSION_REVOKED' | 'TOKEN_EXPIRED',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
