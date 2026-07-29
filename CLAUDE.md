# CLAUDE.md — FITVO

> Referência permanente do repositório. Enxuto por design: as decisões de
> arquitetura vivem em `docs/adr/`. Este arquivo é o mapa; os ADRs são o
> detalhe. Em caso de conflito entre memória/hábito e este documento, este
> documento vence.

> **Fonte das decisões — leia antes de citar um `D-xxx`:**
> `docs/adr/` é a **única fonte viva**. O `docs/adr/README.md` traz o **mapa
> D-número → ADR**: use-o para achar onde uma decisão está decidida, porque o ADR
> **destila** e nem sempre repete o rótulo `D-xxx` no texto — `grep D-012 docs/adr/`
> não acha nada e **isso não significa que falta**. (O `README.md` da raiz é a
> vitrine do projeto; o índice das decisões vive em `docs/adr/README.md`.)
> `docs/history/decisions-planejamento-original.md` é o registro **bruto** da
> sessão de planejamento (D-001 a D-073), do qual os ADRs foram gerados: é
> **histórico, não fonte**. Ele contém nuance que os ADRs **descartaram de
> propósito** — citá-la como regra vigente é erro (já cometido). **Em caso de
> divergência, o ADR vence.** Se a regra só existe no histórico, ela **não foi
> decidida**: proponha ao responsável em vez de assumir.

---

## ⚠️ AVISO — REPOSITÓRIO PÚBLICO: SEGURANÇA DE SEGREDOS É PRIORIDADE MÁXIMA

O repositório Git **já existe e é PÚBLICO** (uso de portfólio):
`https://github.com/pontesneto2/fitvo.git`. Isso torna a higiene de segredos
crítica, não opcional. Bots varrem repositórios públicos em minutos.

**Regras inegociáveis:**
- Configurar o `.gitignore` cobrindo `.env`, `.env.*`, secrets, credenciais,
  chaves, certificados e artefatos **ANTES de qualquer commit**.
- **Nenhum segredo** vai para o repositório: chaves do Asaas, `DATABASE_URL`,
  tokens de IA (OpenAI etc.), chaves do Firebase, secret de JWT, nada.
- Usar `.env.example` com placeholders (sem valores reais) para documentar as
  variáveis necessárias.
- Nunca usar `git add .` — adicionar arquivos explicitamente.
- Commits semânticos (Conventional Commits — ver `CONTRIBUTING.md`), pequenos e
  focados.
- Nunca fazer push, deploy, publicação ou build de loja sem autorização
  explícita do responsável.
- Se um segredo for commitado por engano, ele é considerado comprometido:
  rotacioná-lo (gerar novo) além de removê-lo do histórico.

---

## Política de Merge — repo solo: suíte local é o gate duro, revisão humana é o gate de risco

A suíte verde prova que o código compila e passa nos testes. NÃO prova que a
regra de negócio está correta. O gate é por **risco**, não por conveniência.

**Contexto (mudou em relação à versão anterior desta política):** o repositório
é mantido por uma única pessoa. Branch protection exigindo "1 approving review"
é **impossível de satisfazer sozinho** (GitHub não permite auto-aprovar o
próprio PR) — por isso a exigência de Approve formal no GitHub foi **removida**
da configuração de proteção da branch.

**No MVP, com o CI remoto desativado por billing lock (#101), o gate de
qualidade é a SUÍTE LOCAL COMPLETA verde + revisão do usuário do diff em área
crítica.** Os required status checks do GitHub voltam a ser o gate duro quando o
billing for resolvido. Merges saem **sem `--admin`** — não há required check a
satisfazer.

**AUTO-MERGE PERMITIDO (suíte local verde é gate suficiente, sem revisão adicional):**
- Infraestrutura, tooling, configs, CI
- Design system, tokens, primitivos de UI
- Documentação
- Refactors sem mudança de comportamento
- Upgrades de dependência

**ÁREA CRÍTICA — suíte verde não basta, precisa da minha revisão explícita do diff:**
- **Financeiro** — qualquer coisa em `payments`, billing, split, subconta, fee,
  cobrança, assinatura, webhook de pagamento, reembolso/estorno. Erro aqui custa
  dinheiro real de terceiros.
- **Consentimento e compartilhamento** — Consent, motor de compartilhamento,
  qualquer regra que decida quem vê dado de quem. Erro aqui é violação de LGPD.
- **Autenticação e autorização** — auth, RBAC, isolamento de tenant, guards de
  repositório. Erro aqui é vazamento entre tenants.
- **Dado clínico** — qualquer acesso a anamnese, avaliação, prontuário,
  prescrição. Erro aqui é sigilo médico.
- **Migrations destrutivas** — qualquer migration que remova ou altere coluna
  com dado existente.

Nessas áreas: abra o PR, apresente o diff no chat e AGUARDE minha revisão
explícita do diff + um **"pode ir" (ou equivalente) no chat**. Isso — não um
Approve no GitHub — é o controle humano que substitui o review de terceiro
neste repositório solo. Sem esse sinal explícito, não mergeie mesmo com a suíte
local verde. Com esse sinal, mergeie **sem `--admin`** (enquanto o CI remoto
estiver desativado não há required check a satisfazer; quando ele voltar, os
required checks é que liberam o botão).

Se uma mudança tocar área crítica E não-crítica ao mesmo tempo, trate como
crítica.

### Banco em DEV/MVP — o que o agente pode rodar sozinho

Enquanto **não houver produção com dado real**, o banco de dev é descartável e
recriável a partir das migrations. Nesse contexto:

- **PERMITIDO ao agente, sem me chamar:** aplicar migrations **forward** —
  `prisma migrate deploy` (e `prisma migrate status`) — para validar que a
  cadeia aplica de verdade e que as colunas novas existem. Uma migration
  **aditiva** (coluna/enum/índice novos, nada removido nem alterado sobre dado
  existente) segue a mesma regra das áreas não-críticas: suíte local verde basta.
- **CONTINUA exigindo mim, mesmo em dev:** `prisma migrate reset`, `DROP`,
  `TRUNCATE`, `DELETE` em massa, ou qualquer migration **destrutiva** (remove ou
  altera coluna com dado existente — ver bullet acima). O agente **nunca** roda
  isso sozinho.

**Trava temporal:** esta folga vale **só porque o banco de dev não tem dado
real**. Quando existir produção com dado de terceiro, **religar o bloqueio total
de banco para o agente** — qualquer operação de schema volta a exigir minha
autorização explícita, forward inclusive.

---

## Missão

FITVO é um SaaS premium multi-especialidade de saúde e fitness — um ecossistema
único ("3 apps em 1") que reúne **treino**, **nutrição** e **medicina** na mesma
base técnica, com contextos separados por especialidade e dados interligados sob
consentimento do paciente.

O produto é vendável tanto para **profissionais solo** quanto para **clínicas**
(que centralizam toda a operação — atendimentos, dados, financeiro — na
plataforma). O diferencial é a unificação da informação do paciente e a operação
financeira embutida.

O agente atua como **Arquiteto de Software e Tech Lead**: preserva a qualidade
arquitetural, propõe antes de implementar, não inventa regra de negócio e mantém
a consistência com as decisões registradas nos ADRs.

## Stack Oficial

- **Linguagem:** TypeScript (strict).
- **Monorepo:** Turborepo + pnpm workspaces.
- **Backend:** Node.js + Fastify + Prisma + PostgreSQL + Redis + BullMQ + JWT +
  Zod + Swagger/OpenAPI. Organizado como **Modular Monolith** (não microservices).
- **Frontend web:** Next.js + React + TailwindCSS + TanStack Query +
  React Hook Form + Zod.
- **Mobile:** React Native + Expo (Expo Router, TanStack Query).
- **Infra:** S3-compatible (storage), Redis (cache/filas). Deploy: Vercel
  (frontend) + Railway (backend). Domínio: Registro.br.
- **Integrações:** Asaas (pagamentos/split), OpenAI e outros providers de IA
  (via abstração), Firebase Cloud Messaging (push), Google/Apple OAuth (fase
  posterior).

Ferramentas obrigatórias: ESLint, Prettier, Husky, lint-staged, EditorConfig,
Conventional Commits. Proibido: `any` sem justificativa forte, `@ts-ignore` para
esconder problema, código duplicado, código morto.

## Estrutura do Monorepo

```
fitvo/
  apps/
    api/          # Modular monolith (Fastify). Vertical slice por domínio.
    worker/       # BullMQ: notificações, webhooks Asaas, IA async, eventos.
    mobile/       # Expo. App "3-em-1" (aluno + profissional), contextos/ambientes.
    web-personal/ # Next.js. Painel do profissional/clínica. Deploy próprio.
    web-admin/    # Next.js. Super Admin FITVO. Deploy próprio, separado.
    site/         # Next.js. Landing/institucional/marketing.
  packages/
    auth/            # JWT + refresh rotation + revogação (ADR-0002).
    payments/        # Asaas: cobrança, recorrência, split, reembolso, webhook.
    ai/              # Multi-provider: interface única + adaptadores.
    storage/         # S3-compatible.
    cache/           # Redis.
    queue/           # BullMQ.
    notifications/   # Multi-canal: push/email/in-app/SMS.
    database/        # Prisma schema, migrations, client.
    contracts/       # Tipos/DTOs compartilhados + OpenAPI.
    validation/      # Schemas Zod compartilhados.
    ui-web/          # Design system WEB (a definir).
    ui-mobile/       # Design system MOBILE (a definir).
    brand-tokens/    # Tokens de marca compartilhados (cores/tipografia/espaço).
    config/          # Config compartilhada.
    observability/   # Log estruturado, request/correlation ID, tracing.
    eslint-config/   # ESLint compartilhado.
    typescript-config/ # tsconfig base.
    testing/         # Utilitários de teste.
  docs/
    adr/          # Architecture Decision Records (a fonte das decisões).
  infra/
  docker/
```

**Regra de compartilhamento:** tudo reutilizável vive em `packages/`. Nenhuma
regra de negócio duplicada. O domínio nunca depende de tecnologia concreta —
sempre da interface do package de abstração.

## Padrões de Desenvolvimento

- **Arquitetura:** Modular Monolith. API por **vertical slice** (cada domínio —
  auth, patient, professional, clinic, bond, consent, billing, workout,
  nutrition... — é autocontido, com camadas domínio/aplicação/infra/interface).
  Baixo acoplamento, alta coesão, extração futura para serviço sem refatoração.
- **Princípios:** SOLID, Clean Architecture, Separation of Concerns, Repository
  Pattern, Service Pattern, DI, DTO, Value Objects e Domain Services quando
  agregarem valor. DDD só onde faz sentido, não por obrigação.
- **Prioridade de decisão:** Simplicidade > Manutenibilidade > Escalabilidade >
  Segurança > Observabilidade > Performance > DX > UX. Evitar overengineering.
- **Nomenclatura:** arquivos kebab-case; componentes/interfaces/enums/tipos
  PascalCase; variáveis/funções camelCase; constantes UPPER_SNAKE_CASE.
- **Erros:** API devolve erro técnico padronizado (RFC 7807); o front traduz
  para mensagem amigável ao usuário. As duas camadas convivem.
- **Dinheiro:** SEMPRE inteiro em centavos, nunca float. Formatação só na
  exibição. Regra inegociável.
- **Datas:** SEMPRE UTC no banco; conversão para o fuso do usuário só na
  exibição.
- **Nome social:** `displayName = socialName ?? name` é derivado UMA VEZ no
  servidor (`deriveDisplayName`), exposto via `/me` e account summary. Toda
  superfície (web/mobile/admin) consome `me.displayName` — NUNCA derivar por
  conta própria. Nome civil fica restrito a `tenant.name`/documento/fiscal.
- **i18n:** textos externalizados desde já; lançamento em pt-BR.
- **Logging:** estruturado (JSON), com request ID e correlation ID desde o dia 1.
- **Testes:** pirâmide com foco no core de risco (unit + integração) e E2E nos
  fluxos críticos. Priorizar comportamento; evitar excesso de mocks.

## Fluxo de Trabalho (antes de qualquer alteração)

1. Compreender o contexto e o escopo.
2. Analisar impacto (arquitetura, segurança, performance, escalabilidade, UX, DX).
3. Explicar a estratégia.
4. Implementar com escopo restrito.
5. Validar (typecheck, lint, build, testes conforme a camada).
6. Atualizar documentação/ADR quando a decisão for arquitetural.

## Regras Obrigatórias

- Nunca inventar regra de negócio — se não está nos ADRs, propor e aguardar.
- Nunca adicionar dependência sem justificativa.
- Nunca quebrar compatibilidade sem aprovação.
- Nunca duplicar código; sempre reutilizar packages.
- Sempre tipagem estrita.
- Isolamento de tenant é inegociável: nenhuma query sem escopo de tenant.
- Segurança e observabilidade nunca são adicionadas "depois".
- Dado clínico ≠ dado operacional: admin puro nunca acessa dado clínico.
- Consentimento do paciente é obrigatório para qualquer compartilhamento.

## Definição de Pronto

Toda entrega deve: compilar sem erros, passar em lint e typecheck, manter a
arquitetura consistente, ter testes onde a camada exige, e estar documentada
quando a mudança for arquitetural.

## Resposta do Agente

Ao concluir uma tarefa, apresentar: resumo, estratégia, alterações,
justificativa técnica, impactos no sistema, riscos e próximos passos. Nunca
responder apenas com código.

---
## Padrões de UI e Comportamento do Agente

Estas regras valem para qualquer trabalho de interface (web e mobile). São
comportamentais e verificáveis — devem ser seguidas sem exceção.

### Reutilização antes de criar
- ANTES de criar qualquer componente, verificar se já existe equivalente em
  `packages/ui-web` (web) ou `packages/ui-mobile` (mobile) e reutilizar.
- Se existir algo parecido mas não idêntico, estender/compor o existente em vez
  de duplicar. Nunca criar um segundo componente que faz quase a mesma coisa.
- Lógica compartilhada entre telas vira componente ou hook reutilizável, não
  código repetido.

### Tokens e consistência visual
- NUNCA usar cor, espaçamento, tipografia ou raio hardcoded. Sempre consumir de
  `packages/brand-tokens`. Se um token necessário não existe, criar o token —
  não chumbar o valor.
- Manter consistência com o design system definido (ver `docs/design-system.md`
  quando existir). Não introduzir estilos avulsos fora do sistema.

### Qualidade de componente
- Componentes pequenos e com responsabilidade única. Evitar componentes gigantes.
- Estados obrigatórios em qualquer tela com dados: loading, vazio, erro e sucesso.
- Acessibilidade como baseline: roles/ARIA corretos, navegação por teclado, foco
  visível, contraste adequado.
- Interações (hover, foco, transições, animações) seguem o padrão definido no
  design system — nunca inventadas ad hoc por tela.

### Padrão visual — evitar aparência genérica
- O objetivo é um visual autoral e moderno, NÃO o resultado genérico padrão.
- Não gerar telas "na média" sem direção: seguir as referências visuais e o
  design system do projeto. Se a direção visual ainda não estiver definida para
  a tela em questão, PARAR e perguntar antes de improvisar um estilo.

### Regra de desvio (trava)
- Se for necessário desviar de QUALQUER padrão deste documento ou do design
  system — introduzir uma dependência de UI nova, criar um padrão de interação
  novo, ou estruturar uma tela fora da convenção — PARAR e perguntar ao
  responsável antes de prosseguir. Não assumir autorização.

### A avaliar no bloco de design (pendente)
- Avaliar adoção de shadcn/ui + servidor MCP do shadcn para a camada WEB
  (Next.js): permite ao agente buscar no registro, ler a API real do componente
  e instalar/reutilizar em vez de gerar markup genérico. Decisão condicionada à
  identidade visual (shadcn customizado vs. primitivos puros com design próprio).
  NÃO adotar antes dessa decisão. Não se aplica ao mobile (React Native/Expo).
---

## Agent Skills (.claude/skills/)

Skills são ajuda procedural. NÃO sobrescrevem as convenções deste CLAUDE.md, os ADRs,
nem palavras de força (obrigatório/sempre/nunca). Em conflito, a convenção do projeto vence.
Precedência: CLAUDE.md > ADRs/palavras de força > contract-first (D-032) > skills.
Nenhuma skill inventa validação, mascara erro, faz refactor fora de escopo ou dá `git add .`.

Quando cada skill deve atuar:
- frontend-design — qualquer UI nova ou redesenho (landing, web-personal, telas mobile):
  comprometer com uma direção estética antes de codar; fugir de default genérico de IA;
  respeitar o design system existente quando já houver.
- vercel-react-best-practices / vercel-composition-patterns — código React/Next
  (web-personal, admin, landing).
- vercel-react-native-skills — código RN/Expo (apps aluno e profissional).
- web-design-guidelines — heurísticas de layout/UX em qualquer front.
- domain-modeling / ubiquitous-language — modelar entidades/estados: reforça
  "construir > validar" (estados inválidos irrepresentáveis) e nomes consistentes com os
  ADRs (bond/vínculo, especialidade, seat, etc.).
- test-driven-development — teste que reprova antes de implementar. Reforça o gate
  anti-"verde que mente": o teste tem que exercer o código de fato.
- verification-before-completion — antes de dar por pronto, validar de verdade conforme o
  alvo (mobile: type-check/testes/build; API: type-check/build/testes/contrato;
  web/admin/landing: type-check/build/smoke). Nunca reportar concluído sem verificar.
- writing-plans — plano curto antes de mudança grande (já é o fluxo padrão).
- systematic-debugging — bug/erro: reproduzir → isolar → diagnosticar → corrigir.
- using-git-worktrees / dispatching-parallel-agents / subagent-driven-development /
  finishing-a-development-branch — coordenação de sessões paralelas com territórios
  disjuntos (branch + arquivos). NÃO substituem a política de merge #83 (suíte local verde;
  área crítica = revisão do diff pelo usuário + "pode ir"; agente mergeia sem --admin).
- supabase-postgres-best-practices — consulta pontual de padrões de RLS ao decidir
  isolamento de tenant (extensão Prisma vs RLS vs ambos). Ignorar o que for específico de Supabase.
- skill-creator — usar quando formos escrever o skill PRIVADO FITVO (invariantes + coordenação).
- webapp-testing — testes de fluxo em web.

## Plano de Execução

A Fase 1 (fundação técnica) está concluída. O plano de execução completo — o
que está feito (com PR), em andamento, pendente (com ordem), e o que está
bloqueado por decisão do responsável ou por terceiros (jurídico, credenciais,
design) — vive em **`docs/roadmap.md`**. É a fonte única do plano; nenhum
backlog interno de sessão o substitui.
