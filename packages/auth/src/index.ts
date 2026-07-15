/**
 * @fitvo/auth — autenticacao propria (D-029): JWT com access curto + refresh
 * com rotacao a cada uso, deteccao de reuso (revoga a familia), revogacao real
 * de sessao (por sessao e por conta) via Redis, hashing Argon2, verificacao de
 * e-mail e recuperacao de senha por token de uso unico.
 */
export * from './auth-email-sender';
export * from './auth-service';
export * from './jwt-service';
export * from './password-hasher';
export * from './refresh-token-store';
export * from './types';
export * from './verification-token-store';
