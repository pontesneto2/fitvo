# Roadmap FITVO

> Fonte única do plano de execução. Substitui qualquer backlog interno de
> sessão — o backlog do agente deve espelhar este documento, nunca o
> contrário. Atualizar sempre que uma fase mudar de status. As decisões de
> arquitetura por trás de cada item vivem em `docs/adr/` (D-001 a D-132); a
> identidade visual em `docs/design-system.md`.

Convenção de status: **FEITO** (mergeado em `main`, com PR), **EM ANDAMENTO**,
**PENDENTE** (planejado, ordem de execução pretendida), **BLOQUEADO —
RESPONSÁVEL** (decisão que só você pode tomar), **BLOQUEADO — TERCEIROS**
(jurídico, credenciais, design externo).

---

## FEITO

| # | Item | PR | Observação |
|---|------|----|------------|
| 1 | Fase 1 — Fundação técnica (monorepo, tooling, CI, Docker, envs, esqueleto dos packages de abstração) | inicial, sem PR (`main` direto) | Sem regra de negócio, conforme escopo. |
| 2 | Fase 2 — Autenticação e identidade (Account/Tenant/ProfessionalProfile/PatientProfile, Argon2+JWT+refresh rotation, `/v1/auth`) | #7 | MFA (D-030) e verificação de registro profissional deferidos. |
| 3 | Clínica & convites (convite admin→profissional, gestão de membros, admin puro sem dado clínico — D-012/D-015/D-048) | #9 | |
| 4 | Paciente & Vínculo (convite profissional→paciente, `Bond` = paciente↔profissional+especialidade — D-006/D-052/D-055) | #10 | |
| 5 | Consentimento + motor de compartilhamento (`Consent` escopado no paciente, fila BullMQ, sugestão de overlap — D-016/D-017/D-054) | #11 | |
| 6 | Financeiro — núcleo (Plan/Subscription, Charge/split, WebhookEvent, `/v1/billing`, adapter Asaas — ADR-0004) | #13 | Gated: Asaas ao vivo, preços comerciais, texto jurídico de estorno. |
| 7 | Esqueletos de conteúdo (Exercise/Workout, Food/MealPlan, Encounter/MedicalRecord/Prescription, Assessment — ADR-0006) | #14 | SÓ schema. Campos finos deferidos (`detail Json?` + TODO(D-063)). Sem slice de API. **`MedicalRecord` foi um erro do esqueleto e morre no item 5b** (D-122 — o prontuário É o vínculo). |
| 8 | Adapters das abstrações (observability/pino, cache/Redis, storage/S3, notifications, ai/Anthropic — ADR-0005) | #15 | Todos com fake/mock testável + gate para uso ao vivo. |
| 9 | Upgrade de infra (Node 22, eslint 10, commitlint 21, vitest 4) | #16 | TypeScript e Prisma majors deliberadamente NÃO subiram (ver PENDENTE). |
| 10 | Design tokens (`brand-tokens` populado: cor, tipografia, elevação, ícones Lucide, densidade) | #18 (aberto) | Ver EM ANDAMENTO — aguardando revisão/merge. |
| 11 | Cola de framework (`ui-web` preset Tailwind + CSS vars; `ui-mobile` ThemeProvider) | #18 (aberto) | |
| 12 | Primitivos de UI §1–§18 (Button, Input/Field/Textarea, Checkbox/Radio/Switch, Select/Combobox, Card, Badge, Tabs, Menu lateral, Breadcrumb, Modal, Toast, Tooltip, estados de tela, Tabela, Avatar) + `Logo` (wordmark fechado, mark provisório) | #18 (aberto) | 227 testes (`brand-tokens` 18 + `ui-web` 127 + `ui-mobile` 82). Consolidado de uma branch de trabalho local que não tinha PR nem push — risco de perda eliminado. |
| 13 | Isolamento de tenant sistêmico — as 3 camadas (D-150 AsyncLocalStorage, D-151 Prisma Client extension, D-152 Postgres RLS seletivo — **ADR-0017**) | #121, #122, #127 | Fecha o achado #1 (mais grave) do inventário de promessas-sem-gate — vazamento cross-tenant agora tem gate sistêmico, não só disciplina manual. |
| 14 | Bloco 1 de treino — taxonomia de grupo muscular (`MuscleGroup`, D-164), retrofit de `tenantId` nas tabelas do domínio e biblioteca de exercícios comum vs. sensível (D-168–D-171 — **ADR-0009**) | #131 | Schema + retrofit; segue a ordem "tenant isolation antes de treino" (D-166). |

## EM ANDAMENTO

- **PR (branch `docs/repo-standardization`)** — Padronização do repositório para
  nível de sistema grande: README raiz reescrito como vitrine (o índice de ADR +
  mapa D→ADR migrou para `docs/adr/README.md`), metadados do GitHub (description,
  topics), templates de PR (com campo de área crítica da Política de Merge) e de
  issue (bug/feature), `LICENSE` proprietária (all rights reserved — repo público
  para avaliação), CODEOWNERS mapeando as áreas críticas, e **gate de commitlint
  no CI** (fecha o furo: antes só rodava local, bypassável com `--no-verify`).
  Docs/infra, baixo risco pela Política de Merge.
- **PR #17** (`docs/politica-de-merge`) — Política de Merge + este roadmap.
  Este próprio commit ajusta a ordem do PENDENTE abaixo, a pedido do
  responsável, antes do merge.
- **PR #18** (`feat/ui-primitivos`) — consolida `brand-tokens` + `ui-web` +
  `ui-mobile` (primitivos §1–§18 + `Logo`) em `main`. Verificado localmente
  (typecheck/lint/test/build 100% verdes, monorepo inteiro); aguardando
  revisão antes do merge (volume grande, mesmo sendo área de baixo risco pela
  Política de Merge).

## PENDENTE (ordem de execução pretendida)

Reordenado em 2026-07-16 a pedido do responsável: **a AGENDA sobe**. Motivo — o
fluxo de nutrição e medicina **começa no agendamento**; é a porta de entrada
dessas especialidades (a consulta é onde a anamnese presencial acontece —
D-101/D-102). Mantém-se a ordem anterior no resto: conteúdo antes de
dashboard/IA, porque dashboard sem conteúdo é gráfico de tabela vazia.

> **Ressalva do agente (leitura, não objeção):** agenda antes de nutrição é
> sequenciamento de **produto**, não dependência **técnica** — o plano alimentar
> pendura no vínculo, não no agendamento; os dois poderiam ir em paralelo. E a
> agenda tem uma parte **gated**: as peças 2 e 3 do D-107 (escrever no Google, ler
> free/busy) dependem de credenciais OAuth. Por isso ela entra **partida em dois
> itens**: o motor próprio (ungated, é a porta de entrada) e o sync Google
> (gated). Assim a agenda subir não trava nada.

1. **Apps web** (`web-personal`, `web-admin`, `site`) — App Router + TanStack
   Query + client de API + tema/dark + fontes; telas de auth e shell de
   dashboard derivadas do design system. Depende do merge do PR #18.
2. **Agenda — motor próprio** (D-106/D-108 a D-111, **ADR-0012**): banco e motor
   próprios (disponibilidade, detecção de conflito, agendamento por vínculo),
   confirmação de presença + lembretes configuráveis + no-show (D-108), política
   de retorno por profissional (D-109 — grátis/reduzido/cheio; **não** se aplica a
   personal), estatísticas (D-110), tudo em UTC (D-111). **Não** depende de
   credencial: é a porta de entrada de nutrição/medicina. Toca **financeiro**
   (D-109) → **revisão humana obrigatória**.
3. **Agenda — sync Google Calendar** (D-107, ADR-0012): package `calendar` novo
   (interface + adapter Google + fake, padrão da ADR-0005). As 3 peças: FITVO é
   fonte da verdade; todo agendamento aparece no Google do profissional; FITVO lê
   **free/busy** (nunca o conteúdo do evento). Push notification + sync token, com
   polling ~15min de fallback. **Gated em credenciais OAuth** (ver BLOQUEADO —
   TERCEIROS) — o fake permite construir e testar sem elas. Escopo estreito de
   propósito: sem bidirecional de campos, sem Outlook/Apple, sem recorrência
   complexa.
4. **Anamnese tipada + modalidade** (D-101 a D-103, **ADR-0011**): modalidade do
   vínculo (`ONLINE`/`PRESENCIAL`/`HIBRIDO`) no `Bond` e no `PatientInvite`,
   anamnese em colunas tipadas com **autoria por seção**, núcleo + módulo treino.
   **Em andamento** — ver EM ANDAMENTO. Dado clínico → **revisão humana
   obrigatória**.
5. **Domínio de nutrição** (D-112 a D-121, **ADR-0013**) — o D-063 fecha para
   nutrição:
   - Cria o nível **`Meal`** que falta (`MealPlan → Meal → MealPlanItem`) e
     **destrava o D-118/D-104**; mata o `detail Json?` de nutrição.
   - **`FoodGroup` com equivalência** (D-114) — substituição por grupo, não item a
     item; referência TACO.
   - Plano **por dia da semana** (até 7 ativos — D-112), **calculado ou texto
     livre** (D-115), com meta calórica e macros em tempo real (D-116).
   - **`MealLog`** três estados + foto (D-118), check-in, sync offline, alertas
     nos horários.
   - Templates + base compartilhada (D-117), entregáveis (D-119), indicadores
     (D-120). Dado clínico → **revisão humana obrigatória**.
5b. **Domínio de medicina — nutrologia esportiva** (D-122 a D-132, **ADR-0014**)
   — **o D-063 fecha para a TERCEIRA e última especialidade**. Nenhum domínio de
   conteúdo continua em `detail Json?` depois deste lote. Fases (a ordem é
   dependência, não preferência — ver o ADR):
   - **Fase 0 — fontes do congelamento — PR PRÓPRIO** (pré-requisito do D-130,
     **não existem no schema**): **UF do conselho** e **RQE** no
     `ProfessionalSpecialty` (o lugar já está certo — é o D-046: CREF e CRN são
     conselhos distintos da mesma pessoa; **não** mover para o perfil), dados da
     clínica no `Tenant` (endereço, cidade/UF, telefone, e-mail, logo), data de
     nascimento e **sexo** do paciente (o sexo também destrava as faixas de
     referência dos exames). **Toca auth/tenant → área crítica; não vai junto com
     domínio clínico.**
   - **Fase 1 — limpeza:** mata `MedicalRecord` (D-122 — o prontuário É o vínculo)
     e os três `detail Json?` (`Encounter`, `Prescription`, `Assessment`).
   - **Fase 2 — prontuário:** `Encounter` tipado (D-123, `appointmentId` já
     correto) + **`Assessment` tipado** (D-132) com **protocolo de dobras +
     dobras aferidas**, **data da aferição**, e **ângulo + ligação** na
     `ProgressPhoto`. **Destrava o bloco de antropometria** (ADR-0011).
   - **Fase 3 — exames laboratoriais** (D-124): catálogo (faixas por **sexo e
     faixa etária**) + solicitação + resultado com **valores estruturados**
     (**`Decimal`** — o primeiro do schema; nunca `Float`). Destrava o **módulo de
     nutrologia da anamnese** (D-103) e, com ele, o **D-128**.
   - **Fase 4 — documentos emitidos:** **`Guidance`** (D-125) e
     **`MedicalPrescription`** (D-126 — só médico, sem biblioteca de
     medicamentos, sem controlado) como **entidades separadas**; declaração de
     comparecimento (D-127, derivada do `Appointment` `COMPLETED`); todos com
     **congelamento** (D-130) e ciclo **`DRAFT`/`ISSUED`/`CANCELLED`** (emitido é
     imutável; correção = cancelar com motivo + emitir novo). Depois
     favoritos/modelos/repetir (D-131).
   - Dado clínico + auth/tenant → **revisão humana obrigatória**. Plano de
     modelagem **aprovado**; a ordem das fases é dependência, não preferência.
6. **Videoconferência — treino e nutrição** (D-074/D-075, ADR-0007): package
   `video` novo (interface + adapter Daily/Prebuilt + fake, mesmo padrão dos
   demais adapters da ADR-0005). Habilitado nos ambientes de treino e
   nutrição; **bloqueado em medicina** por exigência regulatória (ver item 8 e
   BLOQUEADO — TERCEIROS). Ancora-se num atendimento/vínculo já modelado.
7. **IA (D-022)** — a abstração multi-provider já existe
   (`packages/ai`, `AnthropicAIProvider` + `FakeAIProvider`, PR #15) com
   `embed()` propositalmente não suportado (Anthropic não oferece
   embeddings). Falta definir os casos de uso de produto que consomem IA
   (sugestão automática, geração de plano, etc.) — não inventar sem ADR. Inclui a
   **análise de forma** (D-088): o `FormAnalysis` já existe no schema; falta o
   worker de pré-análise. Pressupõe conteúdo existente (itens 4/5).
8. **Telemedicina + receita eletrônica** (D-011/D-075, mesma fase): vídeo em
   medicina e prescrição eletrônica dependem ambos de a FITVO se registrar
   como pessoa jurídica prestadora no CRM do estado + assessoria jurídica
   (Resolução CFM nº 2.314/2022) — ver BLOQUEADO — TERCEIROS. Até lá, receita
   permanece impressa/assinatura física e vídeo permanece bloqueado nesse
   ambiente. **Traz junto o módulo de nutrologia da anamnese** (D-103), que
   depende de exames laboratoriais (D-076).
9. **Check-in genérico** — registro por vínculo/especialidade (mencionado em
   D-001; sem ADR de detalhe genérico). **Já resolvido nos dois domínios que
   importam:** conclusão de treino conta como check-in (D-086) e registro de
   refeição também (D-118). Restou pouco — reavaliar se o item genérico ainda faz
   sentido ou se some.
10. **Notificações reais** (push/email/SMS ao vivo) — a estrutura de adapter já
   existe (`packages/notifications`, PR #15) e o modelo `Notification` entrou no
   #26; falta o disparo ao vivo, que depende de credenciais (Firebase, provedor
   de e-mail/SMS) — ver BLOQUEADO — TERCEIROS.
11. **Dashboard e relatórios** — telas de indicadores para profissional/clínica
   (financeiro, atendimentos, adesão, **e adesão/evolução de conteúdo** — precisa
   dos itens 4/5 com dado real para exibir). Agora com fonte definida: D-092
   (treino), D-110 (agenda) e D-120 (nutrição).
12. **Perfil público do profissional** (D-077, ADR-0008): página opt-in no app
    `site` (`fitvo.com.br/<slug>`), com selo de verificação (D-010) e botão
    "solicitar contato" reaproveitando o convite profissional→paciente
    (D-006/D-055) já existente. Sem busca/vitrine/ranking/reviews/comissão —
    fora de escopo por decisão (ver ADR-0008). Depende de apps web (item 1)
    pelo componente `Logo`/design system compartilhado com o `site`.
11. **White-label estrutural** (D-078, ADR-0008): campos de marca por tenant
    (nome/logo/tokens) no schema, **sem ativação** — MVP sempre renderiza
    FITVO. Esqueleto acompanha a modelagem de tenant existente; não é item
    isolado de execução enquanto não houver demanda comercial de ativação.
12. **Mobile (Expo)** — app "3-em-1" (aluno + profissional), Expo Router +
    TanStack Query. Ainda não iniciado; bloco próprio, depende de apps web e
    design mobile estarem maduros.
12b. **Offline-first do app do aluno** (D-099/D-100, ADR-0010): WatermelonDB
    (SQLite como fonte da verdade) + **servidor de sync próprio** (dois
    endpoints pull/push + conflito idempotente — item mais caro do lote),
    escopo delimitado (planos ativos + execuções pendentes), criptografia local
    obrigatória, tombstones (`deletedAt`) + `updatedAt` indexado nas tabelas
    sincronizáveis. **Exige development build** (adeus Expo Go). Depende do item
    12 (mobile) e do domínio de treino ter dado tipado, não `Json`, para o merge
    por campo funcionar — colunas tipadas já existem (`WorkoutPlan`/`WorkoutSet`,
    D-081, ver FEITO #14); resta a API/slice de execução.
13. **Testes ao vivo das integrações** (Asaas sandbox, IA real, FCM, e-mail,
    SMS, Daily) — hoje todos gated por ausência de credenciais no ambiente.
    Rodar exige as credenciais reais (ver BLOQUEADO — TERCEIROS).
14. **Deploy** (Vercel + Railway) — infraestrutura de deploy ainda não
    configurada; requer credenciais + ordem explícita de publicação.

### Fluxo de validação do trabalho do estagiário — BLOQUEADO no domínio de treino

**O que é:** o estagiário produz um treino/prescrição → **envia** → fica
**pendente** → o **supervisor revisa/ajusta/valida** → só então **chega ao
aluno**. Estagiário **nunca** entrega direto ao aluno: a validação do
responsável é o que torna o trabalho dele legítimo (D-142; art. 47, DL
3.688/1941).

**Por que está parado:** depende do **domínio de treino/prescrição**, que ainda
**não existe**. Não há o que submeter a validação enquanto não houver o objeto
"treino prescrito". Adiantar isso seria construir uma fila de aprovação sem
nada para aprovar.

**Onde engata (já pronto):** a relação
`ProfessionalProfile.supervisedInterns` ⇄ `InternProfile.supervisor` — vínculo
`NOT NULL` criado no slice de identidade do estagiário (D-142). Quando o treino
existir, o fluxo pendura **nesse vínculo**: quem valida é o supervisor daquele
estagiário, e ele já está gravado. Há `TODO(treino)` no schema Prisma
(`ProfessionalProfile.supervisedInterns`) e no ponto do repositório onde o
vínculo nasce (`prisma-intern-repository.ts`, no `acceptInvite`).

**O que este item NÃO é:** não é decisão pendente do responsável nem bloqueio de
terceiro — é **ordem de construção**. Sai sozinho assim que o domínio de treino
estiver de pé.

### UI do estagiário — slice próprio

O seat de estagiário entregou **API + contrato** (D-142). Falta a UI: (a) tela
da academia para pré-cadastrar (Fase A, com o select de responsáveis vindo de
`GET /v1/interns/:tenantId/supervisors`); (b) aceite do estagiário (Fase B). A
página `/convite/aceitar` hoje é fechada no formato do convite de profissional —
a UI do estagiário precisa **resolver o tipo do token antes de renderizar**, que
é o trabalho de fato deste slice.

### Mobile: consumir `profileComplete` (gate de completar-perfil)

O gate (D-157) está de pé na API e no web-personal (guard no shell +
`/completar-perfil`). O app mobile ainda **não** consome `profileComplete` de
`/me` — um profissional de clínica pré-cadastrado entra no mobile sem o gate.
Reusar a mesma derivação do servidor: a superfície só consome, nunca recalcula.

### Endereço como pedido contextual (decorrência do D-157)

Endereço ficou **fora** do mínimo funcional do gate. Onde ele for necessário, é
pedido no fluxo que precisa dele — não no login. Paciente já o coleta no aceite
(spec §4.6); o profissional de clínica/academia precisará informá-lo ao
**configurar recebimento**, junto do processo documental do Asaas (fora do
cadastro por decisão de spec §3). Enquanto esse fluxo não existe, o
profissional convidado opera sem endereço, o que é aceitável: nada no MVP
depende dele.

### UI da recepção — slice próprio

O seat de recepção entregou **API + contrato** (D-156, #115). Falta a UI: (a)
tela do admin para pré-cadastrar (Fase A — só e-mail e nome, sem select de
responsável, ao contrário do estagiário); (b) aceite da recepcionista (Fase B,
campos completos). Compartilha com a UI do estagiário o mesmo pré-requisito: a
página `/convite/aceitar` precisa **resolver o tipo do token antes de
renderizar** — hoje ela é fechada no formato do convite de profissional. Vale
tratar os dois no mesmo slice, já que o trabalho difícil é o mesmo.

## BLOQUEADO — RESPONSÁVEL (decisão que só você pode tomar)

- **⚠️ ISOLAMENTO DE TENANT SISTÊMICO — RESOLVIDO (ADR-0017, PRs #121/#122/#127
  — ver FEITO #13).** Era o achado **#1 e mais grave** do inventário de
  promessas-sem-gate (`docs/promessas-sem-gate.md`, #73): o isolamento de tenant
  **não tinha gate sistêmico** — o que impedia um tenant de ver dados de outro
  era só **disciplina** (o dev lembrar do escopo de `tenantId`), e nada
  REPROVAVA uma query que esquecesse. Fechado em três camadas: **D-150**
  (contexto de tenant via AsyncLocalStorage), **D-151** (Prisma Client extension
  injeta `tenantId` em toda query) e **D-152** (Postgres RLS seletivo nas
  tabelas mais sensíveis — `bond`, dado de saúde, financeiro, vínculo de
  supervisão/recepção). Detalhe completo em `docs/adr/0017-tenant-isolation.md`.
  - **Relacionado, ainda não fechado:** os itens AUDITAR 4 e 5 do mesmo mapa
    (admin puro não vê dado clínico; leitura só com consentimento) são da
    **mesma família** — mesmo gate sistêmico, alvo diferente.
- **⚠️ OBRIGAÇÕES ENFRAQUECIDAS NA DESTILAÇÃO — definir como enforçar. Área
  crítica (auth + LGPD).** Auditoria ADR × histórico bruto (D-001–D-073, palavra
  de força a palavra de força; a **classe** do defeito está em
  `docs/troubleshooting.md` §18): **duas obrigações ativas viraram registro/menção
  passiva** na síntese do ADR — ninguém decidiu enfraquecê-las, evaporaram na
  tradução. Não é "decidido e não implementado": é "decidido e DESTILADO ERRADO".
  - **D-029 (auth):** histórico diz "verificação de e-mail **obrigatória**"; o
    ADR-0002 destilou para "verificação de e-mail". O mecanismo existe inteiro,
    mas **nada enforça** — o login não checa e-mail verificado.
  - **D-025 (consentimento/LGPD) — RESOLVIDO.** Histórico dizia "**exigir novo
    aceite quando o termo muda**"; o ADR-0005 tinha destilado para "versionado
    (**registrar** qual versão foi aceita)" — registrar ≠ re-consentir, era
    exposição LGPD direta. Decisão fechada e implementada: aceite dos dois
    documentos (Termos de Uso, Política de Privacidade) **obrigatório no
    cadastro** (bloqueia a criação da conta — `acceptedTerms` com literais
    `true`, Zod rejeita qualquer outro valor com 400) e gate de
    **re-consentimento em ações sensíveis** (mesma família/posição de chain do
    gate de e-mail verificado — D-029) quando uma versão **materialmente**
    diferente é publicada depois do último aceite, ou o aceite foi revogado.
    Detalhe completo na nova seção "Aceite de termos e re-consentimento
    (D-025)" do `docs/adr/0002-identidade-e-auth.md`; código em
    `apps/api/src/modules/terms/` (+ gate em `shared/auth-context.ts`).
    O gate cobre os dois documentos obrigatórios (`TERMS_OF_USE` e
    `PRIVACY_POLICY`), cada um avaliado independentemente nos mesmos call
    sites. Pendências deixadas registradas nessa mesma seção do ADR (não
    bloqueiam o fechamento): contas criadas via aceite de convite (não
    autocadastro) ainda não recebem o aceite inicial; o conteúdo/hash real dos
    textos jurídicos segue GATED (ver item "Textos jurídicos" abaixo).
  - **Menores (registrados, baixa severidade):** D-018 (a trava "não atende antes
    da subconta" não é enunciada no ADR-0004), D-027 ("opt-out de e-mail é
    **requisito legal**" diluído), D-019 ("aluno **sempre grátis**" sobrevive só
    por implicação estrutural).
  - **NÃO são defeito (revisão deliberada, apenas anotado):** D-014 (o ADR
    *apertou* a regra), D-021 (revisão datada da taxa no estorno), D-012 (clínica
    modelada por completo). Revisão consciente ≠ destilação errada — confundir as
    duas seria o erro.
- **Apps web**: liberar o início do item 1 do PENDENTE depende do merge do PR
  #18 (`brand-tokens`/`ui-web`/`ui-mobile`) e da sua confirmação de que estão
  maduros o suficiente para consumo em produto.
- **TypeScript 6/7**: bump depende de o `typescript-eslint` lançar suporte a
  TS ≥6.1 (hoje não suporta). Pesquisar `npm view @typescript-eslint/parser
  peerDependencies` periodicamente; quando destravar, é tarefa isolada.
- **Prisma 7**: migração para `prisma.config.ts` + `@prisma/adapter-pg` é
  mudança arquitetural na forma como `PrismaClient` é instanciado em toda a
  API/worker — decisão de quando vale a pena priorizar, não bump direto.

  **Quando destravar, o par sobe em PR MANUAL — nunca via Dependabot.** O
  `prisma` (CLI) é `devDependency` e o `@prisma/client` é `dependency`, e o
  agrupamento do Dependabot é **por `dependency-type`**: eles caem em **grupos
  diferentes**, logo em **PRs diferentes**. Sob essa configuração o par **não
  consegue se mover atomicamente** — e client 7 com CLI 6 (ou o inverso) quebra.
  Não é má sorte: é a configuração garantindo o erro. Foi o que derrubou os PRs
  #5, #12, #32 e #33. Os dois têm que subir no mesmo commit.
- **React 19 + react-native 0.86** — **não é bump, é migração.** O Dependabot os
  ofereceu num grupo de 11 pacotes (PR #38, fechado): `typecheck` e `test`
  vermelhos. O React 19 muda tipos (`ref` como prop, `children` implícito removido)
  e atravessa `ui-web` + `ui-mobile`; o RN 0.86 é salto grande. **PR próprio,
  planejado, com verificação** — e provavelmente um para cada, não os dois juntos.
  - **Nota (pós-#62):** o `web-personal` roda **Next 15 sobre React 18** — o peer do
    Next 15 aceita `^18.2.0 || ^19`, então **subir o Next NÃO exige React 19**. Next
    e React 19 são dívidas **separadas**; esta migração vale só quando se decidir
    mover `ui-web`/`ui-mobile` para React 19, não por causa da versão do Next.
- **`lucide-react` / `lucide-react-native` 0.469 → 1.24 (major)** — o Lucide entrou
  no #20 e o Dependabot já ofereceu o major na sequência (PR #39, fechado). Subir
  major de dependência recém-adotada, junto de patches, é pedir problema. Tarefa
  própria, sem pressa: o 0.469 funciona.
- **Testes de integração do Redis não rodam em lugar nenhum** —
  `packages/cache/src/redis-cache-store.integration.test.ts` **se auto-pula** sem
  `REDIS_URL` e aparece no CI como `4 tests | 4 skipped`. É **verde que mente em
  forma de teste pulado**: existe, parece coberto, e nunca exercita nada. Unificar
  com a convenção do harness (`test:integration` + serviço no CI): **falhar, não
  pular** — se a infra não subir, o job quebra. Ver `.github/workflows/ci.yml`, job
  `migrate`, e `packages/database/src/*.integration.test.ts`.
- **`web-personal`: importar os DTOs de auth de `@fitvo/contracts` (a terceira fonte
  existe AGORA).** O #65 (D-032) populou o pacote: `@fitvo/contracts` exporta
  `AuthResult`/`AccountSummary`/`LoginInput`/`MeResult`/`Tokens` — tipos de wire
  inferidos dos schemas Zod de `@fitvo/validation` (fonte única), com job de CI
  (`contract`) que reprova se dessincronizar da API. O esqueleto do `web-personal`
  (#62) definiu esses tipos **localmente** (`apps/web-personal/src/lib/auth.ts`)
  porque o contracts estava vazio na época — agora **duplicam** o que o contracts
  exporta (a terceira fonte que o D-032 existe para evitar). **Próximo item do
  `web-personal` (quando a sessão voltar):** importar os tipos de `@fitvo/contracts`
  + o schema de validação de `@fitvo/validation`, remover os locais. **Com um teste
  de INTEGRAÇÃO** que confirme que o contrato importado bate com o que a API responde
  de verdade — a lição do forwardRef aplicada: teste isolado não pega desvio de
  contrato, só o caso real pega. Dívida que **endurece** conforme o `web-personal`
  cresce sobre os tipos locais.
- **~~Os controles do `ui-web` não fazem `forwardRef`~~ — RESOLVIDO.** `Input`,
  `Textarea`, `Select`, `Checkbox`, `Radio` e `Switch` **agora encaminham o `ref`**
  ao elemento nativo (`mergeRefs` funde com o ref interno onde há). Habilita o
  `register()` uncontrolled do React Hook Form (ADR-0005); o `web-personal` voltou de
  `Controller` para `register()`. Teste por controle que **reprova** se o ref não
  chegar. Descoberto ao montar o login (primeiro consumidor real do design system) —
  a suíte de 227 testes verdes não pegava, porque testava render/variantes, não
  integração com formulário.
- **⚠️ LACUNA DE CONFORMIDADE — profissional não-verificado PODE atender.** O
  guard de vínculo exige a especialidade **reivindicada** (`ProfessionalSpecialty`
  — D-046), mas **NÃO** exige `verificationStatus === VERIFIED`. É `TODO(D-010)`
  explícito em [`patient-application-service.ts:322`](../apps/api/src/modules/patient/patient-application-service.ts#L322)
  (mesma regra citada em `packages/database/prisma/schema.prisma:374` e
  `packages/validation/src/auth.ts:59` — "obrigatório preencher" ≠ "verificado",
  reforçada no cadastro do profissional autônomo — D-137/D-138, ADR-0015).
  O **D-051** ("o profissional não atende até ser verificado") está **decidido, não
  implementado** — depende do fluxo de verificação, deferido desde a Fase 2. Fica
  **visível aqui**, não escondido num TODO: num produto de saúde com repositório
  público, alguém reivindica CRM/CRN que não tem e o sistema hoje deixa. Não é bug
  de código — é regra de negócio pendente, e o dono é o fluxo de verificação
  (item deferido). A Fase 0 de medicina (D-130) **modela** `councilState`/`rqe`
  nuláveis de propósito por causa disto: a coluna não impõe verificação; o guard é
  que imporá, quando existir.
- **Notificações reais ainda são stub (D-027).** `packages/notifications/src/notification-dispatcher.ts:52-54`
  registra os três canais (push/e-mail/SMS) sobre o `logging` adapter — nenhum FCM,
  provedor de e-mail ou SMS real plugado. `in-app-notification-store.ts:31` ainda
  não persiste em Prisma (guarda em memória) — `TODO(D-027): impl. Prisma (tabela
  Notification) quando a migração for coordenada`. `logging-notification-sender.ts:10`
  documenta a troca por adaptadores reais quando houver credenciais. **Decisão já
  tomada (D-027/ADR-0005), implementação deferida** — depende de credenciais dos
  provedores (fora do controle do código) e de coordenar a migração do modelo
  `Notification` que o ADR-0005 já descreveu (ver `docs/adr/0010-fluxo-aluno-gates-atendimento.md:243`).
  Efeito hoje: nenhuma notificação sai de fato do sistema — tudo vira log.
- **Entrega via adapter de notificações — parcialmente conectada (D-028).** As
  reguas de plano de treino (D-083 vencimento; D-084 liberação — ADR-0009)
  passaram a ENTREGAR de verdade pelo canal in-app (mock — `buildDefaultDispatcher`,
  `apps/worker/src/index.ts`): não era gap de credencial, era só plugar o
  adapter que já existia. **Dois call sites continuam com o TODO original**
  — `apps/worker/src/sharing/overlap-detection-service.ts` e
  `apps/worker/src/billing/collection-ruler-service.ts` (`TODO(D-028): deliver
  via notifications adapter`) — porque, diferente do plano de treino, o
  **destinatário não está decidido** (quem recebe a sugestão de sobreposição:
  paciente ou profissional? quem recebe o lembrete de cobrança: qual conta do
  tenant?). Não é bloqueio de credencial nestes dois — é decisão de produto que
  o agente não deve inventar; plugar exige essa resposta primeiro.
- **Campos clínicos `detail Json?` — decisão de produto ainda aberta (D-063).**
  Diferente da nutrição (**D-063 FECHADO** ali — ver ADR-0013), os domínios de
  atendimento/prontuário/receita/avaliação ainda guardam conteúdo fino num `Json?`
  genérico, de propósito ("não inventar"): `packages/database/prisma/schema.prisma:1770`
  (`Encounter`, "conteúdo clínico por fase"), `:1792` (`MedicalRecord`, "entradas
  do prontuário por fase"), `:1811` (`Prescription`, "conteúdo da receita por
  fase") e `:2234` (`Assessment`, "campos por especialidade"). Comentário-guia em
  `:873`. Fechar
  cada um depende de ADR próprio por domínio (mesmo processo que já fechou
  nutrição) — não modelar sem ADR, ver seção "Gaps do domínio de medicina" acima
  para o que já está desenhado vs. pendente.
- **Hardening de segurança/estabilidade da API (D-033)** — diagnóstico interno
  contra a promessa "API privada e segura, padrão de sistema grande". Um item era
  vazamento ativo (token de auth em log) e **já foi corrigido — PR #63**. Os
  demais estão priorizados **P2–P5** em `docs/api-hardening-debt.md` (CORS
  restritivo por default; paginação/teto nas listagens; timeout + resiliência de
  dependências externas; topologia do rate limit). **Não implementados** — cada um
  é seu próprio PR na ordem; **P4 toca financeiro → revisão humana obrigatória**.
  O relatório é público-seguro (sem PoC nem `file:line` de vetor aberto); o
  detalhe fino fica fora do repositório até corrigido.
- **Fluxo de dev de auth — entrega do token de verificação/reset (dívida do PR
  #63).** Fechar o token em log (correto — era vazamento) removeu o **único**
  caminho pelo qual o dev obtinha o link de verificação de e-mail / reset de senha
  localmente: o token é **hasheado** no banco, não há como recuperá-lo. Sem isso,
  ninguém testa esses fluxos em dev — e o próprio agente do `web-personal` vai
  bater nisto. **Não é teórico.** Solução recomendada (não implementada — decisão
  de aprovar e escolher a forma): um mecanismo **dev-only atrás de flag de
  ambiente**, que só existe com `NODE_ENV=development` e **falha ruidosamente em
  produção** — numa de duas formas:
  - sender dev-only que escreve o token em **arquivo local** (não em log, não no
    repo, `gitignored`); ou
  - endpoint dev-only que devolve o último token emitido.

  O PR mínimo do #63 foi a escolha certa; isto é o follow-up. Ver
  `docs/api-hardening-debt.md`.
- **`timestamptz` nas 54 tabelas existentes** — **APROVADO; PR #44 aberto,
  aguardando revisão. Mover para FEITO quando mergear.** O contexto a seguir fica
  registrado porque é o que fundamenta a decisão: o D-067/D-111 decidem "tudo em
  UTC", mas o Prisma mapeia `DateTime` para **`timestamp(3)` sem fuso**: a coluna
  guarda UTC **sem saber que é UTC**. Verificado: `DEFAULT CURRENT_TIMESTAMP` numa
  coluna sem fuso grava a **hora local da sessão** — 3h de erro, silencioso. São
  **56 colunas** com esse default. Hoje está correto **por circunstância** (o
  servidor está em UTC; o Prisma não muda o fuso da sessão), não por construção; o
  caminho do Prisma Client é seguro, a exposição é o default do banco e qualquer
  SQL cru/psql/BI. **A janela para corrigir é agora, com o banco vazio:** a
  conversão (`ALTER ... USING x AT TIME ZONE 'UTC'`) é instantânea e
  **trivialmente correta** sem dados. Com dados, além do rewrite com lock, a
  conversão passa a **apostar** que nenhuma sessão jamais escreveu em fuso local —
  a certeza que existe hoje não volta. As tabelas novas da agenda já nascem
  `@db.Timestamptz` (ADR-0012). **Decisão do responsável.**
- **Agenda / Check-in**: não há ADR de detalhe — regra de negócio fina
  (janelas de disponibilidade, política de remarcação, frequência de
  check-in) precisa ser definida antes de implementar além do esqueleto.
- **Adendo ao D-103 (taxonomia da anamnese) — campos adicionais a avaliar**:
  lacunas identificadas depois de o ADR-0011 fechar a taxonomia. Nenhuma é
  bloqueante; entram por decisão sua, não por iniciativa do agente.

  *Núcleo / módulo treino:* **FECHADO — adendo D-187–D-190 (ADR-0011,
  jul/2026, PR #130).** ~~Local de treino~~ virou **contextos de treino** (D-187:
  lista de locais + equipamentos, não campo único — o aluno pode treinar em
  mais de um lugar). ~~Tempo por sessão~~ fechado junto com frequência
  semanal como **orçamento de treino** (D-188). ~~Histórico esportivo~~
  fechado (D-189). ~~Suplementos em uso~~ fechado como catálogo + livre, com
  sinal clínico para substância que exige acompanhamento médico — inclui o
  caso "esteroides" (D-190, reusa o alerta do D-178). Resta apenas
  implementação (schema + telas), não decisão de campo.

  *Módulo nutrição (quando o domínio fechar):*
  - **Escala de Bristol** — instrumento clínico para o "hábito intestinal" que o
    D-103 já pede.
  - **Histórico de peso** (mín/máx adulto, efeito sanfona, bariátrica,
    medicamento para emagrecer).
  - **Comportamento alimentar** (compulsão, fome emocional).
  - **Preferências e aversões alimentares.**

  *Módulo nutrologia (quando o domínio fechar):*
  - **Perfil hormonal masculino/feminino** — é o **núcleo** da nutrologia
    esportiva, não acessório.
  - **Histórico hormonal** (TRT, GH, peptídeos, anabolizantes — substância,
    dose, tempo de uso). O D-103 só tem "uso de esteroides" no módulo de treino:
    **raso demais para o médico**.
  - **Catálogo de exames laboratoriais** — como catálogo do que o médico
    **solicita** (D-076), não campo de anamnese.

  *Transversal:*
  - **Objetivos mensuráveis** (peso alvo, % gordura alvo, **data** objetivo,
    evento específico) — vai além de anamnese: vira **meta com prazo** e
    alimenta dashboard.

  **Rejeitado (com o motivo, para não voltar à mesa):**
  - *Anamnese única compartilhada entre profissionais* — contradiz o D-094
    (documento de prontuário), o D-004 (isolamento por vínculo) e o D-016
    (consentimento). O autopreenchimento já resolve a repetição.
  - *Avaliação física/bioimpedância na anamnese* — medida mora no `Assessment`
    (decisão registrada no ADR-0011: bloco no fluxo, dado no `Assessment`).
  - *Score de Saúde por IA visível ao paciente* — perigosamente perto de
    diagnóstico; contradiz D-023/D-088 (humano no circuito). Se entrar, é
    visível **só ao profissional**, como sugestão, nunca veredito.
  - *Saúde sexual/fertilidade no núcleo* — dado sensível (LGPD); só no módulo de
    nutrologia.
- **Bloco de antropometria (ADR-0011)**: **decisão destravada** — o D-132
  (ADR-0014) tipa o `Assessment`, que era a dependência. Desenho já resolvido
  (bloco no fluxo da anamnese, dado no `Assessment`, invisível em `ONLINE`).
  Não é mais decisão pendente: é implementação, na fase 2 do item 5b.
- **~~Campos finos de nutrição/medicina (D-063)~~ — FECHADO.** As três
  especialidades têm ADR: treino (ADR-0009/0010, MFit), nutrição (ADR-0013,
  Dietbox) e **medicina (ADR-0014, nutrologia esportiva)**; a anamnese pelo
  ADR-0011. **Não há mais decisão de campo fino pendente** — o que resta é
  implementação (itens 5 e 5b) e os gaps pontuais listados abaixo.
- **Gaps do domínio de medicina (ADR-0014)** — citados nas decisões, sem
  definição; não modelar sem ADR. **Três foram resolvidos na revisão do ADR** e
  viraram adendos (faixa de referência por sexo/idade; ciclo de vida do documento
  com cancelamento em vez de edição; protocolo de dobras + série por protocolo).
  Restam:
  - **Resultado qualitativo** (D-124): "negativo"/"reagente" não é número — o
    adendo decidiu o tipo do valor **quantitativo**, não a existência do
    qualitativo.
  - **Unidades** (D-124): string livre quebra a série ("ng/ml" × "ng/mL"); enum
    exige migração a cada exame novo.
  - **Quem emite a declaração de comparecimento** (D-127): o admin da clínica
    pode? Não é dado clínico em conteúdo, mas nasce de dado clínico — o D-015 não
    responde este caso.
  - **Numeração de documento** e **se o paciente vê a receita no app** (D-126/
    D-127): não decididos.
- **⚠️ Receita de medicamento CONTROLADO (D-126) — item de produto/jurídico, não
  de engenharia**: o núcleo da nutrologia esportiva é protocolo hormonal (TRT,
  GH), e **testosterona/anabolizantes são controlados no Brasil** — exigem
  formulário oficial numerado, que o FITVO não imprime. A receita que mais importa
  ao nutrólogo é justamente a que o app não emite. Não inviabiliza (ele usa o
  talonário oficial), mas há uma **costura fora do app** no fluxo premium. Não há
  contorno técnico: é decisão.
- **Gaps do domínio de nutrição (ADR-0013)** — citados nas decisões, sem
  definição; não modelar sem ADR:
  - **Hidratação**: o D-120 pede o indicador, mas nenhuma decisão diz onde a meta
    é prescrita nem como o paciente registra. Não é refeição, não cabe em `Meal`.
  - **Receitas** (D-119): entregável citado, estrutura indefinida — texto livre?
    ingredientes + preparo? vira `Food` do tipo preparação?
  - **Gasto energético** (D-116): a meta calórica sai do "gasto estimado", mas
    qual fórmula (Harris-Benedict, Mifflin-St Jeor, FAO/OMS) e se o sistema
    calcula ou o profissional informa não foi decidido. É regra clínica.
  - **Tabelas nutricionais além da TACO**: o Dietbox usa múltiplas; se `Food`
    precisa registrar a origem (TACO/IBGE/USDA), é atributo não decidido.
- **Dashboard e relatórios**: quais indicadores, para qual persona, com que
  nível de detalhe — **parcialmente resolvido**: D-092 (treino), D-110 (agenda) e
  D-120 (nutrição) já definem o que exibir. Falta a decisão de tela/persona.
- **Casos de uso de IA (D-022)**: quais features realmente usam IA generativa
  no produto (a abstração técnica já existe, falta a decisão de produto).
- **Símbolo final do Logo**: ícones já resolvidos (Lucide oficial); wordmark
  já fechado ("FIT" `brand-500` / "VO" `energy-400`, componente `Logo` em
  `ui-web`/`ui-mobile`, PR #18); falta o símbolo/mark definitivo — hoje o
  componente usa um mark geométrico PROVISÓRIO.
- **shadcn/ui**: adoção para a camada web adiada — decisão condicionada à
  identidade visual (shadcn customizado vs. primitivos puros).
- **Ativação de white-label (D-078)**: quando (e para qual tenant/parceiro)
  vale a pena ligar marca própria — hoje é só estrutura, sem gatilho de
  produto definido.

## BLOQUEADO — TERCEIROS (jurídico, credenciais, design externo)

- **Textos jurídicos** (política de estorno, termos, D-021/D-025) → advogado.
- **Credenciais de produção**: Asaas (chaves reais), provedor de e-mail/SMS,
  Firebase Cloud Messaging, chave de API de IA em produção, Daily (D-074),
  **Google Calendar OAuth (D-107)** → nenhuma pode ser gerada pelo agente;
  repositório é público (ver aviso de segurança no topo deste arquivo). O
  **motor de agenda (D-106) não depende disso** — só as peças 2 e 3 do sync
  ficam gated, e o fake do adapter permite construir e testar sem elas.
- **Telemedicina/receita eletrônica** (D-011/D-075): registro da FITVO como
  pessoa jurídica prestadora no CRM do estado + assessoria jurídica
  (Resolução CFM nº 2.314/2022) → ação humana fora do repositório.
- **Deploy**: contas Vercel/Railway configuradas, domínio Registro.br
  apontado → ação humana fora do repositório.
- **Design visual não fechado**: qualquer tela sem direção definida em
  `docs/design-system.md`/`docs/design-system-components.md` — o agente para
  e pergunta antes de improvisar (trava do CLAUDE.md), não trata como
  "pendente de implementação" comum.

---

## Notas de processo

- Cada item de PENDENTE vira 1 branch → 1 PR → merge conforme a **Política de
  Merge** (seção acima no CLAUDE.md): baixo risco segue `--admin` no CI verde;
  áreas críticas (financeiro, consentimento, auth/tenant, dado clínico,
  migrations destrutivas) esperam aprovação humana explícita.
- Isolamento: trabalho de execução sempre em worktree isolado, nunca no tree
  principal — exceto commits de documentação como este.
- Este documento é atualizado a cada fase concluída ou decisão nova; não deixe
  memória de sessão divergir dele.
