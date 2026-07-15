/**
 * @fitvo/auth — porta de envio de e-mails transacionais da autenticacao (D-029:
 * verificacao de e-mail e recuperacao de senha). Especifica os intents de auth
 * (nao um provedor). O adaptador real (provedor de e-mail) entra em fase
 * posterior; ate la usa-se o stub que apenas registra em log.
 */

export interface AuthEmailMessage {
  /** Destinatario (e-mail da conta). */
  to: string;
  /** Token de uso unico em claro, para compor o link/codigo. */
  token: string;
  /** Link ja montado, quando as rotas do app web existirem (opcional por ora). */
  link?: string;
}

export interface AuthEmailSender {
  sendEmailVerification(message: AuthEmailMessage): Promise<void>;
  sendPasswordReset(message: AuthEmailMessage): Promise<void>;
}

/**
 * Sink de log minimo, compativel estruturalmente com `console` e com o logger
 * pino da API (`info(details, message)`). Mantem o stub desacoplado de qualquer
 * implementacao concreta de log.
 */
export interface AuthEmailLogSink {
  info(details: Record<string, unknown>, message: string): void;
}

/**
 * Stub de envio: NAO integra provedor real ainda (correto para esta fase —
 * D-029 exige recuperacao/verificacao seguras, nao um provedor especifico).
 * Registra destinatario e token no log para uso em desenvolvimento. Deve ser
 * substituido por um adaptador real (e idealmente enfileirado no worker) antes
 * de producao.
 */
export class LoggingAuthEmailSender implements AuthEmailSender {
  constructor(private readonly log: AuthEmailLogSink) {}

  sendEmailVerification(message: AuthEmailMessage): Promise<void> {
    this.log.info(
      { to: message.to, token: message.token, link: message.link },
      'auth: envio (stub) de verificacao de e-mail',
    );
    return Promise.resolve();
  }

  sendPasswordReset(message: AuthEmailMessage): Promise<void> {
    this.log.info(
      { to: message.to, token: message.token, link: message.link },
      'auth: envio (stub) de recuperacao de senha',
    );
    return Promise.resolve();
  }
}
