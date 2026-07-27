import { randomUUID } from 'node:crypto';

import type {
  AuthEmailSender,
  AuthService as AuthCore,
  AuthTokens,
  PasswordHasher,
  VerificationTokenStore,
} from '@fitvo/auth';
import type { DocumentType } from '@fitvo/database';

import {
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  InvalidVerificationTokenError,
  UnauthorizedError,
} from '../../shared/http-errors';
import type { AccountRecord, AccountRepository, TermsAcceptanceOrigin } from './account-repository';

export interface AuthResult {
  account: { id: string; email: string; name: string };
  tokens: AuthTokens;
}

export interface MeResult {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export interface RegisterProfessionalInput {
  email: string;
  password: string;
  name: string;
  document: string;
  documentType: DocumentType;
  tenantName: string;
  /**
   * Aceite dos termos (D-025). O Zod ja garante `true` para os dois
   * documentos na borda HTTP (`acceptedTerms`); aqui so a ORIGEM da
   * requisicao (IP/UA, capturados na rota — nunca informados pelo cliente)
   * necessaria para escrever os eventos ACCEPTED na mesma transacao da conta.
   */
  termsAcceptance: TermsAcceptanceOrigin;
}

/** TTLs dos tokens de uso unico enviados por e-mail (segundos). */
export interface AuthTtlConfig {
  emailVerificationTtlSeconds: number;
  passwordResetTtlSeconds: number;
}

/**
 * Servico de aplicacao da autenticacao (vertical slice). Orquestra repositorio
 * de identidade, hashing, o core de auth (@fitvo/auth), os tokens de
 * verificacao/recuperacao e o envio de e-mail (stub nesta fase).
 */
export class AuthApplicationService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly hasher: PasswordHasher,
    private readonly authCore: AuthCore,
    private readonly verificationTokens: VerificationTokenStore,
    private readonly emailSender: AuthEmailSender,
    private readonly ttl: AuthTtlConfig,
  ) {}

  async registerProfessional(input: RegisterProfessionalInput): Promise<AuthResult> {
    await this.ensureEmailIsFree(input.email);
    const passwordHash = await this.hasher.hash(input.password);
    const account = await this.accounts.createProfessional({
      email: input.email,
      passwordHash,
      name: input.name,
      document: input.document,
      documentType: input.documentType,
      tenantName: input.tenantName,
      termsAcceptance: input.termsAcceptance,
    });
    return this.completeRegistration(account);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const account = await this.accounts.findByEmail(email);
    if (!account) {
      throw new InvalidCredentialsError();
    }
    const matches = await this.hasher.verify(account.passwordHash, password);
    if (!matches) {
      throw new InvalidCredentialsError();
    }
    return this.startSession(account);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const result = await this.authCore.rotateRefreshToken(refreshToken);
    return result.tokens;
  }

  async logout(accessToken: string): Promise<void> {
    const payload = await this.authCore.verifyAccessToken(accessToken);
    await this.authCore.revokeSession(payload.sessionId);
  }

  /** Conta autenticada a partir do access token (Bearer). */
  async getMe(accessToken: string): Promise<MeResult> {
    const payload = await this.authCore.verifyAccessToken(accessToken);
    const account = await this.accounts.findById(payload.sub);
    if (!account) {
      throw new UnauthorizedError('Conta nao encontrada.');
    }
    return {
      id: account.id,
      email: account.email,
      name: account.name,
      emailVerified: account.emailVerifiedAt !== null,
    };
  }

  /**
   * (Re)envia a verificacao de e-mail. Sempre resolve — nunca revela se o
   * e-mail existe ou ja esta verificado (D-029). Rota devolve 202.
   */
  async requestEmailVerification(email: string): Promise<void> {
    const account = await this.accounts.findByEmail(email);
    if (account && account.emailVerifiedAt === null) {
      await this.sendEmailVerification(account);
    }
  }

  /** Consome o token e marca o e-mail como verificado (D-029). */
  async verifyEmail(token: string): Promise<void> {
    const accountId = await this.verificationTokens.consume('email_verification', token);
    if (!accountId) {
      throw new InvalidVerificationTokenError();
    }
    await this.accounts.markEmailVerified(accountId);
  }

  /**
   * Inicia a recuperacao de senha. Sempre resolve (a rota devolve 202) mesmo se
   * o e-mail nao existir — nao vazar existencia de conta (D-029).
   */
  async forgotPassword(email: string): Promise<void> {
    const account = await this.accounts.findByEmail(email);
    if (account) {
      const { token } = await this.verificationTokens.issue(
        'password_reset',
        account.id,
        this.ttl.passwordResetTtlSeconds,
      );
      await this.emailSender.sendPasswordReset({ to: account.email, token });
    }
  }

  /**
   * Consome o token, redefine a senha (Argon2) e revoga TODAS as sessoes da
   * conta — qualquer refresh anterior deixa de valer (D-029).
   */
  async resetPassword(token: string, password: string): Promise<void> {
    const accountId = await this.verificationTokens.consume('password_reset', token);
    if (!accountId) {
      throw new InvalidVerificationTokenError();
    }
    const passwordHash = await this.hasher.hash(password);
    await this.accounts.updatePassword(accountId, passwordHash);
    await this.authCore.revokeAllSessions(accountId);
  }

  private async ensureEmailIsFree(email: string): Promise<void> {
    if (await this.accounts.findByEmail(email)) {
      throw new EmailAlreadyInUseError();
    }
  }

  /** Apos criar a conta: dispara a verificacao de e-mail e ja abre a sessao. */
  private async completeRegistration(account: AccountRecord): Promise<AuthResult> {
    await this.sendEmailVerification(account);
    return this.startSession(account);
  }

  private async sendEmailVerification(account: AccountRecord): Promise<void> {
    const { token } = await this.verificationTokens.issue(
      'email_verification',
      account.id,
      this.ttl.emailVerificationTtlSeconds,
    );
    await this.emailSender.sendEmailVerification({ to: account.email, token });
  }

  private async startSession(account: AccountRecord): Promise<AuthResult> {
    const sessionId = randomUUID();
    const tokens = await this.authCore.issueTokens({ accountId: account.id, sessionId });
    return {
      account: { id: account.id, email: account.email, name: account.name },
      tokens,
    };
  }
}
