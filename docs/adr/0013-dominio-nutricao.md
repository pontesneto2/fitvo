# ADR-0013 — Domínio de Nutrição

**Status:** Aceito
**Decisões cobertas:** D-112 a D-121
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
- **Tabelas nutricionais além da TACO:** o D-114 cita a TACO como referência de
  medidas e o D-117 menciona que o Dietbox usa **múltiplas tabelas**. Se a base
  precisa registrar **de qual tabela** vem cada alimento (TACO, IBGE, USDA), isso
  é atributo de `Food` — não decidido.
