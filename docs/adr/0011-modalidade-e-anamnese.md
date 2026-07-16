# ADR-0011 — Modalidade de Atendimento e Anamnese

**Status:** Aceito
**Decisões cobertas:** D-101 a D-104
**Revisa:** D-094 (ADR-0010) — ver D-102

## Contexto

O ADR-0010 modelou o fluxo de entrada assumindo, implicitamente, um cenário de
**treino online**: o aluno recebe o convite, responde a anamnese sozinho no app,
e só então o profissional monta o plano. Essa premissa é **falsa para nutrição e
medicina**, onde a consulta **presencial** é a norma — o profissional preenche a
anamnese com o paciente na frente, aferindo o que exige presença física
(adipometria, bioimpedância, exame físico). Um produto multi-especialidade não
pode ter um fluxo de entrada que só serve a uma especialidade.

Ao mesmo tempo, o `TODO(D-094)` deixou a **taxonomia da anamnese** em aberto: o
D-094 decidiu o ciclo de vida (gate, uma por vínculo), não os campos. Sem eles, a
anamnese permanecia `detail Json?` — a mesma dívida que o ADR-0009 matou no
treino.

Este ADR fecha os dois pontos e adiciona o espelho nutricional da execução de
treino.

## Decisão

### D-101 — Modalidade de atendimento

- Todo **vínculo** tem uma modalidade declarada: **`ONLINE`**, **`PRESENCIAL`**
  ou **`HIBRIDO`**, escolhida no estabelecimento do vínculo.
- **Quem define: o profissional.** É ele quem sabe como atende. O aluno/paciente
  **não escolhe** a modalidade do serviço que está contratando.
- **Quando: no convite** (D-006/D-048). O vínculo já **nasce** com modalidade —
  não há vínculo sem ela.
- **Muda? Sim.** É atributo **mutável** do vínculo, não imutável. O caso é real:
  o paciente que fazia presencial se muda de cidade e passa a online; o aluno
  online resolve fazer presencial. Forçar um vínculo novo por isso quebraria o
  histórico (D-053) sem ganho nenhum.
- **Mudar a modalidade NÃO invalida a anamnese existente nem reabre o gate**
  (D-093). Só muda os fluxos **dali para frente**. A anamnese já respondida
  continua válida — quem a preencheu e quando está registrado (D-102), e isso não
  se altera retroativamente.
- A modalidade **define o fluxo** da anamnese:
  - **`ONLINE`** — o paciente/aluno preenche sozinho; é **pré-requisito** (gate
    D-093) antes de o profissional montar o plano.
  - **`PRESENCIAL`** — o profissional pode preencher a anamnese com o paciente
    na frente, durante a consulta.
  - **`HIBRIDO`** — ambos: o paciente preenche o que sabe, o profissional refina
    no presencial.
- Aplica-se a **treino, nutrição e medicina** — é estruturante, não um detalhe
  de nutrição.
- **Consequência de UX (não opcional):** o estado vazio do gate (D-093) passa a
  ser **consciente da modalidade**. Dizer "responda sua anamnese para receber seu
  treino" a um paciente `PRESENCIAL` está **errado** — ele não deve responder
  nada; o profissional preencherá na consulta. O D-093 exige "nunca tela morta",
  e a mensagem certa depende da modalidade.

### D-102 — Anamnese híbrida com autoria (revisa o D-094)

O D-094 assumia que **o paciente responde**. Isso está **incorreto** para
nutrição e medicina.

- A anamnese pode ser preenchida pelo **paciente**, pelo **profissional**, ou por
  **ambos** (híbrido).
- **Padrão de trabalho real:** o paciente responde o "grosseiro" (histórico,
  hábitos, recordatório de 24h); o profissional refina e adiciona o que exige
  presença física (adipometria, bioimpedância, exame físico).
- **A anamnese pode nascer do profissional:** na consulta presencial ele abre e
  preenche conversando, **sem o paciente ter tocado no app**. Não há pré-requisito
  de ação do paciente para o registro existir.
- **Rastreio de autoria é obrigatório:** registrar **quem preencheu cada parte**
  (paciente ou profissional) e **quando**. É documento de prontuário — *"o
  paciente declarou X"* tem peso jurídico **diferente** de *"o profissional
  aferiu Y"*. Sem autoria, o documento perde valor probatório e mistura
  declaração com aferição.
- **Granularidade: por SEÇÃO/bloco**, não por campo. O peso jurídico está no
  bloco — *"histórico: declarado pelo paciente"* × *"adipometria: aferida pelo
  profissional"*. Ninguém vai a juízo discutir quem preencheu o campo "dorme
  quantas horas". Autoria por campo dobraria o schema ou exigiria tabela de
  auditoria: **custo sem retorno** (ver "Alternativas consideradas").
- **O gate (D-093) é satisfeito independentemente de quem preencheu.** O gate
  exige que a anamnese esteja respondida, não que o paciente a tenha respondido.

**Permanece válido do D-094:** uma anamnese por vínculo; documento do prontuário,
nunca compartilhado automaticamente (D-016); autopreenchimento dos dados
evidentes com edição; e a exceção do e-mail (troca só por código verificado).

#### Por que a autoria é ARMAZENADA se é derivável — derivação congelada

A objeção é correta e precisa ser respondida no papel, porque a resposta óbvia
está errada:

`authoredBy` (o papel) **é derivável** de `authoredByAccountId` + o vínculo. Hoje
a derivação é uma igualdade simples e **estável** — o vínculo é
`paciente ↔ (profissional + especialidade)` com unique nessa tripla (ADR-0001),
tem **exatamente um** profissional, e trocá-lo não é mutação: é outro vínculo.
Nenhuma decisão vigente permite um segundo profissional escrever num vínculo
alheio — o ADR-0003 registra que **só o admin de clínica tem visão ampla**, e o
admin puro **não acessa dado clínico** (D-015).

**Portanto a justificativa NÃO é "o profissional do vínculo pode mudar".** Isso é
falso, e um campo defendido por um motivo falso cai na primeira revisão.

**A justificativa é que a autoria é uma DERIVAÇÃO CONGELADA.** O critério que
separa os dois casos:

> **Se a fonte mudar, este campo deve mudar junto?**
> **Sim → derive.** **Não → armazene.**

- **Sim** — `Bond.anamnesisCompletedAt` (rejeitado no D-093): duplicaria um fato
  **presente** cuja fonte da verdade é a linha de `Anamnesis`. Os dois descrevem
  *agora*; divergir significa que um está **velho** — é bug. Derive.
- **Não** — `authoredBy`: registra um fato **passado**. O vínculo descreve *agora*.
  Se um dia divergirem, o enum **não está velho: ele é história**, e quem mudou foi
  o vínculo. Não existe valor "correto" a recomputar.

É a mesma razão pela qual se guarda o **preço no momento da compra** em vez de
fazer join com o preço atual do produto. Ninguém chama isso de duplicação.

**O cenário concreto que fecha o argumento.** O ADR-0003 já decide que a **clínica
é um tenant multi-profissional** e "argumento comercial forte para clínicas
(operação centralizada)"; que **compartilhamento entre profissionais é sempre
autorizado pelo paciente, nunca automático** (D-016); e que existe um **motor de
compartilhamento** que detecta sobreposição de profissionais sobre o mesmo
paciente e sugere compartilhar (D-017). Ou seja: **múltiplos profissionais em
torno do mesmo paciente já é o caso central do produto** — hoje eles apenas
*leem* sob consentimento, não escrevem em vínculo alheio.

No dia em que qualquer decisão permitir um segundo ator **escrever** num vínculo
(cobertura de colega, supervisão, admin que também é profissional), a derivação
passa a devolver **"nenhum dos dois"** para linhas **já escritas**.

Isso não seria um bug novo: seria uma **mudança de schema reescrevendo
retroativamente o que um documento jurídico afirma**. É precisamente o que este
D-102 existe para impedir. Armazenar é o que torna o documento **imune a decisões
futuras** — que é o requisito de um prontuário.

> Nada aqui decide que o segundo profissional poderá escrever. Não está decidido,
> e este ADR não o decide. O ponto é que o custo de armazenar é uma coluna, e o
> custo de derivar só aparece **depois** que a decisão for tomada — sobre dado
> antigo, quando não há mais o que fazer.

#### Como a autoria é gravada: CONSTRUIR, não validar

Como o par (`authoredBy`, `authoredByAccountId`) é independente no schema, ele
**permite estado inválido**: `PATIENT` gravado com a conta do profissional, ou uma
conta **de outro tenant** — a FK só exige "alguma `Account`". O schema não tem como
impedir (exigiria atravessar `bond → profiles → accounts`; `CHECK` do Postgres não
aceita subquery). A regra vive na aplicação — e a forma importa:

- **`authoredByAccountId` vem da conta AUTENTICADA, nunca do corpo da requisição.**
- **`authoredBy` é derivado no WRITE**, uma vez, da relação do ator com o vínculo,
  e **congelado** ali.
- **Ator sem relação com o vínculo → 403 no guard de acesso**, antes de qualquer
  autoria existir.

Assim não há par errado **a formar**: o estado inválido deixa de ser rejeitado e
passa a ser **irrepresentável** — o mesmo argumento que colocou a autoria junto do
dado. As regras (`PATIENT` ⇒ conta do paciente daquele vínculo; `PROFESSIONAL` ⇒
conta de profissional com acesso àquele vínculo; nunca conta de outro tenant)
valem como **consequência da construção**, não como checagem que alguém pode
esquecer de chamar.

**Consequência inegociável: a validação é só no WRITE e NUNCA é refeita no READ.**
Revalidar a autoria na leitura reprovaria documento antigo **legítimo** assim que o
vínculo mudasse (profissional saiu da clínica, acesso revogado). O congelamento é o
produto — revalidar o descongela e devolve exatamente o problema que o campo
resolve.

**Guard no banco (trigger): rejeitado.** Não pelo custo, mas porque **o trigger vê
linhas, não sessões**: a pergunta real é *"quem estava autenticado?"*, e isso só
existe na aplicação. Ele protegeria contra um `INSERT` manual no psql, não contra o
erro que de fato vai acontecer — e duplicaria a regra de acesso numa segunda
linguagem, que diverge quando as regras de clínica chegarem (o defeito que estamos
prevenindo, agora em SQL) e é invisível para quem lê o `schema.prisma`. Defesa em
profundidade no banco já tem dono registrado: **RLS** (ADR-0001, baixa prioridade),
decisão futura do responsável — um trigger ad hoc a atropelaria com solução pior.

### D-103 — Taxonomia da anamnese (fecha o `TODO(D-094)`)

Estrutura em três camadas: **núcleo comum** + **módulo por especialidade** +
**perguntas condicionais**. Fecha o detalhamento e **elimina o `detail Json?`**
da anamnese.

**Núcleo** (todas as especialidades; autopreenchido da anamnese anterior quando
houver):

- Identificação (vem do cadastro)
- **PAR-Q** — Questionário de Prontidão para Atividade Física (7 perguntas
  sim/não). É o padrão internacional de triagem de risco, considerado obrigatório
  antes de qualquer programa de treinamento.
- Objetivo e expectativa
- Histórico clínico: doenças, cirurgias, medicamentos, alergias
- Antecedentes familiares
- Estilo de vida: sono, estresse, fumo, álcool
- Contato de emergência

**Módulo Treino** (+ núcleo):

- Experiência prévia com exercício
- Disponibilidade (dias/semana, horário)
- Dor/lesão musculoesquelética (detalhada)
- Uso de esteroides anabólicos
- Preferências e aversões

> **Fundamento jurídico:** o profissional de educação física responde por tudo
> que ocorrer em decorrência dos exercícios prescritos — a documentação é o
> respaldo dele. A anamnese de treino não é burocracia, é defesa.

**Módulo Nutrição** (+ núcleo) — segue os blocos canônicos:

- Queixa e expectativa
- Avaliação alimentar: **R24h** (recordatório de 24h) **ou** questionário de
  frequência alimentar
- Hidratação e hábito intestinal
- Histórico de dietas anteriores
- Alergias e intolerâncias alimentares
- Contexto socioeconômico-cultural (quem cozinha, orçamento, refeições fora)

> **Fundamento regulatório:** a Resolução CFN 600/2018 torna a anamnese
> obrigatória; a CFN 594/2017 exige registro em prontuário.

**Módulo Nutrologia** (+ núcleo + tudo de nutrição) — é **ato médico**:

- Exame físico
- Exames laboratoriais (solicitação + resultado) — D-076, ADR-0007
- Hipótese diagnóstica (CID)
- Medicamentos com posologia

Fluxo médico: anamnese → exame físico → exames laboratoriais → diagnóstico →
conduta.

**Perguntas condicionais** (requisito, não enfeite):

- Ninguém responde tudo. "Não tomo medicamento" **não** abre campo de qual/dose;
  "sem lesão" **pula** o bloco musculoesquelético.
- **Alvo:** paciente saudável responde ~15 perguntas em ~3 min; paciente complexo
  responde 40 — **porque precisa**.
- Apresentação em **steps**, com toques rápidos (chips, sim/não, escala visual).
  O processo é chato por natureza; a UX é o que o torna suportável. Uma anamnese
  que o paciente abandona no meio não tem valor clínico nem jurídico.

### D-104 — `MealLog`: check de refeição

> ⚠️ **REVISADO pelo D-118 (ADR-0013).** O registro deixa de ser **binário**
> ("consumiu") e passa a ter **três estados** — comi tudo / **parcial** / não comi
> — mais **foto** opcional. Motivo: "parcial" é a resposta honesta mais comum, e
> colapsá-la em sim/não falsifica o indicador de aderência. O resto desta decisão
> (check-in, tempo real, escopo de sync) **permanece**. O bloqueio registrado
> abaixo também **caiu**: o ADR-0013 (D-112) cria o nível `Meal`.

- O paciente **marca que consumiu a refeição**, com comentário opcional. O
  nutricionista vê em **tempo real**.
- É o **irmão exato** da execução de treino (D-086): prescrição → execução →
  aderência → indicador. A simetria é deliberada — mesma mecânica, outro domínio.
- **Conta como check-in**, igual à conclusão de treino (D-086).
- Alimenta o **indicador de aderência ao plano alimentar** ("cumpriu 80% essa
  semana"), espelhando os indicadores de treino (D-092).
- **Entra no escopo de sync offline** (D-099), junto com as execuções.

**O D-104 nasce BLOQUEADO — e não por si mesmo.**

- "Marcar que consumiu a **refeição**" **não tem a que se referir**: o schema vai
  de `MealPlan` **direto ao alimento** (`MealPlanItem`), sem a refeição no meio.
  Falta o nível **`Meal`** (café da manhã, almoço, jantar):
  `MealPlan → Meal → MealPlanItem`.
- É **o mesmo padrão** encontrado no treino: lá faltava o nível **"plano"**
  (D-079, ADR-0009); aqui falta o nível **"refeição"**. Em ambos os casos, o
  esqueleto do ADR-0006 pulou um degrau da hierarquia real do domínio.
- Essa hierarquia é o **D-063 para nutrição**, que **ainda não foi fechado com o
  responsável** — depende das referências de produto (Dietbox), como o treino
  dependeu do MFit.
- **Consequência:** o `MealLog` só é implementável **depois** de a estrutura de
  nutrição existir. Não tentar destravar por fora (ex.: log por item de alimento)
  — ver "Alternativas consideradas".

### Antropometria: bloco no fluxo, dado no `Assessment`

O D-102 cita adipometria e bioimpedância como o que o profissional afere no
presencial, mas a taxonomia acima **não tem bloco de antropometria** — e não é
esquecimento:

A distinção correta é **declarado × aferido**:

- **Anamnese** = história, entrevista — o que é **DECLARADO** (pelo paciente, ou
  colhido pelo profissional conversando).
- **`Assessment`** = o que é **AFERIDO/MEDIDO** (adipometria, bioimpedância, peso,
  circunferências).

O D-102 citou adipometria como ilustração de **autoria** (o que o profissional faz
presencialmente), **não** de onde o dado mora.

- **O bloco é visível no fluxo** da anamnese: no presencial, o profissional afere
  e registra ali, sem sair do processo.
- **Toda medida é `Assessment`, desde a primeira.** Medida é **recorrente** por
  natureza (reavaliação típica a cada 3 meses) e o D-094 (ADR-0010) já reservou o
  `Assessment` para avaliação/medidas — que também aceita autoria do profissional.
  A "primeira medida" não é um tipo especial de dado: é simplesmente o primeiro
  `Assessment`, criado de dentro do fluxo da anamnese. **Nada duplica**, e a linha
  do tempo de evolução (D-085) fica **contínua desde o dia 1**.
- **Requisito de UX — o bloco aparece com os campos BLOQUEADOS para o paciente**,
  com a mensagem *"seu profissional preencherá na consulta"*. Isso é
  **transparência**: o paciente entende que a medida existe e o que esperar, em
  vez de descobrir um vazio inexplicado. Visualmente é um bloco da anamnese;
  estruturalmente é a primeira medida da série.
- **Autoria: somente o PROFISSIONAL preenche antropometria.** O paciente tem
  acesso de **leitura**. É a única parte do fluxo com autoria restrita — coerente
  com D-102 ("o profissional aferiu Y" ≠ "o paciente declarou X").
- **O bloco é invisível na modalidade `ONLINE`** (D-101): não há consulta
  presencial, não há aferição. A modalidade decide o fluxo.

**A consequência é a regra:** o **fluxo** da anamnese **não é 1:1 com a entidade**
`Anamnesis`. Um passo do fluxo escreve em outra entidade. Uma implementação
ingênua colocaria campos de antropometria em `Anamnesis` — e criaria a duplicação
que esta decisão evita: a mesma medida em dois lugares, divergindo na segunda
consulta.

**Decorre disso:** como o dado vive numa entidade própria e recorrente, a ausência
de medida **não trava o gate** — o gate é da anamnese (D-093). E a **taxonomia dos
campos de medida continua sendo o `Assessment`** (D-063, ainda aberto): o bloco de
antropometria só é construível quando o `Assessment` for tipado, mas isso **não
bloqueia a tipagem da anamnese** (D-103), que está completa sem ele — justamente
porque a medida não vive lá.

## Impacto de modelagem

Sinalizado para decisão de sequenciamento — **nada implementado por este ADR**.

1. **`Bond` ganha modalidade** (D-101): enum `ONLINE`/`PRESENCIAL`/`HIBRIDO`,
   **mutável**. Como o profissional a define **no convite** e o vínculo nasce do
   aceite (D-006/D-055), o **`PatientInvite` também carrega a modalidade** e a
   propaga na criação do vínculo — senão não há como o vínculo nascer com ela.
   Mudança posterior é edição do vínculo; não invalida a anamnese nem reabre o
   gate.
2. **`Anamnesis.detail Json?` morre** (D-103): a taxonomia existe, então a
   anamnese vira **colunas tipadas**, como o treino (ADR-0009). A estrutura
   núcleo + módulo mapeia naturalmente para um registro de núcleo + registros de
   módulo por especialidade; listas (medicamentos com posologia, alergias,
   cirurgias, lesões, R24h) pedem **entidades filhas**, não arrays de texto.
3. **Autoria por seção (D-102)** implica que a **seção é uma entidade**, não um
   agrupamento visual: cada bloco preenchido carrega autor (paciente ou
   profissional) e timestamp. Isso empurra a modelagem para **registros de seção**
   (núcleo e módulos como blocos com autoria própria) em vez de uma tabela larga
   única — a autoria é o que decide a forma, mais do que a taxonomia.
4. **`MealLog` (D-104) esbarra num nível que não existe.** O schema atual é
   `MealPlan → MealPlanItem` (alimento + ordem) — **não há entidade de
   refeição**. "Marcar que consumiu a **refeição**" (café da manhã, almoço) não
   tem a que se referir: ou o log seria por *item de alimento* (contradizendo o
   D-104), ou é preciso o nível **`Meal`** entre plano e item. É **exatamente a
   mesma lacuna** que o D-079 achou no treino (faltava o nível "plano"). Criar
   esse nível é estrutura de nutrição — **D-063, ainda aberto** (depende do
   Dietbox). Consequência: **o D-104 está bloqueado pela estrutura de nutrição**,
   não por si mesmo.
5. **Pressão do offline sobre o `detail Json?` de nutrição:** o D-104 coloca o
   check de refeição no escopo de sync (D-099), e não se marca uma refeição que
   não se consegue ver — logo o **plano alimentar ativo** passa a precisar
   sincronizar. O plano só é editado pelo profissional (o paciente não o altera),
   então não há merge por campo e o `Json` não quebra o sync como quebraria no
   treino; mas o conteúdo da refeição fica **opaco no device** (sem consulta
   local, sem filtro). Mais um motivo para fechar o D-063 de nutrição.

## Alternativas consideradas

- **Manter a anamnese só do paciente (D-094 original):** simples, mas ignora que
  consulta presencial é a norma em nutrição e medicina — o profissional teria de
  pedir ao paciente que preenchesse algo que ele vai aferir na consulta.
  Rejeitado — anamnese híbrida (D-102).
- **Anamnese sem rastreio de autoria:** economizaria a parte mais cara da
  modelagem, mas mistura *declaração do paciente* com *aferição do profissional*
  num documento de prontuário — que têm pesos jurídicos diferentes. Rejeitado —
  autoria obrigatória (D-102).
- **Derivar `authoredBy` em vez de armazená-lo:** ele *é* derivável de
  `authoredByAccountId` + o vínculo, e hoje a derivação é estável — o vínculo tem
  exatamente um profissional (ADR-0001). Rejeitado: a autoria é uma **derivação
  congelada**, não um cache de estado presente. Derivar acopla o significado de um
  documento jurídico ao estado *atual* do vínculo — e quando a clínica
  multiprofissional chegar (ADR-0003), a derivação devolveria "nenhum dos dois"
  para linhas já escritas, **reescrevendo retroativamente** o que o prontuário
  afirma. Critério geral: *se a fonte mudar, este campo deve mudar junto?* Sim →
  derive; não → armazene. Mesma razão do preço registrado na compra. Distinto do
  `Bond.anamnesisCompletedAt` (D-093), que duplicava fato **presente** e por isso
  foi rejeitado — a assimetria é intencional, não incoerência.
- **Validar o par de autoria no application service (em vez de construí-lo):**
  seria o caminho óbvio para o requisito, mas validação é chamada — e pode ser
  esquecida, contornada por outro caminho de escrita, ou aceitar autoria vinda do
  corpo da requisição. Rejeitado — a autoria é **construída** do ator autenticado +
  guard de acesso ao vínculo (D-102), o que torna o par errado irrepresentável em
  vez de rejeitável.
- **Trigger no banco para garantir a autoria (defesa em profundidade):** tentador
  por ser dado clínico. Rejeitado — o trigger **vê linhas, não sessões**, e a
  pergunta real é *"quem estava autenticado?"*; ele barraria `INSERT` manual no
  psql, não o erro real. Além disso duplica a regra de acesso em SQL (diverge
  quando as regras de clínica chegarem) e fica invisível no `schema.prisma`. A
  defesa em profundidade registrada é **RLS** (ADR-0001).
- **Autoria por CAMPO (em vez de por seção):** seria a granularidade máxima, mas
  dobraria o schema (uma coluna de autoria por campo) ou exigiria uma tabela de
  auditoria genérica — e o retorno é nulo: o peso jurídico vive no **bloco**
  ("histórico: declarado pelo paciente" × "adipometria: aferida pelo
  profissional"), não no campo "dorme quantas horas". **Custo sem retorno.**
  Rejeitado — autoria por seção (D-102). Mesma disciplina do D-093: não pagar
  complexidade que nenhuma decisão de negócio consome.
- **Modalidade imutável (mudar exige vínculo novo):** simplificaria o modelo,
  mas o caso de mudança é real e banal (paciente muda de cidade e migra para
  online) — forçar vínculo novo quebraria o histórico preservado (D-053) sem
  ganho. Rejeitado — modalidade é atributo mutável do vínculo (D-101).
- **Modalidade escolhida pelo paciente:** ele não escolhe a modalidade do serviço
  que está contratando — quem sabe como atende é o profissional. Rejeitado —
  definida pelo profissional, no convite (D-101).
- **Modalidade como atributo do profissional (atende online × presencial):**
  parece natural, mas a modalidade é da **relação**, não da pessoa — o mesmo
  profissional atende um aluno online e outro presencialmente. Rejeitado — vive
  no vínculo (D-101).
- **Formulário único de anamnese para todas as especialidades:** já rejeitado no
  ADR-0006 ("sem formulário genérico único") e reconfirmado aqui — nutrologia
  exige exame físico e CID; treino exige PAR-Q e lesão. Rejeitado — núcleo +
  módulos (D-103).
- **Anamnese como catálogo dinâmico de perguntas (EAV / questionário
  configurável):** daria flexibilidade sem migração, mas devolve a anamnese ao
  território não-tipado que o ADR-0009 acabou de abandonar — perde tipo,
  agregação segura e validação. Rejeitado — colunas tipadas (D-103).
- **Antropometria como seção de campos da própria anamnese:** seria o caminho
  óbvio (o profissional afere durante a anamnese, logo os campos ficam ali), mas
  medida é recorrente — a segunda aferição não teria onde morar senão no
  `Assessment`, e a mesma medida existiria em dois lugares, divergindo. Rejeitado
  — bloco no fluxo, dado no `Assessment` (D-103).
- **`MealLog` por item de alimento (contornando a falta do nível `Meal`):**
  destravaria o D-104 sem tocar a estrutura de nutrição, mas contradiz a decisão
  ("marca que consumiu a **refeição**") e produziria aderência sem sentido
  clínico. Rejeitado — o D-104 espera a estrutura de nutrição (D-063).

## Consequências

- **O D-094 (ADR-0010) fica parcialmente revisado** pelo D-102: o que muda é
  *quem preenche*; o resto (uma por vínculo, não compartilhada, autopreenchida)
  permanece. O ADR-0010 recebe um ponteiro para cá.
- **O `TODO(D-094)` do schema deixa de ser válido:** a decisão existe. Enquanto a
  tipagem não chega, o comentário no schema deve apontar para este ADR, não
  afirmar que a decisão está pendente.
- **A modalidade (D-101) é estruturante:** vaza para a UX do gate, para o fluxo
  de anamnese e para o convite. Não é um campo cosmético.
- **O D-104 nasce bloqueado** pela ausência do nível `Meal` — que é estrutura de
  nutrição (D-063, dependente do Dietbox). Registrar agora evita que a
  dependência seja descoberta na implementação.
- **A anamnese tipada + autoria é dado clínico:** implementá-la exige revisão
  humana obrigatória (Política de Merge), como o resto do domínio clínico.
- **Perguntas condicionais** são requisito de produto com efeito de modelagem: os
  campos precisam ser opcionais no banco (a maioria não se aplica à maioria) sem
  que "não respondido" e "respondido como não" colapsem no mesmo `null`.
