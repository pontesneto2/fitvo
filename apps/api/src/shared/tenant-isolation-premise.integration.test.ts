import { randomUUID } from 'node:crypto';

import { prisma } from '@fitvo/database';
import { describe, expect, it } from 'vitest';

import { buildRealTestApp } from '../testing/build-real-app';
import { validClinicRegistration } from '../testing/clinic-registration-fixture';
import { validProfessionalRegistration } from '../testing/professional-registration-fixture';

/**
 * Integracao end-to-end — pipeline HTTP REAL (Postgres + Redis reais, hook de
 * contexto de tenant do Slice 1 + Prisma Client extension do Slice 2, D-151).
 *
 * PREMISSA Nº1 (documentada em tenant-context-hook.ts e no tenant-isolation-
 * extension.ts): o `tenantId` do contexto vem do path — controlado pelo
 * cliente — e o contexto e aberto ANTES da validacao accountId<->tenant (que
 * roda depois, no service). Isto e inofensivo SE E SOMENTE SE essa validacao
 * de pertencimento continuar rodando e barrando ANTES de qualquer query
 * sensivel — a extension NAO substitui essa validacao, so filtra o que ela ja
 * deixou passar. Este teste prova exatamente isso pelo pipeline real: um
 * profissional autenticado tentando ler o tenant de OUTRO profissional (via
 * :tenantId no path) recebe 403 — nunca 200 com dado do tenant errado.
 */
describe('tenant isolation — premissa nº1 (pipeline HTTP real)', () => {
  it(':tenantId de um tenant ao qual o accountId NAO pertence nunca retorna dado desse tenant (403 antes da query)', async () => {
    const app = await buildRealTestApp();
    const suffix = randomUUID().slice(0, 8);

    const registerA = await app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: { ...validProfessionalRegistration, email: `premissa-a-${suffix}@fitvo.dev` },
    });
    expect(registerA.statusCode).toBe(201);
    const tokenA = registerA.json().tokens.accessToken as string;

    const emailA = `premissa-a-${suffix}@fitvo.dev`;
    const emailB = `premissa-b-${suffix}@fitvo.dev`;

    const registerB = await app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: { ...validProfessionalRegistration, email: emailB },
    });
    expect(registerB.statusCode).toBe(201);

    // O response de registro DELIBERADAMENTE nao expoe tenantId (D-044 —
    // Account e a PESSOA, nao o papel/tenant). Busca direta via Prisma (fora
    // de qualquer contexto de tenant — setup de teste, nao pipeline) so pra
    // montar o cenario; a asserção real é sobre a resposta HTTP abaixo.
    const profileA = await prisma.professionalProfile.findFirstOrThrow({
      where: { account: { email: emailA } },
    });
    const profileB = await prisma.professionalProfile.findFirstOrThrow({
      where: { account: { email: emailB } },
    });
    const tenantIdB = profileB.tenantId;

    // Profissional A (autenticado, token valido) tenta ler o overview do
    // tenant de B (path controlado pelo cliente). A extension (Slice 2) ate
    // abriria contexto com tenantIdB — mas o guard `requireProfessional`
    // (accountId de A nao tem perfil no tenant de B) tem que barrar ANTES.
    const crossTenantRead = await app.inject({
      method: 'GET',
      url: `/v1/patients/${tenantIdB}/overview`,
      headers: { authorization: `Bearer ${tokenA}` },
    });

    expect(crossTenantRead.statusCode).toBe(403);
    // Nunca deve ter chegado nem perto de devolver um shape de overview (com
    // pendingInvites/activeBonds) — 403 e RFC 7807, nao um 200 mascarado.
    expect(crossTenantRead.json()).not.toHaveProperty('pendingInvites');
    expect(crossTenantRead.json()).not.toHaveProperty('activeBonds');

    // Controle: o MESMO profissional A, no PROPRIO tenant, funciona normalmente.
    const ownTenantRead = await app.inject({
      method: 'GET',
      url: `/v1/patients/${profileA.tenantId}/overview`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(ownTenantRead.statusCode).toBe(200);

    await app.close();
  });

  it('fluxo-excecao (aceite de convite, sem contexto de tenant aberto) escreve no tenant do CONVITE, nao em qualquer outro', async () => {
    const app = await buildRealTestApp();
    const suffix = randomUUID().slice(0, 8);

    const registerClinic = await app.inject({
      method: 'POST',
      url: '/v1/auth/register/clinic',
      payload: { ...validClinicRegistration, email: `clinic-admin-${suffix}@fitvo.dev` },
    });
    expect(registerClinic.statusCode).toBe(201);
    const { account, tokens } = registerClinic.json();

    // Convidar exige e-mail verificado (D-029) — sem hook de e-mail real neste
    // teste, marca direto via Prisma (fora de contexto — setup, nao pipeline).
    await prisma.account.update({
      where: { id: account.id },
      data: { emailVerifiedAt: new Date() },
    });
    const membership = await prisma.clinicMembership.findFirstOrThrow({
      where: { accountId: account.id },
    });
    const clinicTenantId = membership.tenantId;

    const inviteEmail = `convidado-${suffix}@fitvo.dev`;
    const createInvite = await app.inject({
      method: 'POST',
      url: `/v1/clinic/${clinicTenantId}/invites`,
      headers: { authorization: `Bearer ${tokens.accessToken}` },
      payload: {
        email: inviteEmail,
        specialtyCode: 'TRAINING',
        councilDocument: 'CREF-555555',
        councilState: 'SP',
      },
    });
    expect(createInvite.statusCode).toBe(201);
    const inviteToken = createInvite.json().token as string;

    // Aceite: rota PUBLICA, sem header Authorization — o hook do Slice 1 nao
    // abre NENHUM contexto de tenant aqui (confirma o mapeamento do slice 1).
    const accept = await app.inject({
      method: 'POST',
      url: '/v1/clinic/invites/accept',
      payload: {
        token: inviteToken,
        password: 'senha-forte-456',
        name: 'Novo Profissional',
        document: '98765432100',
        documentType: 'CPF',
        acceptedTerms: { termsOfUse: true, privacyPolicy: true },
      },
    });
    expect(accept.statusCode).toBe(201);

    const acceptedProfile = await prisma.professionalProfile.findFirstOrThrow({
      where: { account: { email: inviteEmail } },
    });
    // O tenant vem do CONVITE (lido dentro da transacao de aceite), nao de
    // qualquer contexto ambiente — que nem existia nesta chamada.
    expect(acceptedProfile.tenantId).toBe(clinicTenantId);

    await app.close();
  });
});
