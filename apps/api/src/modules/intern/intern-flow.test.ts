import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import { buildTestHarness, type TestHarness } from '../../testing/build-test-app';
import { validProfessionalRegistration } from '../../testing/professional-registration-fixture';

const ACADEMY_TENANT = 'academy_test_1';
const OTHER_TENANT = 'academy_test_2';

const adminPayload = {
  ...validProfessionalRegistration,
  email: 'admin-academia@fitvo.dev',
  name: 'Admin Academia',
};

/**
 * Fluxo do seat de ESTAGIÁRIO (D-142) — E2E via inject, dependências in-memory.
 *
 * O que estes testes protegem é a REGRA LEGAL: estagiário não se autocadastra e
 * nunca existe sem responsável. As garantias de BANCO (FK NOT NULL, rollback da
 * transação) vivem em `prisma-intern-repository.integration.test.ts` — aqui a
 * prova é da borda e da orquestração.
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
  harness.clinic.seedAdmin(body.account.id, ACADEMY_TENANT);
  return { accountId: body.account.id, token: body.tokens.accessToken };
}

function createInvite(
  app: FastifyInstance,
  token: string,
  payload: Record<string, unknown>,
  tenantId = ACADEMY_TENANT,
) {
  return app.inject({
    method: 'POST',
    url: `/v1/interns/${tenantId}/invites`,
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
}

function accept(app: FastifyInstance, token: string, overrides: Record<string, unknown> = {}) {
  return app.inject({
    method: 'POST',
    url: '/v1/interns/invites/accept',
    payload: {
      token,
      password: 'senha-forte-456',
      name: 'Estagiario Novo',
      document: '52998224725',
      documentType: 'CPF',
      whatsapp: '11912345678',
      birthDate: '2003-05-14',
      address: {
        cep: '01310930',
        logradouro: 'Avenida Paulista',
        numero: '1500',
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

describe('estagiário — vínculo com responsável é OBRIGATÓRIO (D-142)', () => {
  it('convite SEM responsável → 400 na borda (campo não é opcional)', async () => {
    const harness = await buildTestHarness();
    try {
      const { token } = await setupAdmin(harness);
      const res = await createInvite(harness.app, token, { email: 'sem-resp@fitvo.dev' });
      expect(res.statusCode).toBe(400);
    } finally {
      await harness.app.close();
    }
  });

  it('convite com responsável NULO explícito → 400 (não há caminho para estagiário solto)', async () => {
    const harness = await buildTestHarness();
    try {
      const { token } = await setupAdmin(harness);
      const res = await createInvite(harness.app, token, {
        email: 'resp-nulo@fitvo.dev',
        supervisorProfessionalProfileId: null,
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await harness.app.close();
    }
  });

  it('responsável de OUTRO tenant → 422 (isolamento de tenant — D-002)', async () => {
    const harness = await buildTestHarness();
    try {
      const { token } = await setupAdmin(harness);
      const alheio = harness.intern.seedSupervisor({ tenantId: OTHER_TENANT });
      const res = await createInvite(harness.app, token, {
        email: 'resp-alheio@fitvo.dev',
        supervisorProfessionalProfileId: alheio,
      });
      expect(res.statusCode).toBe(422);
    } finally {
      await harness.app.close();
    }
  });

  it('responsável inexistente → 422', async () => {
    const harness = await buildTestHarness();
    try {
      const { token } = await setupAdmin(harness);
      const res = await createInvite(harness.app, token, {
        email: 'resp-fantasma@fitvo.dev',
        supervisorProfessionalProfileId: 'pp_inexistente',
      });
      expect(res.statusCode).toBe(422);
    } finally {
      await harness.app.close();
    }
  });

  it('responsável CREF do tenant → convite criado com o vínculo gravado', async () => {
    const harness = await buildTestHarness();
    try {
      const { token } = await setupAdmin(harness);
      const supervisor = harness.intern.seedSupervisor({ tenantId: ACADEMY_TENANT });
      const res = await createInvite(harness.app, token, {
        email: 'estagiario@fitvo.dev',
        name: 'Estagiario Pre',
        supervisorProfessionalProfileId: supervisor,
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().invite).toMatchObject({
        email: 'estagiario@fitvo.dev',
        name: 'Estagiario Pre',
        status: 'PENDING',
        supervisorProfessionalProfileId: supervisor,
      });
      expect(res.json().token).toBeTruthy();
    } finally {
      await harness.app.close();
    }
  });
});

describe('estagiário — aceite (Fase B)', () => {
  it('aceite cria o seat STUDENT_INTERN com o responsável DO CONVITE', async () => {
    const harness = await buildTestHarness();
    try {
      const { token } = await setupAdmin(harness);
      const supervisor = harness.intern.seedSupervisor({ tenantId: ACADEMY_TENANT });
      const created = await createInvite(harness.app, token, {
        email: 'aceita@fitvo.dev',
        supervisorProfessionalProfileId: supervisor,
      });
      const inviteToken = created.json().token;

      const res = await accept(harness.app, inviteToken);
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({
        intern: {
          tenantId: ACADEMY_TENANT,
          seatType: 'STUDENT_INTERN',
          supervisorProfessionalProfileId: supervisor,
        },
        created: true,
      });

      // O vínculo foi PERSISTIDO, não só devolvido na resposta.
      const seats = harness.intern.listInternProfiles(ACADEMY_TENANT);
      expect(seats).toHaveLength(1);
      expect(seats[0]).toMatchObject({ supervisorProfessionalProfileId: supervisor });
    } finally {
      await harness.app.close();
    }
  });

  it('aceite de conta NOVA grava os 2 eventos de termos (D-025)', async () => {
    const harness = await buildTestHarness();
    try {
      const { token } = await setupAdmin(harness);
      const supervisor = harness.intern.seedSupervisor({ tenantId: ACADEMY_TENANT });
      const created = await createInvite(harness.app, token, {
        email: 'termos-novo@fitvo.dev',
        supervisorProfessionalProfileId: supervisor,
      });

      const res = await accept(harness.app, created.json().token);
      expect(res.statusCode).toBe(201);
      const accountId = res.json().intern.accountId;
      expect(harness.terms.listEventsForAccount(accountId, 'TERMS_OF_USE')).toHaveLength(1);
      expect(harness.terms.listEventsForAccount(accountId, 'PRIVACY_POLICY')).toHaveLength(1);
    } finally {
      await harness.app.close();
    }
  });

  it('aceite de conta EXISTENTE NÃO regrava termos (só conta nova — D-025)', async () => {
    const harness = await buildTestHarness();
    try {
      const { token } = await setupAdmin(harness);
      const supervisor = harness.intern.seedSupervisor({ tenantId: ACADEMY_TENANT });
      // Conta que já existe e já aceitou os termos no próprio cadastro (D-041).
      const existingId = 'acc_existente';
      harness.intern.seedAccount('ja-existe@fitvo.dev', existingId);

      const created = await createInvite(harness.app, token, {
        email: 'ja-existe@fitvo.dev',
        supervisorProfessionalProfileId: supervisor,
      });
      const res = await accept(harness.app, created.json().token);

      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ intern: { accountId: existingId }, created: false });
      // NENHUM evento novo: a conta existente já consentiu no próprio cadastro.
      expect(harness.terms.listEventsForAccount(existingId, 'TERMS_OF_USE')).toHaveLength(0);
      expect(harness.terms.listEventsForAccount(existingId, 'PRIVACY_POLICY')).toHaveLength(0);
    } finally {
      await harness.app.close();
    }
  });

  it('aceite SEM aceitar os termos → 400 (a conta não nasce sem consentimento)', async () => {
    const harness = await buildTestHarness();
    try {
      const { token } = await setupAdmin(harness);
      const supervisor = harness.intern.seedSupervisor({ tenantId: ACADEMY_TENANT });
      const created = await createInvite(harness.app, token, {
        email: 'sem-termos@fitvo.dev',
        supervisorProfessionalProfileId: supervisor,
      });

      const res = await accept(harness.app, created.json().token, {
        acceptedTerms: { termsOfUse: false, privacyPolicy: true },
      });
      expect(res.statusCode).toBe(400);
      expect(harness.intern.listInternProfiles()).toHaveLength(0);
    } finally {
      await harness.app.close();
    }
  });

  it('token inválido → convite recusado e nenhum seat criado', async () => {
    const harness = await buildTestHarness();
    try {
      const res = await accept(harness.app, 'token-que-nao-existe');
      // 400 é a convenção de `InvalidInviteTokenError`. Assertar SÓ o status
      // seria fraco: um payload inválido também dá 400 (a validação do Fastify
      // roda antes do handler), então o teste continuaria verde mesmo se o
      // caminho do token sumisse. O `type` do problema é o que prova QUAL 400.
      expect(res.statusCode).toBe(400);
      expect(res.json().type).toBe('https://fitvo.dev/problems/invalid-invite');
      expect(harness.intern.listInternProfiles()).toHaveLength(0);
    } finally {
      await harness.app.close();
    }
  });

  it('mesmo token duas vezes → segundo aceite falha (uso único)', async () => {
    const harness = await buildTestHarness();
    try {
      const { token } = await setupAdmin(harness);
      const supervisor = harness.intern.seedSupervisor({ tenantId: ACADEMY_TENANT });
      const created = await createInvite(harness.app, token, {
        email: 'duplo@fitvo.dev',
        supervisorProfessionalProfileId: supervisor,
      });
      const inviteToken = created.json().token;

      expect((await accept(harness.app, inviteToken)).statusCode).toBe(201);
      const segundo = await accept(harness.app, inviteToken);
      expect(segundo.statusCode).toBe(400);
      expect(segundo.json().type).toBe('https://fitvo.dev/problems/invalid-invite');
      expect(harness.intern.listInternProfiles()).toHaveLength(1);
    } finally {
      await harness.app.close();
    }
  });
});

describe('estagiário — guards administrativos (D-013/D-002)', () => {
  it('sem Bearer → 401 (payload VÁLIDO: o que falta é só a credencial)', async () => {
    const harness = await buildTestHarness();
    try {
      const supervisor = harness.intern.seedSupervisor({ tenantId: ACADEMY_TENANT });
      const res = await harness.app.inject({
        method: 'POST',
        url: `/v1/interns/${ACADEMY_TENANT}/invites`,
        payload: {
          email: 'sem-bearer@fitvo.dev',
          supervisorProfessionalProfileId: supervisor,
        },
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await harness.app.close();
    }
  });

  it('admin de OUTRA academia → 403 (payload VÁLIDO naquele tenant)', async () => {
    const harness = await buildTestHarness();
    try {
      const { token } = await setupAdmin(harness);
      const supervisor = harness.intern.seedSupervisor({ tenantId: OTHER_TENANT });
      const res = await createInvite(
        harness.app,
        token,
        { email: 'outro-tenant@fitvo.dev', supervisorProfessionalProfileId: supervisor },
        OTHER_TENANT,
      );
      expect(res.statusCode).toBe(403);
    } finally {
      await harness.app.close();
    }
  });

  it('lista de responsáveis elegíveis é escopada ao tenant', async () => {
    const harness = await buildTestHarness();
    try {
      const { token } = await setupAdmin(harness);
      const doTenant = harness.intern.seedSupervisor({
        tenantId: ACADEMY_TENANT,
        displayName: 'Professora Ana',
      });
      harness.intern.seedSupervisor({ tenantId: OTHER_TENANT, displayName: 'De Outra Academia' });

      const res = await harness.app.inject({
        method: 'GET',
        url: `/v1/interns/${ACADEMY_TENANT}/supervisors`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const { supervisors } = res.json();
      expect(supervisors).toHaveLength(1);
      expect(supervisors[0]).toMatchObject({
        professionalProfileId: doTenant,
        displayName: 'Professora Ana',
        specialtyCode: 'TRAINING',
      });
    } finally {
      await harness.app.close();
    }
  });
});
