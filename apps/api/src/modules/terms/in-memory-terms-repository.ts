import type { TermsAcceptanceEventType, TermsDocumentSlug } from '@fitvo/database';

import type {
  RecordAcceptanceInput,
  RecordRevocationInput,
  TermsAcceptanceEventRecord,
  TermsRepository,
  TermsVersionRecord,
} from './terms-repository';

type StoredVersion = TermsVersionRecord;

interface StoredEvent extends TermsAcceptanceEventRecord {
  documentSlug: TermsDocumentSlug;
}

/**
 * Implementacao em memoria para testes e dev local (D-025). Espelha a logica
 * da implementacao Prisma sobre arrays/Maps (o loop single-thread do Node
 * torna cada operacao efetivamente atomica). O helper `seedDocument`/
 * `seedVersion` arranjam o catalogo — o equivalente ao INSERT da migracao.
 */
export class InMemoryTermsRepository implements TermsRepository {
  private readonly versions = new Map<string, StoredVersion>();
  private readonly events: StoredEvent[] = [];
  private sequence = 0;

  // --- Seed helpers (testes/dev; fora da interface de producao) ---

  /** Semeia uma versao publicada de um documento. Retorna o id da versao. */
  seedVersion(input: {
    documentId: string;
    documentSlug: TermsDocumentSlug;
    version: string;
    isMaterialChange: boolean;
    changeSummary?: string | null;
    contentHash?: string;
    publishedAt: Date;
  }): string {
    const id = this.nextId('termsver');
    this.versions.set(id, {
      id,
      documentId: input.documentId,
      documentSlug: input.documentSlug,
      version: input.version,
      isMaterialChange: input.isMaterialChange,
      changeSummary: input.changeSummary ?? null,
      contentHash: input.contentHash ?? 'seed-hash',
      publishedAt: input.publishedAt,
    });
    return id;
  }

  /**
   * Semeia o catalogo padrao (os dois documentos + v1 material cada) — mesmo
   * conteudo semeado pela migracao de producao, para testes que so precisam
   * de "o mundo existe" sem se importar com os ids exatos.
   */
  seedDefaultCatalog(): void {
    this.seedVersion({
      documentId: 'terms_doc_tou',
      documentSlug: 'TERMS_OF_USE',
      version: '1.0.0',
      isMaterialChange: true,
      changeSummary: 'Versao inicial dos Termos de Uso.',
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    });
    this.seedVersion({
      documentId: 'terms_doc_pp',
      documentSlug: 'PRIVACY_POLICY',
      version: '1.0.0',
      isMaterialChange: true,
      changeSummary: 'Versao inicial da Politica de Privacidade.',
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    });
  }

  /** Helper de teste: busca um evento pelo id (prova de imutabilidade — nao apagar/atualizar). */
  findEventById(id: string): TermsAcceptanceEventRecord | null {
    const event = this.events.find((candidate) => candidate.id === id);
    return event ? this.toEventRecord(event) : null;
  }

  /** Helper de teste: lista todos os eventos de uma conta para um documento. */
  listEventsForAccount(accountId: string, slug: TermsDocumentSlug): TermsAcceptanceEventRecord[] {
    return this.events
      .filter((event) => event.accountId === accountId && event.documentSlug === slug)
      .map((event) => this.toEventRecord(event));
  }

  // --- TermsRepository ---

  findCurrentVersion(slug: TermsDocumentSlug): Promise<TermsVersionRecord | null> {
    let current: StoredVersion | null = null;
    for (const version of this.versions.values()) {
      if (version.documentSlug !== slug) continue;
      if (!current || version.publishedAt.getTime() > current.publishedAt.getTime()) {
        current = version;
      }
    }
    return Promise.resolve(current ? { ...current } : null);
  }

  findVersionById(termsVersionId: string): Promise<TermsVersionRecord | null> {
    const version = this.versions.get(termsVersionId);
    return Promise.resolve(version ? { ...version } : null);
  }

  findLatestEventForAccount(
    accountId: string,
    slug: TermsDocumentSlug,
  ): Promise<TermsAcceptanceEventRecord | null> {
    let latest: StoredEvent | null = null;
    for (const event of this.events) {
      if (event.accountId !== accountId || event.documentSlug !== slug) continue;
      if (!latest || event.occurredAt.getTime() > latest.occurredAt.getTime()) {
        latest = event;
      }
    }
    return Promise.resolve(latest ? this.toEventRecord(latest) : null);
  }

  hasNewerMaterialVersion(documentId: string, afterPublishedAt: Date): Promise<boolean> {
    for (const version of this.versions.values()) {
      if (
        version.documentId === documentId &&
        version.isMaterialChange &&
        version.publishedAt.getTime() > afterPublishedAt.getTime()
      ) {
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }

  recordAcceptance(input: RecordAcceptanceInput): Promise<TermsAcceptanceEventRecord> {
    const version = this.versions.get(input.termsVersionId);
    if (!version) {
      throw new Error(`TermsVersion ${input.termsVersionId} inexistente.`);
    }
    return Promise.resolve(
      this.pushEvent({
        accountId: input.accountId,
        termsVersionId: input.termsVersionId,
        documentSlug: version.documentSlug,
        type: 'ACCEPTED',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      }),
    );
  }

  async recordRevocation(input: RecordRevocationInput): Promise<TermsAcceptanceEventRecord> {
    const latest = await this.findLatestEventForAccount(input.accountId, input.documentSlug);
    let termsVersionId = latest?.termsVersionId;
    if (!termsVersionId) {
      const current = await this.findCurrentVersion(input.documentSlug);
      if (!current) {
        throw new Error(`Nenhuma versao publicada para ${input.documentSlug}.`);
      }
      termsVersionId = current.id;
    }
    return this.pushEvent({
      accountId: input.accountId,
      termsVersionId,
      documentSlug: input.documentSlug,
      type: 'REVOKED',
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }

  // --- helpers privados ---

  private pushEvent(input: {
    accountId: string;
    termsVersionId: string;
    documentSlug: TermsDocumentSlug;
    type: TermsAcceptanceEventType;
    ipAddress: string;
    userAgent: string;
  }): TermsAcceptanceEventRecord {
    const event: StoredEvent = {
      id: this.nextId('termsevt'),
      accountId: input.accountId,
      termsVersionId: input.termsVersionId,
      documentSlug: input.documentSlug,
      type: input.type,
      occurredAt: new Date(),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    };
    this.events.push(event);
    return this.toEventRecord(event);
  }

  private toEventRecord(event: StoredEvent): TermsAcceptanceEventRecord {
    return {
      id: event.id,
      accountId: event.accountId,
      termsVersionId: event.termsVersionId,
      type: event.type,
      occurredAt: event.occurredAt,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    };
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }
}
