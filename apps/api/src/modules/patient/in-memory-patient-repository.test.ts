import type { CareModality } from '@fitvo/database';
import { describe, expect, it } from 'vitest';

import { hashInviteToken } from '../../shared/invite-token';
import { InMemoryPatientRepository } from './in-memory-patient-repository';
import type { CreatePatientInviteInput, NewPatientAccount } from './patient-repository';

const TENANT = 'tenant_a';
const OTHER_TENANT = 'tenant_b';
const SPECIALTY = 'spec_training';

const NEW_ACCOUNT: NewPatientAccount = {
  passwordHash: 'hash',
  name: 'Paciente',
  document: '12345678901',
};

const ORIGIN = { ipAddress: '127.0.0.1', userAgent: 'vitest' };

function arrangeProfessional(repo: InMemoryPatientRepository): string {
  return repo.seedProfessional({
    accountId: 'acc_pro',
    tenantId: TENANT,
    specialtyIds: [SPECIALTY],
  });
}

function inviteFor(
  professionalProfileId: string,
  email: string,
  tokenHash: string,
  ttlMs = 60_000,
  modality: CareModality = 'ONLINE',
): CreatePatientInviteInput {
  return {
    tenantId: TENANT,
    professionalProfileId,
    specialtyId: SPECIALTY,
    email,
    modality,
    tokenHash,
    expiresAt: new Date(Date.now() + ttlMs),
  };
}

describe('InMemoryPatientRepository', () => {
  it('reconhece o profissional do tenant, o catalogo e a reivindicacao de especialidade', async () => {
    const repo = new InMemoryPatientRepository();
    const proId = arrangeProfessional(repo);

    expect(await repo.findProfessional('acc_pro', TENANT)).toEqual({
      professionalProfileId: proId,
    });
    expect(await repo.findProfessional('acc_pro', OTHER_TENANT)).toBeNull();
    expect(await repo.findProfessional('acc_estranho', TENANT)).toBeNull();
    expect(await repo.specialtyExists(SPECIALTY)).toBe(true);
    expect(await repo.specialtyExists('spec_inexistente')).toBe(false);
    expect(await repo.professionalHasSpecialty(proId, SPECIALTY)).toBe(true);
    expect(await repo.professionalHasSpecialty(proId, 'spec_outra')).toBe(false);
  });

  it('revoga apenas convites pendentes do proprio profissional/tenant', async () => {
    const repo = new InMemoryPatientRepository();
    const proId = arrangeProfessional(repo);
    const invite = await repo.createInvite(inviteFor(proId, 'p@fitvo.dev', hashInviteToken('t1')));

    // Tenant errado nao revoga (isolamento — D-002).
    expect(await repo.revokeInvite(OTHER_TENANT, proId, invite.id)).toBe(false);
    // Outro profissional nao revoga.
    expect(await repo.revokeInvite(TENANT, 'pp_outro', invite.id)).toBe(false);
    expect(await repo.revokeInvite(TENANT, proId, invite.id)).toBe(true);
    // Revogar de novo e no-op.
    expect(await repo.revokeInvite(TENANT, proId, invite.id)).toBe(false);
    expect(await repo.listPendingInvites(TENANT, proId)).toHaveLength(0);
  });

  it('reenvio rotaciona o token e estende a validade na mesma linha (D-055)', async () => {
    const repo = new InMemoryPatientRepository();
    const proId = arrangeProfessional(repo);
    const invite = await repo.createInvite(
      inviteFor(proId, 'p@fitvo.dev', hashInviteToken('velho')),
    );

    const newExpires = new Date(Date.now() + 120_000);
    const updated = await repo.resendInvite(
      TENANT,
      proId,
      invite.id,
      hashInviteToken('novo'),
      newExpires,
    );
    expect(updated?.id).toBe(invite.id);
    expect(updated?.expiresAt).toEqual(newExpires);

    // Token antigo ja nao aceita; o novo sim.
    expect((await repo.acceptInvite(hashInviteToken('velho'), NEW_ACCOUNT, ORIGIN)).status).toBe(
      'invalid',
    );
    expect((await repo.acceptInvite(hashInviteToken('novo'), NEW_ACCOUNT, ORIGIN)).status).toBe(
      'accepted',
    );
  });

  it('aceita uma unica vez e abre um vinculo ativo (segundo aceite invalido)', async () => {
    const repo = new InMemoryPatientRepository();
    const proId = arrangeProfessional(repo);
    await repo.createInvite(inviteFor(proId, 'novo@fitvo.dev', hashInviteToken('t2')));

    const first = await repo.acceptInvite(hashInviteToken('t2'), NEW_ACCOUNT, ORIGIN);
    expect(first.status).toBe('accepted');
    const second = await repo.acceptInvite(hashInviteToken('t2'), NEW_ACCOUNT, ORIGIN);
    expect(second.status).toBe('invalid');

    const bonds = await repo.listActiveBonds(TENANT, proId);
    expect(bonds).toHaveLength(1);
    expect(bonds[0]).toMatchObject({ patientEmail: 'novo@fitvo.dev', specialtyId: SPECIALTY });
  });

  it('rejeita convite expirado', async () => {
    const repo = new InMemoryPatientRepository();
    const proId = arrangeProfessional(repo);
    await repo.createInvite(inviteFor(proId, 'exp@fitvo.dev', hashInviteToken('t3'), -1_000));
    expect((await repo.acceptInvite(hashInviteToken('t3'), NEW_ACCOUNT, ORIGIN)).status).toBe(
      'invalid',
    );
  });

  it('anexa perfil a conta existente sem perfil (multi-papel) e conflita se a tripla ja tem vinculo', async () => {
    const repo = new InMemoryPatientRepository();
    const proId = arrangeProfessional(repo);
    repo.seedPatientAccount({ email: 'multi@fitvo.dev', name: 'Multi Papel' });

    await repo.createInvite(inviteFor(proId, 'multi@fitvo.dev', hashInviteToken('t4')));
    const attach = await repo.acceptInvite(hashInviteToken('t4'), NEW_ACCOUNT, ORIGIN);
    expect(attach).toMatchObject({ status: 'accepted', created: false });

    // Novo convite a mesma tripla: agora ja existe vinculo -> conflito.
    await repo.createInvite(inviteFor(proId, 'multi@fitvo.dev', hashInviteToken('t5')));
    expect((await repo.acceptInvite(hashInviteToken('t5'), NEW_ACCOUNT, ORIGIN)).status).toBe(
      'bond-conflict',
    );
  });

  it('arquiva um vinculo ativo e o retira da listagem (D-053)', async () => {
    const repo = new InMemoryPatientRepository();
    const proId = arrangeProfessional(repo);
    await repo.createInvite(inviteFor(proId, 'arq@fitvo.dev', hashInviteToken('t6')));
    const accepted = await repo.acceptInvite(hashInviteToken('t6'), NEW_ACCOUNT, ORIGIN);
    const bondId = accepted.status === 'accepted' ? accepted.bondId : '';

    // Escopo errado nao arquiva.
    expect(await repo.archiveBond(OTHER_TENANT, proId, bondId)).toBe(false);
    expect(await repo.archiveBond(TENANT, proId, bondId)).toBe(true);
    // Arquivar de novo e no-op.
    expect(await repo.archiveBond(TENANT, proId, bondId)).toBe(false);
    expect(await repo.listActiveBonds(TENANT, proId)).toHaveLength(0);
  });
});
