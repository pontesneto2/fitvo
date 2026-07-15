import type { AuthEmailMessage, AuthEmailSender } from '@fitvo/auth';

export interface CapturedEmail {
  kind: 'verification' | 'reset';
  to: string;
  token: string;
}

/** Sender falso para testes: captura os e-mails "enviados" e seus tokens. */
export class FakeAuthEmailSender implements AuthEmailSender {
  readonly sent: CapturedEmail[] = [];

  sendEmailVerification(message: AuthEmailMessage): Promise<void> {
    this.sent.push({ kind: 'verification', to: message.to, token: message.token });
    return Promise.resolve();
  }

  sendPasswordReset(message: AuthEmailMessage): Promise<void> {
    this.sent.push({ kind: 'reset', to: message.to, token: message.token });
    return Promise.resolve();
  }

  /** Ultimo token capturado de um tipo (opcionalmente filtrado por destinatario). */
  lastToken(kind: CapturedEmail['kind'], to?: string): string | undefined {
    for (let i = this.sent.length - 1; i >= 0; i -= 1) {
      const email = this.sent[i];
      if (email && email.kind === kind && (to === undefined || email.to === to)) {
        return email.token;
      }
    }
    return undefined;
  }
}
