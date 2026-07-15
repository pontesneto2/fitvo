# CLAUDE.md — FITVO

> Referência permanente do repositório. Enxuto por design: as decisões de
> arquitetura vivem em `docs/adr/`. Este arquivo é o mapa; os ADRs são o
> detalhe. Em caso de conflito entre memória/hábito e este documento, este
> documento vence.

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

## Política de Merge — revisão humana obrigatória em áreas críticas

O CI verde prova que o código compila e passa nos testes. NÃO prova que a regra
de negócio está correta. Por isso, o auto-merge com `--admin` é permitido apenas
em áreas de baixo risco.

**AUTO-MERGE PERMITIDO (CI verde é gate suficiente):**
- Infraestrutura, tooling, configs, CI
- Design system, tokens, primitivos de UI
- Documentação
- Refactors sem mudança de comportamento
- Upgrades de dependência

**REVISÃO HUMANA OBRIGATÓRIA ANTES DO MERGE (nunca auto-mergear):**
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

Nessas áreas: abra o PR, apresente o diff e AGUARDE aprovação explícita do
responsável. Não use `--admin`. Não mergeie por conta própria mesmo com CI verde.

Se uma mudança tocar área crítica E não-crítica ao mesmo tempo, trate como
crítica.

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

## Plano de Execução

A Fase 1 (fundação técnica) está concluída. O plano de execução completo — o
que está feito (com PR), em andamento, pendente (com ordem), e o que está
bloqueado por decisão do responsável ou por terceiros (jurídico, credenciais,
design) — vive em **`docs/roadmap.md`**. É a fonte única do plano; nenhum
backlog interno de sessão o substitui.
