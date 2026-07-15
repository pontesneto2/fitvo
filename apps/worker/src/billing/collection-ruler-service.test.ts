import {
  BILLING_QUEUE,
  type CollectedJob,
  InMemoryQueueFactory,
  type SubscriptionReminderEvent,
} from '@fitvo/queue';
import { describe, expect, it } from 'vitest';

import { CollectionRulerService } from './collection-ruler-service';
import { InMemoryCollectionRulerRepository } from './in-memory-collection-ruler-repository';

const NOW = new Date('2026-07-15T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

/** Vencimento deslocado por N dias em relacao a NOW (negativo = futuro). */
function dueDaysOverdue(days: number): Date {
  return new Date(NOW.getTime() - days * DAY);
}

function setup(): {
  repo: InMemoryCollectionRulerRepository;
  service: CollectionRulerService;
  reminders: () => CollectedJob<SubscriptionReminderEvent>[];
} {
  const repo = new InMemoryCollectionRulerRepository();
  const queue = new InMemoryQueueFactory();
  const remindersQueue = queue.createQueue<SubscriptionReminderEvent>(BILLING_QUEUE);
  const service = new CollectionRulerService(repo, remindersQueue);
  return { repo, service, reminders: () => queue.enqueuedJobs(BILLING_QUEUE) };
}

describe('CollectionRulerService (regua de cobranca — ADR-0004)', () => {
  it('avisa 3 dias antes do vencimento sem mudar o status', async () => {
    const { repo, service, reminders } = setup();
    repo.seedSubscription({
      id: 'sub_1',
      tenantId: 't1',
      status: 'ACTIVE',
      currentPeriodEnd: dueDaysOverdue(-3),
    });

    const result = await service.runRuler(NOW);

    expect(repo.statusOf('sub_1')).toBe('ACTIVE');
    expect(result.transitioned).toHaveLength(0);
    expect(result.reminded).toEqual([{ id: 'sub_1', kind: 'pre_due_3d' }]);
    expect(reminders()).toHaveLength(1);
  });

  it('no vencimento (dia 0): PAST_DUE + lembrete due', async () => {
    const { repo, service } = setup();
    repo.seedSubscription({
      id: 'sub_1',
      tenantId: 't1',
      status: 'ACTIVE',
      currentPeriodEnd: dueDaysOverdue(0),
    });

    const result = await service.runRuler(NOW);

    expect(repo.statusOf('sub_1')).toBe('PAST_DUE');
    expect(result.transitioned).toEqual([{ id: 'sub_1', status: 'PAST_DUE' }]);
    expect(result.reminded).toEqual([{ id: 'sub_1', kind: 'due' }]);
  });

  it('2 e 4 dias vencido mantem PAST_DUE e emite os lembretes de atraso', async () => {
    const { repo, service } = setup();
    repo.seedSubscription({
      id: 's2',
      tenantId: 't',
      status: 'PAST_DUE',
      currentPeriodEnd: dueDaysOverdue(2),
    });
    repo.seedSubscription({
      id: 's4',
      tenantId: 't',
      status: 'PAST_DUE',
      currentPeriodEnd: dueDaysOverdue(4),
    });

    const result = await service.runRuler(NOW);

    expect(repo.statusOf('s2')).toBe('PAST_DUE');
    expect(repo.statusOf('s4')).toBe('PAST_DUE');
    expect(result.reminded).toEqual(
      expect.arrayContaining([
        { id: 's2', kind: 'overdue_2d' },
        { id: 's4', kind: 'overdue_4d' },
      ]),
    );
    // Nenhuma transicao: ja estavam PAST_DUE.
    expect(result.transitioned).toHaveLength(0);
  });

  it('aos 7 dias vencido: SUSPENDED + lembrete suspended (suspensao != exclusao)', async () => {
    const { repo, service } = setup();
    repo.seedSubscription({
      id: 'sub_1',
      tenantId: 't1',
      status: 'PAST_DUE',
      currentPeriodEnd: dueDaysOverdue(7),
    });

    const result = await service.runRuler(NOW);

    expect(repo.statusOf('sub_1')).toBe('SUSPENDED');
    expect(result.transitioned).toEqual([{ id: 'sub_1', status: 'SUSPENDED' }]);
    expect(result.reminded).toEqual([{ id: 'sub_1', kind: 'suspended' }]);
  });

  it('catch-up: um tick tardio (dia 5) ainda corrige o status para PAST_DUE, sem lembrete fora de marco', async () => {
    const { repo, service } = setup();
    repo.seedSubscription({
      id: 'sub_1',
      tenantId: 't1',
      status: 'ACTIVE',
      currentPeriodEnd: dueDaysOverdue(5),
    });

    const result = await service.runRuler(NOW);

    expect(repo.statusOf('sub_1')).toBe('PAST_DUE');
    expect(result.transitioned).toEqual([{ id: 'sub_1', status: 'PAST_DUE' }]);
    expect(result.reminded).toHaveLength(0); // dia 5 nao e marco de lembrete
  });

  it('ignora assinaturas sem vencimento definido', async () => {
    const { repo, service, reminders } = setup();
    repo.seedSubscription({
      id: 'sub_1',
      tenantId: 't1',
      status: 'TRIALING',
      currentPeriodEnd: null,
    });

    const result = await service.runRuler(NOW);

    expect(result.transitioned).toHaveLength(0);
    expect(result.reminded).toHaveLength(0);
    expect(reminders()).toHaveLength(0);
  });
});
