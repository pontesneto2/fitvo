import { describe, expect, it } from 'vitest';

import { buildTestHarness } from '../../testing/build-test-app';

describe('catalogo de especialidades (D-047)', () => {
  it('GET /v1/specialties e publico e lista o catalogo fixo semeado', async () => {
    const harness = await buildTestHarness();

    const response = await harness.app.inject({ method: 'GET', url: '/v1/specialties' });
    expect(response.statusCode).toBe(200);
    const { specialties } = response.json();
    expect(specialties).toHaveLength(4);
    expect(specialties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'spec_training', code: 'TRAINING', name: 'Treino' }),
        expect.objectContaining({ id: 'spec_nutrition', code: 'NUTRITION', name: 'Nutricao' }),
        expect.objectContaining({ id: 'spec_medicine', code: 'MEDICINE', name: 'Medicina' }),
        expect.objectContaining({
          id: 'spec_personal_trainer',
          code: 'PERSONAL_TRAINER',
          name: 'Personal Trainer',
        }),
      ]),
    );

    await harness.app.close();
  });
});
