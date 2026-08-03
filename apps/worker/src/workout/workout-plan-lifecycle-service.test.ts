import {
  type CollectedJob,
  InMemoryQueueFactory,
  type PlanLifecycleNotificationEvent,
  WORKOUT_QUEUE,
} from '@fitvo/queue';
import { describe, expect, it } from 'vitest';

import { InMemoryWorkoutPlanLifecycleRepository } from './in-memory-workout-plan-lifecycle-repository';
import { WorkoutPlanLifecycleService } from './workout-plan-lifecycle-service';

const NOW = new Date('2026-07-15T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

/** Data deslocada por N dias em relacao a NOW (positivo = futuro). */
function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * DAY);
}

function setup(): {
  repo: InMemoryWorkoutPlanLifecycleRepository;
  service: WorkoutPlanLifecycleService;
  notifications: () => CollectedJob<PlanLifecycleNotificationEvent>[];
} {
  const repo = new InMemoryWorkoutPlanLifecycleRepository();
  const queue = new InMemoryQueueFactory();
  const notificationsQueue = queue.createQueue<PlanLifecycleNotificationEvent>(WORKOUT_QUEUE);
  const service = new WorkoutPlanLifecycleService(repo, notificationsQueue);
  return { repo, service, notifications: () => queue.enqueuedJobs(WORKOUT_QUEUE) };
}

describe('WorkoutPlanLifecycleService (reguas de plano — D-083/D-084, ADR-0009)', () => {
  it('avisa o profissional quando o plano ATIVO vence em exatamente 3 dias', async () => {
    const { repo, service, notifications } = setup();
    repo.seedPlan({
      id: 'plan_1',
      tenantId: 't1',
      bondId: 'bond_1',
      title: 'Treino de hipertrofia',
      professionalAccountId: 'prof_acc_1',
      studentAccountId: 'student_acc_1',
      studentName: 'João',
      status: 'ACTIVE',
      validUntil: daysFromNow(3),
      releaseAt: null,
    });

    const result = await service.runRuler(NOW);

    expect(result.warnedExpiringSoon).toEqual(['plan_1']);
    expect(repo.statusOf('plan_1')).toBe('ACTIVE'); // aviso NAO transiciona status
    expect(notifications()).toEqual([
      {
        name: 'plan-lifecycle.notification',
        data: {
          planId: 'plan_1',
          kind: 'expiring_soon',
          recipientAccountId: 'prof_acc_1',
          title: 'Plano vencendo',
          body: 'O plano de João vence em 3 dias.',
        },
      },
    ]);
  });

  it('nao avisa fora do marco exato de 3 dias (1 dia e 5 dias)', async () => {
    const { repo, service, notifications } = setup();
    repo.seedPlan({
      id: 'plan_1d',
      tenantId: 't1',
      bondId: 'bond_1',
      title: 'A',
      professionalAccountId: 'prof',
      studentAccountId: 'student',
      studentName: 'Ana',
      status: 'ACTIVE',
      validUntil: daysFromNow(1),
      releaseAt: null,
    });
    repo.seedPlan({
      id: 'plan_5d',
      tenantId: 't1',
      bondId: 'bond_2',
      title: 'B',
      professionalAccountId: 'prof',
      studentAccountId: 'student2',
      studentName: 'Bia',
      status: 'ACTIVE',
      validUntil: daysFromNow(5),
      releaseAt: null,
    });

    const result = await service.runRuler(NOW);

    expect(result.warnedExpiringSoon).toHaveLength(0);
    expect(notifications()).toHaveLength(0);
  });

  it('vencido: transiciona para EXPIRED e avisa o ALUNO (aluno nunca fica sem nada silenciosamente)', async () => {
    const { repo, service, notifications } = setup();
    repo.seedPlan({
      id: 'plan_venc',
      tenantId: 't1',
      bondId: 'bond_1',
      title: 'Treino de força',
      professionalAccountId: 'prof_acc_1',
      studentAccountId: 'student_acc_1',
      studentName: 'Carlos',
      status: 'ACTIVE',
      validUntil: daysFromNow(-1),
      releaseAt: null,
    });

    const result = await service.runRuler(NOW);

    expect(result.expired).toEqual(['plan_venc']);
    expect(repo.statusOf('plan_venc')).toBe('EXPIRED');
    expect(notifications()).toEqual([
      {
        name: 'plan-lifecycle.notification',
        data: {
          planId: 'plan_venc',
          kind: 'expired',
          recipientAccountId: 'student_acc_1',
          title: 'Plano expirado',
          body: 'Seu plano de treino expirou. Aguarde o novo treino do seu profissional.',
        },
      },
    ]);
  });

  it('liberacao agendada: SCHEDULED com releaseAt no passado vira ACTIVE e avisa o aluno (D-084)', async () => {
    const { repo, service, notifications } = setup();
    repo.seedPlan({
      id: 'plan_agendado',
      tenantId: 't1',
      bondId: 'bond_1',
      title: 'Bloco de força — mês 2',
      professionalAccountId: 'prof_acc_1',
      studentAccountId: 'student_acc_1',
      studentName: 'Diana',
      status: 'SCHEDULED',
      validUntil: null,
      releaseAt: daysFromNow(-1),
    });

    const result = await service.runRuler(NOW);

    expect(result.released).toEqual(['plan_agendado']);
    expect(repo.statusOf('plan_agendado')).toBe('ACTIVE');
    expect(notifications()).toEqual([
      {
        name: 'plan-lifecycle.notification',
        data: {
          planId: 'plan_agendado',
          kind: 'released',
          recipientAccountId: 'student_acc_1',
          title: 'Novo treino disponível',
          body: 'Seu novo treino "Bloco de força — mês 2" já está disponível.',
        },
      },
    ]);
  });

  it('nao libera plano SCHEDULED cujo releaseAt ainda esta no futuro', async () => {
    const { repo, service, notifications } = setup();
    repo.seedPlan({
      id: 'plan_futuro',
      tenantId: 't1',
      bondId: 'bond_1',
      title: 'Bloco futuro',
      professionalAccountId: 'prof',
      studentAccountId: 'student',
      studentName: 'Elis',
      status: 'SCHEDULED',
      validUntil: null,
      releaseAt: daysFromNow(2),
    });

    const result = await service.runRuler(NOW);

    expect(result.released).toHaveLength(0);
    expect(repo.statusOf('plan_futuro')).toBe('SCHEDULED');
    expect(notifications()).toHaveLength(0);
  });

  it('idempotencia: rodar a mesma varredura duas vezes nao duplica notificacao (vencendo, vencido e liberado)', async () => {
    const { repo, service, notifications } = setup();
    repo.seedPlan({
      id: 'plan_venc_3d',
      tenantId: 't1',
      bondId: 'bond_1',
      title: 'A',
      professionalAccountId: 'prof',
      studentAccountId: 'student1',
      studentName: 'Fábio',
      status: 'ACTIVE',
      validUntil: daysFromNow(3),
      releaseAt: null,
    });
    repo.seedPlan({
      id: 'plan_expirado',
      tenantId: 't1',
      bondId: 'bond_2',
      title: 'B',
      professionalAccountId: 'prof',
      studentAccountId: 'student2',
      studentName: 'Gabi',
      status: 'ACTIVE',
      validUntil: daysFromNow(-2),
      releaseAt: null,
    });
    repo.seedPlan({
      id: 'plan_liberar',
      tenantId: 't1',
      bondId: 'bond_3',
      title: 'C',
      professionalAccountId: 'prof',
      studentAccountId: 'student3',
      studentName: 'Hugo',
      status: 'SCHEDULED',
      validUntil: null,
      releaseAt: daysFromNow(-1),
    });

    const first = await service.runRuler(NOW);
    const second = await service.runRuler(NOW);

    expect(first.warnedExpiringSoon).toEqual(['plan_venc_3d']);
    expect(first.expired).toEqual(['plan_expirado']);
    expect(first.released).toEqual(['plan_liberar']);
    // Na segunda rodada, vencido/liberado ja transicionaram (saem da consulta);
    // vencendo depende so do dedupe por jobId (status nao muda).
    expect(second.expired).toHaveLength(0);
    expect(second.released).toHaveLength(0);
    expect(notifications()).toHaveLength(3);
  });

  it('ignora planos ACTIVE sem validUntil e SCHEDULED sem releaseAt', async () => {
    const { repo, service, notifications } = setup();
    repo.seedPlan({
      id: 'plan_sem_validade',
      tenantId: 't1',
      bondId: 'bond_1',
      title: 'A',
      professionalAccountId: 'prof',
      studentAccountId: 'student',
      studentName: 'Ivo',
      status: 'ACTIVE',
      validUntil: null,
      releaseAt: null,
    });
    repo.seedPlan({
      id: 'plan_sem_release',
      tenantId: 't1',
      bondId: 'bond_2',
      title: 'B',
      professionalAccountId: 'prof',
      studentAccountId: 'student2',
      studentName: 'Julia',
      status: 'SCHEDULED',
      validUntil: null,
      releaseAt: null,
    });

    const result = await service.runRuler(NOW);

    expect(result.warnedExpiringSoon).toHaveLength(0);
    expect(result.expired).toHaveLength(0);
    expect(result.released).toHaveLength(0);
    expect(notifications()).toHaveLength(0);
  });
});
