import type { BrazilianState, DocumentType, Gender } from '@fitvo/database';

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
  /** Marca o e-mail como verificado (idempotente) — D-029. */
  markEmailVerified(id: string): Promise<void>;
  /** Atualiza o hash da senha (recuperacao/troca) — D-029. */
  updatePassword(id: string, passwordHash: string): Promise<void>;
}
