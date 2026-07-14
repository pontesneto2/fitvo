import { z } from 'zod';

/** Ambientes suportados (D-068: dev/staging/prod, + test). */
export const nodeEnvSchema = z.enum(['development', 'test', 'staging', 'production']);
export type NodeEnv = z.infer<typeof nodeEnvSchema>;

export const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']);
export type LogLevel = z.infer<typeof logLevelSchema>;

/** Schema base de ambiente, comum a todos os apps. */
export const baseEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  LOG_LEVEL: logLevelSchema.default('info'),
});
export type BaseEnv = z.infer<typeof baseEnvSchema>;

/** Erro de validacao de ambiente com a lista de problemas encontrados. */
export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Variaveis de ambiente invalidas:\n${issues.join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Valida `source` (default: process.env) contra `schema`. Falha rapido com
 * mensagem clara — nenhum app sobe com ambiente invalido (D-073).
 */
export function parseEnv<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  source: Record<string, string | undefined> = process.env,
): z.infer<TSchema> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new EnvValidationError(issues);
  }
  return result.data;
}
