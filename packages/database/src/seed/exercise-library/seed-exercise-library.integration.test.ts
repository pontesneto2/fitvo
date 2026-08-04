import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient } from '../../generated/client';
import { normalizeLibraryItemName } from '../../normalize-library-item-name';
import { mapFreeExerciseDb } from './map-free-exercise-db';
import {
  FREE_EXERCISE_DB_PATH,
  loadFreeExerciseDb,
  seedExerciseLibrary,
  type SeedPrismaClient,
} from './seed-exercise-library';

/**
 * Integração — o seed da BIBLIOTECA PLATFORM contra Postgres real.
 *
 * POR QUE CONTRA BANCO DE VERDADE: as três coisas que este seed precisa provar
 * são exatamente as que um mock não reprova.
 *
 * 1. **É global** — `tenantId` NULL, `visibility` PLATFORM. Um in-memory
 *    aceitaria qualquer coisa; só o banco prova que a FK do grupo muscular
 *    fecha e que a linha nasce sem tenant.
 * 2. **É idempotente (D-169)** — rodar duas vezes tem que inserir ZERO na
 *    segunda. Isso só se prova executando duas vezes contra o mesmo estado.
 * 3. **Aparece para qualquer tenant** — a base PLATFORM não pertence a
 *    ninguém; dois tenants distintos enxergam as MESMAS linhas.
 *
 * O client é CRU, sem a extension de isolamento — e é obrigatório que seja: a
 * extension sobrescreve `tenantId` em toda escrita e transformaria a base
 * global em base de um tenant só (por isso `Exercise` está fora de
 * TENANT_SCOPED_MODELS — ver `tenant-isolation-extension.ts`).
 */

const prisma = new PrismaClient();
const source = loadFreeExerciseDb(FREE_EXERCISE_DB_PATH);
const client = prisma as unknown as SeedPrismaClient;

let firstRunInserted = 0;
let expectedTotal = 0;

/**
 * Nomes normalizados que ESTE seed produz.
 *
 * Toda asserção é escopada por esta lista, e não por "todo `Exercise`
 * PLATFORM" — o banco de dev é COMPARTILHADO e já carrega itens PLATFORM de
 * fixture de outros testes (do #131, por exemplo). Medir a base inteira faria
 * o teste passar ou falhar conforme o lixo que outro arquivo tivesse deixado:
 * verde que mente numa direção, vermelho que mente na outra.
 */
const seededNames: string[] = mapFreeExerciseDb(source).exercises.map(
  (exercise) => exercise.nameNormalized,
);

/** Filtro canônico: só as linhas que este seed é responsável por criar. */
const seededWhere = {
  visibility: 'PLATFORM',
  nameNormalized: { in: seededNames },
} as const;

beforeAll(async () => {
  const first = await seedExerciseLibrary(client, source);
  firstRunInserted = first.inserted;
  expectedTotal = first.totalAfter;
}, 180_000);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('seed da biblioteca PLATFORM', () => {
  it('popula a base a partir da fonte congelada', async () => {
    const total = await prisma.exercise.count({ where: seededWhere });
    expect(total).toBe(expectedTotal);
    expect(expectedTotal).toBeGreaterThan(800);
  });

  it('grava tudo como PLATFORM sem tenant e sem dono (D-089)', async () => {
    // Uma única linha com tenant ou dono já quebraria a premissa da base
    // global — por isso a asserção é sobre a CONTAGEM do desvio, não sobre uma
    // amostra.
    const comEscopo = await prisma.exercise.count({
      where: {
        ...seededWhere,
        OR: [{ tenantId: { not: null } }, { ownerProfessionalProfileId: { not: null } }],
      },
    });
    expect(comEscopo).toBe(0);
  });

  it('rodar de novo NÃO duplica — idempotência por nome normalizado (D-169)', async () => {
    const before = await prisma.exercise.count({ where: seededWhere });

    const second = await seedExerciseLibrary(client, source);

    const after = await prisma.exercise.count({ where: seededWhere });
    expect(second.inserted).toBe(0);
    expect(second.skippedExisting).toBe(expectedTotal);
    expect(after).toBe(before);
  }, 180_000);

  it('não cria dois PLATFORM com o mesmo nome normalizado', async () => {
    const rows = await prisma.exercise.findMany({
      where: seededWhere,
      select: { nameNormalized: true },
    });
    const distintos = new Set(rows.map((row) => row.nameNormalized));
    expect(distintos.size).toBe(rows.length);
  });

  it('deriva nameNormalized da normalização canônica, não de string literal', async () => {
    const rows = await prisma.exercise.findMany({
      where: seededWhere,
      select: { name: true, nameNormalized: true },
      take: 200,
    });
    for (const row of rows) {
      expect(row.nameNormalized).toBe(normalizeLibraryItemName(row.name));
    }
  });
});

describe('taxonomia de músculo (D-164)', () => {
  it('todo exercício tem grupo primário válido (FK fecha)', async () => {
    // `primaryMuscleGroupId` e obrigatorio no schema, entao a prova util nao e
    // "existe id" e sim "o id aponta para um grupo que EXISTE" — a FK so fecha
    // de verdade se o join traz o catalogo junto.
    const amostra = await prisma.exercise.findMany({
      where: seededWhere,
      select: { name: true, primaryMuscleGroup: { select: { code: true } } },
      take: 300,
    });
    expect(amostra.length).toBeGreaterThan(0);
    for (const exercicio of amostra) {
      expect(exercicio.primaryMuscleGroup.code).toBeTruthy();
    }
  });

  it('grava secundários como N:N e nunca repete o primário entre eles', async () => {
    const comSecundarios = await prisma.exercise.findMany({
      where: { ...seededWhere, secondaryMuscleGroups: { some: {} } },
      select: {
        primaryMuscleGroupId: true,
        secondaryMuscleGroups: { select: { muscleGroupId: true } },
      },
      take: 300,
    });

    expect(comSecundarios.length).toBeGreaterThan(0);
    for (const exercicio of comSecundarios) {
      const secundarios = exercicio.secondaryMuscleGroups.map((s) => s.muscleGroupId);
      expect(secundarios).not.toContain(exercicio.primaryMuscleGroupId);
      expect(new Set(secundarios).size).toBe(secundarios.length);
    }
  });
});

describe('a base PLATFORM é visível a QUALQUER tenant', () => {
  it('dois tenants distintos enxergam exatamente as mesmas linhas', async () => {
    // A prova de que a base é global: nenhum filtro de tenant a alcança,
    // porque ela não tem tenant. Dois tenants recém-criados veem o mesmo
    // conjunto — e o mesmo que um leitor sem tenant nenhum.
    const criarTenant = async (): Promise<string> => {
      const tenant = await prisma.tenant.create({
        data: {
          name: `Seed Test ${randomUUID()}`,
          type: 'SOLO',
        },
        select: { id: true },
      });
      return tenant.id;
    };

    const tenantA = await criarTenant();
    const tenantB = await criarTenant();

    const visivelPara = async (tenantId: string): Promise<number> =>
      prisma.exercise.count({
        where: {
          ...seededWhere,
          // Como o item PLATFORM tem tenantId NULL, ele satisfaz a leitura de
          // qualquer tenant: é isto que o D-089 quer dizer com "base comum".
          OR: [{ tenantId: null }, { tenantId }],
        },
      });

    const totalA = await visivelPara(tenantA);
    const totalB = await visivelPara(tenantB);

    expect(totalA).toBe(expectedTotal);
    expect(totalB).toBe(totalA);

    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
  });
});

describe('amostra de tradução — os nomes que o personal usa todo dia', () => {
  it.each([
    'Supino reto com barra',
    'Agachamento livre com barra',
    'Levantamento terra com barra',
    'Rosca direta com barra',
    'Puxada frontal pegada aberta',
    'Remada curvada com barra',
    'Leg press',
    'Cadeira extensora',
    'Mesa flexora',
    'Desenvolvimento com barra',
  ])('a base contém "%s"', async (nome) => {
    const encontrado = await prisma.exercise.findFirst({
      where: {
        visibility: 'PLATFORM',
        nameNormalized: normalizeLibraryItemName(nome),
      },
      select: { name: true },
    });
    expect(encontrado?.name).toBe(nome);
  });
});

describe('o primeiro run realmente escreveu', () => {
  it('inseriu a base inteira OU encontrou-a já seedada', () => {
    // Num banco limpo, `inserted` é o total; num banco já seedado, é 0. As duas
    // situações são válidas — o que não pode é ficar no meio do caminho.
    expect([0, expectedTotal]).toContain(firstRunInserted);
  });
});
