# ADR-0017 — Isolamento de tenant (defense in depth)

**Status:** Proposto (mesa, jul/2026). Decisões D-150 – D-155.
**Destino:** `docs/adr/0017-tenant-isolation.md`
**Relacionados:** go-live blocker #1; bond como entidade central; `tenantId` já presente nos modelos; `$transaction` usado em todos os fluxos de cadastro (atomicidade auditada slice a slice); [ADR-0016](0016-storage-arquivos.md) (arquivo escopado por tenant).
**Classe:** decisão de fundação — **bloqueador de go-live**. Enquanto não implementado, invariantes transversais (vazamento cross-tenant) não têm gate sistêmico: hoje a proteção depende de cada dev lembrar de filtrar por `tenantId` em cada query, o que é frágil por construção.

---

## Contexto

Os modelos já carregam `tenantId` (estrutura correta), mas **não há gate sistêmico** que impeça vazamento cross-tenant. A proteção atual é convenção: cada repositório filtra por `tenantId` manualmente. Isso é exatamente o anti-padrão "validar em vez de construir" — depende de todo dev, em todo commit, para sempre, lembrar do filtro; um esquecimento vaza dado de outro tenant.

Num produto de **saúde multi-tenant** (clínicas, academias, cada uma com seus pacientes/alunos e dado clínico), vazamento cross-tenant é o incidente mais grave possível — expõe dado de saúde de um estabelecimento a outro. Por isso é o **blocker #1 de go-live**.

Evidência de produção (relatos públicos de SaaS multi-tenant com Prisma/Postgres): equipes que dependiam só do filtro manual tiveram incidentes de exposição cross-tenant pegos em code review — que nunca deveriam ter sido possíveis. Após adotar injeção automática via extension, os incidentes foram a zero. A lição: **tirar do dev a responsabilidade de lembrar.**

---

## Decisão

Isolamento em **três camadas (defense in depth)**. Cada camada cobre o furo da outra; vazar dado exige furar as três simultaneamente.

### D-150 — Camada 1: contexto de tenant via AsyncLocalStorage
O `tenantId` da requisição vive num **contexto implícito** (AsyncLocalStorage), estabelecido no início da requisição (a partir da sessão/auth). **NÃO** passar `tenantId` como parâmetro por método de service.
- Motivo (evidência de produção): passar `tenantId` por parâmetro polui as assinaturas e é fácil perder o contexto em chamadas aninhadas. AsyncLocalStorage torna o contexto sempre disponível, implicitamente.
- Garantia: nenhuma operação de negócio roda sem um tenant válido no contexto. Acesso anônimo não alcança a lógica de dados.

### D-151 — Camada 2: Prisma Client extension injeta `tenantId` em toda query
Uma extension do Prisma Client adiciona `tenantId` (lido do contexto da Camada 1) ao `where`/`data` de **toda** operação, em todos os modelos com tenant.
- O dev **nunca escreve** o filtro de tenant → **não pode esquecer**. Esta é a camada principal de filtragem, e é barata (sem overhead relevante).
- Cobre o caso comum: 100% das queries feitas via Prisma Client ficam escopadas automaticamente.

### D-152 — Camada 3: Postgres RLS como última linha, **seletiva** (não em tudo)
Row-Level Security habilitada **apenas nas tabelas mais sensíveis** — **não** em todas.
- **Tabelas com RLS (proposta inicial, revisar na implementação):** `Bond`, dado clínico (anamnese, plano, documentos/exames), financeiro (Asaas/cobrança), `TermsAcceptanceEvent`, `Attachment`/arquivos, **`intern_profile`**. Ou seja: bond + dado de saúde + financeiro + prova de consentimento + vínculo de supervisão.
- **Por que `intern_profile` entra (avaliado nesta mesa):** a tabela materializa o vínculo estudante→supervisor dentro do tenant (`tenantId`, `area`, `supervisorProfessionalProfileId`, `accountId`) — é **dado pessoal** que revela quem estagia sob quem, em qual empresa e em qual área. Vazá-lo expõe a composição do quadro de uma clínica/academia concorrente. Não é dado clínico, mas é relacional e pessoal o bastante para justificar a terceira camada. **`intern_invite`** fica **fora** do RLS na proposta inicial: é registro transitório de convite (e-mail + hash de token, expirável e revogável), sem dado clínico, e o custo de policy não se justifica — mas **continua** coberto pelas Camadas 1 e 2 e pelo índice de D-154.
- **`reception_profile` entra pelo MESMO racional** (D-156): materializa quem trabalha na recepção de qual empresa — dado pessoal que revela a composição do quadro administrativo. Não é dado clínico (recepção nunca acessa dado clínico), mas é relacional e pessoal o bastante. **`reception_invite`** fica **fora**, como `intern_invite` e pelo mesmo motivo.
- **Por que seletiva:** RLS em todas as tabelas adiciona overhead relevante ao planejamento de query (relato de produção: ~15% em 40+ tabelas; caindo para <3% ao restringir às ~8 mais sensíveis). O custo só se justifica onde o dado é crítico.
- **O que RLS pega que a extension não pega:** `$queryRaw`/`$executeRaw` crus, e qualquer acesso que escape do ORM — o próprio banco filtra. É a rede de segurança contra bug na Camada 2.
- Mecânica: variável de sessão Postgres (`SET app.current_tenant_id`) por transação + policy `USING (tenantId = current_setting('app.current_tenant_id'))`. `FORCE ROW LEVEL SECURITY` nas tabelas com policy. App conecta como role **sem** BYPASSRLS.

### D-153 — Compatibilidade com `$transaction` é requisito, não detalhe
**Risco técnico central:** o exemplo oficial de extension de RLS do Prisma envolve cada query numa nova transação em batch, o que **pode quebrar `$transaction()` explícito**. O FITVO usa `$transaction` em **todos** os fluxos de cadastro (atomicidade auditada em #97/#102/#103/#105/#108 e no slice de academia). A implementação **NÃO PODE** quebrar essa atomicidade.
- A extension de filtragem (D-151) e o set da variável de sessão do RLS (D-152) devem funcionar **dentro** de `$transaction` sem envolver cada query numa transação própria.
- Teste obrigatório: os fluxos atômicos existentes (criar tenant+account+profile+specialty+terms numa transação, com rollback real) continuam atômicos com o isolamento ligado. Rollback real contra Postgres, como nos slices anteriores.

### D-154 — Índice em `tenantId` obrigatório
`@@index([tenantId])` em **toda** tabela com `tenantId`. Sem índice, query filtrada por tenant vira full table scan e degrada catastroficamente em escala. Auditar que todos os modelos com tenant têm o índice — **incluindo as tabelas do seat de estagiário criadas em #109/#110, `intern_profile` e `intern_invite`**, ambas escopadas por tenant e portanto sujeitas às três camadas e a esta regra de índice.

### D-155 — Role de banco sem BYPASSRLS
A aplicação conecta ao Postgres como role de permissões limitadas, **sem** o atributo BYPASSRLS (superusers e roles com BYPASSRLS ignoram RLS). Migrations/admin que precisem contornar usam role separada, explícita, nunca a role da aplicação.

---

## Nota de implementação — predicados de isolamento já existentes

Alguns repositórios já carregam o escopo de tenant **dentro** de predicados nomeados, e a extension (D-151) vai **atravessá-los** — não substituí-los. O caso a ter em mente na implementação:

- **`eligibleSupervisorWhere(tenantId, area)`** (`apps/api/src/modules/intern/prisma-intern-repository.ts`) — predicado de elegibilidade do supervisor do estagiário (D-143). É um **predicado de isolamento**: além do `tenantId` explícito no topo, ele filtra por **relação aninhada** (`tenant: { type: { in: COMPANY_TENANT_TYPES } }`) e por credencial de conselho. Quando a injeção automática entrar, o `tenantId` escrito à mão vira redundante — **redundância aceitável e desejável**, não conflito — mas o **filtro aninhado sobre `tenant`** é o ponto de atenção: a extension precisa escopar a relação aninhada também, e não apenas o modelo raiz, sob pena de a query cruzar tenant por dentro do `include`/`where` de relação. Auditar todos os predicados nomeados desse tipo no slice de isolamento, antes de remover qualquer filtro manual.

---

## Consequências

- **Vazar dado cross-tenant passa a exigir furar as 3 camadas ao mesmo tempo** (bug no contexto + extension malconfigurada + tabela sem RLS) — probabilidade praticamente nula. O gate sistêmico que faltava passa a existir.
- **Slice transversal e de alto risco:** toca o schema inteiro, todos os repositórios, e a camada de conexão. É o slice mais amplo do projeto — roda **sozinho**, depois do cadastro fechar, nunca em paralelo com outro slice (colisão garantida).
- **Migração de RLS é forward, aplicada com cuidado** (edita o SQL da migração pra adicionar as policies). Testar em dev antes.
- **Overhead controlado** por manter RLS seletivo (D-152): <3% ao restringir às tabelas sensíveis.
- **A extension vira o cliente Prisma padrão da aplicação** — todo acesso a dados passa por ela. Acesso administrativo/cross-tenant legítimo (se houver) usa um caminho explícito e separado, nunca o cliente padrão.
- Herança: o [ADR-0016](0016-storage-arquivos.md) (arquivo escopado por bond/tenant) e todo slice futuro (treino, nutrição, agenda) nascem sob este isolamento — não redecidir por feature.

## Alternativas consideradas

- **Só Prisma extension (sem RLS):** rejeitada como única camada — não protege `$queryRaw`, migrations, nem acesso fora do ORM. Boa como camada principal (D-151), insuficiente sozinha.
- **Só RLS em todas as tabelas (sem extension):** rejeitada — overhead ~15%, interação problemática com `$transaction`, e sem a extension o dev ainda escreve queries manuais sujeitas a erro em tabelas sem policy. RLS fica seletivo (D-152), não universal.
- **Filtro manual por `tenantId` (status quo):** rejeitada — é o problema, não a solução. Depende de memória humana em todo commit; um esquecimento vaza dado.
- **Schema-por-tenant / banco-por-tenant (isolamento físico):** rejeitada para o MVP — operacionalmente caro (migrations × N schemas, pool de conexões), desnecessário para o perfil SMB de clínicas/academias. Row-level com as 3 camadas dá isolamento forte sem esse custo.
- **ZenStack (policies no data model):** considerada — mantém as policies junto do modelo, mas adiciona dependência de framework sobre o Prisma. Não adotar agora; reavaliar se a manutenção das policies crescer.
