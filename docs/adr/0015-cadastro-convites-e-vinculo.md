# ADR-0015 — Cadastro, Convite e Vínculo

**Status:** Aceito
**Decisões cobertas:** D-135 a D-143, D-156
**Relacionados:** D-006 (ADR-0001), D-025/D-029 (ADR-0002), D-046/D-051 (ADR-0003), TODO(D-010)

## Contexto

O `Bond` (vínculo = paciente ↔ profissional + especialidade) é a entidade
central do produto — é dele que nascem prontuário, plano, agenda e cobrança.
Sem `Bond` não há ambiente. Da mesma forma, um profissional só deveria atuar
numa especialidade que **reivindicou** — a especialidade é o que determina o
rótulo do conselho (CREF/CRN/CRM) e, no fim, a regra clínica aplicável.

Dois estados hoje são **representáveis no código** e este ADR fixa que **não
deveriam ser**:

- **Paciente sem vínculo.** O autocadastro público de paciente
  (`POST /v1/auth/register/patient`) cria `Account` + `PatientProfile` sem
  nenhum `Bond` — nada no schema nem na aplicação impede essa conta de existir
  indefinidamente órfã.
- **Profissional atuando sem especialidade reivindicada.** O schema modela
  `ProfessionalSpecialty` (com `councilDocument`/`councilState`/`rqe`/
  `verificationStatus`), mas nenhuma rota da API cria essa linha — hoje ela só
  existe via seed de teste. Um profissional recém-cadastrado nasce sem
  nenhuma especialidade e é bloqueado ad-hoc (`ForbiddenError`) na primeira
  tentativa de convidar, não por um gate desenhado para isso.

Este ADR **fixa as regras**; a imposição em código (migração do passivo,
criação de `ProfessionalSpecialty` no cadastro, remoção do autocadastro de
paciente) vem em slices próprios, cada um com seu PR.

## Decisão

### D-135 — Paciente entra só por convite; autocadastro de paciente é removido

**Não existe autocadastro de paciente.** A conta de paciente nasce **apenas**
no aceite de convite (`POST /v1/patients/invites/accept`), que já cria
`Account` + `PatientProfile` + `Bond` de forma atômica, na mesma transação
(cobre inclusive o caso "nunca se cadastrou antes" — cria a conta ali mesmo).

O endpoint `POST /v1/auth/register/patient` (e a aba correspondente no
cadastro público) **deve ser removido**. Não há caminho de produto em que uma
conta de paciente deva existir sem, ao menos, o convite que a origina.

### D-136 — Cadastro público de profissional: dois tipos, escolhidos antes do formulário

O cadastro público oferece **dois tipos**, selecionados **antes** de abrir o
formulário: **AUTÔNOMO** e **CLÍNICA**.

**Não existe** a opção "profissional de clínica" no cadastro público — esse
perfil continua entrando exclusivamente pelo pré-cadastro/convite do módulo
`clinic` (admin convida profissional). O cadastro público nunca anexa um
profissional a um tenant `CLINIC` já existente.

### D-137 — Autônomo: conta + primeira especialidade num só passo

O cadastro do tipo **AUTÔNOMO** cria `Account` + o **primeiro**
`ProfessionalSpecialty` na mesma operação. O profissional escolhe **uma**
especialidade no signup — essa escolha determina qual rótulo de conselho o
formulário exige (CREF para Educação Física, CRN para Nutrição, CRM para
Medicina). Especialidades adicionais são reivindicadas depois, num fluxo
próprio (1 login, N papéis — D-041) — este ADR não desenha esse fluxo
posterior, só garante que a primeira nasce junto da conta.

### D-138 — Conselho obrigatório no formato; verificação de atividade é TODO(D-010)

O número do registro no conselho é **obrigatório** no cadastro do autônomo —
a conta não é criada sem ele — e é validado **apenas em formato** (padrão do
tipo de conselho + UF, D-126). A **validade/atividade real** do registro
**não é verificada** neste momento; fica como alvo futuro (TODO(D-010),
D-051).

**Palavra de força:** "obrigatório preencher" ≠ "verificado". São gates
distintos, e o segundo é **explicitamente adiado** — não implementar
verificação de conselho ativo agora, nem liberar atuação sem o conselho
**preenchido**.

### D-139 — Clínica: cadastro público cria `Tenant` CLINIC + primeiro admin

O cadastro público do tipo **CLÍNICA** cria um `Tenant` com `type: CLINIC` +
o primeiro admin dessa clínica. Hoje só existe criação de tenant `CLINIC`
pelo módulo interno (convite entre profissionais já cadastrados); este ADR
**autoriza a porta pública** de nascimento de clínica — o profissional que
está fundando a clínica não precisa de convite prévio para isso.

### D-140 — Gate mínimo para convidar/atender (autônomo)

O gate mínimo, **exigido agora**, para um profissional autônomo convidar
paciente ou iniciar atendimento é a soma de três condições:

1. E-mail verificado (D-029).
2. Termos vigentes aceitos — Termos de Uso e Política de Privacidade (D-025).
3. Especialidade reivindicada **com conselho preenchido** (D-137/D-138).

**Não exige** `verificationStatus === VERIFIED` do conselho. A evolução para
exigir conselho **ativo/verificado** é trabalho futuro (TODO(D-010)/D-051) —
registrada aqui como consequência conhecida, não como requisito do gate
atual.

### D-141 — Academia: mesma porta pública da clínica, vertical só de CREF

O cadastro público do tipo **ACADEMIA** cria um `Tenant` com `type: ACADEMIA`
+ o primeiro admin, pela **mesma porta** e com os **mesmos campos** do cadastro
de clínica (D-139): empresa com **CNPJ obrigatório**, admin pessoa física com
CPF, e o campo "Você é?" (gestor-puro / gestor que também atende). A spec de
cadastro já registrava que clínica e academia são o **mesmo cadastro de
empresa**; este ADR fixa a consequência arquitetural: **um** contrato, **uma**
transação, **um** formulário — parametrizados pela vertical.

O que a vertical decide é **quais profissões o estabelecimento comporta**:

- **Clínica:** o catálogo inteiro (Médico, Nutricionista, Educador Físico,
  Personal Trainer), e portanto a especialidade médica (D-137).
- **Academia:** **SOMENTE CREF** — Educador Físico e Personal Trainer. Médico e
  Nutricionista são **PROIBIDOS**; sem Médico, não há especialidade médica.

**Palavra de força:** a restrição é do **contrato** (`.superRefine`), rejeitada
com 400 na borda HTTP **antes** de qualquer escrita. Ela **NUNCA** deve ser
reimplementada no serviço ou no repositório: uma segunda cópia da regra pode
divergir do Zod, e aí a borda e o núcleo passariam a discordar sobre quem pode
existir numa academia.

### D-142 — Estagiário: seat supervisionado, com responsável obrigatório

O **estagiário** é um seat próprio, **distinto do profissional**: é estudante,
**não tem conselho**, e **NUNCA** se autocadastra (não aparece em seletor
algum). Entra **só por convite** da academia, no mesmo molde de duas fases do
convite de profissional (D-014/D-048), com duas diferenças que são a regra
inteira:

1. **Não informa conselho** — nem no convite, nem no aceite. Não existe o campo.
2. **Responsável OBRIGATÓRIO** — todo estagiário está vinculado a um
   profissional de **CREF** (Educador Físico ou Personal Trainer) **do próprio
   tenant**, incluindo o admin-que-atende da academia.

**Estado inválido irrepresentável:** "estagiário sem responsável" **não é**
regra de aplicação — é impedido pelo **schema**. A coluna
`supervisorProfessionalProfileId` é **NOT NULL** tanto no convite quanto no
seat, com FK `onDelete: Restrict`: o responsável não pode ser apagado por baixo
de um estagiário. O motivo é legal, não estético — estagiário atuando solto é
exercício ilegal da profissão (art. 47, DL 3.688/1941).

**Sem coluna `seatType`.** A existência da linha `intern_profile` **já é** o
fato "este seat é STUDENT_INTERN"; uma coluna de valor único criaria **duas
representações do mesmo estado** — o anti-padrão que o schema já evita em
`biologicalSex` (D-103). O rótulo `STUDENT_INTERN` vive no **DTO** da API, onde
serve para quem consome distinguir seats.

**Derivação congelada:** a capacidade do estagiário **DERIVA** do conselho ativo
do responsável — não há capacidade própria, nem cópia do CREF no seat. Se o
responsável sai ou perde o vínculo, o estagiário **perde a capacidade**. A
derivação é feita **em LEITURA** (seguindo a relação), **nunca** materializada e
**nunca** por job: materializar reintroduziria exatamente a divergência que a FK
evita. "Ativo" hoje é **conselho preenchido em formato** (D-138) — a verificação
de registro ativo de verdade segue deferida (TODO(D-010)).

> **Superado em parte por D-143:** a restrição "seat de ACADEMIA / supervisor
> CREF" abaixo valeu enquanto o produto só tinha estagiário de educação física.
> **D-143 generaliza**: o seat existe em qualquer tenant-empresa, e quem decide
> é o conselho do supervisor bater com a **área** do estagiário. Tudo o mais
> deste D-142 — responsável obrigatório NOT NULL, `onDelete: Restrict`, ausência
> de `seatType`, derivação congelada, base legal — **continua valendo integralmente**.

**Fora deste ADR — dependência de domínio:** o **fluxo de validação do trabalho
do estagiário** (produz → envia → pendente → supervisor revisa/ajusta/valida →
chega ao aluno) **não é decidido aqui**. Ele depende do domínio de
treino/prescrição, que ainda não existe. O que este ADR entrega é a
**IDENTIDADE** e o **VÍNCULO**; a validação **engancha nesse vínculo** quando o
treino for construído (ver `docs/roadmap.md`).

### D-143 — Estagiário multi-área: a área define o conselho do supervisor

O seat de estagiário (D-142) deixa de ser exclusivo de educação física em
academia e passa a valer para as **três áreas** que o produto atende. O
estagiário **continua sem conselho próprio em área nenhuma** — é estudante — e
passa a declarar uma **ÁREA**, definida **pela empresa no convite**:

| Área | Conselho exigido do responsável |
|---|---|
| `EDUCACAO_FISICA` | CREF — `TRAINING` ou `PERSONAL_TRAINER` |
| `NUTRICAO` | CRN — `NUTRITION` |
| `MEDICINA` | CRM — `MEDICINE` |

**A vertical do tenant deixa de decidir.** Quem decide é o **conselho do
responsável** bater com a área do estagiário, no **mesmo tenant**. Consequência
aceita e desejada: uma **clínica** com um CREF no quadro pode ter estagiário de
educação física; uma **academia** com um CRN, de nutrição. O tipo do tenant só
exclui `SOLO` — estagiário é seat de EMPRESA.

**Palavra de força:** o mapa área→conselhos é **UM só**, no contrato
(`SUPERVISOR_SPECIALTY_CODES_BY_AREA` em `@fitvo/validation`), porque tem dois
consumidores que **DEVEM** concordar: o servidor, que recusa supervisor fora da
área, e a UI, que só deve **oferecer** supervisores da área. Duas cópias
divergiriam, e a divergência aqui significa oferecer na tela alguém que o POST
recusa. **NUNCA** redeclarar esse mapa no repositório, no serviço ou no front.

**Onde a regra é verificada:** o Zod garante que a área veio e é válida; **não**
alcança se aquele responsável tem o conselho daquela área — isso é dado de
**outro registro**, e a checagem é no serviço **contra o banco**. Falha ali é
**422**, não 400: a requisição está bem formada e falha numa regra semântica.
Distinguir os dois importa — um 400 tornaria o erro de regra indistinguível de
erro de schema.

**Nada de D-142 regride:** responsável obrigatório (`NOT NULL` no convite e no
seat), `onDelete: Restrict`, ausência de coluna `seatType`, capacidade **derivada
em leitura** (nunca materializada, nunca por job), sem autocadastro, base legal
do art. 47. A área **acompanha** o responsável: os dois são decisão da empresa,
viajam no convite, e o estagiário não escolhe nenhum dos dois.

### D-156 — Recepção: seat administrativo por convite, sem vínculo de admin

A empresa (clínica **ou** academia) precisa de gente que opere **agenda e
cadastro** sem atender ninguém. Esse é o seat de **recepção** (spec §2/§4.5):
por convite do admin, no mesmo molde de duas fases do profissional (D-137) e do
estagiário (D-142), e **nunca** por autocadastro.

O que o distingue dos outros dois seats é o que ele **não** tem:

- **Sem conselho e sem especialidade.** Não são campos opcionais deixados em
  branco: são campos que **não existem**. Os dois qualificam quem **atende**, e
  recepção não atende — declará-los sugeriria uma capacidade clínica que este
  seat não possui.
- **Sem responsável.** A capacidade do estagiário **deriva** do conselho do
  supervisor (D-142); recepção não exerce atividade regulamentada, então não há
  o que supervisionar.
- **Sem `ClinicMembership`.** Este é o ponto não óbvio. A membership carrega um
  único papel, `CLINIC_ADMIN`; conceder uma à recepção lhe daria **poder de
  admin da empresa** — o oposto de um seat administrativo restrito. O vínculo da
  recepção com o tenant **é a própria linha** de `reception_profile`, e só ela.
- **Sem coluna `seatType`.** Mesma doutrina do `InternProfile`: a existência da
  linha já é o fato, e uma segunda representação divergiria (D-103). O rótulo
  `RECEPTION` vive no DTO.

**Nunca dado clínico.** Recepção enxerga dado **operacional** (D-015) —
anamnese, avaliação, prontuário e prescrição estão fora, por construção: sem
`ProfessionalProfile` não há caminho de leitura clínica a partir deste seat.
Quando o RBAC fino existir (hoje MVP = admin/atende/recepção — spec §8), esta é
a fronteira a preservar.

**Campos completos no aceite** (nascimento, endereço, WhatsApp — spec §4.5): a
recepcionista é pré-cadastrada por terceiro, mas preenche tudo no momento em que
já está engajada. Consequência direta: o seat nasce com o perfil **completo** e
**não** cai no gate de completar-perfil. A alternativa — pedir menos agora e
cobrar depois — troca fricção de cadastro por fricção de primeiro login, que é
pior.

## Alternativas consideradas

- **Estagiário como `ProfessionalProfile` com flag + supervisor nulável:**
  rejeitada. Um supervisor nulável torna "estagiário solto" representável no
  banco, e a regra passaria a depender de todo caminho de escrita lembrar de
  checá-la. Modelo próprio com FK NOT NULL move a garantia para o schema.
- **Coluna `seatType` em `InternProfile`:** rejeitada — valor único por tabela,
  duas representações do mesmo fato (ver D-142 e D-103).
- **Amarrar a área à vertical do tenant** (academia⇒educação física,
  clínica⇒nutrição/medicina): rejeitada em D-143. Erraria os dois casos reais —
  clínica com educador físico no quadro, academia com nutricionista — e
  duplicaria a regra de supervisão em dois eixos que teriam de ser mantidos
  coerentes. O conselho do supervisor já é a informação suficiente.
- **Derivar a área do conselho do supervisor, sem coluna:** rejeitada. Um mesmo
  profissional pode ter dois conselhos (CREF + CRN), e aí a área do estagiário
  ficaria ambígua. A área é decisão da empresa, e decisão se registra.
- **Contrato separado para o cadastro de academia:** rejeitada — duplicaria
  regra de DV, conselho condicional e aceite de termos em dois lugares que
  precisariam ser corrigidos juntos para sempre (D-141).
- **Exigir conselho `VERIFIED` já no cadastro:** rejeitada por ora — não há
  mecanismo de verificação (integração com os conselhos profissionais ou
  processo manual equivalente) e bloquearia o lançamento à espera dele.
  Adiada, não descartada — é exatamente o TODO(D-010).

## Consequências

- **Slices de implementação decorrentes** (cada um em PR próprio, fora deste
  ADR de documentação):
  (a) aceite de convite passa a ser o único caminho de criação de conta de
  paciente — `POST /v1/auth/register/patient` é removido;
  (b) cadastro público do autônomo passa a capturar especialidade + conselho
  e criar o primeiro `ProfessionalSpecialty`;
  (c) seletor de tipo (autônomo/clínica) + nascimento público de `Tenant`
  `CLINIC` no cadastro.
- **Passivo:** contas de paciente já órfãs (sem `Bond`) hoje existentes serão
  tratadas em slice de migração separado — este ADR não decide como.
- **Débito conhecido, mantido explícito:** verificação de conselho
  ativo/verificado (TODO(D-010)/D-051) segue não implementada. O gate atual
  (D-140) é deliberadamente mais fraco que a promessa final do produto.
- **Estagiário (D-142) herda esse mesmo débito, e com mais consequência:** a
  capacidade dele deriva de um conselho que hoje só é verificado em FORMATO.
  Enquanto TODO(D-010) não existir, "responsável com CREF ativo" significa, na
  prática, "responsável com CREF preenchido".
- **Fluxo de validação do trabalho do estagiário:** pendente, bloqueado pelo
  domínio de treino/prescrição. Registrado em `docs/roadmap.md`; o ponto de
  engate é a relação `InternProfile.supervisor`.
- **Clínica com estagiário:** passou a existir em **D-143** — foi exatamente o
  predicado único de elegibilidade que mudou, como previsto.
- **Áreas futuras** (fisioterapia/CREFITO, psicologia/CRP...): entram
  acrescentando uma linha ao enum `InternArea` e uma ao mapa área→conselhos.
  Nenhuma outra parte do seat precisa mudar — é o que a forma escolhida compra.
- **Recepção (D-156) não tem UI ainda:** o slice entrega API + contrato. As
  telas de convite (admin) e de aceite (recepcionista) são slice próprio,
  registrado em `docs/roadmap.md`.
- **RBAC fino continua fora do MVP** (spec §8). Hoje a fronteira "recepção nunca
  vê dado clínico" é sustentada pela FORMA — o seat não tem
  `ProfessionalProfile`, e é por ele que passa toda leitura clínica. Quando o
  sistema de permissões por papel existir, essa fronteira precisa ser
  reafirmada explicitamente, não herdada por acidente.
