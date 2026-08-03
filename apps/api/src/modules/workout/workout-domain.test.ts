import { describe, expect, it } from 'vitest';

import {
  PlanOrganizationMismatchError,
  SupersetSetCountMismatchError,
} from '../../shared/http-errors';
import {
  assertSupersetGroupsComplete,
  assertSupersetSetCounts,
  deriveValidUntil,
  planAppliesOnWeekday,
  planCountsTowardAdherence,
  resolveWorkoutSlot,
} from './workout-domain';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('D-105 — plano fixo x aderencia', () => {
  it('plano VARIAVEL conta na aderencia', () => {
    expect(planCountsTowardAdherence({ isFixed: false })).toBe(true);
  });

  it('plano FIXO NAO conta na aderencia — alongamento nao infla o indicador de quem nao treinou', () => {
    expect(planCountsTowardAdherence({ isFixed: true })).toBe(false);
  });

  it('plano fixo sem dias escolhidos vale TODO DIA', () => {
    const plan = { isFixed: true, fixedWeekdays: [] };
    expect(planAppliesOnWeekday(plan, 'MONDAY')).toBe(true);
    expect(planAppliesOnWeekday(plan, 'SUNDAY')).toBe(true);
  });

  it('plano fixo com dias escolhidos vale so neles', () => {
    const plan = { isFixed: true, fixedWeekdays: ['MONDAY' as const, 'WEDNESDAY' as const] };
    expect(planAppliesOnWeekday(plan, 'MONDAY')).toBe(true);
    expect(planAppliesOnWeekday(plan, 'TUESDAY')).toBe(false);
  });

  it('plano variavel nao responde por dia — quem carrega o dia la e o TREINO (D-080)', () => {
    expect(planAppliesOnWeekday({ isFixed: false, fixedWeekdays: [] }, 'MONDAY')).toBe(false);
  });
});

describe('D-083 — derivacao da validade', () => {
  it('sem liberacao programada, conta do instante de referencia', () => {
    const referenceAt = new Date('2026-08-03T12:00:00.000Z');
    expect(deriveValidUntil({ validityDays: 30, releaseAt: null, referenceAt }).toISOString()).toBe(
      new Date(referenceAt.getTime() + 30 * DAY_MS).toISOString(),
    );
  });

  it('com liberacao programada, conta do releaseAt — plano futuro nao nasce vencido (D-084)', () => {
    const referenceAt = new Date('2026-08-03T12:00:00.000Z');
    const releaseAt = new Date('2026-10-01T12:00:00.000Z');
    const validUntil = deriveValidUntil({ validityDays: 30, releaseAt, referenceAt });
    expect(validUntil.toISOString()).toBe(
      new Date(releaseAt.getTime() + 30 * DAY_MS).toISOString(),
    );
    expect(validUntil.getTime()).toBeGreaterThan(referenceAt.getTime());
  });

  it('validade configuravel: 45 dias produz 45 dias, nao o padrao de 30', () => {
    const referenceAt = new Date('2026-08-03T00:00:00.000Z');
    const validUntil = deriveValidUntil({ validityDays: 45, releaseAt: null, referenceAt });
    expect((validUntil.getTime() - referenceAt.getTime()) / DAY_MS).toBe(45);
  });
});

describe('D-080 — coerencia entre organizacao do plano e slot do treino', () => {
  it('LETTER aceita label e zera weekday', () => {
    expect(resolveWorkoutSlot({ organization: 'LETTER', label: 'A', weekday: null })).toEqual({
      label: 'A',
      weekday: null,
    });
  });

  it('WEEKDAY aceita weekday e zera label', () => {
    expect(
      resolveWorkoutSlot({ organization: 'WEEKDAY', label: null, weekday: 'TUESDAY' }),
    ).toEqual({ label: null, weekday: 'TUESDAY' });
  });

  it('LETTER com weekday e recusado — o treino ficaria invisivel na organizacao do plano', () => {
    expect(() =>
      resolveWorkoutSlot({ organization: 'LETTER', label: 'A', weekday: 'MONDAY' }),
    ).toThrow(PlanOrganizationMismatchError);
  });

  it('LETTER sem label e recusado', () => {
    expect(() =>
      resolveWorkoutSlot({ organization: 'LETTER', label: null, weekday: null }),
    ).toThrow(PlanOrganizationMismatchError);
  });

  it('WEEKDAY com label e recusado', () => {
    expect(() =>
      resolveWorkoutSlot({ organization: 'WEEKDAY', label: 'A', weekday: 'MONDAY' }),
    ).toThrow(PlanOrganizationMismatchError);
  });

  it('WEEKDAY sem weekday e recusado', () => {
    expect(() =>
      resolveWorkoutSlot({ organization: 'WEEKDAY', label: null, weekday: null }),
    ).toThrow(PlanOrganizationMismatchError);
  });
});

describe('D-082 — invariante do conjugado', () => {
  it('bi-set com a mesma contagem de series passa', () => {
    expect(() =>
      assertSupersetSetCounts([
        { id: 'a', supersetGroup: 1, setCount: 3 },
        { id: 'b', supersetGroup: 1, setCount: 3 },
      ]),
    ).not.toThrow();
  });

  it('bi-set com contagens diferentes e recusado — a rodada 3 nao existiria para um dos itens', () => {
    expect(() =>
      assertSupersetSetCounts([
        { id: 'a', supersetGroup: 1, setCount: 3 },
        { id: 'b', supersetGroup: 1, setCount: 2 },
      ]),
    ).toThrow(SupersetSetCountMismatchError);
  });

  it('itens SOLTOS podem ter contagens diferentes entre si', () => {
    expect(() =>
      assertSupersetSetCounts([
        { id: 'a', supersetGroup: null, setCount: 4 },
        { id: 'b', supersetGroup: null, setCount: 2 },
      ]),
    ).not.toThrow();
  });

  it('grupos DIFERENTES nao se comparam', () => {
    expect(() =>
      assertSupersetSetCounts([
        { id: 'a', supersetGroup: 1, setCount: 3 },
        { id: 'b', supersetGroup: 1, setCount: 3 },
        { id: 'c', supersetGroup: 2, setCount: 5 },
        { id: 'd', supersetGroup: 2, setCount: 5 },
      ]),
    ).not.toThrow();
  });

  it('item ainda VAZIO no grupo e tolerado durante a montagem', () => {
    expect(() =>
      assertSupersetSetCounts([
        { id: 'a', supersetGroup: 1, setCount: 3 },
        { id: 'b', supersetGroup: 1, setCount: 0 },
      ]),
    ).not.toThrow();
  });

  it('mas o item vazio e barrado na LIBERACAO — circuito incompleto nao e executavel', () => {
    expect(() =>
      assertSupersetGroupsComplete([
        { id: 'a', supersetGroup: 1, setCount: 3 },
        { id: 'b', supersetGroup: 1, setCount: 0 },
      ]),
    ).toThrow(SupersetSetCountMismatchError);
  });

  it('tri-set completo e coerente passa na liberacao', () => {
    expect(() =>
      assertSupersetGroupsComplete([
        { id: 'a', supersetGroup: 7, setCount: 3 },
        { id: 'b', supersetGroup: 7, setCount: 3 },
        { id: 'c', supersetGroup: 7, setCount: 3 },
      ]),
    ).not.toThrow();
  });
});
