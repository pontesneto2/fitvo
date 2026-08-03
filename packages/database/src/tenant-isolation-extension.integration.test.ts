import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { getTenantContext, normalizeLibraryItemName, prisma, runWithTenantContext } from './index';

/**
 * Integracao — bateria de VAZAMENTO da extension de isolamento de tenant
 * (D-151 — ADR-0017, Slice 2/3), contra Postgres real. Este e o coracao do
 * slice: prova que, com o contexto de tenant aberto (D-150), NENHUMA leitura,
 * escrita, atualizacao ou remocao de um modelo bucket-A cruza tenant — para
 * CADA UM dos 30 modelos escopados, nao so uma amostra.
 *
 * Semeia DOIS grafos de tenant completos (A e B) cobrindo os 30 modelos bucket
 * A (mais as dependencias bucket-E minimas: Meal, ProfessionalSpecialty,
 * ProfessionalService). Cada checagem de vazamento usa `id: { in: [rowA,
 * rowB] }` no `where` — NAO um `findMany()` cru — porque o banco e
 * compartilhado entre execucoes (mesma convencao de anamnesis.integration.test.ts)
 * e um `findMany()` sem filtro pegaria linhas de execucoes anteriores.
 */

/**
 * Roda `fn` dentro do contexto de tenant. CRITICO: `fn` PRECISA ser assincrona
 * e dar `await` na chamada Prisma internamente — nunca `() => prisma.x.y(args)`
 * (sem await). O Prisma retorna uma PROMISE PREGUICOSA (so dispara a query —
 * e so entao entra no hook da extension — quando algo da `.then()`/`await`
 * nela). `AsyncLocalStorage.run(store, callback)` so mantem o contexto ativo
 * durante a extensao SINCRONA de `callback`; um `callback` nao-async que so
 * devolve a promise crua sai do `run()` ANTES de qualquer coisa disparar essa
 * promise — a extension entao roda sem contexto. `async () => await fn()`
 * forca o disparo a acontecer AINDA DENTRO do `run()`. Isto NAO e um problema
 * do fluxo real (Fastify): la, `runWithTenantContext(tenantId, done)` chama um
 * `done` que dispara a PROXIMA hook/handler (sempre `async`) sincronamente
 * dentro do `run()` — e cada `await` subsequente, ate a chamada Prisma real,
 * agenda sua propria continuacao ainda dentro da cadeia rastreada. O risco e
 * so em codigo de teste/script que chama `runWithTenantContext` "por fora".
 */
async function runScoped<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return runWithTenantContext(tenantId, async () => await fn());
}

afterAll(async () => {
  await prisma.$disconnect();
});

interface TenantGraph {
  tenantId: string;
  clinicMembershipId: string;
  professionalProfileId: string;
  professionalInviteId: string;
  internProfileId: string;
  internInviteId: string;
  receptionProfileId: string;
  receptionInviteId: string;
  patientInviteId: string;
  bondId: string;
  paymentAccountId: string;
  subscriptionId: string;
  chargeId: string;
  workoutPlanId: string;
  workoutId: string;
  workoutItemId: string;
  workoutSetId: string;
  workoutSessionId: string;
  setLogId: string;
  workoutRatingId: string;
  formAnalysisId: string;
  mealPlanId: string;
  mealLogId: string;
  encounterId: string;
  medicalRecordId: string;
  prescriptionId: string;
  anamnesisId: string;
  assessmentId: string;
  progressPhotoId: string;
  attendanceId: string;
  appointmentId: string;
  patientAccountId: string;
  professionalSpecialtyId: string;
  planId: string;
}

/**
 * Seed isolado por chamada: o banco e compartilhado e nao e limpo entre
 * execucoes.
 *
 * Roda DENTRO de `runScoped(tenant.id, ...)` a partir da criacao do tenant
 * (D-152/Slice 3): 10 dos 30 modelos aqui tambem tem RLS (bond, internProfile,
 * receptionProfile, paymentAccount, subscription, charge, encounter,
 * medicalRecord, prescription, anamnesis) -- sem a variavel de sessao setada
 * (o que so acontece com um contexto de tenant aberto, batido automaticamente
 * pela extension no caminho avulso), o Postgres bloqueia a ESCRITA nessas
 * tabelas assim que RLS estiver ligado e a conexao de teste for um role sem
 * BYPASSRLS. Sem RLS ligado (ou com o role privilegiado de antes do Slice 3),
 * isto e estritamente equivalente ao seed anterior -- so muda de conexao
 * implicita, nao de resultado.
 */
async function seedTenantGraph(label: string): Promise<TenantGraph> {
  const id = `${label}-${randomUUID().slice(0, 8)}`;
  const tenant = await prisma.tenant.create({ data: { type: 'CLINIC', name: `Tenant ${id}` } });
  const specialty = await prisma.specialty.findFirstOrThrow({ where: { code: 'TRAINING' } });

  return runScoped(tenant.id, () => seedTenantGraphScoped(id, tenant.id, specialty.id));
}

async function seedTenantGraphScoped(
  id: string,
  tenantId: string,
  specialtyId: string,
): Promise<TenantGraph> {
  const tenant = { id: tenantId };
  const specialty = { id: specialtyId };
  const proAccount = await prisma.account.create({
    data: {
      email: `pro-${id}@e2e.dev`,
      passwordHash: 'x',
      name: `Pro ${id}`,
      document: '00000000000',
      documentType: 'CPF',
      professionalProfile: { create: { tenantId: tenant.id } },
    },
    select: { id: true, professionalProfile: { select: { id: true } } },
  });
  const professionalProfileId = proAccount.professionalProfile!.id;

  const patientAccount = await prisma.account.create({
    data: {
      email: `pac-${id}@e2e.dev`,
      passwordHash: 'x',
      name: `Paciente ${id}`,
      document: '11111111111',
      documentType: 'CPF',
      patientProfile: { create: {} },
    },
    select: { id: true, patientProfile: { select: { id: true } } },
  });
  const patientProfileId = patientAccount.patientProfile!.id;

  const internAccount = await prisma.account.create({
    data: {
      email: `int-${id}@e2e.dev`,
      passwordHash: 'x',
      name: `Estagiario ${id}`,
      document: '22222222222',
      documentType: 'CPF',
    },
  });
  const receptionAccount = await prisma.account.create({
    data: {
      email: `rec-${id}@e2e.dev`,
      passwordHash: 'x',
      name: `Recepcao ${id}`,
      document: '33333333333',
      documentType: 'CPF',
    },
  });

  const clinicMembership = await prisma.clinicMembership.create({
    data: { accountId: proAccount.id, tenantId: tenant.id, role: 'CLINIC_ADMIN' },
  });
  const professionalInvite = await prisma.professionalInvite.create({
    data: {
      tenantId: tenant.id,
      email: `invite-pro-${id}@e2e.dev`,
      tokenHash: `hash-pro-${id}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  const internProfile = await prisma.internProfile.create({
    data: {
      accountId: internAccount.id,
      tenantId: tenant.id,
      area: 'EDUCACAO_FISICA',
      supervisorProfessionalProfileId: professionalProfileId,
    },
  });
  const internInvite = await prisma.internInvite.create({
    data: {
      tenantId: tenant.id,
      email: `invite-int-${id}@e2e.dev`,
      area: 'EDUCACAO_FISICA',
      tokenHash: `hash-int-${id}`,
      expiresAt: new Date(Date.now() + 86_400_000),
      supervisorProfessionalProfileId: professionalProfileId,
    },
  });
  const receptionProfile = await prisma.receptionProfile.create({
    data: { accountId: receptionAccount.id, tenantId: tenant.id },
  });
  const receptionInvite = await prisma.receptionInvite.create({
    data: {
      tenantId: tenant.id,
      email: `invite-rec-${id}@e2e.dev`,
      tokenHash: `hash-rec-${id}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  const patientInvite = await prisma.patientInvite.create({
    data: {
      tenantId: tenant.id,
      professionalProfileId,
      specialtyId: specialty.id,
      email: `invite-pac-${id}@e2e.dev`,
      modality: 'ONLINE',
      tokenHash: `hash-pac-${id}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });

  const bond = await prisma.bond.create({
    data: {
      tenantId: tenant.id,
      patientProfileId,
      professionalProfileId,
      specialtyId: specialty.id,
      modality: 'ONLINE',
    },
  });

  const paymentAccount = await prisma.paymentAccount.create({ data: { tenantId: tenant.id } });
  const plan = await prisma.plan.create({
    data: { code: `plan-${id}`, name: `Plano ${id}`, tier: 'solo' },
  });
  const subscription = await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      planId: plan.id,
      periodicity: 'MONTHLY',
      status: 'TRIALING',
      idempotencyKey: `sub-${id}`,
    },
  });
  const charge = await prisma.charge.create({
    data: {
      tenantId: tenant.id,
      bondId: bond.id,
      amountCents: 1000,
      method: 'PIX',
      idempotencyKey: `charge-${id}`,
    },
  });

  const workoutPlan = await prisma.workoutPlan.create({
    data: {
      tenantId: tenant.id,
      bondId: bond.id,
      title: `Plano treino ${id}`,
      organization: 'LETTER',
    },
  });
  const workout = await prisma.workout.create({
    data: { tenantId: tenant.id, bondId: bond.id, planId: workoutPlan.id, title: `Treino A ${id}` },
  });
  // Biblioteca (bucket C — D-171): a extension NAO toca `exercise`, entao o
  // tenantId aqui e passado EXPLICITAMENTE. Item do proprio tenant, PRIVATE.
  const muscleGroup = await prisma.muscleGroup.findFirstOrThrow({ where: { code: 'PEITO' } });
  const exercise = await prisma.exercise.create({
    data: {
      tenantId: tenant.id,
      ownerProfessionalProfileId: professionalProfileId,
      primaryMuscleGroupId: muscleGroup.id,
      name: `Supino ${id}`,
      nameNormalized: normalizeLibraryItemName(`Supino ${id}`),
      visibility: 'PRIVATE',
    },
  });

  const workoutItem = await prisma.workoutItem.create({
    data: { tenantId: tenant.id, workoutId: workout.id, exerciseId: exercise.id, position: 0 },
  });
  const workoutSet = await prisma.workoutSet.create({
    data: { tenantId: tenant.id, workoutItemId: workoutItem.id, position: 0, reps: 12 },
  });

  const workoutSession = await prisma.workoutSession.create({
    data: {
      tenantId: tenant.id,
      bondId: bond.id,
      workoutId: workout.id,
      planId: workoutPlan.id,
      performedAt: new Date(),
    },
  });
  const setLog = await prisma.setLog.create({
    data: {
      tenantId: tenant.id,
      sessionId: workoutSession.id,
      workoutSetId: workoutSet.id,
      done: true,
      actualReps: 10,
    },
  });
  const workoutRating = await prisma.workoutRating.create({
    data: { tenantId: tenant.id, sessionId: workoutSession.id, score: 5, perceivedEffort: 4 },
  });

  const formAnalysis = await prisma.formAnalysis.create({
    data: { tenantId: tenant.id, bondId: bond.id, videoStorageKey: `video-${id}` },
  });

  const mealPlan = await prisma.mealPlan.create({
    data: { tenantId: tenant.id, bondId: bond.id, title: `Plano alimentar ${id}` },
  });
  const meal = await prisma.meal.create({
    data: { mealPlanId: mealPlan.id, moment: 'ALMOCO' },
  });
  const mealLog = await prisma.mealLog.create({
    data: {
      tenantId: tenant.id,
      bondId: bond.id,
      mealId: meal.id,
      status: 'ATE_ALL',
      loggedAt: new Date(),
    },
  });

  const encounter = await prisma.encounter.create({
    data: { tenantId: tenant.id, bondId: bond.id },
  });
  const medicalRecord = await prisma.medicalRecord.create({
    data: { tenantId: tenant.id, bondId: bond.id },
  });
  const prescription = await prisma.prescription.create({
    data: { tenantId: tenant.id, encounterId: encounter.id },
  });
  const anamnesis = await prisma.anamnesis.create({
    data: { tenantId: tenant.id, bondId: bond.id },
  });
  const assessment = await prisma.assessment.create({
    data: { tenantId: tenant.id, bondId: bond.id },
  });
  const progressPhoto = await prisma.progressPhoto.create({
    data: { tenantId: tenant.id, bondId: bond.id, storageKey: `photo-${id}` },
  });
  const attendance = await prisma.attendance.create({
    data: {
      tenantId: tenant.id,
      bondId: bond.id,
      openedByAccountId: patientAccount.id,
      subject: `Duvida ${id}`,
    },
  });

  const professionalSpecialty = await prisma.professionalSpecialty.create({
    data: { professionalProfileId, specialtyId: specialty.id },
  });
  const professionalService = await prisma.professionalService.create({
    data: {
      professionalSpecialtyId: professionalSpecialty.id,
      name: `Consulta ${id}`,
      durationMinutes: 60,
      priceCents: 5000,
      type: 'FIRST_VISIT',
    },
  });
  const startsAt = new Date(Date.now() + 3_600_000);
  const endsAt = new Date(startsAt.getTime() + 3_600_000);
  const appointment = await prisma.appointment.create({
    data: {
      tenantId: tenant.id,
      bondId: bond.id,
      professionalProfileId,
      serviceId: professionalService.id,
      startsAt,
      endsAt,
      priceCentsAtBooking: 5000,
      serviceTypeAtBooking: 'FIRST_VISIT',
    },
  });

  return {
    tenantId: tenant.id,
    clinicMembershipId: clinicMembership.id,
    professionalProfileId,
    professionalInviteId: professionalInvite.id,
    internProfileId: internProfile.id,
    internInviteId: internInvite.id,
    receptionProfileId: receptionProfile.id,
    receptionInviteId: receptionInvite.id,
    patientInviteId: patientInvite.id,
    bondId: bond.id,
    paymentAccountId: paymentAccount.id,
    subscriptionId: subscription.id,
    chargeId: charge.id,
    workoutPlanId: workoutPlan.id,
    workoutId: workout.id,
    workoutItemId: workoutItem.id,
    workoutSetId: workoutSet.id,
    workoutSessionId: workoutSession.id,
    setLogId: setLog.id,
    workoutRatingId: workoutRating.id,
    formAnalysisId: formAnalysis.id,
    mealPlanId: mealPlan.id,
    mealLogId: mealLog.id,
    encounterId: encounter.id,
    medicalRecordId: medicalRecord.id,
    prescriptionId: prescription.id,
    anamnesisId: anamnesis.id,
    assessmentId: assessment.id,
    progressPhotoId: progressPhoto.id,
    attendanceId: attendance.id,
    appointmentId: appointment.id,
    patientAccountId: patientAccount.id,
    professionalSpecialtyId: professionalSpecialty.id,
    planId: plan.id,
  };
}

describe('tenant-isolation-extension (D-151) — bateria de vazamento contra Postgres real', () => {
  it('duas contas de tenants diferentes nunca vazam entre si, para os 30 modelos bucket A', async () => {
    const a = await seedTenantGraph('a');
    const b = await seedTenantGraph('b');

    const checks: Array<{
      model: string;
      idA: string;
      idB: string;
      findMany: (ids: string[]) => Promise<{ id: string }[]>;
    }> = [
      {
        model: 'clinicMembership',
        idA: a.clinicMembershipId,
        idB: b.clinicMembershipId,
        findMany: (ids) => prisma.clinicMembership.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'professionalProfile',
        idA: a.professionalProfileId,
        idB: b.professionalProfileId,
        findMany: (ids) => prisma.professionalProfile.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'professionalInvite',
        idA: a.professionalInviteId,
        idB: b.professionalInviteId,
        findMany: (ids) => prisma.professionalInvite.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'internProfile',
        idA: a.internProfileId,
        idB: b.internProfileId,
        findMany: (ids) => prisma.internProfile.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'internInvite',
        idA: a.internInviteId,
        idB: b.internInviteId,
        findMany: (ids) => prisma.internInvite.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'receptionProfile',
        idA: a.receptionProfileId,
        idB: b.receptionProfileId,
        findMany: (ids) => prisma.receptionProfile.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'receptionInvite',
        idA: a.receptionInviteId,
        idB: b.receptionInviteId,
        findMany: (ids) => prisma.receptionInvite.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'patientInvite',
        idA: a.patientInviteId,
        idB: b.patientInviteId,
        findMany: (ids) => prisma.patientInvite.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'bond',
        idA: a.bondId,
        idB: b.bondId,
        findMany: (ids) => prisma.bond.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'paymentAccount',
        idA: a.paymentAccountId,
        idB: b.paymentAccountId,
        findMany: (ids) => prisma.paymentAccount.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'subscription',
        idA: a.subscriptionId,
        idB: b.subscriptionId,
        findMany: (ids) => prisma.subscription.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'charge',
        idA: a.chargeId,
        idB: b.chargeId,
        findMany: (ids) => prisma.charge.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'workoutPlan',
        idA: a.workoutPlanId,
        idB: b.workoutPlanId,
        findMany: (ids) => prisma.workoutPlan.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'workout',
        idA: a.workoutId,
        idB: b.workoutId,
        findMany: (ids) => prisma.workout.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'workoutItem',
        idA: a.workoutItemId,
        idB: b.workoutItemId,
        findMany: (ids) => prisma.workoutItem.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'workoutSet',
        idA: a.workoutSetId,
        idB: b.workoutSetId,
        findMany: (ids) => prisma.workoutSet.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'workoutSession',
        idA: a.workoutSessionId,
        idB: b.workoutSessionId,
        findMany: (ids) => prisma.workoutSession.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'setLog',
        idA: a.setLogId,
        idB: b.setLogId,
        findMany: (ids) => prisma.setLog.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'workoutRating',
        idA: a.workoutRatingId,
        idB: b.workoutRatingId,
        findMany: (ids) => prisma.workoutRating.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'formAnalysis',
        idA: a.formAnalysisId,
        idB: b.formAnalysisId,
        findMany: (ids) => prisma.formAnalysis.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'mealPlan',
        idA: a.mealPlanId,
        idB: b.mealPlanId,
        findMany: (ids) => prisma.mealPlan.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'mealLog',
        idA: a.mealLogId,
        idB: b.mealLogId,
        findMany: (ids) => prisma.mealLog.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'encounter',
        idA: a.encounterId,
        idB: b.encounterId,
        findMany: (ids) => prisma.encounter.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'medicalRecord',
        idA: a.medicalRecordId,
        idB: b.medicalRecordId,
        findMany: (ids) => prisma.medicalRecord.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'prescription',
        idA: a.prescriptionId,
        idB: b.prescriptionId,
        findMany: (ids) => prisma.prescription.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'anamnesis',
        idA: a.anamnesisId,
        idB: b.anamnesisId,
        findMany: (ids) => prisma.anamnesis.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'assessment',
        idA: a.assessmentId,
        idB: b.assessmentId,
        findMany: (ids) => prisma.assessment.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'progressPhoto',
        idA: a.progressPhotoId,
        idB: b.progressPhotoId,
        findMany: (ids) => prisma.progressPhoto.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'attendance',
        idA: a.attendanceId,
        idB: b.attendanceId,
        findMany: (ids) => prisma.attendance.findMany({ where: { id: { in: ids } } }),
      },
      {
        model: 'appointment',
        idA: a.appointmentId,
        idB: b.appointmentId,
        findMany: (ids) => prisma.appointment.findMany({ where: { id: { in: ids } } }),
      },
    ];

    expect(checks).toHaveLength(30);

    for (const check of checks) {
      const resultAsA = await runScoped(a.tenantId, async () =>
        check.findMany([check.idA, check.idB]),
      );
      expect(
        resultAsA.map((r) => r.id),
        `${check.model}: contexto A vazou linha de B`,
      ).toEqual([check.idA]);

      const resultAsB = await runScoped(b.tenantId, async () =>
        check.findMany([check.idA, check.idB]),
      );
      expect(
        resultAsB.map((r) => r.id),
        `${check.model}: contexto B vazou linha de A`,
      ).toEqual([check.idB]);
    }
  });

  it('create no contexto de A grava tenantId=A automaticamente, mesmo se o dev passar outro tenantId', async () => {
    const a = await seedTenantGraph('a');
    const b = await seedTenantGraph('b');

    const created = await runScoped(a.tenantId, async () =>
      prisma.workoutPlan.create({
        data: {
          // tenantId deliberadamente errado (de B) — o contexto (A) tem que vencer.
          tenantId: b.tenantId,
          bondId: a.bondId,
          title: 'Plano criado sob contexto A',
          organization: 'LETTER',
        },
      }),
    );

    expect(created.tenantId).toBe(a.tenantId);

    const found = await prisma.workoutPlan.findUnique({ where: { id: created.id } });
    expect(found?.tenantId).toBe(a.tenantId);
  });

  it('update no contexto de A nao afeta linha de B mesmo com id de B no where', async () => {
    const a = await seedTenantGraph('a');
    const b = await seedTenantGraph('b');

    const result = await runScoped(a.tenantId, async () =>
      prisma.workoutPlan.updateMany({
        where: { id: b.workoutPlanId },
        data: { title: 'TENTATIVA DE ESCRITA CROSS-TENANT' },
      }),
    );
    expect(result.count).toBe(0);

    const untouched = await prisma.workoutPlan.findUnique({ where: { id: b.workoutPlanId } });
    expect(untouched?.title).not.toBe('TENTATIVA DE ESCRITA CROSS-TENANT');
  });

  it('delete no contexto de A nao afeta linha de B mesmo com id de B no where', async () => {
    const a = await seedTenantGraph('a');
    const b = await seedTenantGraph('b');

    const result = await runScoped(a.tenantId, async () =>
      prisma.progressPhoto.deleteMany({ where: { id: b.progressPhotoId } }),
    );
    expect(result.count).toBe(0);

    const stillThere = await prisma.progressPhoto.findUnique({ where: { id: b.progressPhotoId } });
    expect(stillThere).not.toBeNull();
  });

  it('findUnique no contexto de A nao encontra registro de B pelo id (extra where escalar suportado)', async () => {
    const a = await seedTenantGraph('a');
    const b = await seedTenantGraph('b');

    const foundAsA = await runScoped(a.tenantId, async () =>
      prisma.bond.findUnique({ where: { id: b.bondId } }),
    );
    expect(foundAsA).toBeNull();

    const foundAsB = await runScoped(b.tenantId, async () =>
      prisma.bond.findUnique({ where: { id: b.bondId } }),
    );
    expect(foundAsB?.id).toBe(b.bondId);
  });

  it('registro GLOBAL (bucket B — Specialty) e visivel em qualquer contexto de tenant, sem filtro', async () => {
    const a = await seedTenantGraph('a');

    const specialties = await runScoped(a.tenantId, async () =>
      prisma.specialty.findMany({ where: { code: 'TRAINING' } }),
    );
    expect(specialties.length).toBeGreaterThan(0);
  });

  it('biblioteca MISTA (bucket C — Exercise) nao e tocada pela extension: item PLATFORM (tenantId NULL) visivel em qualquer contexto', async () => {
    const a = await seedTenantGraph('a');
    const b = await seedTenantGraph('b');
    const muscleGroup = await prisma.muscleGroup.findFirstOrThrow({ where: { code: 'PEITO' } });

    // Item da PLATAFORMA: tenantId NULL de proposito (D-089). E exatamente a
    // linha que a extension APAGARIA se `exercise` entrasse em
    // TENANT_SCOPED_MODELS (`AND tenantId = <ctx>` nunca casa com NULL).
    const platformExercise = await prisma.exercise.create({
      data: {
        name: `Supino-${randomUUID().slice(0, 8)}`,
        nameNormalized: normalizeLibraryItemName(`Supino-${randomUUID().slice(0, 8)}`),
        primaryMuscleGroupId: muscleGroup.id,
        visibility: 'PLATFORM',
      },
    });
    expect(platformExercise.tenantId).toBeNull();

    const ownedByA = await prisma.exercise.create({
      data: {
        name: `Exclusivo-A-${randomUUID().slice(0, 8)}`,
        nameNormalized: normalizeLibraryItemName(`Exclusivo-A-${randomUUID().slice(0, 8)}`),
        primaryMuscleGroupId: muscleGroup.id,
        tenantId: a.tenantId,
        ownerProfessionalProfileId: a.professionalProfileId,
        visibility: 'PRIVATE',
      },
    });

    // Exercise tem coluna tenantId (D-166), mas NAO entra em
    // TENANT_SCOPED_MODELS — o contexto de tenant e IRRELEVANTE pra esta query.
    // A prova aqui e dupla: (1) o item da plataforma (tenantId NULL) aparece
    // pra QUALQUER contexto — a biblioteca global NAO SUMIU; (2) o item de A
    // tambem aparece sob o contexto de B — quem decide visibilidade e
    // owner/visibility (D-171), aplicado pelo repositorio da biblioteca, e a
    // extension NAO inventou um filtro por tenant que nao deveria existir.
    const asA = await runScoped(a.tenantId, async () =>
      prisma.exercise.findMany({ where: { id: { in: [platformExercise.id, ownedByA.id] } } }),
    );
    const asB = await runScoped(b.tenantId, async () =>
      prisma.exercise.findMany({ where: { id: { in: [platformExercise.id, ownedByA.id] } } }),
    );
    expect(asA.map((e) => e.id).sort()).toEqual([ownedByA.id, platformExercise.id].sort());
    expect(asB.map((e) => e.id).sort()).toEqual([ownedByA.id, platformExercise.id].sort());
  });

  it('criar item PLATFORM (tenantId NULL) COM contexto de tenant aberto continua possivel — a extension nao forca o tenantId em Exercise', async () => {
    // Regressao direta do risco do D-166: se `exercise` entrasse na lista da
    // extension, `scopeCreateData` sobrescreveria o tenantId e este item
    // NASCERIA preso ao tenant A, nunca global.
    const a = await seedTenantGraph('a');
    const muscleGroup = await prisma.muscleGroup.findFirstOrThrow({ where: { code: 'COSTAS' } });
    const name = `Remada-${randomUUID().slice(0, 8)}`;

    const created = await runScoped(a.tenantId, async () =>
      prisma.exercise.create({
        data: {
          name,
          nameNormalized: normalizeLibraryItemName(name),
          primaryMuscleGroupId: muscleGroup.id,
          visibility: 'PLATFORM',
        },
      }),
    );

    expect(created.tenantId).toBeNull();
    const readBack = await prisma.exercise.findUnique({ where: { id: created.id } });
    expect(readBack?.tenantId).toBeNull();
  });

  it('MuscleGroup e catalogo GLOBAL (bucket B): o seed existe e o catalogo e identico em qualquer contexto', async () => {
    const a = await seedTenantGraph('a');
    const b = await seedTenantGraph('b');

    const asA = await runScoped(a.tenantId, async () =>
      prisma.muscleGroup.findMany({ where: { status: 'ACTIVE' }, orderBy: { code: 'asc' } }),
    );
    const asB = await runScoped(b.tenantId, async () =>
      prisma.muscleGroup.findMany({ where: { status: 'ACTIVE' }, orderBy: { code: 'asc' } }),
    );

    expect(asA.length).toBeGreaterThanOrEqual(16);
    expect(asA.map((g) => g.code)).toEqual(asB.map((g) => g.code));
    expect(asA.map((g) => g.code)).toEqual(expect.arrayContaining(['PEITO', 'TRICEPS', 'GLUTEO']));
  });

  it('grupo muscular primario + secundarios persistem no exercicio (D-164)', async () => {
    const a = await seedTenantGraph('a');
    const [peito, triceps, ombro] = await Promise.all([
      prisma.muscleGroup.findFirstOrThrow({ where: { code: 'PEITO' } }),
      prisma.muscleGroup.findFirstOrThrow({ where: { code: 'TRICEPS' } }),
      prisma.muscleGroup.findFirstOrThrow({ where: { code: 'OMBRO' } }),
    ]);
    const name = `Supino inclinado-${randomUUID().slice(0, 8)}`;

    const created = await prisma.exercise.create({
      data: {
        tenantId: a.tenantId,
        ownerProfessionalProfileId: a.professionalProfileId,
        name,
        nameNormalized: normalizeLibraryItemName(name),
        primaryMuscleGroupId: peito.id,
        secondaryMuscleGroups: {
          create: [{ muscleGroupId: triceps.id }, { muscleGroupId: ombro.id }],
        },
      },
      include: { primaryMuscleGroup: true, secondaryMuscleGroups: true },
    });

    expect(created.primaryMuscleGroup.code).toBe('PEITO');
    expect(created.secondaryMuscleGroups.map((s) => s.muscleGroupId).sort()).toEqual(
      [triceps.id, ombro.id].sort(),
    );

    // "buscar por triceps" tem que achar o composto (D-164).
    const byTriceps = await prisma.exercise.findMany({
      where: { id: created.id, secondaryMuscleGroups: { some: { muscleGroupId: triceps.id } } },
    });
    expect(byTriceps.map((e) => e.id)).toEqual([created.id]);
  });

  it('sem contexto de tenant aberto, a query roda sem injecao (comportamento identico a antes do slice)', async () => {
    // workoutPlan (bucket A, SEM RLS -- ver RLS_SCOPED_MODELS em
    // tenant-isolation-extension.ts): exemplo que isola o comportamento da
    // Camada 2 (extension) do da Camada 3 (RLS, Slice 3/3). `bond` tem AMBAS,
    // e sem contexto aberto o RLS sozinho ja bloquearia a leitura -- o teste
    // de "sem contexto em modelo COM RLS" mora em
    // tenant-rls.integration.test.ts (fluxo-excecao), nao aqui.
    expect(getTenantContext()).toBeUndefined();
    const a = await seedTenantGraph('a');

    const found = await prisma.workoutPlan.findUnique({ where: { id: a.workoutPlanId } });
    expect(found?.id).toBe(a.workoutPlanId);
  });

  it('a extension so escopa o where/data do modelo RAIZ — include de relacao aninhada (bucket E) nunca cruza tenant, por correlacao de FK', async () => {
    // A extension NAO toca em `include`/`select` (grep no arquivo confirma) —
    // este teste prova que isso e SEGURO: o Prisma resolve `include` sempre
    // correlacionado a FK da linha ja devolvida, nunca por join plano contra
    // a tabela inteira. ProfessionalSpecialty (bucket E, sem tenantId) so
    // pode aparecer pendurada no professionalProfile QUE A POSSUI.
    // seedTenantGraph ja cria uma ProfessionalSpecialty por tenant (dependencia
    // de ProfessionalService) — reusa em vez de duplicar (unique
    // [professionalProfileId, specialtyId] barraria uma segunda).
    const a = await seedTenantGraph('a');
    const b = await seedTenantGraph('b');
    const specA = { id: a.professionalSpecialtyId };
    const specB = { id: b.professionalSpecialtyId };

    // SEM contexto (prova neutra): os dois profiles voltam, mas o include
    // NUNCA cruza — cada um so mostra a PROPRIA specialty.
    const noContext = await prisma.professionalProfile.findMany({
      where: { id: { in: [a.professionalProfileId, b.professionalProfileId] } },
      include: { specialties: true },
    });
    const byId = new Map(noContext.map((p) => [p.id, p.specialties.map((s) => s.id)]));
    expect(byId.get(a.professionalProfileId)).toEqual([specA.id]);
    expect(byId.get(b.professionalProfileId)).toEqual([specB.id]);

    // COM contexto de A: extension escopa o RAIZ (so profileA volta) e o
    // include continua correlacionado corretamente por baixo (so specA).
    const asA = await runScoped(a.tenantId, async () =>
      prisma.professionalProfile.findMany({
        where: { id: { in: [a.professionalProfileId, b.professionalProfileId] } },
        include: { specialties: true },
      }),
    );
    expect(asA.map((p) => p.id)).toEqual([a.professionalProfileId]);
    expect(asA[0]!.specialties.map((s) => s.id)).toEqual([specA.id]);
  });

  describe('D-153 — compatibilidade com $transaction', () => {
    it('$transaction com contexto de tenant aberto continua atomica E injeta tenantId em cada passo', async () => {
      const a = await seedTenantGraph('a');
      const tag = `tx-ok-${randomUUID().slice(0, 8)}`;

      const [plan, workout] = await runScoped(a.tenantId, async () =>
        prisma.$transaction(async (tx) => {
          const createdPlan = await tx.workoutPlan.create({
            data: { tenantId: a.tenantId, bondId: a.bondId, title: tag, organization: 'LETTER' },
          });
          const createdWorkout = await tx.workout.create({
            data: {
              tenantId: a.tenantId,
              bondId: a.bondId,
              planId: createdPlan.id,
              title: `${tag}-workout`,
            },
          });
          return [createdPlan, createdWorkout] as const;
        }),
      );

      expect(plan.tenantId).toBe(a.tenantId);
      expect(workout.tenantId).toBe(a.tenantId);

      const persistedPlan = await prisma.workoutPlan.findUnique({ where: { id: plan.id } });
      const persistedWorkout = await prisma.workout.findUnique({ where: { id: workout.id } });
      expect(persistedPlan?.title).toBe(tag);
      expect(persistedWorkout?.planId).toBe(plan.id);
    });

    it('$transaction com contexto de tenant aberto AINDA reverte tudo quando um passo falha (rollback real)', async () => {
      const a = await seedTenantGraph('a');
      const tag = `tx-rollback-${randomUUID().slice(0, 8)}`;

      await expect(
        runScoped(a.tenantId, async () =>
          prisma.$transaction(async (tx) => {
            await tx.workoutPlan.create({
              data: { tenantId: a.tenantId, bondId: a.bondId, title: tag, organization: 'LETTER' },
            });
            // Forca falha (FK inexistente) DEPOIS de uma escrita valida — se a
            // transacao nao for atomica, o workoutPlan acima sobreviveria.
            await tx.workout.create({
              data: {
                tenantId: a.tenantId,
                bondId: a.bondId,
                planId: 'plano-que-nao-existe',
                title: `${tag}-workout`,
              },
            });
          }),
        ),
      ).rejects.toThrow();

      const survived = await prisma.workoutPlan.findFirst({ where: { title: tag } });
      expect(survived).toBeNull();
    });

    it('injecao de tenantId dentro do $transaction NAO abre uma transacao propria por query (D-153 — anti-padrao do exemplo oficial de RLS)', async () => {
      // Prova indireta: se cada `tx.model.op()` abrisse sua PROPRIA transacao
      // (em vez de participar da transacao pai), um erro forcado no SEGUNDO
      // passo nao reverteria o PRIMEIRO (ja commitado sozinho). O teste
      // anterior ja prova isso (rollback real reverte os dois passos) — este
      // aqui documenta explicitamente a garantia como requisito nomeado do
      // D-153, nao so um efeito colateral do teste de rollback.
      const a = await seedTenantGraph('a');
      const tag = `tx-single-${randomUUID().slice(0, 8)}`;

      await expect(
        runScoped(a.tenantId, async () =>
          prisma.$transaction(async (tx) => {
            await tx.workoutPlan.create({
              data: { tenantId: a.tenantId, bondId: a.bondId, title: tag, organization: 'LETTER' },
            });
            throw new Error('falha forcada apos escrita valida');
          }),
        ),
      ).rejects.toThrow('falha forcada apos escrita valida');

      const shouldNotExist = await prisma.workoutPlan.findFirst({ where: { title: tag } });
      expect(shouldNotExist).toBeNull();
    });
  });
});
