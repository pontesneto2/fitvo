import { getTenantContext } from './tenant-context';

/**
 * Client generico o bastante pra aceitar tanto o `PrismaClient` quanto o `tx`
 * de um `$transaction(async (tx) => ...)` interativo -- so precisa de
 * `$executeRaw`.
 */
interface RawExecutableClient {
  $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
}

/**
 * Seta a variavel de sessao do RLS (D-152, ADR-0017 Slice 3/3) na transacao
 * corrente. Chamar como PRIMEIRA linha de todo `$transaction(async (tx) => ...)`
 * que ESCREVE ou LE (via `tx.model...`) uma das 10 tabelas com RLS (bond,
 * internProfile, receptionProfile, paymentAccount, subscription, charge,
 * encounter, medicalRecord, prescription, anamnesis) -- `SET LOCAL` sempre
 * dentro da transacao ja aberta (nunca abre uma nova; reusa a `tx`), pra nao
 * quebrar a atomicidade dos fluxos de cadastro (D-153) nem vazar a variavel
 * entre conexoes recicladas por pool (`SET LOCAL` e limpo pelo Postgres no
 * COMMIT/ROLLBACK, seguro sob PgBouncer/Supavisor em transaction mode).
 *
 * Fora de um `$transaction` explicito (chamada avulsa `prisma.model.op()`), a
 * extension (`tenant-isolation-extension.ts`) ja bate o SET com a query
 * sozinha -- este helper NAO e necessario ali.
 *
 * `tenantId` e SEMPRE explicito (nunca lido implicitamente do ALS aqui): os
 * fluxos-excecao que mais precisam disto (registro publico, aceite de
 * convite -- ver D-150/tenant-context-hook.ts) rodam SEM contexto ALS aberto,
 * entao passam o tenantId que ja resolveram manualmente (ex.: `invite.tenantId`).
 * Fluxos com ALS aberto passam `getTenantContext()` explicitamente tambem --
 * sem default implicito, pra nao mascarar um `undefined` esquecido.
 */
export async function setRlsTenantSession(
  tx: RawExecutableClient,
  tenantId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
}

/** Reexportado por conveniencia -- fluxos com ALS aberto chamam `setRlsTenantSession(tx, getTenantContext())`. */
export { getTenantContext };
