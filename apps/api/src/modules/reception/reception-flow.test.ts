import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import { buildTestHarness, type TestHarness } from '../../testing/build-test-app';
import { validProfessionalRegistration } from '../../testing/professional-registration-fixture';

const COMPANY_TENANT = 'company_test_1';

const adminPayload = {
  ...validProfessionalRegistration,
  email: 'admin@fitvo.dev',
  name: 'Admin Empresa',
};

/**
 * Registra o admin (via auth), o torna CLINIC_ADMIN do tenant de teste e marca
 * o e-mail como verificado (D-029) — convidar exige o gate.
 */
async function setupAdmin(harness: TestHarness): Promise<{ accountId: string; token: string }> {
  const res = await harness.app.inject({
    method: 'POST',
    url: '/v1/auth/register/professional',
    payload: adminPayload,
  });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  await harness.accounts.markEmailVerified(body.account.id);
  harness.clinic.seedAdmin(body.account.id, COMPANY_TENANT);
  return { accountId: body.account.id, token: body.tokens.accessToken };
}

function createInvite(
  app: FastifyInstance,
  token: string,
  email: string,
  overrides: Record<string, unknown> = {},
) {
  return app.inject({
    method: 'POST',
    url: `/v1/reception/${COMPANY_TENANT}/invites`,
    headers: { authorization: `Bearer ${token}` },
    payload: { email, ...overrides },
  });
}

/**
 * Aceite COMPLETO (spec §4.5): senha, nome, documento com DV, WhatsApp,
 * nascimento e endereco inteiro. E o que faz o seat nascer sem pendencia no
 * gate de completar-perfil (spec §5).
 */
function accept(app: FastifyInstance, token: string, overrides: Record<string, unknown> = {}) {
  return app.inject({
    method: 'POST',
    url: '/v1/reception/invites/accept',
    payload: {
      token,
      password: 'senha-forte-456',
      name: 'Nova Recepcionista',
      document: '52998224725',
      documentType: 'CPF',
      whatsapp: '11988887777',
      birthDate: '1995-04-10',
      address: {
        cep: '01310100',
        logradouro: 'Avenida Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
        cidade: 'Sao Paulo',
        state: 'SP',
        country: 'BR',
      },
      acceptedTerms: { termsOfUse: true, privacyPolicy: true },
      ...overrides,
    },
  });
}

describe('fluxo de recepcao — seat administrativo por convite (D-156)', () => {
  it('admin convida, recepcionista aceita e o seat nasce no tenant do convite', async () => {
    const harness = await buildTestHarness();
    const admin = await setupAdmin(harness);

    const invited = await createInvite(harness.app, admin.token, 'recepcao@fitvo.dev', {
      name: 'Maria',
    });
    expect(invited.statusCode).toBe(201);
    const { invite, token } = invited.json();
    expect(invite).toMatchObject({ email: 'recepcao@fitvo.dev', name: 'Maria', status: 'PENDING' });
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const accepted = await accept(harness.app, token);
    expect(accepted.statusCode).toBe(201);
    expect(accepted.json()).toMatchObject({
      created: true,
      // O tenant vem DO CONVITE — nunca do corpo do aceite.
      reception: { tenantId: COMPANY_TENANT, seatType: 'RECEPTION' },
    });

    const seats = harness.reception.listReceptionProfiles(COMPANY_TENANT);
    expect(seats).toHaveLength(1);
    expect(seats[0]).toMatchObject({ tenantId: COMPANY_TENANT });

    await harness.app.close();
  });

  it('o seat NAO carrega conselho, especialidade nem supervisor (nao atende)', async () => {
    const harness = await buildTestHarness();
    const admin = await setupAdmin(harness);
    const { token } = (await createInvite(harness.app, admin.token, 'r2@fitvo.dev')).json();

    const accepted = await accept(harness.app, token);
    expect(accepted.statusCode).toBe(201);

    // Nao sao campos "vazios": sao campos que NAO EXISTEM neste seat. Se um
    // refactor futuro os introduzir, este teste acusa — recepcao nao atende, e
    // representar conselho/especialidade sugeriria capacidade clinica.
    const seat = harness.reception.listReceptionProfiles()[0];
    expect(seat).toBeDefined();
    expect(seat).not.toHaveProperty('area');
    expect(seat).not.toHaveProperty('supervisorProfessionalProfileId');
    expect(seat).not.toHaveProperty('councilDocument');
    expect(seat).not.toHaveProperty('specialtyCode');
    expect(Object.keys(seat as object).sort()).toEqual(['accountId', 'id', 'tenantId']);

    await harness.app.close();
  });

  it('recusa no aceite os campos que recepcao nao tem (conselho/especialidade/area)', async () => {
    const harness = await buildTestHarness();
    const admin = await setupAdmin(harness);

    // O convite tambem nao aceita nada disso: a Fase A e so e-mail + nome.
    const withCouncil = await createInvite(harness.app, admin.token, 'r3@fitvo.dev', {
      specialtyCode: 'TRAINING',
      councilDocument: 'CREF-1',
    });
    // Campos desconhecidos sao ignorados pelo Zod (nao-strict), mas nao podem
    // VIRAR dado: o convite criado nao os carrega.
    expect(withCouncil.statusCode).toBe(201);
    expect(withCouncil.json().invite).not.toHaveProperty('specialtyCode');
    expect(withCouncil.json().invite).not.toHaveProperty('councilDocument');
    expect(withCouncil.json().invite).not.toHaveProperty('area');

    await harness.app.close();
  });

  it('grava o aceite dos termos SO no ramo de conta nova (D-025)', async () => {
    const harness = await buildTestHarness();
    const admin = await setupAdmin(harness);
    const { token } = (await createInvite(harness.app, admin.token, 'termos@fitvo.dev')).json();

    const accepted = await accept(harness.app, token);
    expect(accepted.statusCode).toBe(201);
    expect(accepted.json().created).toBe(true);

    // Um evento ACCEPTED por documento obrigatorio (D-025) — os DOIS, na mesma
    // transacao do nascimento da conta.
    const { accountId } = accepted.json().reception;
    expect(harness.terms.listEventsForAccount(accountId, 'TERMS_OF_USE')).toHaveLength(1);
    expect(harness.terms.listEventsForAccount(accountId, 'PRIVACY_POLICY')).toHaveLength(1);

    await harness.app.close();
  });

  it('conta JA existente (multi-papel — D-041): cria so o seat, sem regravar termos', async () => {
    const harness = await buildTestHarness();
    const admin = await setupAdmin(harness);
    const { token } = (await createInvite(harness.app, admin.token, 'jaexiste@fitvo.dev')).json();

    // A conta ja nasceu por outro caminho e ja aceitou os termos la.
    harness.reception.seedAccount('jaexiste@fitvo.dev', 'acc_ja_existente');

    const accepted = await accept(harness.app, token);
    expect(accepted.statusCode).toBe(201);
    expect(accepted.json()).toMatchObject({
      created: false,
      reception: { accountId: 'acc_ja_existente', tenantId: COMPANY_TENANT },
    });

    // NADA de termos regravado — quem ja aceitou nao reaceita (D-025). A conta
    // semeada nao tem evento nenhum neste repositorio, e continua sem.
    expect(harness.terms.listEventsForAccount('acc_ja_existente', 'TERMS_OF_USE')).toHaveLength(0);
    expect(harness.terms.listEventsForAccount('acc_ja_existente', 'PRIVACY_POLICY')).toHaveLength(
      0,
    );
    expect(harness.reception.listReceptionProfiles()).toHaveLength(1);

    await harness.app.close();
  });

  it('recusa segundo seat de recepcao na mesma conta (409 — 1:1)', async () => {
    const harness = await buildTestHarness();
    const admin = await setupAdmin(harness);

    const first = (await createInvite(harness.app, admin.token, 'dupla@fitvo.dev')).json();
    expect((await accept(harness.app, first.token)).statusCode).toBe(201);

    const second = (await createInvite(harness.app, admin.token, 'dupla@fitvo.dev')).json();
    const conflict = await accept(harness.app, second.token);
    expect(conflict.statusCode).toBe(409);
    expect(conflict.headers['content-type']).toContain('application/problem+json');

    await harness.app.close();
  });

  it('SO o CLINIC_ADMIN do tenant convida (403) e sem token e 401', async () => {
    const harness = await buildTestHarness();
    await setupAdmin(harness);

    // Conta registrada, mas SEM membership de admin no tenant alvo.
    const outsider = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: { ...adminPayload, email: 'outro@fitvo.dev' },
    });
    const forbidden = await createInvite(
      harness.app,
      outsider.json().tokens.accessToken,
      'r@fitvo.dev',
    );
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.headers['content-type']).toContain('application/problem+json');

    const unauthorized = await harness.app.inject({
      method: 'POST',
      url: `/v1/reception/${COMPANY_TENANT}/invites`,
      payload: { email: 'r@fitvo.dev' },
    });
    expect(unauthorized.statusCode).toBe(401);

    await harness.app.close();
  });

  it('isolamento de tenant: admin de uma empresa nao convida para outra (D-002)', async () => {
    const harness = await buildTestHarness();
    const admin = await setupAdmin(harness);

    const otherTenant = await harness.app.inject({
      method: 'POST',
      url: '/v1/reception/outra_empresa/invites',
      headers: { authorization: `Bearer ${admin.token}` },
      payload: { email: 'r@fitvo.dev' },
    });
    expect(otherTenant.statusCode).toBe(403);

    await harness.app.close();
  });

  it('token invalido/expirado nao cria nada', async () => {
    const harness = await buildTestHarness();
    const invalid = await accept(harness.app, 'token-que-nao-existe');
    expect(invalid.statusCode).toBe(400);
    expect(harness.reception.listReceptionProfiles()).toHaveLength(0);
    await harness.app.close();
  });

  /**
   * Cada caso monta a PROPRIA app: o aceite tem rate limit de 5/minuto (o
   * hashing Argon2 custa por chamada), e reusar uma instancia faria o 6o caso
   * responder 429 — um verde/vermelho que falaria do limitador, nao da
   * validacao sob teste.
   */
  async function acceptStatus(overrides: Record<string, unknown>): Promise<number> {
    const harness = await buildTestHarness();
    try {
      const admin = await setupAdmin(harness);
      const { token } = (await createInvite(harness.app, admin.token, 'v@fitvo.dev')).json();
      return (await accept(harness.app, token, overrides)).statusCode;
    } finally {
      await harness.app.close();
    }
  }

  it('recusa documento com DV invalido (D-043 — a peca compartilhada de #113)', async () => {
    expect(await acceptStatus({ document: '52998224724' })).toBe(400);
    expect(await acceptStatus({ document: '11111111111' })).toBe(400);
  });

  it('recusa senha fraca (min 8 + letra + numero — spec §3)', async () => {
    expect(await acceptStatus({ password: 'curta1' })).toBe(400);
    expect(await acceptStatus({ password: 'somenteletras' })).toBe(400);
  });

  it('recusa termos parciais ou ausentes (D-025 — literal(true) x2)', async () => {
    expect(await acceptStatus({ acceptedTerms: { termsOfUse: true } })).toBe(400);
    expect(await acceptStatus({ acceptedTerms: { termsOfUse: true, privacyPolicy: false } })).toBe(
      400,
    );
    expect(await acceptStatus({ acceptedTerms: undefined })).toBe(400);
  });

  it('exige os campos COMPLETOS — sao eles que evitam o gate depois (spec §4.5/§5)', async () => {
    expect(await acceptStatus({ birthDate: undefined })).toBe(400);
    expect(await acceptStatus({ whatsapp: undefined })).toBe(400);
    expect(await acceptStatus({ address: undefined })).toBe(400);
  });
});
