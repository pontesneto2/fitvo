# ADR-0013 — Domínio de Nutrição

**Status:** Aceito
**Decisões cobertas:** D-112 a D-121, D-133, D-134
**Revisa:** D-104 (ADR-0011) — ver D-118

## Contexto

Fecha o **D-063 para nutrição**, como o ADR-0009 fechou para treino. A referência
de produto é o **Dietbox** (líder), com Nutrium e WebDiet como contraponto — o
mesmo papel que o MFit teve no treino.

O esqueleto (PR #14, ADR-0006) deixou `MealPlan → MealPlanItem` com `detail Json?`
e marcador `TODO(D-063)`. Além do detalhe fino, o esqueleto **pulou um degrau da
hierarquia**: não existe o nível **refeição** entre o plano e o alimento — a mesma
lacuna que o D-079 encontrou no treino (lá faltava o nível "plano"). É por isso
que o **D-104 nasceu bloqueado** (ADR-0011): não há a que atar o "marquei que
comi". **Este ADR cria esse nível e o destrava.**

Medicina (prontuário/prescrição) permanece deferida.

## Decisão

### D-112 — Hierarquia do domínio de nutrição

```
Vínculo (bond = paciente ↔ nutricionista/nutrólogo)
  └── Plano alimentar POR DIA DA SEMANA (até 7 ativos, ou o mesmo para todos)
       └── Refeição (momento do dia)
            └── Item (alimento OU porção de grupo alimentar)
```

- **Confirmado pela referência:** o Dietbox permite planos diferentes para dias
  específicos, com até 7 ativos, ou o mesmo plano para todos os dias — conforme a
  individualidade do paciente.
- **Difere do treino, e a diferença é estrutural:** **não** há múltiplos planos
  simultâneos competindo (D-079) nem plano fixo (D-105). Em nutrição o plano é
  **por dia**. O primeiro passo da montagem é determinar **em quais dias** o plano
  se aplica.
- Cria o nível **`Meal`** que falta hoje (`MealPlan → MealPlanItem` vai direto ao
  alimento) e **destrava o D-104**.

### D-113 — Momentos de refeição (perfil esportivo)

Catálogo fixo da plataforma:

`CAFE_DA_MANHA` · `LANCHE_DA_MANHA` · `ALMOCO` · `LANCHE_DA_TARDE` ·
`PRE_TREINO` · `POS_TREINO` · `JANTAR` · `CEIA`

**Justificativa:** o produto é **esportivo**. Pré-treino e pós-treino são
momentos de **primeira classe**, não observação. Uma taxonomia genérica
(café/almoço/lanche/jantar) seria inadequada ao público — e forçaria o
nutricionista a apelidar refeições para expressar o que o catálogo deveria dizer.

Como todo enum do projeto, guarda o **código**; o rótulo exibido vive no i18n
(D-066), na mesma disciplina do D-087.

### D-114 — Substituição por grupo alimentar com equivalência

**É o achado mais importante da pesquisa, e muda o schema.**

- A substituição **não é troca ad hoc item a item**. É baseada em **grupos
  alimentares com equivalência nutricional**: a lista separa os alimentos por
  grupo, e cada grupo tem uma média calórica (ou de determinado nutriente). A
  referência de medidas é a tabela **TACO**.
- **Consequência estrutural:** o item do plano pode ser **"1 porção do grupo
  proteína"**, não obrigatoriamente "150g de frango". O frango é **uma** das
  opções equivalentes.
- **Exige a entidade `FoodGroup` com equivalência** — `Food` sozinho não expressa
  isso.
- **Valor:** é o que dá **autonomia** ao paciente e evita a monotonia — a
  principal razão pela qual as pessoas evitam nutricionista é achar que vão comer
  sempre a mesma coisa.

**Emenda (adendo de concorrência) — normalização calórica automática.**
FORTALECE a decisão, não a substitui. O D-114 dizia "grupo com equivalência" mas
não fechava **como** a quantidade do substituto é calculada — trocar "150g de
arroz" por batata não é 1:1, e o paciente precisa saber **quantos gramas** de
batata equivalem para manter o alvo.

- Ao substituir um item, o sistema **recalcula a quantidade do substituto para
  preservar o alvo**: item original = X kcal → o sistema resolve `Yg de batata =
  X kcal` e o paciente vê a quantidade **já ajustada**, sem calcular nada.
- A **âncora** de normalização é campo, não hardcode — `NormalizationAnchor`
  (`CALORIES` por padrão · `PROTEIN` · `CARB` · `FAT`). Em nutrição esportiva o
  profissional às vezes ancora em **proteína**, não em kcal. A âncora vive no
  **plano** (default) com **override opcional na refeição** (`Meal`) — não desce
  ao item (seria overengineering; o alvo é do plano/refeição).
- **A normalização é derivação em tempo de substituição, não dado armazenado** —
  a menos que a substituição seja **congelada no `MealLog`** (D-118): quando o
  paciente registra que comeu o **substituto**, a quantidade normalizada e o
  valor nutricional **daquele momento** são congelados no log. Se a tabela de
  origem for corrigida depois, o que ele comeu naquele dia **não muda** — mesmo
  princípio do preço na compra.
- **Consequência estrutural:** o `FoodGroup` (D-114) e cada `Food` precisam
  carregar o **valor nutricional por medida de referência** — sem isso a
  normalização é impossível. Ver "Impacto de modelagem", item 7.

### D-115 — Plano calculado ou texto livre

- O nutricionista pode montar o plano em **alimentos calculados** ou em **texto
  livre**. Nem todo plano é calculado — às vezes é orientação ("almoço: proteína
  + salada à vontade").
- **O schema suporta os dois modos.** Forçar cálculo onde o profissional quer
  orientação empurraria o trabalho para fora do app — o mesmo erro que o D-109
  evita no retorno.

### D-116 — Parâmetros do plano

- **Meta calórica** (do gasto energético estimado ou ajustada ao objetivo).
- **Distribuição de macronutrientes**, por **percentual** ou em **gramas**.
- **Cálculo automático em tempo real** conforme os itens entram.

### D-117 — Base de alimentos e templates

- **Base compartilhada da plataforma + itens próprios do profissional** (reafirma
  D-064). O Dietbox tem ~15.000 alimentos, de múltiplas tabelas, e permite ao
  nutricionista adicionar alimento ou preparação que não encontre — é a **escala
  de referência**.
- **Templates:** modelos da plataforma + modelos próprios do profissional
  (refeições e planos salvos, reutilizáveis entre pacientes). Mesmo padrão da
  clonagem de treino (D-090) e mesmo alvo: a **dor #1**, tempo de montagem.
- **Deleção lógica** (D-089) vale para alimento **e grupo**.

**Emenda (adendo de concorrência) — código de barras e origem ampliada.**

- **Origem registrada é campo, não gap.** Cada `Food` carrega sua **fonte**
  (`FoodSource`: `TACO` · `TBCA` · `OPEN_FOOD_FACTS` · `PROFESSIONAL_CUSTOM`).
  Isto **fecha o gap "Tabelas nutricionais além da TACO"** que este ADR listava
  em aberto. A origem é o que **impede o cálculo de mentir** — não misturar
  fontes silenciosamente.
- **Código de barras:** o paciente **escaneia** o produto industrializado e ele
  entra no registro. Reduz o atrito do D-118 a quase zero — o diário alimentar
  abandona no atrito de digitação. `Food` ganha `barcode` (GTIN/EAN, opcional —
  a maioria da TACO não tem) e `externalRef` (id do produto na fonte externa).
- **Base ampliada = Open Food Facts** (aberta, gratuita, usada pelos
  concorrentes) como fonte **adicional** às tabelas oficiais. Um produto do OFF
  **materializa como `Food`** com `source=OPEN_FOOD_FACTS` no primeiro scan — um
  só modelo de alimento, e o `MealLog` consegue congelar o snapshot (D-114/D-118).
- **Escopo separado por superfície — trava explícita:** a busca de **montagem do
  plano** (profissional) **filtra o OFF fora** por `source` — o OFF é
  colaborativo e ruidoso, e misturá-lo poluiria a base curada. A busca de
  **registro** (paciente) **inclui** o OFF. O profissional monta com a base
  curada; o paciente registra com a base ampliada. Sem essa trava, a base do
  profissional degrada.
- **Qualidade de dado × normalização:** produtos do OFF têm macros
  incompletos/ausentes. Por isso o código de barras é do **registro** (D-118),
  onde lacuna parcial é tolerável — **não** da montagem, onde o cálculo (D-114)
  tem que fechar. Item OFF logado com nutrição incompleta: **congela o que
  existe, marca a lacuna, nunca inventa** — preferir a lacuna explícita ao dado
  falso.
- **Fallback:** alimento sem código / não encontrado → busca manual (o fluxo
  atual do D-118).

### D-118 — `MealLog`: registro de refeição (revisa o D-104)

O paciente registra a refeição. **Dinâmico e rápido — não pode irritar**: um
registro chato é um registro abandonado, e sem ele não há aderência.

- Opções: **comi tudo / parcial / não comi** — o D-104 previa só "consumiu", e
  esta decisão o **revisa**: "parcial" é a resposta honesta mais comum, e
  colapsá-la em sim/não destrói o indicador.
- **Comentário** opcional e **foto** opcional.
- O nutricionista vê em **tempo real**.
- **Conta como check-in**, igual ao treino (D-086).
- Alimenta o indicador de aderência ("cumpriu 80% do plano essa semana").
- **Entra no escopo de sync offline** (D-099), junto com as execuções.
- **Alertas nos horários das refeições** (push — D-097). O app do Dietbox faz
  isso, e é o que sustenta a aderência.

### D-119 — Entregáveis do paciente

- **Lista de compras**, gerada do plano — facilita a ida ao mercado.
- **Lista de substituições** (do D-114), entregue junto ao plano.
- **Receitas.**
- **Exportação/impressão** do plano — o paciente às vezes quer papel.

### D-120 — Indicadores de nutrição

- **Paciente:** aderência ao plano, evolução antropométrica (linha do tempo),
  streak, hidratação.
- **Nutricionista:** aderência dos pacientes, quem está sumindo, evolução
  agregada, pacientes com plano vencendo.

Espelha o D-092 (treino) — mesma mecânica, outro domínio. Os campos nascem
suportando o cálculo; a tela é fase posterior.

### D-121 — Convênio e faturamento TISS: fora do MVP

- O FITVO atende **somente particular** no MVP.
- **Contexto:** análise de mercado aponta que poucos softwares oferecem
  integração completa com agenda, teleconsulta e faturamento TISS — e vendem isso
  como diferencial. TISS é o padrão de faturamento de convênio médico no Brasil.
- **Motivo da exclusão:** TISS é um **projeto inteiro** (guia, autorização,
  glosa, prazo de pagamento da operadora) e só interessa a médico de convênio. O
  público inicial do FITVO é particular, e **nada do financeiro atual** (D-018,
  split, Asaas — ADR-0004) contempla convênio.
- **Decisão consciente, não esquecimento.** Reavaliar quando o nicho médico
  amadurecer; entrar exigirá ADR próprio, não extensão incremental.

### D-133 — Importação de plano por IA (assíncrona, com validação profissional)

O D-090 (clonagem) e o D-117 (templates) atacam a **dor #1** (tempo de montagem)
**reutilizando** o que já está na plataforma. Isto ataca de forma diferente:
**migra o trabalho que o profissional já fez FORA da plataforma** — e é o que
**tira o profissional do concorrente**. Quem tem 50 dietas no Excel não migra se
tiver que redigitar tudo.

- O profissional **importa** um plano existente (PDF, planilha, imagem) e a IA
  **converte** para o formato estruturado do FITVO (refeições, itens,
  quantidades — D-112/D-113), para ele **revisar e ajustar**.
- **Mesmo padrão do D-088** (análise de forma) — o humano fica no circuito
  (D-023/ADR-0005): a IA **converte**, o profissional **revisa e confirma** antes
  de qualquer uso. **Nada importado vai ao paciente sem validação humana.**
- **Assíncrona** (worker), como o D-088. Reusa `@fitvo/ai` (D-022) e
  `@fitvo/storage` (D-024) — o binário (PDF/planilha/imagem) vive no S3, nunca no
  banco.
- **Alimentos não reconhecidos** na conversão viram **item de texto livre**
  (D-115) ou pendência para o profissional resolver — **nunca "chuta" um alimento
  com valor nutricional inventado.** Preferir a lacuna explícita ao dado falso
  (mesmo princípio do D-117 emendado).
- **Proveniência registrada:** um plano importado é **marcado como tal**
  (auditoria) — o `MealPlan` resultante referencia o import de origem.
- **Escopo:** decisão de produto registrada agora; a implementação depende do
  provider de IA (já na stack, D-027) e é **fase posterior**. Entidade
  **aditiva** — não bloqueia o resto da nutrição.

### D-134 — Sugestões de alimento do paciente para o próximo plano

**Origem: ideia do responsável, refinada.** Hoje o paciente que quer pedir um
alimento ("queria mais frango", "não aguento mais batata doce") manda no
WhatsApp — e o nutricionista **esquece** quando vai montar o próximo plano. A
informação se perde no canal errado — exatamente a dor que o D-018 (tudo no app)
e o D-096 (Atendimento) atacam em outro contexto.

- O app do paciente tem um lugar **leve** para **sugerir alimentos/preferências
  para o próximo plano** — uma "quick message" de baixo atrito, **não** a abertura
  de um atendimento formal (D-096).
- A sugestão fica numa **fila de preferências daquele vínculo** (isolada por
  bond — D-004). O nutricionista a vê **no momento em que vai montar o próximo
  plano** para aquele paciente — no contexto certo, não como notificação avulsa
  que ele lê e esquece.
- **Categorização** (`SuggestionKind`: `INCLUDE` · `REMOVE` · `KEEP` ·
  `SUBSTITUTE`) além do texto livre — torna a fila acionável de relance e alimenta
  indicador ("pediu remover 3 alimentos que ainda estão no plano").
- **Ligação opcional ao item exato** (`MealPlanItem`) quando a sugestão é
  específica ("a batata doce do almoço"); genérica ("queria mais proteína") fica
  só texto. Não force o vínculo; permita os dois. A referência **sobrevive à
  troca de plano** (a sugestão é PARA o próximo plano, vive além do atual).
- **Estado com fechamento de loop** (`SuggestionStatus`: `PENDING` → `FULFILLED`
  / `NOT_FULFILLED` / `ARCHIVED`). O profissional marca ao montar; `NOT_FULFILLED`
  pode ter **nota curta** ("evitar ovo pelo colesterol atual"). Isso **fecha o
  loop** com o paciente em vez de ignorar em silêncio.
- **A sugestão NÃO é gate.** O profissional decide o que aceitar — é conduta
  clínica dele. O sistema **apresenta, não obriga** (coerente com D-096/IA).
- **Fechamento visível:** ao marcar `FULFILLED` e publicar o novo plano, o
  paciente pode receber uma **notificação leve** ("sua sugestão de incluir ovo foi
  atendida"). É **tipo de notificação** (D-097/D-028), não storage novo aqui — cria
  engajamento e retenção (o paciente se sente ouvido).
- **Por que é bom de produto:** transforma o paciente de consumidor passivo em
  **participante** — plano que ele ajudou a moldar, ele segue mais (aderência) e
  se sente ouvido (retenção). E tira mais uma conversa do WhatsApp para dentro do
  sistema (D-018).
- **Distinção inegociável do D-096 (Atendimento):** Atendimento é conversa/
  dúvida/problema, com **escalada e SLA**; sugestão é **preferência sem urgência**,
  coletada para o momento da montagem. São **entidades diferentes** — não colapsar
  uma na outra (ver "Impacto de modelagem", item 10).

## Impacto de modelagem e inconsistências herdadas

**Nada implementado por este ADR.** Inconsistências entre estas decisões e o
schema atual (main, pós-#26):

1. **Falta o nível `Meal`** — hoje `MealPlan → MealPlanItem` vai direto ao
   alimento. O D-112 exige `MealPlan → Meal → MealPlanItem`. É a **mesma lacuna**
   que o D-079 achou no treino; o esqueleto do ADR-0006 pulou um degrau nos dois
   domínios.
2. **`FoodGroup` não existe** — o D-114 exige grupo com equivalência
   nutricional, e o item do plano precisa poder referenciar **grupo** ou
   **alimento** (não os dois ao mesmo tempo). É a decisão de modelagem mais
   delicada deste ADR.
3. **`MealPlan.detail Json?` e `MealPlanItem.detail Json?` morrem** — a taxonomia
   existe agora. Vale aqui o mesmo motivo do treino: o **merge por campo** do
   offline-first (D-099) é impossível sobre `Json`, e o D-118 coloca o registro de
   refeição no escopo de sync.
4. **`MealPlan` precisa do dia da semana** (D-112) — o enum `Weekday` já existe
   (criado no #26 para o treino) e é reaproveitado.
5. **D-115 (calculado × texto livre)** força o item a ser opcional e a refeição a
   aceitar texto — sem que "sem itens" e "orientação livre" colapsem no mesmo
   estado.
6. **Deleção lógica** (D-089): `Food` já ganhou `status` no #26; `FoodGroup`
   nasce com ele.

**Adendos de concorrência (mesma migração-base — tabelas ainda vazias):**

7. **Nutrição estruturada + normalização** (D-114 emenda) — `Food` ganha
   **valor nutricional por medida** (kcal/macros), matando a parte nutricional do
   `detail Json?`; a associação `FoodGroup ↔ Food` **não é M:N nua** — cada membro
   carrega sua **porção de referência** (entidade de junção), sem a qual a
   equivalência não se calcula. `MealPlan` ganha `normalizationAnchor` (default
   `CALORIES`) com **override opcional em `Meal`**. A normalização é **derivação**,
   exceto o snapshot **congelado no `MealLog`**.
8. **Origem + código de barras** (D-117 emenda) — `Food` ganha `source`
   (`FoodSource`), `barcode` e `externalRef`. A busca de **montagem filtra
   `OPEN_FOOD_FACTS` fora**; a de **registro inclui**. Fecha o gap "Tabelas
   nutricionais além da TACO" (era gap conhecido; agora decidido).
9. **`MealPlanImport`** (D-133) — entidade **nova e aditiva**, espelha
   `FormAnalysis` (D-088): `aiStatus` + `reviewStatus`, `sourceStorageKey` (S3),
   `aiResult Json?` **legítimo** (payload bruto do provider, mesmo carve-out do
   `FormAnalysis.aiResult` — não é conteúdo de domínio). Sempre com `tenantId` +
   `ownerProfessionalProfileId`; `bondId` **opcional** (import avulso vira
   template). `MealPlan` ganha `importId?` (proveniência/auditoria).
10. **`MealSuggestion`** (D-134) — entidade **nova**, **não** reusa `Attendance`:
    sem escalada, SLA, thread ou `readAt`. Isolada por **bond** (D-004),
    `tenantId` denormalizado (D-002). `kind` (`SuggestionKind`), `status`
    (`SuggestionStatus`), `resolutionNote?`. `targetMealPlanItemId?` com
    **`onDelete: SetNull`** — a sugestão **sobrevive à troca do plano** (é para o
    **próximo**). Dado do vínculo → admin-puro nunca vê (D-015).

## Alternativas consideradas

- **Múltiplos planos simultâneos, como no treino (D-079):** simetria tentadora,
  mas errada — em nutrição o plano é **por dia**, não concorrente. Rejeitado
  (D-112).
- **Plano fixo em nutrição (D-105):** não faz sentido — não existe "dieta que
  roda por cima das outras". Rejeitado explicitamente (D-112).
- **Substituição item a item (sem grupo):** o modo ingênuo — "troque frango por
  tilápia". Rejeitado: não escala, não expressa equivalência nutricional e
  devolve ao paciente exatamente a monotonia que o D-114 combate.
- **Só plano calculado (sem texto livre):** simplificaria o schema, mas empurra o
  nutricionista que quer orientar para fora do app. Rejeitado (D-115).
- **Taxonomia genérica de refeições** (café/almoço/lanche/jantar): serviria a
  qualquer público, mas não ao **esportivo** — pré e pós-treino viram gambiarra de
  apelido. Rejeitado (D-113).
- **`MealLog` binário (comi / não comi), como o D-104 previa:** mais simples, mas
  "parcial" é a resposta honesta mais comum e o indicador de aderência ficaria
  falso. Rejeitado — três estados (D-118).
- **TISS no MVP:** venderia para médico de convênio, mas é um projeto inteiro e o
  financeiro atual não contempla convênio. Rejeitado (D-121).
- **Substituição 1:1 sem normalizar a quantidade:** "troque arroz por batata" sem
  dizer quantos gramas. Devolve ao paciente o cálculo — e o erro nutricional.
  Rejeitado — recálculo automático com âncora (D-114 emenda).
- **Misturar Open Food Facts na base de montagem:** simplificaria a busca, mas a
  base colaborativa é ruidosa e poluiria a base curada do profissional. Rejeitado
  — OFF só na busca de **registro**, filtrado por `source` na de montagem (D-117
  emenda).
- **IA importando plano direto para o paciente (sem revisão):** IA prescrevendo a
  leigo sem responsável técnico no meio. Rejeitado — converte, o profissional
  valida antes de qualquer uso (D-133, coerente com D-023/D-088).
- **IA "chutando" alimento não reconhecido na importação:** inventaria valor
  nutricional falso. Rejeitado — vira texto livre ou pendência; lacuna explícita
  antes de dado falso (D-133).
- **Sugestão do paciente como um `Attendance` (D-096):** reusaria a entidade, mas
  colar escalada, SLA e ticket numa preferência sem urgência **destrói as duas** —
  a fila fica pesada e a escalada perde sentido. Rejeitado — entidade própria,
  leve, sem colapsar no Atendimento (D-134).

## Consequências

- **O D-104 (ADR-0011) fica revisado** pelo D-118: o registro deixa de ser binário
  e ganha três estados + foto. O ADR-0011 recebe ponteiro para cá.
- **O D-063 fecha para nutrição.** Resta **medicina** (prontuário/prescrição), que
  segue deferida — e com ela o módulo de **nutrologia** da anamnese (D-103,
  ADR-0011), que depende de exames laboratoriais (D-076).
- A migração de nutrição é **destrutiva em forma** (troca `Json` por colunas,
  insere um nível na hierarquia) sobre **tabelas vazias** — mesmo caso do #26.
  Continua sendo **dado clínico** → revisão humana obrigatória.
- Os **entregáveis** (D-119: lista de compras, substituições, receitas,
  exportação) são derivados do plano — não entidades novas, exceto **receita**,
  que precisa de decisão própria se for conteúdo estruturado.
- **Hidratação** aparece no indicador do paciente (D-120) mas **não** tem lugar no
  plano modelado pelo D-112 — ver "Gaps conhecidos".

## Gaps conhecidos (decisão de produto pendente — não modelar sem ADR)

- **Hidratação:** o D-120 pede o indicador, mas nenhuma decisão diz **onde a meta
  de água é prescrita** nem **como o paciente registra** o consumo. Não é uma
  refeição; não cabe em `Meal` sem forçar. Precisa de decisão.
- **Receitas (D-119):** entregável citado, sem definição de estrutura — texto
  livre? ingredientes + modo de preparo? vira `Food` do tipo preparação (o
  Dietbox trata preparação como item da base)? Não modelar por conta própria.
- **Gasto energético estimado (D-116):** a meta calórica sai "do gasto energético
  estimado", mas **qual fórmula** (Harris-Benedict, Mifflin-St Jeor, FAO/OMS) e se
  o sistema calcula ou o profissional informa não foi decidido. É regra clínica —
  não inventar.
- **Tabelas nutricionais além da TACO:** ~~atributo de origem em `Food`, não
  decidido~~ — **RESOLVIDO pela emenda do D-117** (adendo de concorrência): `Food`
  ganha `source` (`TACO` · `TBCA` · `OPEN_FOOD_FACTS` · `PROFESSIONAL_CUSTOM`).
- **Medidas caseiras (gap NOVO, aberto pela emenda do D-114):** a TACO ancora em
  "medida caseira" (1 colher, 1 concha) com equivalente em gramas. Exibir a
  substituição normalizada como "2 batatas médias" em vez de "137g" exige modelar
  **medida → gramas** por alimento. A normalização calcula em gramas de qualquer
  forma; a **apresentação** em medida caseira é que depende deste modelo. Decisão
  de produto — **não modelar sem ADR** (mesma disciplina dos gaps acima).
