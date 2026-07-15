import type { LogFields, Logger } from './index';

/**
 * Logger nulo (descarta tudo). Usado em testes e onde o log e indesejado —
 * satisfaz o contrato `Logger` sem I/O. As assinaturas espelham a interface
 * (para poder ser usado com o tipo concreto); `child()` devolve o proprio noop.
 */
export class NoopLogger implements Logger {
  fatal(_message: string, _fields?: LogFields): void {}
  error(_message: string, _fields?: LogFields): void {}
  warn(_message: string, _fields?: LogFields): void {}
  info(_message: string, _fields?: LogFields): void {}
  debug(_message: string, _fields?: LogFields): void {}
  trace(_message: string, _fields?: LogFields): void {}
  child(_bindings: LogFields): Logger {
    return this;
  }
}
