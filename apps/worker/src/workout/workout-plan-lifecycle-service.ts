import {
  PLAN_LIFECYCLE_NOTIFICATION_EVENT,
  type PlanLifecycleNotificationEvent,
  type Queue,
} from '@fitvo/queue';

import type {
  LifecycleWorkoutPlanRecord,
  WorkoutPlanLifecycleRepository,
} from './workout-plan-lifecycle-repository';

/**
 * Marco exato do aviso de vencimento (D-083 — ADR-0009): "o plano do Joao
 * vence em 3 dias", mesmo padrao de marco exato da regua de cobranca
 * (ADR-0004). Nao configuravel por env: e o texto do exemplo do ADR, nao um
 * parametro de produto.
 */
const WARN_DAYS_BEFORE = 3;

/**
 * Reguas de plano de treino (D-083 vencimento; D-084 liberacao agendada — ambas
 * ADR-0009). Varre `WorkoutPlan` e ENFILEIRA a notificacao pronta (texto +
 * destinatario) na fila de plano de treino; a entrega de fato acontece no
 * consumidor do worker (D-027, canal in-app). Dedupe por `jobId` (planId+motivo)
 * torna a regua idempotente mesmo sem transicao de status (caso `expiring_soon`).
 *
 * Regra inegociavel (D-083): o aluno NUNCA fica sem nada silenciosamente — todo
 * vencimento e liberacao gera comunicacao.
 */
export class WorkoutPlanLifecycleService {
  constructor(
    private readonly repo: WorkoutPlanLifecycleRepository,
    private readonly notifications: Queue<PlanLifecycleNotificationEvent>,
  ) {}

  async runRuler(now: Date): Promise<{
    warnedExpiringSoon: string[];
    expired: string[];
    released: string[];
  }> {
    const warnedExpiringSoon: string[] = [];
    for (const plan of await this.repo.listExpiringSoon(now, WARN_DAYS_BEFORE)) {
      await this.notify(plan, 'expiring_soon', {
        recipientAccountId: plan.professionalAccountId,
        title: 'Plano vencendo',
        body: `O plano de ${plan.studentName} vence em ${WARN_DAYS_BEFORE} dias.`,
      });
      warnedExpiringSoon.push(plan.id);
    }

    const expired: string[] = [];
    for (const plan of await this.repo.listExpired(now)) {
      // Transicao ANTES da notificacao: mesmo se a entrega falhar, o plano nao
      // volta a aparecer como ACTIVE-vencido na proxima varredura (D-083).
      await this.repo.markExpired(plan.id);
      await this.notify(plan, 'expired', {
        recipientAccountId: plan.studentAccountId,
        title: 'Plano expirado',
        body: 'Seu plano de treino expirou. Aguarde o novo treino do seu profissional.',
      });
      expired.push(plan.id);
    }

    const released: string[] = [];
    for (const plan of await this.repo.listReadyToRelease(now)) {
      await this.repo.markReleased(plan.id);
      await this.notify(plan, 'released', {
        recipientAccountId: plan.studentAccountId,
        title: 'Novo treino disponível',
        body: `Seu novo treino "${plan.title}" já está disponível.`,
      });
      released.push(plan.id);
    }

    return { warnedExpiringSoon, expired, released };
  }

  private async notify(
    plan: LifecycleWorkoutPlanRecord,
    kind: PlanLifecycleNotificationEvent['kind'],
    input: Pick<PlanLifecycleNotificationEvent, 'recipientAccountId' | 'title' | 'body'>,
  ): Promise<void> {
    const event: PlanLifecycleNotificationEvent = { planId: plan.id, kind, ...input };
    // jobId = motivo+plano: cada plano so vive UM ciclo (ACTIVE->EXPIRED e
    // terminal; SCHEDULED->ACTIVE idem) — dedupe permanente e correto por
    // construcao, nao so "ate a proxima varredura".
    await this.notifications.enqueue(PLAN_LIFECYCLE_NOTIFICATION_EVENT, event, {
      jobId: `${kind}:${plan.id}`,
    });
  }
}
