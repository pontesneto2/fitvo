/**
 * @fitvo/contracts — O CONTRATO compartilhado da API (D-032).
 *
 * Os tipos de wire são inferidos dos schemas Zod de `@fitvo/validation` (a FONTE
 * ÚNICA) e re-exportados aqui para os consumidores (web/mobile) importarem em vez
 * de redefinir DTO local — a terceira fonte que o D-032 existe para evitar.
 *
 * O OpenAPI vive ao lado, em `openapi.json` (raiz do package), GERADO dos mesmos
 * schemas e versionado; o CI reprova se ele dessincronizar da implementação
 * (job `contract` — ver `.github/workflows/ci.yml`).
 *
 * Quem precisa VALIDAR em runtime (formulário no cliente) importa os schemas de
 * `@fitvo/validation`; quem só precisa da forma do wire importa os tipos daqui.
 */
export type {
  AcceptedResult,
  AccountSummary,
  AuthResult,
  EmailVerifiedResult,
  ForgotPasswordInput,
  LoginInput,
  MeResult,
  RefreshInput,
  RefreshResult,
  RegisterPatientInput,
  RegisterProfessionalInput,
  RequestEmailVerificationInput,
  ResetPasswordInput,
  Tokens,
  VerifyEmailInput,
} from '@fitvo/validation';
