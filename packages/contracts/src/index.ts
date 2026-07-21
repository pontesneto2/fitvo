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
 * Lista ordenada alfabeticamente (simple-import-sort) — auth, billing, clinic,
 * consent, patient num só bloco.
 */
export type {
  AcceptedResult,
  AcceptTermsInput,
  AccountSummary,
  AuthResult,
  BillingTenantParams,
  ChargeView,
  ClinicAcceptInviteInput,
  ClinicAcceptInviteResult,
  ClinicCreateInviteInput,
  ClinicCreateInviteResult,
  ClinicInviteParams,
  ClinicInviteView,
  ClinicProfessionalView,
  ClinicRosterResult,
  ClinicTenantParams,
  ConsentParams,
  ConsentView,
  CreateChargeInput,
  EmailVerifiedResult,
  ForgotPasswordInput,
  GrantConsentInput,
  ListConsentsResult,
  ListPlansResult,
  LoginInput,
  MeResult,
  PatientAcceptInviteInput,
  PatientAcceptInviteResult,
  PatientBondParams,
  PatientBondView,
  PatientCreateInviteInput,
  PatientCreateInviteResult,
  PatientInviteParams,
  PatientInviteView,
  PatientOverviewResult,
  PatientTenantParams,
  PlanView,
  RefreshInput,
  RefreshResult,
  RegisterPatientInput,
  RegisterProfessionalInput,
  RequestEmailVerificationInput,
  ResetPasswordInput,
  RevokeTermsInput,
  SubscribeInput,
  SubscriptionView,
  TermsAcceptanceStatus,
  TermsDocumentSlug,
  TermsStatusResult,
  TermsStatusView,
  Tokens,
  VerifyEmailInput,
  WalletView,
  WebhookResult,
} from '@fitvo/validation';
