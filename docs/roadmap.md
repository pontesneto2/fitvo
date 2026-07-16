# Roadmap FITVO

> Fonte única do plano de execução. Substitui qualquer backlog interno de
> sessão — o backlog do agente deve espelhar este documento, nunca o
> contrário. Atualizar sempre que uma fase mudar de status. As decisões de
> arquitetura por trás de cada item vivem em `docs/adr/` (D-001 a D-104); a
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
| 7 | Esqueletos de conteúdo (Exercise/Workout, Food/MealPlan, Encounter/MedicalRecord/Prescription, Assessment — ADR-0006) | #14 | SÓ schema. Campos finos deferidos (`detail Json?` + TODO(D-063)). Sem slice de API. |
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

Reordenado em 2026-07-15 a pedido do responsável: conteúdo (D-063) vem antes
de dashboard/relatórios e de IA. Motivo — dashboard/relatórios exibem dados
que vêm do conteúdo (treino, dieta, avaliação); sem conteúdo é gráfico de
tabela vazia. Treino e nutrição são o coração do produto: sem eles não existe
FITVO.

1. **Apps web** (`web-personal`, `web-admin`, `site`) — App Router + TanStack
   Query + client de API + tema/dark + fontes; telas de auth e shell de
   dashboard derivadas do design system. Depende do merge do PR #18.
2. **Domínio de treino — regra fina** (D-063 fechado para treino via
   **ADR-0009**, D-079 a D-092): hoje é só schema (PR #14) com `detail Json?`.
   Fase de implementação (aguardando aprovação do **plano de modelagem** antes
   de código — dado clínico-adjacente, **revisão humana obrigatória**):
   - Reestrutura a hierarquia `Bond → WorkoutPlan → Workout → WorkoutItem →
     WorkoutSet` (D-079/D-081) e mata o `detail Json?` (colunas tipadas).
   - **Execução + avaliação + check-in** (D-086/D-087): `WorkoutSession`,
     `SetLog`, `WorkoutRating`.
   - **Agendamento de liberação** de plano + **régua de validade** (worker —
     D-083/D-084).
   - **Análise de forma por IA** (D-088): vídeo + pré-análise assíncrona +
     validação profissional (`FormAnalysis`) — depende do item 4 (IA) e do
     offline/câmera nativa (item 12/mobile).
   - **Deleção lógica** em biblioteca/geral (D-089): estados
     `ativo`/`descontinuado` em `Exercise`/`Food`.
   - **Coração do produto — prioridade alta.**
2b. **Fluxo do aluno, gates e atendimento** (D-093 a D-100, **ADR-0010**):
   gates obrigatórios (anamnese trava o app até responder — D-093), anamnese
   por vínculo separada de avaliação/medidas (D-094), **Atendimento** (ticket +
   escalada inteligente de canal — D-096, `Attendance`/`AttendanceMessage`/
   `AttendanceRating`), **Notificações inteligentes** como pilar (D-097,
   `Notification` — o modelo que ADR-0005/D-028 descreveu e faltava). Toca dado
   clínico + auth (troca de e-mail verificada) → **revisão humana obrigatória**.
2c. **Modalidade e anamnese tipada** (D-101 a D-104, **ADR-0011**): modalidade
   do vínculo (`ONLINE`/`PRESENCIAL`/`HIBRIDO` — D-101, estruturante: muda o
   fluxo da anamnese e a UX do gate), anamnese **híbrida com rastreio de
   autoria** (D-102, revisa o D-094 — "o paciente declarou" ≠ "o profissional
   aferiu"), e a **taxonomia** que fecha o `TODO(D-094)` e mata o
   `Anamnesis.detail Json?` (D-103: núcleo + módulo por especialidade +
   condicionais). Dado clínico → **revisão humana obrigatória**.
2d. **Nutrição e medicina — regra fina** (D-063, ainda ABERTO): planos
   alimentares/macros e prontuário/prescrição seguem a mesma lógica do treino,
   mas dependem de referência própria (**Dietbox**, como o MFit foi para
   treino) — ver BLOQUEADO — RESPONSÁVEL. Inclui exames laboratoriais
   (solicitação + anexo de resultado, D-076, ADR-0007) — ponte
   nutrição↔medicina. **Destrava o D-104** (`MealLog`, ADR-0011): o check de
   refeição precisa de um nível `Meal` que não existe hoje (`MealPlan →
   MealPlanItem` vai direto ao alimento) — mesma lacuna que o D-079 achou no
   treino.
3. **Videoconferência — treino e nutrição** (D-074/D-075, ADR-0007): package
   `video` novo (interface + adapter Daily/Prebuilt + fake, mesmo padrão dos
   demais adapters da ADR-0005). Habilitado nos ambientes de treino e
   nutrição; **bloqueado em medicina** por exigência regulatória (ver item 5 e
   BLOQUEADO — TERCEIROS). Depende do item 2 (vídeo se ancora num
   atendimento/vínculo já modelado).
4. **IA (D-022)** — a abstração multi-provider já existe
   (`packages/ai`, `AnthropicAIProvider` + `FakeAIProvider`, PR #15) com
   `embed()` propositalmente não suportado (Anthropic não oferece
   embeddings). Falta definir os casos de uso de produto que consomem IA
   (sugestão automática, geração de plano, etc.) — não inventar sem ADR.
   Depende do item 2 (IA sobre conteúdo pressupõe que o conteúdo exista).
5. **Telemedicina + receita eletrônica** (D-011/D-075, mesma fase): vídeo em
   medicina e prescrição eletrônica dependem ambos de a FITVO se registrar
   como pessoa jurídica prestadora no CRM do estado + assessoria jurídica
   (Resolução CFM nº 2.314/2022) — ver BLOQUEADO — TERCEIROS. Até lá, receita
   permanece impressa/assinatura física e vídeo permanece bloqueado nesse
   ambiente.
6. **Agenda** — modelagem e slice de API para agendamento de atendimentos por
   vínculo (mencionado em D-001 como dado por vínculo; sem ADR de detalhe
   ainda — regra fina fica em BLOQUEADO — RESPONSÁVEL).
7. **Check-in** — registro de check-in do paciente por vínculo/especialidade
   (mencionado em D-001; sem ADR de detalhe genérico). **Parcialmente resolvido
   em treino:** a conclusão de treino conta como check-in (D-086, ADR-0009) e
   nasce com o item 2; falta o check-in genérico das demais especialidades.
8. **Notificações reais** (push/email/SMS ao vivo) — a estrutura de adapter já
   existe (`packages/notifications`, PR #15); falta o disparo ao vivo, que
   depende de credenciais (Firebase, provedor de e-mail/SMS) — ver BLOQUEADO —
   TERCEIROS.
9. **Dashboard e relatórios** — telas de indicadores para profissional/clínica
   (financeiro, atendimentos, adesão, **e adesão/evolução de conteúdo** —
   depende do item 2 já ter dado real para exibir). ADR-0004 já antecipa
   "dashboards e relatórios" para dados financeiros ricos como evolução
   futura, não escopo fechado ainda.
10. **Perfil público do profissional** (D-077, ADR-0008): página opt-in no app
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
- **Agenda / Check-in**: não há ADR de detalhe — regra de negócio fina
  (janelas de disponibilidade, política de remarcação, frequência de
  check-in) precisa ser definida antes de implementar além do esqueleto.
- **Schema de treino/fluxo (ADR-0009/0010)**: escrito e em **PR #26** (CI verde,
  rebaseado na main) — aguarda **revisão humana**, área clínico-adjacente, sem
  `--admin`. Não mergear sem aprovação explícita.
- **Antropometria: anamnese ou avaliação? (ADR-0011)**: o D-102 cita
  adipometria/bioimpedância como o que o profissional afere na anamnese, mas a
  taxonomia do D-103 não tem bloco de medidas e o D-094 pôs medida recorrente no
  `Assessment`. A primeira medida é seção da anamnese ou já é `Assessment`?
  Define se o módulo de anamnese ganha seção de antropometria.
- **Campos finos de nutrição/medicina (D-063, ainda aberto)**: treino já foi
  fechado (ADR-0009/0010, benchmark MFit) e a anamnese pelo ADR-0011. Nutrição e
  medicina dependem de referência de produto própria (**Dietbox**) e decisão
  humana. Exames laboratoriais (D-076) entram junto. **Bloqueia o D-104**
  (`MealLog`): falta o nível `Meal` entre plano e alimento.
- **Dashboard e relatórios**: quais indicadores, para qual persona, com que
  nível de detalhe — não especificado nos ADRs.
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
  Firebase Cloud Messaging, chave de API de IA em produção, Daily (D-074) →
  nenhuma pode ser gerada pelo agente; repositório é público (ver aviso de
  segurança no topo deste arquivo).
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
