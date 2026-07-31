import type { PrismaClient } from '@fitvo/database';
import { prisma as defaultPrisma, setRlsTenantSession } from '@fitvo/database';

import { recordInitialTermsAcceptance } from '../terms/initial-terms-acceptance';
import type { RequestOrigin } from '../terms/terms-repository';
import type {
  AcceptReceptionInviteOutcome,
  CreateReceptionInviteInput,
  NewReceptionAccount,
  ReceptionInviteRecord,
  ReceptionRepository,
} from './reception-repository';

const INVITE_PROJECTION = {
  id: true,
  tenantId: true,
  email: true,
  name: true,
  status: true,
  expiresAt: true,
  createdAt: true,
} as const;

/** Implementacao Prisma (infra) do repositorio do seat de recepcao (D-156). */
export class PrismaReceptionRepository implements ReceptionRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  createInvite(input: CreateReceptionInviteInput): Promise<ReceptionInviteRecord> {
    return this.db.receptionInvite.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        name: input.name ?? null,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
      select: INVITE_PROJECTION,
    });
  }

  findPendingInviteByEmail(tenantId: string, email: string): Promise<ReceptionInviteRecord | null> {
    return this.db.receptionInvite.findFirst({
      where: { tenantId, email, status: 'PENDING' },
      select: INVITE_PROJECTION,
    });
  }

  acceptInvite(
    tokenHash: string,
    account: NewReceptionAccount,
    origin: RequestOrigin,
  ): Promise<AcceptReceptionInviteOutcome> {
    return this.db.$transaction(async (tx) => {
      const invite = await tx.receptionInvite.findUnique({
        where: { tokenHash },
        select: { id: true, tenantId: true, email: true, status: true, expiresAt: true },
      });
      if (!invite || invite.status !== 'PENDING' || invite.expiresAt.getTime() <= Date.now()) {
        return { status: 'invalid' };
      }

      // Mesmo racional de PrismaInternRepository.acceptInvite: sem ALS aberto
      // (D-150), o RLS (D-152) bloqueia receptionProfile sem a sessao setada.
      await setRlsTenantSession(tx, invite.tenantId);

      const existing = await tx.account.findUnique({
        where: { email: invite.email },
        select: { id: true, receptionProfile: { select: { id: true } } },
      });
      if (existing?.receptionProfile) {
        return { status: 'conflict' };
      }

      // Uso unico race-safe: so um aceite muda PENDING -> ACCEPTED.
      const claimed = await tx.receptionInvite.updateMany({
        where: { id: invite.id, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });
      if (claimed.count === 0) {
        return { status: 'invalid' };
      }

      // O tenant vem DO CONVITE, nunca do corpo do aceite — a recepcionista nao
      // escolhe em qual empresa entra, do mesmo jeito que o estagiario nao
      // escolhe o supervisor (D-142) nem o profissional a propria especialidade
      // (#102). Sem ClinicMembership: a membership so tem CLINIC_ADMIN, e dar
      // uma a recepcao lhe daria poder de admin — o vinculo E esta linha.
      const receptionProfile = { tenant: { connect: { id: invite.tenantId } } };

      if (existing) {
        // Conta ja existe (multi-papel — D-041): ja aceitou termos no proprio
        // cadastro; NAO regrava. So cria o seat que faltava.
        await tx.receptionProfile.create({
          data: { account: { connect: { id: existing.id } }, ...receptionProfile },
        });
        return {
          status: 'accepted',
          tenantId: invite.tenantId,
          accountId: existing.id,
          created: false,
        };
      }

      const created = await tx.account.create({
        data: {
          email: invite.email,
          passwordHash: account.passwordHash,
          name: account.name,
          socialName: account.socialName ?? null,
          gender: account.gender ?? null,
          document: account.document,
          documentType: account.documentType,
          whatsapp: account.whatsapp,
          birthDate: account.birthDate,
          addressStreet: account.address.logradouro,
          addressNumber: account.address.numero,
          addressComplement: account.address.complemento ?? null,
          addressDistrict: account.address.bairro,
          addressCity: account.address.cidade,
          addressState: account.address.state,
          addressZipCode: account.address.cep,
          addressCountry: account.address.country,
          receptionProfile: { create: receptionProfile },
        },
        select: { id: true },
      });
      // Conta NOVA: esta e a porta de nascimento da Account — precisa gravar o
      // consentimento inicial (D-025) na MESMA transacao. Se qualquer parte
      // acima/abaixo falhar, tudo reverte.
      await recordInitialTermsAcceptance(tx, created.id, origin);
      return {
        status: 'accepted',
        tenantId: invite.tenantId,
        accountId: created.id,
        created: true,
      };
    });
  }
}
