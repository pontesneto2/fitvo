import { UnauthorizedError } from './http-errors';

/** Contexto do chamador autenticado, derivado do access token (Bearer). */
export interface AuthContext {
  /** accountId (identidade — D-041). */
  accountId: string;
  /** Sessao do token (base para revogacao — D-029). */
  sessionId: string;
}

/**
 * Porta minima de verificacao do access token. Satisfeita por @fitvo/auth
 * (`AuthService.verifyAccessToken`) — o guard depende so desta interface, sem
 * acoplar-se a slice de auth nem a implementacao concreta de JWT.
 */
export interface AccessTokenVerifier {
  verifyAccessToken(accessToken: string): Promise<{ sub: string; sessionId: string }>;
}

/** Extrai o token do header Authorization (`Bearer <token>`). */
export function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token de acesso ausente ou malformado.');
  }
  return authorizationHeader.slice('Bearer '.length);
}

/**
 * Guard de autenticacao reutilizavel: verifica o Bearer access token e devolve
 * o contexto do chamador. Mora em `shared/` de proposito — qualquer slice
 * futura (clinic, patient, professional, billing...) precisa dessa mesma etapa;
 * a checagem de papel/RBAC fica a cargo de cada slice sobre este contexto.
 */
export async function requireAuth(
  verifier: AccessTokenVerifier,
  authorizationHeader: string | undefined,
): Promise<AuthContext> {
  const token = extractBearerToken(authorizationHeader);
  const payload = await verifier.verifyAccessToken(token);
  return { accountId: payload.sub, sessionId: payload.sessionId };
}
