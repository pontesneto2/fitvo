import { prisma } from '@fitvo/database';
import {
  BILLING_QUEUE,
  type BondCreatedEvent,
  BullMqQueueFactory,
  RULER_TICK_EVENT,
  type RulerTickEvent,
  SHARING_QUEUE,
  type SubscriptionReminderEvent,
} from '@fitvo/queue';
import pino from 'pino';

import { CollectionRulerService } from './billing/collection-ruler-service';
import { PrismaCollectionRulerRepository } from './billing/prisma-collection-ruler-repository';
import { env } from './env';
import { OverlapDetectionService } from './sharing/overlap-detection-service';
import { PrismaSharingRepository } from './sharing/prisma-sharing-repository';

const logger = pino({ level: env.LOG_LEVEL, name: 'worker' });

/** Job que trafega na fila de billing: o tick da regua OU um lembrete. */
type BillingJob = RulerTickEvent | SubscriptionReminderEvent;

/** Discrimina o tick (`at`) do lembrete (`kind`) na fila de billing. */
function isRulerTick(job: BillingJob): job is RulerTickEvent {
  return 'at' in job;
}

/**
 * Worker BullMQ da FITVO. Consome:
 * - a fila de compartilhamento (D-017): cada `bond.created` roda a deteccao de
 *   sobreposicao e persiste SharingSuggestion PENDING.
 * - a fila de billing (ADR-0004): um tick REPETIDO (cron) dispara a regua de
 *   cobranca, que transiciona ACTIVE->PAST_DUE->SUSPENDED e ENFILEIRA lembretes.
 *   A ENTREGA por notificacao e GATED (D-028) — o lembrete so e registrado.
 * Boot-safe: a conexao Redis so e criada aqui (os motores sao testaveis sem infra).
 */
const queueFactory = new BullMqQueueFactory(env.REDIS_URL);

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
  new PrismaCollectionRulerRepository(prisma),
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
  // Lembrete: entrega GATED.
  // TODO(D-028): deliver via notifications adapter
  logger.info(
    { subscriptionId: data.subscriptionId, kind: data.kind },
    'lembrete de assinatura enfileirado (entrega gated — D-028)',
  );
});

// Agenda a varredura repetida (cron) da regua. No BullMQ o schedule repetido nao
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
}
void scheduleRuler();

logger.info('worker pronto (compartilhamento D-017 + regua de cobranca ADR-0004)');

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'encerrando worker');
  await sharingWorker.close();
  await billingWorker.close();
  await queueFactory.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
