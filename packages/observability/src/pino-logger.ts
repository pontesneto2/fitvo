import pino from 'pino';

import type { LogFields, Logger, LogLevel } from './index';

/** Instancia pino subjacente (o tipo concreto do provider). */
type PinoInstance = pino.Logger;

export interface PinoLoggerOptions {
  level?: LogLevel;
  /** Nome do servico/binding raiz (ex.: 'api', 'worker'). */
  name?: string;
}

/**
 * Adaptador concreto do contrato `Logger` sobre pino (D-073). Log estruturado
 * JSON, com `child(bindings)` propagando contexto (request/correlation ID). O
 * dominio depende apenas da interface `Logger`; pino fica confinado aqui.
 *
 * Testavel sem I/O real: `create(options, destination)` aceita um destino pino
 * (`{ write(msg) }`), permitindo capturar a saida JSON nos testes sem tocar em
 * stdout.
 */
export class PinoLogger implements Logger {
  private constructor(private readonly logger: PinoInstance) {}

  /** Cria um PinoLogger; `destination` opcional permite capturar a saida (testes). */
  static create(options: PinoLoggerOptions = {}, destination?: pino.DestinationStream): PinoLogger {
    const pinoOptions: pino.LoggerOptions = {
      level: options.level ?? 'info',
      ...(options.name ? { name: options.name } : {}),
    };
    const instance = destination ? pino(pinoOptions, destination) : pino(pinoOptions);
    return new PinoLogger(instance);
  }

  /** Envolve uma instancia pino ja existente (ex.: a do Fastify). */
  static fromPino(instance: PinoInstance): PinoLogger {
    return new PinoLogger(instance);
  }

  fatal(message: string, fields?: LogFields): void {
    this.logger.fatal(fields ?? {}, message);
  }

  error(message: string, fields?: LogFields): void {
    this.logger.error(fields ?? {}, message);
  }

  warn(message: string, fields?: LogFields): void {
    this.logger.warn(fields ?? {}, message);
  }

  info(message: string, fields?: LogFields): void {
    this.logger.info(fields ?? {}, message);
  }

  debug(message: string, fields?: LogFields): void {
    this.logger.debug(fields ?? {}, message);
  }

  trace(message: string, fields?: LogFields): void {
    this.logger.trace(fields ?? {}, message);
  }

  child(bindings: LogFields): Logger {
    return new PinoLogger(this.logger.child(bindings));
  }
}
