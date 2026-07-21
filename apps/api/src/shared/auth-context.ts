import { EmailNotVerifiedError, ReconsentRequiredError, UnauthorizedError } from './http-errors';

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

/**
 * Porta minima de leitura do estado de verificacao da conta. Satisfeita por
 * `AccountRepository` (auth) — o gate depende so desta interface, sem acoplar
 * as demais slices ao repositorio concreto de identidade.
 */
export interface EmailVerificationLookup {
  findById(accountId: string): Promise<{ emailVerifiedAt: Date | null } | null>;
}

/**
 * Gate de e-mail verificado (D-029) para acoes sensiveis: convidar, financeiro,
 * clinico. NAO bloqueia login/onboarding — so a acao sensivel esbarra aqui.
 * Roda DEPOIS da autenticacao/autorizacao de papel (auth -> RBAC -> este gate),
 * sempre no servidor (nunca so escondendo botao no front).
 */
export async function requireVerifiedEmail(
  lookup: EmailVerificationLookup,
  accountId: string,
): Promise<void> {
  const account = await lookup.findById(accountId);
  if (!account || account.emailVerifiedAt === null) {
    throw new EmailNotVerifiedError();
  }
}

/**
 * Porta minima de leitura do status de aceite de termos (D-025). Satisfeita
 * por `TermsRepository`/`TermsApplicationService` (slice `terms`) — o gate
 * depende so desta interface, sem acoplar as demais slices ao repositorio
 * concreto. `slug` identifica o documento (Termos de Uso, Politica de
 * Privacidade — enum `TermsDocumentSlug`); `string` aqui de proposito, para
 * este arquivo `shared/` nao depender de `@fitvo/database`.
 */
export interface TermsAcceptanceLookup {
  getAcceptanceStatus(accountId: string, slug: string): Promise<'CURRENT' | 'RECONSENT_REQUIRED'>;
}

/**
 * Gate de re-consentimento (D-025) para acoes sensiveis: mesma familia e
 * mesma posicao no chain que `requireVerifiedEmail` (auth -> RBAC -> e-mail
 * verificado -> ESTE gate), sempre no servidor. NAO bloqueia login/onboarding.
 * Dispara quando o ultimo evento de aceite foi revogado, ou quando uma versao
 * do documento com `isMaterialChange` foi publicada depois do ultimo aceite
 * (ver `TermsApplicationService.getAcceptanceStatus` para a derivacao).
 */
export async function requireCurrentTermsAcceptance(
  lookup: TermsAcceptanceLookup,
  accountId: string,
  slug: string,
): Promise<void> {
  const status = await lookup.getAcceptanceStatus(accountId, slug);
  if (status !== 'CURRENT') {
    throw new ReconsentRequiredError(slug);
  }
}
