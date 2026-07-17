# ADR-0014 — Domínio de Medicina (nutrologia esportiva)

**Status:** Aceito
**Decisões cobertas:** D-122 a D-132
**Revisa:** D-063/ADR-0006 (esqueleto) — ver D-122; D-011/ADR-0003 — ver D-126

## Contexto

Fecha o **D-063 para medicina** — a última das três especialidades. O ADR-0009
fechou treino (benchmark MFit), o ADR-0013 fechou nutrição (benchmark Dietbox), o
ADR-0011 fechou a anamnese. Com este ADR, **nenhum domínio de conteúdo do FITVO
segue em `detail Json?`**.

O recorte é **nutrologia esportiva**, não medicina genérica: o público é o mesmo
do resto do produto. Isso muda o que importa — o ativo do domínio é a **série
temporal** (exame laboratorial e antropometria ao longo de anos acompanhando
protocolo), não o registro pontual de consulta.

O esqueleto (PR #14, ADR-0006) deixou `Encounter`, `MedicalRecord`, `Prescription`
e `Assessment` com `detail Json?` e marcador `TODO(D-063)`. Além do detalhe fino,
**o esqueleto modelou uma entidade que não deveria existir** — ver D-122. É o
espelho invertido da lacuna que o D-079 (treino) e o D-112 (nutrição) acharam: lá
faltava um degrau da hierarquia, aqui sobra um.

## Decisão

### D-122 — `MedicalRecord` não existe: o prontuário É o vínculo

O `MedicalRecord` previsto pelo esqueleto do ADR-0006 **morre**.

O prontuário descrito pelo responsável — *"cada paciente tem seu prontuário
próprio e seu profissional vinculado; se muda de profissional, abre um novo e o
antigo fica"* — **já é o `Bond`** (D-052) + arquivamento (D-053). Palavra por
palavra: "prontuário próprio + profissional vinculado" é a tripla
`paciente ↔ profissional ↔ especialidade` (ADR-0001); "abre um novo e o antigo
fica" é `archivedAt` (D-053).

`MedicalRecord` 1:1 com `Bond` seria **segunda fonte de verdade para o que o bond
já define** — exatamente o defeito do `Bond.anamnesisCompletedAt` rejeitado pelo
D-093, e da flag de gate espelhada rejeitada pelo ADR-0011. Um container 1:1 com
outro container não carrega informação: carrega a possibilidade de divergir.

**O prontuário é a COLEÇÃO** pendurada no bond — anamnese (D-103) + encounters
(D-123) + assessments (D-132) + prescrições (D-125/D-126) + exames (D-124). Não
é linha em tabela; é o que o vínculo acumula.

> Consequência de leitura: "abrir o prontuário do paciente" é **listar por
> `bondId`**, não `SELECT` de um registro. Nada se perde — e o isolamento por
> vínculo (ADR-0001) passa a ser a única regra de acesso, sem um segundo objeto
> a esquecer de escopar.

### D-123 — `Encounter` = consulta realizada (entrada de evolução)

- Pendura no `Bond` (isolamento, ADR-0001) + `tenantId` (D-002). **Já está assim.**
- Cada encounter é uma **entrada de evolução** do prontuário — a unidade de
  acúmulo que o D-122 descreve.
- **Ligação com a agenda:** `Encounter.appointmentId String? @unique` — já
  existe no schema (ADR-0012) e este ADR **confirma**. Opcional de propósito: o
  D-018/D-109 querem tudo passando pelo app, mas não podem impedir o mundo real —
  a consulta pode ocorrer sem ter sido marcada aqui.
- **Primeira consulta × retorno:** já congelado no `Appointment`
  (`serviceTypeAtBooking`, ADR-0012) — não se remodela aqui. Ver "Gaps": o
  encounter *sem* appointment não tem essa informação.
- **Conteúdo:** evolução clínica, exame físico, conduta, diagnóstico (texto livre
  — D-129), próximo retorno.

### D-124 — Exames laboratoriais: ciclo completo e valores estruturados

**Ciclo confirmado:**

1. O médico **solicita** (marca quais exames).
2. O paciente faz **fora da plataforma**.
3. O paciente **anexa** o resultado (PDF/foto) — storage (D-026).
4. O médico **analisa e registra os valores**.

**Os valores são ESTRUTURADOS — não só o PDF.** É a decisão central deste ADR.
Sem valor estruturado, o PDF é um **cemitério**: dado que entrou e nunca mais
saiu. Com ele, vira **série temporal** — evolução de colesterol, ferritina,
testosterona ao longo dos anos. Requisito explícito do responsável: *"precisamos
colher dados"*.

**Entidades:**

- **Catálogo de exames** — nome, unidade, faixa de referência. Base da
  plataforma; **deleção lógica** (D-089), como exercício e alimento.
- **Solicitação** — quais exames, quando, por quem.
- **Resultado** — anexo + **valores estruturados por exame** + **data da coleta**.

**A data da coleta é do exame, não do registro.** O médico registra hoje um
exame coletado há três semanas; a série temporal é ordenada pela **coleta**. É a
mesma distinção que o `Encounter.occurredAt` faz — e a mesma que o
`Appointment.startsAt` faz contra o `createdAt`.

**Consequência:** alimenta os indicadores (D-120) e a linha do tempo (D-085).

#### Adendo — faixa de referência é por (sexo, faixa etária), nunca uma só

A faixa de referência **varia por sexo e por idade** — ferritina de homem e de
mulher não têm a mesma faixa, e a de criança não é a de adulto. **Uma faixa única
no catálogo estaria errada para metade dos pacientes**, e erraria em silêncio: o
número apareceria "normal" ou "alterado" sem que ninguém percebesse a premissa.

**Decisão: o catálogo guarda faixas por `(sexo, faixa etária)`** — várias por
exame —, não uma faixa no exame. A faixa aplicável é escolhida na leitura, pelo
sexo e pela idade do paciente **na data da coleta** (não na data de hoje: uma
faixa pediátrica não pode virar adulta retroativamente porque o paciente
cresceu).

#### Adendo — valor de exame é `Decimal`, e é o primeiro do schema

O valor **não pode ser `Float`**, pelo mesmo motivo que dinheiro não pode
(D-069): binário aproximado. Ferritina, testosterona e TSH são medidas clínicas
comparadas contra faixa de referência — um erro na última casa muda "normal" para
"alterado".

**Registro explícito: este é o PRIMEIRO `Decimal` do schema.** Dinheiro resolveu
o problema com **inteiro em centavos** (D-069) porque tem unidade fixa e duas
casas; exame **não tem** — a unidade varia por exame (mg/dL, ng/mL, mUI/L) e a
precisão também. Não há "centavo de ferritina". Por isso a solução do dinheiro
**não transfere**, e a alternativa correta é `Decimal` com precisão explícita.

### D-125 — Prescrição / orientação (médico E nutricionista)

- **Quem pode:** médico **e** nutricionista.
- **Formato:** texto livre (o profissional escreve a conduta) + **campos
  estruturados opcionais no cabeçalho**, que aparecem impressos.
- **Conteúdo típico:** orientações, protocolo, conduta, o que fazer.
- Impressa em folha timbrada; **assinatura física** (D-011).

### D-126 — Receita médica: somente médico, somente receita simples

- **Quem pode:** somente **médico**. Nutricionista **não** emite receita.
- **Finalidade:** o paciente comprar medicamento na farmácia.

#### Estrutura

**Cabeçalho do profissional** — **não digitado**: nome vem do `Account`; o
**registro no conselho (CRM+UF) e o RQE vêm do `ProfessionalSpecialty`**; os
dados da clínica (nome, endereço, cidade/UF, telefone, e-mail, logo) vêm do
`Tenant`. **CONGELADO na emissão** (D-130).

> **Correção registrada — o registro do conselho NÃO mora no
> `ProfessionalProfile`.** A formulação original desta decisão dizia que o
> cabeçalho vinha do perfil profissional. **Está errado, e o schema está certo:**
> o `councilDocument` pertence ao **`ProfessionalSpecialty`** porque a
> **verificação é por especialidade** (D-046, ADR-0003). Uma pessoa é educador
> físico com **CREF** e nutricionista com **CRN** — **dois conselhos diferentes,
> da mesma pessoa**. Mover o registro para o perfil colapsaria os dois num campo
> só e quebraria o D-046. O cabeçalho lê **do vínculo da especialidade que está
> emitindo**: receita sai com o CRM da habilitação `MEDICINE`, nunca com o CREF
> de quem também é personal.

**Identificação do paciente** — vem do `Bond`/`PatientProfile` (nome, data de
nascimento, idade calculada, sexo, CPF, peso e altura opcionais). Congelado.

**Dados da receita:** data de emissão, cidade, CID-10 (opcional, texto livre —
D-129), diagnóstico (opcional).

**Itens da receita** — linha dinâmica, campos **digitados** pelo médico:

- medicamento · princípio ativo (opcional) · concentração;
- forma farmacêutica (comprimido, cápsula, solução, pomada, creme, spray, gotas,
  injetável…);
- quantidade;
- via de administração (oral, intramuscular, intravenosa, subcutânea, tópica,
  nasal, oftálmica, auricular);
- posologia · horário (opcional) · duração · observação.

> **Biblioteca ≠ estrutura.** Biblioteca de medicamentos está **fora**: dataset
> ANVISA, autocomplete, busca por princípio ativo é **projeto próprio**. Mas os
> campos seguem **estruturados** — o médico **digita** em vez de buscar. O motivo
> de manter estrutura é o mesmo do D-124: o **histórico medicamentoso é o ativo**,
> especialmente em nutrologia acompanhando protocolo hormonal por anos. Texto
> corrido devolveria o cemitério.

**Orientações gerais** (texto livre) · **Observações** (texto livre).

**Assinatura:** espaço para assinatura **física** + nome, CRM-UF e RQE impressos.

#### Fora de escopo

- **Receita Digital / assinatura digital / QR Code** — contradiz o D-011 (sem
  prescrição eletrônica no MVP); ICP-Brasil é fase regulada futura, junto da
  telemedicina (D-075, ADR-0007).
- **Receita controlada / especial** — **não é um valor de enum: é outro regime
  legal.** Medicamento controlado exige **formulário oficial numerado**
  (notificação de receita), com **retenção de via pela farmácia**. Uma folha
  impressa pelo FITVO **não é aceita na farmácia** para controlado. **O MVP
  suporta apenas RECEITA SIMPLES**; o controlado o médico emite no talonário
  oficial dele. Mesma lógica de redução de escopo de risco do D-011.

> **⚠️ ALERTA DE PRODUTO — item para advogado, não para engenharia.**
> O núcleo da nutrologia esportiva é **protocolo hormonal** (TRT, testosterona,
> GH) — e **testosterona e anabolizantes são controlados no Brasil**. Ou seja: a
> receita que mais importa ao nutrólogo é **justamente a que o FITVO não
> imprime**. Não inviabiliza o produto (ele usa o talonário oficial, como já faz
> hoje), mas existe uma **costura fora do app** no fluxo "premium" da nutrologia.
> Registrado para decisão de produto/jurídico, não para contorno técnico.

### D-127 — Declaração de comparecimento (médico e nutricionista)

**Gerada automaticamente** a partir do `Appointment`: paciente, data, hora de
início/fim, profissional, CRM/CRN, clínica. **O profissional não digita nada — o
sistema já sabe.**

Só é emitível para `Appointment` com status `COMPLETED`.

> **É a prova concreta do D-018.** Justificativa do responsável: *"por isso a
> importância de estar tudo via sistema, de ponta a ponta, tudo registrado"*. O
> dado que **já existe** vira entregável **sem trabalho nenhum**. Nenhum campo
> novo é pedido ao profissional; a agenda paga a declaração.

### D-128 — Protocolo hormonal: sem domínio próprio

Entra **no prontuário e na prescrição, junto** — *"tudo é um plano só para o
paciente seguir"* (responsável). **Não** é entidade separada com ciclo/fases.

O **histórico** hormonal (TRT, GH, peptídeos, anabolizantes — substância, dose,
tempo de uso) é **campo da anamnese de nutrologia**, já registrado no adendo do
D-103 (ADR-0011).

**Escopo confirmado: o módulo de nutrologia da anamnese entra COM ESTE LOTE.** O
ADR-0011 entregou núcleo + módulo treino e deixou nutrologia para quando os
exames laboratoriais (D-076) existissem — e é este ADR que os cria (D-124). Sem o
módulo, **o D-128 fica sem lugar** e o protocolo hormonal — que é o núcleo clínico
da nutrologia esportiva — vira texto solto na evolução.

### D-129 — CID: texto livre

Sem catálogo CID-10/CID-11. O médico digita. Mesma disciplina do
`AnamnesisGoal.goal` (D-103): nenhum ADR decidiu a taxonomia, e inventá-la aqui
seria inventar regra de negócio.

### D-130 — Congelamento dos dados de emissão

**Todo documento emitido — receita, prescrição, declaração — CONGELA os dados no
momento da emissão:** CRM, nome do profissional, clínica, endereço, dados do
paciente.

**Motivo (princípio da derivação congelada — ADR-0011):** o CRM e a clínica **no
momento da emissão** são **fato jurídico**. Se o médico trocar de clínica e o
documento antigo for reimpresso, ele **não pode sair com o endereço novo** —
seria **reescrever retroativamente o que um documento afirma**.

Teste do ADR-0011 aplicado: *"se a fonte mudar, este campo deve mudar junto?"* →
**Não** → **armazene**. Mesma família do `authoredBy` (D-102), do
`priceCentsAtBooking` (ADR-0012) e do preço registrado na compra. Distinto do
`Bond.anamnesisCompletedAt` (D-093) e do `ReturnPolicy` (D-109), que duplicavam
fato **presente** e por isso foram rejeitados — a assimetria é intencional.

#### Adendo — ciclo de vida do documento: adendo, nunca edição

O congelamento **implica imutabilidade**, e isso deixava uma pergunta em aberto:
*o que acontece quando o médico erra a receita?* A resposta óbvia — deixar
editar — **descongelaria o documento** e devolveria exatamente o problema que o
D-130 resolve.

**Decisão — todo documento emitido (receita, orientação, declaração) tem estado:**

- **`DRAFT`** → editável livremente. Não é documento ainda: é rascunho.
- **`ISSUED`** → **IMUTÁVEL**. É aqui que os dados congelam (D-130).
- **Correção = `CANCELLED`** — com **motivo, registrado e datado** — **+ emissão
  de um documento novo**. Nunca edição silenciosa.

**Motivo: em medicina o rastro importa mais que a conveniência.** *"Esta receita
foi cancelada em 12/03 porque a dose estava errada"* **é informação clínica** —
apagar o erro apaga o fato de que ele existiu, e o prontuário é registro legal. A
farmácia pode já ter em mãos a via impressa da receita errada; o sistema afirmar
que ela nunca existiu é pior que o erro original.

**A emissão é o que congela, não a criação da linha.** Enquanto `DRAFT`, o
cabeçalho **não** está congelado: ele é lido das fontes vivas. No `ISSUED`, os
valores são copiados e param no tempo. Isso torna o congelamento um **evento com
momento definido** em vez de um efeito colateral do `INSERT` — e é o que permite
o profissional montar a receita hoje e emitir amanhã sem carregar dado velho.

Vale também para a **evolução do `Encounter`** (D-123): prontuário fechado é
registro, e correção é adendo. O estado do `Encounter` segue a mesma disciplina.

### D-131 — Favoritos, modelos e repetir

- **Prescrições/receitas favoritas** do médico — salvar e reaplicar com um clique.
- **Modelos de tratamento.**
- **Repetir a última receita** do paciente.
- **Histórico** de todas as receitas anteriores do paciente.

> **Terceira instância do mesmo mecanismo**, e é isso que o torna decisão de
> arquitetura e não feature: **clonagem de treino** (D-090) → **templates de
> nutrição** (D-117) → **receita** (aqui). Os três atacam a **dor #1 do mercado**
> (tempo de montagem) com a mesma forma: partir de algo pronto e editar.

### D-132 — `Assessment` tipado

O `Assessment` ainda tem `detail Json?`. Com o domínio de medicina fechado, ele
**vira colunas tipadas**.

- **Conteúdo:** peso, altura, **IMC (derivado — não armazenar)**, % de gordura,
  massa muscular, circunferências (abdominal, braço, peitoral, quadril, coxa,
  panturrilha, pescoço), dobras cutâneas, bioimpedância (massa óssea, água
  corporal, gordura visceral, TMB, massa magra).
- **Autoria:** **somente profissional** preenche; paciente tem **leitura**
  (ADR-0011).
- **Fotos de evolução:** frente, lado, costas — storage (D-026), isoladas por
  vínculo (D-004).
- **Não aparece em modalidade `ONLINE`** (D-101).

**Destrava o bloco de antropometria** no fluxo da anamnese — os campos hoje
bloqueados com *"seu profissional preencherá na consulta"* (ADR-0011), que
dependem exatamente desta tipagem.

> **IMC derivado, mas peso/altura da receita congelados — e os dois estão
> certos.** O IMC no `Assessment` é *estado presente*: se o peso for corrigido, o
> IMC **deve** mudar junto → derive. O peso impresso numa receita é *o que aquele
> documento afirmou naquele dia* → congele (D-130). É o mesmo teste devolvendo
> respostas opostas para perguntas diferentes.

#### Adendo — % de gordura exige o PROTOCOLO, e a série temporal é por protocolo

**"% de gordura" sozinho não é um dado — é um número sem premissa.** Pollock 3
dobras, Pollock 7, Faulkner e Guedes **medem coisas diferentes**, com dobras
diferentes e equações diferentes. Guardar o percentual sem o protocolo produz uma
série temporal que **compara medidas incomparáveis** — exatamente o defeito que o
D-124 existe para evitar, só que **dentro do próprio `Assessment`**.

O modo de falhar é cruel: o gráfico fica bonito e mente. O paciente "ganha 3% de
gordura" porque o profissional trocou de protocolo entre uma avaliação e outra —
e ninguém liga uma coisa à outra, porque a premissa não está no dado.

**Decisão:**

- O `Assessment` armazena o **protocolo usado** + as **dobras aferidas** + o **%
  resultante**.
- O **protocolo é enum** (catálogo da plataforma). Como todo enum do projeto,
  guarda o **código**; o rótulo vive no i18n (D-066).
- **A série temporal só compara medidas do MESMO protocolo. Trocar de protocolo
  INICIA UMA SÉRIE NOVA — não continua a antiga.**

> **Isto é regra de EXIBIÇÃO, não só de schema** — e por isso está registrada
> aqui, não deixada para a tela. Guardar o protocolo e depois plotar tudo na mesma
> linha **não resolve nada**: o dado estaria certo e o gráfico continuaria
> mentindo. A coluna é o meio; a quebra da série é a decisão.
>
> Guardar as **dobras**, e não só o resultado, é o que permite **recalcular** por
> outro protocolo no futuro — e é o mesmo princípio do D-124: guarde a medida,
> não só a conclusão.

#### Adendo — data da aferição, separada do `createdAt`

O `Assessment` guarda **quando a medida foi aferida**, distinto de quando a linha
foi criada. **O profissional pode digitar hoje uma medida de ontem** — e a série
temporal se ordena pela **medição**, não pela digitação.

É o mesmo princípio da **data da coleta** (D-124), do `Encounter.occurredAt`
(D-123) e do `Appointment.startsAt` contra o `createdAt` (ADR-0012). Quatro
instâncias da mesma regra: **o instante do fato não é o instante do registro.**

#### Adendo — `ProgressPhoto`: ângulo e ligação com o `Assessment`

Foto de evolução **sem saber o ângulo é inútil para comparação** — o valor da
foto é frente-contra-frente ao longo do tempo, e hoje ela é foto solta no vínculo.

- **Ângulo é enum:** frente · lado · costas · livre.
- **A foto liga ao `Assessment`** — a avaliação é o momento em que a foto faz
  sentido, e é o que dá a ela a data da aferição sem duplicar o campo.

## Impacto de modelagem e inconsistências herdadas

**Nada implementado por este ADR.** Inconsistências entre estas decisões e o
schema atual (`main`, pós-#43):

1. **`MedicalRecord` existe e deve morrer** (D-122) — `schema.prisma:1307`, mais
   `Bond.medicalRecord` (:385) e `Tenant.medicalRecords` (:166). Tabela vazia:
   destrutiva **em forma**, não em dado. Revisa o esqueleto do ADR-0006.
2. **`Encounter.detail Json?` morre** (:1289) → colunas tipadas (D-123). O
   `appointmentId String? @unique` (:1286) **já está correto** — este ADR
   confirma, não altera. `occurredAt` é opcional hoje; com a entidade tipada,
   avaliar se "consulta realizada sem saber quando" é estado que deve existir.
3. **`Prescription` é UMA entidade para DOIS documentos** (:1326) — **RESOLVIDO:
   separar em duas.** O D-125 (orientação: médico **e** nutricionista, texto
   livre) e o D-126 (receita: **só** médico, itens estruturados) têm **emissor,
   estrutura e regime legal diferentes**. Colapsá-los num `type` + campos nulos
   deixaria **"receita emitida por nutricionista" representável** — e a disciplina
   do projeto (D-103, D-093, D-081) é tornar o estado inválido **irrepresentável**,
   não proibido por validação.
   - **`Guidance`** — orientação/conduta. Médico **e** nutricionista. Texto livre
     + campos estruturados opcionais no cabeçalho (D-125).
   - **`MedicalPrescription`** — receita. **Só médico.** Itens estruturados
     (D-126).
   O `Prescription` atual morre junto com o `detail Json?`. O que as duas
   compartilham é o **cabeçalho congelado** (D-130) e o **ciclo de vida**
   (`DRAFT`/`ISSUED`/`CANCELLED`) — e isso é **composição, não herança**.
4. **`Assessment.detail Json?` morre** (:1749) → colunas tipadas (D-132). Falta
   também a **data da aferição**: só há `createdAt`, e série temporal (D-085/
   D-120) se ordena pela medição, não pela digitação — mesmo motivo da coleta no
   D-124.
5. **`ProgressPhoto` existe mas não expressa o D-132** (:1768): não tem o
   **ângulo** (frente/lado/costas) nem ligação com o `Assessment`. Hoje é foto
   solta no vínculo.
6. **O D-130 não tem de onde congelar — as fontes não existem.** Verificado no
   schema, e é o achado mais caro deste ADR. **O lugar do registro do conselho
   está CERTO** (`ProfessionalSpecialty`, por causa do D-046 — ver a correção no
   D-126); o que falta é **conteúdo**, não mudança de lugar:
   - **UF do conselho:** `ProfessionalSpecialty.councilDocument String?` (:250)
     guarda só o número. **Conselho é estadual** — "CRM 12345" **sem UF não
     identifica ninguém**, e é o que vai impresso na receita. Falta a UF.
   - **RQE:** **não existe** em lugar nenhum. É **específico de medicina** (é o
     registro de qualificação de especialista) → mora no `ProfessionalSpecialty`
     da especialidade `MEDICINE`, ao lado do CRM. Nulo nas demais linhas.
   - **`Tenant`** (:143) tem `name` e `document` — **não tem** endereço,
     cidade/UF, telefone, e-mail nem logo. O cabeçalho do D-126 pede todos.
   - **Paciente:** `PatientProfile` (:265) não tem **data de nascimento** nem
     **sexo** — não existem no schema; nome e CPF vivem no `Account` (:92). O
     **sexo destrava também as faixas de referência** (adendo do D-124), que são
     por `(sexo, faixa etária)`: sem ele, nenhuma faixa é aplicável.
   → **É pré-requisito, não parte das tabelas de documento:** não se congela o
   que não se tem. Ver "Plano de modelagem", fase 0.
7. **Exames laboratoriais: nada existe** (D-124). Catálogo, solicitação e
   resultado são entidades novas. O **valor numérico exige `Decimal`** — `Float`
   erraria pelo mesmo motivo que erra em dinheiro (D-069); ferritina e
   testosterona não toleram binário aproximado, e o schema ainda não usa
   `Decimal` em lugar nenhum.
8. **O D-128 depende de uma seção que não foi construída.** O histórico hormonal
   é campo da **anamnese de nutrologia** (D-103), e o ADR-0011 entregou
   **núcleo + módulo treino** — o módulo de nutrologia ficou explicitamente para
   quando os exames existissem (D-076). Agora existem: o módulo entra **com este
   lote**, senão o D-128 fica sem lugar e o protocolo hormonal vira texto solto.
9. **Tabelas novas nascem `@db.Timestamptz(3)`** (adendo do D-111, ADR-0012) —
   sem custo, como foi na agenda. Atenção à ordem: o **PR #44** converte as
   tabelas existentes; as deste lote não devem nascer devendo.
10. **D-131 e LGPD:** favorito/modelo é ativo **do profissional**, não do
    vínculo — logo **não** é isolado por bond. Um favorito salvo a partir da
    receita de um paciente **não pode carregar vínculo com aquele paciente**: é
    cópia sem linhagem clínica, senão dado de paciente vaza para um objeto que
    será reaplicado em outro (D-004/D-016). "Repetir última receita" é
    **operação de cópia**, não entidade.

## Plano de modelagem (aprovado — a ordem é dependência, não preferência)

**Fase 0 — as fontes do congelamento (pré-requisito do D-130). PR PRÓPRIO.** Sem
isto, os documentos não têm o que congelar: **UF do conselho e RQE no
`ProfessionalSpecialty`** (o lugar já está certo — D-046), dados da clínica no
`Tenant` (endereço, cidade/UF, telefone, e-mail, logo — encosta no
D-078/white-label), data de nascimento e sexo no paciente. **Toca auth/tenant →
área crítica pela Política de Merge**, e por isso **não vai junto com domínio
clínico**: são dois riscos distintos, e misturá-los faria a revisão de um esconder
a do outro.

**Fase 1 — a limpeza.** Matar `MedicalRecord` (D-122) e os três `detail Json?`
(`Encounter`, `Prescription`, `Assessment`).

**Fase 2 — o prontuário.** `Encounter` tipado + `Assessment` tipado (com
**protocolo + dobras**) + **data da aferição** + **ângulo e ligação** na
`ProgressPhoto`. **Destrava a antropometria** (ADR-0011).

**Fase 3 — exames** (D-124): catálogo (com faixas por sexo/faixa etária) +
solicitação + resultado com valores em `Decimal`. Destrava o **módulo de
nutrologia da anamnese** e, com ele, o D-128.

**Fase 4 — documentos emitidos**: `Guidance` (D-125) e `MedicalPrescription`
(D-126) como **entidades separadas**, declaração (D-127), com **cabeçalho
congelado** (D-130) e **ciclo `DRAFT`/`ISSUED`/`CANCELLED`**; depois
**favoritos/modelos** (D-131), que só existem sobre documentos prontos.

## Alternativas consideradas

- **`MedicalRecord` 1:1 com o `Bond`** (o que o esqueleto do ADR-0006 previu):
  parece o modelo óbvio de prontuário e é como muitos sistemas fazem. **Rejeitado
  (D-122)** — é segunda fonte de verdade para o que o bond já define
  (paciente + profissional + arquivamento). Um container 1:1 com outro container
  não carrega informação, só a possibilidade de divergir: mesmo defeito do
  `Bond.anamnesisCompletedAt` (D-093).
- **Biblioteca de medicamentos (dataset ANVISA + autocomplete):** melhoraria a
  digitação e permitiria checagem de interação. **Rejeitado (D-126)** — é projeto
  próprio (curadoria, atualização, busca por princípio ativo). Note que **não**
  foi rejeitada a *estrutura*: os campos seguem tipados; o médico digita.
- **Itens de receita em texto corrido** (o caminho simples, já que não há
  biblioteca): **rejeitado** — destrói o histórico medicamentoso, que é o ativo
  da nutrologia (D-126). Seria o cemitério do D-124 em outro lugar.
- **Receita controlada como valor de enum:** parece um caso a mais do mesmo
  documento. **Rejeitado (D-126)** — é **outro regime legal**: formulário oficial
  numerado, retenção de via. Modelá-lo como enum produziria uma folha que **a
  farmácia não aceita**, com o app afirmando que emitiu uma receita válida. O
  risco não é bug de impressão: é o usuário confiar.
- **Receita digital com assinatura/QR Code:** é para onde o mercado vai.
  **Rejeitado por ora (D-126)** — contradiz o D-011 e exige ICP-Brasil; entra com
  a telemedicina (D-075), na fase regulada.
- **Só anexar o PDF do exame, sem valores estruturados:** muito mais barato, e o
  paciente já teria o documento. **Rejeitado (D-124)** — vira cemitério de PDF:
  sem série temporal não há gráfico de ferritina, não há indicador (D-120), não
  há linha do tempo (D-085). *"Precisamos colher dados"* é o requisito, e anexo
  não é dado.
- **Catálogo CID-10:** daria analytics de diagnóstico e padronização.
  **Rejeitado (D-129)** — texto livre; nenhum ADR fundamenta a taxonomia, e o
  custo de curadoria não se paga no MVP.
- **Protocolo hormonal como domínio próprio (ciclo, fases, blocos):** é o núcleo
  clínico da nutrologia e seria tentador modelar. **Rejeitado (D-128)** — o
  responsável é explícito: *"tudo é um plano só para o paciente seguir"*. Um
  domínio paralelo criaria um segundo lugar onde mora "o que o paciente deve
  fazer", concorrendo com a prescrição.
- **Declaração de comparecimento gerada na hora, sem persistir:** ela é 100%
  derivável do `Appointment` — o argumento de não armazenar é forte. **Rejeitado
  (D-127 + D-130)** — o **congelamento** exige persistir: a declaração afirma o
  CRM e a clínica **daquele dia**, e reimprimir dois anos depois não pode trazer
  a clínica nova. Derivável ≠ derivado; é o teste do ADR-0011 de novo.
- **Armazenar o IMC junto do peso:** simetria tentadora com os demais campos do
  `Assessment`. **Rejeitado (D-132)** — se o peso mudar, o IMC **deve** mudar
  junto → derive. Oposto do D-130 pelo mesmo teste.
- **`authoredBy` (enum de papel) também no `Assessment`, como nas seções da
  anamnese:** simetria com o D-102. **Rejeitado** — lá o enum existe porque
  paciente **ou** profissional pode preencher; aqui só o profissional preenche
  (D-132), e um enum de valor único não é informação, é ruído que sugere uma
  variação que não existe. `authoredByAccountId` + timestamp bastam.
- **Mover o registro do conselho para o `ProfessionalProfile`** (era o que a
  formulação original do D-126 pedia): **rejeitado — e o schema atual está
  certo.** A verificação é **por especialidade** (D-046): a mesma pessoa é
  educador físico com **CREF** e nutricionista com **CRN**. Um campo no perfil
  colapsaria os dois conselhos num só e quebraria o D-046. Ver a correção no
  D-126.
- **Um `type` no `Prescription` atual, em vez de duas entidades:** menos tabelas,
  e é o caminho que a maioria dos sistemas toma. **Rejeitado** — deixaria
  **"receita emitida por nutricionista" representável**, dependendo de validação
  para não acontecer. Mesma disciplina que separou as seções da anamnese (D-103) e
  rejeitou a carga polimórfica (D-081): o estado inválido deve ser
  **irrepresentável**, não proibido. O que as duas compartilham (cabeçalho
  congelado, ciclo de vida) é **composição**.
- **Permitir editar documento emitido** (o caminho conveniente): **rejeitado** —
  **descongela** o documento e devolve o problema que o D-130 resolve. Correção é
  **cancelamento com motivo + novo documento**; em medicina o rastro importa mais
  que a conveniência, e a via impressa da receita errada pode já estar na farmácia.
  Ver o adendo do D-130.
- **Uma faixa de referência única por exame:** simplificaria o catálogo.
  **Rejeitado** — estaria **errada para metade dos pacientes**, e erraria em
  silêncio. Faixas por `(sexo, faixa etária)` (adendo do D-124).
- **Guardar só o % de gordura, sem o protocolo:** é o que a maioria dos apps faz.
  **Rejeitado (adendo do D-132)** — Pollock 3/7, Faulkner e Guedes medem coisas
  diferentes; sem a premissa, a série compara medidas incomparáveis e **o gráfico
  fica bonito mentindo**. Guardar as dobras (não só o resultado) ainda permite
  recalcular depois.
- **`Float` para valor de exame:** o tipo "óbvio" para medida contínua.
  **Rejeitado** — binário aproximado, o mesmo motivo que baniu float em dinheiro
  (D-069). Note que a **solução** do dinheiro (inteiro em centavos) **também não
  serve**: não há "centavo de ferritina", e a unidade varia por exame. Daí
  `Decimal` — o primeiro do schema.

## Consequências

- **O D-063 fecha para as três especialidades.** Treino (ADR-0009), nutrição
  (ADR-0013) e agora medicina. **Nenhum domínio de conteúdo segue em `Json`** —
  e o merge por campo do offline-first (D-099), impossível sobre `Json`, deixa de
  ter obstáculo de modelagem.
- **O ADR-0006 é revisado** pelo D-122: o esqueleto previu uma entidade que não
  existe. Recebe ponteiro para cá.
- **O bloco de antropometria do ADR-0011 destrava** (D-132) — sai de BLOQUEADO no
  roadmap.
- **O módulo de nutrologia da anamnese destrava** (D-103): dependia de exames
  (D-076), que este ADR cria. Com ele, o D-128 ganha lugar.
- **A migração é destrutiva em forma sobre tabelas vazias** — mesmo caso do #26 e
  do lote de nutrição. Continua **dado clínico → revisão humana obrigatória**;
  sem `--admin`, mesmo com CI verde.
- **Um pré-requisito de auth/tenant apareceu** (fase 0): o D-130 exige campos que
  o cadastro profissional e o `Tenant` não têm — **UF do conselho e RQE** (no
  `ProfessionalSpecialty`, D-046), dados da clínica, nascimento e sexo do
  paciente. **Toca auth/tenant → área crítica, em PR próprio.**
- **O `Prescription` do esqueleto vira DUAS entidades** — `Guidance` (D-125) e
  `MedicalPrescription` (D-126). Não é renomeação: é a separação que torna
  "nutricionista emitiu receita" irrepresentável.
- **Entra o primeiro `Decimal` do schema** (adendo do D-124). Até aqui, toda
  grandeza do projeto era inteiro (centavos — D-069) ou texto. Vale registrar o
  precedente: `Decimal` é para medida clínica com unidade variável, **não** uma
  reabertura da decisão de dinheiro.
- **O ciclo `DRAFT`/`ISSUED`/`CANCELLED`** (adendo do D-130) atravessa os três
  documentos e o `Encounter`. É o que dá ao congelamento um **momento definido** —
  a emissão — em vez de amarrá-lo ao `INSERT`.
- **O alerta do D-126 (controlado) é item de produto/jurídico**, não de
  engenharia. Não há o que implementar; há o que decidir. Some-se à lista de
  BLOQUEADO — TERCEIROS.
- Documento emitido é **dado clínico** (D-015): admin puro nunca vê. A
  declaração de comparecimento (D-127) é o **caso de fronteira** — ela prova
  presença, não condição; se o admin da clínica pode emiti-la é decisão pendente
  (ver "Gaps").

## Gaps conhecidos (decisão pendente — não modelar sem ADR)

> **Três gaps desta lista foram RESOLVIDOS na revisão do ADR** e viraram adendos:
> faixa de referência por `(sexo, faixa etária)` (D-124), ciclo de vida do
> documento com cancelamento em vez de edição (D-130), e protocolo de dobras com
> série temporal por protocolo (D-132). Ficam os abaixo.

- **Resultado qualitativo** (D-124): "negativo", "reagente", "não detectável" não
  são número. Se o catálogo tem exame qualitativo, o valor não pode ser só
  `Decimal`. Não decidido — e note que o adendo do D-124 **decidiu o tipo do valor
  quantitativo**, não a existência do qualitativo.
- **Taxonomia de unidades** (D-124): mg/dL, ng/mL, mUI/L — string livre ou enum?
  Livre corre o risco de "ng/ml" e "ng/mL" quebrarem a série; enum exige migração
  a cada exame novo.
- **Quem emite a declaração** (D-127): médico e nutricionista, sim — e o admin da
  clínica? Ela não é dado clínico em conteúdo, mas nasce de dado clínico. O D-015
  não responde este caso.
- **Numeração de documento** (D-126/D-127): receita e declaração costumam ter
  número/série no mundo real. Nenhuma decisão diz se o FITVO numera.
- **O paciente vê a receita no app?** O D-126 diz que ela é impressa e assinada
  fisicamente. Se ela também aparece no app do paciente (e se isso a faz parecer
  válida sem assinatura) não foi decidido.
