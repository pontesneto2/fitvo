import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@fitvo/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { WorkoutPlanStateConflictError } from '../../shared/http-errors';
import { PrismaWorkoutExecutionRepository } from './prisma-workout-execution-repository';
import { PrismaWorkoutRepository } from './prisma-workout-repository';

/**
 * Integracao — EXECUCAO DE TREINO (ADR-0009, Bloco 3) contra Postgres real.
 *
 * O double in-memory reproduz as regras, mas so o banco prova o que importa
 * aqui:
 * - o ESCOPO e uma clausula SQL (`bond: { patientProfileId }` no lado do aluno;
 *   `tenantId` + `professionalProfileId` no lado de quem acompanha), e "a
 *   execucao do aluno A nao vaza para B" e afirmacao sobre essa clausula — nao
 *   sobre um `if` em TypeScript;
 * - a UNICIDADE da avaliacao por sessao (D-087) e uma CONSTRAINT: so o banco a
 *   executa, e so o banco prova que a transacao inteira volta atras quando ela
 *   e violada;
 * - a CARGA TIPADA (D-081/D-086) so nao se mistura se as colunas nao-usadas
 *   ficarem NULAS de verdade — soma numa grandeza, zero nas outras;
 * - o 409 do D-085xD-100 (editar serie de item ja executado) so era teorico ate
 *   existir execucao: agora ele tem um SetLog REAL, criado pelo caminho de
 *   producao, para disparar.
 *
 * Usa `PrismaClient` CRU (sem a extension de isolamento) de proposito: o objeto
 * do teste e o PREDICADO DO REPOSITORIO. Com a extension ligada, um predicado
 * furado passaria escondido atras do filtro dela — e a defesa em profundidade
 * (D-166) so vale se as duas camadas estiverem inteiras.
 */

const prisma = new PrismaClient();
const repo = new PrismaWorkoutExecutionRepository(prisma);
const prescription = new PrismaWorkoutRepository(prisma);

let specialtyId = '';

beforeAll(async () => {
  const specialty = await prisma.specialty.findFirstOrThrow({ where: { code: 'TRAINING' } });
  specialtyId = specialty.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

interface Scenario {
  tenantId: string;
  professionalProfileId: string;
  patientProfileId: string;
  bondId: string;
}

/** Tenant + profissional + paciente + vinculo reais, sufixados para nao colidir. */
async function seedScenario(label: string): Promise<Scenario> {
  const id = `${label}-${randomUUID().slice(0, 8)}`;
  const tenant = await prisma.tenant.create({ data: { type: 'CLINIC', name: `Tenant ${id}` } });

  const professional = await prisma.account.create({
    data: {
      email: `wkx-pro-${id}@e2e.dev`,
      passwordHash: 'x',
      name: `Pro ${id}`,
      document: '00000000000',
      documentType: 'CPF',
      professionalProfile: { create: { tenantId: tenant.id } },
    },
    select: { professionalProfile: { select: { id: true } } },
  });

  const patient = await prisma.account.create({
    data: {
      email: `wkx-pac-${id}@e2e.dev`,
      passwordHash: 'x',
      name: `Paciente ${id}`,
      document: '00000000001',
      documentType: 'CPF',
      patientProfile: { create: {} },
    },
    select: { patientProfile: { select: { id: true } } },
  });

  const bond = await prisma.bond.create({
    data: {
      tenantId: tenant.id,
      patientProfileId: patient.patientProfile!.id,
      professionalProfileId: professional.professionalProfile!.id,
      specialtyId,
      modality: 'ONLINE',
    },
    select: { id: true },
  });

  return {
    tenantId: tenant.id,
    professionalProfileId: professional.professionalProfile!.id,
    patientProfileId: patient.patientProfile!.id,
    bondId: bond.id,
  };
}

interface PrescribedWorkout {
  planId: string;
  workoutId: string;
  itemId: string;
  setId: string;
}

/**
 * Plano ACTIVE -> treino -> item -> 1 serie prescrita. O plano nasce ACTIVE
 * porque o aluno nunca executa DRAFT (D-165) — o que esta sob teste aqui e a
 * execucao, nao a liberacao (essa e do Bloco 2).
 */
async function seedPrescription(
  scenario: Scenario,
  options: { isFixed?: boolean } = {},
): Promise<PrescribedWorkout> {
  const plan = await prisma.workoutPlan.create({
    data: {
      tenantId: scenario.tenantId,
      bondId: scenario.bondId,
      title: 'Musculacao',
      organization: 'LETTER',
      status: 'ACTIVE',
      validityDays: 30,
      isFixed: options.isFixed ?? false,
    },
    select: { id: true },
  });
  const workout = await prisma.workout.create({
    data: {
      tenantId: scenario.tenantId,
      bondId: scenario.bondId,
      planId: plan.id,
      title: 'Treino A',
      label: 'A',
    },
    select: { id: true },
  });
  const item = await prisma.workoutItem.create({
    data: { tenantId: scenario.tenantId, workoutId: workout.id, position: 0 },
    select: { id: true },
  });
  const set = await prisma.workoutSet.create({
    data: {
      tenantId: scenario.tenantId,
      workoutItemId: item.id,
      position: 0,
      reps: 12,
      weightGrams: 22500,
    },
    select: { id: true },
  });
  return { planId: plan.id, workoutId: workout.id, itemId: item.id, setId: set.id };
}

const RATING = {
  score: 5,
  perceivedEffort: 8,
  comment: 'Foi pesado',
  reactions: ['DIED' as const],
};

describe('D-086 — check-in LEVE contra o banco', () => {
  it('conclui a sessao SEM nenhum SetLog e grava a avaliacao na mesma transacao', async () => {
    const scenario = await seedScenario('leve');
    const prescribed = await seedPrescription(scenario);

    const workout = await repo.findExecutableWorkout(
      scenario.patientProfileId,
      prescribed.workoutId,
    );
    expect(workout).not.toBeNull();

    const session = await repo.startSession({
      tenantId: workout!.tenantId,
      bondId: workout!.bondId,
      workoutId: workout!.workoutId,
      planId: workout!.planId,
      performedAt: new Date(),
    });
    expect(session.status).toBe('IN_PROGRESS');

    const completed = await repo.completeSession(scenario.patientProfileId, session.id, {
      completedAt: new Date(),
      rating: RATING,
    });

    expect(completed!.status).toBe('COMPLETED');
    expect(completed!.completedAt).not.toBeNull();
    // ZERO series registradas — e a sessao fechou assim mesmo.
    expect(completed!.setLogs).toEqual([]);
    expect(await prisma.setLog.count({ where: { sessionId: session.id } })).toBe(0);
    // E a avaliacao existe no banco, nao so na resposta.
    const rating = await prisma.workoutRating.findUniqueOrThrow({
      where: { sessionId: session.id },
    });
    expect(rating.score).toBe(5);
    expect(rating.reactions).toEqual(['DIED']);
  });

  it('concluir DUAS vezes nao cria segunda avaliacao nem segundo check-in', async () => {
    const scenario = await seedScenario('duas');
    const prescribed = await seedPrescription(scenario);
    const session = await repo.startSession({
      tenantId: scenario.tenantId,
      bondId: scenario.bondId,
      workoutId: prescribed.workoutId,
      planId: prescribed.planId,
      performedAt: new Date(),
    });

    const primeira = await repo.completeSession(scenario.patientProfileId, session.id, {
      completedAt: new Date(),
      rating: RATING,
    });
    expect(primeira).not.toBeNull();

    const segunda = await repo.completeSession(scenario.patientProfileId, session.id, {
      completedAt: new Date(),
      rating: { ...RATING, score: 1 },
    });
    expect(segunda).toBeNull();

    // A avaliacao continua UMA (D-087) e e a primeira — a segunda nao
    // sobrescreveu nada.
    expect(await prisma.workoutRating.count({ where: { sessionId: session.id } })).toBe(1);
    const rating = await prisma.workoutRating.findUniqueOrThrow({
      where: { sessionId: session.id },
    });
    expect(rating.score).toBe(5);
  });

  it('ROLLBACK real: avaliacao duplicada desfaz tambem a mudanca de status', async () => {
    const scenario = await seedScenario('rollback');
    const prescribed = await seedPrescription(scenario);
    const session = await repo.startSession({
      tenantId: scenario.tenantId,
      bondId: scenario.bondId,
      workoutId: prescribed.workoutId,
      planId: prescribed.planId,
      performedAt: new Date(),
    });

    // Avaliacao "orfa" plantada a mao: simula a corrida em que outro caminho ja
    // criou o rating desta sessao ainda aberta. O @unique vai estourar dentro da
    // transacao.
    await prisma.workoutRating.create({
      data: {
        tenantId: scenario.tenantId,
        sessionId: session.id,
        score: 3,
        perceivedEffort: 5,
      },
    });

    await expect(
      repo.completeSession(scenario.patientProfileId, session.id, {
        completedAt: new Date(),
        rating: RATING,
      }),
    ).rejects.toThrow();

    // O status NAO ficou COMPLETED: a transacao levou junto o `updateMany`.
    const row = await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(row.status).toBe('IN_PROGRESS');
    expect(row.completedAt).toBeNull();
  });
});

describe('D-086/D-081 — SetLog: carga real em colunas TIPADAS', () => {
  it('log vinculado a serie prescrita e log LIVRE convivem; grandezas nao se misturam', async () => {
    const scenario = await seedScenario('log');
    const prescribed = await seedPrescription(scenario);
    const session = await repo.startSession({
      tenantId: scenario.tenantId,
      bondId: scenario.bondId,
      workoutId: prescribed.workoutId,
      planId: prescribed.planId,
      performedAt: new Date(),
    });

    const vinculado = await repo.createSetLog(scenario.patientProfileId, session.id, {
      workoutSetId: prescribed.setId,
      done: true,
      actualReps: 10,
      actualWeightGrams: 24000,
      actualDurationSeconds: null,
      actualDistanceMeters: null,
      note: null,
    });
    expect(vinculado).not.toBeNull();

    const livre = await repo.createSetLog(scenario.patientProfileId, session.id, {
      // Serie que ninguem prescreveu — o dado real e o que importa (D-085).
      workoutSetId: null,
      done: true,
      actualReps: null,
      actualWeightGrams: null,
      actualDurationSeconds: 60,
      actualDistanceMeters: null,
      note: 'prancha extra',
    });
    expect(livre).not.toBeNull();

    const rows = await prisma.setLog.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows).toHaveLength(2);

    // Soma numa grandeza, ZERO nas outras — a prova de que a agregacao de
    // evolucao (D-092) nunca somaria gramas com segundos.
    const somaPeso = rows.reduce((total, row) => total + (row.actualWeightGrams ?? 0), 0);
    const somaTempo = rows.reduce((total, row) => total + (row.actualDurationSeconds ?? 0), 0);
    const somaDistancia = rows.reduce((total, row) => total + (row.actualDistanceMeters ?? 0), 0);
    expect(somaPeso).toBe(24000);
    expect(somaTempo).toBe(60);
    expect(somaDistancia).toBe(0);
    expect(rows[0]!.actualDurationSeconds).toBeNull();
    expect(rows[0]!.actualDistanceMeters).toBeNull();
    expect(rows[1]!.actualWeightGrams).toBeNull();

    // E a sessao segue concluivel — os logs foram bonus, nao pre-condicao.
    const completed = await repo.completeSession(scenario.patientProfileId, session.id, {
      completedAt: new Date(),
      rating: RATING,
    });
    expect(completed!.setLogs).toHaveLength(2);
  });

  it('serie prescrita de OUTRO treino e recusada (FOREIGN_SET), nao gravada', async () => {
    const scenario = await seedScenario('foreign');
    const meu = await seedPrescription(scenario);
    const outro = await seedPrescription(scenario);

    const session = await repo.startSession({
      tenantId: scenario.tenantId,
      bondId: scenario.bondId,
      workoutId: meu.workoutId,
      planId: meu.planId,
      performedAt: new Date(),
    });

    const recusado = await repo.createSetLog(scenario.patientProfileId, session.id, {
      workoutSetId: outro.setId,
      done: true,
      actualReps: 8,
      actualWeightGrams: null,
      actualDurationSeconds: null,
      actualDistanceMeters: null,
      note: null,
    });
    expect(recusado).toBe('FOREIGN_SET');
    expect(await prisma.setLog.count({ where: { sessionId: session.id } })).toBe(0);
  });
});

describe('D-092/D-105 — aderencia derivada respeita o plano FIXO', () => {
  it('check-in de plano fixo nao entra na aderencia; o variavel entra', async () => {
    const scenario = await seedScenario('aderencia');
    const variavel = await seedPrescription(scenario, { isFixed: false });
    const fixo = await seedPrescription(scenario, { isFixed: true });

    const dia = new Date('2026-08-03T10:00:00.000Z');
    for (const prescribed of [variavel, fixo]) {
      const session = await repo.startSession({
        tenantId: scenario.tenantId,
        bondId: scenario.bondId,
        workoutId: prescribed.workoutId,
        planId: prescribed.planId,
        performedAt: dia,
      });
      await repo.completeSession(scenario.patientProfileId, session.id, {
        completedAt: dia,
        rating: RATING,
      });
    }

    // Uma sessao ABERTA (sem check-in) tambem existe — e nao pode contar.
    await repo.startSession({
      tenantId: scenario.tenantId,
      bondId: scenario.bondId,
      workoutId: variavel.workoutId,
      planId: variavel.planId,
      performedAt: dia,
    });

    const checkIns = await repo.listAdherenceCheckInsForPatient(
      scenario.patientProfileId,
      new Date('2026-08-01T00:00:00.000Z'),
      new Date('2026-08-31T23:59:59.000Z'),
    );

    // Duas concluidas (a aberta ficou de fora), uma delas de plano fixo.
    expect(checkIns).toHaveLength(2);
    expect(checkIns.filter((checkIn) => checkIn.planIsFixed)).toHaveLength(1);
    expect(checkIns.filter((checkIn) => !checkIn.planIsFixed)).toHaveLength(1);
    // O `isFixed` veio do PLANO pelo join, nao de uma copia na sessao.
    const doFixo = checkIns.find((checkIn) => checkIn.planId === fixo.planId);
    expect(doFixo!.planIsFixed).toBe(true);

    // Fora da janela, nada aparece — historico nao e apagado (D-100), e filtrado.
    const foraDaJanela = await repo.listAdherenceCheckInsForPatient(
      scenario.patientProfileId,
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-09-30T00:00:00.000Z'),
    );
    expect(foraDaJanela).toEqual([]);
  });
});

describe('escopo por vinculo e por tenant (ADR-0001/D-166)', () => {
  it('a execucao do aluno A nao e alcancavel pelo aluno B, nem por id direto', async () => {
    const dono = await seedScenario('escopoA');
    const outro = await seedScenario('escopoB');
    const prescribed = await seedPrescription(dono);

    const session = await repo.startSession({
      tenantId: dono.tenantId,
      bondId: dono.bondId,
      workoutId: prescribed.workoutId,
      planId: prescribed.planId,
      performedAt: new Date(),
    });

    // EIXO 1 — o paciente de outro vinculo nao le a sessao...
    expect(await repo.findSessionForPatient(outro.patientProfileId, session.id)).toBeNull();
    expect(await repo.findSessionDetailForPatient(outro.patientProfileId, session.id)).toBeNull();
    // ...nem conclui...
    expect(
      await repo.completeSession(outro.patientProfileId, session.id, {
        completedAt: new Date(),
        rating: RATING,
      }),
    ).toBeNull();
    // ...nem registra carga nela.
    expect(
      await repo.createSetLog(outro.patientProfileId, session.id, {
        workoutSetId: null,
        done: true,
        actualReps: 10,
        actualWeightGrams: null,
        actualDurationSeconds: null,
        actualDistanceMeters: null,
        note: null,
      }),
    ).toBeNull();
    // E nada disso deixou residuo no banco.
    expect(await prisma.setLog.count({ where: { sessionId: session.id } })).toBe(0);
    const intacta = await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(intacta.status).toBe('IN_PROGRESS');

    // EIXO 2 — o profissional de outro tenant nao le por id direto...
    expect(
      await repo.findSessionDetailForProfessional(
        outro.tenantId,
        outro.professionalProfileId,
        session.id,
      ),
    ).toBeNull();
    // ...e o tenant do PATH nao vale como prova: com o tenant certo e o
    // profissional errado, tambem nao le.
    expect(
      await repo.findSessionDetailForProfessional(
        dono.tenantId,
        outro.professionalProfileId,
        session.id,
      ),
    ).toBeNull();

    // EIXO 3 — o vinculo alheio devolve `null` (404), NUNCA lista vazia: lista
    // vazia diria "o vinculo e seu e nao tem execucao", o que ja e informacao.
    expect(
      await repo.listSessionsForBond(outro.tenantId, outro.professionalProfileId, dono.bondId, {}),
    ).toBeNull();
    expect(
      await repo.listAdherenceCheckInsForBond(
        outro.tenantId,
        outro.professionalProfileId,
        dono.bondId,
        new Date('2020-01-01T00:00:00.000Z'),
        new Date('2030-01-01T00:00:00.000Z'),
      ),
    ).toBeNull();

    // O aluno de outro vinculo tambem nao ve a sessao na propria lista.
    expect(await repo.listSessionsForPatient(outro.patientProfileId, {})).toEqual([]);

    // Enquanto o dono le tudo normalmente.
    expect(await repo.findSessionForPatient(dono.patientProfileId, session.id)).not.toBeNull();
    expect(
      await repo.listSessionsForBond(dono.tenantId, dono.professionalProfileId, dono.bondId, {}),
    ).toHaveLength(1);
  });

  it('o aluno nao abre sessao de treino de plano em DRAFT (D-165) nem de outro vinculo', async () => {
    const dono = await seedScenario('draftexec');
    const outro = await seedScenario('draftexec2');
    const prescribed = await seedPrescription(dono);

    await prisma.workoutPlan.update({
      where: { id: prescribed.planId },
      data: { status: 'DRAFT' },
    });
    expect(
      await repo.findExecutableWorkout(dono.patientProfileId, prescribed.workoutId),
    ).toBeNull();

    await prisma.workoutPlan.update({
      where: { id: prescribed.planId },
      data: { status: 'ACTIVE' },
    });
    expect(
      await repo.findExecutableWorkout(dono.patientProfileId, prescribed.workoutId),
    ).not.toBeNull();
    // Liberado para o dono, invisivel para o aluno de outro vinculo.
    expect(
      await repo.findExecutableWorkout(outro.patientProfileId, prescribed.workoutId),
    ).toBeNull();
  });
});

describe('D-085 x D-100 — a trava provisoria do 409 agora tem execucao real para disparar', () => {
  it('editar as series de um item com SetLog criado pelo caminho de producao e 409', async () => {
    const scenario = await seedScenario('gap409');
    const prescribed = await seedPrescription(scenario);

    // Antes de qualquer execucao, a edicao passa — a trava nao e um bloqueio
    // permanente da prescricao (D-085 segue valendo).
    const antes = await prescription.replaceSets(
      scenario.tenantId,
      scenario.professionalProfileId,
      prescribed.itemId,
      [
        {
          reps: 10,
          repsToFailure: false,
          weightGrams: 20000,
          durationSeconds: null,
          distanceMeters: null,
          bodyweight: false,
          restSeconds: 60,
          technique: 'NORMAL',
          note: null,
        },
      ],
    );
    expect(antes!.sets).toHaveLength(1);
    const serieAtual = antes!.sets[0]!;

    // Agora o aluno executa DE VERDADE: sessao + SetLog pelo repositorio da
    // execucao, nao por linha plantada a mao.
    const session = await repo.startSession({
      tenantId: scenario.tenantId,
      bondId: scenario.bondId,
      workoutId: prescribed.workoutId,
      planId: prescribed.planId,
      performedAt: new Date(),
    });
    const log = await repo.createSetLog(scenario.patientProfileId, session.id, {
      workoutSetId: serieAtual.id,
      done: true,
      actualReps: 9,
      actualWeightGrams: 21000,
      actualDurationSeconds: null,
      actualDistanceMeters: null,
      note: null,
    });
    expect(log).not.toBeNull();
    expect(log).not.toBe('FOREIGN_SET');

    // A trava provisoria do #133 dispara: trocar a lista apagaria a serie que o
    // aluno executou, e isso e o conflito D-085 x D-100 que nenhum ADR resolveu.
    // Este teste NAO decide a politica — so prova que a trava funciona agora que
    // o caso e alcancavel.
    await expect(
      prescription.replaceSets(
        scenario.tenantId,
        scenario.professionalProfileId,
        prescribed.itemId,
        [
          {
            reps: 8,
            repsToFailure: false,
            weightGrams: 25000,
            durationSeconds: null,
            distanceMeters: null,
            bodyweight: false,
            restSeconds: 60,
            technique: 'NORMAL',
            note: null,
          },
        ],
      ),
    ).rejects.toThrow(WorkoutPlanStateConflictError);

    // A serie executada continua exatamente onde estava, com os valores de antes.
    const rows = await prisma.workoutSet.findMany({
      where: { workoutItemId: prescribed.itemId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(serieAtual.id);
    expect(rows[0]!.weightGrams).toBe(20000);
    // E o registro do aluno tambem — historico nao se apaga (D-100).
    expect(await prisma.setLog.count({ where: { workoutSetId: serieAtual.id } })).toBe(1);
  });
});
