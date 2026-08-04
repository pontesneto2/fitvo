import { PrismaClient } from '../../generated/client';
import { formatSeedReport } from './format-seed-report';
import {
  FREE_EXERCISE_DB_PATH,
  loadFreeExerciseDb,
  seedExerciseLibrary,
  type SeedPrismaClient,
} from './seed-exercise-library';

/**
 * Entrypoint do seed da biblioteca PLATFORM de exercícios.
 *
 *   pnpm --filter @fitvo/database db:seed:exercises
 *
 * Usa um `PrismaClient` CRU, sem a extension de isolamento de tenant — e isso é
 * requisito, não descuido: a extension sobrescreve `tenantId` em toda escrita, e
 * a base PLATFORM existe justamente com `tenantId` NULL (D-089). Passar por ela
 * transformaria a base global em base de um tenant só.
 *
 * Só INSERE (D-169: idempotente por nome normalizado). Não apaga, não
 * sobrescreve, não roda migration.
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const source = loadFreeExerciseDb(FREE_EXERCISE_DB_PATH);
    const result = await seedExerciseLibrary(prisma as unknown as SeedPrismaClient, source);
    process.stdout.write(`${formatSeedReport(result)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.exitCode = 1;
  process.stderr.write(`Seed da biblioteca de exercicios falhou: ${String(error)}\n`);
});
