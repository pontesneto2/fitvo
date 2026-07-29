# Spec — Cadastro & Onboarding (FITVO) · v2

**Status:** spec consolidada de mesa (jul/2026). Destino: `docs/spec-cadastro-onboarding.md`.
**Formaliza decisões de:** ADR-0015 (D-135→D-140), D-025 (consentimento), D-029 (verificação de e-mail), D-044 (atributos da pessoa), D-046, D-051/TODO(D-010) (verificação de conselho — deferida), D-101 (modalidade), D-138 (conselho só formato).
**Regra:** palavras de força (**obrigatório/sempre/nunca**) são contrato — não destilar/perder em resumo.

Fonte única de campos, ordem, obrigatoriedade, máscaras e regras de entrada. Agentes leem daqui; divergência do código = bug a corrigir contra esta spec.

**v2 muda em relação à v1:** papel gestor/atende condicional no cadastro de empresa; RT derivado de profissional com conselho (não do admin); fluxo de paciente menor de idade com autorização de responsável; sexo biológico + gênero + nome social separados.
**v2.1 (correção):** enum de sexo biológico alinhado ao schema Prisma real (`MALE/FEMALE/INTERSEX`, não português — a divergência foi detectada no #105); sexo biológico confirmado **completo no aceite do paciente** (MVP), não deferido para anamnese.

---

## 1. Pontos de entrada (`/cadastro`)

Seletor no topo — **três** caminhos de autocadastro:

- **Sou profissional autônomo** → cria tenant `SOLO`
- **Sou clínica** → cria tenant `CLINIC` (**CNPJ obrigatório**)
- **Sou academia** → cria tenant `ACADEMIA` (**CNPJ obrigatório**)

**Paciente/aluno NÃO aparece** — só por convite (D-135).
**Profissional de clínica/academia e recepção NÃO aparecem** — pré-cadastrados pela empresa, entram por convite.
**Estagiário NÃO aparece** — seat supervisionado, nunca autocadastro (exercício ilegal se solo — art. 47 DL 3.688/1941).

---

## 2. Modelo de tenant & seats

| Tenant | Quem cria | Documento | Dinâmica do app (fase de produto) |
|---|---|---|---|
| `SOLO` | profissional autônomo | CPF **ou** CNPJ | atende direto |
| `CLINIC` | admin (autocadastro) | **CNPJ obrigatório** | consulta/anamnese/plano (paciente) |
| `ACADEMIA` | admin (autocadastro) | **CNPJ obrigatório** | prescrição de treino (aluno mensalista) |

**Clínica e academia = cadastro de tenant idêntico** (empresa). Difere só na vertical e na dinâmica do app pós-login (o cadastro não conhece a dinâmica).

**Papel do admin — campo "Você é?" no cadastro da empresa (D-novo):**
- **Só gestor** → gerencia o tenant, adiciona profissionais/professores, **não atende** aluno/paciente, **não informa conselho**.
- **Gestor que também atende** (gestor/profissional ou gestor/professor) → abre condicionalmente os campos de **profissão + conselho + UF** (+ especialidade médica se médico). Vira profissional-que-atende **no mesmo cadastro**.

Regra ampla e segura: o gestor-puro nunca precisa de conselho; quem atende sempre informa. O admin adiciona os demais profissionais depois (por convite).

**Seats no MVP (todos entram):**
- **Admin/gestor** — gerencia; atende **só se** marcou "também atende".
- **Profissional que atende** — especialidade + conselho; acessa bond/atendimento.
- **Recepção** — por convite do admin, **sem conselho/especialidade**, **não atende**; acesso administrativo (agenda/cadastro), **nunca dado clínico**.

**Responsável Técnico (RT):** exigência sanitária/CONFEF — **DEVE ser um profissional com conselho ativo** no tenant. Portanto **NÃO é campo do cadastro da empresa** e **NUNCA** defaulta pro admin gestor-puro. O RT é **derivado**: atribuído entre os profissionais-que-atendem do tenant (o próprio admin, se marcou "também atende"; ou outro profissional adicionado). Enquanto não houver profissional com conselho, RT fica pendente. *(Atribuição de RT = etapa pós-cadastro / slice próprio.)*

**1 login, N papéis, N vínculos:** uma conta pode ter múltiplos vínculos e papéis. Pós-login há **seletor de ambiente/vínculo** (context switcher) que some quando só há um.

---

## 3. Convenções globais

- **Armazenar só dígitos, mascarar na UI** (CPF/CNPJ/CEP/WhatsApp).
- **CPF-xor-CNPJ + dígito verificador** (`.superRefine`): comprimento e DV batem com `documentType` (CPF=11, CNPJ=14).
- **CEP → ViaCEP** no blur: preenche logradouro/bairro/cidade/UF; número/complemento manuais; país fixo `BR`; CEP inválido não trava (permite manual).
- **Endereço = colunas inline** `address*` (mesmo padrão do `Tenant`; nomes uniformes entre `Account` e `Tenant`). Não criar tabela `Address`.
- **Senha:** gate servidor = **mín. 8 + ≥1 letra + ≥1 número**. UI: confirmar-senha (só front) + medidor (fraca/média/forte).
- **Aceites por último**, desmarcados, `literal(true)`; gravados como `TermsAcceptanceEvent` **na mesma transação**, **só no ramo de conta nova** (D-025), com IP/user-agent.
- **Conselho: só formato** (D-138); verificação de registro ativo **deferida** (TODO(D-010)). "Obrigatório preencher" **≠** "verificado".
- **Recebimento (Asaas) NÃO é campo de cadastro** — processo documental separado, pós-cadastro.
- **Nome comercial / foto / Instagram** → edição de perfil, fora do cadastro.

### 3.1 Identidade sensível — sexo, gênero, nome social (todos os forms de pessoa)

Área sensível (LGPD) — modelar com cuidado, **três campos distintos**:

- **Sexo biológico** (`biologicalSex`): enum `MALE` / `FEMALE` / `INTERSEX` (valores em inglês, alinhados ao schema Prisma já existente — **não** usar rótulos em português no enum; a tradução pt-BR é só de UI). **Obrigatório para paciente, capturado no aceite do convite** (completo no MVP, não deferido para anamnese) — variável fisiológica, base de cálculo metabólico/dosagem/faixas de referência em nutri e medicina. Não capturado para profissional (não se calcula nada dele).
- **Gênero / identidade** (`gender`): enum inclusivo — `MULHER_CIS`, `HOMEM_CIS`, `MULHER_TRANS`, `HOMEM_TRANS`, `NAO_BINARIO`, `OUTRO`, `PREFIRO_NAO_INFORMAR`. **Opcional, todos os forms.**
- **Nome social** (`socialName`): texto livre, **opcional, em TODOS os forms** (Decreto 8.727/2016). **Regra de exibição:** quando preenchido, o app exibe o nome social no lugar do nome civil em toda a interface; nome civil fica restrito a documento/fiscal.

Racional: sexo biológico e gênero servem a propósitos diferentes (cálculo clínico vs. respeito à identidade) — um campo só forçaria escolher entre acertar o cálculo e respeitar a pessoa. Separados, resolvem ambos.

---

## 4. Mapa de campos por cadastro

Legenda: **●** obrigatório · **◐** condicional · **○** opcional · *(deriva)* sistema.

### 4.1 Profissional autônomo — tenant `SOLO`

| # | Campo | Obrig. | Máscara/tipo | Nota |
|---|---|---|---|---|
| 1 | Profissão | ● | select | Médico / Nutricionista / Educador Físico / Personal Trainer. **Sem estagiário.** |
| 2 | Nº do conselho | ● | texto | rótulo CREF/CRN/CRM deriva da profissão; só formato |
| 3 | UF do conselho | ● | select (27 UFs) | — |
| 4 | Tipo de documento | ● | CPF/CNPJ | autônomo pode PF ou PJ |
| 5 | CPF ou CNPJ | ● | máscara conforme tipo | DV real + xor |
| 6 | Nome completo (civil) | ● | texto | `tenant.name` deriva deste nome |
| 7 | Nome social | ○ | texto | exibido no lugar do civil quando preenchido |
| 8 | E-mail | ● | e-mail | — |
| 9 | Senha | ● | oculto | 8+letra+número; confirmar (UI); medidor |
| 10 | WhatsApp | ● | `(00) 00000-0000` | 11 dígitos |
| 11 | Data de nascimento | ● | `00/00/0000` | ≥ 18 |
| 12 | Gênero | ○ | select inclusivo | §3.1 |
| 13 | Endereço | ● | CEP `00000-000` → auto; número ● ; compl. ○ ; país `BR` | ViaCEP |
| 14 | Aceite Termos + Política | ● | checkbox ×2 | `literal(true)` |

**Cria:** `Tenant(SOLO, name derivado)` + `Account` + `ProfessionalProfile` + `ProfessionalSpecialty` + 2× `TermsAcceptanceEvent` — em transação.
Autônomo médico informa **só a inscrição** (especialidade fina é exclusiva do fluxo de clínica).

### 4.2 Clínica (`CLINIC`) · 4.3 Academia (`ACADEMIA`) — cadastro idêntico

| # | Campo | Obrig. | Nota |
|---|---|---|---|
| 1 | Razão social | ● | — |
| 2 | Nome fantasia | ● | — |
| 3 | CNPJ | ● | **só CNPJ** · DV real |
| 4 | E-mail da empresa | ● | — |
| 5 | Telefone/WhatsApp da empresa | ● | — |
| 6 | Endereço do estabelecimento | ● | CEP puxa · da empresa, não pessoal |
| 7 | Especialidades oferecidas | ○ | multi-select (MVP) |
| 8 | Nº de profissionais previsto | ○ | dimensiona seats (MVP) |
| — | **Admin (gestor):** | | |
| 9 | **"Você é?"** | ● | **Só gestor** / **Gestor que também atende** |
| 10 | Nome civil + nome social(○) | ● | — |
| 11 | E-mail, senha, WhatsApp | ● | senha 8+letra+número + confirmar + medidor |
| 12 | Data de nascimento | ● | ≥ 18 |
| 13 | Gênero | ○ | §3.1 |
| 14 | **Profissão + conselho + UF** | ◐ | **abre SÓ se "também atende"**; + especialidade médica (Nutrologia/Endocrinologia) se médico |
| 15 | Aceite Termos + Política | ● | `literal(true)` ×2 |

**Cria:** `Tenant(CLINIC\|ACADEMIA)` + `Account`(admin) + vínculo de admin (+ `ProfessionalProfile`/`ProfessionalSpecialty` **se** "também atende") + 2× `TermsAcceptanceEvent`.
**RT:** derivado de profissional com conselho (§2) — não é campo aqui.
**Recebimento (Asaas):** fora do cadastro.

### 4.4 Profissional de clínica/academia — por convite (2 fases)
**Fase A — admin pré-cadastra:**

| Campo | Obrig. | Nota |
|---|---|---|
| E-mail | ● | destino do convite |
| Profissão (SpecialtyCode) | ● | a empresa define |
| Nº conselho + UF | ● | a empresa define; só formato |
| Especialidade médica | ◐ | **obrigatória sse Médico**; MVP **APENAS Nutrologia, Endocrinologia**; proibida nas demais (`.superRefine`) |
| Nome, WhatsApp | ○ | facilita o convite |

→ e-mail explicativo + link de aceite.

**Fase B — profissional aceita e completa:**

| Campo | Obrig. | Nota |
|---|---|---|
| Senha | ● | 8+letra+número + confirmar + medidor |
| Nome civil + nome social(○) | ● | — |
| Documento (CPF/CNPJ) | ● | DV real |
| Data de nascimento | ● | — |
| Gênero | ○ | §3.1 |
| Endereço completo | ● | CEP puxa |
| WhatsApp (se não veio) | ● | — |
| Aceite Termos + Política | ● | `literal(true)` ×2 (corrigido em #102) |
| Recebimento próprio | ✗ | não tem — empresa repassa |

**Cria:** `ProfessionalProfile`(tenant da empresa) + `ProfessionalSpecialty`(do convite, incl. especialidade médica) + `Account` se nova + 2× `TermsAcceptanceEvent` (só nova). **Vê o gate de completar-perfil** (§5). Corrigido em **#102**.

### 4.5 Recepção — seat administrativo, por convite do admin (D-156)

**NUNCA** aparece em seletor: recepção é pré-cadastrada pela empresa (clínica **ou** academia), no mesmo molde de duas fases do §4.4, **sem** profissão, conselho, especialidade **nem responsável** — não são campos vazios, são campos que **não existem**. Os três primeiros qualificam quem **atende**; o quarto (§4.8) existe porque a capacidade do estagiário deriva do conselho do supervisor. Recepção não atende e não exerce atividade regulamentada.

**NUNCA dado clínico.** Acesso administrativo (agenda/cadastro) — dado operacional (D-015). Anamnese, avaliação, prontuário e prescrição estão fora **por construção**: sem `ProfessionalProfile` não há caminho de leitura clínica a partir deste seat.

**Sem `ClinicMembership`:** a membership carrega um papel só, `CLINIC_ADMIN` — concedê-la à recepção daria **poder de admin da empresa**. O vínculo com o tenant **é a linha** de `reception_profile`. Sem coluna `seatType` (a existência da linha já é o fato — D-103); o rótulo `RECEPTION` vive no DTO.

**Fase A — o admin pré-cadastra:**

| Campo | Obrig. | Nota |
|---|---|---|
| E-mail | ● | destino do convite |
| Nome | ○ | facilita o convite; o civil vem no aceite |
| Profissão / conselho / especialidade / responsável | ✗ | **não existem** para recepção |

**Fase B — a recepcionista aceita e completa:**

| Campo | Obrig. | Nota |
|---|---|---|
| Senha | ● | 8+letra+número + confirmar + medidor |
| Nome civil + nome social(○) | ● | §3.1 |
| Documento (CPF/CNPJ) | ● | DV real + xor |
| Data de nascimento | ● | — |
| Gênero | ○ | §3.1 |
| Endereço completo | ● | CEP puxa |
| WhatsApp | ● | — |
| Aceite Termos + Política | ● | `literal(true)` ×2, gravado **só** em conta nova |
| Sexo biológico | ✗ | é base de cálculo clínico de **paciente** (§3.1); de recepção não se calcula nada |

**Cria:** `ReceptionProfile`(tenant da empresa) + `Account` se nova + 2× `TermsAcceptanceEvent` (só nova). **NÃO** cria `ProfessionalProfile` nem `ClinicMembership`.

**Campos completos ⇒ NÃO vê o gate (§5).** A recepcionista é pré-cadastrada por terceiro, mas preenche nascimento/endereço/WhatsApp no próprio aceite — nasce com perfil completo. Pedir menos agora e cobrar depois trocaria fricção de cadastro por fricção de primeiro login, que é pior.

### 4.6 Paciente / Aluno — por convite (preenche tudo no aceite)

| Campo | Obrig. | Nota |
|---|---|---|
| E-mail | ● | *(vem do convite)* |
| Nome civil | ● | — |
| Nome social | ○ | exibido no lugar do civil |
| Senha | ● | 8+letra+número + confirmar + medidor |
| CPF | ● | **exatamente 11** · DV real |
| WhatsApp | ● | — |
| Data de nascimento | ● | base de cálculo clínico; **gatilha fluxo de menor (§4.7)** |
| Sexo biológico | ● | §3.1 · enum MALE/FEMALE/INTERSEX · **completo no aceite (MVP), não vai pra anamnese** |
| Gênero | ○ | §3.1 |
| Endereço completo | ● | CEP puxa · residencial |
| Aceite Termos + Política | ● | gravado no aceite (D-135, #97) |

**Cria:** `Bond` sempre; + `Account` + `PatientProfile` + 2× `TermsAcceptanceEvent` (só nova). `Bond` nasce com `modality`/`specialtyId`/`professionalProfileId`/`tenantId` do **convite** (D-101).
**Paciente entra completo → NÃO vê o gate (§5).**

### 4.7 Paciente menor de idade — autorização de responsável (LGPD Art. 14)
Se `birthDate` < 18 no aceite, o fluxo **DEVE** capturar e **armazenar como prova**:

| Campo | Obrig. | Nota |
|---|---|---|
| Nome do responsável legal | ● | — |
| CPF do responsável | ● | DV real |
| Parentesco/relação | ● | mãe/pai/tutor/etc. |
| Contato do responsável (e-mail/WhatsApp) | ● | — |
| **Autorização expressa do responsável** | ● | consentimento do responsável pelo tratamento de dado do menor |

**Armazenamento:** evento **append-only, imutável**, com timestamp + IP + user-agent (mesmo padrão probatório do `TermsAcceptanceEvent`) — a autorização fica registrada e recuperável no sistema. Menor **não** consente sozinho; o consentimento válido é o do responsável.
*(Implementação = slice próprio do fluxo de paciente; não é o slice de cadastro de profissional em curso.)*

### 4.8 Estagiário — seat supervisionado, por convite (D-142/D-143)

**NUNCA** aparece em seletor: estagiário **não se autocadastra** (§1/§6). É
pré-cadastrado pela empresa (clínica **ou** academia), no mesmo molde de duas
fases do §4.4, com três diferenças que são a regra legal inteira:

1. **NÃO informa conselho** — é estudante, em **qualquer** área. Não há campo.
2. **Declara uma ÁREA**, definida pela empresa: `EDUCACAO_FISICA` | `NUTRICAO` |
   `MEDICINA`. A área determina **qual conselho o responsável precisa ter**.
3. **Responsável OBRIGATÓRIO** — profissional **do próprio tenant** cujo conselho
   corresponde à área, incluindo o admin-que-atende.

| Área | Conselho exigido do responsável |
|---|---|
| `EDUCACAO_FISICA` | **CREF** (Educador Físico ou Personal Trainer) |
| `NUTRICAO` | **CRN** (Nutricionista) |
| `MEDICINA` | **CRM** (Médico) |

**A vertical do tenant NÃO decide** (D-143) — quem decide é o conselho do
responsável. Uma **clínica** com um CREF no quadro pode ter estagiário de
educação física; uma **academia** com um CRN, de nutrição. Só `SOLO` fica de
fora: estagiário é seat de **empresa**.

**Fase A — a academia pré-cadastra:**

| Campo | Obrig. | Nota |
|---|---|---|
| E-mail | ● | destino do convite |
| **Área** | ● | `EDUCACAO_FISICA` \| `NUTRICAO` \| `MEDICINA`; define o conselho exigido |
| **Responsável** | ● | seleciona entre os elegíveis **daquela área** no tenant; **sem ele não há convite** |
| Nome | ○ | facilita o convite; o civil vem no aceite |
| Profissão / conselho / especialidade | ✗ | **não existem** para estagiário |

**Fase B — o estagiário aceita e completa:**

| Campo | Obrig. | Nota |
|---|---|---|
| Senha | ● | 8+letra+número |
| Nome civil + nome social(○) | ● | §3.1 |
| Documento (CPF/CNPJ) | ● | DV real + xor |
| Data de nascimento | ● | — |
| Gênero | ○ | §3.1 |
| Endereço completo | ● | CEP puxa |
| WhatsApp | ● | — |
| Aceite Termos + Política | ● | `literal(true)` ×2, gravado **só** em conta nova |
| **Área e Responsável** | ✗ | vêm do CONVITE — o estagiário **não escolhe** nem a área nem quem o supervisiona |

**Cria:** `InternProfile`(tenant da empresa + área + responsável) + `Account` se nova
+ 2× `TermsAcceptanceEvent` (só nova). **NÃO** cria `ProfessionalProfile`:
estagiário não é profissional.

**Estado inválido irrepresentável:** o responsável é **NOT NULL** no convite e
no seat, com FK `Restrict` — não há caminho, nem pelo código nem por SQL direto,
que produza um estagiário solto. A **área** também é `NOT NULL`, sem default: um
INSERT que a esquecesse falharia, em vez de gravar uma área errada em silêncio.
A coerência **área × conselho do responsável** é checada no servidor **contra o
banco** (é dado de outro registro) e responde **422**, não 400. **Sem coluna `seatType`**: a existência da linha
já é o fato; o rótulo `STUDENT_INTERN` vive no DTO.

**Derivação congelada:** a capacidade do estagiário **DERIVA** do conselho ativo
do responsável, **em leitura** — responsável sai, estagiário perde capacidade.
Nunca materializada, nunca por job.

> **Fora desta spec — o FLUXO DE VALIDAÇÃO do trabalho do estagiário**
> (produz → envia → pendente → supervisor revisa/ajusta/valida → chega ao aluno)
> depende do domínio de **treino/prescrição**, que ainda não existe. Este slice
> entrega **identidade + vínculo**; a validação engancha no vínculo depois. Ver
> `docs/roadmap.md`.

---

## 5. Gate de completar-perfil (pós-login)

**Vê o gate:** **apenas** pré-cadastrados por terceiro com dados faltando — hoje, o **profissional de clínica/academia** (§4.4). Ao logar, se faltar `birthDate`/endereço/WhatsApp, a primeira tela é completar dados, com o app **bloqueado** até completar.

**NÃO vê o gate (entram completos):** autônomo, admin de clínica/academia, paciente/aluno, **estagiário** (§4.8) e **recepção** (§4.5) — os dois últimos preenchem nascimento/endereço/WhatsApp no próprio aceite.

> **A regra é sobre DADO, não sobre papel.** Quem vê o gate não é uma lista de seats mantida à mão — é quem, de fato, está sem os campos. Cada fluxo de criação decide, pelo que coleta, se a conta nasce completa; a lista acima é **consequência** disso, não uma segunda fonte de verdade a manter em dia. Um seat novo que colete tudo simplesmente nunca aparece no gate, sem que ninguém precise lembrar de atualizar esta seção.

Gate estreito (só convidados-por-terceiro). FITVO **trava** (garante dado antes do uso); iClinic apenas sinaliza — escolha consciente pela trava.

---

## 6. Log de decisões (palavras de força)

- **NUNCA** autocadastro de paciente — só convite (D-135).
- **NUNCA** estagiário por autocadastro — seat supervisionado; capacidade **deriva** do conselho ativo do supervisor. Responsável é **NOT NULL** no schema: estagiário solto é irrepresentável, não "validado" (D-142, §4.8).
- Estagiário **NUNCA** tem conselho próprio, em **NENHUMA** área — declara uma **ÁREA**, e a área define o conselho exigido do responsável (D-143). O mapa área→conselho é **UM só**, no contrato.
- Academia **SEMPRE** só profissões de **CREF** — Médico e Nutricionista **PROIBIDOS**; sem Médico, **nunca** há especialidade médica (D-141).
- **SEMPRE** gravar consentimento (D-025) na mesma transação, só no ramo de conta nova.
- Recepção **NUNCA** tem conselho, especialidade ou responsável, e **NUNCA** acessa dado clínico. **NUNCA** recebe `ClinicMembership` — a membership só carrega `CLINIC_ADMIN`, e dá-la à recepção seria dar poder de admin (D-156).
- Clínica/academia **SEMPRE** CNPJ. Autônomo CPF ou CNPJ.
- Admin de empresa: campo **"Você é?"** — gestor-puro **NÃO** informa conselho; "também atende" abre conselho condicionalmente.
- **RT SEMPRE** é profissional com conselho ativo — **NUNCA** gestor-puro; é derivado, não campo do cadastro.
- Especialidade médica (Nutrologia/Endocrinologia) **SÓ** no fluxo de clínica, **obrigatória sse médico**, **APENAS essas duas** no MVP. Autônomo médico informa só a inscrição.
- Conselho **SEMPRE** só formato agora; verificação de ativo **deferida** (TODO(D-010)).
- Recebimento **NUNCA** no cadastro.
- Senha **SEMPRE** ≥ 8 + letra + número.
- Documento **SEMPRE** DV real + xor; só dígitos.
- Paciente menor **SEMPRE** exige autorização de responsável armazenada como prova (Art. 14).
- **Sexo biológico ≠ gênero** — campos distintos; **nome social** disponível em **todo** form (Decreto 8.727/2016).

---

## 7. Estado de implementação (jul/2026)

| Item | Estado |
|---|---|
| Paciente: autocadastro removido + termos no aceite | ✅ #97 |
| Autônomo: especialidade/conselho + catálogo + Personal Trainer | ✅ #98 |
| Clínica: convite/aceite com termos + especialidade + `medicalSpecialty` | ✅ #102 |
| Autônomo: campos completos (WhatsApp, nascimento, endereço, senha, CPF-xor-CNPJ, remover tenantName) | 🔄 em implementação |
| Nome social / gênero / sexo biológico (nos forms) | ⬜ incluir nos slices respectivos |
| Cadastro público de clínica (seletor + "Você é?" + tenant CLINIC) | ✅ #108 |
| Cadastro público de academia (reusa clínica; só CREF) | ✅ D-141 |
| Estagiário: seat supervisionado + vínculo obrigatório ao responsável | ✅ D-142 (API/contrato; UI em slice próprio) |
| Estagiário multi-área (ed. física / nutrição / medicina), em clínica ou academia | ✅ D-143 |
| Fluxo de validação do trabalho do estagiário | ⏸ bloqueado no domínio de treino |
| Gate de completar-perfil | ⬜ depois de clínica |
| Recepção (seat administrativo por convite) | ✅ D-156 (API/contrato; UI em slice próprio) |
| Paciente menor + autorização de responsável | ⬜ slice do fluxo de paciente |
| Atribuição de RT (derivado) | ⬜ pós-cadastro |
| Verificação de conselho ativo | ⏸ deferido — TODO(D-010) |

---

## 8. Fora de escopo / deferido

Recebimento/Asaas (processo separado) · nome comercial/foto/Instagram (perfil) · verificação de conselho ativo (TODO(D-010)) · detecção de conta duplicada no cadastro ("adicionar papel?" — Doctoralia, não-MVP) · sistema completo de permissões por papel (MVP = admin/atende/recepção) · dinâmica do app por vertical (agenda/prescrição/atendimento — slices de produto pós-cadastro) · razão social de autônomo-PJ.
