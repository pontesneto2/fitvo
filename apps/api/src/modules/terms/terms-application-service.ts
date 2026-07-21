import type { TermsDocumentSlug } from '@fitvo/database';

import type { AccessTokenVerifier, TermsAcceptanceLookup } from '../../shared/auth-context';
import { requireAuth } from '../../shared/auth-context';
import { NotFoundError } from '../../shared/http-errors';
import type { RequestOrigin, TermsRepository } from './terms-repository';

/** Status de aceite de UM documento para uma conta (D-025). */
export type TermsAcceptanceStatus = 'CURRENT' | 'RECONSENT_REQUIRED';

/** Status exposto na API — um por documento do catalogo. */
export interface TermsStatusView {
  slug: TermsDocumentSlug;
  status: TermsAcceptanceStatus;
}

const ALL_DOCUMENT_SLUGS: TermsDocumentSlug[] = ['TERMS_OF_USE', 'PRIVACY_POLICY'];

/**
 * Servico de aplicacao da slice de termos (D-025 — LGPD). Cobre o aceite
 * inicial no cadastro (feito pela slice `auth`, na mesma transacao da conta —
 * ver `PrismaAccountRepository`), a consulta do status atual e o
 * aceite/revogacao POSTERIORES (re-consentimento). Implementa
 * `TermsAcceptanceLookup` (shared/auth-context.ts) para que o guard
 * `requireCurrentTermsAcceptance` reuse esta MESMA instancia, sem repositorio
 * duplicado — mesmo padrao de `EmailVerificationLookup`/`AccountRepository`.
 *
 * Regra de derivacao do status (nunca guardado de forma mutavel — SEMPRE
 * calculado do historico append-only):
 * 1. Acha o ultimo evento (por `occurredAt`) de QUALQUER versao do documento
 *    para a conta.
 * 2. Sem evento, ou o ultimo e REVOKED -> `RECONSENT_REQUIRED`.
 * 3. Ultimo e ACCEPTED -> `RECONSENT_REQUIRED` se alguma versao do documento
 *    com `isMaterialChange: true` foi publicada DEPOIS da versao aceita;
 *    senao `CURRENT`.
 */
export class TermsApplicationService implements TermsAcceptanceLookup {
  constructor(
    private readonly terms: TermsRepository,
    private readonly tokenVerifier: AccessTokenVerifier,
  ) {}

  /** Status de aceite dos documentos do catalogo para a conta autenticada. */
  async getStatus(authorization: string | undefined): Promise<TermsStatusView[]> {
    const ctx = await requireAuth(this.tokenVerifier, authorization);
    const statuses = await Promise.all(
      ALL_DOCUMENT_SLUGS.map(async (slug) => ({
        slug,
        status: await this.getAcceptanceStatus(ctx.accountId, slug),
      })),
    );
    return statuses;
  }

  /**
   * Porta consumida pelo guard `requireCurrentTermsAcceptance` (shared) — ver
   * a regra de derivacao na doc da classe.
   */
  async getAcceptanceStatus(accountId: string, slug: string): Promise<TermsAcceptanceStatus> {
    const documentSlug = slug as TermsDocumentSlug;
    const latest = await this.terms.findLatestEventForAccount(accountId, documentSlug);
    if (!latest || latest.type === 'REVOKED') {
      return 'RECONSENT_REQUIRED';
    }
    // Resolve a versao EXATA que a conta aceitou (pode ja nao ser mais a
    // atual do catalogo, se uma versao mais nova foi publicada depois).
    const acceptedVersion = await this.terms.findVersionById(latest.termsVersionId);
    if (!acceptedVersion) {
      // Nao deveria acontecer (FK Restrict garante a versao existir) — trata
      // conservadoramente como exigindo re-consentimento.
      return 'RECONSENT_REQUIRED';
    }
    const hasMaterialUpdate = await this.terms.hasNewerMaterialVersion(
      acceptedVersion.documentId,
      acceptedVersion.publishedAt,
    );
    return hasMaterialUpdate ? 'RECONSENT_REQUIRED' : 'CURRENT';
  }

  /**
   * Re-consentimento: a conta autenticada aceita a versao ATUAL publicada do
   * documento. Escreve um novo evento ACCEPTED (append-only).
   */
  async accept(
    authorization: string | undefined,
    slug: TermsDocumentSlug,
    origin: RequestOrigin,
  ): Promise<void> {
    const ctx = await requireAuth(this.tokenVerifier, authorization);
    const current = await this.terms.findCurrentVersion(slug);
    if (!current) {
      throw new NotFoundError('Documento de termos sem versao publicada.');
    }
    await this.terms.recordAcceptance({
      accountId: ctx.accountId,
      termsVersionId: current.id,
      ipAddress: origin.ipAddress,
      userAgent: origin.userAgent,
    });
  }

  /**
   * Revoga o aceite do documento (a conta autenticada retira o consentimento).
   * Escreve um novo evento REVOKED (append-only) — nunca apaga o historico.
   * Qualquer acao gated por `requireCurrentTermsAcceptance` volta a exigir
   * re-consentimento imediatamente apos isto.
   */
  async revoke(
    authorization: string | undefined,
    slug: TermsDocumentSlug,
    origin: RequestOrigin,
  ): Promise<void> {
    const ctx = await requireAuth(this.tokenVerifier, authorization);
    await this.terms.recordRevocation({
      accountId: ctx.accountId,
      documentSlug: slug,
      ipAddress: origin.ipAddress,
      userAgent: origin.userAgent,
    });
  }
}
