/**
 * @fitvo/auth — autenticacao propria (D-029): JWT com access curto + refresh
 * com rotacao a cada uso, deteccao de reuso (revoga a familia), revogacao real
 * de sessao via Redis e hashing Argon2.
 */
export * from './auth-service';
export * from './jwt-service';
export * from './password-hasher';
export * from './refresh-token-store';
export * from './types';
