import { type JobsOptions, Queue as BullQueue, Worker as BullWorker } from 'bullmq';
import { Redis } from 'ioredis';

import type { JobHandler, JobOptions, Queue, QueueFactory, Worker } from './index';

/**
 * Implementacao concreta da fabrica de filas sobre BullMQ + ioredis (D-026).
 * Traduz a abstracao `QueueFactory` (interface do dominio) para BullMQ, mantendo
 * o dominio desacoplado da tecnologia. Compartilha UMA conexao ioredis entre as
 * filas/workers criados (BullMQ duplica internamente as conexoes bloqueantes que
 * o worker precisa) — mesmo padrao ja usado pelo apps/worker.
 *
 * `maxRetriesPerRequest: null` e requisito do BullMQ para conexoes de worker.
 */
export class BullMqQueueFactory implements QueueFactory {
  private readonly connection: Redis;

  constructor(redisUrl: string) {
    this.connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  }

  createQueue<TData>(queueName: string): Queue<TData> {
    // BullMQ tipa o nome do job como `NameType` derivado de TData; na fronteira
    // do adaptador usamos a fila sem parametrizar (DataType=any) — a tipagem
    // externa (`Queue<TData>`) preserva a seguranca de tipos para os chamadores.
    const queue = new BullQueue(queueName, { connection: this.connection });
    return {
      enqueue: async (name: string, data: TData, options?: JobOptions): Promise<string> => {
        const jobOptions: JobsOptions = {};
        if (options?.delayMs !== undefined) {
          jobOptions.delay = options.delayMs;
        }
        if (options?.attempts !== undefined) {
          jobOptions.attempts = options.attempts;
        }
        if (options?.repeatEveryMs !== undefined) {
          // Job repetido (cron) — ex.: varredura periodica da regua (ADR-0004).
          jobOptions.repeat = { every: options.repeatEveryMs };
        }
        const job = await queue.add(name, data, jobOptions);
        return job.id ?? '';
      },
    };
  }

  createWorker<TData>(queueName: string, handler: JobHandler<TData>): Worker {
    const worker = new BullWorker<TData>(
      queueName,
      async (job) => {
        await handler(job.data);
      },
      { connection: this.connection },
    );
    return { close: () => worker.close() };
  }

  /** Encerra a conexao compartilhada (chamar no shutdown do processo). */
  async close(): Promise<void> {
    await this.connection.quit();
  }
}
