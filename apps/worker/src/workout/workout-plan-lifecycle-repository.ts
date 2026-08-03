/**
 * Projecao minima de um WorkoutPlan candidato as reguas de vencimento (D-083) e
 * liberacao agendada (D-084), ja com os destinatarios resolvidos (accountId do
 * profissional e do aluno do vinculo dono do plano).
 */
export interface LifecycleWorkoutPlanRecord {
  id: string;
  tenantId: string;
  bondId: string;
  title: string;
  professionalAccountId: string;
  studentAccountId: string;
  /** Nome CIVIL do aluno (Account.name) — NUNCA a derivacao de displayName
   * (socialName ?? name), que e responsabilidade exclusiva do servidor de auth
   * (ver CLAUDE.md). Duplicar essa derivacao aqui divergiria da UI. */
  studentName: string;
}

/**
 * Porta de persistencia das reguas de plano de treino (Repository Pattern). O
 * dominio (WorkoutPlanLifecycleService) depende desta interface; a infra
 * fornece a implementacao Prisma (ou in-memory nos testes) — a regua e
 * testavel SEM Postgres.
 */
export interface WorkoutPlanLifecycleRepository {
  /** Planos ATIVOS cujo vencimento cai exatamente em `warnDaysBefore` dias (D-083). */
  listExpiringSoon(now: Date, warnDaysBefore: number): Promise<LifecycleWorkoutPlanRecord[]>;

  /** Planos ATIVOS ja vencidos (`validUntil` no passado) — ainda nao marcados EXPIRED. */
  listExpired(now: Date): Promise<LifecycleWorkoutPlanRecord[]>;

  /** Transiciona o plano para EXPIRED (D-083) — torna a varredura idempotente. */
  markExpired(planId: string): Promise<void>;

  /** Planos SCHEDULED cuja liberacao (`releaseAt`) ja chegou (D-084). */
  listReadyToRelease(now: Date): Promise<LifecycleWorkoutPlanRecord[]>;

  /** Transiciona o plano para ACTIVE (D-084) — torna a varredura idempotente. */
  markReleased(planId: string): Promise<void>;
}
