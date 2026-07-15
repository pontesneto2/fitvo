/**
 * @fitvo/notifications — contrato multicanal (D-027): push (FCM), e-mail,
 * in-app (sininho) e SMS. Alem do contrato, expoe o dispatcher concreto, o
 * sender in-app (persistindo via porta injetada), o sender de log (default
 * seguro/GATED para push/email/sms) e o fake em memoria da central. WhatsApp
 * fica fora do MVP; providers externos ficam GATED ate haver credenciais.
 */

export type NotificationChannel = 'push' | 'email' | 'in_app' | 'sms';

export interface NotificationMessage {
  to: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface NotificationSender {
  send(message: NotificationMessage): Promise<void>;
}

/** Roteia uma mensagem para o adaptador do canal apropriado. */
export interface NotificationDispatcher {
  dispatch(message: NotificationMessage): Promise<void>;
  register(channel: NotificationChannel, sender: NotificationSender): void;
}

// Adaptadores concretos e a porta da central in-app (D-027). O dominio depende
// das interfaces acima; os providers externos ficam GATED ate as credenciais.
export { InAppNotificationSender } from './in-app-notification-sender';
export {
  type InAppNotificationStore,
  InMemoryInAppNotificationStore,
  type SaveInAppNotificationInput,
  type StoredNotification,
} from './in-app-notification-store';
export { LoggingNotificationSender } from './logging-notification-sender';
export {
  buildDefaultDispatcher,
  type DefaultDispatcherOptions,
  DefaultNotificationDispatcher,
} from './notification-dispatcher';
