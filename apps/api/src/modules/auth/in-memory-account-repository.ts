import type {
  AccountRecord,
  AccountRepository,
  CreatePatientInput,
  CreateProfessionalInput,
} from './account-repository';

/** Implementacao em memoria para testes e desenvolvimento local. */
export class InMemoryAccountRepository implements AccountRepository {
  private readonly byEmail = new Map<string, AccountRecord>();
  private sequence = 0;

  findByEmail(email: string): Promise<AccountRecord | null> {
    return Promise.resolve(this.byEmail.get(email) ?? null);
  }

  createProfessional(input: CreateProfessionalInput): Promise<AccountRecord> {
    return this.insert(input.email, input.passwordHash, input.name);
  }

  createPatient(input: CreatePatientInput): Promise<AccountRecord> {
    return this.insert(input.email, input.passwordHash, input.name);
  }

  private insert(email: string, passwordHash: string, name: string): Promise<AccountRecord> {
    this.sequence += 1;
    const account: AccountRecord = { id: `acc_${this.sequence}`, email, passwordHash, name };
    this.byEmail.set(email, account);
    return Promise.resolve(account);
  }
}
