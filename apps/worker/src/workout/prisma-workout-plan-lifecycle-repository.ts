import type { PrismaClient } from '@fitvo/database';
import { prisma as defaultPrisma, runWithTenantContext } from '@fitvo/database';

import type {
  LifecycleWorkoutPlanRecord,
  WorkoutPlanLifecycleRepository,
} from './workout-plan-lifecycle-repository';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Inicio do dia UTC seguinte a N dias de `now` — usado para o marco EXATO do aviso. */
function utcDayBounds(now: Date, daysFromNow: number): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow),
  );
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

interface PlanRow {
  id: string;
  tenantId: string;
  bondId: string;
  title: string;
}

/**
 * Implementacao Prisma (infra) das reguas de plano de treino (D-083/D-084 —
 * ADR-0009). `WorkoutPlan` NAO tem RLS (D-152 — ADR-0017 exclui explicitamente
 * o dominio de treino/nutricao da Camada 3): a varredura cross-tenant usa o
 * client `prisma` PADRAO direto, sem contexto de tenant aberto — a extension
 * (D-151) e no-op sem contexto (aditivo), e nao ha policy de RLS pra bloquear.
 * Diferente da regua de cobranca (`webhookPrisma`): ali o motivo era resolver
 * um `tenantId` DESCONHECIDO a priori (problema da galinha e o ovo); aqui o
 * `tenantId` ja vem denormalizado no proprio `WorkoutPlan`.
 *
 * Resolver o destinatario (accountId do profissional/aluno) EXIGE ler `Bond`,
 * que TEM RLS (esta na lista da Camada 3). Por isso cada resolucao abre o
 * contexto do tenant DAQUELE plano especifico via `runWithTenantContext` —
 * caminho legitimo e documentado (D-150), nao um bypass: o proprio
 * `WorkoutPlan` ja provou a que tenant o `bondId` pertence.
 */
export class PrismaWorkoutPlanLifecycleRepository implements WorkoutPlanLifecycleRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async listExpiringSoon(now: Date, warnDaysBefore: number): Promise<LifecycleWorkoutPlanRecord[]> {
    const { start, end } = utcDayBounds(now, warnDaysBefore);
    const plans = await this.db.workoutPlan.findMany({
      where: { status: 'ACTIVE', validUntil: { gte: start, lt: end } },
      select: { id: true, tenantId: true, bondId: true, title: true },
    });
    return this.resolveRecipients(plans);
  }

  async listExpired(now: Date): Promise<LifecycleWorkoutPlanRecord[]> {
    const plans = await this.db.workoutPlan.findMany({
      where: { status: 'ACTIVE', validUntil: { lt: now } },
      select: { id: true, tenantId: true, bondId: true, title: true },
    });
    return this.resolveRecipients(plans);
  }

  async markExpired(planId: string): Promise<void> {
    await this.db.workoutPlan.update({ where: { id: planId }, data: { status: 'EXPIRED' } });
  }

  async listReadyToRelease(now: Date): Promise<LifecycleWorkoutPlanRecord[]> {
    const plans = await this.db.workoutPlan.findMany({
      where: { status: 'SCHEDULED', releaseAt: { lte: now } },
      select: { id: true, tenantId: true, bondId: true, title: true },
    });
    return this.resolveRecipients(plans);
  }

  async markReleased(planId: string): Promise<void> {
    await this.db.workoutPlan.update({ where: { id: planId }, data: { status: 'ACTIVE' } });
  }

  private async resolveRecipients(plans: PlanRow[]): Promise<LifecycleWorkoutPlanRecord[]> {
    const records: LifecycleWorkoutPlanRecord[] = [];
    for (const plan of plans) {
      // Contexto do TENANT DESTE plano (nao um bypass — ver docstring da classe).
      const bond = await runWithTenantContext(plan.tenantId, async () =>
        this.db.bond.findUniqueOrThrow({
          where: { id: plan.bondId },
          select: {
            professionalProfile: { select: { account: { select: { id: true } } } },
            patientProfile: {
              select: { account: { select: { id: true, name: true } } },
            },
          },
        }),
      );
      records.push({
        id: plan.id,
        tenantId: plan.tenantId,
        bondId: plan.bondId,
        title: plan.title,
        professionalAccountId: bond.professionalProfile.account.id,
        studentAccountId: bond.patientProfile.account.id,
        studentName: bond.patientProfile.account.name,
      });
    }
    return records;
  }
}
