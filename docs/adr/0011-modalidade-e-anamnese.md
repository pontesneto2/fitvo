# ADR-0011 — Modalidade de Atendimento e Anamnese

**Status:** Aceito (adendo jul/2026 — regras e fluxos transversais, D-172 a
D-178; adendo jul/2026 — campos do módulo treino, D-187 a D-190; adendo jul/2026
— aderência ancorada na disponibilidade, D-192, que eleva o D-188)
**Decisões cobertas:** D-101 a D-104, D-172 a D-178, D-187 a D-190, D-192
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

---

> As sete decisões a seguir entraram como **adendo de regras e fluxos da
> anamnese multi-área** (jul/2026, decisão de mesa). Não criam ADR novo — a
> anamnese já tem casa aqui. Mobiliam o que faltava: obrigatoriedade,
> reaproveitamento entre vínculos do mesmo aluno, versionamento, integração com
> a linha do tempo, e o tratamento de sinal de risco (PAR-Q) com proteção
> jurídica. **Não decidem campos** — os campos por módulo (treino/nutrição/
> nutrologia) seguem em mesa própria, sobre estas regras.

### D-172 — Trava de entrada condicionada à modalidade (reusa `AnamnesisStatus`)

- **`ONLINE`:** o aluno/paciente **não acessa** o treino/plano até a anamnese
  estar **completa** — o profissional precisa dela para prescrever (limitações,
  doenças, nível, tempo/dia, local de treino). A trava bloqueia **ambos os
  lados**: o aluno não vê treino, o profissional não prescreve sem anamnese.
- **`PRESENCIAL`/`HÍBRIDO`:** comportamento **já decidido** pelo D-101/D-102 —
  o profissional preenche na consulta e destrava; o aluno pode não ter tocado no
  app. Este D **não redecide** esse caso, só explicita que a trava "aluno
  preenche primeiro" é exclusiva do fluxo `ONLINE`.
- **Reusa o `AnamnesisStatus`** (`PENDING`/`ANSWERED`) já existente no schema —
  não cria gate novo nem enum novo. Consistente com o D-093 (ADR-0010): fonte
  única de verdade é o próprio registro de anamnese.

### D-173 — Obrigatoriedade por área + "NÃO SE APLICA" como resposta válida

- Campos obrigatórios são definidos **por área/módulo** (núcleo vale para todas
  as áreas; treino, nutrição e nutrologia têm os seus — taxonomia do D-103).
- **Três estados de resposta, não dois:** respondido / em branco / **não se
  aplica**. "Não se aplica" é resposta **válida e explícita**, distinta de "em
  branco" (não respondido).
- **Regra anti-mascaramento:** um campo que pode não se aplicar ao perfil do
  aluno **não pode ser obrigatório-forçado** — forçar resposta onde não se
  aplica faz o aluno responder qualquer coisa só para passar, poluindo o dado
  clínico. "Não se aplica" satisfaz a obrigatoriedade sem mascarar. Clinicamente,
  "não tenho" (não se aplica) ≠ "não sei/não respondi" (em branco) — a
  distinção é a mesma que as **perguntas condicionais** do D-103 já pressupõem
  (pular bloco ≠ não ter respondido o bloco).

### D-174 — Reaproveitamento de campos entre vínculos do mesmo aluno (auto-preenchido com confirmação)

- O aluno pode ter vínculos em áreas diferentes (personal + nutricionista = dois
  vínculos, duas anamneses — mantém o `@unique bondId` do D-094/ADR-0010).
  Campos **comuns** (alergia, medicação, condições, objetivo geral, contato de
  emergência) **não são redigitados**: vêm **auto-preenchidos** da resposta
  anterior do próprio aluno.
- **Não é compartilhamento entre profissionais** — o D-102/D-016 (ADR-0003)
  **rejeitou** isso, por privacidade. É o **aluno** reaproveitando o **próprio**
  dado entre as anamneses dele; o profissional continua vendo só a anamnese do
  seu vínculo. A dimensão do reuso é o **titular** (o aluno), não o vínculo.
- **Auto-preenchido exige confirmação, nunca é assumido:** o aluno vê "você
  informou alergia a dipirona (respondido em jan/2026) — ainda é verdade?" e
  confirma ou edita. Dado clínico auto-preenchido e não confirmado é perigoso —
  a condição pode ter mudado. Auto-preenche para não redigitar; exige
  confirmação para não propagar dado velho.
- É um **auxílio** (traz auto-preenchido), não uma fusão — o aluno pode
  responder anamneses diferentes por área normalmente.
- **Requisito de implementação:** o reaproveitamento precisa ser bem
  implementado para não gerar sensação de repetição — o aluno nunca deve sentir
  que respondeu a mesma coisa duas vezes. Fica registrado como requisito de UX
  forte para o slice, não resolvido por este D.

### D-175 — Anamnese versionada (uma ativa por vínculo + histórico append-only)

- "A anamnese é uma" (por vínculo, D-094) e "grava versão nova por cima" se
  reconciliam por **versionamento**: há **uma anamnese ATIVA por vínculo** (o
  `@unique bondId` do D-094 vale para a ativa), e cada mudança gera uma **nova
  versão**, com a anterior preservada como histórico — **append-only**, mesma
  disciplina de dado clínico que não se apaga (D-089/ADR-0009) e da derivação
  congelada do D-102.
- Toda versão carrega **log/auditoria**: o que mudou, por quem (autoria por
  seção — D-102), quando.

### D-176 — Dois gatilhos de nova versão (revisão por evento, não por tempo)

- **Automático:** a cada troca de plano/protocolo, o sistema apresenta a
  anamnese **completa** ao aluno e pergunta "algo mudou?".
  - **Mudou** → o aluno edita → grava nova versão (`vN+1`, com log) →
    profissional é informado.
  - **Não mudou** → o aluno salva → registra-se "revisada, sem mudança"
    (também logado — prova de que foi revisada naquele ciclo).
- **Manual:** o aluno pode abrir "informar mudança na saúde" (ex.: nova lesão)
  **a qualquer momento**, fora do ciclo de troca de plano → gera nova versão →
  profissional informado.
- Resolve a validade da anamnese **sem validade dura por tempo**: revisão por
  **evento** (novo ciclo de plano), não expiração por calendário. Complementa a
  atualização cadastral periódica do D-095 (ADR-0010), que é sobre dado
  cadastral, não clínico.

### D-177 — A anamnese alimenta a linha do tempo/feed de evolução do aluno

- Cada versão da anamnese, cada "revisada sem mudança" e cada mudança informada
  (nova lesão, nova condição) é um **evento** na linha do tempo/feed de
  acompanhamento do aluno/paciente (roadmap de produto).
- O profissional acompanha a evolução clínica pela linha do tempo, com a
  anamnese como uma das fontes de evento — junto de execuções de treino
  (D-086/ADR-0009), avaliações e demais marcos.

### D-178 — Sinais de risco (PAR-Q): alerta forte ao profissional + ciência do aluno (reusa D-025) + texto jurídico RASCUNHO

- Um sinal de risco na anamnese (ex.: PAR-Q positivo para condição cardíaca, ou
  condição grave declarada) **alerta fortemente o profissional** — registrado,
  de modo que ele não possa alegar desconhecimento. **Não bloqueia** o treino
  automaticamente (o profissional é o responsável técnico e decide a conduta),
  mas o alerta e a ciência ficam gravados.
- **Dupla ciência, ambas gravadas — reusa o mecanismo de consentimento (D-025,
  ADR-0002), não cria caminho novo:**
  - **Ao profissional:** alerta forte, registrado (ele viu o sinal de risco).
  - **Ao aluno:** a plataforma avisa de forma clara em sinais sensíveis (ex.:
    "você indicou uma condição cardíaca — recomendamos avaliação/liberação
    médica antes de iniciar atividade física") e registra a **ciência** do
    aluno (foi avisado, reconheceu o risco, optou por prosseguir por conta
    própria) — com timestamp, versão do texto e hash do teor, **mesmo padrão
    probatório do D-025**.
- **Amarração jurídica — RASCUNHO, pendente de validação por advogado, NÃO é
  texto final.** O objetivo é que o aluno esteja ciente dos próprios riscos, que
  a plataforma comprove que avisou, e que a responsabilidade técnica pela
  conduta permaneça com o profissional habilitado — protegendo o FITVO
  (ferramenta, não presta serviço de saúde) e dando ao profissional o registro
  de que informou.

  > ⚠️ **Rascunho de produto, não aconselhamento jurídico.** Um advogado
  > especializado em responsabilidade civil em saúde e LGPD **deve** revisar e
  > ajustar antes de qualquer uso em produção. Produto de saúde com triagem de
  > risco cardiovascular (PAR-Q) tem exposição legal real; a redação com peso
  > legal é do advogado.
  >
  > **Aviso de risco ao aluno (rascunho, exibido quando há sinal de risco na
  > anamnese, com aceite registrado):**
  >
  > "As informações que você forneceu indicam um possível fator de risco para a
  > prática de atividade física (por exemplo, condição cardíaca, pressão alta,
  > dor no peito ou outra situação de saúde). Antes de iniciar ou continuar
  > qualquer programa de exercícios, recomendamos fortemente que você procure um
  > médico e obtenha liberação para atividade física.
  >
  > O FITVO é uma plataforma de tecnologia que conecta você a profissionais
  > habilitados e organiza as informações do seu acompanhamento. O FITVO não
  > presta serviços médicos, não substitui avaliação médica e não é responsável
  > pela prescrição ou pela sua decisão de praticar atividade física.
  >
  > A responsabilidade técnica pela orientação de treino é do profissional
  > habilitado que o acompanha. A decisão de iniciar ou continuar atividade
  > física, ciente dos riscos que você informou, é sua.
  >
  > Ao prosseguir, você declara que: (i) leu e compreendeu este aviso; (ii) está
  > ciente dos riscos relacionados às informações de saúde que forneceu; (iii)
  > foi orientado a buscar liberação médica; e (iv) assume, por sua livre
  > decisão, a responsabilidade por prosseguir sem essa liberação, caso opte por
  > não obtê-la."
  >
  > [ ] Li, compreendi e estou ciente. Desejo prosseguir.
  >
  > **Registro probatório do aceite** (reusa D-025): versão exata do texto,
  > timestamp, hash do teor, identificação do aluno, e o sinal de risco
  > específico que disparou o aviso.
  >
  > **Alerta ao profissional (registrado):** o profissional recebe e vê o sinal
  > de risco de forma destacada ao acessar a anamnese; o registro guarda que o
  > alerta foi exibido e quando o profissional o visualizou. A conduta
  > (prescrever, pedir liberação médica, recusar) é decisão registrada do
  > profissional.

---

> As quatro decisões a seguir entraram como **adendo de campos do módulo
> treino da anamnese** (jul/2026, decisão de mesa). Estendem o D-103 (módulo
> treino) — não o reescrevem. Fecham os itens que o roadmap listava como
> abertos no módulo treino: local de treino, tempo por sessão, histórico
> esportivo e suplementos (esteroides incluído, como sinal clínico via
> D-178). Princípio de decisão: cada campo só existe se a
> prescrição/periodização usa o dado — campo que o profissional não usa para
> decidir nada é fricção sem retorno.

### D-187 — Contextos de treino (local + equipamentos), lista múltipla e extensível

O aluno não treina "num lugar" — pode treinar em vários, e cada sessão do
plano pode ser em um contexto diferente (ex.: 3x academia + 2x casa). A
anamnese captura o **inventário de contextos disponíveis**; o domínio de
treino (ADR-0009) depois aloca cada sessão a um contexto.

- A anamnese guarda uma **lista de contextos** (0, 1 ou N — o aluno adiciona
  quantos tiver). Cada contexto tem:
  - **Tipo de local** (enum extensível): academia (comercial), academia de
    condomínio/prédio, casa, ar livre (parque/praça/rua), studio/box
    (crossfit/funcional/pilates), academia de hotel, local de trabalho,
    quadra/campo, piscina, outro (livre).
  - **Equipamentos disponíveis** naquele contexto (checklist, catálogo fixo +
    "outro" livre): peso livre (halteres fixos, halteres ajustáveis,
    barras+anilhas, kettlebell, anilhas avulsas, barra olímpica/W); máquinas
    (máquinas guiadas, cabos/polia, leg press/máquinas de perna, smith);
    cardio (esteira, bike/spinning, elíptico, remo ergômetro, escada);
    funcional/peso corporal (barra fixa, paralelas, elásticos/faixas,
    TRX/suspensão, bola suíça, corda naval, caixa de salto, colchonete,
    nenhum); outro (campo livre).
  - **Disponibilidade** (opcional): quantos dias/semana o aluno acessa aquele
    contexto — alimenta a distribuição do plano.
- **Presets rápidos** para reduzir fricção: "Academia completa" (marca tudo),
  "Casa básica" (halteres + elásticos + colchonete), "Só peso corporal"
  (nada) — o aluno parte do preset e ajusta.
- **Catálogo fixo + "outro" livre:** o catálogo permite ao sistema (e à
  futura sugestão de exercícios) saber o que é prescritível; o "outro" cobre
  o caso raro sem travar.
- **Conexão com o treino (ADR-0009):** o contexto é inventário na anamnese;
  na prescrição, cada `Workout` é alocado a um contexto, e só usa exercícios
  possíveis naquele local/equipamento.

### D-188 — Orçamento de treino: frequência semanal + tempo por sessão

> **Elevado pelo D-192 (adendo jul/2026).** O texto original abaixo permanece
> como registrado — nada aqui é reescrito. O que mudou é o **grau**: a
> frequência semanal deixou de ser apenas **capturada** e passou a ser
> **obrigatória**, sem a opção "não se aplica" (ver [D-192](#d-192--disponibilidade-de-treino-é-campo-obrigatório-sem-não-se-aplica-exceção-consciente-ao-d-173)).
> Motivo: ela virou também o **denominador da aderência**
> ([ADR-0009](0009-dominio-treino.md), D-191), não só insumo de prescrição.

O volume prescritível depende de quanto tempo o aluno tem — captura os dois
juntos, um sem o outro não basta:

- **Frequência semanal:** quantos dias/semana o aluno pode treinar.
- **Tempo médio por sessão:** faixas (até 30 min / 30–45 / 45–60 / 60–90 /
  +90).
- Juntos formam o "orçamento de treino" — o personal distribui o volume
  total dentro dele. Conecta com a disponibilidade por contexto (D-187).

### D-189 — Histórico esportivo

Informa repertório motor e ponto de partida — complementa o nível de treino
já existente (`INICIANTE`/`INTERMEDIARIO`/`AVANCADO`/`ATLETA`): o nível diz
o quão avançado; o histórico diz de onde vem.

- **Esporte(s) já praticado(s):** catálogo + livre.
- **Tempo de prática** de cada um.
- **Ainda pratica?** (ativo/inativo).
- Relevante para lesões prévias (liga com `AnamnesisInjury`) e preferências
  de treino.

### D-190 — Suplementos: registro factual + sinal clínico para substância de acompanhamento

Relevante ao nutricionista (mais que ao personal) e à segurança
(interações).

- **Suplementos em uso:** catálogo dos comuns (whey, creatina, cafeína,
  BCAA, pré-treino, vitaminas, ômega-3, hipercalórico...) + "outro" livre.
  Registro **sem julgamento** — só o fato.
- **Distinção por natureza** (o sistema classifica internamente):
  - **Uso comum** (whey, creatina...) → registro simples.
  - **Substância que exige acompanhamento médico** (hormônios,
    anabolizantes/esteroides, termogênicos fortes) → além do registro,
    dispara um **sinal ao profissional** (mesma classe do alerta de risco
    D-178) — **não bloqueia, não julga**; informa o profissional para
    avaliar. O aluno responde honestamente sem se sentir julgado; o
    profissional recebe o sinal onde é clinicamente relevante.
- Isso fecha o item "uso de esteroides anabólicos" que o D-103 listava no
  módulo treino: tratado como sinal, não como campo isolado e acusatório.

---

> A decisão a seguir entrou como **adendo de aderência ancorada na
> disponibilidade do aluno** (jul/2026, decisão de mesa). É a parte do adendo que
> mora **aqui**, porque mexe na obrigatoriedade de um campo da anamnese; as
> outras duas decisões do mesmo adendo — o denominador da aderência (**D-191**) e
> a irrepresentabilidade do estado "sem denominador" (**D-193**) — vivem no
> [ADR-0009](0009-dominio-treino.md), onde o indicador tem casa (D-092).

### D-192 — Disponibilidade de treino é campo OBRIGATÓRIO, sem "não se aplica" (exceção consciente ao D-173)

O aluno **não pode pular** a disponibilidade (dias/semana, D-188) ao preencher a
anamnese de treino. Sem ela, a anamnese **não pode ser enviada** ao profissional.

- **Exceção consciente ao D-173.** A regra geral da anamnese admite "não se
  aplica" como resposta válida justamente para **não mascarar dado**. A
  disponibilidade de treino **não admite** essa resposta: não existe aluno de
  treino com disponibilidade zero — se treina, tem alguma frequência, nem que
  seja 1x/semana. O risco que o D-173 combate (forçar resposta onde o campo não
  se aplica ao perfil, poluindo o dado) **não existe aqui**, porque o campo se
  aplica a 100% dos alunos do módulo. Por isso é obrigatório **sem** a saída "não
  se aplica" — e por isso é **exceção nomeada**, não revogação: o D-173 continua
  sendo a regra para todo o resto.
- **Duplo ancoramento — é o que justifica a exceção.** A disponibilidade ancora
  as **duas** pontas: a **prescrição** (o profissional monta o treino dentro
  dela — D-188) e a **aderência** (é o denominador do indicador —
  [ADR-0009](0009-dominio-treino.md), D-191). Um campo que sustenta os dois lados
  não pode ser opcional sem derrubar um deles.
- **Eleva o D-188 de "capturado" para "obrigatório"** — sem reescrevê-lo (ver a
  nota no próprio D-188). O **tempo médio por sessão** do D-188 **não** é
  alcançado por esta elevação: segue como está. A **disponibilidade por contexto**
  do D-187 também **segue opcional** — ela distribui o plano entre locais, não é
  o total; o obrigatório é a frequência semanal do D-188.
- **Combinado com a trava de entrada (D-172), torna o estado ruim
  irrepresentável** — é exatamente disso que o D-193 (ADR-0009) depende.
- **Consequência de implementação:** o schema/validação da anamnese de treino
  deve marcar a frequência semanal como obrigatória e **não oferecer** a opção
  "não se aplica" nesse campo — ajuste a fazer quando o módulo for implementado
  (registrado em `docs/pendencias-mesa.md`).

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
6. **Versionamento (D-175/D-176) implica histórico próprio.** `Anamnesis` como
   linha única mutável não expressa "uma ativa + histórico append-only" — pede
   uma chave de versão (ex.: `version`, `isActive`) por vínculo, com as versões
   anteriores preservadas, não sobrescritas. A autoria por seção (D-102) e o log
   de "revisada sem mudança" (D-176) vivem por versão.
7. **Reaproveitamento (D-174) implica dado ancorado no titular, não no
   vínculo.** Os campos comuns auto-preenchíveis precisam de uma leitura "última
   resposta do aluno para este campo, em qualquer vínculo dele" — consulta por
   conta/paciente, não só por `bondId`. Não é campo novo em `Anamnesis`; é
   consulta cross-vínculo restrita ao próprio titular.
8. **Linha do tempo (D-177)** consome eventos de anamnese (nova versão,
   "revisada sem mudança", mudança pontual) como mais uma fonte — mesmo padrão
   de evento que execuções de treino e avaliações já alimentam; não é entidade
   nova aqui, é a anamnese publicando no feed que já existe no roadmap.
9. **Ciência de risco (D-178) reusa o mecanismo de aceite do D-025** (versão de
   texto + timestamp + hash) — não cria tabela de consentimento nova, associa o
   aceite ao sinal de risco específico que o disparou e à versão da anamnese
   (D-175) em que ele apareceu.
10. **Contextos de treino (D-187) pedem entidade filha, não array/enum
    único.** É lista (0..N) com tipo de local + checklist de equipamentos +
    disponibilidade por item — não cabe em coluna escalar de `Anamnesis`.
    Equipamentos e tipos de local viram catálogo (enum ou tabela de
    referência, a definir na implementação), com campo livre de escape
    ("outro"). Orçamento (D-188) e histórico esportivo (D-189) são campos
    simples do módulo treino; suplementos (D-190) é lista curta (catálogo +
    livre) com uma flag de classificação (comum × acompanhamento médico) que
    dispara o mesmo sinal do D-178.

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
- **O adendo de regras (D-172–D-178) não decidiu campos por módulo.** O
  módulo treino foi fechado pelo adendo seguinte (D-187–D-190): contextos de
  treino, orçamento (frequência+tempo/sessão), histórico esportivo e
  suplementos. Nutrição (Bristol, histórico de peso, comportamento alimentar,
  preferências) e nutrologia (perfil/histórico hormonal, catálogo de exames)
  seguem em **mesa de campos** própria, sobre as regras aqui fixadas.
- **O adendo de campos do módulo treino (D-187–D-190) estende o D-103, não o
  reescreve.** Contextos de treino são modelados como **lista** (não campo
  único), porque o aluno pode treinar em mais de um lugar. O sinal de
  substância que exige acompanhamento médico (D-190) reusa o mecanismo de
  alerta do D-178 — não cria caminho novo.
- **O texto jurídico do D-178 é RASCUNHO** — pendência explícita de validação
  por advogado antes de qualquer uso em produção. Não tratar como texto final.
- A anamnese tipada + o adendo continuam sendo **dado clínico**: qualquer
  implementação exige revisão humana obrigatória (Política de Merge,
  CLAUDE.md), como o resto do domínio clínico.
- **O D-192 cria a primeira exceção nomeada ao D-173.** A regra "não se aplica é
  resposta válida" continua sendo o padrão; o que passa a existir é o precedente
  de que um campo **universal ao módulo** e que **ancora um indicador** pode ser
  obrigatório sem essa saída. Exceção nova exige o mesmo par de justificativas
  (universalidade + ancoramento) — não é porta aberta para tornar campo
  obrigatório por conveniência de formulário.
- **A anamnese vira dependência de leitura do domínio de treino.** Com o D-191
  (ADR-0009), o cálculo de aderência passa a **ler** a disponibilidade da
  anamnese ativa do vínculo (D-175). É acoplamento novo entre módulos que antes
  não existia: mudança na forma de guardar a frequência semanal quebra o
  indicador de treino.
