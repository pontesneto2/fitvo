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
| [0011](0011-modalidade-e-anamnese.md) | Modalidade de atendimento e anamnese (revisa D-094; adendo de regras e fluxos multi-área D-172–D-178; adendo de campos do módulo treino D-187–D-190) |
| [0012](0012-agenda.md) | Agenda e agendamento |
| [0013](0013-dominio-nutricao.md) | Domínio de nutrição (revisa D-104) |
| [0014](0014-dominio-medicina.md) | Domínio de medicina — nutrologia esportiva (revisa o esqueleto do ADR-0006) |
| [0015](0015-cadastro-convites-e-vinculo.md) | Cadastro, convite e vínculo |
| [0016](0016-storage-arquivos.md) | Armazenamento de arquivos (storage) |
| [0017](0017-tenant-isolation.md) | Isolamento de tenant — defense in depth (blocker go-live #1) |
| [0018](0018-dominio-treino.md) | ~~Domínio de treino: prescrição, periodização e execução~~ — **Superseded por [0009](0009-dominio-treino.md)** |
| [0019](0019-comunicacao-notificacoes.md) | Comunicação e notificações — presença, eventos e calibragem (consolida ADR-0005/0010/0012) |

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
| D-079 – D-092, D-105, **D-164 – D-171**, **D-191**, **D-193** | [0009](0009-dominio-treino.md) | Domínio de treino (D-164: taxonomia de grupo muscular; D-165: lifecycle DRAFT/ISSUED/CANCELLED; D-166: `tenantId`; D-167: progressão sugerida — revisão jul/2026; D-168–D-171: biblioteca de catálogo — comum vs. sensível, anti-duplicação — adendo jul/2026; D-191/D-193: aderência ancorada na disponibilidade do aluno — denominador único e estado sem denominador irrepresentável — adendo jul/2026) |
| D-093 – D-100 | [0010](0010-fluxo-aluno-gates-atendimento.md) | Fluxo do aluno, gates, atendimento |
| D-101 – D-104, **D-172 – D-178**, **D-187 – D-190**, **D-192** | [0011](0011-modalidade-e-anamnese.md) | Modalidade e anamnese (D-172–D-178: regras e fluxos transversais — gate por modalidade, obrigatoriedade/não-se-aplica, reaproveitamento entre vínculos, versionamento, linha do tempo, sinal de risco PAR-Q — adendo jul/2026; D-187–D-190: campos do módulo treino — contextos de treino, orçamento, histórico esportivo, suplementos — adendo jul/2026; D-192: disponibilidade de treino obrigatória sem "não se aplica" — exceção nomeada ao D-173, eleva o D-188 — adendo jul/2026) |
| D-106 – D-111 | [0012](0012-agenda.md) | Agenda |
| D-112 – D-121, **D-133 – D-134** | [0013](0013-dominio-nutricao.md) | Domínio de nutrição (D-133/D-134: adendos de concorrência; referencia D-168–D-171 do ADR-0009 para `Food`/`FoodGroup`) |
| D-122 – D-132 | [0014](0014-dominio-medicina.md) | Domínio de medicina (nutrologia esportiva) |
| D-135 – D-143, D-156, D-157 | [0015](0015-cadastro-convites-e-vinculo.md) | Cadastro, convite e vínculo (D-141: academia; D-142/D-143: seat de estagiário, multi-área; D-156: seat de recepção; D-157: gate de completar-perfil) |
| D-144 – D-149 | [0016](0016-storage-arquivos.md) | Armazenamento de arquivos (adapter S3, bucket privado, arquivo como recurso do bond) |
| D-150 – D-155 | [0017](0017-tenant-isolation.md) | Isolamento de tenant (AsyncLocalStorage + Prisma extension + RLS seletivo) |
| ~~D-158 – D-163~~ | [0018](0018-dominio-treino.md) | ~~Domínio de treino: prescrição, periodização e execução~~ — **SUPERSEDED por [0009](0009-dominio-treino.md); estas decisões NÃO estão em vigor.** O arquivo é registro histórico (pesquisa competitiva jul/2026) |
| D-179 – D-186 | [0019](0019-comunicacao-notificacoes.md) | Comunicação e notificações (D-179: cobertura evento+ausência multi-nicho; D-180: check-in como sinal único de presença; D-181: categorias acompanhamento/transacional/marketing; D-182: calibragem de push; D-183: `NotificationPreference`; D-184: `PushToken`; D-185: worker de ausência; D-186: novos tipos de `NotificationType` — consolida ADR-0005/0010/0012, jul/2026) |

**Cobertura:** D-001 a D-193, sem lacunas. **D-158 – D-163 estão cobertas pelo
ADR-0018, que é `Superseded`** — os números existem e não são reutilizáveis, mas
as decisões não valem; o que sobreviveu delas foi reincorporado ao ADR-0009 como
D-164 – D-167. **D-168 – D-171 são adendo de biblioteca de catálogo** (comum vs.
sensível, anti-duplicação — decisão de mesa jul/2026), incorporados ao ADR-0009
por ser onde a biblioteca de exercícios já vive (D-089); o ADR-0013 referencia
esses D sem duplicar (ver D-117). **D-172 – D-178 são adendo de regras e fluxos
da anamnese multi-área** (decisão de mesa jul/2026), incorporados ao ADR-0011
por ser onde a anamnese já tem casa — não criam ADR novo. O texto jurídico do
D-178 é **rascunho**, pendente de validação por advogado. **D-187 – D-190 são
adendo de campos do módulo treino da anamnese** (decisão de mesa jul/2026),
também incorporados ao ADR-0011 — estendem o D-103, não o reescrevem, e
numeram-se depois de D-186 (ADR-0019) por ordem cronológica, não temática; por
isso a linha do 0011 também não é contígua, mesmo padrão do 0013 abaixo.
Fecham os campos que `docs/roadmap.md` listava como abertos no módulo treino
(local de treino, tempo/sessão, histórico esportivo, suplementos/esteroides).
**D-191 – D-193 são adendo de aderência ancorada na disponibilidade do aluno**
(decisão de mesa jul/2026) e são o primeiro caso de um adendo **repartido entre
dois ADRs**: D-191 (denominador = disponibilidade declarada, uniforme para
`LETTER`/`WEEKDAY`) e D-193 (o estado "aderência sem denominador" é
irrepresentável) vão para o **ADR-0009**, onde o indicador já mora (D-092, que
eles **estendem sem reescrever**); D-192 (disponibilidade obrigatória, **sem**
"não se aplica") vai para o **ADR-0011**, onde a anamnese mora — e **eleva o
D-188** de "capturado" para "obrigatório", também sem reescrevê-lo. Por isso
nenhuma das duas linhas é contígua: a decisão é uma só, a casa é duas. O D-192 é
**exceção nomeada ao D-173** (que segue valendo como regra geral), não sua
revogação. Destravam o **percentual** de aderência do Bloco 3 da execução (#136),
que entregou os numeradores sem denominador decidido; a **janela de agregação**
segue aberta em `docs/pendencias-mesa.md`.
**D-133 e D-134 são
adendos de concorrência ao domínio de nutrição (ADR-0013)** numerados **depois**
de medicina (D-122–D-132) porque nasceram depois — a numeração é cronológica,
não temática, e por isso a linha do 0013 não é contígua. Algumas decisões
aparecem em dois ADRs (D-025 em 0002/0004/0005; D-050 em 0003/0004; D-054 em
0001/0003) — é intencional: a decisão tem consequência nos dois temas.
**ADR-0019 consolida o tema de comunicação/notificação antes disperso em
ADR-0005 (D-022–D-028, D-031–D-036), ADR-0010 (D-096/D-097) e ADR-0012
(D-107/D-108)** — não redecide esses D antigos, só referencia e adiciona os
eixos novos (ausência, preferências, categorias, calibragem de push) em ADR
próprio.

**Revisões** — uma decisão pode ser revisada por outra mais nova. O ADR original
recebe um ponteiro; o `Status` no topo de cada ADR e o campo `Revisa:` são a
verdade:

| Revisada | Por | Onde |
|---|---|---|
| D-094 (anamnese: quem responde) | D-102 | [0011](0011-modalidade-e-anamnese.md) |
| D-104 (`MealLog` binário) | D-118 | [0013](0013-dominio-nutricao.md) |
| D-063/ADR-0006 (esqueleto previu `MedicalRecord`) | D-122 | [0014](0014-dominio-medicina.md) |
| **ADR-0018 inteiro (D-158 – D-163)** — redecidiu o domínio de treino em conflito com o 0009 | **Superseded por ADR-0009** | [0018](0018-dominio-treino.md) → [0009](0009-dominio-treino.md) |
| **ADR-0009 revisado** (incorpora MuscleGroup, lifecycle DRAFT/ISSUED, `tenantId`, progressão sugerida) | D-164 – D-167 | [0009](0009-dominio-treino.md) |
| D-085 (progressão reativa, "sem automática") — **não reescrito**, complementado | D-167 (sugerida, nunca imposta) | [0009](0009-dominio-treino.md) |
| D-092 (indicadores; aderência sem denominador definido) — **não reescrito**, estendido | D-191 (denominador = disponibilidade do aluno) + D-193 (sem-denominador irrepresentável) | [0009](0009-dominio-treino.md) |
| D-188 (orçamento de treino: frequência **capturada**) — **não reescrito**, elevado a **obrigatório** | D-192 | [0011](0011-modalidade-e-anamnese.md) |
| D-173 ("não se aplica" é resposta válida) — **não revogado**, ganha **exceção nomeada** para a disponibilidade de treino | D-192 | [0011](0011-modalidade-e-anamnese.md) |

## Convenção

Novas decisões arquiteturais viram novos ADRs (ou seções em ADR existente do
mesmo tema). Decisões importantes nunca ficam só em conversa. O `README.md` da
raiz é a vitrine do projeto; **este** arquivo é o índice canônico das decisões.
