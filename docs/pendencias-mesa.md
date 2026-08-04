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

## 7. Aderência de treino — ligação com a anamnese e janela de agregação (D-191/D-192)

**Status:** `ABERTA — DEPENDE DE ORDEM` · **Origem:** adendo de aderência
(jul/2026), sobre o Bloco 3 da execução (#136)

**Atenção — a decisão de mesa já foi tomada; o que sobra aqui é implementação.**
O denominador da aderência **está decidido**: é a disponibilidade declarada pelo
aluno (D-191), obrigatória na anamnese (D-192), o que torna o estado "sem
denominador" irrepresentável (D-193). Esta entrada existe porque a decisão
**criou trabalho que ainda não tem onde acontecer** — e um dos itens **ainda é
decisão**, não código. Não confundir os dois:

**(a) Ligar o cálculo de aderência (Bloco 3) à disponibilidade da anamnese —
item de implementação, não de mesa.** O #136 entregou os **numeradores** (sessões
concluídas, dias treinados) e parou ali. Falta o join com a disponibilidade
(D-188) da anamnese ativa do vínculo (D-175) para produzir o **percentual**. É
acoplamento **novo** entre o domínio de treino e o de anamnese — antes o cálculo
de aderência não precisava alcançar a anamnese. **Depende de ordem:** o módulo de
anamnese de treino ainda não foi implementado; não há campo para ler.

**(b) Definir a janela de agregação da aderência — isto ainda é decisão.** O
denominador é **dias/semana**; a **janela** sobre a qual se agrega **não foi
decidida**: semana corrente? últimas N semanas (média móvel)? período de validade
do plano (D-083)? Cada opção conta uma história diferente sobre o mesmo aluno —
quem faltou nesta semana mas manteve 90% no mês aparece como problema numa e como
regular na outra. É o número que o profissional usa para decidir "quem está
sumindo" (D-092), então **não é detalhe de exibição**. O agente não escolhe
sozinho.

**Também pendente de implementação:** garantir na validação da anamnese que a
disponibilidade é obrigatória **e sem a opção "não se aplica"** (D-192) — é a
premissa da qual o D-193 depende. Se essa validação não for construída, o estado
"sem denominador" deixa de ser irrepresentável e a aderência volta a precisar de
fallback, que é exatamente o que a decisão eliminou.

**Contexto:** `docs/adr/0009-dominio-treino.md` → D-191, D-193 (e D-092, o
indicador que eles alimentam). `docs/adr/0011-modalidade-e-anamnese.md` → D-192,
D-188.

## 8. Atributos de exercício que a fonte tem e o schema não guarda (D-158 × D-187)

**Status:** `ABERTA` · **Origem:** #139 (seed da biblioteca PLATFORM)

O seed da base comum importou 870 exercícios da free-exercise-db. A fonte traz
**cinco atributos por exercício que não têm onde ser gravados** hoje:
`equipment`, `level` (iniciante/intermediário/avançado), `force` (empurrar /
puxar / isométrico), `mechanic` (composto/isolado) e `category`.

**Onde está a divergência:** o **ADR-0018 (D-158) descreve** `Exercise` com
"equipamento, padrão de movimento, dificuldade, mídia" — mas o schema que
efetivamente nasceu no #131 (ADR-0009 / D-089 / D-164) **não tem essas colunas**.
Não é esquecimento do #131 nem erro do ADR-0018: são dois ADRs descrevendo a
mesma entidade com escopos diferentes, e **ninguém decidiu qual vale**.

**O que o #137 fez, e por que parou aí:** mapeou tudo (o de-para de equipamento
para o catálogo do D-187 está pronto e testado em
`packages/database/src/seed/exercise-library/equipment-map.ts`), **contou** e
**reportou** — e não gravou nada. Criar coluna para acomodar dado de terceiro
seria decidir por conta própria que o D-158 vence o schema atual.

**Por que importa e não é cosmético:** o próprio D-187 diz que "na prescrição,
cada `Workout` é alocado a um contexto, e **só usa exercícios possíveis naquele
local/equipamento**". Essa regra é **inexequível** enquanto o exercício não
souber que equipamento exige. Filtrar a biblioteca por "o que dá para fazer em
casa" — que é o valor prático da base comum para o aluno sem academia —
depende desta decisão.

**Dependência de ordem:** o catálogo de equipamentos do D-187 também **ainda não
existe em tabela** (a anamnese tipada não chegou nos contextos de treino). Os
códigos usados no de-para do seed são **provisórios**, transcritos do texto do
ADR-0011; quem manda quando o D-187 for implementado é a tabela que nascer lá.
Decidir a coluna de equipamento **antes** do catálogo existir é decidir duas
coisas de uma vez.

**Contexto:** `docs/adr/0018-dominio-treino.md` → D-158.
`docs/adr/0011-modalidade-e-anamnese.md` → D-187.
`packages/database/seed/free-exercise-db/SOURCE.md`.

## 9. Imagens e tradução das instruções da base comum de exercícios

**Status:** `ABERTA` · **Origem:** #139 (seed da biblioteca PLATFORM)

Duas lacunas de **conteúdo** da base comum, distintas entre si e nenhuma
resolvível pelo agente sozinho:

**a) Imagem de exercício não tem coluna — nem decisão.** A fonte traz 1.746
imagens (2 por exercício, demonstrando início e fim do movimento). O schema só
tem `videoStorageKey` (D-091: vídeo é **referência**, não obrigatório). O seed
**não importou nenhuma** e **não hotlinka** `raw.githubusercontent.com` — servir
mídia de repositório de terceiro em produção é dependência silenciosa que quebra
sem aviso. Falta decidir: **imagem estática entra no modelo** (coluna nova +
migração das 1.746 para o nosso storage, que o `packages/storage` já suporta) ou
**o produto fica só com vídeo** (D-091) e a demonstração da base comum fica sem
mídia? A referência de origem está preservada no mapeamento para o caso de a
migração ser aprovada.

**b) As instruções de execução estão TODAS em inglês.** 865 dos 870 exercícios
têm instruções, e nenhuma foi traduzida. O nome foi (543 dos 870 em pt-BR); o
texto corrido não. **Não foi escolha de escopo, foi ausência de caminho:** não
há `ANTHROPIC_API_KEY` neste repositório e chamar API paga não foi autorizado.
Traduzir frase corrida por dicionário de termos produz português ruim em massa
— pior que o inglês, porque parece revisado. Falta decidir **como** traduzir:
passe de IA autorizado (custo pontual, ~870 chamadas), tradução humana da
curadoria, ou aceitar instrução em inglês na base comum.

**Onde morde:** a instrução é a **única orientação de execução** que a base comum
oferece. Um aluno brasileiro lendo "Lie down on the floor and secure your feet"
é fricção real no app do aluno, não detalhe de catálogo.

**Já preparado para a decisão:** cada exercício mapeado carrega
`descriptionLocale: 'en'`, exatamente para que o passe de tradução futuro saiba
o que reprocessar sem re-derivar nada.

**Contexto:** `packages/database/seed/free-exercise-db/SOURCE.md`.
`packages/database/src/seed/exercise-library/translate-exercise-name.ts`.
