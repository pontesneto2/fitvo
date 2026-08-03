import type { WorkoutPlanStatus } from '@fitvo/database';

import type {
  LifecycleWorkoutPlanRecord,
  WorkoutPlanLifecycleRepository,
} from './workout-plan-lifecycle-repository';

interface SeedRecord extends LifecycleWorkoutPlanRecord {
  status: WorkoutPlanStatus;
  validUntil: Date | null;
  releaseAt: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Trunca para o INICIO do dia UTC — a regua compara por dia, nao por instante. */
function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Dias corridos (UTC) entre `now` e `target` — negativo se `target` ja passou. */
function daysUntil(now: Date, target: Date): number {
  return Math.round((startOfUtcDay(target).getTime() - startOfUtcDay(now).getTime()) / DAY_MS);
}

/**
 * Implementacao em memoria do repositorio das reguas de plano (testes/dev).
 * Espelha a logica Prisma sobre um Map — permite testar as reguas SEM Postgres.
 */
export class InMemoryWorkoutPlanLifecycleRepository implements WorkoutPlanLifecycleRepository {
  private readonly plans = new Map<string, SeedRecord>();

  /** Semeia um plano para a regua avaliar. */
  seedPlan(record: SeedRecord): void {
    this.plans.set(record.id, { ...record });
  }

  /** Status atual de um plano (para asserts nos testes). */
  statusOf(planId: string): WorkoutPlanStatus | undefined {
    return this.plans.get(planId)?.status;
  }

  listExpiringSoon(now: Date, warnDaysBefore: number): Promise<LifecycleWorkoutPlanRecord[]> {
    const rows = [...this.plans.values()]
      .filter(
        (plan) =>
          plan.status === 'ACTIVE' &&
          plan.validUntil !== null &&
          daysUntil(now, plan.validUntil) === warnDaysBefore,
      )
      .map(toRecord);
    return Promise.resolve(rows);
  }

  listExpired(now: Date): Promise<LifecycleWorkoutPlanRecord[]> {
    const rows = [...this.plans.values()]
      .filter(
        (plan) => plan.status === 'ACTIVE' && plan.validUntil !== null && plan.validUntil < now,
      )
      .map(toRecord);
    return Promise.resolve(rows);
  }

  markExpired(planId: string): Promise<void> {
    const plan = this.plans.get(planId);
    if (plan) {
      plan.status = 'EXPIRED';
    }
    return Promise.resolve();
  }

  listReadyToRelease(now: Date): Promise<LifecycleWorkoutPlanRecord[]> {
    const rows = [...this.plans.values()]
      .filter(
        (plan) => plan.status === 'SCHEDULED' && plan.releaseAt !== null && plan.releaseAt <= now,
      )
      .map(toRecord);
    return Promise.resolve(rows);
  }

  markReleased(planId: string): Promise<void> {
    const plan = this.plans.get(planId);
    if (plan) {
      plan.status = 'ACTIVE';
    }
    return Promise.resolve();
  }
}

function toRecord(plan: SeedRecord): LifecycleWorkoutPlanRecord {
  return {
    id: plan.id,
    tenantId: plan.tenantId,
    bondId: plan.bondId,
    title: plan.title,
    professionalAccountId: plan.professionalAccountId,
    studentAccountId: plan.studentAccountId,
    studentName: plan.studentName,
  };
}
