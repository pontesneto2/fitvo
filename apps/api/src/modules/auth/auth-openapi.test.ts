import { describe, expect, it } from 'vitest';

import { buildTestApp } from '../../testing/build-test-app';

describe('OpenAPI das rotas de auth (D-032)', () => {
  it('documenta as rotas e o esquema de seguranca Bearer', async () => {
    const app = await buildTestApp();
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(response.statusCode).toBe(200);

    const spec = response.json();
    expect(spec.paths['/v1/auth/login']?.post?.tags).toContain('auth');
    expect(spec.paths['/v1/auth/verify-email']).toBeTruthy();
    expect(spec.paths['/v1/auth/forgot-password']).toBeTruthy();
    expect(spec.paths['/v1/auth/reset-password']).toBeTruthy();
    expect(spec.paths['/v1/auth/me']?.get?.security).toEqual([{ bearerAuth: [] }]);
    expect(spec.components.securitySchemes.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });

    await app.close();
  });

  it('valida o corpo pelo schema e devolve RFC 7807 (400) com erros', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: { token: 'x' }, // falta `password`
    });
    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json().errors).toBeTruthy();

    await app.close();
  });
});
