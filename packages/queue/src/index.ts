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
  /**
   * Intervalo de repeticao (cron) em ms. Quando presente, o job e REPETIDO nesse
   * intervalo (ex.: a varredura diaria da regua de cobranca — ADR-0004). Traduz
   * para `repeat.every` do BullMQ; a fila em memoria (testes) ignora a repeticao.
   */
  repeatEveryMs?: number;
  /**
   * Id estavel do job — dedupe nativo (D-083/D-084, regua de treino): enfileirar
   * duas vezes com o MESMO jobId nao duplica (BullMQ ignora se o job ainda existe;
   * a fila em memoria replica o mesmo comportamento). Usar quando a varredura pode
   * rodar mais de uma vez sobre o mesmo estado sem uma transicao que a torne
   * naturalmente idempotente.
   */
  jobId?: string;
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
export {
  BILLING_QUEUE,
  BOND_CREATED_EVENT,
  type BondCreatedEvent,
  PLAN_LIFECYCLE_NOTIFICATION_EVENT,
  PLAN_LIFECYCLE_TICK_EVENT,
  type PlanLifecycleNotificationEvent,
  type PlanLifecycleNotificationKind,
  type PlanLifecycleTickEvent,
  RULER_TICK_EVENT,
  type RulerTickEvent,
  SHARING_QUEUE,
  SUBSCRIPTION_REMINDER_EVENT,
  type SubscriptionReminderEvent,
  type SubscriptionReminderKind,
  WORKOUT_QUEUE,
} from './events';
export { type CollectedJob, InMemoryQueueFactory } from './in-memory-queue-factory';
