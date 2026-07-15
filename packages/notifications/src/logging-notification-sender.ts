import type { Logger } from '@fitvo/observability';

import type { NotificationMessage, NotificationSender } from './index';

/**
 * Sender que apenas REGISTRA a notificacao no logger estruturado. E o default
 * seguro para push/e-mail/SMS enquanto os providers reais nao estao conectados
 * (D-027) — nunca chama servico externo, nunca fabrica credencial.
 *
 * TODO(D-027): substituir por adaptadores reais quando houver credenciais:
 *   - push  -> Firebase Cloud Messaging (FCM)
 *   - email -> provider de e-mail (SES/Resend/SMTP)
 *   - sms   -> provider de SMS
 */
export class LoggingNotificationSender implements NotificationSender {
  constructor(private readonly logger: Logger) {}

  send(message: NotificationMessage): Promise<void> {
    this.logger.info('notificacao despachada (stub — entrega gated D-027)', {
      channel: message.channel,
      to: message.to,
      title: message.title,
    });
    return Promise.resolve();
  }
}
