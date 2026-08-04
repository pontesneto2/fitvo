# Pendências de mesa — decisões que ainda não foram tomadas

> **O que este documento é:** o catálogo das decisões que **o agente não pode
> tomar sozinho** e que ainda não foram levadas à mesa. Existe porque a regra
> "nunca inventar regra de negócio — se não está nos ADRs, propor e aguardar"
> (CLAUDE.md) só funciona se o que está faltando estiver **visível**. Sem este
> catálogo, cada pendência vive num `TODO` de código ou num parágrafo perdido de
> ADR e reaparece como surpresa três slices depois.
>
> **O que este documento NÃO é:** não é decisão, não é proposta, não é ordem de
> prioridade. **Nada aqui está resolvido.** Cada entrada registra o que está em
> aberto, onde a ausência morde hoje, e onde o contexto vive. A resolução vira
> ADR (ou adendo de ADR) — **nunca** um parágrafo neste arquivo.
>
> **Como se relaciona com os outros documentos:**
> - `docs/roadmap.md` → **BLOQUEADO — RESPONSÁVEL** já lista decisões pendentes
>   com contexto longo. Onde o detalhe já vive lá, esta entrada **aponta** em vez
>   de duplicar — texto duplicado diverge.
> - `docs/adr/` → a fonte das decisões **tomadas**. Vários ADRs têm seção "Gaps
>   conhecidos"; esta é a visão consolidada delas.
> - `docs/promessas-sem-gate.md` → buraco entre o que o projeto **diz** e o que
>   ele **prova**. Categoria diferente: lá a decisão existe e falta o gate; aqui
>   a decisão **não existe**.

**Convenção de status:** `ABERTA` (ninguém decidiu) · `ABERTA — GATED`
(depende de terceiro: jurídico, credencial) · `ABERTA — DEPENDE DE ORDEM`
(a decisão só é respondível depois que outra coisa existir).

---

## 1. Destinatário das notificações de overlap e de cobrança (D-028)

**Status:** `ABERTA` · **Origem:** achado do slice de workers (#132)

Dois call sites do worker seguem com `TODO(D-028): deliver via notifications
adapter` porque **quem recebe não está decidido em nenhum ADR**:

- `apps/worker/src/sharing/overlap-detection-service.ts` — a sugestão de
  sobreposição (D-017) vai para **o paciente ou para o profissional**?
- `apps/worker/src/billing/collection-ruler-service.ts` — o lembrete de
  cobrança vai para **qual conta do tenant**?

**Por que importa agora:** o #132 provou que **não é bloqueio de credencial**.
As réguas de plano de treino (D-083/D-084) passaram a entregar de verdade pelo
canal in-app assim que alguém plugou o adapter que já existia. Esses dois ficam
para trás por **falta de resposta de produto**, não por falta de infraestrutura
— e por isso não saem sozinhos com o tempo.

**Cuidado ao decidir:** o de cobrança toca **financeiro** e o de overlap toca
**consentimento/compartilhamento** — as duas áreas críticas da Política de
Merge. Mandar lembrete de cobrança para a conta errada de um tenant, ou expor a
sugestão de sobreposição para o lado errado do vínculo, não é bug cosmético.

**Contexto:** `docs/roadmap.md` → BLOQUEADO — RESPONSÁVEL, bullet "Entrega via
adapter de notificações — parcialmente conectada (D-028)".

## 2. Promoção `PRIVATE` → `PLATFORM` da biblioteca (curadoria)

**Status:** `ABERTA` · **Origem:** #131 (biblioteca de exercícios)

O D-170 fecha o **default seguro**: todo item de biblioteca nasce `PRIVATE` e a
rota de criação **nem aceita** `visibility`. O que **nenhum ADR decidiu** é o
caminho inverso — como um exercício (ou alimento) privado de um profissional
vira **base comum** `PLATFORM`:

- Quem aprova? (super admin FITVO? curadoria interna? nenhum, e a base
  `PLATFORM` só cresce por seed?)
- O profissional **opta** por contribuir, ou é convidado?
- O item promovido continua atribuído ao autor? (o D-168 trata o método como
  **PI de quem criou** — promover sem responder isso é ambíguo)
- Promoção é cópia ou mudança de flag? (mudar a flag do registro original o tira
  da biblioteca privada de quem o criou)

**Efeito hoje:** a base `PLATFORM` só nasce por seed. Nada quebra — mas o
produto não tem caminho para a base comum crescer com o uso, que é justamente o
que faria a biblioteca valer.

**Vale para os dois domínios:** `Exercise` (ADR-0009) e `Food`/`FoodGroup`
(ADR-0013 referencia D-168–D-171). Decidir num só e esquecer o outro é o erro
previsível aqui.

**Contexto:** `docs/adr/0009-dominio-treino.md` → D-168 a D-171.

## 3. Editar série de item já executado — D-085 × D-100

**Status:** `ABERTA — DEPENDE DE ORDEM` (vira mesa quando o Bloco 3 existir)
**Origem:** #133 (Bloco 2 — prescrição)

Conflito **real** entre duas decisões vigentes, e **nenhum ADR diz qual vence**:

- **D-085** — o profissional edita a ficha quando quiser (progressão reativa).
- **D-100** — histórico de execução **não se apaga**.

Trocar as séries de um item que o aluno **já executou** exige violar uma das
duas. Hoje a implementação **não escolhe**: `replaceSets`
(`apps/api/src/modules/workout/prisma-workout-repository.ts`) conta os `SetLog`
e devolve **`409` com a mensagem "prescreva um item novo"** antes de deletar
qualquer coisa. O `onDelete: Restrict` em `SetLog.workoutSet` é a rede de
segurança no banco.

**Por que é trava provisória e não solução:** o `409` é uma **recusa**, não uma
resposta de produto — o profissional que precisa corrigir um erro de digitação
numa série já executada fica sem caminho. Só que **o caso não é alcançável
hoje**: sem o Bloco 3 (execução), não existe `SetLog` para conflitar. Registrar
uma resolução agora seria inventar regra para um caso que ninguém ainda viveu.

**Quando abrir a mesa:** ao iniciar o Bloco 3. As saídas plausíveis (versionar
a prescrição; permitir editar só séries **sem** log; tombstone da série
substituída) têm consequências diferentes para o histórico do aluno e para os
indicadores de adesão (D-092) — é decisão, não detalhe de implementação.

**Contexto:** `docs/roadmap.md` → "Domínio de treino — mapa do que entrou e do
que falta".

## 4. Biblioteca por-clínica (dimensão que o D-171 deixou de fora)

**Status:** `ABERTA` · **Origem:** #131 / adendo D-168–D-171

O D-171 fixou o MVP: a biblioteca escopa **por profissional**
(`ownerProfessionalProfileId`), **não por tenant**. Numa clínica com vários
profissionais, o item privado de um **não** é visível aos colegas — coerente com
o método como PI de quem o criou (D-168/D-170).

**Está registrado como comportamento correto, não como bug.** O que fica aberto
é a dimensão **a mais**: se uma clínica pode ter uma biblioteca **comum
interna**, compartilhada entre seus profissionais e distinta da base global
`PLATFORM`. O próprio D-171 remete isso a **adendo próprio**.

**Interage com a pendência #2:** se existir nível de clínica, a promoção passa a
ter **dois** destinos (`PRIVATE` → comum-da-clínica → `PLATFORM`), e decidir a
curadoria sem saber se esse nível intermediário existe é decidir duas vezes.

**Contexto:** `docs/adr/0009-dominio-treino.md` → D-171.

## 5. Campos de anamnese dos módulos de nutrição e nutrologia (D-103)

**Status:** `ABERTA — DEPENDE DE ORDEM` (ler ADR-0013 e ADR-0014 antes)
**Origem:** adendo ao D-103

O núcleo e o **módulo treino** da anamnese estão **fechados** (D-187–D-190,
#130). Os outros dois módulos não — e a lista de candidatos já existe, sem
decisão:

- **Nutrição:** escala de Bristol (o D-103 já pede "hábito intestinal" sem
  instrumento), histórico de peso (mín/máx adulto, efeito sanfona, bariátrica,
  medicamento para emagrecer), comportamento alimentar (compulsão, fome
  emocional), preferências e aversões.
- **Nutrologia:** perfil hormonal masculino/feminino (é o **núcleo** da
  nutrologia esportiva, não acessório), histórico hormonal (TRT, GH, peptídeos,
  anabolizantes — substância, dose, tempo de uso; o D-103 só tem "uso de
  esteroides" no módulo de treino, **raso demais para o médico**), catálogo de
  exames laboratoriais como o que o médico **solicita** (D-076), não campo de
  anamnese.
- **Transversal:** objetivos mensuráveis (peso alvo, % gordura alvo, **data**
  objetivo, evento específico) — vai além de anamnese, vira meta com prazo e
  alimenta dashboard.

**Pré-requisito de leitura, não de código:** a anamnese de nutrologia depende de
exames laboratoriais (D-124, ADR-0014 fase 3) e a de nutrição da modelagem do
ADR-0013. **Ler os dois ADRs antes de abrir a mesa** — parte destes campos pode
já ter dono lá, e decidir de novo criaria conflito com decisão existente.

**Já rejeitado — não voltar à mesa** (motivos em `docs/roadmap.md`): anamnese
única compartilhada entre profissionais; avaliação física/bioimpedância dentro
da anamnese; score de saúde por IA visível ao paciente; saúde
sexual/fertilidade no núcleo.

**Contexto:** `docs/roadmap.md` → BLOQUEADO — RESPONSÁVEL, bullet "Adendo ao
D-103 (taxonomia da anamnese)". `docs/adr/0011-modalidade-e-anamnese.md`.

## 6. Texto jurídico da anamnese — PAR-Q e ciência de risco (D-178)

**Status:** `ABERTA — GATED` (advogado) · **Origem:** ADR-0011

O D-178 decidiu o **mecanismo**: sinal de risco no PAR-Q dispara **alerta forte
ao profissional** + **ciência do aluno**, reusando o mecanismo de aceite
versionado do D-025. O que está marcado **RASCUNHO no próprio ADR** é o **texto**
que o aluno assina.

**Por que não é detalhe de conteúdo:** é o texto que registra que o aluno **foi
informado de um risco de saúde e seguiu mesmo assim**. Redigido pelo agente, é
rascunho de portfólio; com valor jurídico, precisa de advogado. E como o
mecanismo do D-025 **versiona o aceite**, publicar um texto e trocá-lo depois
dispara **re-consentimento** de quem já aceitou — errar a primeira versão custa
uma rodada de re-aceite em toda a base.

**Não bloqueia a implementação:** o mecanismo pode ser construído com o texto
rascunho e o conteúdo final entra por versão nova, que é exatamente o que o
D-025 existe para suportar.

**Companhia:** entra no mesmo pacote jurídico já listado em BLOQUEADO —
TERCEIROS (política de estorno, termos de uso, política de privacidade —
D-021/D-025). Uma conversa com advogado, não quatro.

**Contexto:** `docs/adr/0011-modalidade-e-anamnese.md` → D-178.
