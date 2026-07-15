import { randomUUID } from 'node:crypto';

import type { AuthService as AuthCore, AuthTokens, PasswordHasher } from '@fitvo/auth';
import type { DocumentType } from '@fitvo/database';

import { EmailAlreadyInUseError, InvalidCredentialsError } from '../../shared/http-errors';
import type { AccountRecord, AccountRepository } from './account-repository';

export interface AuthResult {
  account: { id: string; email: string; name: string };
  tokens: AuthTokens;
}

export interface RegisterProfessionalInput {
  email: string;
  password: string;
  name: string;
  document: string;
  documentType: DocumentType;
  tenantName: string;
}

export interface RegisterPatientInput {
  email: string;
  password: string;
  name: string;
  document: string;
}

/**
 * Servico de aplicacao da autenticacao (vertical slice). Orquestra repositorio
 * de identidade, hashing e o core de auth (@fitvo/auth).
 */
export class AuthApplicationService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly hasher: PasswordHasher,
    private readonly authCore: AuthCore,
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
    });
    return this.startSession(account);
  }

  async registerPatient(input: RegisterPatientInput): Promise<AuthResult> {
    await this.ensureEmailIsFree(input.email);
    const passwordHash = await this.hasher.hash(input.password);
    const account = await this.accounts.createPatient({
      email: input.email,
      passwordHash,
      name: input.name,
      document: input.document,
    });
    return this.startSession(account);
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

  private async ensureEmailIsFree(email: string): Promise<void> {
    if (await this.accounts.findByEmail(email)) {
      throw new EmailAlreadyInUseError();
    }
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
