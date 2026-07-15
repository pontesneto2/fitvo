import { NoopLogger } from '@fitvo/observability';
import { describe, expect, it, vi } from 'vitest';

import {
  buildDefaultDispatcher,
  DefaultNotificationDispatcher,
  InAppNotificationSender,
  InMemoryInAppNotificationStore,
  LoggingNotificationSender,
  type NotificationMessage,
  type NotificationSender,
} from './index';

function message(overrides: Partial<NotificationMessage> = {}): NotificationMessage {
  return { to: 'user-1', channel: 'in_app', title: 't', body: 'b', ...overrides };
}

describe('DefaultNotificationDispatcher', () => {
  it('roteia a mensagem para o sender do canal registrado', async () => {
    const dispatcher = new DefaultNotificationDispatcher();
    const push: NotificationSender = { send: vi.fn().mockResolvedValue(undefined) };
    const email: NotificationSender = { send: vi.fn().mockResolvedValue(undefined) };
    dispatcher.register('push', push);
    dispatcher.register('email', email);

    await dispatcher.dispatch(message({ channel: 'push' }));

    expect(push.send).toHaveBeenCalledTimes(1);
    expect(email.send).not.toHaveBeenCalled();
  });

  it('rejeita quando o canal nao tem sender registrado', async () => {
    const dispatcher = new DefaultNotificationDispatcher();
    await expect(dispatcher.dispatch(message({ channel: 'sms' }))).rejects.toThrow(/canal 'sms'/);
  });
});

describe('InMemoryInAppNotificationStore + InAppNotificationSender', () => {
  it('persiste a notificacao e a lista para o destinatario', async () => {
    let seq = 0;
    const store = new InMemoryInAppNotificationStore(
      () => `n${++seq}`,
      () => new Date(seq * 1000),
    );
    const sender = new InAppNotificationSender(store);

    await sender.send(message({ to: 'ana', title: 'Oi', data: { k: 1 } }));
    await sender.send(message({ to: 'bob' }));

    const anas = await store.listForRecipient('ana');
    expect(anas).toHaveLength(1);
    expect(anas[0]).toMatchObject({ id: 'n1', recipient: 'ana', title: 'Oi', data: { k: 1 } });
    expect(await store.listForRecipient('bob')).toHaveLength(1);
  });

  it('soft delete oculta a notificacao da listagem mas nao a remove', async () => {
    const store = new InMemoryInAppNotificationStore(() => 'fixed-id');
    const saved = await store.save({ recipient: 'ana', title: 't', body: 'b' });

    await store.softDelete(saved.id);

    expect(await store.listForRecipient('ana')).toHaveLength(0);
  });

  it('ordena as notificacoes mais recentes primeiro', async () => {
    let t = 0;
    let seq = 0;
    const store = new InMemoryInAppNotificationStore(
      () => `n${++seq}`,
      () => new Date((t += 1000)),
    );
    await store.save({ recipient: 'ana', title: 'antiga', body: 'b' });
    await store.save({ recipient: 'ana', title: 'nova', body: 'b' });

    const list = await store.listForRecipient('ana');
    expect(list.map((n) => n.title)).toEqual(['nova', 'antiga']);
  });
});

describe('LoggingNotificationSender', () => {
  it('registra a notificacao no logger sem enviar nada externo', async () => {
    const logger = new NoopLogger();
    const spy = vi.spyOn(logger, 'info');
    const sender = new LoggingNotificationSender(logger);

    await sender.send(message({ channel: 'push', to: 'ana', title: 'Oi' }));

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('gated'), {
      channel: 'push',
      to: 'ana',
      title: 'Oi',
    });
  });
});

describe('buildDefaultDispatcher', () => {
  it('persiste in-app de verdade e loga os canais externos (GATED)', async () => {
    const logger = new NoopLogger();
    const logSpy = vi.spyOn(logger, 'info');
    const store = new InMemoryInAppNotificationStore(() => 'id-1');
    const dispatcher = buildDefaultDispatcher({ logger, inAppStore: store });

    await dispatcher.dispatch(message({ channel: 'in_app', to: 'ana' }));
    await dispatcher.dispatch(message({ channel: 'email', to: 'ana' }));

    expect(await store.listForRecipient('ana')).toHaveLength(1);
    expect(logSpy).toHaveBeenCalledTimes(1); // apenas o canal externo loga
  });
});
