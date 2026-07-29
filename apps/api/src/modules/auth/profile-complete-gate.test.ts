import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import { buildTestHarness, type TestHarness } from '../../testing/build-test-app';
import { validClinicRegistration } from '../../testing/clinic-registration-fixture';
import { validPatientAcceptBody } from '../../testing/patient-account-fixture';
import { validProfessionalRegistration } from '../../testing/professional-registration-fixture';
import { deriveProfileComplete } from './account-repository';

/**
 * Gate de completar-perfil (spec §5) — E2E.
 *
 * A regra é sobre **DADO**, não sobre papel: `profileComplete` é derivado no
 * servidor a partir das colunas, e "quem vê o gate" é CONSEQUÊNCIA do que cada
 * fluxo de criação coleta. Estes testes exercem exatamente isso — cada fluxo
 * real, do jeito que a produção o cria, e o valor que ele produz.
 */

const COMPANY_TENANT = 'company_gate_1';

function me(app: FastifyInstance, token: string) {
  return app.inject({
    method: 'GET',
    url: '/v1/auth/me',
    headers: { authorization: `Bearer ${token}` },
  });
}

function completeProfile(app: FastifyInstance, token: string, body: Record<string, unknown>) {
  return app.inject({
    method: 'PATCH',
    url: '/v1/auth/me/complete-profile',
    headers: { authorization: `Bearer ${token}` },
    payload: body,
  });
}

const FULL_ADDRESS = {
  cep: '01310100',
  logradouro: 'Avenida Paulista',
  numero: '900',
  bairro: 'Bela Vista',
  cidade: 'Sao Paulo',
  state: 'SP',
  country: 'BR',
};

/** Cria o admin da empresa e o torna CLINIC_ADMIN do tenant de teste. */
async function setupCompanyAdmin(
  harness: TestHarness,
): Promise<{ accountId: string; token: string }> {
  const res = await harness.app.inject({
    method: 'POST',
    url: '/v1/auth/register/professional',
    payload: { ...validProfessionalRegistration, email: 'admin-gate@fitvo.dev' },
  });
  const body = res.json();
  await harness.accounts.markEmailVerified(body.account.id);
  harness.clinic.seedAdmin(body.account.id, COMPANY_TENANT);
  return { accountId: body.account.id, token: body.tokens.accessToken };
}

describe('deriveProfileComplete — a conta, isolada', () => {
  const COMPLETE = { birthDate: new Date('1990-01-01T00:00:00Z'), whatsapp: '11987654321' };

  it('completo com o MINIMO FUNCIONAL: nascimento + WhatsApp (D-157)', () => {
    expect(deriveProfileComplete(COMPLETE)).toBe(true);
  });

  it.each([
    ['birthDate', 'birthDate'],
    ['whatsapp', 'whatsapp'],
  ])('incompleto se faltar %s', (_label, field) => {
    expect(deriveProfileComplete({ ...COMPLETE, [field]: null })).toBe(false);
  });
});

describe('gate de completar-perfil — quem nasce completo (spec §5)', () => {
  it('AUTONOMO entra completo: coleta nascimento/WhatsApp/endereco no cadastro', async () => {
    const harness = await buildTestHarness();
    const res = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: { ...validProfessionalRegistration, email: 'autonomo-gate@fitvo.dev' },
    });
    expect(res.statusCode).toBe(201);

    const profile = await me(harness.app, res.json().tokens.accessToken);
    expect(profile.statusCode).toBe(200);
    expect(profile.json().profileComplete).toBe(true);

    await harness.app.close();
  });

  it('PACIENTE entra completo: o aceite passou a coletar a pessoa inteira (spec §4.6)', async () => {
    const harness = await buildTestHarness();
    const pro = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: { ...validProfessionalRegistration, email: 'pro-pac-gate@fitvo.dev' },
    });
    const proBody = pro.json();
    await harness.accounts.markEmailVerified(proBody.account.id);
    harness.patient.seedProfessional({
      accountId: proBody.account.id,
      tenantId: COMPANY_TENANT,
      specialtyIds: ['spec_gate'],
    });

    const invited = await harness.app.inject({
      method: 'POST',
      url: `/v1/patients/${COMPANY_TENANT}/invites`,
      headers: { authorization: `Bearer ${proBody.tokens.accessToken}` },
      payload: { email: 'paciente-gate@fitvo.dev', specialtyId: 'spec_gate', modality: 'ONLINE' },
    });
    const accepted = await harness.app.inject({
      method: 'POST',
      url: '/v1/patients/invites/accept',
      payload: { ...validPatientAcceptBody, token: invited.json().token },
    });
    expect(accepted.statusCode).toBe(201);

    // A conta do paciente nasce completa — é o que sustenta a promessa da spec
    // §5 de que paciente NUNCA vê o gate. Antes de o aceite coletar esses
    // campos, essa promessa não tinha como se cumprir.
    const login = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'paciente-gate@fitvo.dev', password: validPatientAcceptBody.password },
    });
    expect(login.statusCode).toBe(200);
    const profile = await me(harness.app, login.json().tokens.accessToken);
    expect(profile.json().profileComplete).toBe(true);

    await harness.app.close();
  });

  it('RECEPCAO entra completa: o aceite coleta os tres (D-156, spec §4.5)', async () => {
    const harness = await buildTestHarness();
    const admin = await setupCompanyAdmin(harness);

    const invited = await harness.app.inject({
      method: 'POST',
      url: `/v1/reception/${COMPANY_TENANT}/invites`,
      headers: { authorization: `Bearer ${admin.token}` },
      payload: { email: 'recepcao-gate@fitvo.dev' },
    });
    const accepted = await harness.app.inject({
      method: 'POST',
      url: '/v1/reception/invites/accept',
      payload: {
        token: invited.json().token,
        password: 'senha-forte-456',
        name: 'Recepcao Gate',
        document: '52998224725',
        documentType: 'CPF',
        whatsapp: '11988887777',
        birthDate: '1995-04-10',
        address: FULL_ADDRESS,
        acceptedTerms: { termsOfUse: true, privacyPolicy: true },
      },
    });
    expect(accepted.statusCode).toBe(201);

    const login = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'recepcao-gate@fitvo.dev', password: 'senha-forte-456' },
    });
    expect((await me(harness.app, login.json().tokens.accessToken)).json().profileComplete).toBe(
      true,
    );

    await harness.app.close();
  });
});

describe('gate de completar-perfil — quem cai no gate (spec §5)', () => {
  /**
   * O público que a spec §5 descreve: pré-cadastrado por terceiro com dados
   * faltando. O aceite de clínica (#102) coleta senha/nome/documento e mais
   * nada — logo a conta nasce sem nascimento, WhatsApp nem endereço.
   */
  async function acceptClinicInvite(harness: TestHarness): Promise<string> {
    const admin = await setupCompanyAdmin(harness);
    const invited = await harness.app.inject({
      method: 'POST',
      url: `/v1/clinic/${COMPANY_TENANT}/invites`,
      headers: { authorization: `Bearer ${admin.token}` },
      payload: {
        email: 'pro-clinica-gate@fitvo.dev',
        specialtyCode: 'TRAINING',
        councilDocument: 'CREF-999999',
        councilState: 'SP',
      },
    });
    expect(invited.statusCode).toBe(201);
    const accepted = await harness.app.inject({
      method: 'POST',
      url: '/v1/clinic/invites/accept',
      payload: {
        token: invited.json().token,
        password: 'senha-forte-456',
        name: 'Pro Clinica',
        document: '52998224725',
        documentType: 'CPF',
        acceptedTerms: { termsOfUse: true, privacyPolicy: true },
      },
    });
    expect(accepted.statusCode).toBe(201);

    const login = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'pro-clinica-gate@fitvo.dev', password: 'senha-forte-456' },
    });
    expect(login.statusCode).toBe(200);
    return login.json().tokens.accessToken;
  }

  it('PROFISSIONAL DE CLINICA nasce incompleto -> profileComplete=false', async () => {
    const harness = await buildTestHarness();
    const token = await acceptClinicInvite(harness);
    expect((await me(harness.app, token)).json().profileComplete).toBe(false);
    await harness.app.close();
  });

  it('completar tudo de uma vez destrava o gate e devolve o /me ja recalculado', async () => {
    const harness = await buildTestHarness();
    const token = await acceptClinicInvite(harness);

    const completed = await completeProfile(harness.app, token, {
      whatsapp: '11912345678',
      birthDate: '1988-07-30',
    });
    expect(completed.statusCode).toBe(200);
    // A propria resposta do PATCH ja traz o valor novo — sem segundo round-trip.
    expect(completed.json().profileComplete).toBe(true);
    // E o /me concorda: a derivacao e uma so.
    expect((await me(harness.app, token)).json().profileComplete).toBe(true);

    await harness.app.close();
  });

  it('completar PARCIALMENTE nao destrava — e nao zera o que ja foi enviado', async () => {
    const harness = await buildTestHarness();
    const token = await acceptClinicInvite(harness);

    // So o WhatsApp: ainda falta o nascimento.
    const first = await completeProfile(harness.app, token, { whatsapp: '11912345678' });
    expect(first.statusCode).toBe(200);
    expect(first.json().profileComplete).toBe(false);

    // So o nascimento: o WhatsApp anterior NAO pode ter sido zerado por omissao
    // — seria um jeito silencioso de DESCOMPLETAR pelo endpoint que existe para
    // completar. Se tivesse sumido, isto daria false.
    const second = await completeProfile(harness.app, token, { birthDate: '1988-07-30' });
    expect(second.json().profileComplete).toBe(true);

    await harness.app.close();
  });

  it('e IDEMPOTENTE: reenviar os mesmos valores mantem completo', async () => {
    const harness = await buildTestHarness();
    const token = await acceptClinicInvite(harness);
    const body = { whatsapp: '11912345678', birthDate: '1988-07-30' };

    expect((await completeProfile(harness.app, token, body)).json().profileComplete).toBe(true);
    expect((await completeProfile(harness.app, token, body)).json().profileComplete).toBe(true);

    await harness.app.close();
  });

  it('valida com o MESMO rigor do cadastro — nao ha versao relaxada', async () => {
    const harness = await buildTestHarness();
    const token = await acceptClinicInvite(harness);

    // WhatsApp mascarado (o fio leva so digitos — spec §3).
    expect(
      (await completeProfile(harness.app, token, { whatsapp: '(11) 91234-5678' })).statusCode,
    ).toBe(400);
    // Menor de idade continua barrado (D-044).
    expect(
      (await completeProfile(harness.app, token, { birthDate: '2020-01-01' })).statusCode,
    ).toBe(400);
    // Data fora do formato de calendario.
    expect(
      (await completeProfile(harness.app, token, { birthDate: '30/07/1988' })).statusCode,
    ).toBe(400);

    await harness.app.close();
  });

  it('exige autenticacao: ninguem completa o perfil de outra pessoa', async () => {
    const harness = await buildTestHarness();
    const semToken = await harness.app.inject({
      method: 'PATCH',
      url: '/v1/auth/me/complete-profile',
      payload: { whatsapp: '11912345678' },
    });
    expect(semToken.statusCode).toBe(401);
    await harness.app.close();
  });

  it('NAO regrava termos nem altera documento/e-mail (D-025 — identidade nao e "dado faltando")', async () => {
    const harness = await buildTestHarness();
    const token = await acceptClinicInvite(harness);
    const before = (await me(harness.app, token)).json();
    const eventsBefore = harness.terms.listEventsForAccount(before.id, 'TERMS_OF_USE').length;

    const completed = await completeProfile(harness.app, token, {
      whatsapp: '11912345678',
      birthDate: '1988-07-30',
      // Campos que o schema NAO aceita — ignorados, nunca aplicados.
      email: 'outro@fitvo.dev',
      document: '11222333000181',
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().email).toBe(before.email);
    expect(harness.terms.listEventsForAccount(before.id, 'TERMS_OF_USE')).toHaveLength(
      eventsBefore,
    );

    await harness.app.close();
  });
});

describe('gate de completar-perfil — o ADMIN DE EMPRESA (por que endereço saiu do mínimo)', () => {
  /**
   * O admin gestor **não tem endereço pessoal**: o endereço do cadastro de
   * empresa é o do ESTABELECIMENTO (spec §4.2, item 6) e vai para o `Tenant` —
   * decisão já tomada em #108.
   *
   * É exatamente por isso que endereço **saiu do mínimo funcional** (D-157):
   * mantê-lo faria o admin nascer incompleto e cair num gate que a spec §5 diz
   * que ele NUNCA vê, ou obrigaria a contradizer o #108 para satisfazer a
   * derivação. Com o mínimo em nascimento + WhatsApp, que ele informa, o
   * comportamento e a spec voltam a concordar.
   *
   * Este teste é a trava dessa decisão: se alguém reintroduzir endereço na
   * derivação, ele fica vermelho.
   */
  it('admin de empresa nasce COMPLETO — informa nascimento e WhatsApp (spec §5)', async () => {
    const harness = await buildTestHarness();
    const res = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/register/clinic',
      payload: { ...validClinicRegistration, email: 'admin-empresa-gate@fitvo.dev' },
    });
    expect(res.statusCode).toBe(201);

    const login = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'admin-empresa-gate@fitvo.dev',
        password: validClinicRegistration.password,
      },
    });
    const profile = await me(harness.app, login.json().tokens.accessToken);

    // Nascimento e WhatsApp ele tem; endereço pessoal, não — e não precisa.
    expect(profile.json().profileComplete).toBe(true);

    await harness.app.close();
  });
});
