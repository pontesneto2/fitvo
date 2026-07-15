import { describe, expect, it } from 'vitest';

import { InMemoryVerificationTokenStore } from './verification-token-store';

describe('InMemoryVerificationTokenStore', () => {
  it('emite um token opaco e o consome uma unica vez', async () => {
    const store = new InMemoryVerificationTokenStore();
    const { token, expiresAt } = await store.issue('email_verification', 'acc_1', 3600);

    expect(token).toBeTruthy();
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    expect(await store.consume('email_verification', token)).toBe('acc_1');
    // uso unico: a segunda tentativa falha
    expect(await store.consume('email_verification', token)).toBeNull();
  });

  it('nao consome com a finalidade errada', async () => {
    const store = new InMemoryVerificationTokenStore();
    const { token } = await store.issue('password_reset', 'acc_2', 3600);

    expect(await store.consume('email_verification', token)).toBeNull();
    // o token continua valido para a finalidade correta
    expect(await store.consume('password_reset', token)).toBe('acc_2');
  });

  it('rejeita token invalido', async () => {
    const store = new InMemoryVerificationTokenStore();
    expect(await store.consume('email_verification', 'nao-existe')).toBeNull();
  });

  it('rejeita token expirado (e o remove)', async () => {
    const store = new InMemoryVerificationTokenStore();
    const { token } = await store.issue('password_reset', 'acc_3', -1);
    expect(await store.consume('password_reset', token)).toBeNull();
  });
});
