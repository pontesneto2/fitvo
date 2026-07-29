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
| [0001](0001-arquitetura-e-tenancy.md) | Arquitetura, tenancy e modelo de relacionamento |
| [0002](0002-identidade-e-auth.md) | Identidade, autenticação e onboarding |
| [0003](0003-multiespecialidade-rbac-consentimento.md) | Multi-especialidade, clínica, RBAC e consentimento |
| [0004](0004-financeiro.md) | Financeiro: cobrança, split e planos |
| [0005](0005-abstracoes-e-api.md) | Camadas de abstração, IA, notificações e API |
| [0006](0006-monorepo-e-fundacao.md) | Monorepo, domínios de conteúdo e fundação técnica |
| [0007](0007-videoconferencia-e-telemedicina.md) | Videoconferência e telemedicina |
| [0008](0008-perfil-publico-e-white-label.md) | Perfil público e white-label estrutural |
| [0009](0009-dominio-treino.md) | Domínio de treino |
| [0010](0010-fluxo-aluno-gates-atendimento.md) | Fluxo do aluno, gates e atendimento |
| [0011](0011-modalidade-e-anamnese.md) | Modalidade de atendimento e anamnese (revisa D-094) |
| [0012](0012-agenda.md) | Agenda e agendamento |
| [0013](0013-dominio-nutricao.md) | Domínio de nutrição (revisa D-104) |
| [0014](0014-dominio-medicina.md) | Domínio de medicina — nutrologia esportiva (revisa o esqueleto do ADR-0006) |
| [0015](0015-cadastro-convites-e-vinculo.md) | Cadastro, convite e vínculo |
| [0016](0016-storage-arquivos.md) | Armazenamento de arquivos (storage) |
| [0017](0017-tenant-isolation.md) | Isolamento de tenant — defense in depth (blocker go-live #1) |

## Mapa D-número → ADR

As decisões são referenciadas por **`D-xxx`** em ADRs, comentários do
`schema.prisma` e commits. Este mapa diz **onde cada uma está decidida**. Nem toda
`D-xxx` é citada pelo rótulo dentro do ADR — o ADR **destila** a decisão, às vezes
sem repetir o número. **A tabela é a autoridade sobre a cobertura**, não o `grep`.

| Decisões | ADR | Tema |
|---|---|---|
| D-001 – D-004, D-052 – D-055 | [0001](0001-arquitetura-e-tenancy.md) | Arquitetura e tenancy |
| D-005, D-006, D-025, D-029, D-030, D-041 – D-044 | [0002](0002-identidade-e-auth.md) | Identidade e auth |
| D-007 – D-017, D-045 – D-051, D-054 | [0003](0003-multiespecialidade-rbac-consentimento.md) | Multi-especialidade, clínica, RBAC, consentimento |
| D-018 – D-021, D-025, D-050, D-056 – D-062, D-069 | [0004](0004-financeiro.md) | Financeiro |
| D-022 – D-028, D-031 – D-036 | [0005](0005-abstracoes-e-api.md) | Abstrações, IA, notificações, API |
| D-037 – D-040, D-063 – D-068, D-070 – D-073 | [0006](0006-monorepo-e-fundacao.md) | Monorepo e fundação |
| D-074 – D-076 | [0007](0007-videoconferencia-e-telemedicina.md) | Videoconferência e telemedicina |
| D-077, D-078 | [0008](0008-perfil-publico-e-white-label.md) | Perfil público e white-label |
| D-079 – D-092, D-105 | [0009](0009-dominio-treino.md) | Domínio de treino |
| D-093 – D-100 | [0010](0010-fluxo-aluno-gates-atendimento.md) | Fluxo do aluno, gates, atendimento |
| D-101 – D-104 | [0011](0011-modalidade-e-anamnese.md) | Modalidade e anamnese |
| D-106 – D-111 | [0012](0012-agenda.md) | Agenda |
| D-112 – D-121, **D-133 – D-134** | [0013](0013-dominio-nutricao.md) | Domínio de nutrição (D-133/D-134: adendos de concorrência) |
| D-122 – D-132 | [0014](0014-dominio-medicina.md) | Domínio de medicina (nutrologia esportiva) |
| D-135 – D-143, D-156, D-157 | [0015](0015-cadastro-convites-e-vinculo.md) | Cadastro, convite e vínculo (D-141: academia; D-142/D-143: seat de estagiário, multi-área; D-156: seat de recepção; D-157: gate de completar-perfil) |
| D-144 – D-149 | [0016](0016-storage-arquivos.md) | Armazenamento de arquivos (adapter S3, bucket privado, arquivo como recurso do bond) |
| D-150 – D-155 | [0017](0017-tenant-isolation.md) | Isolamento de tenant (AsyncLocalStorage + Prisma extension + RLS seletivo) |

**Cobertura:** D-001 a D-157, sem lacunas. **D-133 e D-134 são adendos de
concorrência ao domínio de nutrição (ADR-0013)** numerados **depois** de medicina
(D-122–D-132) porque nasceram depois — a numeração é cronológica, não temática, e
por isso a linha do 0013 não é contígua. Algumas decisões aparecem em dois ADRs
(D-025 em 0002/0004/0005; D-050 em 0003/0004; D-054 em 0001/0003) — é intencional: a
decisão tem consequência nos dois temas.

**Revisões** — uma decisão pode ser revisada por outra mais nova. O ADR original
recebe um ponteiro; o `Status` no topo de cada ADR e o campo `Revisa:` são a
verdade:

| Revisada | Por | Onde |
|---|---|---|
| D-094 (anamnese: quem responde) | D-102 | [0011](0011-modalidade-e-anamnese.md) |
| D-104 (`MealLog` binário) | D-118 | [0013](0013-dominio-nutricao.md) |
| D-063/ADR-0006 (esqueleto previu `MedicalRecord`) | D-122 | [0014](0014-dominio-medicina.md) |

## Convenção

Novas decisões arquiteturais viram novos ADRs (ou seções em ADR existente do
mesmo tema). Decisões importantes nunca ficam só em conversa. O `README.md` da
raiz é a vitrine do projeto; **este** arquivo é o índice canônico das decisões.
