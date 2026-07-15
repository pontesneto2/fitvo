import { describe, expect, it, vi } from 'vitest';

import { LoggingAuthEmailSender } from './auth-email-sender';

describe('LoggingAuthEmailSender', () => {
  it('registra o token na verificacao de e-mail', async () => {
    const info = vi.fn();
    const sender = new LoggingAuthEmailSender({ info });

    await sender.sendEmailVerification({ to: 'ana@fitvo.dev', token: 'tok-123' });

    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ana@fitvo.dev', token: 'tok-123' }),
      expect.any(String),
    );
  });

  it('registra o token na recuperacao de senha', async () => {
    const info = vi.fn();
    const sender = new LoggingAuthEmailSender({ info });

    await sender.sendPasswordReset({ to: 'leo@fitvo.dev', token: 'tok-456' });

    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'leo@fitvo.dev', token: 'tok-456' }),
      expect.any(String),
    );
  });
});
