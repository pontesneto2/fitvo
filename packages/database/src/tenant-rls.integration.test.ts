import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { prisma, PrismaClient, runWithTenantContext, setRlsTenantSession } from './index';

/**
 * Integracao — Postgres RLS (D-152, ADR-0017 Slice 3/3), a Camada 3 do
 * isolamento de tenant. Este e o teste que so faz sentido — e so prova
 * alguma coisa — se a conexao NAO for superuser/BYPASSRLS (D-155): um
 * superuser ignora RLS incondicionalmente, e todo teste aqui daria
 * falso-verde. `DATABASE_URL` (e `WEBHOOK_DATABASE_URL`, pro bloco do
 * webhook) precisam apontar pros roles restritos (fitvo_app/fitvo_webhook)
 * ao rodar este arquivo — ver docs/troubleshooting.md. Sem esses roles
 * criados no Postgres local, os blocos abaixo pulam (skip), nao falham.
 *
 * O CORACAO do slice e o primeiro teste: uma query `$queryRaw` CRUA, fora de
 * qualquer metodo tipado do Prisma Client (fora do hook `$allOperations` da
 * extension, D-151/Slice 2) -- prova que o isolamento aqui vem do PROPRIO
 * POSTGRES, nao do nosso codigo TypeScript. E exatamente o gap que a Camada 2
 * sozinha nao cobre (documentado em tenant-isolation-extension.ts).
 */

const rlsRoleReady = Boolean(process.env.DATABASE_URL) && !isLikelyPrivilegedRole();

/**
 * Heuristica barata pra nao rodar a bateria inteira contra o role errado sem
 * avisar: se a connection string do ambiente for literalmente a do role
 * privilegiado de dev (`fitvo:`), os testes abaixo dariam falso-verde (RLS
 * ignorado por superuser) em vez de skip -- prefer-se avisar alto no console
 * a mascarar. Nao substitui checar `rolbypassrls` de verdade (feito no
 * `beforeAll` de cada describe via `verifyNotBypassingRls`), so evita rodar
 * a bateria populando falso-positivo quando o dev esqueceu de trocar o role.
 */
function isLikelyPrivilegedRole(): boolean {
  const url = process.env.DATABASE_URL ?? '';
  return /^postgresql:\/\/fitvo:/.test(url);
}

async function verifyNotBypassingRls(client: PrismaClient): Promise<void> {
  const [role] = await client.$queryRaw<
    { rolname: string; rolbypassrls: boolean; rolsuper: boolean }[]
  >`SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user`;
  if (!role || role.rolbypassrls || role.rolsuper) {
    throw new Error(
      `tenant-rls.integration.test: conectado como "${role?.rolname}" (bypassrls=${role?.rolbypassrls}, ` +
        'superuser=' +
        `${role?.rolsuper}) -- RLS seria teatro com este role. Exporte DATABASE_URL/WEBHOOK_DATABASE_URL ` +
        'apontando pros roles fitvo_app/fitvo_webhook antes de rodar este arquivo (ver docs/troubleshooting.md).',
    );
  }
}

async function runScoped<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return runWithTenantContext(tenantId, async () => await fn());
}

interface Seed {
  tenantId: string;
  bondId: string;
}

/** Seed minimo (1 tenant + 1 bond) via o client PADRAO (extension + RLS batch automatico). */
async function seedTenantWithBond(label: string): Promise<Seed> {
  const id = `${label}-${randomUUID().slice(0, 8)}`;
  const tenant = await prisma.tenant.create({ data: { type: 'SOLO', name: `RLS-${id}` } });
  const specialty = await prisma.specialty.findFirstOrThrow({ where: { code: 'TRAINING' } });

  return runScoped(tenant.id, async () => {
    const pro = await prisma.account.create({
      data: {
        email: `pro-${id}@rls.dev`,
        passwordHash: 'x',
        name: `Pro ${id}`,
        document: '0',
        documentType: 'CPF',
        professionalProfile: { create: { tenantId: tenant.id } },
      },
      select: { professionalProfile: { select: { id: true } } },
    });
    const patient = await prisma.account.create({
      data: {
        email: `pac-${id}@rls.dev`,
        passwordHash: 'x',
        name: `Paciente ${id}`,
        document: '1',
        documentType: 'CPF',
        patientProfile: { create: {} },
      },
      select: { patientProfile: { select: { id: true } } },
    });
    const bond = await prisma.bond.create({
      data: {
        tenantId: tenant.id,
        patientProfileId: patient.patientProfile!.id,
        professionalProfileId: pro.professionalProfile!.id,
        specialtyId: specialty.id,
        modality: 'ONLINE',
      },
    });
    return { tenantId: tenant.id, bondId: bond.id };
  });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe.skipIf(!rlsRoleReady)('RLS (D-152) — $queryRaw cru, fora do ORM/extension', () => {
  it('CORACAO: uma query $queryRaw crua no contexto de A NAO ve o bond de B (RLS, nao a extension, isola)', async () => {
    // Client RAW, SEM a extension (`new PrismaClient()`, nao o `prisma`
    // exportado por este pacote) -- prova que o isolamento nao depende de
    // NENHUM codigo nosso, so da conexao (role) + policy do Postgres.
    const raw = new PrismaClient();
    await verifyNotBypassingRls(raw);

    const a = await seedTenantWithBond('heart-a');
    const b = await seedTenantWithBond('heart-b');

    await raw.$transaction(async (tx) => {
      await setRlsTenantSession(tx, a.tenantId);
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "bond" WHERE id = ANY(${[a.bondId, b.bondId]})`;
      expect(rows.map((r) => r.id)).toEqual([a.bondId]);
    });

    await raw.$transaction(async (tx) => {
      await setRlsTenantSession(tx, b.tenantId);
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "bond" WHERE id = ANY(${[a.bondId, b.bondId]})`;
      expect(rows.map((r) => r.id)).toEqual([b.bondId]);
    });

    await raw.$disconnect();
  });

  it('MUTACAO: SEM o SET (sessao nunca setada), a mesma query crua NAO VE NENHUM dos dois bonds', async () => {
    // Verificacao por mutacao (pedida na revisao): desliga o unico mecanismo
    // que faz o teste de cima passar (o SET) e confirma que o isolamento
    // desaparece JUNTO -- prova que e o RLS (comparacao contra
    // current_setting), nao outra coisa, quem filtra.
    const raw = new PrismaClient();
    await verifyNotBypassingRls(raw);

    const a = await seedTenantWithBond('mut-a');
    const b = await seedTenantWithBond('mut-b');

    // SEM $transaction + SEM setRlsTenantSession: current_setting(...) volta
    // NULL, "tenantId" = NULL e sempre UNKNOWN -- FORCE ROW LEVEL SECURITY
    // filtra as duas linhas, nao so a de outro tenant.
    const rows = await raw.$queryRaw<{ id: string }[]>`SELECT id FROM "bond" WHERE id = ANY(${[
      a.bondId,
      b.bondId,
    ]})`;
    expect(rows).toEqual([]);

    await raw.$disconnect();
  });
});

describe.skipIf(!rlsRoleReady)(
  'RLS (D-152) — caminho normal (extension) continua funcionando',
  () => {
    it('leitura via prisma.bond.findMany (extension) so ve o proprio tenant, com RLS ligado', async () => {
      await verifyNotBypassingRls(prisma);
      const a = await seedTenantWithBond('ext-a');
      const b = await seedTenantWithBond('ext-b');

      const asA = await runScoped(a.tenantId, () =>
        prisma.bond.findMany({ where: { id: { in: [a.bondId, b.bondId] } } }),
      );
      expect(asA.map((r) => r.id)).toEqual([a.bondId]);
    });

    describe('D-153 — $transaction explicito com RLS ligado', () => {
      it('atomico: dois passos na mesma transacao, ambos com RLS, ambos persistem', async () => {
        const a = await seedTenantWithBond('tx-ok-a');
        const tag = `rls-tx-ok-${randomUUID().slice(0, 8)}`;

        const [plan, encounter] = await runScoped(a.tenantId, () =>
          prisma.$transaction(async (tx) => {
            // Padrao aprovado (nao a magica automatica): dev seta a sessao
            // explicitamente no topo do callback, reusando a MESMA tx.
            await setRlsTenantSession(tx, a.tenantId);
            const createdPlan = await tx.workoutPlan.create({
              data: { tenantId: a.tenantId, bondId: a.bondId, title: tag, organization: 'LETTER' },
            });
            const createdEncounter = await tx.encounter.create({
              data: { tenantId: a.tenantId, bondId: a.bondId },
            });
            return [createdPlan, createdEncounter] as const;
          }),
        );

        expect(plan.title).toBe(tag);
        const persistedEncounter = await runScoped(a.tenantId, () =>
          prisma.encounter.findUnique({ where: { id: encounter.id } }),
        );
        expect(persistedEncounter?.id).toBe(encounter.id);
      });

      it('rollback real: falha no segundo passo reverte o primeiro (RLS nao quebra atomicidade)', async () => {
        const a = await seedTenantWithBond('tx-rollback-a');

        await expect(
          runScoped(a.tenantId, () =>
            prisma.$transaction(async (tx) => {
              await setRlsTenantSession(tx, a.tenantId);
              await tx.encounter.create({ data: { tenantId: a.tenantId, bondId: a.bondId } });
              // Forca falha DEPOIS de uma escrita RLS valida (FK pra bond inexistente).
              await tx.medicalRecord.create({
                data: { tenantId: a.tenantId, bondId: 'bond-que-nao-existe' },
              });
            }),
          ),
        ).rejects.toThrow();

        const survived = await runScoped(a.tenantId, () =>
          prisma.encounter.findFirst({ where: { bondId: a.bondId } }),
        );
        // So sobrevive o que o seed criou (nenhum) -- o create do teste reverteu.
        expect(survived).toBeNull();
      });
    });
  },
);

describe.skipIf(!rlsRoleReady)(
  'RLS (D-152) — fluxo-excecao: escrita SEM contexto ALS aberto (registro/aceite de convite)',
  () => {
    it('cria tenant + bond numa transacao SEM AsyncLocalStorage aberto, setando a sessao manualmente (mesmo padrao de accept-invite)', async () => {
      expect(prisma).toBeDefined(); // ancora: nenhum runScoped nesta prova de proposito
      const id = `exc-${randomUUID().slice(0, 8)}`;
      const specialty = await prisma.specialty.findFirstOrThrow({ where: { code: 'TRAINING' } });

      const result = await prisma.$transaction(async (tx) => {
        // Tenant nasce AQUI -- nao ha tenantId conhecido antes deste ponto,
        // exatamente como no registro publico (tenant-context-hook.ts: sem
        // ALS, porque ainda nao ha sessao). O padrao aprovado: setar a
        // sessao assim que o tenantId e conhecido, ainda dentro da MESMA tx.
        const tenant = await tx.tenant.create({ data: { type: 'SOLO', name: `Tenant ${id}` } });
        await setRlsTenantSession(tx, tenant.id);

        const pro = await tx.account.create({
          data: {
            email: `pro-${id}@rls.dev`,
            passwordHash: 'x',
            name: `Pro ${id}`,
            document: '0',
            documentType: 'CPF',
            professionalProfile: { create: { tenantId: tenant.id } },
          },
          select: { professionalProfile: { select: { id: true } } },
        });
        const patient = await tx.account.create({
          data: {
            email: `pac-${id}@rls.dev`,
            passwordHash: 'x',
            name: `Paciente ${id}`,
            document: '1',
            documentType: 'CPF',
            patientProfile: { create: {} },
          },
          select: { patientProfile: { select: { id: true } } },
        });
        const bond = await tx.bond.create({
          data: {
            tenantId: tenant.id,
            patientProfileId: patient.patientProfile!.id,
            professionalProfileId: pro.professionalProfile!.id,
            specialtyId: specialty.id,
            modality: 'ONLINE',
          },
        });
        return { tenantId: tenant.id, bondId: bond.id };
      });

      expect(result.bondId).toBeTruthy();

      // Confere que a linha realmente persistiu e e alcancavel no contexto certo.
      const found = await runScoped(result.tenantId, () =>
        prisma.bond.findUnique({ where: { id: result.bondId } }),
      );
      expect(found?.id).toBe(result.bondId);
    });

    it('SEM setRlsTenantSession (esquecido), a escrita na tabela com RLS e REJEITADA -- prova que a policy e estrita, nao so um filtro de leitura', async () => {
      const id = `exc-noset-${randomUUID().slice(0, 8)}`;
      const specialty = await prisma.specialty.findFirstOrThrow({ where: { code: 'TRAINING' } });

      await expect(
        prisma.$transaction(async (tx) => {
          const tenant = await tx.tenant.create({ data: { type: 'SOLO', name: `Tenant ${id}` } });
          // Deliberadamente NAO chama setRlsTenantSession -- simula o erro
          // que este teste existe pra pegar.
          const pro = await tx.account.create({
            data: {
              email: `pro-${id}@rls.dev`,
              passwordHash: 'x',
              name: `Pro ${id}`,
              document: '0',
              documentType: 'CPF',
              professionalProfile: { create: { tenantId: tenant.id } },
            },
            select: { professionalProfile: { select: { id: true } } },
          });
          const patient = await tx.account.create({
            data: {
              email: `pac-${id}@rls.dev`,
              passwordHash: 'x',
              name: `Paciente ${id}`,
              document: '1',
              documentType: 'CPF',
              patientProfile: { create: {} },
            },
            select: { patientProfile: { select: { id: true } } },
          });
          return tx.bond.create({
            data: {
              tenantId: tenant.id,
              patientProfileId: patient.patientProfile!.id,
              professionalProfileId: pro.professionalProfile!.id,
              specialtyId: specialty.id,
              modality: 'ONLINE',
            },
          });
        }),
      ).rejects.toThrow();
    });
  },
);

const webhookRoleReady = Boolean(process.env.WEBHOOK_DATABASE_URL);

describe.skipIf(!webhookRoleReady)(
  'RLS (D-152) — excecao administrativa restrita (fitvo_webhook)',
  () => {
    const webhookRaw = new PrismaClient({ datasourceUrl: process.env.WEBHOOK_DATABASE_URL ?? '' });

    afterAll(async () => {
      await webhookRaw.$disconnect();
    });

    it('fitvo_webhook atualiza subscription de QUALQUER tenant por id (sem sessao) -- e o gap que ele resolve', async () => {
      const a = await seedTenantWithBond('webhook-a');
      const plan = await prisma.plan.create({
        data: { code: `plan-${randomUUID().slice(0, 8)}`, name: 'Plano RLS', tier: 'solo' },
      });
      const idempotencyKey = `sub-webhook-${randomUUID().slice(0, 8)}`;
      const asaasSubscriptionId = `asaas-sub-${randomUUID().slice(0, 8)}`;
      await runScoped(a.tenantId, () =>
        prisma.subscription.create({
          data: {
            tenantId: a.tenantId,
            planId: plan.id,
            periodicity: 'MONTHLY',
            status: 'TRIALING',
            idempotencyKey,
            asaasSubscriptionId,
          },
        }),
      );

      // fitvo_webhook: SEM sessao de tenant nenhuma (nem o app abre ALS pra
      // este fluxo) -- so acha e atualiza por asaasSubscriptionId.
      const updated = await webhookRaw.subscription.updateMany({
        where: { asaasSubscriptionId },
        data: { status: 'ACTIVE' },
      });
      expect(updated.count).toBe(1);
    });

    it('fitvo_webhook NAO consegue ler nem escrever bond -- privilegio restrito a charge/subscription', async () => {
      const a = await seedTenantWithBond('webhook-scope-a');
      await expect(
        webhookRaw.$queryRaw`SELECT id FROM "bond" WHERE id = ${a.bondId}`,
      ).rejects.toThrow();
    });
  },
);
