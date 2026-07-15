import type { JobHandler, JobOptions, Queue, QueueFactory, Worker } from './index';

/** Job coletado por uma fila em memoria (para asserts nos testes). */
export interface CollectedJob<TData> {
  name: string;
  data: TData;
}

interface QueueState {
  jobs: CollectedJob<unknown>[];
  handler?: JobHandler<unknown>;
}

/**
 * Fabrica de filas em memoria para testes e desenvolvimento local — sincrona e
 * COLETAVEL (sem Redis). Espelha o contrato `QueueFactory`:
 * - `enqueue` registra o job (inspecionavel via `enqueuedJobs`) e, se ja houver
 *   um worker registrado para a mesma fila, invoca o handler SINCRONAMENTE — o
 *   que permite testar produtor e consumidor de ponta a ponta sem infra.
 * - fila e worker sao ligados por NOME (a ordem de criacao nao importa).
 */
export class InMemoryQueueFactory implements QueueFactory {
  private readonly states = new Map<string, QueueState>();

  createQueue<TData>(queueName: string): Queue<TData> {
    const state = this.stateFor(queueName);
    return {
      enqueue: async (name: string, data: TData, _options?: JobOptions): Promise<string> => {
        state.jobs.push({ name, data });
        if (state.handler) {
          await state.handler(data);
        }
        return `${queueName}:${state.jobs.length}`;
      },
    };
  }

  createWorker<TData>(queueName: string, handler: JobHandler<TData>): Worker {
    const state = this.stateFor(queueName);
    state.handler = handler as JobHandler<unknown>;
    return { close: () => Promise.resolve() };
  }

  /** Jobs enfileirados numa fila (para asserts). Vazio se a fila nunca foi usada. */
  enqueuedJobs<TData>(queueName: string): CollectedJob<TData>[] {
    return this.stateFor(queueName).jobs as CollectedJob<TData>[];
  }

  private stateFor(queueName: string): QueueState {
    let state = this.states.get(queueName);
    if (!state) {
      state = { jobs: [] };
      this.states.set(queueName, state);
    }
    return state;
  }
}
