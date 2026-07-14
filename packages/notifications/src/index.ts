/**
 * @fitvo/notifications — contrato multicanal (D-027): push (FCM), e-mail,
 * in-app (sininho) e SMS. Interfaces apenas; adaptadores por canal em fase
 * posterior. WhatsApp fica fora do MVP.
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
