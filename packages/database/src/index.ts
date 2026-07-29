import { PrismaClient } from './generated/client';
import { tenantIsolationQueryExtension } from './tenant-isolation-extension';

/**
 * @fitvo/database — client Prisma singleton.
 * Reaproveita a instancia em dev (evita esgotar conexoes com hot-reload).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const basePrisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma;
}

/**
 * Cliente Prisma PADRAO da aplicacao (D-151 — ADR-0017, Slice 2/3): ja vem com
 * a extension de isolamento de tenant aplicada — "todo acesso a dado passa por
 * ela" (consequencia documentada do ADR). Acesso administrativo/cross-tenant
 * legitimo (se houver) precisa de um caminho explicito e separado, nunca deste
 * export. Sem contexto de tenant aberto (D-150), a extension nao injeta nada —
 * aditivo, comportamento identico ao cliente cru.
 *
 * TIPO: exportado como `PrismaClient` (nao o tipo interno de `$extends`) de
 * proposito. `$extends` devolve um tipo estruturalmente DISTINTO (falta `$on`;
 * generics internos de rastreio de extensao incompativeis com
 * `exactOptionalPropertyTypes`) mesmo sem mudar NENHUM contrato publico de
 * chamada — todo `model.metodo(args)` continua com a MESMA assinatura vista
 * pelo chamador, so a interceptacao interna muda. Forcar o tipo real do
 * `$extends` em todo repositorio (~12 arquivos) e teste de integracao (que
 * instanciam seu PROPRIO `PrismaClient` cru pra semear dados sem passar pela
 * extension) quebraria essa compatibilidade estrutural nas DUAS direcoes sob
 * este tsconfig — nao e um problema de design da extension, e uma lacuna
 * conhecida da tipagem de `$extends` do Prisma. O cast fica UNICO e
 * documentado aqui, na fronteira do pacote, em vez de espalhar `as unknown as`
 * (ou uma uniao de tipos que reabriria o mesmo atrito em cada call-site) por
 * toda a base. `$on` (unico membro realmente ausente) nao e usado em lugar
 * nenhum do monorepo (auditado).
 */
export const prisma: PrismaClient = basePrisma.$extends({
  query: tenantIsolationQueryExtension,
}) as unknown as PrismaClient;

export * from './generated/client';
export * from './tenant-context';
export * from './tenant-isolation-extension';
