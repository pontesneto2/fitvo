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
- **O gate (D-093) é satisfeito independentemente de quem preencheu.** O gate
  exige que a anamnese esteja respondida, não que o paciente a tenha respondido.

**Permanece válido do D-094:** uma anamnese por vínculo; documento do prontuário,
nunca compartilhado automaticamente (D-016); autopreenchimento dos dados
evidentes com edição; e a exceção do e-mail (troca só por código verificado).

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

- O paciente **marca que consumiu a refeição**, com comentário opcional. O
  nutricionista vê em **tempo real**.
- É o **irmão exato** da execução de treino (D-086): prescrição → execução →
  aderência → indicador. A simetria é deliberada — mesma mecânica, outro domínio.
- **Conta como check-in**, igual à conclusão de treino (D-086).
- Alimenta o **indicador de aderência ao plano alimentar** ("cumpriu 80% essa
  semana"), espelhando os indicadores de treino (D-092).
- **Entra no escopo de sync offline** (D-099), junto com as execuções.

## Impacto de modelagem

Sinalizado para decisão de sequenciamento — **nada implementado por este ADR**.

1. **`Bond` ganha modalidade** (D-101): enum `ONLINE`/`PRESENCIAL`/`HIBRIDO`. Em
   aberto: **quem a define e quando** — o vínculo nasce do aceite do convite
   (D-006/D-055), então a modalidade precisaria ser escolhida pelo profissional
   **no convite** e carregada para o vínculo, ou definida após a criação. E se
   ela **muda** ao longo do tempo (paciente migra de presencial para online), é
   edição do vínculo ou dado histórico? Não decidido — não inventar.
2. **`Anamnesis.detail Json?` morre** (D-103): a taxonomia existe, então a
   anamnese vira **colunas tipadas**, como o treino (ADR-0009). A estrutura
   núcleo + módulo mapeia naturalmente para um registro de núcleo + registros de
   módulo por especialidade; listas (medicamentos com posologia, alergias,
   cirurgias, lesões, R24h) pedem **entidades filhas**, não arrays de texto.
3. **Autoria (D-102) é o ponto mais difícil da modelagem.** "Quem preencheu cada
   **parte**" exige decidir a **granularidade**: por seção/bloco (barato, e
   provavelmente suficiente para o peso jurídico — "histórico: declarado pelo
   paciente" × "adipometria: aferida pelo profissional") ou por campo (caro:
   dobra o schema ou exige tabela de auditoria). Recomendação a discutir na fase
   de modelagem — não decidir aqui.
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
