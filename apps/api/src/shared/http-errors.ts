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
