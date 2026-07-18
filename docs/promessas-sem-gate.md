# Promessas sem gate — inventário

> O tamanho real do buraco entre **o que o projeto DIZ que é** (asserções nos ADRs)
> e **o que ele PROVA ser** (checks que reprovam se a asserção for violada). Sem
> corrigir — só o mapa. Nasceu do achado do `forwardRef` (#68): uma promessa
> implícita do design system que **227 testes verdes não pegavam**, porque testavam
> a coisa certa (render/variantes) e não o caso de uso real. Toda promessa sem
> âncora é um `forwardRef` esperando um consumidor.
>
> **Disciplina de repo público:** este é um mapa ARQUITETURAL (cobertura de gate por
> classe de invariante). Nada de `file:line` de omissão explorável nem PoC — o
> detalhe acionável de segurança vive no relatório privado de hardening (D-033,
> ver PR #69), não aqui.

## Categorias

- ✅ **Gateado** — há check que **reprova** se a promessa for violada: teste com
  âncora, constraint no banco, ou tipo que torna o estado inválido irrepresentável.
- 🟡 **Parcial** — o gate existe mas tem furo conhecido, ou cobre só parte da classe.
- 🔴 **Sem gate (dívida)** — ninguém fez o check; a promessa vive de **disciplina**.
  Um violador novo compila, roda e não é pego.
- ⚪ **Impossível de gatear** — é **natureza**, não dívida (UX, design, julgamento de
  arquitetura). Não há check possível; o importante é distinguir do 🔴.

**Prioridade dentro de 🔴/🟡:** SEGURANÇA · DINHEIRO · ISOLAMENTO DE TENANT primeiro.
Uma promessa de UX sem gate é cosmética; "isolado por tenant" sem gate é vazamento
entre clientes esperando acontecer.

> **Escopo desta passada (honesto):** primeira varredura, focada nos invariantes de
> alto valor. Os ✅ estruturais são AMOSTRA, não exaustivo (há ~120 asserções
> candidatas nos 14 ADRs). Os itens marcados **AUDITAR** não foram confirmados nesta
> passada — precisam de leitura funcional do caminho de acesso. Um segundo passe
> cobre os candidatos um a um.

---

## 🔴 Sem gate — o mais caro primeiro

### 1. Isolamento de tenant — "nenhuma query sem escopo de tenant" (D-002, ADR-0001)

- **Promessa:** toda query escopada por tenant. Risco explícito no ADR-0001:
  *"vazamento entre tenants"*. Inegociável no CLAUDE.md.
- **Realidade:** **não há repository base que force o `tenantId`.** Cada repositório
  escopa à mão (`where: { …, tenantId }`). Há flow-tests em alguns módulos
  (patient, clinic, billing, consent), mas uma query nova — num repo novo ou num
  método novo — que **omita** o escopo compila, roda e **não é pega** por nada, a
  menos que alguém escreva um teste específico para ela.
- **Por que é o nº 1:** é o invariante mais importante do projeto e o que mais dói
  se falhar (dado de um cliente aparecendo para outro). O "gate" é disciplina +
  cobertura pontual, não uma trava estrutural.
- **Candidato a gate:** base de repositório que EXIJA o escopo de tenant no tipo
  (impossível chamar sem ele), ou uma bateria que, por repositório, prove que uma
  consulta cross-tenant volta vazia. Difícil — e é o buraco mais caro.

### 2. "Segredo/token nunca em log" — PARCIAL, e **já vazou uma vez** (ADR-0002/0005/0010)

- **Promessa:** segredos (tokens, credenciais) nunca em log.
- **Gate atual:** o logger redige por **nome de chave** (`token`, `accessToken`,
  `refreshToken`, `authorization`, `secret`, e `*.chave`).
- **Furo:** a redação é por CHAVE. Um token embutido em **mensagem**, em **URL**, ou
  sob uma chave **não listada** escapa — foi exatamente o que o **#63** corrigiu (o
  token de reset/verificação vazando). O fix foi pontual; **não há teste de
  regressão** que rode os fluxos sensíveis e afirme que o VALOR de nenhum token
  emitido aparece no output. O gate pega o caso fácil, não a classe.
- **Por que importa:** repo PÚBLICO, produto de saúde e financeiro. Token em log é
  comprometimento — e já passou uma vez sem o gate perceber.
- **Candidato a gate:** teste que capture o log dos fluxos de auth e reprove se
  contiver o valor de qualquer token emitido (redação/asserção por **valor**, não só
  por chave). Detalhe acionável → D-033 (privado).

---

## 🟡 Parcial — alto valor

### 3. "Dinheiro sempre inteiro em centavos, nunca float" (D-069, ADR-0004/0006/0009)

- **Gate:** as colunas de dinheiro são `Int` no schema (`amountCents`, `priceCents`,
  `platformFeeCents`…) — o banco recusa float ali. Grandezas de treino idem (D-089).
- **Furo:** **não há tipo nominal** (`Cents`/`Money` branded) nem lint contra
  aritmética float. Nada impede adicionar uma coluna `Float`, dividir centavos em
  `number` e perder precisão em memória, ou fazer conta de dinheiro fora das colunas
  declaradas. A trava está no ARMAZENAMENTO das colunas existentes, não na classe.
- **Por que importa:** move dinheiro de terceiros (split Asaas). Erro de centavo é
  dinheiro real.
- **Candidato a gate:** branded type `Cents` nas fronteiras + testes de propriedade
  nas funções de split/preço.

---

## 🟡 AUDITAR — não confirmado nesta passada (potencial 🔴 de alto valor)

### 4. "Admin puro nunca acessa dado clínico" (D-015, ADR-0003/0010)

- Existe RBAC (`CLINIC_ADMIN`, guards em `auth-context`, serviço de clínica). **Não
  confirmei** um teste que PROVE que um admin puro é **recusado** num endpoint
  clínico (anamnese/avaliação/prontuário/atendimento). Se não existe, é 🔴 de alto
  valor (LGPD, sigilo médico). **Auditar o caminho de acesso, não só o de papel.**

### 5. "Compartilhamento só com consentimento do paciente" (D-016, ADR-0003)

- `consent-flow.test` cobre conceder/revogar. **Não confirmei** que o caminho de
  **LEITURA** de dado compartilhado checa o consentimento vigente (vs. só testar o
  ato de conceder). Se a leitura não valida, a promessa é cosmética. **Auditar.**
  Alto valor (LGPD).

---

## ✅ Gateado (amostra)

Os invariantes "estado inválido irrepresentável" do projeto, em geral, **têm** gate —
é o tipo que faz o trabalho:

- **Estados por enum / coluna tipada** (D-081/D-093/D-103/D-011): `Weekday`,
  `SetTechnique`, `BiologicalSex`, `CareModality`, autoria por seção da anamnese —
  o schema torna o estado inválido irrepresentável. Gate = o tipo.
- **Idempotência financeira** (D-035): `idempotencyKey @unique` — o banco reprova a
  duplicata.
- **`EXCLUDE` da agenda** (ADR-0012): invisível ao drift, MAS com **teste obrigatório**
  de compensação — o padrão "não deixe promessa sem demonstração" já aplicado.
- **`forwardRef` dos controles** (#68): teste por controle que reprova sem o ref.
- **Datas em UTC** (D-067/D-111): `timestamptz` + `USING … AT TIME ZONE 'UTC'` na
  migração (a asserção virou a própria migração).

## ⚪ Impossível de gatear (natureza, não dívida)

- **"Visual autoral, não genérico"** (design-system §1) — decisão de UX.
- **"Simplicidade > Manutenibilidade > Escalabilidade > …"** (prioridade de decisão)
  — julgamento, não check.
- **"DDD só onde faz sentido, não por obrigação"** — critério humano.
- **"Nunca inventar regra de negócio — propor e aguardar"** — processo, não trava.

Estas não são dívida: gatear seria inventar um check que não existe. Registrá-las é
o ponto — para não confundir "sem gate porque ninguém fez" com "sem gate porque não
dá".

---

## Leitura do mapa

O buraco não está nos "irrepresentável" estruturais (o schema os cobre bem) — está
nos invariantes **transversais** que dependem de disciplina em todo lugar: escopo de
tenant, segredo fora do log, dinheiro inteiro, admin fora do clínico, consentimento
no acesso. São os que uma suíte de testes de unidade **não** pega, porque o defeito
mora na integração, não no componente. É a mesma lição do `forwardRef`, em escala de
arquitetura: **consumidor real e teste de integração são os únicos que pegam esta
classe.** Cada 🔴/🟡 acima é candidato a PR próprio — nenhum foi corrigido aqui.
