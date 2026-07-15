import type {
  AccountRecord,
  AccountRepository,
  CreatePatientInput,
  CreateProfessionalInput,
} from './account-repository';

/** Implementacao em memoria para testes e desenvolvimento local. */
export class InMemoryAccountRepository implements AccountRepository {
  private readonly byId = new Map<string, AccountRecord>();
  private readonly emailToId = new Map<string, string>();
  private sequence = 0;

  findByEmail(email: string): Promise<AccountRecord | null> {
    const id = this.emailToId.get(email);
    return Promise.resolve((id && this.byId.get(id)) || null);
  }

  findById(id: string): Promise<AccountRecord | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }

  createProfessional(input: CreateProfessionalInput): Promise<AccountRecord> {
    return this.insert(input.email, input.passwordHash, input.name);
  }

  createPatient(input: CreatePatientInput): Promise<AccountRecord> {
    return this.insert(input.email, input.passwordHash, input.name);
  }

  markEmailVerified(id: string): Promise<void> {
    const account = this.byId.get(id);
    if (account) {
      account.emailVerifiedAt = new Date();
    }
    return Promise.resolve();
  }

  updatePassword(id: string, passwordHash: string): Promise<void> {
    const account = this.byId.get(id);
    if (account) {
      account.passwordHash = passwordHash;
    }
    return Promise.resolve();
  }

  private insert(email: string, passwordHash: string, name: string): Promise<AccountRecord> {
    this.sequence += 1;
    const account: AccountRecord = {
      id: `acc_${this.sequence}`,
      email,
      passwordHash,
      name,
      emailVerifiedAt: null,
    };
    this.byId.set(account.id, account);
    this.emailToId.set(email, account.id);
    return Promise.resolve(account);
  }
}
