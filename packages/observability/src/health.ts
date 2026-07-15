import type { HealthCheck, HealthCheckResult, HealthStatus } from './index';

/** Ordena os status do pior para o melhor (para agregar o status global). */
const SEVERITY: Record<HealthStatus, number> = {
  unhealthy: 2,
  degraded: 1,
  healthy: 0,
};

/** Devolve o pior status de uma lista (vazio => healthy). */
export function worstStatus(statuses: readonly HealthStatus[]): HealthStatus {
  return statuses.reduce<HealthStatus>(
    (worst, current) => (SEVERITY[current] > SEVERITY[worst] ? current : worst),
    'healthy',
  );
}

/**
 * Executa varios `HealthCheck` em paralelo e agrega num unico `HealthCheckResult`
 * (D-073). Uma checagem que lanca conta como `unhealthy` (nunca deixa a saude
 * global otimista por engano). O status global e o PIOR entre as dependencias.
 */
export async function runHealthChecks(checks: readonly HealthCheck[]): Promise<HealthCheckResult> {
  const details: NonNullable<HealthCheckResult['details']> = {};

  const entries = await Promise.all(
    checks.map(async (check): Promise<[string, HealthStatus, string | undefined]> => {
      try {
        const result = await check.check();
        return [check.name, result.status, undefined];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return [check.name, 'unhealthy', message];
      }
    }),
  );

  for (const [name, status, message] of entries) {
    details[name] = message ? { status, message } : { status };
  }

  return {
    status: worstStatus(entries.map(([, status]) => status)),
    details,
  };
}
