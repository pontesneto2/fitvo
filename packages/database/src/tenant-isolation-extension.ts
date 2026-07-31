import { getTenantContext } from './tenant-context';

/**
 * Camada 2 do isolamento de tenant (D-151 — ADR-0017, Slice 2/3). Injeta o
 * tenantId do contexto (D-150 — tenant-context.ts) no `where`/`data` de toda
 * operacao do Prisma Client para os modelos escopados por tenant. O dev NUNCA
 * escreve o filtro de tenant a partir de agora — nao pode esquecer.
 *
 * LISTA FECHADA E AUDITADA (auditoria completa do schema.prisma inteiro, os 71
 * modelos, feita na implementacao deste slice) — os UNICOS modelos com coluna
 * `tenantId` REAL:
 *
 * clinicMembership, professionalProfile, professionalInvite, internProfile,
 * internInvite, receptionProfile, receptionInvite, patientInvite, bond,
 * paymentAccount, subscription, charge, workoutPlan, workout, workoutSession,
 * formAnalysis, mealPlan, mealLog, encounter, medicalRecord, prescription,
 * anamnesis, assessment, progressPhoto, attendance, appointment.
 *
 * O QUE FICA DE FORA DE PROPOSITO (nao e omissao — ver auditoria completa no PR
 * do slice):
 * - GLOBAL (catalogo da plataforma, sem tenantId): Specialty, TermsDocument,
 *   TermsVersion, Plan, PlanPrice.
 * - MISTO GLOBAL/DONO (Exercise/Food/FoodGroup): NAO tem coluna tenantId —
 *   escopam por `ownerProfessionalProfileId`/`visibility`, dimensao diferente
 *   de tenant. Diverge do texto original da ADR-0017 (D-152 citava
 *   "Exercise/MuscleGroup com tenantId NULL"; `MuscleGroup` nunca foi criado no
 *   schema real — ADR-0018 do dominio de treino evoluiu o design). Reportado
 *   no PR; nao e um gap deste slice, e um limite do proprio schema.
 * - SEM TENANT / cross-tenant por design ou por conta/titular: Account,
 *   PlatformAdmin, Tenant, PatientProfile (paciente tem vinculos em varios
 *   tenants), Consent (por patientProfileId, ADR-0003 — cruza tenant de
 *   proposito), SharingSuggestion (idem), TermsAcceptanceEvent (por
 *   accountId), WebhookEvent (ledger global Asaas), Notification (por
 *   accountId).
 * - FILHO escopado TRANSITIVAMENTE via FK do pai (sem tenantId proprio; a
 *   extension NAO PODE injetar o que nao existe como coluna): ~28 modelos
 *   (WorkoutItem, WorkoutSet, SetLog, WorkoutRating, ProfessionalSpecialty,
 *   toda a arvore de Anamnesis*, Meal/MealPlanItem/MealLogItem/FoodGroupMember,
 *   AttendanceMessage/Rating, ProfessionalService/AgendaSettings/
 *   AvailabilityRule/Exception — ver auditoria completa no PR). O isolamento
 *   destes depende 100% do app ja validar o id do pai antes de ler/escrever —
 *   responsabilidade PRE-EXISTENTE, inalterada por este slice.
 *
 * RACIOCINIO SOBRE RELACAO ANINHADA (nota de implementacao do ADR-0017): quando
 * o modelo RAIZ da query e um dos 26 acima, injetar tenantId no `where` RAIZ e
 * SUFICIENTE mesmo com filtro de relacao aninhada (`some`/`every`/`is`/objeto),
 * porque toda travessia de relacao do Prisma e correlacionada por FK a LINHA
 * RAIZ ja escopada — nao existe travessia que "escape" para linha de outro
 * tenant (cada filho aponta para exatamente um pai). Auditado contra
 * `eligibleSupervisorWhere` (prisma-intern-repository.ts) e os predicados
 * multi-hop de nutrition — ver PR para o detalhe caso a caso. NAO removi
 * nenhum filtro manual existente: eles ficam redundantes (defesa em
 * profundidade), nunca removidos neste slice.
 *
 * LIMITE CONHECIDO — writes ANINHADOS (`parentModel.create({ data: {
 * childRelation: { create: {...} } } } })`) NAO passam por este hook: o
 * Prisma so intercepta chamadas de METODO DE TOPO
 * (`prisma.<model>.<operacao>()`); um `create` aninhado dentro de outro
 * `create` e resolvido pela engine na MESMA query, sem reentrar pelos hooks
 * por-modelo. As ocorrencias encontradas (registro/aceite de convite) ja
 * setam o tenant manualmente e corretamente, e rodam em fluxo SEM contexto
 * aberto de qualquer forma (ver Slice 1) — sem mudanca de comportamento.
 *
 * LIMITE CONHECIDO — `$queryRaw`/`$executeRaw` NAO passam pela extension (o
 * hook `query` do Prisma so cobre os metodos tipados do Client). E o gap que a
 * Camada 3 (RLS — D-152, Slice 3) cobre; nao e responsabilidade deste slice.
 *
 * SEM CONTEXTO ABERTO (fluxo-excecao ou worker fora de request HTTP):
 * `getTenantContext()` retorna `undefined` e a extension NAO INJETA NADA — a
 * query roda exatamente como corria antes deste slice (aditivo, D-150/D-151).
 *
 * OPERACAO NAO RECONHECIDA com contexto aberto: falha FECHADA (lanca erro) em
 * vez de deixar passar sem escopo. Modo de falha deste slice e vazamento de
 * dado de saude — um `throw` alto e barato comparado a uma query sem filtro
 * passando despercebida.
 */

const TENANT_SCOPED_MODELS = [
  'clinicMembership',
  'professionalProfile',
  'professionalInvite',
  'internProfile',
  'internInvite',
  'receptionProfile',
  'receptionInvite',
  'patientInvite',
  'bond',
  'paymentAccount',
  'subscription',
  'charge',
  'workoutPlan',
  'workout',
  'workoutSession',
  'formAnalysis',
  'mealPlan',
  'mealLog',
  'encounter',
  'medicalRecord',
  'prescription',
  'anamnesis',
  'assessment',
  'progressPhoto',
  'attendance',
  'appointment',
] as const;

/** Nomes dos 26 modelos bucket A — exportado so para os testes conferirem cobertura 1:1 com a lista literal do `query` abaixo. */
export type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];
export { TENANT_SCOPED_MODELS };

type PlainRecord = Record<string, unknown>;

/**
 * Args heterogeneos de `$allOperations` (une o shape de todas as operacoes do
 * modelo) — o Prisma nao expoe uniao discriminada por `operation` aqui, entao
 * o acesso a `where`/`data` precisa de checagem em runtime (`'where' in args`),
 * nao de um cast solto. Ver justificativa de CLAUDE.md "any sem justificativa
 * forte": este e o shape que a propria API do Prisma expoe para este hook.
 */
type AllOperationsArgs = PlainRecord;

function asRecord(value: unknown): PlainRecord {
  return (value ?? {}) as PlainRecord;
}

/** Leitura por filtro geral (findMany/findFirst/count/aggregate/groupBy): AND-wrap preserva qualquer OR/lógica já presente no `where` manual. */
function scopeFilterWhere(where: unknown, tenantId: string): PlainRecord {
  return { AND: [asRecord(where), { tenantId }] };
}

/**
 * Leitura/escrita por chave unica (findUnique/delete/update/upsert.where): o
 * Prisma exige que o `where` de operacoes "unique" seja moldado pelas colunas
 * unicas (id, ou combinacao @@unique) — AND-wrap quebraria esse shape. A
 * adicao de filtros escalares extras ao lado da chave unica e suportada pelo
 * Prisma (mesmo padrao do exemplo oficial de extension de RLS por sessao). O
 * spread com `tenantId` por ULTIMO garante que o contexto sempre vence se o
 * código manual (redundante, D-151) já tiver passado um tenantId.
 */
function scopeUniqueWhere(where: unknown, tenantId: string): PlainRecord {
  return { ...asRecord(where), tenantId };
}

/** create/createMany/createManyAndReturn/upsert.create: tenantId do contexto SEMPRE vence — o dev nao pode criar fora do proprio tenant nem por engano. */
function scopeCreateData(data: unknown, tenantId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => ({ ...asRecord(item), tenantId }));
  }
  return { ...asRecord(data), tenantId };
}

/**
 * update/updateMany/upsert.update: tenantId do contexto SEMPRE vence, mesmo se
 * `data` tentar setar outro valor — fecha o furo de "mover a linha pra outro
 * tenant via update" (o `where` já scopado impede ENCONTRAR a linha errada,
 * mas sem isto o `data` ainda poderia REESCREVER o tenantId de uma linha
 * legitimamente encontrada).
 */
function scopeUpdateData(data: unknown, tenantId: string): unknown {
  return { ...asRecord(data), tenantId };
}

const READ_FILTER_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);
const READ_UNIQUE_OPS = new Set(['findUnique', 'findUniqueOrThrow']);
const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);

function applyTenantScope(
  operation: string,
  args: AllOperationsArgs,
  tenantId: string,
): AllOperationsArgs {
  if (READ_FILTER_OPS.has(operation)) {
    return { ...args, where: scopeFilterWhere(args.where, tenantId) };
  }
  if (READ_UNIQUE_OPS.has(operation)) {
    return { ...args, where: scopeUniqueWhere(args.where, tenantId) };
  }
  if (CREATE_OPS.has(operation)) {
    return { ...args, data: scopeCreateData(args.data, tenantId) };
  }
  if (operation === 'update') {
    return {
      ...args,
      where: scopeUniqueWhere(args.where, tenantId),
      data: scopeUpdateData(args.data, tenantId),
    };
  }
  if (operation === 'updateMany' || operation === 'updateManyAndReturn') {
    return {
      ...args,
      where: scopeFilterWhere(args.where, tenantId),
      data: scopeUpdateData(args.data, tenantId),
    };
  }
  if (operation === 'upsert') {
    return {
      ...args,
      where: scopeUniqueWhere(args.where, tenantId),
      create: scopeCreateData(args.create, tenantId),
      update: scopeUpdateData(args.update, tenantId),
    };
  }
  if (operation === 'delete') {
    return { ...args, where: scopeUniqueWhere(args.where, tenantId) };
  }
  if (operation === 'deleteMany') {
    return { ...args, where: scopeFilterWhere(args.where, tenantId) };
  }
  // Falha FECHADA de proposito (ver doc do arquivo): operacao nao mapeada com
  // contexto aberto e tratada como erro de programacao, nunca como "deixa
  // passar sem escopo".
  throw new Error(
    `tenant-isolation-extension: operacao Prisma "${operation}" nao mapeada para injecao de tenantId. ` +
      'Adicione o caso em applyTenantScope antes de usar esta operacao em modelo escopado por tenant.',
  );
}

/**
 * Subconjunto dos modelos bucket A que TAMBEM tem Postgres RLS (D-152, ADR-0017
 * Slice 3/3) -- "as 10 confirmadas" menos `TermsAcceptanceEvent` (nao entrou:
 * nao tem coluna tenantId, ver migration do RLS). Usado so para decidir se a
 * query precisa da variavel de sessao `app.current_tenant_id` setada na MESMA
 * transacao (sem isso, a policy RLS bloqueia leitura E escrita nestas tabelas).
 *
 * PascalCase de proposito -- `params.model` no hook `$allOperations` vem no
 * nome do MODELO Prisma (`InternProfile`), NAO na chave camelCase usada pela
 * config do `$extends` logo abaixo (`internProfile`). Confundir os dois casing
 * faz o `.has(model)` nunca bater e a Camada 3 nunca ativar -- achado rodando
 * a bateria de testes contra Postgres real com RLS ligado (o `.has()` sempre
 * falso silenciosamente deixava passar sem SET, e a policy rejeitava a
 * escrita). Verificado empiricamente contra a versao instalada (^6.1.0).
 */
const RLS_SCOPED_MODELS = new Set<string>([
  'Bond',
  'InternProfile',
  'ReceptionProfile',
  'PaymentAccount',
  'Subscription',
  'Charge',
  'Encounter',
  'MedicalRecord',
  'Prescription',
  'Anamnesis',
]);

/**
 * Cliente com `$transaction`/`$executeRaw` usado SO para bater a variavel de
 * sessao do RLS (`SET LOCAL`/`set_config`) e a query num UNICO round-trip
 * transacional, quando a chamada NAO esta dentro de um `$transaction(async
 * (tx) => ...)` explicito (ver `isInsideInteractiveTransaction` abaixo).
 * Registrado por `registerRlsBatchExecutor` (index.ts) DEPOIS de o client ser
 * construido -- import circular seria necessario para referenciar `prisma`
 * diretamente aqui, ja que `index.ts` importa DESTE arquivo.
 */
interface RlsBatchExecutor {
  $executeRaw: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => { [Symbol.iterator]?: never } & Promise<number>;
  $transaction: <T extends readonly unknown[]>(ops: readonly [...T]) => Promise<T>;
}

let rlsBatchExecutor: RlsBatchExecutor | undefined;

/** Chamado uma vez, em `index.ts`, com o proprio client extendido (auto-referencia). */
export function registerRlsBatchExecutor(executor: RlsBatchExecutor): void {
  rlsBatchExecutor = executor;
}

/**
 * `true` quando a chamada corrente roda DENTRO de um `prisma.$transaction(async
 * (tx) => {...})` interativo ja aberto pelo app. Sinal vem de
 * `__internalParams.transaction.kind === 'itx'` -- campo INTERNO do Prisma
 * (nao documentado publicamente, mas tipado em `runtime/library.d.ts` como
 * `PrismaPromiseInteractiveTransaction`), verificado empiricamente contra a
 * versao instalada (^6.1.0) antes de confiar nele: `kind` e `'itx'` SO quando a
 * operacao roda via `tx.model.op()` de uma transacao interativa; ausente numa
 * chamada avulsa (`prisma.model.op()`). Reverificar ao atualizar o Prisma.
 *
 * Por que isto importa pro RLS (D-153): dentro de um `$transaction` explicito,
 * o proprio dev ja emitiu o `SET LOCAL` manualmente no topo do callback (ver
 * `setRlsTenantSession`) -- reusando a MESMA transacao/conexao. Se o hook
 * tentasse "ajudar" abrindo OUTRA mini-transacao pra bater o SET com a query
 * (como faz no caminho avulso, abaixo), essa nova transacao rodaria numa
 * conexao DIFERENTE da `tx` corrente -- exatamente o anti-padrao que o D-153
 * ja proibiu pro Layer 2 (Slice 2), agora tambem valeria pro Layer 3.
 */
function isInsideInteractiveTransaction(internalParams: unknown): boolean {
  const transaction = (internalParams as { transaction?: { kind?: string } } | undefined)
    ?.transaction;
  return transaction?.kind === 'itx';
}

/**
 * Caminho AVULSO (fora de `$transaction` explicito) pra modelo com RLS: bate o
 * `SET LOCAL` (via `set_config(..., true)` -- `true` = `is_local`) e a query
 * real na MESMA transacao implicita, usando a forma em ARRAY do
 * `$transaction` (nao a interativa) -- e o padrao oficial do Prisma pra RLS
 * por sessao, e aqui e seguro: como NAO estamos dentro de nenhuma transacao
 * de negocio existente (D-153 so se aplica a transacoes explicitas do app),
 * abrir esta mini-transacao nao quebra atomicidade de nada.
 */
async function runRlsScopedStandalone(
  tenantId: string,
  queryPromise: Promise<unknown>,
): Promise<unknown> {
  if (!rlsBatchExecutor) {
    throw new Error(
      'tenant-isolation-extension: RLS batch executor nao registrado. ' +
        'Chame registerRlsBatchExecutor() ao construir o client (@fitvo/database/src/index.ts) ' +
        'antes de qualquer query em modelo com RLS.',
    );
  }
  const [, result] = await rlsBatchExecutor.$transaction([
    rlsBatchExecutor.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
    queryPromise,
  ] as const);
  return result;
}

async function tenantScopedAllOperations(params: {
  model?: string;
  operation: string;
  args: AllOperationsArgs;
  query: (args: AllOperationsArgs) => Promise<unknown>;
  __internalParams?: unknown;
}): Promise<unknown> {
  const tenantId = getTenantContext();
  if (!tenantId) {
    return params.query(params.args);
  }
  const scopedArgs = applyTenantScope(params.operation, params.args, tenantId);

  if (!params.model || !RLS_SCOPED_MODELS.has(params.model)) {
    return params.query(scopedArgs);
  }
  if (isInsideInteractiveTransaction(params.__internalParams)) {
    return params.query(scopedArgs);
  }
  return runRlsScopedStandalone(tenantId, params.query(scopedArgs));
}

/**
 * Config do componente `query` do `$extends` — uma chave por modelo bucket A,
 * TODAS apontando para o MESMO handler (a logica de injecao nao depende do
 * nome do modelo). Escrito como literal explicito de proposito: um reviewer
 * consegue conferir esta lista 1 a 1 contra `TENANT_SCOPED_MODELS`/o schema,
 * em vez de confiar num objeto computado em runtime.
 */
export const tenantIsolationQueryExtension = {
  clinicMembership: { $allOperations: tenantScopedAllOperations },
  professionalProfile: { $allOperations: tenantScopedAllOperations },
  professionalInvite: { $allOperations: tenantScopedAllOperations },
  internProfile: { $allOperations: tenantScopedAllOperations },
  internInvite: { $allOperations: tenantScopedAllOperations },
  receptionProfile: { $allOperations: tenantScopedAllOperations },
  receptionInvite: { $allOperations: tenantScopedAllOperations },
  patientInvite: { $allOperations: tenantScopedAllOperations },
  bond: { $allOperations: tenantScopedAllOperations },
  paymentAccount: { $allOperations: tenantScopedAllOperations },
  subscription: { $allOperations: tenantScopedAllOperations },
  charge: { $allOperations: tenantScopedAllOperations },
  workoutPlan: { $allOperations: tenantScopedAllOperations },
  workout: { $allOperations: tenantScopedAllOperations },
  workoutSession: { $allOperations: tenantScopedAllOperations },
  formAnalysis: { $allOperations: tenantScopedAllOperations },
  mealPlan: { $allOperations: tenantScopedAllOperations },
  mealLog: { $allOperations: tenantScopedAllOperations },
  encounter: { $allOperations: tenantScopedAllOperations },
  medicalRecord: { $allOperations: tenantScopedAllOperations },
  prescription: { $allOperations: tenantScopedAllOperations },
  anamnesis: { $allOperations: tenantScopedAllOperations },
  assessment: { $allOperations: tenantScopedAllOperations },
  progressPhoto: { $allOperations: tenantScopedAllOperations },
  attendance: { $allOperations: tenantScopedAllOperations },
  appointment: { $allOperations: tenantScopedAllOperations },
};
