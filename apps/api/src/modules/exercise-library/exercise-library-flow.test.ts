import type { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';

import { buildTestHarness, type TestHarness } from '../../testing/build-test-app';
import { validProfessionalRegistration } from '../../testing/professional-registration-fixture';

/**
 * Fluxo da BIBLIOTECA DE EXERCICIOS (D-089/D-164, D-168 a D-171 — ADR-0009).
 *
 * O que estes testes protegem, em ordem de risco:
 * 1. ESCOPO POR PROFISSIONAL (D-171) — o item privado de A nunca aparece pra B,
 *    inclusive no MESMO tenant (o caso que o isolamento de tenant NAO cobre).
 * 2. ANTI-DUPLICACAO NORMALIZADA (D-169) — "Supino"/"supino"/"supino-reto" sao
 *    o mesmo item; igualdade literal nao satisfaz o ADR.
 * 3. DELECAO LOGICA (D-089) — descontinuado some da busca e NUNCA some do banco.
 * 4. DEFAULT SEGURO (D-170) — nasce PRIVATE; nada auto-promove pra base comum.
 */

const TENANT_A = 'exlib_tenant_a';
const TENANT_B = 'exlib_tenant_b';
const PEITO = 'mg_peito';
const TRICEPS = 'mg_triceps';
const OMBRO = 'mg_ombro';

interface Professional {
  token: string;
  professionalProfileId: string;
}

async function setupProfessional(
  harness: TestHarness,
  tenantId: string,
  email: string,
): Promise<Professional> {
  const res = await harness.app.inject({
    method: 'POST',
    url: '/v1/auth/register/professional',
    payload: {
      ...validProfessionalRegistration,
      name: 'Profissional',
      specialtyId: 'spec_training',
      councilDocument: 'CREF-123456',
      email,
    },
  });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  await harness.accounts.markEmailVerified(body.account.id);
  const professionalProfileId = harness.exerciseLibrary.seedProfessional({
    accountId: body.account.id,
    tenantId,
  });
  return { token: body.tokens.accessToken, professionalProfileId };
}

function createExercise(
  app: FastifyInstance,
  tenantId: string,
  token: string,
  payload: Record<string, unknown>,
) {
  return app.inject({
    method: 'POST',
    url: `/v1/exercise-library/${tenantId}/exercises`,
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
}

function listExercises(app: FastifyInstance, tenantId: string, token: string, query = '') {
  return app.inject({
    method: 'GET',
    url: `/v1/exercise-library/${tenantId}/exercises${query}`,
    headers: { authorization: `Bearer ${token}` },
  });
}

describe('biblioteca de exercicios (ADR-0009) — fluxo HTTP', () => {
  let harness: TestHarness;
  let app: FastifyInstance;
  let proA: Professional;

  beforeEach(async () => {
    harness = await buildTestHarness();
    app = harness.app;
    proA = await setupProfessional(harness, TENANT_A, 'pro-a@e2e.dev');
  });

  describe('catalogo de grupos musculares (D-164)', () => {
    it('lista o catalogo semeado, so os ACTIVE e na ordem de exibicao', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/exercise-library/${TENANT_A}/muscle-groups`,
        headers: { authorization: `Bearer ${proA.token}` },
      });

      expect(res.statusCode).toBe(200);
      const { muscleGroups } = res.json();
      expect(muscleGroups.length).toBeGreaterThanOrEqual(16);
      expect(muscleGroups.map((g: { code: string }) => g.code)).toEqual(
        expect.arrayContaining(['PEITO', 'COSTAS', 'TRICEPS', 'GLUTEO', 'PANTURRILHA']),
      );
      const orders = muscleGroups.map((g: { displayOrder: number }) => g.displayOrder);
      expect([...orders].sort((a: number, b: number) => a - b)).toEqual(orders);
    });

    it('grupo DESCONTINUADO some da listagem (D-089)', async () => {
      harness.exerciseLibrary.discontinueMuscleGroup(TRICEPS);

      const res = await app.inject({
        method: 'GET',
        url: `/v1/exercise-library/${TENANT_A}/muscle-groups`,
        headers: { authorization: `Bearer ${proA.token}` },
      });

      const codes = res.json().muscleGroups.map((g: { code: string }) => g.code);
      expect(codes).not.toContain('TRICEPS');
      expect(codes).toContain('PEITO');
    });

    it('exige perfil profissional no tenant do path', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/exercise-library/${TENANT_B}/muscle-groups`,
        headers: { authorization: `Bearer ${proA.token}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('CRUD', () => {
    it('cria com grupo primario + secundarios e nasce PRIVATE do autor (D-164/D-170)', async () => {
      const res = await createExercise(app, TENANT_A, proA.token, {
        name: 'Supino inclinado',
        primaryMuscleGroupId: PEITO,
        secondaryMuscleGroupIds: [TRICEPS, OMBRO],
        description: 'Banco a 30 graus.',
      });

      expect(res.statusCode).toBe(201);
      const { outcome, exercise } = res.json();
      expect(outcome).toBe('CREATED');
      expect(exercise.visibility).toBe('PRIVATE');
      expect(exercise.status).toBe('ACTIVE');
      expect(exercise.ownerProfessionalProfileId).toBe(proA.professionalProfileId);
      expect(exercise.primaryMuscleGroup.code).toBe('PEITO');
      expect(exercise.secondaryMuscleGroups.map((g: { code: string }) => g.code).sort()).toEqual([
        'OMBRO',
        'TRICEPS',
      ]);
    });

    it('detalha, atualiza e guarda a chave do video (D-091)', async () => {
      const created = await createExercise(app, TENANT_A, proA.token, {
        name: 'Remada curvada',
        primaryMuscleGroupId: PEITO,
      });
      const { id } = created.json().exercise;

      const updated = await app.inject({
        method: 'PATCH',
        url: `/v1/exercise-library/${TENANT_A}/exercises/${id}`,
        headers: { authorization: `Bearer ${proA.token}` },
        payload: {
          name: 'Remada curvada pronada',
          primaryMuscleGroupId: 'mg_costas',
          secondaryMuscleGroupIds: [TRICEPS],
          videoStorageKey: 'exercise-video/remada.mp4',
        },
      });

      expect(updated.statusCode).toBe(200);
      expect(updated.json().name).toBe('Remada curvada pronada');
      expect(updated.json().primaryMuscleGroup.code).toBe('COSTAS');
      expect(updated.json().videoStorageKey).toBe('exercise-video/remada.mp4');

      const detail = await app.inject({
        method: 'GET',
        url: `/v1/exercise-library/${TENANT_A}/exercises/${id}`,
        headers: { authorization: `Bearer ${proA.token}` },
      });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().secondaryMuscleGroups.map((g: { code: string }) => g.code)).toEqual([
        'TRICEPS',
      ]);
    });

    it('REPROVA grupo muscular inexistente ou descontinuado (D-164)', async () => {
      const inexistente = await createExercise(app, TENANT_A, proA.token, {
        name: 'Movimento novo',
        primaryMuscleGroupId: 'mg_nao_existe',
      });
      expect(inexistente.statusCode).toBe(422);

      harness.exerciseLibrary.discontinueMuscleGroup(OMBRO);
      const descontinuado = await createExercise(app, TENANT_A, proA.token, {
        name: 'Outro movimento',
        primaryMuscleGroupId: OMBRO,
      });
      expect(descontinuado.statusCode).toBe(422);
    });

    it('REPROVA nome que fica vazio depois de normalizado', async () => {
      const res = await createExercise(app, TENANT_A, proA.token, {
        name: ' --- ',
        primaryMuscleGroupId: PEITO,
      });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('delecao logica (D-089)', () => {
    it('descontinuado SOME da busca mas CONTINUA existindo e acessivel por id', async () => {
      const created = await createExercise(app, TENANT_A, proA.token, {
        name: 'Crucifixo',
        primaryMuscleGroupId: PEITO,
      });
      const { id } = created.json().exercise;

      const discontinued = await app.inject({
        method: 'POST',
        url: `/v1/exercise-library/${TENANT_A}/exercises/${id}/discontinue`,
        headers: { authorization: `Bearer ${proA.token}` },
      });
      expect(discontinued.statusCode).toBe(200);
      expect(discontinued.json().status).toBe('DISCONTINUED');

      // Some da busca padrao...
      const list = await listExercises(app, TENANT_A, proA.token);
      expect(list.json().exercises.map((e: { id: string }) => e.id)).not.toContain(id);

      // ...mas NAO foi apagado: segue no banco e no historico.
      const includingDiscontinued = await listExercises(
        app,
        TENANT_A,
        proA.token,
        '?includeDiscontinued=true',
      );
      expect(includingDiscontinued.json().exercises.map((e: { id: string }) => e.id)).toContain(id);

      const detail = await app.inject({
        method: 'GET',
        url: `/v1/exercise-library/${TENANT_A}/exercises/${id}`,
        headers: { authorization: `Bearer ${proA.token}` },
      });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().status).toBe('DISCONTINUED');
    });
  });

  describe('anti-duplicacao normalizada (D-169)', () => {
    it.each([
      ['case', 'Supino', 'supino'],
      ['acento', 'Triceps testa', 'Tríceps testa'],
      ['hifen', 'supino reto', 'supino-reto'],
      ['espaco extra', 'supino reto', '  supino   reto  '],
    ])('detecta duplicata por %s: "%s" == "%s"', async (_label, first, second) => {
      const created = await createExercise(app, TENANT_A, proA.token, {
        name: first,
        primaryMuscleGroupId: PEITO,
      });
      expect(created.statusCode).toBe(201);
      const originalId = created.json().exercise.id;

      const duplicate = await createExercise(app, TENANT_A, proA.token, {
        name: second,
        primaryMuscleGroupId: TRICEPS,
      });

      // Nao duplica: OFERECE o existente (D-169), sem criar segunda linha.
      expect(duplicate.statusCode).toBe(200);
      expect(duplicate.json().outcome).toBe('DUPLICATE_FOUND');
      expect(duplicate.json().exercise.id).toBe(originalId);

      const list = await listExercises(app, TENANT_A, proA.token);
      expect(list.json().exercises).toHaveLength(1);
    });

    it('a base PLATFORM e oferecida antes de o profissional criar o proprio (D-169)', async () => {
      const platform = harness.exerciseLibrary.seedPlatformExercise('Agachamento livre', PEITO);

      const res = await createExercise(app, TENANT_A, proA.token, {
        name: 'agachamento-livre',
        primaryMuscleGroupId: PEITO,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().outcome).toBe('DUPLICATE_FOUND');
      expect(res.json().exercise.id).toBe(platform.id);
      expect(res.json().exercise.visibility).toBe('PLATFORM');
    });

    it('a duplicacao de item PRIVATE e POR PROFISSIONAL: B cria o mesmo nome que A, normalmente', async () => {
      const proB = await setupProfessional(harness, TENANT_A, 'pro-b@e2e.dev');

      const fromA = await createExercise(app, TENANT_A, proA.token, {
        name: 'Meu metodo proprietario',
        primaryMuscleGroupId: PEITO,
      });
      expect(fromA.json().outcome).toBe('CREATED');

      // B nao ve o item de A (D-171), entao para ele NAO ha duplicata.
      const fromB = await createExercise(app, TENANT_A, proB.token, {
        name: 'meu metodo proprietario',
        primaryMuscleGroupId: PEITO,
      });
      expect(fromB.statusCode).toBe(201);
      expect(fromB.json().outcome).toBe('CREATED');
      expect(fromB.json().exercise.id).not.toBe(fromA.json().exercise.id);
    });

    it('renomear para um equivalente ja existente e CONFLITO (409), nao duplicata silenciosa', async () => {
      await createExercise(app, TENANT_A, proA.token, {
        name: 'Supino reto',
        primaryMuscleGroupId: PEITO,
      });
      const outro = await createExercise(app, TENANT_A, proA.token, {
        name: 'Crucifixo',
        primaryMuscleGroupId: PEITO,
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/exercise-library/${TENANT_A}/exercises/${outro.json().exercise.id}`,
        headers: { authorization: `Bearer ${proA.token}` },
        payload: { name: 'supino-reto' },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  describe('escopo por profissional (D-171)', () => {
    it('o item PRIVATE de A nao aparece, nao abre e nao e editavel por B — MESMO tenant', async () => {
      const proB = await setupProfessional(harness, TENANT_A, 'pro-b2@e2e.dev');
      const created = await createExercise(app, TENANT_A, proA.token, {
        name: 'Exclusivo do A',
        primaryMuscleGroupId: PEITO,
      });
      const { id } = created.json().exercise;

      const listB = await listExercises(app, TENANT_A, proB.token);
      expect(listB.json().exercises).toHaveLength(0);

      const detailB = await app.inject({
        method: 'GET',
        url: `/v1/exercise-library/${TENANT_A}/exercises/${id}`,
        headers: { authorization: `Bearer ${proB.token}` },
      });
      expect(detailB.statusCode).toBe(404);

      const patchB = await app.inject({
        method: 'PATCH',
        url: `/v1/exercise-library/${TENANT_A}/exercises/${id}`,
        headers: { authorization: `Bearer ${proB.token}` },
        payload: { name: 'Sequestrado' },
      });
      expect(patchB.statusCode).toBe(404);
    });

    it('a base PLATFORM e visivel a profissionais de tenants diferentes, mas NAO editavel', async () => {
      const proB = await setupProfessional(harness, TENANT_B, 'pro-b3@e2e.dev');
      const platform = harness.exerciseLibrary.seedPlatformExercise('Burpee', PEITO);

      for (const [tenantId, pro] of [
        [TENANT_A, proA],
        [TENANT_B, proB],
      ] as const) {
        const list = await listExercises(app, tenantId, pro.token);
        expect(list.json().exercises.map((e: { id: string }) => e.id)).toContain(platform.id);
      }

      // Visivel != editavel: so o AUTOR altera, e a base comum nao tem autor.
      const patch = await app.inject({
        method: 'PATCH',
        url: `/v1/exercise-library/${TENANT_A}/exercises/${platform.id}`,
        headers: { authorization: `Bearer ${proA.token}` },
        payload: { name: 'Burpee modificado' },
      });
      expect(patch.statusCode).toBe(403);
    });
  });

  describe('busca', () => {
    it('busca por termo NAO normalizado acha o item normalizado (D-169)', async () => {
      await createExercise(app, TENANT_A, proA.token, {
        name: 'Triceps testa',
        primaryMuscleGroupId: TRICEPS,
      });

      const res = await listExercises(app, TENANT_A, proA.token, '?search=TRÍCEPS');
      expect(res.json().exercises).toHaveLength(1);
      expect(res.json().exercises[0].name).toBe('Triceps testa');
    });

    it('filtra por grupo muscular, primario OU secundario (D-164)', async () => {
      await createExercise(app, TENANT_A, proA.token, {
        name: 'Supino inclinado',
        primaryMuscleGroupId: PEITO,
        secondaryMuscleGroupIds: [TRICEPS],
      });
      await createExercise(app, TENANT_A, proA.token, {
        name: 'Rosca direta',
        primaryMuscleGroupId: 'mg_biceps',
      });

      const porTriceps = await listExercises(
        app,
        TENANT_A,
        proA.token,
        `?muscleGroupId=${TRICEPS}`,
      );
      expect(porTriceps.json().exercises.map((e: { name: string }) => e.name)).toEqual([
        'Supino inclinado',
      ]);
    });
  });
});
