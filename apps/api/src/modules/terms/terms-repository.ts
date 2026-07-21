import type { TermsAcceptanceEventType, TermsDocumentSlug } from '@fitvo/database';

/**
 * Versao publicada de um documento de termos (D-025). Projecao usada pela
 * slice. NAO confundir com o dominio de `consent` (compartilhamento clinico
 * entre profissionais — ADR-0003/D-016): este e o aceite de Termos de
 * Uso/Politica de Privacidade.
 */
export interface TermsVersionRecord {
  id: string;
  documentId: string;
  documentSlug: TermsDocumentSlug;
  version: string;
  isMaterialChange: boolean;
  changeSummary: string | null;
  contentHash: string;
  publishedAt: Date;
}

/** Evento IMUTAVEL de aceite/revogacao (D-025). Datas em UTC (D-067). */
export interface TermsAcceptanceEventRecord {
  id: string;
  accountId: string;
  termsVersionId: string;
  type: TermsAcceptanceEventType;
  occurredAt: Date;
  ipAddress: string;
  userAgent: string;
}

/** Contexto de origem da requisicao — nunca informado pelo cliente (D-025). */
export interface RequestOrigin {
  ipAddress: string;
  userAgent: string;
}

export interface RecordAcceptanceInput extends RequestOrigin {
  accountId: string;
  termsVersionId: string;
}

export interface RecordRevocationInput extends RequestOrigin {
  accountId: string;
  documentSlug: TermsDocumentSlug;
}

/**
 * Porta de persistencia da slice de termos (Repository Pattern — D-025). O
 * dominio depende desta interface; a infra fornece a implementacao Prisma (ou
 * in-memory nos testes). `TermsVersion`/`TermsAcceptanceEvent` sao
 * APPEND-ONLY: esta interface de proposito NAO expoe update/delete para
 * nenhum dos dois — qualquer mudanca de estado e um evento NOVO.
 */
export interface TermsRepository {
  /** Versao publicada mais recente (maior `publishedAt`) do documento. */
  findCurrentVersion(slug: TermsDocumentSlug): Promise<TermsVersionRecord | null>;

  /**
   * Versao pelo id — usada para resolver o `publishedAt`/`documentId` da
   * versao EXATA que uma conta aceitou (pode nao ser mais a
   * `findCurrentVersion` atual, se uma versao mais nova foi publicada depois).
   */
  findVersionById(termsVersionId: string): Promise<TermsVersionRecord | null>;

  /** Ultimo evento (por `occurredAt`) da conta para QUALQUER versao do documento. */
  findLatestEventForAccount(
    accountId: string,
    slug: TermsDocumentSlug,
  ): Promise<TermsAcceptanceEventRecord | null>;

  /**
   * Existe alguma `TermsVersion` do documento com `isMaterialChange: true` e
   * `publishedAt` estritamente APOS `afterPublishedAt`? Base da regra de
   * re-consentimento (D-025).
   */
  hasNewerMaterialVersion(documentId: string, afterPublishedAt: Date): Promise<boolean>;

  /** Registra um evento ACCEPTED (append-only). */
  recordAcceptance(input: RecordAcceptanceInput): Promise<TermsAcceptanceEventRecord>;

  /**
   * Registra um evento REVOKED (append-only) — contra a versao do ultimo
   * aceite da conta, se houver; senao contra a versao atual do documento.
   */
  recordRevocation(input: RecordRevocationInput): Promise<TermsAcceptanceEventRecord>;
}
