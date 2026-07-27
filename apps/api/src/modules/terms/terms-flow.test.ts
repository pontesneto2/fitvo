import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import { buildTestHarness, type TestHarness } from '../../testing/build-test-app';

const PRO_TENANT = 'pro_tenant_terms';
const SPECIALTY = 'spec_training';

const acceptedTerms = { termsOfUse: true, privacyPolicy: true } as const;

const proPayload = {
  email: 'pro-terms@fitvo.dev',
  password: 'senha-forte-123',
  name: 'Profissional',
  document: '12345678901',
  documentType: 'CPF',
  tenantName: 'Estudio Terms (solo)',
  acceptedTerms,
};

/**
 * Registra o profissional (via auth), semeia como profissional do tenant +
 * especialidade e marca o e-mail como verificado (D-029) — o convite (acao
 * gated usada nestes testes) exige tanto o gate de e-mail quanto o de termos.
 */
async function setupProfessional(
  harness: TestHarness,
): Promise<{ accountId: string; token: string }> {
  const res = await harness.app.inject({
    method: 'POST',
    url: '/v1/auth/register/professional',
    payload: proPayload,
  });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  await harness.accounts.markEmailVerified(body.account.id);
  harness.patient.seedProfessional({
    accountId: body.account.id,
    tenantId: PRO_TENANT,
    specialtyIds: [SPECIALTY],
  });
  return { accountId: body.account.id, token: body.tokens.accessToken };
}

/** Acao real ja gated por `requireVerifiedEmail`/`requireCurrentTermsAcceptance` (D-029/D-025). */
function createInvite(app: FastifyInstance, token: string, email: string) {
  return app.inject({
    method: 'POST',
    url: `/v1/patients/${PRO_TENANT}/invites`,
    headers: { authorization: `Bearer ${token}` },
    payload: { email, specialtyId: SPECIALTY, modality: 'ONLINE' },
  });
}

describe('aceite de termos no cadastro (D-025)', () => {
  it('cadastro sem aceitar um documento obrigatorio falha com 400 e nao cria conta', async () => {
    const harness = await buildTestHarness();

    const missingPrivacy = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: { ...proPayload, acceptedTerms: { termsOfUse: true } },
    });
    expect(missingPrivacy.statusCode).toBe(400);

    const missingBoth = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: { ...proPayload, acceptedTerms: undefined },
    });
    expect(missingBoth.statusCode).toBe(400);

    const falseValue = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: { ...proPayload, acceptedTerms: { termsOfUse: false, privacyPolicy: true } },
    });
    expect(falseValue.statusCode).toBe(400);

    // Nenhuma das tres tentativas criou conta (verificado pelo repositorio, nao so pelo status HTTP).
    expect(await harness.accounts.findByEmail(proPayload.email)).toBeNull();

    await harness.app.close();
  });

  it('aceitar so um dos dois documentos (o outro ausente) ainda falha com 400 no aceite de convite', async () => {
    const harness = await buildTestHarness();

    // Validacao de schema roda ANTES do handler (Zod, fastify-type-provider-zod):
    // nem precisa de um convite real para provar a rejeicao — o token nem chega
    // a ser resolvido. Unico caminho de nascimento de conta de paciente
    // (D-135/ADR-0015): o mesmo gate de acceptedTerms (D-025) do cadastro agora
    // vive em `patientAcceptInviteSchema`.
    const response = await harness.app.inject({
      method: 'POST',
      url: '/v1/patients/invites/accept',
      payload: {
        token: 'token-nao-importa-falha-antes-de-resolver',
        password: 'senha-forte-123',
        name: 'Paciente',
        document: '12345678901',
        acceptedTerms: { termsOfUse: true },
      },
    });
    expect(response.statusCode).toBe(400);

    await harness.app.close();
  });

  it('omitir acceptedTerms inteiramente tambem falha com 400 no aceite de convite (trava a obrigatoriedade)', async () => {
    const harness = await buildTestHarness();

    // Diferente do teste acima (parcial-presente): aqui o campo nao existe no
    // payload. Prova que `acceptedTerms` e OBRIGATORIO no schema — se um
    // refactor futuro o tornar opcional, so este teste (nao o de aceite
    // parcial) quebra para acusar a regressao.
    const response = await harness.app.inject({
      method: 'POST',
      url: '/v1/patients/invites/accept',
      payload: {
        token: 'token-nao-importa-falha-antes-de-resolver',
        password: 'senha-forte-123',
        name: 'Paciente',
        document: '12345678901',
      },
    });
    expect(response.statusCode).toBe(400);

    await harness.app.close();
  });

  it('cadastro bem sucedido registra o evento ACCEPTED inicial com os dados corretos', async () => {
    const harness = await buildTestHarness();

    const register = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: proPayload,
      headers: { 'user-agent': 'vitest-suite' },
    });
    expect(register.statusCode).toBe(201);
    const accountId = register.json().account.id as string;

    const events = harness.terms.listEventsForAccount(accountId, 'TERMS_OF_USE');
    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event.accountId).toBe(accountId);
    expect(event.type).toBe('ACCEPTED');
    expect(event.ipAddress).toBeTruthy();
    expect(event.userAgent).toBe('vitest-suite');
    expect(event.occurredAt).toBeInstanceOf(Date);

    const currentVersion = await harness.terms.findCurrentVersion('TERMS_OF_USE');
    expect(event.termsVersionId).toBe(currentVersion?.id);

    // Politica de privacidade tambem recebeu o aceite inicial (D-025).
    const privacyEvents = harness.terms.listEventsForAccount(accountId, 'PRIVACY_POLICY');
    expect(privacyEvents).toHaveLength(1);
    expect(privacyEvents[0]!.type).toBe('ACCEPTED');

    await harness.app.close();
  });
});

describe('gate de re-consentimento (D-025 — ADR-0002)', () => {
  it('versao material nova exige re-consentimento; aceitar libera; revogar volta a exigir; historico append-only', async () => {
    const harness = await buildTestHarness();
    const { token } = await setupProfessional(harness);
    const accountId = (await harness.accounts.findByEmail(proPayload.email))!.id;

    // Prova (3): guarda o evento ACCEPTED original para o teste de append-only (8).
    const originalEvent = harness.terms.listEventsForAccount(accountId, 'TERMS_OF_USE')[0]!;
    expect(originalEvent.type).toBe('ACCEPTED');

    // Sanidade: a acao gated funciona normalmente antes de qualquer mudanca.
    const before = await createInvite(harness.app, token, 'aluno1@fitvo.dev');
    expect(before.statusCode).toBe(201);

    // (4) Versao MATERIAL nova publicada depois do aceite -> exige re-consentimento.
    harness.terms.seedVersion({
      documentId: 'terms_doc_tou',
      documentSlug: 'TERMS_OF_USE',
      version: '1.1.0',
      isMaterialChange: true,
      publishedAt: new Date('2026-02-01T00:00:00Z'),
    });

    const blocked = await createInvite(harness.app, token, 'aluno2@fitvo.dev');
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().type).toBe('https://fitvo.dev/problems/reconsent-required');

    // (5) Aceitar a versao atual libera a acao de novo.
    const accept = await harness.app.inject({
      method: 'POST',
      url: '/v1/terms/accept',
      headers: { authorization: `Bearer ${token}` },
      payload: { slug: 'TERMS_OF_USE' },
    });
    expect(accept.statusCode).toBe(204);

    const afterAccept = await createInvite(harness.app, token, 'aluno3@fitvo.dev');
    expect(afterAccept.statusCode).toBe(201);

    // (6) Versao EDITORIAL (isMaterialChange: false) nao forca re-consentimento.
    harness.terms.seedVersion({
      documentId: 'terms_doc_tou',
      documentSlug: 'TERMS_OF_USE',
      version: '1.1.1',
      isMaterialChange: false,
      publishedAt: new Date('2026-03-01T00:00:00Z'),
    });
    const afterEditorial = await createInvite(harness.app, token, 'aluno4@fitvo.dev');
    expect(afterEditorial.statusCode).toBe(201);

    // (7) Revogar exige re-consentimento de novo, mesmo sem nova versao.
    const revoke = await harness.app.inject({
      method: 'POST',
      url: '/v1/terms/revoke',
      headers: { authorization: `Bearer ${token}` },
      payload: { slug: 'TERMS_OF_USE' },
    });
    expect(revoke.statusCode).toBe(204);

    const afterRevoke = await createInvite(harness.app, token, 'aluno5@fitvo.dev');
    expect(afterRevoke.statusCode).toBe(403);
    expect(afterRevoke.json().type).toBe('https://fitvo.dev/problems/reconsent-required');

    // (8) Append-only: o evento ACCEPTED ORIGINAL do cadastro nunca foi
    // atualizado/apagado — segue existindo, identico, apos todo o ciclo
    // revogar+re-aceitar acima (a re-aceitacao e a revogacao criaram linhas
    // NOVAS; nenhuma linha antiga foi tocada).
    const stillThere = harness.terms.findEventById(originalEvent.id);
    expect(stillThere).not.toBeNull();
    expect(stillThere).toEqual(originalEvent);

    // GET /v1/terms/status reflete RECONSENT_REQUIRED apos a revogacao.
    const status = await harness.app.inject({
      method: 'GET',
      url: '/v1/terms/status',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(status.statusCode).toBe(200);
    const tou = status.json().documents.find((d: { slug: string }) => d.slug === 'TERMS_OF_USE');
    expect(tou.status).toBe('RECONSENT_REQUIRED');

    await harness.app.close();
  });

  it('o gate tambem cobre PRIVACY_POLICY, independente do TERMS_OF_USE', async () => {
    const harness = await buildTestHarness();
    const { token } = await setupProfessional(harness);

    // Sanidade: a acao gated funciona normalmente antes de qualquer mudanca.
    const before = await createInvite(harness.app, token, 'aluno1@fitvo.dev');
    expect(before.statusCode).toBe(201);

    // Versao MATERIAL nova da Politica de Privacidade -> exige re-consentimento,
    // mesmo com o TERMS_OF_USE em dia (documentos sao gateados independentemente).
    harness.terms.seedVersion({
      documentId: 'terms_doc_pp',
      documentSlug: 'PRIVACY_POLICY',
      version: '1.1.0',
      isMaterialChange: true,
      publishedAt: new Date('2026-02-01T00:00:00Z'),
    });

    const blocked = await createInvite(harness.app, token, 'aluno2@fitvo.dev');
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().type).toBe('https://fitvo.dev/problems/reconsent-required');

    // Aceitar a versao atual da Politica de Privacidade libera a acao de novo.
    const accept = await harness.app.inject({
      method: 'POST',
      url: '/v1/terms/accept',
      headers: { authorization: `Bearer ${token}` },
      payload: { slug: 'PRIVACY_POLICY' },
    });
    expect(accept.statusCode).toBe(204);

    const afterAccept = await createInvite(harness.app, token, 'aluno3@fitvo.dev');
    expect(afterAccept.statusCode).toBe(201);

    await harness.app.close();
  });
});
