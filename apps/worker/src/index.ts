import { prisma, webhookPrisma } from '@fitvo/database';
import { buildDefaultDispatcher, InMemoryInAppNotificationStore } from '@fitvo/notifications';
import {
  BILLING_QUEUE,
  type BondCreatedEvent,
  BullMqQueueFactory,
  PLAN_LIFECYCLE_TICK_EVENT,
  type PlanLifecycleNotificationEvent,
  type PlanLifecycleTickEvent,
  RULER_TICK_EVENT,
  type RulerTickEvent,
  SHARING_QUEUE,
  type SubscriptionReminderEvent,
  WORKOUT_QUEUE,
} from '@fitvo/queue';
import pino from 'pino';

import { CollectionRulerService } from './billing/collection-ruler-service';
import { PrismaCollectionRulerRepository } from './billing/prisma-collection-ruler-repository';
import { env } from './env';
import { OverlapDetectionService } from './sharing/overlap-detection-service';
import { PrismaSharingRepository } from './sharing/prisma-sharing-repository';
import { PrismaWorkoutPlanLifecycleRepository } from './workout/prisma-workout-plan-lifecycle-repository';
import { WorkoutPlanLifecycleService } from './workout/workout-plan-lifecycle-service';

const logger = pino({ level: env.LOG_LEVEL, name: 'worker' });

/** Job que trafega na fila de billing: o tick da regua OU um lembrete. */
type BillingJob = RulerTickEvent | SubscriptionReminderEvent;

/** Discrimina o tick (`at`) do lembrete (`kind`) na fila de billing. */
function isRulerTick(job: BillingJob): job is RulerTickEvent {
  return 'at' in job;
}

/** Job que trafega na fila de treino: o tick da regua OU uma notificacao pronta. */
type WorkoutJob = PlanLifecycleTickEvent | PlanLifecycleNotificationEvent;

/** Discrimina o tick (`at`) da notificacao (`planId`) na fila de treino. */
function isPlanLifecycleTick(job: WorkoutJob): job is PlanLifecycleTickEvent {
  return 'at' in job;
}

/**
 * Worker BullMQ da FITVO. Consome:
 * - a fila de compartilhamento (D-017): cada `bond.created` roda a deteccao de
 *   sobreposicao e persiste SharingSuggestion PENDING.
 * - a fila de billing (ADR-0004): um tick REPETIDO (cron) dispara a regua de
 *   cobranca, que transiciona ACTIVE->PAST_DUE->SUSPENDED e ENFILEIRA lembretes.
 *   A ENTREGA por notificacao e GATED (D-028) — o lembrete so e registrado.
 * - a fila de treino (D-083/D-084 — ADR-0009): um tick REPETIDO dispara as
 *   reguas de vencimento e liberacao agendada, que ENFILEIRAM a notificacao
 *   pronta; este worker a ENTREGA de verdade via `@fitvo/notifications` (canal
 *   in-app — push/e-mail/SMS seguem GATED, D-027).
 * Boot-safe: a conexao Redis so e criada aqui (os motores sao testaveis sem infra).
 */
const queueFactory = new BullMqQueueFactory(env.REDIS_URL);

/**
 * Dispatcher de notificacao (D-027): canal in-app entrega de verdade (persiste
 * na central em memoria do processo — `InAppNotificationStore` Prisma segue
 * TODO(D-027), coordenar migracao a parte); push/e-mail/SMS ficam GATED no
 * logging sender ate haver credenciais (item #10 do roadmap).
 */
const notificationDispatcher = buildDefaultDispatcher({
  logger,
  inAppStore: new InMemoryInAppNotificationStore(),
});

// --- Motor de compartilhamento (D-017) ---
const overlapService = new OverlapDetectionService(new PrismaSharingRepository(prisma));
const sharingWorker = queueFactory.createWorker<BondCreatedEvent>(SHARING_QUEUE, async (data) => {
  const suggestions = await overlapService.handleBondCreated(data);
  logger.info(
    { patientProfileId: data.patientProfileId, suggestions: suggestions.length },
    'bond.created processado (motor de compartilhamento)',
  );
});

// --- Regua de cobranca (ADR-0004) ---
// A fila de billing carrega o tick (produtor: o scheduler) e os lembretes
// (produtor: a propria regua). Handles tipados separados apontam para a MESMA
// fila; o worker discrimina por formato.
const rulerTicks = queueFactory.createQueue<RulerTickEvent>(BILLING_QUEUE);
const rulerReminders = queueFactory.createQueue<SubscriptionReminderEvent>(BILLING_QUEUE);
const rulerService = new CollectionRulerService(
  // role fitvo_webhook (D-155, ADR-0017 Slice 3/3): varredura de TODAS as
  // subscriptions nao-terminais, sem filtro de tenant -- nunca o client padrao.
  new PrismaCollectionRulerRepository(webhookPrisma),
  rulerReminders,
);

const billingWorker = queueFactory.createWorker<BillingJob>(BILLING_QUEUE, async (data) => {
  if (isRulerTick(data)) {
    // Usa o instante ATUAL da execucao (o `at` do job repetido e fixado no
    // agendamento e serve apenas de referencia).
    const result = await rulerService.runRuler(new Date());
    logger.info(
      { transitioned: result.transitioned.length, reminded: result.reminded.length },
      'tick da regua de cobranca processado',
    );
    return;
  }
  // Lembrete: entrega GATED. Recipiente (conta do tenant pagante) ainda nao
  // resolvido pela regua — nao inventar aqui quem recebe.
  // TODO(D-028): deliver via notifications adapter
  logger.info(
    { subscriptionId: data.subscriptionId, kind: data.kind },
    'lembrete de assinatura enfileirado (entrega gated — D-028)',
  );
});

// --- Reguas de plano de treino (D-083 vencimento; D-084 liberacao — ADR-0009) ---
// Mesmo padrao da regua de cobranca: a fila carrega o tick e as notificacoes
// prontas (produtor: a propria regua); o worker discrimina por formato.
const planLifecycleTicks = queueFactory.createQueue<PlanLifecycleTickEvent>(WORKOUT_QUEUE);
const planLifecycleNotifications =
  queueFactory.createQueue<PlanLifecycleNotificationEvent>(WORKOUT_QUEUE);
const planLifecycleService = new WorkoutPlanLifecycleService(
  // WorkoutPlan NAO tem RLS (D-152/ADR-0017): client padrao direto, sem
  // contexto de tenant aberto — ver docstring do repositorio.
  new PrismaWorkoutPlanLifecycleRepository(prisma),
  planLifecycleNotifications,
);

const workoutWorker = queueFactory.createWorker<WorkoutJob>(WORKOUT_QUEUE, async (data) => {
  if (isPlanLifecycleTick(data)) {
    const result = await planLifecycleService.runRuler(new Date());
    logger.info(
      {
        warnedExpiringSoon: result.warnedExpiringSoon.length,
        expired: result.expired.length,
        released: result.released.length,
      },
      'tick das reguas de plano de treino processado',
    );
    return;
  }
  // Notificacao pronta (texto + destinatario ja resolvidos pela regua) — entrega
  // de verdade via canal in-app (D-027).
  await notificationDispatcher.dispatch({
    to: data.recipientAccountId,
    channel: 'in_app',
    title: data.title,
    body: data.body,
    data: { planId: data.planId, kind: data.kind },
  });
  logger.info(
    { planId: data.planId, kind: data.kind },
    'notificacao de plano de treino entregue (canal in-app)',
  );
});

// Agenda as varreduras repetidas (cron). No BullMQ o schedule repetido nao
// duplica entre reinicios do worker (mesma configuracao de repeat).
async function scheduleRuler(): Promise<void> {
  await rulerTicks.enqueue(
    RULER_TICK_EVENT,
    { at: new Date().toISOString() },
    { repeatEveryMs: env.COLLECTION_RULER_INTERVAL_MS },
  );
  logger.info(
    { intervalMs: env.COLLECTION_RULER_INTERVAL_MS },
    'regua de cobranca agendada (cron)',
  );

  await planLifecycleTicks.enqueue(
    PLAN_LIFECYCLE_TICK_EVENT,
    { at: new Date().toISOString() },
    { repeatEveryMs: env.PLAN_LIFECYCLE_RULER_INTERVAL_MS },
  );
  logger.info(
    { intervalMs: env.PLAN_LIFECYCLE_RULER_INTERVAL_MS },
    'reguas de plano de treino agendadas (cron)',
  );
}
void scheduleRuler();

logger.info(
  'worker pronto (compartilhamento D-017 + regua de cobranca ADR-0004 + reguas de plano de treino ADR-0009)',
);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'encerrando worker');
  await sharingWorker.close();
  await billingWorker.close();
  await workoutWorker.close();
  await queueFactory.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
