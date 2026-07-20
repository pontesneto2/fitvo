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

  it('censura campos sensiveis (rede de seguranca) sem tocar nos demais', () => {
    const dest = captureDestination();
    const logger = PinoLogger.create({ level: 'info', name: 'test' }, dest);

    logger.info('evento', {
      to: 'ana@fitvo.dev', // nao-sensivel: permanece
      token: 'segredo-123', // topo: censurado
      nested: { password: 'p4ss', document: '12345678900' }, // 1 nivel: censurado
    });

    const [entry] = dest.lines();
    expect(entry).toMatchObject({
      to: 'ana@fitvo.dev',
      token: '[REDACTED]',
      nested: { password: '[REDACTED]', document: '[REDACTED]' },
    });
    // O check so vale se reprovar o vazamento: o segredo nao pode sobrar na linha.
    expect(JSON.stringify(entry)).not.toContain('segredo-123');
    expect(JSON.stringify(entry)).not.toContain('12345678900');
  });

  it('censura cookie e set-cookie (o refresh token httpOnly vive no cookie)', () => {
    const dest = captureDestination();
    const logger = PinoLogger.create({ level: 'info', name: 'test' }, dest);

    logger.info('requisicao', {
      cookie: 'refreshToken=segredo-no-cookie; HttpOnly', // topo: censurado
      headers: { 'set-cookie': 'refreshToken=segredo-no-set-cookie; HttpOnly' }, // 1 nivel: censurado
    });

    const [entry] = dest.lines();
    expect(entry).toMatchObject({
      cookie: '[REDACTED]',
      headers: { 'set-cookie': '[REDACTED]' },
    });
    // O check so vale se reprovar o vazamento: o segredo do cookie nao pode sobrar.
    expect(JSON.stringify(entry)).not.toContain('segredo-no-cookie');
    expect(JSON.stringify(entry)).not.toContain('segredo-no-set-cookie');
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
