import { getTenantContext, runWithTenantContext } from '@fitvo/database';
import { describe, expect, it } from 'vitest';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('tenant-context', () => {
  it('nao ha contexto antes de qualquer runWithTenantContext', () => {
    expect(getTenantContext()).toBeUndefined();
  });

  it('expoe o tenantId dentro do run', () => {
    runWithTenantContext('tenant-a', () => {
      expect(getTenantContext()).toBe('tenant-a');
    });
  });

  it('sobrevive a await aninhado em chamadas profundas', async () => {
    async function nivel3(): Promise<string | undefined> {
      await delay(1);
      return getTenantContext();
    }
    async function nivel2(): Promise<string | undefined> {
      await delay(1);
      return nivel3();
    }
    async function nivel1(): Promise<string | undefined> {
      await delay(1);
      return nivel2();
    }

    const resultado = await runWithTenantContext('tenant-b', () => nivel1());
    expect(resultado).toBe('tenant-b');
  });

  it('duas execucoes concorrentes de tenants diferentes nao vazam entre si', async () => {
    async function rodar(tenantId: string): Promise<string | undefined> {
      return runWithTenantContext(tenantId, async () => {
        await delay(Math.random() * 10);
        return getTenantContext();
      });
    }

    const [resultadoA, resultadoB] = await Promise.all([rodar('tenant-x'), rodar('tenant-y')]);

    expect(resultadoA).toBe('tenant-x');
    expect(resultadoB).toBe('tenant-y');
  });

  it('volta a undefined fora do run apos a execucao terminar', async () => {
    await runWithTenantContext('tenant-c', async () => {
      await delay(1);
    });
    expect(getTenantContext()).toBeUndefined();
  });
});
