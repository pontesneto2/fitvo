import { describe, expect, it } from 'vitest';

import { InMemoryQueueFactory } from './in-memory-queue-factory';

interface Payload {
  value: number;
}

describe('InMemoryQueueFactory', () => {
  it('coleta os jobs enfileirados para inspecao nos testes', async () => {
    const factory = new InMemoryQueueFactory();
    const queue = factory.createQueue<Payload>('q1');

    const id = await queue.enqueue('job.a', { value: 1 });
    await queue.enqueue('job.b', { value: 2 });

    expect(id).toBe('q1:1');
    expect(factory.enqueuedJobs<Payload>('q1')).toEqual([
      { name: 'job.a', data: { value: 1 } },
      { name: 'job.b', data: { value: 2 } },
    ]);
  });

  it('devolve lista vazia para uma fila nunca usada', () => {
    const factory = new InMemoryQueueFactory();
    expect(factory.enqueuedJobs('inexistente')).toEqual([]);
  });

  it('invoca o handler do worker sincronamente ao enfileirar (mesma fila por nome)', async () => {
    const factory = new InMemoryQueueFactory();
    const seen: Payload[] = [];
    factory.createWorker<Payload>('q2', (data) => {
      seen.push(data);
      return Promise.resolve();
    });
    const queue = factory.createQueue<Payload>('q2');

    await queue.enqueue('job', { value: 42 });

    expect(seen).toEqual([{ value: 42 }]);
  });

  it('liga fila e worker por nome independente da ordem de criacao', async () => {
    const factory = new InMemoryQueueFactory();
    const queue = factory.createQueue<Payload>('q3');
    const seen: Payload[] = [];
    factory.createWorker<Payload>('q3', (data) => {
      seen.push(data);
      return Promise.resolve();
    });

    await queue.enqueue('job', { value: 7 });

    expect(seen).toEqual([{ value: 7 }]);
    expect(factory.enqueuedJobs('q3')).toHaveLength(1);
  });

  it('jobId duplicado nao adiciona um segundo job nem invoca o handler de novo', async () => {
    const factory = new InMemoryQueueFactory();
    const queue = factory.createQueue<Payload>('q4');
    const seen: Payload[] = [];
    factory.createWorker<Payload>('q4', (data) => {
      seen.push(data);
      return Promise.resolve();
    });

    const firstId = await queue.enqueue('job', { value: 1 }, { jobId: 'dedupe-key' });
    const secondId = await queue.enqueue('job', { value: 2 }, { jobId: 'dedupe-key' });

    expect(secondId).toBe(firstId);
    expect(seen).toEqual([{ value: 1 }]);
    expect(factory.enqueuedJobs('q4')).toHaveLength(1);
  });

  it('jobIds diferentes na mesma fila enfileiram normalmente', async () => {
    const factory = new InMemoryQueueFactory();
    const queue = factory.createQueue<Payload>('q5');

    await queue.enqueue('job', { value: 1 }, { jobId: 'a' });
    await queue.enqueue('job', { value: 2 }, { jobId: 'b' });

    expect(factory.enqueuedJobs('q5')).toHaveLength(2);
  });
});
