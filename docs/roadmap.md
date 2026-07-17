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

## EM ANDAMENTO

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
    12 (mobile) e do item 2 (treino tipado — merge por campo exige colunas, não
    `Json`).
13. **Testes ao vivo das integrações** (Asaas sandbox, IA real, FCM, e-mail,
    SMS, Daily) — hoje todos gated por ausência de credenciais no ambiente.
    Rodar exige as credenciais reais (ver BLOQUEADO — TERCEIROS).
14. **Deploy** (Vercel + Railway) — infraestrutura de deploy ainda não
    configurada; requer credenciais + ordem explícita de publicação.

## BLOQUEADO — RESPONSÁVEL (decisão que só você pode tomar)

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
- **DTOs de auth do `web-personal` deveriam morar em `@fitvo/contracts`** — o pacote
  ainda está vazio (`export {}`), então o esqueleto do `web-personal` definiu os
  tipos/Zod de login **localmente** (`apps/web-personal/src/lib/auth.ts`), espelhando
  o contrato real da API. Mover para `@fitvo/contracts` é mudança cross-package
  (fonte única de contrato entre API e clientes), **fora do escopo do esqueleto**.
- **Os controles do `ui-web` não fazem `forwardRef`** — `Input`, `Textarea`,
  `Select`, `Checkbox`, `Radio` e `Switch` são `export function X(props)` sem
  encaminhar o `ref` ao elemento nativo. Isso **quebra o `register()` uncontrolled do
  React Hook Form** (stack oficial — ADR-0005): o ref não chega e o consumidor é
  forçado a usar `Controller` (controlado, mais verboso). Descoberto ao montar o
  login do `web-personal` (primeiro consumidor real do design system). **Correção nos
  primitivos — uma passada nos 6 controles, PR próprio** — habilita o padrão
  uncontrolled do RHF em todo consumidor futuro.
- **⚠️ LACUNA DE CONFORMIDADE — profissional não-verificado PODE atender.** O
  guard de vínculo exige a especialidade **reivindicada** (`ProfessionalSpecialty`
  — D-046), mas **NÃO** exige `verificationStatus === VERIFIED`. É `TODO(D-010)`
  explícito em [`patient-application-service.ts:286`](../apps/api/src/modules/patient/patient-application-service.ts#L286).
  O **D-051** ("o profissional não atende até ser verificado") está **decidido, não
  implementado** — depende do fluxo de verificação, deferido desde a Fase 2. Fica
  **visível aqui**, não escondido num TODO: num produto de saúde com repositório
  público, alguém reivindica CRM/CRN que não tem e o sistema hoje deixa. Não é bug
  de código — é regra de negócio pendente, e o dono é o fluxo de verificação
  (item deferido). A Fase 0 de medicina (D-130) **modela** `councilState`/`rqe`
  nuláveis de propósito por causa disto: a coluna não impõe verificação; o guard é
  que imporá, quando existir.
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

  *Núcleo / módulo treino:*
  - **Local de treino** (academia / casa / box / ar livre) — determina o que
    pode ser prescrito.
  - **Tempo por sessão** (30/45/60/90/120 min) — hoje há dias/semana, não
    duração.
  - **Histórico esportivo** (modalidades praticadas).
  - **Suplementos em uso** — campo de **texto livre** (decisão do responsável).

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
