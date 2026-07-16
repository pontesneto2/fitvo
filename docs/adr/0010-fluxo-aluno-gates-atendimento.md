# ADR-0010 — Fluxo do Aluno, Gates e Atendimento

**Status:** Aceito
**Decisões cobertas:** D-093 a D-100

## Contexto

Com o domínio de treino fechado (ADR-0009), falta definir **como o aluno entra
e opera** no dia a dia: o que o app exige antes de liberar conteúdo, como a
comunicação sai do WhatsApp e vira registro auditável, como o app se comporta
onde o produto é usado de verdade (academia com sinal ruim) e como a
notificação vira retenção. Estas decisões tocam **dado clínico** (anamnese,
atendimento), **auth** (troca de e-mail) e a **arquitetura do app mobile**
(offline-first).

## Decisão

### D-093 — Fluxo de entrada do aluno (gates obrigatórios)

```
Cadastro → app vazio → convite do profissional → vínculo criado
  → GATE: anamnese do contexto → profissional recebe → monta o plano
  → aluno recebe o plano
```

- Sem vínculo, o app não dá acesso a nada (reafirma D-006, ADR-0002).
- Com vínculo mas **sem anamnese respondida**, o aluno vê a estrutura do app e
  **o que precisa fazer** ("responda sua anamnese para receber seu treino") —
  **nunca tela morta**. Boa UX é requisito, não enfeite.
  > O texto do estado vazio depende da **modalidade do vínculo** (D-101,
  > ADR-0011): num vínculo `PRESENCIAL` o paciente não deve responder nada — o
  > profissional preenche na consulta —, então mandá-lo "responder a anamnese"
  > está errado. O gate continua existindo; a mensagem é que muda.
- O profissional só monta o plano **depois** da anamnese respondida.
- **Conceito novo de produto: gates obrigatórios.** O app trava o aluno até ele
  fornecer o que o profissional precisa. Resolve a dor real de o profissional
  ficar cobrando informação por WhatsApp.
- **O gate tem uma única fonte de verdade: o próprio registro de anamnese**
  (`Anamnesis.status`/`answeredAt`, um por vínculo). Uma flag espelhada no
  vínculo (`Bond.anamnesisCompletedAt`) foi **considerada e rejeitada**: seria
  uma segunda fonte de verdade capaz de divergir da primeira — o mesmo defeito
  que rejeitou a carga polimórfica no D-081 (estado inválido representável). O
  vínculo já tem a anamnese numa relação 1:1; a leitura do gate é um join
  barato, não vale o risco de divergência.

### D-094 — Anamnese: uma por profissional

> ⚠️ **PARCIALMENTE REVISADO pelo D-102 (ADR-0011).** Este decisão assumia que
> **o paciente responde** a anamnese — premissa falsa para nutrição e medicina,
> onde a consulta presencial é a norma. O D-102 passa a permitir preenchimento
> pelo paciente, pelo profissional ou por ambos, com **rastreio de autoria
> obrigatório**. O resto desta decisão (uma por vínculo, documento de prontuário
> não compartilhado, autopreenchimento, exceção do e-mail) **permanece válido**.
> A taxonomia dos campos, deixada em aberto aqui, foi fechada pelo D-103.

- **Anamnese nova a cada profissional.** É documento que o profissional anexa
  ao prontuário do paciente — **não é compartilhada automaticamente** (coerente
  com o consentimento como ato explícito do paciente, D-016/ADR-0003). Como o
  vínculo já encapsula (paciente + profissional + especialidade), "uma por
  profissional" é "uma por vínculo".
- **Obrigatória em todos os contextos:** treino, nutrição, nutrologia.
- Dados básicos e evidentes vêm **autopreenchidos**, com o usuário podendo
  **editar** se necessário.
- **Exceção — chave primária:** o e-mail (login único, D-042) não é editável
  livremente. Para trocar, o usuário informa o novo e **autentica via código** —
  fluxo verificado, no mesmo padrão de token-hash dos convites (D-029/D-055),
  nunca edição livre de campo.

### D-095 — Atualização cadastral periódica

- A cada **6 meses**, o aluno atualiza os dados cadastrais (mantém o cadastro
  vivo) — varredura de worker que dispara o pedido no momento natural.
- **A cada plano novo montado**, o sistema pergunta se o objetivo continua o
  mesmo ou mudou.
- Captura mudança clinicamente relevante (lesão nova, medicamento novo, objetivo
  diferente) sem burocracia.

### D-096 — Atendimento (chat estruturado por ticket)

- **Nome da funcionalidade: "Atendimento"** — não "chat" (promete resposta
  instantânea) nem "suporte" (soa como problema técnico do app).
- **Fluxo:** o aluno abre um atendimento via **formulário interativo**; vira uma
  **conversa** em interface de lista (padrão familiar tipo WhatsApp), disponível
  no **app e no painel web**; fica **pendente** até ser resolvida (mostra também
  as **concluídas**); ao resolver, gera **ticket** com **avaliação do
  atendimento**.
- **Insistência inteligente (escalada com teto — nunca martelar o mesmo
  canal):**
  - mensagem nova → push imediato;
  - não leu em 2h → push com tom diferente ("João está esperando sua
    resposta");
  - não leu em 24h → push + e-mail;
  - não respondeu em 48h → **alerta no painel** do profissional ("3 mensagens
    pendentes há mais de 2 dias") + entra no indicador de aderência.
- **Justificativa:** insistir no mesmo canal faz o profissional silenciar a
  notificação — e perde-se o canal. A insistência **migra de canal** e vira
  **métrica visível**, protegendo a retenção do profissional e a do FITVO. A
  escalada é varredura de worker sobre o estado de leitura/resposta.
- **IA no atendimento: triagem, não resposta.** A IA sugere ao profissional uma
  resposta pronta, que ele edita e envia. **Nunca** a IA responde direto ao
  aluno sobre dúvida de treino/saúde — é IA orientando leigo sem profissional no
  meio (coerente com D-023 e D-088). A sugestão é transiente (assistência ao
  profissional), não devolutiva automática.
- **Benefício de negócio:** cria **registro auditável** (é **dado clínico** —
  isolado por vínculo, escopo de tenant, nunca acessível ao admin puro, D-015) e
  tira a conversa do WhatsApp (a "solução improvisada" apontada como dor do
  mercado).

### D-097 — Notificações inteligentes como pilar do produto

- Push/notificação não é acessório — é **pilar de retenção**. Linguagem
  amigável e moderna; notificações **interativas** (ação direto da notificação
  quando possível).
- Casos: dia de treino, plano vencendo (D-083), mensagem sem resposta (D-096),
  convite recebido, cobrança, conquista/meta batida.
- FCM já está na stack (D-027/ADR-0005). O canal in-app persiste com soft delete
  e as notificações sensíveis (financeiras, de consentimento) ficam em log por
  obrigação legal (D-028/ADR-0005) — o modelo de persistência ainda não existe
  no schema e nasce aqui (ver "Impacto de modelagem").

### D-098 — Divisão de acesso por superfície

| Papel | Superfície | Escopo |
|---|---|---|
| Aluno/paciente | **App apenas** | Consumo: treino, execução, avaliação, atendimento |
| Profissional | **App (visão limitada)** | Recursos rápidos do dia a dia; edita campos determinados |
| Profissional | **Painel web (visão completa)** | Montar treinos, operações, gestão |
| Admin de clínica | **Painel web** | Operacional/financeiro (nunca dado clínico — D-015) |

- **Justificativa:** não é a mesma tarefa em telas diferentes — **são tarefas
  diferentes**. Montar treino com séries variáveis (D-081) é trabalho de teclado
  e tela grande; marcar presença entre um aluno e outro é trabalho de celular,
  uma mão. Já suportado pelo design system: **densidade adaptável** (mobile
  compacto, painel web respirável, admin compacto) — decisão de design tomada
  antes e que encaixa exatamente aqui.
- **Vantagem competitiva:** o app é **nativo (Expo)**, não PWA — entrega push
  confiável, câmera real (D-088), offline (D-099) e cronômetro em segundo plano
  com música tocando. Concorrentes em PWA sofrem nesses pontos.

### D-099 — Offline-first no app do aluno

- **Contexto:** o aluno treina na academia — sinal ruim no subsolo é o **cenário
  principal, não a exceção**. Exigir internet para mostrar o treino e registrar
  a série quebra o app no momento de uso; perder progresso = abandono.
- **Decisão: offline-first com WatermelonDB.**
  - O banco local (SQLite) é a **fonte da verdade**; a rede é otimização, não
    requisito. Escrita local instantânea → UI reativa → sync em background
    quando houver conexão.
  - **Escopo offline delimitado** (não sincronizar tudo — mata performance e
    storage): apenas os **planos ativos** do aluno e as **execuções pendentes**.
    Histórico antigo permanece online (D-100).
  - **Conflito:** last-write-wins no caso geral (o aluno é o único a editar a
    própria execução), com **merge por campo** onde profissional e aluno podem
    tocar o mesmo registro. Merge por campo **exige colunas tipadas** — mais uma
    razão para matar o `detail Json?` (ADR-0009).
  - **Feedback de sync visível:** o usuário precisa saber quando está offline, o
    que está pendente e quando sincronizou.
  - **Criptografia do dado local é obrigatória** — é dado de saúde em device que
    pode ser perdido ou compartilhado.
- **Custos reconhecidos (não são surpresa):**
  - WatermelonDB exige **development build** — Expo Go deixa de funcionar.
  - **O servidor de sync é nosso:** dois endpoints (pull desde timestamp, push
    de mudanças) + resolução de conflito idempotente.
  - Manter schema local e remoto em sincronia adiciona fricção a mudanças de
    modelo.
- **Alternativas rejeitadas:** cache simples com fila (não é offline-first de
  verdade — diverge silenciosamente); CRDT (complexidade desnecessária — não há
  edição colaborativa simultânea).

### D-100 — Volume de dados e retenção

- **Estimativa:** aluno treinando 4×/semana por 2 anos ≈ 400 sessões × ~8
  exercícios × ~4 séries ≈ 12 mil registros de série — multiplicado por milhares
  de alunos.
- **Estratégia:** sync seletivo (D-099 — o device nunca carrega tudo); índices
  planejados desde o início; paginação cursor-based nos feeds de histórico
  (D-036/ADR-0005); particionamento por data no Postgres quando o histórico
  crescer (não agora, mas todo registro de execução nasce com data indexada);
  **nunca deletar histórico** — dado clínico tem guarda legal (reforça a deleção
  lógica de D-089).

## Impacto de modelagem

Entidades novas e alterações a modelar (detalhe apresentado ao responsável
**antes de qualquer código**):

- **Gate de anamnese:** lido do próprio `Anamnesis` (relação 1:1 com o vínculo),
  que bloqueia a criação de plano e alimenta a UX "responda sua anamnese". **Sem
  flag espelhada no `Bond`** — fonte única de verdade (ver D-093).
- **Anamnese × Avaliação:** o esqueleto tem `Assessment` conflatando
  "anamnese / avaliação / medidas". D-094 separa a **anamnese** (gate, uma por
  vínculo, documento do prontuário) da **avaliação/medidas** (recorrente).
  Propor `Anamnesis` como entidade própria; manter `Assessment` para medidas
  recorrentes. Ambas com campos tipados por especialidade (treino agora;
  nutrição/medicina deferidos).
- **Atendimento:** `Attendance` (thread/ticket, isolado por vínculo — dado
  clínico), `AttendanceMessage` (com estado de leitura para a escalada) e
  `AttendanceRating` (avaliação do atendimento resolvido). Estado de escalada
  suportado por campos de leitura/última mensagem; a escalada em si é worker.
- **Notificações:** `Notification` (persistência in-app, soft delete, marcação
  de sensível para o log legal) — descrita em D-028/ADR-0005, ausente do schema.
- **Offline (transversal):** as tabelas sincronizáveis (planos ativos +
  execuções) ganham `deletedAt` (tombstone para o pull) e `updatedAt` **indexado**
  (cursor de sync pull-since). Alinhado à deleção lógica (D-089).
- **Troca de e-mail (D-094):** fluxo verificado por código, no padrão token-hash
  dos convites — não é edição livre de `Account.email`.

## Alternativas consideradas

- **Flag do gate espelhada no vínculo (`Bond.anamnesisCompletedAt`):** evitaria
  um join na checagem do gate, mas cria uma segunda fonte de verdade que pode
  divergir de `Anamnesis.answeredAt` — estado inválido representável, o mesmo
  defeito que rejeitou a carga polimórfica (D-081). Rejeitado — o gate lê do
  registro de anamnese (D-093).
- **Nomear "chat" ou "suporte":** "chat" promete instantaneidade que o
  profissional não dá; "suporte" soa como bug do app. Rejeitado — "Atendimento"
  (D-096).
- **Insistir no mesmo canal (push repetido):** faz o profissional silenciar a
  notificação e perde-se o canal. Rejeitado — escalada que migra de canal e vira
  métrica (D-096).
- **IA respondendo direto ao aluno no atendimento:** IA orientando leigo sobre
  saúde sem profissional no meio. Rejeitado — triagem para o profissional
  (D-023/D-088).
- **Cache simples com fila de sincronização:** não é offline-first — diverge
  silenciosamente e perde escrita. Rejeitado (D-099).
- **CRDT para o offline:** complexidade sem necessidade (não há edição
  colaborativa simultânea sobre o mesmo registro). Rejeitado — last-write-wins +
  merge por campo (D-099).
- **Sincronizar todo o histórico no device:** mata performance e storage.
  Rejeitado — escopo delimitado a planos ativos + execuções pendentes (D-099).
- **App como PWA:** evitaria o development build, mas entrega push, câmera,
  offline e background piores. Rejeitado — nativo Expo (D-098).

## Consequências

- O **Atendimento é dado clínico**: isolado por vínculo, com escopo de tenant, e
  fora do alcance do admin puro (D-015/ADR-0003). Qualquer query sem escopo de
  vínculo/tenant é bug de vazamento.
- O **servidor de sync passa a ser nosso** (dois endpoints + conflito
  idempotente) — trabalho de backend reconhecido, o item mais caro do lote.
- **WatermelonDB exige development build** — decisão que fecha a porta do Expo Go
  para o app do aluno; impacta o setup mobile.
- Nasce o modelo `Notification` que ADR-0005 (D-028) descreveu mas o schema
  ainda não tinha.
- A implementação toca **dado clínico** (anamnese, atendimento) e **auth** (troca
  de e-mail): pela Política de Merge (CLAUDE.md), é **revisão humana
  obrigatória**, nunca auto-merge — mesmo com CI verde.
- Anamnese como gate reforça o consentimento (D-016): documento por vínculo,
  nunca compartilhado sem ato explícito do paciente.
