import type { InternArea, PrismaClient, SpecialtyCode, TenantType } from '@fitvo/database';
import { prisma as defaultPrisma, setRlsTenantSession } from '@fitvo/database';
import { SUPERVISOR_SPECIALTY_CODES_BY_AREA } from '@fitvo/validation';

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
  area: true,
  status: true,
  supervisorProfessionalProfileId: true,
  expiresAt: true,
  createdAt: true,
} as const;

/**
 * Conselhos que supervisionam cada AREA (D-143). NAO redeclarado aqui: vem do
 * CONTRATO (`@fitvo/validation`), que e a fonte unica compartilhada com a UI —
 * uma copia local poderia divergir e o servidor passaria a recusar exatamente
 * quem a tela oferece. O cast e so a ponte de nominalidade entre o mirror do
 * contrato e o enum do Prisma (os valores sao os mesmos, garantidos pelo
 * `satisfies` do lado do contrato).
 */
function supervisorSpecialtyCodes(area: InternArea): SpecialtyCode[] {
  return [...SUPERVISOR_SPECIALTY_CODES_BY_AREA[area]] as SpecialtyCode[];
}

/**
 * Tenants que comportam seat de estagiario: as EMPRESAS. `SOLO` fica de fora —
 * tenant de uma pessoa so nao tem quadro nem admin que convide (o guard de
 * CLINIC_ADMIN ja o excluiria; aqui e explicito).
 */
const COMPANY_TENANT_TYPES: TenantType[] = ['CLINIC', 'ACADEMIA'];

/**
 * Criterio UNICO de elegibilidade do responsavel (D-142/D-143), usado tanto pela
 * listagem quanto pelo guard do convite: perfil do PROPRIO tenant, o tenant e uma
 * EMPRESA, e o profissional tem o conselho DA AREA do estagiario, PREENCHIDO. Um
 * so predicado — a lista que a empresa ve e exatamente o conjunto que o convite
 * aceita; duas copias poderiam divergir e oferecer na tela alguem que o POST
 * recusa.
 *
 * **Quem decide e o CONSELHO do supervisor, nao a vertical do tenant** (D-143).
 * Uma CLINICA com um CREF no quadro pode ter estagiario de educacao fisica; uma
 * ACADEMIA com um CRN, de nutricao. O `type` so exclui `SOLO`: estagiario e seat
 * de EMPRESA — tenant de uma pessoa so nao tem quadro nem admin que convide (e
 * o guard de CLINIC_ADMIN ja o excluiria; aqui fica explicito).
 *
 * "Conselho preenchido" e o maximo que da para exigir hoje: verificacao de
 * registro ATIVO no conselho segue deferida (D-138/TODO(D-010)).
 */
function eligibleSupervisorWhere(tenantId: string, area: InternArea) {
  return {
    tenantId,
    tenant: { type: { in: COMPANY_TENANT_TYPES } },
    specialties: {
      some: {
        councilDocument: { not: null },
        councilState: { not: null },
        specialty: { code: { in: supervisorSpecialtyCodes(area) } },
      },
    },
  };
}

/** Implementacao Prisma (infra) do repositorio do seat de estagiario. */
export class PrismaInternRepository implements InternRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async listEligibleSupervisors(
    tenantId: string,
    area: InternArea,
  ): Promise<InternSupervisorRecord[]> {
    const rows = await this.db.professionalProfile.findMany({
      where: eligibleSupervisorWhere(tenantId, area),
      select: {
        id: true,
        accountId: true,
        displayName: true,
        account: { select: { name: true, socialName: true } },
        specialties: {
          // MESMO filtro do `where` de fora: a credencial projetada tem de ser a
          // que TORNA o profissional elegivel para esta area. Sem isto, um
          // profissional com dois conselhos poderia aparecer na lista de nutricao
          // exibindo o CREF.
          where: {
            councilDocument: { not: null },
            councilState: { not: null },
            specialty: { code: { in: supervisorSpecialtyCodes(area) } },
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

  async isEligibleSupervisor(
    tenantId: string,
    area: InternArea,
    professionalProfileId: string,
  ): Promise<boolean> {
    const found = await this.db.professionalProfile.findFirst({
      where: { id: professionalProfileId, ...eligibleSupervisorWhere(tenantId, area) },
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
        // Area definida pela EMPRESA (D-143) — viaja no convite junto do
        // responsavel; o estagiario nao escolhe nenhum dos dois.
        area: input.area,
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
          area: true,
          supervisorProfessionalProfileId: true,
        },
      });
      if (!invite || invite.status !== 'PENDING' || invite.expiresAt.getTime() <= Date.now()) {
        return { status: 'invalid' };
      }

      // Aceite de convite roda SEM contexto de tenant aberto (D-150 --
      // tenant-context-hook.ts nao abre ALS pra esta rota). O RLS (D-152) bloqueia
      // leitura E escrita em `internProfile`/`bond` sem a variavel de sessao
      // setada -- aqui ja sabemos o tenantId (do convite), entao setamos
      // explicitamente na MESMA transacao antes de qualquer escrita nessas
      // tabelas. Nao afrouxa a policy: so cobre o caso em que o app ja
      // resolveu o tenant certo por outra via (o convite).
      await setRlsTenantSession(tx, invite.tenantId);

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
        // Area e responsavel vem AMBOS do convite — nao do corpo do aceite.
        area: invite.area,
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
          area: invite.area,
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
        area: invite.area,
        supervisorProfessionalProfileId: invite.supervisorProfessionalProfileId,
        created: true,
      };
    });
  }
}
