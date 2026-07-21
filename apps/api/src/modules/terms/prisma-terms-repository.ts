import type { PrismaClient } from '@fitvo/database';
import { prisma as defaultPrisma } from '@fitvo/database';

import type {
  RecordAcceptanceInput,
  RecordRevocationInput,
  TermsAcceptanceEventRecord,
  TermsRepository,
  TermsVersionRecord,
} from './terms-repository';

const EVENT_PROJECTION = {
  id: true,
  accountId: true,
  termsVersionId: true,
  type: true,
  occurredAt: true,
  ipAddress: true,
  userAgent: true,
} as const;

/** Implementacao Prisma (infra) do repositorio de termos (D-025). */
export class PrismaTermsRepository implements TermsRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async findCurrentVersion(
    slug: Parameters<TermsRepository['findCurrentVersion']>[0],
  ): Promise<TermsVersionRecord | null> {
    const document = await this.db.termsDocument.findUnique({
      where: { slug },
      include: { versions: { orderBy: { publishedAt: 'desc' }, take: 1 } },
    });
    const version = document?.versions[0];
    if (!document || !version) {
      return null;
    }
    return {
      id: version.id,
      documentId: version.documentId,
      documentSlug: document.slug,
      version: version.version,
      isMaterialChange: version.isMaterialChange,
      changeSummary: version.changeSummary,
      contentHash: version.contentHash,
      publishedAt: version.publishedAt,
    };
  }

  async findVersionById(termsVersionId: string): Promise<TermsVersionRecord | null> {
    const version = await this.db.termsVersion.findUnique({
      where: { id: termsVersionId },
      include: { document: { select: { slug: true } } },
    });
    if (!version) {
      return null;
    }
    return {
      id: version.id,
      documentId: version.documentId,
      documentSlug: version.document.slug,
      version: version.version,
      isMaterialChange: version.isMaterialChange,
      changeSummary: version.changeSummary,
      contentHash: version.contentHash,
      publishedAt: version.publishedAt,
    };
  }

  async findLatestEventForAccount(
    accountId: string,
    slug: Parameters<TermsRepository['findLatestEventForAccount']>[1],
  ): Promise<TermsAcceptanceEventRecord | null> {
    const event = await this.db.termsAcceptanceEvent.findFirst({
      where: { accountId, termsVersion: { document: { slug } } },
      orderBy: { occurredAt: 'desc' },
      select: EVENT_PROJECTION,
    });
    return event;
  }

  async hasNewerMaterialVersion(documentId: string, afterPublishedAt: Date): Promise<boolean> {
    const version = await this.db.termsVersion.findFirst({
      where: { documentId, isMaterialChange: true, publishedAt: { gt: afterPublishedAt } },
      select: { id: true },
    });
    return version !== null;
  }

  recordAcceptance(input: RecordAcceptanceInput): Promise<TermsAcceptanceEventRecord> {
    return this.db.termsAcceptanceEvent.create({
      data: {
        accountId: input.accountId,
        termsVersionId: input.termsVersionId,
        type: 'ACCEPTED',
        occurredAt: new Date(),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
      select: EVENT_PROJECTION,
    });
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
    return this.db.termsAcceptanceEvent.create({
      data: {
        accountId: input.accountId,
        termsVersionId,
        type: 'REVOKED',
        occurredAt: new Date(),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
      select: EVENT_PROJECTION,
    });
  }
}
