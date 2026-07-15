import { describe, expect, it } from 'vitest';

import { DefaultAuthService } from './auth-service';
import { JwtTokenService } from './jwt-service';
import { InMemoryRefreshTokenStore } from './refresh-token-store';

function makeService(): DefaultAuthService {
  const jwt = new JwtTokenService({
    accessSecret: 'access-secret-testes-1234567890',
    refreshSecret: 'refresh-secret-testes-1234567890',
    accessTtlSeconds: 900,
    refreshTtlSeconds: 3600,
    issuer: 'fitvo-test',
  });
  return new DefaultAuthService(jwt, new InMemoryRefreshTokenStore(), 3600);
}

describe('DefaultAuthService', () => {
  it('emite tokens e rotaciona o refresh', async () => {
    const auth = makeService();
    const tokens = await auth.issueTokens({ accountId: 'acc_1', sessionId: 'sess_1' });

    const payload = await auth.verifyAccessToken(tokens.accessToken);
    expect(payload.sub).toBe('acc_1');

    const rotated = await auth.rotateRefreshToken(tokens.refreshToken);
    expect(rotated.tokens.refreshToken).not.toBe(tokens.refreshToken);
  });

  it('detecta reuso de refresh antigo e revoga a familia', async () => {
    const auth = makeService();
    const tokens = await auth.issueTokens({ accountId: 'acc_1', sessionId: 'sess_1' });

    // rotaciona uma vez — o refresh original passa a ser invalido
    const rotated = await auth.rotateRefreshToken(tokens.refreshToken);

    // reusar o refresh ORIGINAL agora e reuso -> familia revogada
    await expect(auth.rotateRefreshToken(tokens.refreshToken)).rejects.toMatchObject({
      code: 'REFRESH_REUSE_DETECTED',
    });

    // e o refresh novo tambem para de funcionar (familia revogada)
    await expect(auth.rotateRefreshToken(rotated.tokens.refreshToken)).rejects.toMatchObject({
      code: 'SESSION_REVOKED',
    });
  });

  it('bloqueia rotacao apos revogar a sessao (logout)', async () => {
    const auth = makeService();
    const tokens = await auth.issueTokens({ accountId: 'acc_1', sessionId: 'sess_2' });

    await auth.revokeSession('sess_2');

    await expect(auth.rotateRefreshToken(tokens.refreshToken)).rejects.toMatchObject({
      code: 'SESSION_REVOKED',
    });
  });

  it('revoga todas as sessoes da conta (troca de senha)', async () => {
    const auth = makeService();
    const first = await auth.issueTokens({ accountId: 'acc_9', sessionId: 'sess_a' });
    const second = await auth.issueTokens({ accountId: 'acc_9', sessionId: 'sess_b' });
    // outra conta nao pode ser afetada
    const other = await auth.issueTokens({ accountId: 'acc_10', sessionId: 'sess_c' });

    await auth.revokeAllSessions('acc_9');

    await expect(auth.rotateRefreshToken(first.refreshToken)).rejects.toMatchObject({
      code: 'SESSION_REVOKED',
    });
    await expect(auth.rotateRefreshToken(second.refreshToken)).rejects.toMatchObject({
      code: 'SESSION_REVOKED',
    });
    // a sessao de outra conta segue ativa
    const rotated = await auth.rotateRefreshToken(other.refreshToken);
    expect(rotated.tokens.refreshToken).toBeTruthy();
  });
});
