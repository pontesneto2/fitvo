import { baseEnvSchema, parseEnv } from '@fitvo/config';
import { z } from 'zod';

const apiEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3333),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('*'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
  JWT_ISSUER: z.string().default('fitvo-api'),
  // Verificacao de e-mail: 24h (padrao da industria; ainda expira). Recuperacao
  // de senha: 1h (curta duracao — D-029). Ambos configuraveis por ambiente.
  EMAIL_VERIFICATION_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  PASSWORD_RESET_TTL_SECONDS: z.coerce.number().int().positive().default(3_600),
  // Convite admin->profissional: 7 dias, espelhando a convencao do convite de
  // paciente (D-055/ADR-0002). Configuravel por ambiente.
  PROFESSIONAL_INVITE_TTL_SECONDS: z.coerce.number().int().positive().default(604_800),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

/** Ambiente validado no boot (falha rapido se invalido — D-073). Server-side. */
export const env: ApiEnv = parseEnv(apiEnvSchema);
