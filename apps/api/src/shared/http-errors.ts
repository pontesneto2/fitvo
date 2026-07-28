/** Detalhe de erro tecnico padronizado (RFC 7807 — D-031). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

/** Erro de aplicacao mapeavel para um ProblemDetails HTTP. */
export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly problemType: string;
  abstract readonly title: string;
}

export class EmailAlreadyInUseError extends AppError {
  readonly status = 409;
  readonly problemType = 'https://fitvo.dev/problems/email-already-in-use';
  readonly title = 'E-mail ja cadastrado';
  constructor() {
    super('Este e-mail ja esta em uso.');
    this.name = 'EmailAlreadyInUseError';
  }
}

export class InvalidCredentialsError extends AppError {
  readonly status = 401;
  readonly problemType = 'https://fitvo.dev/problems/invalid-credentials';
  readonly title = 'Credenciais invalidas';
  constructor() {
    super('E-mail ou senha invalidos.');
    this.name = 'InvalidCredentialsError';
  }
}

export class UnauthorizedError extends AppError {
  readonly status = 401;
  readonly problemType = 'https://fitvo.dev/problems/unauthorized';
  readonly title = 'Nao autorizado';
  constructor(message = 'Nao autorizado.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Autenticado, mas o e-mail da conta ainda nao foi verificado (D-029). Gate de
 * acoes sensiveis (convidar, financeiro, clinico) — nunca bloqueia login.
 */
export class EmailNotVerifiedError extends AppError {
  readonly status = 403;
  readonly problemType = 'https://fitvo.dev/problems/email-not-verified';
  readonly title = 'E-mail nao verificado';
  constructor() {
    super('Confirme seu e-mail antes de realizar esta acao.');
    this.name = 'EmailNotVerifiedError';
  }
}

/**
 * Autenticado e com e-mail verificado, mas o aceite dos Termos de Uso/
 * Politica de Privacidade esta desatualizado (D-025): ou foi revogado, ou uma
 * versao com `isMaterialChange` foi publicada depois do ultimo aceite. Gate de
 * acoes sensiveis (mesma familia do `EmailNotVerifiedError` — D-029), nunca
 * bloqueia login. `slug` identifica qual documento precisa de re-consentimento.
 */
export class ReconsentRequiredError extends AppError {
  readonly status = 403;
  readonly problemType = 'https://fitvo.dev/problems/reconsent-required';
  readonly title = 'Re-consentimento necessario';
  constructor(slug: string) {
    super(`E necessario re-consentir: ${slug}.`);
    this.name = 'ReconsentRequiredError';
  }
}

/** Autenticado, mas sem permissao para o recurso (RBAC — D-013/D-015). */
export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly problemType = 'https://fitvo.dev/problems/forbidden';
  readonly title = 'Acesso negado';
  constructor(message = 'Voce nao tem permissao para esta operacao.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** Recurso inexistente ou fora do escopo do tenant do chamador (D-002). */
export class NotFoundError extends AppError {
  readonly status = 404;
  readonly problemType = 'https://fitvo.dev/problems/not-found';
  readonly title = 'Recurso nao encontrado';
  constructor(message = 'Recurso nao encontrado.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** Token de verificacao/recuperacao invalido, expirado ou ja usado (D-029). */
export class InvalidVerificationTokenError extends AppError {
  readonly status = 400;
  readonly problemType = 'https://fitvo.dev/problems/invalid-token';
  readonly title = 'Token invalido ou expirado';
  constructor() {
    super('Token invalido, expirado ou ja utilizado.');
    this.name = 'InvalidVerificationTokenError';
  }
}

/** Token de convite invalido, expirado, revogado ou ja aceito (D-014/D-048). */
export class InvalidInviteTokenError extends AppError {
  readonly status = 400;
  readonly problemType = 'https://fitvo.dev/problems/invalid-invite';
  readonly title = 'Convite invalido ou expirado';
  constructor() {
    super('Convite invalido, expirado, revogado ou ja utilizado.');
    this.name = 'InvalidInviteTokenError';
  }
}

/** Ja existe um convite pendente para este e-mail nesta clinica (D-014). */
export class InvitePendingConflictError extends AppError {
  readonly status = 409;
  readonly problemType = 'https://fitvo.dev/problems/invite-pending';
  readonly title = 'Convite pendente ja existe';
  constructor() {
    super('Ja existe um convite pendente para este e-mail nesta clinica.');
    this.name = 'InvitePendingConflictError';
  }
}

/**
 * A conta ja possui perfil profissional (1:1 conta<->perfil no modelo atual —
 * ADR-0001). Migracao solo<->clinica fica para fase futura.
 */
export class ProfessionalProfileConflictError extends AppError {
  readonly status = 409;
  readonly problemType = 'https://fitvo.dev/problems/professional-exists';
  readonly title = 'Conta ja e profissional';
  constructor() {
    super('Esta conta ja possui um perfil profissional.');
    this.name = 'ProfessionalProfileConflictError';
  }
}

/**
 * A conta ja possui um seat de estagiario (1:1 conta<->seat — D-142).
 */
export class InternProfileConflictError extends AppError {
  readonly status = 409;
  readonly problemType = 'https://fitvo.dev/problems/intern-exists';
  readonly title = 'Conta ja e estagiaria';
  constructor() {
    super('Esta conta ja possui um seat de estagiario.');
    this.name = 'InternProfileConflictError';
  }
}

/**
 * O responsavel indicado nao pode supervisionar estagiario NESTE tenant (D-142):
 * nao e do tenant, nao tem CREF (TRAINING/PERSONAL_TRAINER) ou esta sem conselho
 * preenchido. Estagiario sem responsavel valido nao existe — o convite nao nasce.
 */
export class IneligibleSupervisorError extends AppError {
  readonly status = 422;
  readonly problemType = 'https://fitvo.dev/problems/ineligible-supervisor';
  readonly title = 'Responsavel inelegivel';
  constructor() {
    super(
      'O responsavel deve ser um profissional de CREF (Educador Fisico ou Personal Trainer) desta academia, com conselho preenchido.',
    );
    this.name = 'IneligibleSupervisorError';
  }
}

/**
 * Ja existe um vinculo para a tripla paciente+profissional+especialidade
 * (unica — ADR-0001/D-052). O aceite do convite nao reabre um vinculo existente.
 */
export class BondAlreadyExistsError extends AppError {
  readonly status = 409;
  readonly problemType = 'https://fitvo.dev/problems/bond-exists';
  readonly title = 'Vinculo ja existe';
  constructor() {
    super('Ja existe um vinculo deste paciente com este profissional nesta especialidade.');
    this.name = 'BondAlreadyExistsError';
  }
}

/**
 * Ja existe um consentimento ATIVO para a tripla paciente+grantee+especialidade
 * (unico — ADR-0003/D-016). Reconceder um consentimento ativo e no-op explicito.
 */
export class ConsentAlreadyExistsError extends AppError {
  readonly status = 409;
  readonly problemType = 'https://fitvo.dev/problems/consent-exists';
  readonly title = 'Consentimento ativo ja existe';
  constructor() {
    super('Ja existe um consentimento ativo para este profissional nesta especialidade.');
    this.name = 'ConsentAlreadyExistsError';
  }
}

/**
 * O paciente tentou consentir o compartilhamento de dados de uma especialidade
 * na qual nao possui vinculo ATIVO — nao ha dado a compartilhar (ADR-0003/D-016).
 * 422: requisicao bem-formada, mas viola uma pre-condicao de negocio.
 */
export class ConsentRequiresActiveBondError extends AppError {
  readonly status = 422;
  readonly problemType = 'https://fitvo.dev/problems/consent-requires-bond';
  readonly title = 'Sem vinculo ativo na especialidade';
  constructor() {
    super('So e possivel consentir o compartilhamento de uma especialidade com vinculo ativo.');
    this.name = 'ConsentRequiresActiveBondError';
  }
}

/** Plano inexistente ou inativo no catalogo da plataforma (Fluxo A — ADR-0004). */
export class PlanNotFoundError extends AppError {
  readonly status = 404;
  readonly problemType = 'https://fitvo.dev/problems/plan-not-found';
  readonly title = 'Plano nao encontrado';
  constructor() {
    super('Plano inexistente ou inativo.');
    this.name = 'PlanNotFoundError';
  }
}

/**
 * O plano nao tem preco configurado para a periodicidade pedida. Os precos
 * comerciais reais sao um input GATED (decisao humana — D-060/ADR-0004): ate o
 * catalogo ser populado, nao ha valor a cobrar. 422: pre-condicao de negocio.
 */
export class PlanPriceUnavailableError extends AppError {
  readonly status = 422;
  readonly problemType = 'https://fitvo.dev/problems/plan-price-unavailable';
  readonly title = 'Preco do plano indisponivel';
  constructor() {
    super(
      'O plano nao possui preco configurado para esta periodicidade (input comercial pendente).',
    );
    this.name = 'PlanPriceUnavailableError';
  }
}

/**
 * O tenant ja possui uma assinatura NAO-terminal (TRIALING/ACTIVE/PAST_DUE).
 * Uma assinatura ativa por tenant (default documentado — ADR-0004). Reenviar a
 * MESMA idempotencyKey e idempotente (devolve a existente); uma chave nova com
 * assinatura vigente e conflito.
 */
export class SubscriptionAlreadyExistsError extends AppError {
  readonly status = 409;
  readonly problemType = 'https://fitvo.dev/problems/subscription-exists';
  readonly title = 'Assinatura ja existe';
  constructor() {
    super('Este tenant ja possui uma assinatura vigente.');
    this.name = 'SubscriptionAlreadyExistsError';
  }
}
