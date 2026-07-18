import { describe, expect, it, vi } from 'vitest';

import { LoggingAuthEmailSender } from './auth-email-sender';

describe('LoggingAuthEmailSender', () => {
  // O check so vale se reprovar o VAZAMENTO: `toEqual` exato garante que nenhum
  // campo alem de `to` foi logado, e o `not.toContain` cobre o token embutido no
  // link. Antes estes testes provavam o oposto (que o token era logado).
  it('loga so o destinatario — NUNCA o token na verificacao de e-mail', async () => {
    const info = vi.fn();
    const sender = new LoggingAuthEmailSender({ info });

    await sender.sendEmailVerification({
      to: 'ana@fitvo.dev',
      token: 'tok-123',
      link: 'https://fitvo.dev/verify?token=tok-123',
    });

    expect(info).toHaveBeenCalledTimes(1);
    const [fields, message] = info.mock.calls[0] as [Record<string, unknown>, string];
    expect(fields).toEqual({ to: 'ana@fitvo.dev' });
    expect(JSON.stringify(fields)).not.toContain('tok-123');
    expect(message).toEqual(expect.any(String));
  });

  it('loga so o destinatario — NUNCA o token na recuperacao de senha', async () => {
    const info = vi.fn();
    const sender = new LoggingAuthEmailSender({ info });

    await sender.sendPasswordReset({
      to: 'leo@fitvo.dev',
      token: 'tok-456',
      link: 'https://fitvo.dev/reset?token=tok-456',
    });

    expect(info).toHaveBeenCalledTimes(1);
    const [fields, message] = info.mock.calls[0] as [Record<string, unknown>, string];
    expect(fields).toEqual({ to: 'leo@fitvo.dev' });
    expect(JSON.stringify(fields)).not.toContain('tok-456');
    expect(message).toEqual(expect.any(String));
  });
});
