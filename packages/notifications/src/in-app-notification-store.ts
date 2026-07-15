import { randomUUID } from 'node:crypto';

/**
 * Notificacao in-app persistida (central/sininho — D-027). Persiste ate o
 * usuario apagar: soft delete (`deletedAt`). As notificacoes sensiveis
 * (financeiras/consentimento) devem ser mantidas em log por obrigacao legal —
 * regra a cargo do chamador; a store apenas persiste e oculta as apagadas.
 */
export interface StoredNotification {
  id: string;
  recipient: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface SaveInAppNotificationInput {
  recipient: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Porta de persistencia da central in-app (ADR-0005). O sender in-app depende
 * desta porta, nunca de um banco concreto. Uma implementacao Prisma (+ tabela
 * Notification) e OPCIONAL e exigiria migracao aditiva — deferida para nao
 * colidir com o schema em andamento.
 * TODO(D-027): impl. Prisma (tabela Notification) quando a migracao for coordenada.
 */
export interface InAppNotificationStore {
  save(input: SaveInAppNotificationInput): Promise<StoredNotification>;
  /** Lista as notificacoes NAO apagadas do destinatario (mais recentes primeiro). */
  listForRecipient(recipient: string): Promise<StoredNotification[]>;
  /** Soft delete: marca `deletedAt`, mantendo o registro. */
  softDelete(id: string): Promise<void>;
}

/**
 * Store in-app em memoria (Map) — o fake do contrato para testes e dev local.
 * `idGenerator` e `now` sao injetaveis para tornar os testes deterministicos.
 */
export class InMemoryInAppNotificationStore implements InAppNotificationStore {
  private readonly notifications = new Map<string, StoredNotification>();

  constructor(
    private readonly idGenerator: () => string = () => randomUUID(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  save(input: SaveInAppNotificationInput): Promise<StoredNotification> {
    const notification: StoredNotification = {
      id: this.idGenerator(),
      recipient: input.recipient,
      title: input.title,
      body: input.body,
      createdAt: this.now(),
      deletedAt: null,
    };
    if (input.data !== undefined) {
      notification.data = input.data;
    }
    this.notifications.set(notification.id, notification);
    return Promise.resolve(notification);
  }

  listForRecipient(recipient: string): Promise<StoredNotification[]> {
    const list = [...this.notifications.values()]
      .filter((n) => n.recipient === recipient && n.deletedAt === null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Promise.resolve(list);
  }

  softDelete(id: string): Promise<void> {
    const notification = this.notifications.get(id);
    if (notification && notification.deletedAt === null) {
      notification.deletedAt = this.now();
    }
    return Promise.resolve();
  }
}
