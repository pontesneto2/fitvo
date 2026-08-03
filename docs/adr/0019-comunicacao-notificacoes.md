# ADR-0019 — Comunicação e Notificações (presença, eventos e calibragem)

**Status:** Proposto (mesa, jul/2026).
**Decisões cobertas:** D-179 a D-186
**Consolida e estende** (não redecide): ADR-0005 (D-022–D-028, D-031–D-036 — canais, central in-app,
retenção legal), ADR-0010 (D-096 escalada, D-097 notificação como pilar de retenção), ADR-0012
(D-107/D-108 lembretes de agenda). O tema estava disperso nesses três; este ADR dá casa própria à
comunicação e adiciona os eixos que faltavam.
**Relacionados:** D-025 (consentimento — mecanismo de prova reusado); D-083 (validade de plano,
worker); D-092 (indicadores/aderência); D-178 (alerta clínico PAR-Q); ADR-0017 (notificação é dado
de pessoa, escopo de tenant/conta).
**Motivação de produto:** o app deve se fazer presente no dia a dia do usuário, em todos os nichos
(treino, nutrição, medicina) — mas presença calibrada, nunca spam. "App presente" e "app que
bombardeia" são a mesma feature mal calibrada; este ADR fixa a calibragem.

---

## Contexto

Já existe fundação (ADR-0005/0010/0012): canais (push FCM, e-mail, in-app, SMS — WhatsApp fora do
MVP), o modelo `Notification` + `NotificationType` no schema, adapters mock (packages/notifications),
escalada de canal (D-096), notificação declarada pilar de retenção (D-097), lembretes de agenda
(D-108). O que faltava e este ADR fecha:

1. **Notificação por AUSÊNCIA**, não só por evento — "você não treinou hoje", "anamnese vencida".
   O enum só tinha eventos positivos (WORKOUT_DAY), não a ausência da ação esperada.
2. **Preferências por categoria/canal** — não existe `NotificationPreference` nem `PushToken`;
   e o "opt-out de e-mail é requisito legal" se perdeu na destilação do ADR-0005 (gap conhecido).
3. **Distinção acompanhamento vs transacional vs marketing** — nunca foi decidida; é o que separa
   serviço legítimo (opt-out) de marketing (opt-in, LGPD).
4. **Calibragem do push** — sem teto/agrupamento, "tudo tem notificação" vira desinstalação.

---

## Decisão

### D-179 — Cobertura total de eventos + ausências, em todos os nichos
Toda etapa relevante do ciclo do usuário gera notificação, em dois tipos de gatilho:

**Gatilhos de EVENTO (algo aconteceu → notifica imediato):**
- Treino/plano/protocolo novo liberado; anamnese respondida (→ profissional); convite recebido;
  cobrança; conquista/meta batida (D-097); consulta agendada/confirmada (D-108).

**Gatilhos de AUSÊNCIA / VENCIMENTO (ação esperada não cumprida → notifica via worker):**
- Não fez check-in no dia de treino; não avaliou o treino concluído; ausência prolongada; anamnese
  vencida/desatualizada; plano vencendo (D-083); e os equivalentes de nutrição (refeições não
  registradas) e medicina (retorno/exame pendente).

**Padrão multi-nicho "ação esperada não cumprida":** em vez de tipos soltos por domínio, o motor de
presença opera sobre um padrão único — cada domínio declara qual é a ação esperada e o prazo, e
ganha a notificação de ausência de graça. Treino→check-in, nutrição→registro de refeição,
medicina→retorno. Escala pra domínios futuros sem redecidir.

### D-180 — Check-in é a fonte de verdade da presença (treino), e alimenta três saídas de um só sinal
O check-in (concluir treino + avaliar — D-086) é o sinal de presença. Sua AUSÊNCIA alimenta, de um
único dado, três saídas:
- **Ao aluno:** "você não treinou hoje" / "faz N dias que você não aparece" (mensagem de presença).
- **Ao profissional:** ausência de check-in por **mais de 3 dias** dispara alerta ("o aluno sumiu").
- **Ao dashboard:** frequência/aderência do aluno (derivada — D-092, sem entidade nova).

Um sinal, três usos — sem inventar mecanismo por saída. O mesmo padrão vale nos outros nichos (a
ação esperada do domínio é o "check-in" dele).

### D-181 — Natureza da comunicação: TRÊS categorias com regras opostas de consentimento
- **ACOMPANHAMENTO (serviço):** presença, lembretes de treino/refeição/retorno, "esqueceu de
  avaliar", aluno ausente. Ancorado no **bond profissional** — é o profissional acompanhando o
  aluno (o personal avisa quando você não cumpre o que ele prescreveu), não o FITVO empurrando uso.
  **Opt-out por categoria** (vem ligado; o usuário pode desligar). Enquadramento de serviço, não
  marketing — legalmente mais seguro por estar ancorado no vínculo.
- **TRANSACIONAL CRÍTICO:** cobrança, consentimento, **alerta clínico** (D-178). **Não desligável**
  — obrigação legal/segurança. (O alerta clínico PAR-Q continua com seu fluxo próprio de ciência
  registrada via D-025; aqui ele também gera notificação, mas nunca é silenciável.)
- **MARKETING:** promoção, novidade do FITVO, reengajamento genérico não ancorado no bond. **Opt-in
  obrigatório** (vem DESLIGADO; o usuário aceita antes) — LGPD.

**Fronteira decisiva:** "você não treinou hoje" vindo do acompanhamento do profissional = serviço
(opt-out). O mesmo texto vindo do "FITVO" genérico pra empurrar uso = marketing (opt-in). Como o
FITVO tem o bond, a presença é enquadrada como acompanhamento — verdadeiro e seguro.

### D-182 — Central in-app registra TUDO; o PUSH é seletivo e calibrado
A regra que faz "presença" não virar "spam":
- **Central in-app (o sininho — modelo `Notification` já existe) registra todo evento/ausência.** É
  barato e não interrompe; o usuário vê tudo quando abrir. Soft delete (D-028).
- **O PUSH (a interrupção no celular) é calibrado:**
  - **Teto de frequência:** nunca mais que N pushes/dia por usuário (estende o princípio D-096
    "nunca martelar o mesmo canal" para "nunca martelar o usuário").
  - **Agrupamento/digest:** múltiplos eventos pequenos viram um resumo ("3 novidades hoje"), não N
    pushes.
  - **Prioridade por tipo:** transacional crítico (cobrança, clínico) sempre passa; acompanhamento
    e conquista respeitam teto e horário.
  - **Janela de horário:** não enviar push em horário de silêncio (ex.: madrugada) para tipos
    não-críticos.
  - **Respeita a preferência (D-181) e a categoria.**
- Resultado: o usuário VÊ tudo (central), mas só é INTERROMPIDO (push) pelo que importa, sem spam.

### D-183 — Preferências: modelo `NotificationPreference` por conta × categoria × canal
Nasce o modelo de preferência (não existe hoje):
- Por **conta**, granularidade por **categoria** (acompanhamento/transacional/marketing) e por
  **canal** (push/e-mail/in-app/SMS).
- **Defaults:** acompanhamento = ligado (opt-out); transacional crítico = ligado e travado (não
  desligável); marketing = desligado (opt-in).
- **Opt-out de e-mail é requisito legal (resgatado):** todo e-mail de marketing tem descadastro; o
  opt-out de e-mail é honrado como exigência legal (LGPD) — reinstala a decisão diluída na
  destilação do ADR-0005 (D-027 do histórico bruto). Registrar como palavra de força.

### D-184 — `PushToken`/`DeviceToken` por dispositivo
Nasce o registro de token de push por dispositivo (não existe hoje) — necessário para o disparo
real de FCM. Por conta, N dispositivos; token revogável (logout/desinstalação). Sem isso o push
real (item pendente #10 do roadmap, bloqueado por credenciais) não tem para onde enviar.

### D-185 — Gatilhos de ausência reusam as réguas de worker existentes
Os gatilhos de ausência/vencimento (D-179) rodam em **worker de varredura periódica**, reusando as
réguas que já existem (D-083 validade de plano; D-108 lembretes de agenda) — não cria motor novo.
O worker varre "quem não fez check-in", "quem tem anamnese vencida", "quem tem plano vencendo" e
emite as notificações pelo pipeline existente (packages/notifications, escalada D-096).

### D-186 — Novos tipos no enum `NotificationType`
Adicionar (multi-nicho, padrão de ausência): `WORKOUT_MISSED` (não fez check-in no dia),
`CHECKIN_ABSENCE_STREAK` (N dias sem check-in — ao aluno), `STUDENT_ABSENT` (aluno ausente +3 dias —
ao profissional), `EVALUATION_MISSING` (concluiu, não avaliou), `NEW_PLAN_AVAILABLE` (treino/plano
novo), `ANAMNESIS_DUE` (anamnese vencida/revisão), e os equivalentes de nutrição/medicina quando
esses domínios entrarem (`MEAL_LOG_MISSING`, `FOLLOWUP_DUE`). Cada tipo carrega sua categoria
(D-181) para a calibragem (D-182) e a preferência (D-183).

---

## Consequências

- O app se faz presente em todos os nichos (treino/nutrição/medicina) pelo mesmo motor de presença,
  sem redecidir por domínio (D-179 padrão "ação esperada não cumprida").
- "Tudo tem notificação" é verdade na central (D-182), mas o push é calibrado — presença sem spam.
- A ausência de check-in vira um ativo: alimenta aluno, profissional e dashboard de um só sinal
  (D-180).
- O enquadramento de acompanhamento (D-181) dá base legal ao "não treinou hoje" sem cair em
  marketing.
- Resgata o opt-out de e-mail legal (D-183) que a destilação havia diluído.
- Depende do disparo real (FCM/e-mail/SMS) que está bloqueado por credenciais de terceiros (roadmap
  #10) — este ADR fixa as regras; o disparo ao vivo é slice quando as credenciais existirem. Até lá,
  os adapters mock exercem a lógica.

## Alternativas consideradas

- **Push para todo evento (sem calibragem):** rejeitado — vira desinstalação. Central registra tudo,
  push é seletivo (D-182).
- **Tratar "não treinou hoje" como marketing (opt-in):** rejeitado — mataria a presença que é o
  objetivo. Enquadrado como acompanhamento ancorado no bond (D-181), opt-out.
- **Tipos de notificação soltos por domínio:** rejeitado — não escala. Padrão único "ação esperada
  não cumprida" (D-179), cada domínio declara ação+prazo.
- **Preferência só por canal (como o ADR-0005 destilou):** insuficiente — precisa de categoria
  também (acompanhamento ≠ marketing têm regras opostas). D-183 adiciona a dimensão categoria.

## Pendências para a implementação

- Definir N do teto de push/dia e a janela de horário de silêncio (D-182) — calibrar com dados de
  uso.
- Modelar `NotificationPreference` e `PushToken` no schema (D-183/D-184).
- Persistir o InAppNotificationStore no Postgres (hoje em memória) — ligar ao modelo `Notification`.
- Disparo real de FCM/e-mail/SMS — bloqueado por credenciais (roadmap #10).
- Confirmar os prazos de "ausência" por nicho (quantos dias sem check-in dispara o quê).
- Texto das mensagens — copy que soe como acompanhamento do profissional, não como app genérico.
