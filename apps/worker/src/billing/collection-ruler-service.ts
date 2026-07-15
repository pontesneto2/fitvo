import type { SubscriptionStatus } from '@fitvo/database';
import {
  type Queue,
  SUBSCRIPTION_REMINDER_EVENT,
  type SubscriptionReminderEvent,
  type SubscriptionReminderKind,
} from '@fitvo/queue';

import type {
  CollectionRulerRepository,
  RulerSubscriptionRecord,
} from './collection-ruler-repository';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Regua de cobranca/suspensao (Fluxo A — ADR-0004). Cronograma EXATO da ADR (nao
 * inventado): aviso 3 dias ANTES do vencimento -> vencimento -> 2 dias vencido ->
 * 4 dias vencido -> SUSPENSAO aos 7 dias vencido. Suspensao != exclusao (D-021):
 * a assinatura vira SUSPENDED, os dados sao retidos.
 *
 * Transicoes de status por FAIXA de dias vencidos: >=7 -> SUSPENDED; >=0 ->
 * PAST_DUE; <0 -> mantem (ACTIVE/TRIALING). Lembretes nos dias EXATOS do
 * cronograma (uma cadencia diaria acerta cada marco uma vez); um tick de
 * catch-up ainda corrige o status pela faixa. A ENTREGA do lembrete (push/e-mail)
 * e GATED (D-028) — aqui a regua apenas ENFILEIRA o lembrete.
 */
export class CollectionRulerService {
  constructor(
    private readonly repo: CollectionRulerRepository,
    private readonly reminders: Queue<SubscriptionReminderEvent>,
  ) {}

  async runRuler(now: Date): Promise<{
    transitioned: { id: string; status: SubscriptionStatus }[];
    reminded: { id: string; kind: SubscriptionReminderKind }[];
  }> {
    const subscriptions = await this.repo.listRulerSubscriptions();
    const transitioned: { id: string; status: SubscriptionStatus }[] = [];
    const reminded: { id: string; kind: SubscriptionReminderKind }[] = [];

    for (const sub of subscriptions) {
      if (!sub.currentPeriodEnd) {
        continue;
      }
      const daysOverdue = Math.floor((now.getTime() - sub.currentPeriodEnd.getTime()) / DAY_MS);

      const nextStatus = statusForDaysOverdue(daysOverdue);
      if (nextStatus && nextStatus !== sub.status) {
        await this.repo.updateStatus(sub.id, nextStatus);
        transitioned.push({ id: sub.id, status: nextStatus });
      }

      const kind = reminderForDaysOverdue(daysOverdue);
      if (kind) {
        // TODO(D-028): deliver via notifications adapter
        await this.reminders.enqueue(SUBSCRIPTION_REMINDER_EVENT, buildReminder(sub, kind));
        reminded.push({ id: sub.id, kind });
      }
    }

    return { transitioned, reminded };
  }
}

/** Status alvo pela faixa de dias vencidos (>=7 suspende; >=0 vencido). */
function statusForDaysOverdue(daysOverdue: number): SubscriptionStatus | null {
  if (daysOverdue >= 7) {
    return 'SUSPENDED';
  }
  if (daysOverdue >= 0) {
    return 'PAST_DUE';
  }
  return null;
}

/** Lembrete nos marcos EXATOS do cronograma da ADR. */
function reminderForDaysOverdue(daysOverdue: number): SubscriptionReminderKind | null {
  if (daysOverdue >= 7) {
    return 'suspended';
  }
  if (daysOverdue === 4) {
    return 'overdue_4d';
  }
  if (daysOverdue === 2) {
    return 'overdue_2d';
  }
  if (daysOverdue === 0) {
    return 'due';
  }
  if (daysOverdue === -3) {
    return 'pre_due_3d';
  }
  return null;
}

function buildReminder(
  sub: RulerSubscriptionRecord,
  kind: SubscriptionReminderKind,
): SubscriptionReminderEvent {
  return {
    subscriptionId: sub.id,
    tenantId: sub.tenantId,
    kind,
    dueDate: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
  };
}
