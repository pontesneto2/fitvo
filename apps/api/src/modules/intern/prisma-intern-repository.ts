import type { PrismaClient, SpecialtyCode } from '@fitvo/database';
import { prisma as defaultPrisma } from '@fitvo/database';

import { recordInitialTermsAcceptance } from '../terms/initial-terms-acceptance';
import type { RequestOrigin } from '../terms/terms-repository';
import type {
  AcceptInternInviteOutcome,
  CreateInternInviteInput,
  InternInviteRecord,
  InternRepository,
  InternSupervisorRecord,
  NewInternAccount,
} from './intern-repository';

const INVITE_PROJECTION = {
  id: true,
  tenantId: true,
  email: true,
  name: true,
  status: true,
  supervisorProfessionalProfileId: true,
  expiresAt: true,
  createdAt: true,
} as const;

/**
 * Conselhos que supervisionam estagiario de educacao fisica (D-142). CREF, e so:
 * medico e nutricionista nao supervisionam estagiario de educacao fisica — nem
 * existem numa academia (D-141).
 */
const SUPERVISOR_SPECIALTY_CODES: readonly SpecialtyCode[] = ['TRAINING', 'PERSONAL_TRAINER'];

/**
 * Criterio UNICO de elegibilidade do responsavel (D-142), usado tanto pela
 * listagem quanto pelo guard do convite: perfil do PROPRIO tenant, o tenant e
 * uma ACADEMIA, e o profissional tem especialidade de CREF com conselho
 * PREENCHIDO. Um so predicado — a lista que a academia ve e exatamente o
 * conjunto que o convite aceita; duas copias poderiam divergir e oferecer na
 * tela alguem que o POST recusa.
 *
 * O `type: 'ACADEMIA'` e o que ancora o seat na vertical hoje: estagiario e seat
 * de ACADEMIA (spec §1/§6 — D-142). Numa clinica nao ha responsavel elegivel,
 * logo nao ha convite de estagiario.
 *
 * TODO(estagiario-em-clinica): `ACADEMIA` aqui e restricao de **MVP, NAO regra
 * permanente**. Estagiario de clinica e um caso REAL e previsto (estudante de
 * nutricao ou medicina sob supervisao) — a expansao e generalizar para
 * "estagiario em EMPRESA, com supervisor do conselho APROPRIADO a especialidade":
 * o par (vertical do tenant -> conselhos que supervisionam) vira a tabela, no
 * lugar do par fixo ACADEMIA/CREF de hoje. O que NAO muda na expansao e o
 * essencial: responsavel obrigatorio, NOT NULL, com capacidade derivada dele.
 * Este predicado e o unico ponto de mudanca — de proposito.
 *
 * "Conselho preenchido" e o maximo que da para exigir hoje: verificacao de
 * registro ATIVO no conselho segue deferida (D-138/TODO(D-010)).
 */
function eligibleSupervisorWhere(tenantId: string) {
  return {
    tenantId,
    tenant: { type: 'ACADEMIA' as const },
    specialties: {
      some: {
        councilDocument: { not: null },
        councilState: { not: null },
        specialty: { code: { in: [...SUPERVISOR_SPECIALTY_CODES] } },
      },
    },
  };
}

/** Implementacao Prisma (infra) do repositorio do seat de estagiario. */
export class PrismaInternRepository implements InternRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async listEligibleSupervisors(tenantId: string): Promise<InternSupervisorRecord[]> {
    const rows = await this.db.professionalProfile.findMany({
      where: eligibleSupervisorWhere(tenantId),
      select: {
        id: true,
        accountId: true,
        displayName: true,
        account: { select: { name: true, socialName: true } },
        specialties: {
          where: {
            councilDocument: { not: null },
            councilState: { not: null },
            specialty: { code: { in: [...SUPERVISOR_SPECIALTY_CODES] } },
          },
          select: {
            councilDocument: true,
            councilState: true,
            specialty: { select: { code: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.flatMap((row) => {
      const credential = row.specialties[0];
      // O `where` ja garante ao menos uma; o guard e so para o compilador (e
      // para nunca emitir um supervisor sem conselho no DTO).
      if (!credential?.councilDocument || !credential.councilState) {
        return [];
      }
      return [
        {
          professionalProfileId: row.id,
          accountId: row.accountId,
          // Nome de exibicao (spec §3.1): nome social quando houver. Nunca vaza
          // o nome civil de quem pediu nome social.
          displayName: row.displayName ?? row.account.socialName ?? row.account.name,
          specialtyCode: credential.specialty.code,
          councilDocument: credential.councilDocument,
          councilState: credential.councilState,
        },
      ];
    });
  }

  async isEligibleSupervisor(tenantId: string, professionalProfileId: string): Promise<boolean> {
    const found = await this.db.professionalProfile.findFirst({
      where: { id: professionalProfileId, ...eligibleSupervisorWhere(tenantId) },
      select: { id: true },
    });
    return found !== null;
  }

  createInvite(input: CreateInternInviteInput): Promise<InternInviteRecord> {
    return this.db.internInvite.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        name: input.name ?? null,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        // Responsavel NOT NULL na coluna: mesmo que o guard da aplicacao falhasse,
        // o banco nao aceita um convite de estagiario sem responsavel (D-142).
        supervisorProfessionalProfileId: input.supervisorProfessionalProfileId,
      },
      select: INVITE_PROJECTION,
    });
  }

  findPendingInviteByEmail(tenantId: string, email: string): Promise<InternInviteRecord | null> {
    return this.db.internInvite.findFirst({
      where: { tenantId, email, status: 'PENDING' },
      select: INVITE_PROJECTION,
    });
  }

  acceptInvite(
    tokenHash: string,
    account: NewInternAccount,
    origin: RequestOrigin,
  ): Promise<AcceptInternInviteOutcome> {
    return this.db.$transaction(async (tx) => {
      const invite = await tx.internInvite.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          tenantId: true,
          email: true,
          status: true,
          expiresAt: true,
          supervisorProfessionalProfileId: true,
        },
      });
      if (!invite || invite.status !== 'PENDING' || invite.expiresAt.getTime() <= Date.now()) {
        return { status: 'invalid' };
      }

      const existing = await tx.account.findUnique({
        where: { email: invite.email },
        select: { id: true, internProfile: { select: { id: true } } },
      });
      if (existing?.internProfile) {
        return { status: 'conflict' };
      }

      // Uso unico race-safe: so um aceite muda PENDING -> ACCEPTED.
      const claimed = await tx.internInvite.updateMany({
        where: { id: invite.id, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });
      if (claimed.count === 0) {
        return { status: 'invalid' };
      }

      // O vinculo com o RESPONSAVEL nasce aqui, lido DO CONVITE — o estagiario
      // nao escolhe quem o supervisiona, do mesmo jeito que o profissional de
      // clinica nao escolhe a propria especialidade no aceite (ADR-0015). A FK
      // e NOT NULL: nao ha caminho de codigo que crie o seat sem responsavel.
      //
      // TODO(treino): o FLUXO DE VALIDACAO do trabalho do estagiario
      // (produz -> envia -> pendente -> supervisor revisa/ajusta/valida -> chega
      // ao aluno) engancha NESTE vinculo. Depende do dominio de
      // treino/prescricao, que ainda NAO existe — ver docs/roadmap.md
      // ("Fluxo de validacao do trabalho do estagiario"). Este slice cria so a
      // IDENTIDADE e o VINCULO; a validacao se pluga no supervisor daqui.
      const internProfile = {
        tenant: { connect: { id: invite.tenantId } },
        supervisor: { connect: { id: invite.supervisorProfessionalProfileId } },
      };

      if (existing) {
        // Conta ja existe (multi-papel — D-041): ja aceitou termos no proprio
        // cadastro; NAO regrava. So cria o seat que faltava.
        await tx.internProfile.create({
          data: { account: { connect: { id: existing.id } }, ...internProfile },
        });
        return {
          status: 'accepted',
          tenantId: invite.tenantId,
          accountId: existing.id,
          supervisorProfessionalProfileId: invite.supervisorProfessionalProfileId,
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
          internProfile: { create: internProfile },
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
        supervisorProfessionalProfileId: invite.supervisorProfessionalProfileId,
        created: true,
      };
    });
  }
}
