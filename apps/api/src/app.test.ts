import { describe, expect, it } from 'vitest';

import { buildApp } from './app';

describe('api /health', () => {
  it('responde 200 com status ok', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', service: 'api' });

    await app.close();
  });
});
