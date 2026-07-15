import { describe, expect, it } from 'vitest';

import { JwtTokenService } from './jwt-service';
import type { JwtServiceConfig } from './types';
import { AuthError } from './types';

const config: JwtServiceConfig = {
  accessSecret: 'access-secret-para-testes-1234567890',
  refreshSecret: 'refresh-secret-para-testes-1234567890',
  accessTtlSeconds: 900,
  refreshTtlSeconds: 2_592_000,
  issuer: 'fitvo-test',
};

describe('JwtTokenService', () => {
  const jwt = new JwtTokenService(config);

  it('assina e verifica um access token', async () => {
    const { token } = await jwt.signAccessToken({ accountId: 'acc_1', sessionId: 'sess_1' });
    const payload = await jwt.verifyAccessToken(token);
    expect(payload.sub).toBe('acc_1');
    expect(payload.sessionId).toBe('sess_1');
  });

  it('rejeita access token assinado com outro segredo', async () => {
    const other = new JwtTokenService({
      ...config,
      accessSecret: 'outro-segredo-completamente-diferente',
    });
    const { token } = await other.signAccessToken({ accountId: 'acc_1', sessionId: 'sess_1' });
    await expect(jwt.verifyAccessToken(token)).rejects.toBeInstanceOf(AuthError);
  });

  it('detecta token expirado', async () => {
    const expiring = new JwtTokenService({ ...config, accessTtlSeconds: -10 });
    const { token } = await expiring.signAccessToken({ accountId: 'acc_1', sessionId: 'sess_1' });
    await expect(jwt.verifyAccessToken(token)).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
  });

  it('assina e verifica um refresh token com jti', async () => {
    const jti = jwt.newJti();
    const { token } = await jwt.signRefreshToken({
      accountId: 'acc_1',
      sessionId: 'sess_1',
      jti,
    });
    const claims = await jwt.verifyRefreshToken(token);
    expect(claims).toMatchObject({ sub: 'acc_1', sessionId: 'sess_1', jti });
  });
});
