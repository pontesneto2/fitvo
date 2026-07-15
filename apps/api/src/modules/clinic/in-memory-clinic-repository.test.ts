import { describe, expect, it } from 'vitest';

import type { NewProfessionalAccount } from './clinic-repository';
import { InMemoryClinicRepository } from './in-memory-clinic-repository';
import { hashInviteToken } from './invite-token';

const TENANT = 'clinic_a';
const OTHER_TENANT = 'clinic_b';

const NEW_ACCOUNT: NewProfessionalAccount = {
  passwordHash: 'hash',
  name: 'Profissional',
  document: '12345678901',
  documentType: 'CPF',
};

function inviteFor(tenantId: string, email: string, tokenHash: string, ttlMs = 60_000) {
  return { tenantId, email, tokenHash, expiresAt: new Date(Date.now() + ttlMs) };
}

describe('InMemoryClinicRepository', () => {
  it('reconhece admin semeado e nega nao-membros', async () => {
    const repo = new InMemoryClinicRepository();
    repo.seedAdmin('acc_admin', TENANT);
    expect(await repo.findMembership('acc_admin', TENANT)).toEqual({ role: 'CLINIC_ADMIN' });
    expect(await repo.findMembership('acc_admin', OTHER_TENANT)).toBeNull();
    expect(await repo.findMembership('acc_estranho', TENANT)).toBeNull();
  });

  it('revoga apenas convites pendentes do proprio tenant', async () => {
    const repo = new InMemoryClinicRepository();
    const invite = await repo.createInvite(inviteFor(TENANT, 'p@fitvo.dev', hashInviteToken('t1')));

    // Tenant errado nao consegue revogar (isolamento — D-002).
    expect(await repo.revokeInvite(OTHER_TENANT, invite.id)).toBe(false);
    // Tenant correto revoga.
    expect(await repo.revokeInvite(TENANT, invite.id)).toBe(true);
    // Revogar de novo (nao mais PENDING) e no-op.
    expect(await repo.revokeInvite(TENANT, invite.id)).toBe(false);
    expect(await repo.listPendingInvites(TENANT)).toHaveLength(0);
  });

  it('aceita uma unica vez (segundo aceite com o mesmo token e invalido)', async () => {
    const repo = new InMemoryClinicRepository();
    const raw = 't2';
    await repo.createInvite(inviteFor(TENANT, 'novo@fitvo.dev', hashInviteToken(raw)));

    const first = await repo.acceptInvite(hashInviteToken(raw), NEW_ACCOUNT);
    expect(first.status).toBe('accepted');
    const second = await repo.acceptInvite(hashInviteToken(raw), NEW_ACCOUNT);
    expect(second.status).toBe('invalid');

    const professionals = await repo.listProfessionals(TENANT);
    expect(professionals).toHaveLength(1);
    expect(professionals[0]?.email).toBe('novo@fitvo.dev');
  });

  it('rejeita convite expirado', async () => {
    const repo = new InMemoryClinicRepository();
    const raw = 't3';
    await repo.createInvite(inviteFor(TENANT, 'exp@fitvo.dev', hashInviteToken(raw), -1_000));
    expect((await repo.acceptInvite(hashInviteToken(raw), NEW_ACCOUNT)).status).toBe('invalid');
  });

  it('vincula perfil a conta existente sem perfil (multi-papel) e conflita se ja tem', async () => {
    const repo = new InMemoryClinicRepository();
    repo.seedAccount({ email: 'multi@fitvo.dev', name: 'Multi Papel' });

    const raw = 't4';
    await repo.createInvite(inviteFor(TENANT, 'multi@fitvo.dev', hashInviteToken(raw)));
    const attach = await repo.acceptInvite(hashInviteToken(raw), NEW_ACCOUNT);
    expect(attach).toMatchObject({ status: 'accepted', created: false });

    // Novo convite ao mesmo e-mail: agora a conta ja tem perfil -> conflito.
    const raw2 = 't5';
    await repo.createInvite(inviteFor(TENANT, 'multi@fitvo.dev', hashInviteToken(raw2)));
    expect((await repo.acceptInvite(hashInviteToken(raw2), NEW_ACCOUNT)).status).toBe('conflict');
  });
});
