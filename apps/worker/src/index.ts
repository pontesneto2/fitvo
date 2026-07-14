import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';

import { env } from './env';

const logger = pino({ level: env.LOG_LEVEL, name: 'worker' });

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

/**
 * Worker BullMQ da FITVO. Fase 1: apenas a conexao e o loop de processamento;
 * sem jobs de negocio (notificacoes, webhooks Asaas, IA async e motor de
 * compartilhamento entram nas fases seguintes — D-017/D-027/D-028).
 */
const worker = new Worker(
  'fitvo:default',
  (job) => {
    logger.info({ jobId: job.id, name: job.name }, 'job recebido (no-op na Fase 1)');
    return Promise.resolve(job.data);
  },
  { connection },
);

worker.on('ready', () => logger.info('worker pronto (conectado ao Redis)'));
worker.on('error', (error) => logger.error({ err: error }, 'erro no worker'));

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'encerrando worker');
  await worker.close();
  connection.disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
