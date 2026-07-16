# ADR-0012 — Agenda e Agendamento

**Status:** Aceito
**Decisões cobertas:** D-106 a D-111

## Contexto

O fluxo de **nutrição e medicina começa no agendamento** — não é fase futura. A
consulta é o momento em que a anamnese presencial acontece (D-101/D-102,
ADR-0011); sem agenda, o produto não tem porta de entrada nessas especialidades.

A pesquisa competitiva confirma que agenda é núcleo, não acessório: o WebDiet
expõe estatísticas de consultas realizadas, confirmadas e desmarcações; o Nutrium
tem lembrete configurável em dias/horas para evitar falta.

**O risco que define este ADR:** *agenda pela metade é pior que agenda nenhuma.*
Se o profissional não confia, ele mantém o Google Calendar como fonte da verdade,
o FITVO fica com dado velho, e o resultado é **overbooking — com a culpa recaindo
sobre o FITVO**. Uma agenda em que não se confia não é uma feature incompleta: é
um passivo.

## Decisão

### D-106 — Motor de agenda próprio

- Agenda com **banco e motor próprios**: disponibilidade, detecção de conflito,
  criação de agendamento.
- **Não forkar o Cal.com.** Ele usa exatamente a nossa stack (Next.js, Prisma,
  PostgreSQL) e é tentador, mas o core é **AGPL-3.0** — licença copyleft que
  exigiria **abrir o FITVO inteiro** ou comprar licença comercial. É armadilha
  para SaaS proprietário, e o custo aparece tarde demais para voltar atrás.

### D-107 — Sincronização com Google Calendar (3 peças, escopo delimitado)

**Princípio:** o profissional precisa ter **um lugar só para olhar**. "Depende"
= produto perdido.

- **Peça 1 — o FITVO é a fonte da verdade** dos agendamentos do FITVO. Toda
  consulta marcada nasce aqui.
- **Peça 2 — todo agendamento do FITVO aparece no Google do profissional**
  (direção FITVO → Google, automática). Mata o problema das "duas agendas": ele
  continua olhando o Google se quiser e **vê tudo**. O FITVO **alimenta o hábito
  existente** em vez de exigir mudança de hábito.
- **Peça 3 — o FITVO lê os horários OCUPADOS do Google** (free/busy). Evita o
  overbooking inverso: compromisso pessoal no Google **bloqueia** o horário no
  FITVO.

**Usar o endpoint free/busy, não sincronização de eventos completos:**
- devolve só blocos ocupados, **sem detalhe do evento**;
- mais simples que sync de campos;
- **mais privado**: o FITVO nunca vê "consulta com o psiquiatra", só "ocupado
  15h–16h". Mesmo princípio do Calendly, que nunca expõe o conteúdo do calendário
  ao convidado.

**Mecânica:** push notifications do Google (webhook) — o Google avisa em 1–2s ao
criar/editar/apagar; buscar só o que mudou via **sync token incremental**.
**Polling de ~15 min como fallback** para notificação perdida.

**Implementar como abstração** (mesmo padrão dos demais adapters — D-022,
ADR-0005): interface + adapter Google + **fake para teste**. O domínio chama a
interface, nunca o SDK do Google.

**Escopo inicial deliberadamente estreito** (fica para depois, sem doer):
- sincronização **bidirecional de campos** (editar no Google e refletir no
  FITVO) — o próprio Calendly lançou isso só com data/hora e foi expandindo. Se
  o líder da categoria começou estreito, nós podemos;
- Outlook, Apple Calendar;
- recorrência complexa.

**Alerta de esforço registrado:** integração de calendário é onde times mais
subestimam complexidade (OAuth, refresh token, revogação de acesso, regras de
recorrência, free/busy variando por provider). **As 3 peças já são trabalho
sério** — tratar como fase, não como tarefa.

**Privacidade:** o paciente vê **"indisponível"**, nunca o conteúdo do
compromisso.

### D-108 — Confirmação de presença e combate ao no-show

Falta de paciente é **prejuízo direto do profissional**.

- **Confirmação de presença** pelo paciente, com **ação direta na notificação**
  (D-097, ADR-0010).
- **Lembretes configuráveis pelo profissional** (quantos dias/horas antes).
- Canais: push, e-mail, in-app, SMS (D-027, ADR-0005).
- **No-show registrado** — alimenta a estatística (D-110).

### D-109 — Política de retorno (configurável pelo profissional)

**Problema:** se o retorno é grátis e o app não suporta retorno grátis, o
profissional marca por WhatsApp — e o FITVO **perde o dado, o histórico e a razão
de existir**. Mesmo princípio do D-018: tudo passa pelo app.

- Cada profissional configura a própria política: **grátis**, **valor reduzido**
  (com o valor) ou **valor cheio**.
- **Retorno sempre passa pelo app**, cobrando ou não.
- **Exceção — não se aplica a personal trainer:** ele tem consultoria contínua,
  não o ciclo consulta → retorno. Retorno é conceito de **nutrição e medicina**.
- Conecta com o financeiro (D-059, ADR-0004): o plano do profissional ganha a
  dimensão de retorno.

### D-110 — Estatísticas da agenda

Para o profissional: consultas realizadas por período, taxa de comparecimento,
desmarcações, no-shows, evolução dos agendamentos. Alimenta os indicadores
(D-092, ADR-0009).

### D-111 — Fuso horário na agenda

Toda data/hora em **UTC** no banco (D-067); conversão na exibição pelo fuso do
usuário (`Account.preferredTimezone`, já existente). **Crítico** para atendimento
remoto global — a modalidade `ONLINE` (D-101, ADR-0011) permite profissional e
paciente em fusos diferentes, e um agendamento com fuso errado é uma consulta
perdida.

## Impacto de modelagem

Sinalizado para decisão — **nada implementado por este ADR**.

1. **Entidades novas**: disponibilidade do profissional (janelas), agendamento
   (`Appointment`, atado ao **vínculo** — isolamento por vínculo, ADR-0001),
   estado de confirmação/no-show, política de retorno por profissional, e o
   vínculo do agendamento com a conta de calendário externa.
2. **Detecção de conflito** é regra de domínio, não do banco: dois agendamentos
   sobrepostos para o mesmo profissional. Um `@@unique` não expressa
   sobreposição de intervalos — a checagem é transacional na aplicação (ou
   exclusion constraint no Postgres, a avaliar).
3. **Free/busy do Google** é **cache**, não fonte da verdade (D-107, Peça 1):
   precisa de timestamp de sincronização e tolerância a dado velho. Um bloco
   ocupado desatualizado causa exatamente o overbooking que este ADR quer evitar
   — o modelo deve deixar explícito **quando** aquilo foi lido.
4. **Credenciais OAuth do Google** por profissional (refresh token) são
   **segredo**: nunca no repositório (aviso do CLAUDE.md), e o armazenamento
   precisa de decisão própria (criptografia em repouso).
5. **Package `calendar`** novo (interface + adapter Google + fake), no padrão da
   ADR-0005 — como o `video` da ADR-0007.

## Alternativas consideradas

- **Forkar o Cal.com:** mesma stack, motor pronto, tentador. Rejeitado — o core é
  **AGPL-3.0**: usá-lo obrigaria a abrir o FITVO inteiro ou pagar licença
  comercial. Incompatível com SaaS proprietário (D-106).
- **Sincronizar eventos completos do Google (não free/busy):** permitiria exibir
  o compromisso, mas expõe conteúdo privado do profissional ao FITVO e multiplica
  a complexidade (campos, recorrência, fusos). Rejeitado — free/busy (D-107).
- **Só ler o Google, sem escrever nele (uma direção):** mais simples, mas mantém
  as "duas agendas" e o profissional segue marcando fora. Rejeitado — as peças 2
  e 3 juntas são o que constroem confiança.
- **Só escrever no Google, sem ler:** o FITVO marcaria em cima de compromisso
  pessoal. Rejeitado — é o overbooking inverso.
- **Não ter agenda no MVP (marcar por WhatsApp):** é o estado atual do mercado e
  a dor que o produto ataca; sem agenda, nutrição e medicina não têm porta de
  entrada. Rejeitado.
- **Bidirecional de campos desde o MVP:** o Calendly, líder da categoria, lançou
  só com data/hora. Rejeitado por ora — escopo estreito primeiro (D-107).

## Consequências

- **Agenda sobe na ordem de execução**: o fluxo de nutrição/medicina começa nela.
  Ver `docs/roadmap.md`.
- **Nova dependência de terceiros**: credenciais Google (OAuth) — some-se à lista
  de BLOQUEADO — TERCEIROS. O **motor próprio (D-106) não depende disso** e pode
  ser construído antes; só as peças 2 e 3 do D-107 ficam gated.
- O **fake do adapter** permite construir e testar o fluxo inteiro sem
  credenciais, como nos demais adapters (ADR-0005).
- A política de retorno (D-109) toca o **financeiro** — pela Política de Merge, é
  área de **revisão humana obrigatória**.
- O agendamento é atado ao vínculo e **carrega dado de saúde por contexto** (uma
  consulta com nutrólogo é informação clínica): escopo de tenant e isolamento por
  vínculo valem aqui como no resto (D-002/ADR-0001), e o admin puro não vê
  conteúdo clínico (D-015).
