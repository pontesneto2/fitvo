import { baseEnvSchema, parseEnv } from '@fitvo/config';
import { z } from 'zod';

const workerEnvSchema = baseEnvSchema.extend({
  REDIS_URL: z.string().default('redis://localhost:6379'),
  // Intervalo da varredura da regua de cobranca (Fluxo A — ADR-0004). Default
  // diario (24h); a cadencia diaria acerta cada marco do cronograma uma vez.
  // Configuravel por ambiente.
  COLLECTION_RULER_INTERVAL_MS: z.coerce.number().int().positive().default(86_400_000),
  // Intervalo da varredura das reguas de plano de treino (D-083 vencimento;
  // D-084 liberacao agendada — ADR-0009). Default diario, mesmo raciocinio da
  // regua de cobranca. Configuravel por ambiente.
  PLAN_LIFECYCLE_RULER_INTERVAL_MS: z.coerce.number().int().positive().default(86_400_000),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

/** Ambiente validado no boot (falha rapido se invalido — D-073). */
export const env: WorkerEnv = parseEnv(workerEnvSchema);
