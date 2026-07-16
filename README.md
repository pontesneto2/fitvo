# Architecture Decision Records — FITVO

Registro das decisões arquiteturais do FITVO, agrupadas por tema. Cada ADR segue
o formato: contexto, decisão, alternativas consideradas, consequências.

> **`docs/adr/` é a ÚNICA fonte viva das decisões.**
> `docs/history/decisions-planejamento-original.md` é o registro bruto da sessão
> de planejamento (D-001 a D-073), do qual os ADRs foram gerados. É **histórico**:
> preserva a origem e o raciocínio, **não** o que vale hoje. **Em caso de
> divergência, o ADR vence.** Se uma regra só existe lá, ela **não foi decidida**.

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

### Mapa D-número → ADR

As decisões são referenciadas por **`D-xxx`** em ADRs, comentários do
`schema.prisma` e commits. Este mapa diz **onde cada uma está decidida**. Nem toda
`D-xxx` é citada pelo rótulo dentro do ADR — o ADR **destila** a decisão, às vezes
sem repetir o número. **A tabela é a autoridade sobre a cobertura**, não o `grep`.

| Decisões | ADR | Tema |
|---|---|---|
| D-001 – D-004, D-052 – D-055 | [0001](docs/adr/0001-arquitetura-e-tenancy.md) | Arquitetura e tenancy |
| D-005, D-006, D-029, D-030, D-041 – D-044 | [0002](docs/adr/0002-identidade-e-auth.md) | Identidade e auth |
| D-007 – D-017, D-045 – D-051, D-054 | [0003](docs/adr/0003-multiespecialidade-rbac-consentimento.md) | Multi-especialidade, clínica, RBAC, consentimento |
| D-018 – D-021, D-025, D-050, D-056 – D-062, D-069 | [0004](docs/adr/0004-financeiro.md) | Financeiro |
| D-022 – D-028, D-031 – D-036 | [0005](docs/adr/0005-abstracoes-e-api.md) | Abstrações, IA, notificações, API |
| D-037 – D-040, D-063 – D-068, D-070 – D-073 | [0006](docs/adr/0006-monorepo-e-fundacao.md) | Monorepo e fundação |
| D-074 – D-076 | [0007](docs/adr/0007-videoconferencia-e-telemedicina.md) | Videoconferência e telemedicina |
| D-077, D-078 | [0008](docs/adr/0008-perfil-publico-e-white-label.md) | Perfil público e white-label |
| D-079 – D-092, D-105 | [0009](docs/adr/0009-dominio-treino.md) | Domínio de treino |
| D-093 – D-100 | [0010](docs/adr/0010-fluxo-aluno-gates-atendimento.md) | Fluxo do aluno, gates, atendimento |
| D-101 – D-104 | [0011](docs/adr/0011-modalidade-e-anamnese.md) | Modalidade e anamnese |
| D-106 – D-111 | [0012](docs/adr/0012-agenda.md) | Agenda |
| D-112 – D-121 | [0013](docs/adr/0013-dominio-nutricao.md) | Domínio de nutrição |

**Cobertura:** D-001 a D-121, sem lacunas. Algumas aparecem em dois ADRs (D-025
em 0004/0005; D-050 em 0003/0004; D-054 em 0001/0003) — é intencional: a decisão
tem consequência nos dois temas.

**Revisões** — uma decisão pode ser revisada por outra mais nova. O ADR original
recebe um ponteiro; o `Status` no topo de cada ADR e o campo `Revisa:` são a
verdade:

| Revisada | Por | Onde |
|---|---|---|
| D-094 (anamnese: quem responde) | D-102 | [0011](docs/adr/0011-modalidade-e-anamnese.md) |
| D-104 (`MealLog` binário) | D-118 | [0013](docs/adr/0013-dominio-nutricao.md) |

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
