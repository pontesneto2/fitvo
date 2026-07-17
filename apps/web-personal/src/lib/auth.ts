import { z } from 'zod';

/**
 * DTOs de auth do cliente web. LOCAIS de proposito: `@fitvo/contracts` ainda esta
 * vazio (esqueleto) — divida registrada no roadmap para mover estes tipos para la.
 * Espelham o contrato real da API (`apps/api/.../auth-schemas.ts` e `AuthResult`/
 * `MeResult` do auth-application-service).
 */
export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  // ISO string quando serializado pela API (Fastify serializa Date -> ISO).
  readonly accessExpiresAt?: string;
  readonly refreshExpiresAt?: string;
}

export interface Account {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

export interface LoginResult {
  readonly account: Account;
  readonly tokens: AuthTokens;
}

/** Resposta de GET /v1/auth/me (MeResult). */
export interface Me {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly emailVerified: boolean;
}

/** Espelha o `loginSchema` da API. Mensagens em pt-BR para o formulario. */
export const loginInputSchema = z.object({
  email: z.string().email('Informe um e-mail valido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
