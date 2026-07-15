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
