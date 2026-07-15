import { prisma } from '@fitvo/database';
import { type BondCreatedEvent, BullMqQueueFactory, SHARING_QUEUE } from '@fitvo/queue';
import pino from 'pino';

import { env } from './env';
import { OverlapDetectionService } from './sharing/overlap-detection-service';
import { PrismaSharingRepository } from './sharing/prisma-sharing-repository';

const logger = pino({ level: env.LOG_LEVEL, name: 'worker' });

/**
 * Worker BullMQ da FITVO. Consome a fila do motor de compartilhamento (D-017):
 * cada `bond.created` roda a deteccao de sobreposicao e, se o paciente passou a
 * ter >=2 profissionais distintos, persiste uma SharingSuggestion PENDING. A
 * ENTREGA por notificacao e gated (D-028) — ver TODO no OverlapDetectionService.
 * Boot-safe: a conexao Redis so e criada aqui (o motor e testavel sem infra).
 */
const queueFactory = new BullMqQueueFactory(env.REDIS_URL);
const overlapService = new OverlapDetectionService(new PrismaSharingRepository(prisma));

const worker = queueFactory.createWorker<BondCreatedEvent>(SHARING_QUEUE, async (data) => {
  // A fila carrega apenas bond.created nesta fase; ao adicionar outros eventos,
  // ramificar por nome do job (a porta Queue expoe o nome no enqueue).
  const suggestions = await overlapService.handleBondCreated(data);
  logger.info(
    { patientProfileId: data.patientProfileId, suggestions: suggestions.length },
    'bond.created processado (motor de compartilhamento)',
  );
});

logger.info('worker pronto (motor de compartilhamento — D-017)');

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'encerrando worker');
  await worker.close();
  await queueFactory.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
