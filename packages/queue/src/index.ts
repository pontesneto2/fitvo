/**
 * @fitvo/queue — contrato de filas sobre BullMQ (D-026): enfileirar e
 * processar jobs (notificacoes, webhooks Asaas, IA async, motor de
 * compartilhamento — D-017). Alem das interfaces do dominio, expoe a
 * implementacao concreta BullMQ (`BullMqQueueFactory`) e uma fabrica em memoria
 * (`InMemoryQueueFactory`) para testes, alem dos contratos de evento.
 */

export interface JobOptions {
  delayMs?: number;
  attempts?: number;
}

export interface Queue<TData> {
  /** Enfileira um job e devolve seu id. */
  enqueue(name: string, data: TData, options?: JobOptions): Promise<string>;
}

export type JobHandler<TData> = (data: TData) => Promise<void>;

export interface Worker {
  close(): Promise<void>;
}

/** Fabrica de filas/workers por nome de fila. */
export interface QueueFactory {
  createQueue<TData>(queueName: string): Queue<TData>;
  createWorker<TData>(queueName: string, handler: JobHandler<TData>): Worker;
}

export { BullMqQueueFactory } from './bullmq-queue-factory';
export { BOND_CREATED_EVENT, type BondCreatedEvent, SHARING_QUEUE } from './events';
export { type CollectedJob, InMemoryQueueFactory } from './in-memory-queue-factory';
