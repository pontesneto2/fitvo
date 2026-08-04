# ADR-0009 — Domínio de Treino

**Status:** Aceito (revisado jul/2026 — incorpora contribuições do ADR-0018, superseded; adendo de biblioteca de catálogo D-168 a D-171; adendo de aderência ancorada na disponibilidade D-191 e D-193)
**Decisões cobertas:** D-079 a D-092, D-105, D-164 a D-171, D-191, D-193

> **Revisão de jul/2026.** O [ADR-0018](0018-dominio-treino.md) redecidiu este mesmo
> domínio sem consultar este ADR, gerando conflito de filosofia (prescrição por
> alvos vs. série-linha; progressão automática vs. reativa; append-only vs. merge
> por campo). A mesa resolveu **em favor deste ADR** e marcou o 0018 como
> **superseded**. Três contribuições do 0018 foram incorporadas aqui — taxonomia de
> grupo muscular (**D-164**), lifecycle DRAFT/ISSUED/CANCELLED (**D-165**) e
> `tenantId` explícito por ADR-0017 (**D-166**) — mais um complemento ao D-085
> (**D-167**, progressão sugerida). O D-085 original **não foi reescrito**: decisão
> registrada não se apaga, a evolução fica rastreável.

## Contexto

O esqueleto de conteúdo (PR #14, ADR-0006) deixou o domínio de treino como
estrutura mínima — `Workout`/`WorkoutItem` com o detalhe fino deferido para
`detail Json?` e marcador `TODO(D-063)`. O D-063 era decisão humana com
referência de produto (MFit como benchmark do líder de mercado). Esta ADR fecha
o D-063 **para treino**: consolida a hierarquia, os campos finos e as regras de
execução, avaliação e biblioteca. Treino é o coração do produto — sem ele não
existe FITVO.

Nutrição e medicina seguem a mesma lógica e continuam deferidos (dependem de
referência própria — Dietbox — e de decisão humana). Esta ADR não os antecipa.

## Decisão

### D-079 — Hierarquia do domínio de treino

A modelagem passa a ter cinco níveis:

```
Vínculo (bond = paciente ↔ profissional+especialidade = "ambiente")
  └── N Planos ATIVOS simultâneos (ex.: "Musculação Julho" + "Cardio Julho")
       └── Treinos do plano (A/B/C  OU  dias da semana)
            └── Exercícios do treino
                 └── Séries (cada uma é uma linha própria)
```

- **Caso comum otimizado:** um profissional por especialidade. Dentro do
  vínculo, o aluno pode ter vários planos ativos ao mesmo tempo, **todos do
  mesmo profissional**.
- O modelo N:N do vínculo (D-002/D-052) permanece como **capacidade** — dois
  personais = dois ambientes (dois vínculos). A interface é otimizada para o
  caso comum, sem perder a capacidade.
- O esqueleto atual tem apenas três níveis (`Bond → Workout → WorkoutItem`).
  Falta o nível **plano**: `Workout` hoje acumula os papéis de "plano" e
  "treino". A modelagem introduz `WorkoutPlan` acima de `Workout` (ver
  "Impacto de modelagem").

### D-080 — Organização do plano: A/B/C ou dias da semana

- A organização é escolhida **por plano**, não global: **A/B/C** (o aluno
  executa na ordem que quiser) ou **dias da semana** (cada treino tem dia
  marcado).
- As duas opções coexistem no produto; a escolha é um atributo do plano.

### D-105 — Plano fixo × plano variável

> Adicionado depois da aceitação inicial deste ADR. Complementa o D-079.

- Além dos planos **variáveis** (que rodam por dia ou por letra — D-080), existe
  o **plano FIXO**: um plano que vale **todo dia**, ou **nos dias escolhidos pelo
  profissional**, e que **não interfere nos demais planos ativos**.
- **Caso de uso real:** plano de alongamento/mobilidade que o aluno faz sempre,
  independente de ser dia de treino A ou B.
- **Não é alternativa aos outros — coexiste** permanentemente. O profissional
  decide se inclui e em quais dias vale.
- **Distingue-se do D-079:** lá são planos que **competem pelo tempo** do aluno
  (o aluno escolhe entre "Musculação Julho" e "Cardio Julho"); aqui é um plano que
  **roda por cima de todos**. A diferença não é cosmética: um plano fixo não deve
  ser contado como "o treino de hoje" nos indicadores de aderência (D-092), senão
  o alongamento infla a aderência de quem não treinou.
- **Vale para treino.** **Não se aplica a nutrição** — não existe "dieta que roda
  por cima das outras" (ver D-112, ADR-0013).

### D-081 — Séries nunca uniformes

- **Cada série é uma linha própria**, com seus próprios valores. Um exercício
  pode ter séries totalmente diferentes entre si.
- Campos por série: ordem, repetições (incluindo "até a falha"), carga,
  descanso, técnica, observação.
- Modelar como "3×12 a 20kg" (uniforme) é **proibido** — é requisito explícito.
  Exemplo que precisa ser suportado: série 1 (12 reps · 20kg · 60s · normal),
  série 2 (10 reps · 25kg · 90s · normal), série 3 (falha · 25kg · 90s ·
  drop-set).
- Consequência de modelagem: `WorkoutItem.detail Json?` é substituído por uma
  entidade filha `WorkoutSet` (uma linha por série).
- **A carga é modelada em colunas tipadas separadas** (peso / duração /
  distância / peso corporal), **nunca** num par polimórfico `valor + unidade`.
  Motivo: o D-092 exige "evolução de carga por exercício"; com valor
  polimórfico, uma agregação mal escrita soma gramas com segundos e o **bug é
  silencioso**. Colunas tipadas tornam o estado inválido irrepresentável. O caso
  é real, não hipotético — o D-079 cita "Cardio Julho" como plano ativo
  convivendo com musculação, então séries de tempo/distância convivem com carga.
- Todas as grandezas são **inteiras** (gramas, segundos, metros — nunca float),
  com formatação só na exibição, na mesma disciplina do dinheiro em centavos
  (D-069).

### D-082 — Exercícios conjugados

- Suportar agrupamento de exercícios: bi-set, tri-set, circuito. Exercícios
  conjugados são executados em sequência, sem descanso entre eles.
- É atributo estrutural do treino (agrupamento de itens), não um tipo novo de
  exercício da biblioteca.
- **As rodadas de um circuito são as séries, não um contador.** "3 rodadas de
  A+B+C" = cada item do grupo tem 3 séries; a **rodada N é a série de ordem N**
  de cada item. Um campo `roundCount` no grupo foi **rejeitado**: ou força
  rodadas idênticas (violando o D-081, que proíbe séries uniformes — na prática
  a rodada 3 é mais pesada ou até a falha), ou é redundante com a contagem de
  séries e pode divergir dela (estado inválido representável). Rodada-como-série
  preserva a variação por rodada de graça.
- O descanso entre rodadas é o `restSeconds` da série do **último item** do
  grupo (os anteriores vão a zero) — não exige campo de grupo.
- **Invariante** (camada de domínio): todos os itens de um mesmo grupo têm a
  mesma contagem de séries. Grupo malformado é erro de validação.
- **Fora de escopo:** circuito por tempo com rodadas indeterminadas (AMRAP,
  EMOM) — ver "Gaps conhecidos" abaixo.

### D-083 — Validade do plano

- Todo plano tem validade própria: **30 dias por padrão, configurável** pelo
  profissional. É independente da vigência da consultoria, mas **comunicante**.
- **Plano vence com consultoria ativa** → avisa o profissional ("o plano do
  João vence em 3 dias") e o aluno vê "plano expirado, aguarde novo treino".
- **Consultoria encerra** → o vínculo vira arquivo e o histórico é preservado
  (D-053, ADR-0001).
- **Regra inegociável:** o aluno nunca fica sem nada silenciosamente. Sempre há
  comunicação — a régua de vencimento é varredura de worker (BullMQ).

### D-084 — Agendamento de liberação de plano

- O profissional pode **programar treinos/planos para liberação futura**: monta
  o planejamento completo (ex.: 3 meses) e o sistema libera cada plano conforme
  a data programada.
- Ataca a dor #1 do mercado (montar treino toma tempo) e é diferencial
  competitivo. A liberação agendada é varredura de worker (mesma régua de
  D-083).

### D-085 — Progressão reativa (não prescrita)

- **Não** existe progressão automática embutida no plano (nada de "semana 1-4:
  3×12; semana 5-8: 4×10" avançando sozinho).
- O profissional observa a evolução e **edita a ficha quando quer**.
- O sistema deve ser **inteligente ao apresentar a evolução**: linha do tempo
  com os dados que realmente demonstram progresso ao longo do período. A
  inteligência está na leitura, não na prescrição.

### D-086 — Execução do treino pelo aluno

Ao executar, o aluno:
- **Marca conclusão** (obrigatório).
- **Registra a carga real usada** (pode divergir da prescrita — o dado real é
  o que importa para a evolução, D-085).
- **Avalia o treino** (obrigatório — D-087).

A marcação de conclusão **também conta como check-in** do aluno no app e
alimenta os indicadores (D-092). A execução é o principal alvo de escrita
offline (D-099, ADR-0010): a série é registrada no momento do uso, com ou sem
sinal.

### D-087 — Avaliação do treino: "instagramável"

- A avaliação é interativa e projetada para ser **printada e compartilhada**
  (pelo aluno e pelo profissional) — objetivo de produto: aquisição orgânica.
- Composição: **nota 1 a 5**, **nível de esforço percebido**, **comentário
  livre** e **reações rápidas** com personalidade (ex.: "morri 💀", "voei 🚀",
  "perna bamba 🦵") — as reações são o que torna a tela printável.
- Uma avaliação por sessão executada (não por plano).
- **O enum guarda o código** (`DIED`, `FLEW`, `WOBBLY_LEGS`); o **label e o
  emoji vivem no i18n/config**, nunca no enum — coerente com D-066 (textos
  externalizados desde já). Trocar "morri 💀" por outro texto é mudança de
  tradução, **zero migração**; só adicionar reação nova exige migração, o que é
  raro e aceitável. Mesma regra vale para as técnicas de série (D-081):
  `DROP_SET`, `BI_SET` são códigos; a redação é i18n.
- Catálogo em tabela (profissional cria a própria reação/técnica) fica para
  depois, se a iteração provar ser frequente — não se antecipa.

### D-088 — Análise de forma por IA (assíncrona, com validação profissional)

- O aluno **grava um vídeo** da execução; a IA **pré-analisa** (pose
  estimation) e sugere pontos de atenção; o **profissional valida** antes de
  qualquer devolutiva ao aluno. **Não** é análise ao vivo por câmera.
- **Justificativa (baseada em pesquisa):** captura markerless por câmera única
  não é grau-laboratório — a acurácia degrada no plano transverso e sob
  oclusão. Além disso, o profissional é o responsável técnico: IA dando
  devolutiva direta ao aluno sobre execução é risco de lesão e de
  responsabilidade civil. O humano fica no circuito — coerente com D-023
  (ADR-0005): profissional valida a saída da IA antes de chegar ao leigo.
- A saída bruta da pose estimation é payload semiestruturado do provider
  (legítimo para `Json`, ao contrário do conteúdo de domínio — ver "Impacto de
  modelagem"); a devolutiva ao aluno só existe após aprovação do profissional.

### D-089 — Biblioteca de exercícios: deleção lógica

- A biblioteca é **base compartilhada da plataforma** (sem dono, `PLATFORM`) +
  **itens próprios do profissional** (privados por padrão, `PRIVATE`) —
  reafirma D-064 (ADR-0006), já modelado no esqueleto.
- Mudanças na biblioteca **propagam para todo o app** (componentização):
  melhorar vídeo, corrigir descrição. A propagação nunca substitui a natureza
  do exercício.
- **Deleção é sempre lógica.** Estados de um item de biblioteca:
  - `ativo` — aparece na busca, pode ser adicionado a treinos novos;
  - `descontinuado` — some da busca, mas continua funcionando nos treinos que
    já o usam; o histórico permanece íntegro.
- Ao descontinuar um item em uso, **avisar os profissionais afetados** e
  sugerir substituto.
- **Separação de responsabilidade:** o **treino** guarda o que foi prescrito
  (carga, série, técnica — em `WorkoutSet`/`WorkoutItem`); a **biblioteca**
  guarda o que o exercício é (nome, vídeo, músculo — em `Exercise`). A
  propagação da biblioteca nunca reescreve a prescrição.
- **Regra geral do sistema:** deleção lógica vale para tudo — exercício,
  alimento, plano comercial, especialidade. O que sai de circulação continua
  existindo para quem já usa. Alinhado a "nunca apagar dados automaticamente" e
  à guarda legal de dado clínico (D-100, ADR-0010).

### D-090 — Clonagem de treino

- O profissional pode **clonar um treino/plano** de um aluno para outro e
  editar. Cópia profunda (plano → treinos → exercícios → séries) para um novo
  vínculo. Economiza horas — feature do líder de mercado (MFit) e ataque à dor
  #1.
- A clonagem cria registros próprios do vínculo de destino (isolamento por
  vínculo — ADR-0001); pode registrar a linhagem de origem como dado, sem
  vincular a execução de um aluno à do outro.

### D-091 — Vídeo dos exercícios

- Cada exercício da biblioteca base tem vídeo demonstrativo — **paridade
  competitiva**, não inovação (MFit ~1.800; Personal Fit ~700). O vídeo é
  referência de storage (chave S3), no mesmo padrão de `ProgressPhoto`.
- **Geração de vídeo por IA: rejeitada** — cara, lenta e pior que filmar.
  Filmar os exercícios bem feitos custa menos e entrega mais.

### D-092 — Indicadores do domínio de treino

O dado nasce suportando estes cálculos (a tela de dashboard é fase posterior —
o **dado** precisa nascer certo, com índices por data):

- **Para o aluno:** aderência (% de treinos concluídos no período), evolução de
  carga por exercício (linha do tempo — o gráfico que motiva), sequência de
  dias treinados (streak), volume total por semana.
- **Para o profissional:** aderência dos alunos (quem está sumindo), alunos com
  plano vencendo (D-083), evolução agregada, alunos avaliando o treino como
  muito difícil/fácil (sinal de ajuste — D-087), mensagens sem resposta
  (ADR-0010, D-096).

Todos os indicadores são **derivados** de execuções e séries registradas — não
há entidade nova de indicador, há índices planejados.

---

> As quatro decisões a seguir entraram na **revisão de jul/2026** (ver nota do topo).
> As três primeiras são contribuições preservadas do ADR-0018 (superseded); a
> quarta complementa o D-085 sem reescrevê-lo.

### D-164 — Taxonomia de grupo muscular: tabela-pai com primário + secundários

> Contribuição preservada do ADR-0018 (D-158). **Fecha o gap** "Taxonomia de grupo
> muscular" que este ADR listava como aberto.

- `MuscleGroup` é **tabela-pai**, não enum: o catálogo de grupos musculares vive em
  linha de banco, o que permite adicionar/renomear grupo sem migração de enum e
  manter rótulo no i18n (mesma disciplina do D-087 — o código é estável, a redação
  é tradução).
- Cada `Exercise` tem **um grupo primário** (FK obrigatória para `MuscleGroup`) e
  **N grupos secundários** (relação N:N). Um supino tem primário `PEITO` e
  secundários `TRICEPS`/`OMBRO` — o modelo precisa dos dois, senão a busca por
  "exercícios de tríceps" perde os compostos.
- **Por que não enum fixo:** enum obriga migração a cada ajuste de taxonomia e não
  hospeda atributo (região do corpo, ordem de exibição, ilustração). **Por que não
  só uma lista de músculos sem primário:** sem primário não há como agrupar o treino
  por grupo dominante nem calcular volume por grupo — perde-se um indicador que o
  D-092 pressupõe.
- Segue a deleção lógica do D-089: grupo descontinuado some da busca e continua
  válido nos exercícios que já o usam.

### D-165 — Lifecycle do plano: DRAFT / ISSUED / CANCELLED

> Contribuição preservada do ADR-0018 (D-158).

- `WorkoutPlan` ganha `status` com o **lifecycle padrão do projeto**:
  `DRAFT` → `ISSUED` → `CANCELLED`.
- **Imutabilidade na emissão:** um plano em `DRAFT` é livremente editável e **não é
  visível ao aluno**; ao ser emitido (`ISSUED`), o que foi prescrito é o que o aluno
  vê. Alteração posterior é ato explícito e rastreável, não edição silenciosa de
  algo que o aluno já está executando. `CANCELLED` retira o plano de circulação sem
  apagá-lo — deleção lógica (D-089).
- **Habilita o fluxo de validação do estagiário:** o estagiário monta o plano em
  `DRAFT`, o supervisor com CREF revisa e emite (`ISSUED`). Isso engancha no vínculo
  estagiário↔supervisor do [ADR-0015](0015-cadastro-convites-e-vinculo.md)
  (D-142/D-143), onde o estagiário não tem responsabilidade técnica própria.
- **O fluxo de validação em si é slice futuro** — quem pode emitir, notificação ao
  supervisor, fila de pendências e devolutiva são decisão de produto ainda não
  tomada. O que nasce **aqui** é o **lifecycle que o habilita**: sem `DRAFT`, não há
  onde o trabalho não-emitido existir, e retrofitar estado em plano já em uso é caro.
- Interage com o D-084 (liberação agendada): plano programado para o futuro nasce
  emitido com data de início futura — agendamento é **quando vale**, `DRAFT` é
  **se está pronto**. São eixos distintos e não se substituem.

### D-166 — Isolamento por tenant em todo o domínio de treino

> Contribuição preservada do ADR-0018 (D-158). Não redecide nada deste ADR — **soma**
> a camada de tenant do [ADR-0017](0017-tenant-isolation.md), posterior a ele.

- Todas as tabelas do domínio de treino — `WorkoutPlan`, `Workout`, `WorkoutItem`,
  `WorkoutSet`, `WorkoutSession`, `SetLog`, `WorkoutRating`, `FormAnalysis`,
  `Exercise`, `MuscleGroup` — carregam **`tenantId` + `@@index([tenantId])`**,
  conforme ADR-0017 (D-150 – D-155).
- **Não substitui o isolamento por vínculo** deste ADR (D-079/D-090, ADR-0001): o
  `bond` continua sendo o eixo que diz *de quem é aquele plano*. O `tenantId` é a
  camada de **defense in depth** por cima — a extensão do Prisma escopa a query
  mesmo que o filtro de vínculo seja esquecido. As duas camadas convivem; nenhuma
  torna a outra opcional.
- A biblioteca compartilhada da plataforma (`PLATFORM`, D-089) e o catálogo base de
  `MuscleGroup` são o caso legítimo de linha **sem dono de tenant** — o
  comportamento exato desse escopo global segue o que o ADR-0017 definir para
  registros de plataforma, e não é redecidido aqui.
- **Ordem de implementação:** o slice de treino roda **depois** do tenant isolation
  implementado; enquanto não estiver, vale a disciplina de `tenantId` explícito em
  toda query.

### D-167 — Progressão automática SUGERIDA (não imposta) — complementa o D-085

> **Complementa o D-085, não o substitui.** O D-085 permanece como registrado — a
> decisão de que o sistema não prescreve progressão sozinho continua válida. O que
> muda é que passa a existir um **assistente** dentro desse princípio.

- O sistema **pode pré-preencher uma sugestão de progressão** no próximo treino —
  por exemplo, sugerir +carga quando o aluno bateu todas as repetições prescritas.
  Isso é **sugestão**: o profissional **aceita, edita ou ignora**.
- **Mantém o princípio do D-085** — o profissional é o decisor e a inteligência está
  na leitura do dado, não na prescrição. A diferença é que a leitura agora chega
  pronta para virar edição com um toque, economizando tempo (a dor #1 do mercado,
  D-084/D-090).
- **A automação NUNCA prescreve sozinha sem o aval do profissional.** Não existe
  plano que avance de semana por conta própria (o que o D-085 rejeitou), nem carga
  que suba no plano do aluno sem alguém com responsabilidade técnica ter confirmado.
  Coerente com o D-023 (ADR-0005) e com o D-088: a IA sugere, o profissional valida
  antes de chegar ao aluno.
- **Dados de evolução/progressão aparecem em várias partes do app** — dashboards do
  aluno e do profissional — todos **derivados das execuções** registradas, sem
  entidade de agregação própria. Coerente com o D-092.
- O **algoritmo** da sugestão (regra linear simples, critério por nível do aluno,
  janela de histórico) é slice futuro com mesa própria. O que este D fixa é o
  **contorno**: sugerir sim, impor nunca.

---

> As quatro decisões a seguir entraram como **adendo de biblioteca de catálogo**
> (jul/2026, decisão de mesa). O tenant isolation (ADR-0017) expôs que a
> biblioteca de exercícios escopa por **profissional**, não por tenant — faltava
> a regra de **produto**: o que vira base comum compartilhada vs. o que fica
> privado. A mesma regra vale para o catálogo de nutrição (`Food`/`FoodGroup`,
> ADR-0013) — este ADR fixa o critério; o [ADR-0013](0013-dominio-nutricao.md)
> referencia, não duplica.

### D-168 — Critério de classificação da biblioteca: dado sobre o MUNDO vs. sobre PESSOA/MÉTODO

- A pergunta que classifica qualquer item de biblioteca (`Exercise`, e por
  extensão `Food`/`FoodGroup` — ADR-0013): **este dado é sobre o MUNDO, ou sobre
  uma PESSOA/o MÉTODO do profissional?**
  - **Comum (compartilhável):** fato genérico que não pertence a ninguém —
    "supino inclinado trabalha peitoral superior", "banana prata tem 98 kcal por
    100g".
  - **Sensível/privado (nunca vira base comum):** dado ligado a uma pessoa
    específica (a ficha do aluno, a avaliação do paciente — já escopado por
    vínculo, D-079/ADR-0001) ou o **método proprietário** do profissional (um
    protocolo autoral que ele considera PI).
- **Caso-limite, e é a inteligência da separação:** o mesmo item é comum ou
  sensível conforme o contexto. O exercício "supino inclinado" (o item da
  biblioteca) é **comum**; "prescrevi 4×10 de supino inclinado ao João"
  (`WorkoutItem`/`WorkoutSet` do vínculo do João) é **sensível**. A biblioteca
  contribui o **exercício**, nunca a prescrição/carga/contexto de uso num aluno
  — a mesma fronteira que o D-089 já traça entre "o que o exercício é" (Exercise)
  e "o que foi prescrito" (WorkoutSet/WorkoutItem).

### D-169 — Base comum cresce por anti-duplicação normalizada na entrada

- Item comum entra na base **só se não existir equivalente**; se já existe, o
  profissional **usa o existente** — não sobrepõe, não duplica. O primeiro
  cadastro fixa o registro; os próximos reutilizam. Previne o inchaço de base
  (o problema do "mil registros de arroz com macros divergentes").
- **Requisito técnico real, não "nome igual":** a comparação de "já existe" é
  **normalizada** — case-insensitive, acento-insensível, espaço/hífen-insensível
  ("supino reto", "Supino Reto", "supino-reto" são o **mesmo** item). Igualdade
  literal de string **não** satisfaz esta decisão.
- Ao detectar um item similar, o fluxo ideal oferece o existente ("já existe
  'supino reto' — é este?") em vez de criar cego — refinamento de UX do slice de
  biblioteca, não bloqueante desta decisão.

### D-170 — Dado privado nunca vira base comum; default seguro

- Dado sobre uma pessoa (ficha, avaliação, prescrição) é escopado por vínculo —
  nunca entra na biblioteca comum, nunca é visível a outro profissional. Já
  garantido pelo tenant isolation (ADR-0017) e pelo D-079 (isolamento por
  vínculo).
- Método proprietário do profissional fica privado por **marcação explícita**:
  ao criar um item que é método dele (ex.: um protocolo autoral de exercícios em
  sequência), o profissional o marca como privado — reaproveita o estado
  `PRIVATE` que o D-089 já reafirma do D-064 (ADR-0006).
- **Default seguro:** na dúvida entre comum e método proprietário, o item
  **permanece com o profissional**. Ele opta ativamente por contribuir; o
  sistema nunca promove um item a comum por conta própria.

### D-171 — Biblioteca escopa por profissional, não por tenant — dimensão por-clínica é decisão futura

- Reafirma o comportamento já modelado (D-089, `PLATFORM`/`PRIVATE` por
  `ownerProfessionalProfileId`) como **decisão de produto explícita**, não só
  detalhe de schema: numa clínica com múltiplos profissionais, o item privado de
  um não é visível aos demais por padrão — coerente com D-168/D-170 (o método é
  PI de quem o criou, não da clínica).
- **Fica registrado como comportamento correto do MVP.** Se no futuro se decidir
  que uma clínica pode ter uma biblioteca **comum interna** (compartilhada entre
  seus profissionais, distinta da base global `PLATFORM`), isso é uma dimensão a
  mais — **decisão futura em adendo próprio**, não redecidida aqui.

---

> As duas decisões a seguir entraram como **adendo de aderência ancorada na
> disponibilidade do aluno** (jul/2026, decisão de mesa). **Estendem o D-092 —
> não o reescrevem:** o D-092 continua valendo integralmente (a aderência é um
> indicador **derivado**, sem entidade própria). O que faltava era a **fonte do
> denominador**: o Bloco 3 da execução (#136) entregou os numeradores (sessões
> concluídas, dias treinados) mas não o percentual, porque "quantos treinos eram
> esperados" não estava decidido em lugar nenhum. Este adendo fixa essa fonte.
> A terceira decisão do mesmo adendo — disponibilidade como campo **obrigatório**
> na anamnese — vive no [ADR-0011](0011-modalidade-e-anamnese.md) (**D-192**),
> onde a anamnese tem casa.

### D-191 — O denominador da aderência é a disponibilidade declarada pelo ALUNO

A aderência é calculada contra a **disponibilidade de dias/semana que o próprio
aluno declara** na anamnese de treino ([ADR-0011](0011-modalidade-e-anamnese.md),
D-188/D-192), **não** contra uma meta imposta pelo profissional.

```
aderência = sessões concluídas ÷ dias disponíveis declarados pelo aluno
```

- **Uniforme para `LETTER` e `WEEKDAY`** — a organização do plano (D-080) **não
  afeta** o cálculo. Seja A/B/C livre ou treino-por-dia, o esperado é sempre a
  disponibilidade do aluno. Declarou 4x/semana, o denominador é 4,
  independentemente de como o plano está organizado. Isso resolve o problema que
  travava o cálculo: o `LETTER` é executado "na ordem que o aluno quiser" e
  portanto **não tem dia esperado** — sem uma fonte única de denominador, o % do
  plano `LETTER` seria inventado.
- **Fundamento de produto:** a frequência **sempre parte do aluno**; o
  profissional se **adapta** a ela. O profissional nunca impõe "você vai treinar
  Nx" — ele monta o treino **dentro** da disponibilidade informada. Medir a
  aderência contra a disponibilidade do aluno é medi-la contra aquilo com que ele
  mesmo se comprometeu — honesto, e coerente com a filosofia do FITVO (o
  profissional serve o aluno).
- **O plano fixo (D-105) continua fora da aderência** — não conta, como já
  decidido. Este D trata do denominador dos planos que **contam**.
- Não cria entidade nova: o denominador é **lido** da anamnese ativa do vínculo
  (D-175), do mesmo jeito que os numeradores são derivados das execuções. O D-092
  segue valendo — indicador é derivado, não persistido.

### D-193 — O estado "aderência sem denominador" é irrepresentável por construção

Como a anamnese é **trava de entrada** ([ADR-0011](0011-modalidade-e-anamnese.md),
D-172) e a disponibilidade é **obrigatória sem "não se aplica"** (D-192), é
**impossível** existir um treino cujo aluno não tenha disponibilidade declarada.
Logo, **todo treino sempre tem denominador de aderência** — o caso "aderência sem
%" não pode acontecer.

- **Não há fallback, e isso é intencional:** não se define default de
  denominador, nem estado de UI "aderência indisponível", porque o estado ruim é
  **irrepresentável**, não apenas improvável. `construir > validar`.
- **Consequência de UI:** existe **um só jeito** de mostrar aderência, para
  qualquer plano e qualquer organização. Some a inconsistência "uns planos têm %,
  outros não".
- **Trava de implementação:** se em algum momento aparecer código precisando
  tratar "sem denominador", isso é sinal de que uma das duas premissas foi
  quebrada (trava de entrada ou obrigatoriedade do campo) — o conserto é
  restaurar a premissa, **não** adicionar fallback.

## Gaps conhecidos (decisão de produto pendente — não modelar sem ADR)

Registrados aqui para ficarem **visíveis, não esquecidos**. Nenhum é bloqueante
do MVP; nenhum deve ser modelado por conta própria.

### Blocos com teto de tempo — AMRAP/EMOM

- **Não são expressáveis no modelo atual.** A rodada-como-série (D-082) cobre
  circuito de rodadas **conhecidas** ("3 rodadas de A+B+C"). Não cobre AMRAP
  ("máximo de rounds em 12 min") nem EMOM ("a cada minuto, por 10 min"), onde a
  contagem de rodadas é **indeterminada na prescrição**.
- Um contador de rodadas (`roundCount`) **também não resolveria** — o problema
  não é contar, é que não há número a prescrever.
- Resolver exigiria um **bloco com teto de tempo e alvo** (entidade nova com
  `durationCapSeconds` + critério de pontuação) — mudança estrutural, não campo
  extra.
- **Relevante se** CrossFit/HIIT/treino funcional entrarem no escopo de verdade.
  Nenhum ADR decidiu isso. Exige decisão de produto explícita.

### ~~Taxonomia de grupo muscular~~ — FECHADO pelo D-164 (jul/2026)

- Era gap aberto: o D-089 citava "músculo" como conteúdo da biblioteca sem taxonomia
  decidida. **Decidido no D-164** — `MuscleGroup` como tabela-pai, com grupo primário
  (FK) + secundários (N:N) por `Exercise`. Mantido aqui como registro de que o gap
  existiu e de onde foi fechado.

### Catálogo de técnicas de série

- O `SetTechnique` nasce **mínimo de propósito** (só o que este ADR fundamenta:
  normal e drop-set). Ampliar o catálogo (rest-pause, pirâmide, isometria,
  negativa...) é decisão de produto + migração, não invenção do agente (D-087).

## Impacto de modelagem e inconsistências herdadas (D-063 fechado)

Com o D-063 fechado para treino, o `detail Json?` do esqueleto **deve ser
substituído por colunas tipadas** — não se constrói em cima do `Json`, que vira
dívida técnica rápido e é **incompatível com o merge por campo** exigido pelo
offline-first (D-099, ADR-0010). Inconsistências identificadas entre esta ADR e
o schema atual (PR #14), a resolver na fase de implementação:

1. **Hierarquia incompleta** — o esqueleto tem `Bond → Workout → WorkoutItem`;
   D-079 exige o nível **plano**. Introduzir `WorkoutPlan` (dono da validade,
   organização e agendamento — D-080/D-083/D-084) entre `Bond` e `Workout`.
   `Workout` permanece com o significado de **"treino do plano"** — sem renomear
   a tabela existente.
2. **Séries em `Json`** — `WorkoutItem.detail Json?` contradiz D-081 (série =
   linha própria). Substituir por entidade filha `WorkoutSet`, com carga em
   **colunas tipadas inteiras** (D-081) e conjugação por campos de agrupamento
   no `WorkoutItem` (D-082) — sem entidade de bloco, que não teria atributo
   próprio para hospedar.
3. **Sem estado de deleção lógica** — `Exercise`/`Food` não têm ciclo de vida;
   D-089 exige `ativo`/`descontinuado`. A regra geral de deleção lógica também
   revisita `onDelete` das relações (nunca apagar fisicamente o referenciado).
4. **Execução/avaliação/análise inexistentes** — D-086/D-087/D-088 exigem
   entidades novas (`WorkoutSession`, `SetLog`, `WorkoutRating`,
   `FormAnalysis`), ausentes no esqueleto.
5. **`detail Json?` genérico** nos demais itens de treino desaparece em favor de
   colunas tipadas.

O plano de modelagem detalhado (entidades, relações, índices) é apresentado ao
responsável **antes de qualquer código** — nenhuma migração é escrita sem
aprovação.

## Alternativas consideradas

- **Séries uniformes ("3×12 a 20kg"):** simplifica o schema, mas quebra o
  requisito real do mercado (séries variáveis, drop-set, falha). Rejeitado —
  série é linha própria (D-081).
- **Carga polimórfica (`valor` + `unidade`):** um par único cobriria peso,
  tempo e distância com menos colunas, mas deixa o estado inválido
  representável — uma agregação de "evolução de carga" (D-092) somaria gramas
  com segundos, e o bug seria **silencioso**. Rejeitado — colunas tipadas
  separadas (D-081).
- **Contador de rodadas (`roundCount`) no grupo de conjugados:** parece o modo
  óbvio de expressar "3 rodadas de A+B+C", mas ou força rodadas idênticas
  (violando D-081) ou duplica a contagem de séries e diverge dela. Rejeitado —
  rodada é a série de ordem N de cada item do grupo (D-082).
- **Entidade `WorkoutBlock` para conjugados:** normalizaria o grupo, mas o D-082
  define o comportamento ("em sequência, sem descanso") igual para
  bi-set/tri-set/circuito — o "tipo" é só a contagem de itens, e não sobra
  atributo de grupo para a entidade hospedar. Rejeitado como overengineering;
  cada tabela nova custa dobrado no offline (schema local + remoto + sync,
  D-099). Reavaliar se surgir atributo real de grupo.
- **Progressão prescrita/automática no plano:** parece sofisticado, mas engessa
  e não reflete a prática (o profissional ajusta reagindo ao dado). Rejeitado —
  progressão reativa (D-085). **Continua rejeitada** na revisão de jul/2026: o
  D-167 admite a **sugestão** pré-preenchida, nunca a prescrição autônoma.
- **Prescrição por alvos (séries-alvo/reps-alvo/carga-alvo no item):** proposta
  pelo ADR-0018 (superseded). Rejeitada — colapsa a série numa faixa uniforme e
  contradiz o D-081, que exige série como linha própria com valores distintos.
- **Execução append-only imutável:** proposta pelo ADR-0018 (superseded).
  Rejeitada — incompatível com o **merge por campo** que o offline-first exige
  (D-099, ADR-0010); a série é registrada sem sinal e reconciliada depois.
- **Grupo muscular como enum fixo:** menos tabela, mas obriga migração a cada
  ajuste de taxonomia e não hospeda atributo nem rótulo traduzível. Rejeitado —
  tabela-pai (D-164).
- **Manter `detail Json?` e detalhar em runtime:** adia trabalho, mas cria
  dívida imediata e inviabiliza o merge por campo do offline (D-099). Rejeitado
  — colunas tipadas agora.
- **Análise de forma ao vivo por câmera:** mais "mágico", mas a acurácia
  markerless não sustenta devolutiva clínica e transfere responsabilidade à IA.
  Rejeitado — assíncrona com validação humana (D-088).
- **Geração de vídeo de exercício por IA:** cara, lenta e inferior a filmar.
  Rejeitado (D-091).
- **Deleção física de itens de biblioteca:** quebra histórico de treinos em uso
  e a guarda legal. Rejeitado — deleção sempre lógica (D-089).

## Consequências

- Novas entidades a modelar: `WorkoutPlan`, `WorkoutSet`, `WorkoutSession`,
  `SetLog`, `WorkoutRating`, `FormAnalysis`, `MuscleGroup` (D-164, com a junção
  N:N dos secundários); e alteração de `Workout`, `WorkoutItem`, `Exercise`
  (deleção lógica + vídeo + FK do grupo primário).
- `WorkoutPlan` nasce com `status DRAFT/ISSUED/CANCELLED` (D-165) — o fluxo de
  validação do estagiário tem onde plugar quando virar slice.
- Todas as tabelas do domínio nascem com `tenantId` + índice (D-166); o slice
  roda depois do tenant isolation (ADR-0017) ou sob disciplina explícita até lá.
- A sugestão de progressão (D-167) é camada de aplicação sobre os dados de
  execução — não adiciona entidade nem coluna de estado que possa divergir.
- A migração é **destrutiva em forma** (troca `Json` por colunas, reestrutura a
  hierarquia), porém sobre **tabelas vazias** — o esqueleto (PR #14) é
  schema-only, sem slice de API que escreva. Não há dado em produção, mas a área
  é **dado clínico-adjacente**: pela Política de Merge (CLAUDE.md), a
  implementação exige **revisão humana obrigatória**, não auto-merge.
- O worker ganha duas réguas: vencimento de plano (D-083) e liberação agendada
  (D-084).
- Os indicadores (D-092) nascem calculáveis por índices de data, sem entidade
  de agregação — a tela é fase posterior.
- A análise de forma (D-088) e a avaliação (D-087) tornam o app **nativo**
  (câmera real, offline) um requisito, não um luxo — coerente com D-098
  (ADR-0010).
- **Biblioteca (D-168–D-171):** não adiciona entidade nem coluna nova — é regra
  de produto sobre o que já existe (`Exercise.status PLATFORM/PRIVATE`,
  `ownerProfessionalProfileId`). O requisito real fica para o slice futuro de
  biblioteca: a **anti-duplicação normalizada** (D-169) é trabalho de
  implementação de verdade (unaccent + lower + trim + colapso de espaço/hífen),
  não checagem de string igual.
- **Aderência (D-191/D-193):** o % do Bloco 3 da execução (#136) fica
  **destravado** — os numeradores já entregues passam a ter denominador (a
  disponibilidade da anamnese), e o percentual pode ser exibido tanto ao aluno
  quanto ao profissional. Não adiciona entidade nem coluna no domínio de treino:
  o denominador é lido da anamnese ativa do vínculo. A **dependência nova** é de
  leitura entre domínios — o cálculo de aderência precisa alcançar a anamnese
  (ADR-0011), o que antes não era necessário. A **janela de agregação** (semana
  corrente? últimas N semanas? período do plano?) **não está decidida** e é
  pendência de implementação registrada em `docs/pendencias-mesa.md`.
