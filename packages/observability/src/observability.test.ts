import { describe, expect, it } from 'vitest';

import type { HealthCheck } from './index';
import { NoopLogger, PinoLogger, runHealthChecks, worstStatus } from './index';

/** Coletor de linhas JSON emitidas pelo pino (destino de teste, sem I/O real). */
function captureDestination(): {
  lines: () => Record<string, unknown>[];
  write: (chunk: string) => void;
} {
  const raw: string[] = [];
  return {
    write: (chunk: string): void => {
      raw.push(chunk);
    },
    lines: (): Record<string, unknown>[] =>
      raw
        .join('')
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

describe('PinoLogger', () => {
  it('emite JSON estruturado com a mensagem e os campos', () => {
    const dest = captureDestination();
    const logger = PinoLogger.create({ level: 'debug', name: 'test' }, dest);

    logger.info('ola', { userId: 'u1' });

    const [entry] = dest.lines();
    expect(entry).toMatchObject({ msg: 'ola', name: 'test', userId: 'u1', level: 30 });
  });

  it('respeita o nivel configurado (descarta abaixo do limite)', () => {
    const dest = captureDestination();
    const logger = PinoLogger.create({ level: 'warn' }, dest);

    logger.debug('invisivel');
    logger.warn('visivel');

    const lines = dest.lines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ msg: 'visivel', level: 40 });
  });

  it('propaga bindings via child()', () => {
    const dest = captureDestination();
    const logger = PinoLogger.create({ level: 'info' }, dest);

    logger.child({ requestId: 'r1' }).info('com contexto');

    expect(dest.lines()[0]).toMatchObject({ msg: 'com contexto', requestId: 'r1' });
  });
});

describe('NoopLogger', () => {
  it('nunca lanca e child() devolve outro logger utilizavel', () => {
    const logger = new NoopLogger();
    expect(() => {
      logger.info('x', { a: 1 });
      logger.error('y');
      logger.child({ b: 2 }).warn('z');
    }).not.toThrow();
  });
});

describe('worstStatus', () => {
  it('devolve o pior status da lista (vazio => healthy)', () => {
    expect(worstStatus([])).toBe('healthy');
    expect(worstStatus(['healthy', 'degraded'])).toBe('degraded');
    expect(worstStatus(['healthy', 'degraded', 'unhealthy'])).toBe('unhealthy');
  });
});

describe('runHealthChecks', () => {
  const check = (name: string, result: HealthCheck['check']): HealthCheck => ({
    name,
    check: result,
  });

  it('agrega o pior status e mantem os detalhes por dependencia', async () => {
    const result = await runHealthChecks([
      check('db', () => Promise.resolve({ status: 'healthy' })),
      check('redis', () => Promise.resolve({ status: 'degraded' })),
    ]);

    expect(result.status).toBe('degraded');
    expect(result.details).toEqual({
      db: { status: 'healthy' },
      redis: { status: 'degraded' },
    });
  });

  it('trata uma checagem que lanca como unhealthy com a mensagem do erro', async () => {
    const result = await runHealthChecks([
      check('db', () => Promise.resolve({ status: 'healthy' })),
      check('provider', () => Promise.reject(new Error('timeout'))),
    ]);

    expect(result.status).toBe('unhealthy');
    expect(result.details?.provider).toEqual({ status: 'unhealthy', message: 'timeout' });
  });
});
