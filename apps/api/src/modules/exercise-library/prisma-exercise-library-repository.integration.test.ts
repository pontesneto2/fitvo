import { randomUUID } from 'node:crypto';

import { normalizeLibraryItemName, PrismaClient } from '@fitvo/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaExerciseLibraryRepository } from './prisma-exercise-library-repository';

/**
 * Integracao — BIBLIOTECA DE EXERCICIOS (ADR-0009) contra Postgres real.
 *
 * O double in-memory reproduz as regras, mas so o banco prova o que importa
 * aqui:
 * - o predicado de VISIBILIDADE (D-171) e uma clausula SQL, e "o item privado
 *   de A nao vaza pra B" e afirmacao sobre essa clausula;
 * - o item PLATFORM tem `tenantId` NULL (D-089) e continua visivel — a coluna
 *   nova do D-166 nao pode ter escondido a base comum;
 * - a anti-duplicacao (D-169) compara sobre a COLUNA `nameNormalized`, entao
 *   depende do que o banco de fato gravou;
 * - a troca de secundarios roda em TRANSACAO (D-164) e tem que reverter inteira.
 *
 * Usa `PrismaClient` CRU (sem a extension de isolamento) de proposito: o escopo
 * da biblioteca e por PROFISSIONAL, nao por tenant — sem contexto aberto, a
 * extension nao injeta nada e o que sobra e exatamente o predicado do
 * repositorio, que e o objeto do teste. `Exercise` nao tem RLS (D-152 deixou
 * treino fora da leva), entao nao ha variavel de sessao a setar.
 */

const prisma = new PrismaClient();
const repo = new PrismaExerciseLibraryRepository(prisma);

let peitoId = '';
let tricepsId = '';
let ombroId = '';
let costasId = '';

beforeAll(async () => {
  const groups = await prisma.muscleGroup.findMany({
    where: { code: { in: ['PEITO', 'TRICEPS', 'OMBRO', 'COSTAS'] } },
  });
  const byCode = new Map(groups.map((g) => [g.code, g.id]));
  peitoId = byCode.get('PEITO') ?? '';
  tricepsId = byCode.get('TRICEPS') ?? '';
  ombroId = byCode.get('OMBRO') ?? '';
  costasId = byCode.get('COSTAS') ?? '';
  expect([peitoId, tricepsId, ombroId, costasId].every(Boolean)).toBe(true);
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Tenant + conta + perfil profissional reais. O banco e compartilhado entre execucoes: tudo sufixado. */
async function seedProfessional(label: string): Promise<{
  tenantId: string;
  professionalProfileId: string;
}> {
  const id = `${label}-${randomUUID().slice(0, 8)}`;
  const tenant = await prisma.tenant.create({ data: { type: 'CLINIC', name: `Tenant ${id}` } });
  const account = await prisma.account.create({
    data: {
      email: `exlib-${id}@e2e.dev`,
      passwordHash: 'x',
      name: `Pro ${id}`,
      document: '00000000000',
      documentType: 'CPF',
      professionalProfile: { create: { tenantId: tenant.id } },
    },
    select: { professionalProfile: { select: { id: true } } },
  });
  return { tenantId: tenant.id, professionalProfileId: account.professionalProfile!.id };
}

function uniqueName(base: string): string {
  return `${base} ${randomUUID().slice(0, 8)}`;
}

async function createOwned(
  owner: { tenantId: string; professionalProfileId: string },
  name: string,
  primaryMuscleGroupId = peitoId,
  secondaryMuscleGroupIds: string[] = [],
) {
  return repo.createExercise({
    tenantId: owner.tenantId,
    ownerProfessionalProfileId: owner.professionalProfileId,
    name,
    nameNormalized: normalizeLibraryItemName(name),
    primaryMuscleGroupId,
    secondaryMuscleGroupIds,
    description: null,
    specialtyId: null,
    videoStorageKey: null,
  });
}

/** Item da base comum: sem dono e com `tenantId` NULL (D-089). */
async function createPlatform(name: string) {
  return prisma.exercise.create({
    data: {
      name,
      nameNormalized: normalizeLibraryItemName(name),
      primaryMuscleGroupId: peitoId,
      visibility: 'PLATFORM',
    },
  });
}

describe('PrismaExerciseLibraryRepository — biblioteca contra Postgres real', () => {
  describe('escopo por profissional (D-171)', () => {
    it('o item PRIVATE de A nao aparece na listagem de B, nem no MESMO tenant', async () => {
      const proA = await seedProfessional('a');
      const proB = await prisma.account
        .create({
          data: {
            email: `exlib-b-${randomUUID().slice(0, 8)}@e2e.dev`,
            passwordHash: 'x',
            name: 'Pro B',
            document: '11111111111',
            documentType: 'CPF',
            // MESMO tenant de A — o caso que o isolamento de tenant NAO cobre.
            professionalProfile: { create: { tenantId: proA.tenantId } },
          },
          select: { professionalProfile: { select: { id: true } } },
        })
        .then((a) => ({
          tenantId: proA.tenantId,
          professionalProfileId: a.professionalProfile!.id,
        }));

      const owned = await createOwned(proA, uniqueName('Exclusivo A'));

      const asA = await repo.listVisibleExercises(proA.professionalProfileId, {});
      const asB = await repo.listVisibleExercises(proB.professionalProfileId, {});

      expect(asA.map((e) => e.id)).toContain(owned.id);
      expect(asB.map((e) => e.id)).not.toContain(owned.id);
      expect(await repo.findVisibleExercise(proB.professionalProfileId, owned.id)).toBeNull();
    });

    it('CORACAO do D-166: item PLATFORM tem tenantId NULL e continua visivel a profissionais de tenants diferentes', async () => {
      const proA = await seedProfessional('a');
      const proB = await seedProfessional('b');
      const platform = await createPlatform(uniqueName('Agachamento livre'));

      // A coluna nova (D-166) e NULA na base comum — e o que a mantem global.
      expect(platform.tenantId).toBeNull();

      const asA = await repo.findVisibleExercise(proA.professionalProfileId, platform.id);
      const asB = await repo.findVisibleExercise(proB.professionalProfileId, platform.id);
      expect(asA?.id).toBe(platform.id);
      expect(asB?.id).toBe(platform.id);
    });

    it('o item PRIVATE grava o tenantId do dono (D-166) sem que isso vire o filtro de visibilidade', async () => {
      const proA = await seedProfessional('a');
      const owned = await createOwned(proA, uniqueName('Rastro de tenant'));

      const row = await prisma.exercise.findUniqueOrThrow({ where: { id: owned.id } });
      expect(row.tenantId).toBe(proA.tenantId);
      expect(row.visibility).toBe('PRIVATE');
    });
  });

  describe('taxonomia de grupo muscular (D-164)', () => {
    it('persiste primario + secundarios e acha o composto pelo SECUNDARIO', async () => {
      const proA = await seedProfessional('a');
      const created = await createOwned(proA, uniqueName('Supino inclinado'), peitoId, [
        tricepsId,
        ombroId,
      ]);

      expect(created.primaryMuscleGroup.code).toBe('PEITO');
      expect(created.secondaryMuscleGroups.map((g) => g.code).sort()).toEqual(['OMBRO', 'TRICEPS']);

      const found = await repo.listVisibleExercises(proA.professionalProfileId, {
        muscleGroupId: tricepsId,
      });
      expect(found.map((e) => e.id)).toContain(created.id);
    });

    it('so devolve grupos ACTIVE na validacao de ids', async () => {
      const found = await repo.findMuscleGroupIds([peitoId, 'mg_inexistente']);
      expect(found).toEqual([peitoId]);
    });
  });

  describe('anti-duplicacao normalizada (D-169)', () => {
    it.each([
      ['case', (n: string) => n.toUpperCase()],
      ['acento', (n: string) => n.replace('Triceps', 'Tríceps')],
      ['hifen', (n: string) => n.replace(/ /g, '-')],
    ])('acha o equivalente por %s sobre a coluna nameNormalized', async (_label, transform) => {
      const proA = await seedProfessional('a');
      const name = uniqueName('Triceps testa');
      const created = await createOwned(proA, name);

      const equivalent = await repo.findEquivalentByNormalizedName(
        proA.professionalProfileId,
        normalizeLibraryItemName(transform(name)),
      );
      expect(equivalent?.id).toBe(created.id);
    });

    it('a duplicata e POR PROFISSIONAL: o mesmo nome no outro profissional nao e equivalente', async () => {
      const proA = await seedProfessional('a');
      const proB = await seedProfessional('b');
      const name = uniqueName('Metodo proprietario');
      await createOwned(proA, name);

      const forB = await repo.findEquivalentByNormalizedName(
        proB.professionalProfileId,
        normalizeLibraryItemName(name),
      );
      expect(forB).toBeNull();
    });

    it('a base PLATFORM vence a PRIVATE quando as duas casam', async () => {
      const proA = await seedProfessional('a');
      const name = uniqueName('Burpee');
      const platform = await createPlatform(name);
      await createOwned(proA, name);

      const equivalent = await repo.findEquivalentByNormalizedName(
        proA.professionalProfileId,
        normalizeLibraryItemName(name),
      );
      expect(equivalent?.id).toBe(platform.id);
      expect(equivalent?.visibility).toBe('PLATFORM');
    });
  });

  describe('delecao logica (D-089)', () => {
    it('descontinuar tira da busca mas NAO apaga a linha', async () => {
      const proA = await seedProfessional('a');
      const created = await createOwned(proA, uniqueName('Crucifixo'));

      await repo.discontinueExercise(created.id);

      const defaultSearch = await repo.listVisibleExercises(proA.professionalProfileId, {});
      expect(defaultSearch.map((e) => e.id)).not.toContain(created.id);

      const withDiscontinued = await repo.listVisibleExercises(proA.professionalProfileId, {
        includeDiscontinued: true,
      });
      expect(withDiscontinued.map((e) => e.id)).toContain(created.id);

      // A prova de que NAO houve DELETE fisico: a linha segue no banco.
      const row = await prisma.exercise.findUnique({ where: { id: created.id } });
      expect(row?.status).toBe('DISCONTINUED');
    });

    it('o exercicio descontinuado continua utilizavel por um WorkoutItem ja existente', async () => {
      const proA = await seedProfessional('a');
      const created = await createOwned(proA, uniqueName('Leg press'));
      const bond = await seedBondFor(proA);
      const plan = await prisma.workoutPlan.create({
        data: {
          tenantId: proA.tenantId,
          bondId: bond.id,
          title: 'Plano',
          organization: 'LETTER',
        },
      });
      const workout = await prisma.workout.create({
        data: { tenantId: proA.tenantId, bondId: bond.id, planId: plan.id, title: 'A' },
      });
      const item = await prisma.workoutItem.create({
        data: { tenantId: proA.tenantId, workoutId: workout.id, exerciseId: created.id },
      });

      await repo.discontinueExercise(created.id);

      const stillThere = await prisma.workoutItem.findUniqueOrThrow({
        where: { id: item.id },
        include: { exercise: true },
      });
      expect(stillThere.exercise?.id).toBe(created.id);
      expect(stillThere.exercise?.status).toBe('DISCONTINUED');
    });
  });

  describe('update transacional (D-164)', () => {
    it('troca os secundarios inteiros', async () => {
      const proA = await seedProfessional('a');
      const created = await createOwned(proA, uniqueName('Remada'), costasId, [tricepsId]);

      const updated = await repo.updateExercise(created.id, {
        secondaryMuscleGroupIds: [ombroId],
      });
      expect(updated.secondaryMuscleGroups.map((g) => g.code)).toEqual(['OMBRO']);
    });

    it('ROLLBACK REAL: se o UPDATE falha, os secundarios antigos permanecem', async () => {
      const proA = await seedProfessional('a');
      const created = await createOwned(proA, uniqueName('Puxada'), costasId, [tricepsId]);

      // Grupo inexistente no `primaryMuscleGroupId` => o UPDATE viola a FK
      // DEPOIS de os secundarios ja terem sido reescritos na mesma transacao.
      await expect(
        repo.updateExercise(created.id, {
          secondaryMuscleGroupIds: [ombroId],
          primaryMuscleGroupId: 'mg_inexistente',
        }),
      ).rejects.toThrow();

      const after = await repo.findVisibleExercise(proA.professionalProfileId, created.id);
      expect(after?.secondaryMuscleGroups.map((g) => g.code)).toEqual(['TRICEPS']);
      expect(after?.primaryMuscleGroup.code).toBe('COSTAS');
    });
  });
});

/** Vinculo minimo, so para pendurar plano/treino no teste de delecao logica. */
async function seedBondFor(owner: { tenantId: string; professionalProfileId: string }) {
  const specialty = await prisma.specialty.findFirstOrThrow({ where: { code: 'TRAINING' } });
  const patient = await prisma.account.create({
    data: {
      email: `exlib-pac-${randomUUID().slice(0, 8)}@e2e.dev`,
      passwordHash: 'x',
      name: 'Paciente',
      document: '22222222222',
      documentType: 'CPF',
      patientProfile: { create: {} },
    },
    select: { patientProfile: { select: { id: true } } },
  });
  return prisma.bond.create({
    data: {
      tenantId: owner.tenantId,
      patientProfileId: patient.patientProfile!.id,
      professionalProfileId: owner.professionalProfileId,
      specialtyId: specialty.id,
      modality: 'ONLINE',
    },
  });
}
