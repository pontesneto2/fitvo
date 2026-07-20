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
 * Campos sensiveis censurados em todo log (rede de seguranca — D-073). Cobre o
 * campo no topo e um nivel de aninhamento (ex.: `body.password`). O primeiro
 * dever e nunca logar o segredo na origem; isto e a rede, nao o piso: um handler
 * que logue um payload por engano nao vaza credencial nem CPF (`document`).
 * Inclui `cookie`/`set-cookie` porque o refresh token httpOnly viaja no cookie —
 * e o segredo de sessao mais sensivel.
 */
const SENSITIVE_KEYS = [
  'token',
  'password',
  'newPassword',
  'currentPassword',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'set-cookie',
  'apiKey',
  'secret',
  'document',
] as const;

/** Chave que e identificador JS valido usa notacao de ponto; as demais (ex.:
 * `set-cookie`, com hifen) exigem notacao de colchete no path do fast-redact. */
const isPlainKey = (key: string): boolean => /^[A-Za-z_$][\w$]*$/.test(key);
const REDACT_PATHS = SENSITIVE_KEYS.flatMap((key) =>
  isPlainKey(key) ? [key, `*.${key}`] : [`["${key}"]`, `*["${key}"]`],
);

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
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
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
