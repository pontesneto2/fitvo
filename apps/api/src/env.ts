import { baseEnvSchema, parseEnv } from '@fitvo/config';
import { z } from 'zod';

const apiEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3333),
  HOST: z.string().default('0.0.0.0'),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

/** Ambiente validado no boot (falha rapido se invalido — D-073). */
export const env: ApiEnv = parseEnv(apiEnvSchema);
