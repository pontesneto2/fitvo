import type { BrazilianState, DocumentType, Gender, MedicalSpecialty } from '@fitvo/database';

/** Projecao minima da conta usada pela autenticacao. */
export interface AccountRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  /**
   * Nome social (spec §3.1); null = sem nome social. Projetado aqui para o
   * servidor derivar o `displayName` (`socialName ?? name`) — ver
   * `deriveDisplayName`.
   */
  socialName: string | null;
  /** Momento da verificacao de e-mail (UTC); null enquanto nao verificado (D-029). */
  emailVerifiedAt: Date | null;
}

/**
 * Nome de EXIBIÇÃO (spec §3.1) — FONTE ÚNICA da derivação: nome social quando
 * preenchido, senão o nome civil. Centraliza a regra para que nenhuma
 * superfície (web/mobile/admin) reimplemente e acabe vazando o nome civil de
 * quem pediu nome social. O `name` civil segue intacto para tenant.name/fiscal.
 */
export function deriveDisplayName(account: { name: string; socialName: string | null }): string {
  return account.socialName ?? account.name;
}

/**
 * Origem da requisicao de cadastro — usada para o evento ACCEPTED inicial dos
 * termos (D-025). IP/UA vem SEMPRE da requisicao (route layer), nunca do
 * corpo enviado pelo cliente.
 */
export interface TermsAcceptanceOrigin {
  ipAddress: string;
  userAgent: string;
}

/**
 * Endereço da PESSOA (D-044) — bloco persistido como colunas `address*` na
 * `Account`, espelhando o precedente do `Tenant`. Só dígitos em `cep`
 * (normalização é do schema Zod). `complemento` opcional; `country` sempre
 * presente (default 'BR' resolvido no schema).
 */
export interface AddressInput {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | undefined;
  bairro: string;
  cidade: string;
  state: BrazilianState;
  country: string;
}

export interface CreateProfessionalInput {
  email: string;
  passwordHash: string;
  name: string;
  /** Nome social (spec §3.1) — opcional; ausente = usa o nome civil. */
  socialName?: string | undefined;
  /** Gênero/identidade (spec §3.1) — opcional. */
  gender?: Gender | undefined;
  document: string;
  documentType: DocumentType;
  /** WhatsApp da pessoa — só dígitos (11), normalizado no schema (D-044). */
  whatsapp: string;
  /** Data de nascimento (calendário) — o schema já garantiu maioridade (D-044). */
  birthDate: Date;
  /** Endereço da pessoa (D-044) — colunas `address*` na Account. */
  address: AddressInput;
  /** Especialidade reivindicada no signup (D-137 — ADR-0015). */
  specialtyId: string;
  /** Registro no conselho — validado so em formato pelo Zod (D-138). */
  councilDocument: string;
  councilState: BrazilianState;
  /**
   * Aceite obrigatorio dos termos no cadastro (D-025). O Zod ja garante, na
   * borda HTTP, que ambos os documentos foram aceitos (`z.literal(true)`) —
   * aqui so a ORIGEM da requisicao, para escrever os dois eventos ACCEPTED
   * (Termos de Uso + Politica de Privacidade) na MESMA transacao da conta.
   */
  termsAcceptance: TermsAcceptanceOrigin;
}

/**
 * Perfil profissional do admin QUE TAMBÉM ATENDE (spec §2 — "Você é?" =
 * MANAGER_PROVIDER). Ausente = gestor-puro (só membership CLINIC_ADMIN, sem
 * ProfessionalProfile). `specialtyId` já resolvido do `specialtyCode` pelo
 * service; `medicalSpecialty` só quando Médico (regra do Zod).
 */
export interface ClinicProviderInput {
  specialtyId: string;
  councilDocument: string;
  councilState: BrazilianState;
  medicalSpecialty?: MedicalSpecialty | undefined;
}

/**
 * Vertical do tenant de EMPRESA. Clínica (D-139) e academia (D-141) têm o mesmo
 * cadastro (spec §4.2/§4.3) e a MESMA transação de criação — só o `type` do
 * tenant muda. `SOLO` não entra aqui: nasce por `createProfessional`, com outra
 * forma (herda o nome da pessoa, não tem CNPJ nem admin separado).
 */
export type CompanyTenantType = 'CLINIC' | 'ACADEMIA';

/**
 * Cadastro público de EMPRESA — clínica (spec §4.2 · D-139) e academia
 * (spec §4.3 · D-141). Empresa (só CNPJ) + admin (pessoa física, CPF).
 * `tradeName` → `tenant.name` (exibição); `legalName` → `tenant.legalName`
 * (razão social/fiscal). A vertical entra por `tenantType`, não por um input
 * duplicado por vertical: a transação é a mesma, e duplicá-la criaria dois
 * lugares para corrigir a mesma regra.
 */
export interface CreateCompanyInput {
  tenantType: CompanyTenantType;
  legalName: string;
  tradeName: string;
  cnpj: string;
  companyEmail: string;
  companyPhone: string;
  address: AddressInput;
  admin: {
    email: string;
    passwordHash: string;
    name: string;
    socialName?: string | undefined;
    gender?: Gender | undefined;
    /** CPF do admin (pessoa física) — normalizado só dígitos, DV validado no Zod. */
    document: string;
    whatsapp: string;
    birthDate: Date;
  };
  /** Presente sse o admin marcou "também atende" (MANAGER_PROVIDER). */
  professional?: ClinicProviderInput | undefined;
  termsAcceptance: TermsAcceptanceOrigin;
}

/**
 * Porta de persistencia da identidade (Repository Pattern). O dominio depende
 * desta interface; a infra fornece a implementacao Prisma (ou in-memory nos testes).
 */
export interface AccountRepository {
  findByEmail(email: string): Promise<AccountRecord | null>;
  findById(id: string): Promise<AccountRecord | null>;
  /**
   * Cria conta + tenant SOLO + perfil profissional + a PRIMEIRA
   * ProfessionalSpecialty, tudo atomicamente (D-045/D-137). Se a specialty
   * falhar (ex.: specialtyId inexistente), nada e criado — nem Account nem
   * Tenant sobrevivem (mesma garantia atomica do aceite de convite).
   */
  createProfessional(input: CreateProfessionalInput): Promise<AccountRecord>;
  /**
   * Cadastro público de EMPRESA — clínica (D-139) ou academia (D-141): cria
   * Tenant(CLINIC|ACADEMIA) + Account(admin) + membership CLINIC_ADMIN (+
   * ProfessionalProfile/ProfessionalSpecialty se "também atende") + os 2 eventos
   * ACCEPTED de termos, tudo na MESMA transação. Falha em qualquer etapa → nada
   * órfão.
   */
  createCompany(input: CreateCompanyInput): Promise<AccountRecord>;
  /** Marca o e-mail como verificado (idempotente) — D-029. */
  markEmailVerified(id: string): Promise<void>;
  /** Atualiza o hash da senha (recuperacao/troca) — D-029. */
  updatePassword(id: string, passwordHash: string): Promise<void>;
}
