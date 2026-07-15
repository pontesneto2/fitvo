import type { BondCreatedEvent } from '@fitvo/queue';
import { describe, expect, it } from 'vitest';

import { InMemorySharingRepository } from './in-memory-sharing-repository';
import { OverlapDetectionService } from './overlap-detection-service';

const PATIENT = 'patp_1';
const PRO_A = 'pp_aaa';
const PRO_B = 'pp_bbb';
const PRO_C = 'pp_ccc';
const SPECIALTY = 'spec_training';

function bondCreated(professionalProfileId: string): BondCreatedEvent {
  return {
    patientProfileId: PATIENT,
    professionalProfileId,
    specialtyId: SPECIALTY,
    tenantId: 'tenant_1',
  };
}

describe('OverlapDetectionService', () => {
  it('nao sugere nada quando o paciente tem apenas 1 profissional', async () => {
    const repo = new InMemorySharingRepository();
    repo.seedActiveBond(PATIENT, PRO_A);
    const service = new OverlapDetectionService(repo);

    const created = await service.handleBondCreated(bondCreated(PRO_A));

    expect(created).toHaveLength(0);
    expect(repo.created).toHaveLength(0);
  });

  it('cria uma sugestao PENDING quando surge sobreposicao (2 profissionais distintos)', async () => {
    const repo = new InMemorySharingRepository();
    repo.seedActiveBond(PATIENT, PRO_A);
    repo.seedActiveBond(PATIENT, PRO_B); // vinculo recem-aberto que disparou o evento
    const service = new OverlapDetectionService(repo);

    const created = await service.handleBondCreated(bondCreated(PRO_B));

    expect(created).toHaveLength(1);
    // Par normalizado (A<B) — ids ordenados de forma estavel.
    const [pair] = created;
    if (!pair) {
      throw new Error('esperava uma sugestao');
    }
    expect(pair.professionalAId < pair.professionalBId).toBe(true);
    expect([pair.professionalAId, pair.professionalBId].sort()).toEqual([PRO_A, PRO_B].sort());
    expect(pair.status).toBe('PENDING');
    expect(pair.specialtyId).toBe(SPECIALTY);
  });

  it('normaliza o par: (B,A) e (A,B) geram a MESMA sugestao (dedupe)', async () => {
    const repo = new InMemorySharingRepository();
    repo.seedActiveBond(PATIENT, PRO_A);
    repo.seedActiveBond(PATIENT, PRO_B);
    const service = new OverlapDetectionService(repo);

    // Evento disparado por A -> par (A,B); depois por B -> mesmo par normalizado.
    const first = await service.handleBondCreated(bondCreated(PRO_A));
    const second = await service.handleBondCreated(bondCreated(PRO_B));

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0); // dedupe: PENDING para o par ja existe
    expect(repo.created).toHaveLength(1);
  });

  it('gera uma sugestao para cada par recem-sobreposto com o novo profissional', async () => {
    const repo = new InMemorySharingRepository();
    repo.seedActiveBond(PATIENT, PRO_A);
    repo.seedActiveBond(PATIENT, PRO_B);
    repo.seedActiveBond(PATIENT, PRO_C); // C e o novo profissional
    const service = new OverlapDetectionService(repo);

    const created = await service.handleBondCreated(bondCreated(PRO_C));

    // C se sobrepoe a A e a B -> dois pares (C,A) e (C,B).
    expect(created).toHaveLength(2);
    const pairs = created
      .map((s) => [s.professionalAId, s.professionalBId].sort().join('+'))
      .sort();
    expect(pairs).toEqual(
      [[PRO_A, PRO_C].sort().join('+'), [PRO_B, PRO_C].sort().join('+')].sort(),
    );
  });

  it('nao duplica sugestao PENDING existente ao reprocessar o mesmo evento', async () => {
    const repo = new InMemorySharingRepository();
    repo.seedActiveBond(PATIENT, PRO_A);
    repo.seedActiveBond(PATIENT, PRO_B);
    const service = new OverlapDetectionService(repo);

    await service.handleBondCreated(bondCreated(PRO_B));
    const again = await service.handleBondCreated(bondCreated(PRO_B));

    expect(again).toHaveLength(0);
    expect(repo.created).toHaveLength(1);
  });
});
