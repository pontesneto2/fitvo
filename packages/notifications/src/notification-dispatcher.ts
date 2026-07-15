import type { Logger } from '@fitvo/observability';

import { InAppNotificationSender } from './in-app-notification-sender';
import type { InAppNotificationStore } from './in-app-notification-store';
import type {
  NotificationChannel,
  NotificationDispatcher,
  NotificationMessage,
  NotificationSender,
} from './index';
import { LoggingNotificationSender } from './logging-notification-sender';

/**
 * Dispatcher concreto (D-027): roteia cada mensagem para o `NotificationSender`
 * registrado no seu canal. Um canal sem sender registrado vira REJEICAO explicita
 * (nunca engole a mensagem em silencio).
 */
export class DefaultNotificationDispatcher implements NotificationDispatcher {
  private readonly senders = new Map<NotificationChannel, NotificationSender>();

  register(channel: NotificationChannel, sender: NotificationSender): void {
    this.senders.set(channel, sender);
  }

  dispatch(message: NotificationMessage): Promise<void> {
    const sender = this.senders.get(message.channel);
    if (!sender) {
      return Promise.reject(
        new Error(`Nenhum sender registrado para o canal '${message.channel}'.`),
      );
    }
    return sender.send(message);
  }
}

export interface DefaultDispatcherOptions {
  logger: Logger;
  inAppStore: InAppNotificationStore;
}

/**
 * Monta o dispatcher padrao do MVP (D-027): in-app persiste de fato (via a porta
 * injetada); push/e-mail/SMS caem no LoggingNotificationSender (entrega GATED)
 * ate os providers reais serem conectados. Trocar um canal = registrar outro
 * sender, sem mexer no dominio.
 */
export function buildDefaultDispatcher(options: DefaultDispatcherOptions): NotificationDispatcher {
  const dispatcher = new DefaultNotificationDispatcher();
  const logging = new LoggingNotificationSender(options.logger);

  // GATED (D-027): canais externos usam o logger ate haver credenciais.
  dispatcher.register('push', logging); // TODO(D-027): wire FCM
  dispatcher.register('email', logging); // TODO(D-027): wire email provider
  dispatcher.register('sms', logging); // TODO(D-027): wire SMS provider

  // In-app persiste na central (sininho) — soft delete no proprio store.
  dispatcher.register('in_app', new InAppNotificationSender(options.inAppStore));

  return dispatcher;
}
