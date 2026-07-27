import type { Prisma, TermsDocumentSlug } from '@fitvo/database';

import type { RequestOrigin, TermsRepository } from './terms-repository';

/**
 * Documentos com aceite obrigatorio em qualquer criacao de conta (D-025) —
 * compartilhado pelas duas portas de nascimento de uma Account: o cadastro
 * (auth) e o aceite de convite (patient — D-135/ADR-0015).
 */
export const REQUIRED_TERMS_DOCUMENTS: TermsDocumentSlug[] = ['TERMS_OF_USE', 'PRIVACY_POLICY'];

/**
 * Aceite INICIAL dos termos (D-025), na MESMA transacao Prisma da conta: um
 * evento ACCEPTED por documento obrigatorio, apontando para a versao
 * publicada mais recente (lida DENTRO da transacao — nao ha "isCurrent"
 * separado, a ordenacao por `publishedAt` basta). Compartilhado por
 * `PrismaAccountRepository` (cadastro) e `PrismaPatientRepository` (aceite de
 * convite) — cada uma chama isto dentro do seu proprio `$transaction`.
 */
export async function recordInitialTermsAcceptance(
  tx: Prisma.TransactionClient,
  accountId: string,
  origin: RequestOrigin,
): Promise<void> {
  const now = new Date();
  for (const slug of REQUIRED_TERMS_DOCUMENTS) {
    const currentVersion = await tx.termsVersion.findFirst({
      where: { document: { slug } },
      orderBy: { publishedAt: 'desc' },
      select: { id: true },
    });
    if (!currentVersion) {
      throw new Error(
        `Nenhuma versao publicada para o documento de termos ${slug} — catalogo nao semeado.`,
      );
    }
    await tx.termsAcceptanceEvent.create({
      data: {
        accountId,
        termsVersionId: currentVersion.id,
        type: 'ACCEPTED',
        occurredAt: now,
        ipAddress: origin.ipAddress,
        userAgent: origin.userAgent,
      },
    });
  }
}

/** Mesma regra que `recordInitialTermsAcceptance`, para o double em memoria dos testes. */
export async function recordInitialTermsAcceptanceInMemory(
  terms: TermsRepository,
  accountId: string,
  origin: RequestOrigin,
): Promise<void> {
  for (const slug of REQUIRED_TERMS_DOCUMENTS) {
    const currentVersion = await terms.findCurrentVersion(slug);
    if (!currentVersion) {
      throw new Error(
        `Nenhuma versao publicada para o documento de termos ${slug} — catalogo nao semeado.`,
      );
    }
    await terms.recordAcceptance({
      accountId,
      termsVersionId: currentVersion.id,
      ipAddress: origin.ipAddress,
      userAgent: origin.userAgent,
    });
  }
}
