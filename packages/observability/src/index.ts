/**
 * @fitvo/observability — contratos de log estruturado, contexto de requisicao
 * e health checks (D-073). Interfaces apenas; adaptadores (pino/OTel/Sentry)
 * entram em fase posterior.
 */

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export type LogFields = Record<string, unknown>;

/** Logger estruturado (JSON). Suporta bindings via child(). */
export interface Logger {
  fatal(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  debug(message: string, fields?: LogFields): void;
  trace(message: string, fields?: LogFields): void;
  child(bindings: LogFields): Logger;
}

/** Contexto propagado por requisicao (rastreio ponta a ponta). */
export interface RequestContext {
  requestId: string;
  correlationId: string;
}

/** Cabecalho HTTP padrao para propagar o correlation ID. */
export const CORRELATION_ID_HEADER = 'x-correlation-id' as const;
export const REQUEST_ID_HEADER = 'x-request-id' as const;

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  status: HealthStatus;
  details?: Record<string, { status: HealthStatus; message?: string }>;
}

/** Verificacao de saude de uma dependencia (db, redis, provider...). */
export interface HealthCheck {
  readonly name: string;
  check(): Promise<HealthCheckResult>;
}
