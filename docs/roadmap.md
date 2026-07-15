# Roadmap FITVO

> Fonte única do plano de execução. Substitui qualquer backlog interno de
> sessão — o backlog do agente deve espelhar este documento, nunca o
> contrário. Atualizar sempre que uma fase mudar de status. As decisões de
> arquitetura por trás de cada item vivem em `docs/adr/` (D-001 a D-073); a
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
| 10 | Design tokens (`brand-tokens` populado: cor, tipografia, elevação, ícones Lucide, densidade) | worktree design, ainda sem PR próprio | Ver EM ANDAMENTO — falta consolidar em PR. |
| 11 | Cola de framework (`ui-web` preset Tailwind + CSS vars; `ui-mobile` ThemeProvider) | idem | |
| 12 | Primitivos de UI: Button, Input/Field/Textarea, Checkbox/Radio/Switch, Select/Combobox, Card (§1–§7) | idem | |

## EM ANDAMENTO

- **Camada de design system** (branch/worktree `worktree-brand-tokens`, fora do
  tree principal): `brand-tokens` + `ui-web` + `ui-mobile` com primitivos §1–§7
  completos; commits locais indicam avanço adicional em Menu lateral,
  Breadcrumb, Modal/Dialog, Toast, Tooltip (§8–§14) — a confirmar com a sessão
  de design antes de assumir como concluído. Nada disso tem PR aberto ainda.
- **Política de merge e este roadmap** (branch `docs/politica-de-merge`) —
  este próprio documento.

## PENDENTE (ordem de execução pretendida)

1. **Consolidar a camada de design em PR(s)** — trazer `brand-tokens`/`ui-web`/
   `ui-mobile` do worktree paralelo para `main` via PR revisável (não
   `--admin`, ver Política de Merge — é área de baixo risco mas o volume
   justifica revisão visual).
2. **Restante dos primitivos de UI** (§8–§18 do doc de componentes: Badge,
   Tabs, Avatar, Tabela, e o que não estiver coberto pelo item acima).
3. **Apps web** (`web-personal`, `web-admin`, `site`) — App Router + TanStack
   Query + client de API + tema/dark + fontes; telas de auth e shell de
   dashboard derivadas do design system. Depende do item 1.
4. **Agenda** — modelagem e slice de API para agendamento de atendimentos por
   vínculo (mencionado em D-001 como dado por vínculo; sem ADR de detalhe
   ainda — regra fina fica em BLOQUEADO — RESPONSÁVEL).
5. **Check-in** — registro de check-in do paciente por vínculo/especialidade
   (mencionado em D-001; mesma situação: sem ADR de detalhe).
6. **Notificações reais** (push/email/SMS ao vivo) — a estrutura de adapter já
   existe (`packages/notifications`, PR #15); falta o disparo ao vivo, que
   depende de credenciais (Firebase, provedor de e-mail/SMS) — ver BLOQUEADO —
   TERCEIROS.
7. **Dashboard e relatórios** — telas de indicadores para profissional/clínica
   (financeiro, atendimentos, adesão). ADR-0004 já antecipa "dashboards e
   relatórios" para dados financeiros ricos como evolução futura, não
   escopo fechado ainda.
8. **Domínios de conteúdo — regra fina** (D-063): treino, nutrição e
   prontuário/prescrição médica hoje são só schema (PR #14). Preencher
   comportamento/regra de negócio real é decisão humana com referências
   (ex.: MFit, Dietbox) — ver BLOQUEADO — RESPONSÁVEL.
9. **IA (D-022)** — a abstração multi-provider já existe
   (`packages/ai`, `AnthropicAIProvider` + `FakeAIProvider`, PR #15) com
   `embed()` propositalmente não suportado (Anthropic não oferece
   embeddings). Falta definir os casos de uso de produto que consomem IA
   (sugestão automática, geração de plano, etc.) — não inventar sem ADR.
10. **Mobile (Expo)** — app "3-em-1" (aluno + profissional), Expo Router +
    TanStack Query. Ainda não iniciado; bloco próprio, depende de apps web e
    design mobile estarem maduros.
11. **Testes ao vivo das integrações** (Asaas sandbox, IA real, FCM, e-mail,
    SMS) — hoje todos gated por ausência de credenciais no ambiente. Rodar
    exige as credenciais reais (ver BLOQUEADO — TERCEIROS).
12. **Deploy** (Vercel + Railway) — infraestrutura de deploy ainda não
    configurada; requer credenciais + ordem explícita de publicação.

## BLOQUEADO — RESPONSÁVEL (decisão que só você pode tomar)

- **Apps web**: liberar o início do item 3 do PENDENTE depende de você
  confirmar que `brand-tokens`/`ui-web` estão maduros o suficiente para
  consumo, e decidir onde o squeeze do design acontece (tree principal vs.
  worktree isolado).
- **TypeScript 6/7**: bump depende de o `typescript-eslint` lançar suporte a
  TS ≥6.1 (hoje não suporta). Pesquisar `npm view @typescript-eslint/parser
  peerDependencies` periodicamente; quando destravar, é tarefa isolada.
- **Prisma 7**: migração para `prisma.config.ts` + `@prisma/adapter-pg` é
  mudança arquitetural na forma como `PrismaClient` é instanciado em toda a
  API/worker — decisão de quando vale a pena priorizar, não bump direto.
- **Agenda / Check-in**: não há ADR de detalhe — regra de negócio fina
  (janelas de disponibilidade, política de remarcação, frequência de
  check-in) precisa ser definida antes de implementar além do esqueleto.
- **Campos finos de treino/nutrição/medicina (D-063)**: decisão humana com
  referências de produto (MFit/Dietbox citados como benchmark).
- **Dashboard e relatórios**: quais indicadores, para qual persona, com que
  nível de detalhe — não especificado nos ADRs.
- **Casos de uso de IA (D-022)**: quais features realmente usam IA generativa
  no produto (a abstração técnica já existe, falta a decisão de produto).
- **Biblioteca de ícones/logo final**: ícones já resolvidos (Lucide oficial);
  logo definitivo (dark/light) ainda pendente conforme registro de marca.
- **shadcn/ui**: adoção para a camada web adiada — decisão condicionada à
  identidade visual (shadcn customizado vs. primitivos puros).

## BLOQUEADO — TERCEIROS (jurídico, credenciais, design externo)

- **Textos jurídicos** (política de estorno, termos, D-021/D-025) → advogado.
- **Credenciais de produção**: Asaas (chaves reais), provedor de e-mail/SMS,
  Firebase Cloud Messaging, chave de API de IA em produção → nenhuma pode ser
  gerada pelo agente; repositório é público (ver aviso de segurança no topo
  deste arquivo).
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
