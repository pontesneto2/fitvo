import type {
  InAppNotificationStore,
  SaveInAppNotificationInput,
} from './in-app-notification-store';
import type { NotificationMessage, NotificationSender } from './index';

/**
 * Sender do canal in-app (sininho — D-027): persiste a notificacao via a porta
 * `InAppNotificationStore` (injetada). Nao envia nada externo — a central e
 * consultada pelo cliente. Desacoplado do banco (depende da porta, nao de Prisma).
 */
export class InAppNotificationSender implements NotificationSender {
  constructor(private readonly store: InAppNotificationStore) {}

  async send(message: NotificationMessage): Promise<void> {
    const input: SaveInAppNotificationInput = {
      recipient: message.to,
      title: message.title,
      body: message.body,
    };
    if (message.data !== undefined) {
      input.data = message.data;
    }
    await this.store.save(input);
  }
}
