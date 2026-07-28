import { describe, expect, it } from 'vitest';

import { buildTestApp } from '../../testing/build-test-app';
import { validProfessionalRegistration } from '../../testing/professional-registration-fixture';
import { deriveDisplayName } from './account-repository';

/**
 * Regra de exibição do nome social (spec §3.1): `displayName = socialName ??
 * name`, derivada UMA vez no servidor e exposta no cadastro (account summary) e
 * no `/me`. O nome CIVIL segue trafegando em `name` (uso fiscal/documento) — o
 * ponto do LGPD é a UI exibir o social quando há, sem cada superfície
 * reimplementar a regra e arriscar vazar o civil.
 */
describe('deriveDisplayName (fonte única)', () => {
  it('usa o nome social quando presente', () => {
    expect(deriveDisplayName({ name: 'Maria Civil', socialName: 'Lia' })).toBe('Lia');
  });

  it('cai no nome civil quando não há nome social', () => {
    expect(deriveDisplayName({ name: 'Maria Civil', socialName: null })).toBe('Maria Civil');
  });
});

async function registerAndFetchMe(overrides: Record<string, unknown>): Promise<{
  registerAccount: { name: string; displayName: string };
  me: { name: string; displayName: string };
}> {
  const app = await buildTestApp();
  try {
    const reg = await app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: { ...validProfessionalRegistration, ...overrides },
    });
    expect(reg.statusCode).toBe(201);
    const token = reg.json().tokens.accessToken as string;
    const me = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.statusCode).toBe(200);
    return { registerAccount: reg.json().account, me: me.json() };
  } finally {
    await app.close();
  }
}

describe('displayName no cadastro e no /me (spec §3.1)', () => {
  it('com nome social: displayName = socialName; name civil preservado', async () => {
    const { registerAccount, me } = await registerAndFetchMe({
      email: 'social@fitvo.dev',
      name: 'Maria Civil',
      socialName: 'Lia',
    });
    expect(registerAccount).toMatchObject({ name: 'Maria Civil', displayName: 'Lia' });
    expect(me).toMatchObject({ name: 'Maria Civil', displayName: 'Lia' });
  });

  it('sem nome social: displayName = name civil', async () => {
    const { registerAccount, me } = await registerAndFetchMe({
      email: 'sem-social@fitvo.dev',
      name: 'Joao Civil',
      socialName: undefined,
    });
    expect(registerAccount.displayName).toBe('Joao Civil');
    expect(me.displayName).toBe('Joao Civil');
    expect(me.name).toBe('Joao Civil');
  });
});
