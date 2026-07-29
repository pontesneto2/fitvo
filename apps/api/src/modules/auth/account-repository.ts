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
 * Conta + os campos que decidem o gate de completar-perfil (spec §5). Estende a
 * projecao minima em vez de substitui-la: quem so autentica continua lendo o
 * `AccountRecord` enxuto.
 */
export interface AccountWithProfileRecord extends AccountRecord, ProfileCompletenessFields {}

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
 * Projecao minima para decidir se o perfil esta completo. Sao exatamente as
 * colunas que `deriveProfileComplete` le — nada alem, para que a regra nao
 * possa passar a depender de algo que a chamada nao projetou.
 */
export interface ProfileCompletenessFields {
  birthDate: Date | null;
  whatsapp: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressDistrict: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZipCode: string | null;
}

/**
 * **MINIMO FUNCIONAL** que o app precisa para operar (spec §5) — FONTE UNICA da
 * derivacao, mesma doutrina do `deriveDisplayName`: o servidor decide, e
 * web/mobile/admin apenas consomem `profileComplete` de `/me`. Nenhuma
 * superficie reimplementa esta conta.
 *
 * **A regra e sobre DADO, nao sobre papel.** Nao existe flag de "este seat esta
 * sujeito ao gate", e a ausencia dela e deliberada: uma flag seria uma SEGUNDA
 * representacao de um fato que as colunas ja contam (o anti-padrao D-103, que o
 * schema ja evita em `biologicalSex`), e passaria a mentir assim que alguem
 * completasse o perfil por outro caminho.
 *
 * Quem "esta sujeito ao gate" e, portanto, CONSEQUENCIA de cada fluxo de
 * criacao — do que ele coleta, nao de uma lista mantida a mao:
 *
 * - autonomo, admin de empresa, estagiario, recepcao e paciente coletam os tres
 *   no proprio cadastro/aceite ⇒ nascem completos, nunca veem o gate;
 * - profissional de clinica/academia (#102) NAO os coleta ⇒ nasce incompleto e
 *   cai no gate — exatamente o publico que a spec §5 descreve.
 *
 * Um seat novo que colete tudo simplesmente nunca aparece no gate, sem que
 * ninguem precise lembrar de atualizar uma lista.
 *
 * **Senha nao entra na conta**: `passwordHash` e NOT NULL: nao existe conta sem
 * senha, entao exigi-la aqui seria uma condicao sempre verdadeira — ruido que
 * sugeriria um estado que o schema nao admite.
 *
 * `addressComplement` e `addressCountry` ficam de fora: o primeiro e opcional
 * no cadastro (spec §4.1), e o segundo tem default 'BR'.
 */
export function deriveProfileComplete(account: ProfileCompletenessFields): boolean {
  return (
    account.birthDate !== null &&
    account.whatsapp !== null &&
    account.addressStreet !== null &&
    account.addressNumber !== null &&
    account.addressDistrict !== null &&
    account.addressCity !== null &&
    account.addressState !== null &&
    account.addressZipCode !== null
  );
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
 * Campos que o gate de completar-perfil preenche (spec §5). Todos OPCIONAIS: a
 * pessoa pode ter parte deles e completar so o que falta. O que ja estiver
 * preenchido e sobrescrito pelo valor enviado — e edicao do proprio perfil,
 * feita pelo dono da conta.
 */
export interface CompleteProfileInput {
  whatsapp?: string | undefined;
  birthDate?: Date | undefined;
  address?: AddressInput | undefined;
}

/**
 * Porta de persistencia da identidade (Repository Pattern). O dominio depende
 * desta interface; a infra fornece a implementacao Prisma (ou in-memory nos testes).
 */
export interface AccountRepository {
  findByEmail(email: string): Promise<AccountRecord | null>;
  findById(id: string): Promise<AccountRecord | null>;

  /**
   * Conta + os campos do gate de completar-perfil (spec §5). Separado do
   * `findById` para nao engordar a projecao de quem so autentica.
   */
  findByIdWithProfile(id: string): Promise<AccountWithProfileRecord | null>;

  /**
   * Preenche os campos faltantes do perfil (spec §5) e devolve a conta ja
   * atualizada. Idempotente: reenviar os mesmos valores nao muda nada alem do
   * `updatedAt`. NAO toca em termos — completar perfil nao e novo consentimento
   * (D-025); nem em documento/e-mail, que sao identidade, nao "dado faltando".
   */
  completeProfile(id: string, input: CompleteProfileInput): Promise<AccountWithProfileRecord>;
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
