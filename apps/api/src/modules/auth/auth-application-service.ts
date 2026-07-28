import { randomUUID } from 'node:crypto';

import type {
  AuthEmailSender,
  AuthService as AuthCore,
  AuthTokens,
  PasswordHasher,
  VerificationTokenStore,
} from '@fitvo/auth';
import type { BrazilianState, DocumentType } from '@fitvo/database';

import {
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  InvalidVerificationTokenError,
  NotFoundError,
  UnauthorizedError,
} from '../../shared/http-errors';
import type {
  AccountRecord,
  AccountRepository,
  AddressInput,
  TermsAcceptanceOrigin,
} from './account-repository';

/**
 * Guard minimo: a especialidade reivindicada no signup (D-137) precisa
 * existir no catalogo (D-047). Interface estreita (nao o repositorio inteiro
 * de `specialty`) — mesmo padrao de `EmailVerificationLookup`/
 * `TermsAcceptanceLookup` (shared/auth-context.ts) para dependencias
 * cross-slice.
 */
export interface SpecialtyLookup {
  exists(specialtyId: string): Promise<boolean>;
}

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
  /** WhatsApp — só dígitos (11), normalizado no contrato (D-044). */
  whatsapp: string;
  /** Data de nascimento `YYYY-MM-DD` no fio (maioridade já garantida — D-044). */
  birthDate: string;
  /** Endereço da pessoa (D-044) — bloco. */
  address: AddressInput;
  /** Especialidade reivindicada no signup (D-137 — ADR-0015). */
  specialtyId: string;
  /** Registro no conselho — validado so em formato pelo Zod (D-138). */
  councilDocument: string;
  councilState: BrazilianState;
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
    private readonly specialties: SpecialtyLookup,
  ) {}

  async registerProfessional(input: RegisterProfessionalInput): Promise<AuthResult> {
    await this.ensureEmailIsFree(input.email);
    await this.ensureSpecialtyExists(input.specialtyId);
    const passwordHash = await this.hasher.hash(input.password);
    const account = await this.accounts.createProfessional({
      email: input.email,
      passwordHash,
      name: input.name,
      document: input.document,
      documentType: input.documentType,
      whatsapp: input.whatsapp,
      // `YYYY-MM-DD` (calendário) → Date. UTC midnight, sem hora: o schema já
      // validou o formato e a maioridade; aqui só a conversão para o boundary
      // Prisma (@db.Date). O tenant SOLO herda o NOME do profissional (não há
      // mais campo tenantName — ADR-0015).
      birthDate: new Date(`${input.birthDate}T00:00:00Z`),
      address: input.address,
      specialtyId: input.specialtyId,
      councilDocument: input.councilDocument,
      councilState: input.councilState,
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

  /**
   * Guard previo a abrir a transacao (D-137): specialtyId inexistente vira um
   * 404 limpo aqui, em vez de estourar a violacao de FK do banco la dentro da
   * transacao. A atomicidade (rollback se a specialty falhar mesmo assim)
   * continua garantida no repositorio — este guard so evita o caminho feio.
   */
  private async ensureSpecialtyExists(specialtyId: string): Promise<void> {
    if (!(await this.specialties.exists(specialtyId))) {
      throw new NotFoundError('Especialidade nao encontrada.');
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
