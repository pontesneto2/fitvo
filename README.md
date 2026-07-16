# Architecture Decision Records — FITVO

Registro das decisões arquiteturais do FITVO, agrupadas por tema. Cada ADR segue
o formato: contexto, decisão, alternativas consideradas, consequências.

| ADR | Tema |
|-----|------|
| [0001](docs/adr/0001-arquitetura-e-tenancy.md) | Arquitetura, tenancy e modelo de relacionamento |
| [0002](docs/adr/0002-identidade-e-auth.md) | Identidade, autenticação e onboarding |
| [0003](docs/adr/0003-multiespecialidade-rbac-consentimento.md) | Multi-especialidade, clínica, RBAC e consentimento |
| [0004](docs/adr/0004-financeiro.md) | Financeiro: cobrança, split e planos |
| [0005](docs/adr/0005-abstracoes-e-api.md) | Camadas de abstração, IA, notificações e API |
| [0006](docs/adr/0006-monorepo-e-fundacao.md) | Monorepo, domínios de conteúdo e fundação técnica |
| [0007](docs/adr/0007-videoconferencia-e-telemedicina.md) | Videoconferência e telemedicina |
| [0008](docs/adr/0008-perfil-publico-e-white-label.md) | Perfil público e white-label estrutural |
| [0009](docs/adr/0009-dominio-treino.md) | Domínio de treino |
| [0010](docs/adr/0010-fluxo-aluno-gates-atendimento.md) | Fluxo do aluno, gates e atendimento |
| [0011](docs/adr/0011-modalidade-e-anamnese.md) | Modalidade de atendimento e anamnese (revisa D-094) |
| [0012](docs/adr/0012-agenda.md) | Agenda e agendamento |
| [0013](docs/adr/0013-dominio-nutricao.md) | Domínio de nutrição (revisa D-104) |

## Desenvolvimento local

```bash
nvm use                                                   # Node >= 22.12 (.nvmrc)
pnpm install
cp .env.example .env                                      # e os .env.example de cada app
docker compose -f docker/docker-compose.yml up -d         # postgres (5434) + redis (6379)
pnpm --filter @fitvo/database db:migrate
```

> ⚠️ **O Postgres local roda na porta 5434, não na 5432.** A 5432 costuma estar
> ocupada por uma instalação **nativa** do Postgres (comum no macOS): o container
> sobe sem conflito aparente, mas `localhost:5432` cai no banco **errado**. O
> sintoma engana — `P1000: Authentication failed` com a credencial correta, e os
> logs do `fitvo-postgres` não registram tentativa nenhuma. Não volte para a 5432
> sem confirmar que não há Postgres nativo.

Esta e outras armadilhas (Node antigo no shell, `npx prisma` puxando a major
errada) estão em **[docs/troubleshooting.md](docs/troubleshooting.md)**, com
sintoma e causa.

## Trabalho futuro (fora do escopo do planejamento estrutural)

- Detalhe fino dos domínios de conteúdo: **treino já fechado** (ADR-0009);
  **nutrição e medicina seguem abertos** (D-063), assim como a taxonomia de
  campos da anamnese (D-094 decidiu o ciclo de vida, não os campos).
- Design system e logo — bloco de design próprio; cores atuais são provisórias.
- Redação jurídica dos termos e política de cancelamento/estorno — advogado,
  pré-lançamento.
- RLS do Postgres como defesa em profundidade — baixa prioridade.
- Pesquisa de preços de infra (storage/cache/filas) — perto do deploy.

## Convenção

Novas decisões arquiteturais viram novos ADRs (ou seções em ADR existente do
mesmo tema). Decisões importantes nunca ficam só em conversa.
