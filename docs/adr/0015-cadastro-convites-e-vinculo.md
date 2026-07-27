# ADR-0015 — Cadastro, Convite e Vínculo

**Status:** Aceito
**Decisões cobertas:** D-135 a D-140
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

## Alternativas consideradas

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
