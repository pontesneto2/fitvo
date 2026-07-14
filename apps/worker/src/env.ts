import { baseEnvSchema, parseEnv } from '@fitvo/config';
import { z } from 'zod';

const workerEnvSchema = baseEnvSchema.extend({
  REDIS_URL: z.string().default('redis://localhost:6379'),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

/** Ambiente validado no boot (falha rapido se invalido — D-073). */
export const env: WorkerEnv = parseEnv(workerEnvSchema);
