# ARQUIVO HISTÓRICO — Registro bruto da sessão de planejamento (D-001 a D-073)

> ## ⚠️ NÃO É FONTE VIVA
>
> Este é o **registro bruto da sessão de planejamento original** — a conversa em
> que as decisões nasceram. Os ADRs em **`docs/adr/`** foram **gerados a partir
> daqui** e **substituem** este arquivo.
>
> **As decisões vigentes estão em `docs/adr/`. Em caso de divergência, o ADR
> vence.**
>
> Preservado para rastrear a **origem** e o **raciocínio** — não para consultar
> o que vale hoje. Ver o mapa D-número → ADR no `README.md`.
>
> ### Como este arquivo engana (leia antes de citá-lo)
>
> Os ADRs **destilaram** este registro, e a destilação **perdeu nuance de
> propósito**. Citar daqui como se fosse regra vigente é erro real, já cometido:
>
> - **D-014** aqui diz *"profissionais não enxergam o trabalho uns dos outros
>   **por padrão**"*. O ADR-0003 registra *"Só o admin tem visão ampla"* — **sem**
>   o "por padrão". A porta entreaberta existe **só aqui**, e portanto **não é
>   decisão vigente**.
> - **D-012** aparece **duas vezes**: a original (clínica como "gancho faseado") e
>   a **REVISADA** (clínica modelada por completo). Só a segunda vale, e quem ler
>   a primeira sem seguir adiante conclui o oposto do que está decidido.
>
> Se você precisa de uma regra para decidir algo **agora**, ela tem que existir
> num ADR. Se só existe aqui, ela **não foi decidida** — proponha ao responsável.
>
> **Faixa contida:** D-001 a D-073 (sequência completa, sem lacunas). As decisões
> **D-074 em diante** nasceram depois desta sessão, direto nos ADRs, e **não têm
> entrada aqui**.

---

## Bloco 1 — Tenancy e Modelo de Relacionamento

### D-001 — Estratégia de Tenancy
**Decisão:** Shared database / shared schema. Isolamento por `tenant_id`
na camada de aplicação, com guard obrigatório na camada de repositório.
**Status:** Aprovada.
**Consequências:** Simplicidade e escala adequadas ao volume-alvo. Exige
disciplina absoluta de isolamento no repositório (nenhuma query sem escopo
de tenant).
**Em aberto:** RLS (Row-Level Security) do Postgres como defesa em
profundidade — baixa prioridade, decidir depois.

### D-002 — Relação Aluno ↔ Personal
**Decisão:** N:N. Cada vínculo aluno-personal é uma contratação independente.
**Status:** Aprovada.

### D-003 — Unidade de Dados (global vs. por-vínculo)
**Global (uma vez por aluno):** identidade (nome, e-mail, login, foto de
perfil), data de nascimento, sexo, altura.
**Por vínculo (uma vez por personal-aluno):** anamnese, avaliações físicas,
medidas, treinos/fichas/séries, agenda, check-ins, financeiro, fotos de
evolução.
**Status:** Aprovada.

### D-004 — Isolamento de dados corporais entre personais
**Decisão:** Avaliação física, medidas corporais e fotos de evolução são
ISOLADAS por vínculo. Cada personal só vê o que ele mesmo registrou.
**Status:** Aprovada.
**Justificativa:** Menor risco. Evolução de isolado→compartilhável é aditiva
e não-destrutiva; o caminho inverso seria custoso.
**Consequência / requisito de UX:** haverá duplicação legítima de dados
corporais quando o aluno tem múltiplos personais. A interface do ALUNO deve
segmentar por personal ("Avaliações com João" / "Avaliações com Maria") e
NUNCA fundir num gráfico único, para não confundir.

---

## Bloco 2 — Identidade, Autenticação e Onboarding

### D-005 — Métodos de login (faseado)
**Decisão:** MVP com e-mail/senha. Login social (Google + Apple) fica para
fase posterior, após as contas FITVO já criadas.
**Nota de plataforma:** ao ligar QUALQUER login social, Apple OAuth passa a ser
obrigatório na App Store — Google e Apple entram juntos, não separados.
**Status:** Aprovada.

### D-006 — Onboarding do paciente + Convite como entidade
**Decisão:** Paciente pode se autocadastrar, mas o app fica em estado
mínimo/estático até vincular um profissional. O profissional envia convite,
entregue via push + tela no app + e-mail.
**Consequência:** "Convite" é entidade de primeira classe, com estados
(enviado, aceito, expirado, recusado).
**Status:** Aprovada.

---

## Bloco 3 — Visão de Produto: Ecossistema Multi-Especialidade

### D-007 — Reposicionamento: plataforma multi-especialidade de saúde/fitness
**Decisão:** FITVO não é um app de personais; é um ecossistema único ("3 apps
em 1") reunindo TREINO, NUTRIÇÃO e MEDICINA, compartilhando a mesma base
técnica, design system, identidade, agenda, pagamento e infraestrutura, com
contextos separados por especialidade e dados interligados sob consentimento.
**Diferencial comercial:** unificação de informação do paciente (dor real do
mercado) + venda para clínicas (todos os profissionais no mesmo ecossistema).
**Referências:** Treino → MFit/Personal Fit/Tecnofit; Nutrição → Dietbox
(versão superior); Medicina → definir referência quando a fase chegar.
**Status:** Aprovada.

### D-008 — Especialidade é N:N com o profissional (contextos independentes)
**Decisão:** Um profissional pode ter múltiplas especialidades. Cada
especialidade é um CONTEXTO DE ATUAÇÃO independente (perfil profissional
separado sob a mesma conta). Ex.: Léo aparece como Nutricionista no contexto
de nutrição e como Educador Físico no contexto de treino; o paciente pode
contratar um, outro ou ambos, cada um como vínculo isolado.
**Modelo de vínculo atualizado:** `paciente ↔ (profissional + especialidade)`.
**Status:** Aprovada.

### D-009 — Faseamento por risco regulatório
**Decisão:** Núcleo + Treino primeiro → Nutrição em seguida → Medicina por
último. Ordem por risco regulatório crescente, não por preferência comercial.
A ARQUITETURA nasce multi-especialidade desde o schema; a EXECUÇÃO é faseada.
**Status:** Aprovada.

### D-010 — Verificação de registro profissional (CREF/CRN/CRM)
**Decisão:** Verificação em duas camadas.
- Camada 1 (automática, no cadastro): validação de formato + checagem em bases
  públicas quando existirem (frágil; conselhos são estaduais e sem API unificada).
- Camada 2 (revisão): envio de foto da carteira do conselho + documento;
  aprovação manual via painel admin no início, automatizável depois
  (idwall/Serpro) se o volume justificar.
**Resultado:** status de verificação por perfil profissional (`pendente`,
`em análise`, `verificado`, `rejeitado`) → vira selo de confiança e ativo de
marketing.
**Status:** Aprovada.

### D-011 — Receita médica: fora do escopo eletrônico no MVP
**Decisão:** Sem prescrição eletrônica no MVP. Médico preenche dados no painel;
o sistema imprime folha estruturada (paciente, médico + CRM, data) para
assinatura física. Isso remove o fardo regulatório de prescrição eletrônica
(ICP-Brasil/Memed) por ora. Receita eletrônica = fase futura com assessoria
jurídica dedicada.
**Status:** Aprovada (redução deliberada de escopo de risco).

### D-012 — Clínica = tenant que agrupa profissionais
**Decisão:** "Clínica" é o `tenant_id` do D-001. Profissional solo = clínica
de uma pessoa (mesmo modelo, sem complexidade extra). Uma clínica tem
administrador com painel próprio, agrupa vários profissionais e é a unidade
comercial de cobrança (ticket maior, retenção melhor). Compartilhamento de
contexto de paciente entre profissionais da mesma clínica é possível SOB
CONSENTIMENTO (LGPD).
**Estratégia:** modelar o gancho agora (tenant nasce multi-profissional no
schema); implementar a gestão de clínica (convite de profissionais, permissões
intra-clínica, compartilhamento de paciente) em fase posterior. Valida-se
primeiro com profissionais solo.
**Status:** Aprovada (gancho no schema; gestão faseada).

---

## Bloco 4 — Autorização, Papéis (RBAC) e Consentimento

### D-012 (REVISADO) — Clínica modelada por completo desde já
**Mudança:** o conceito de clínica deixa de ser "gancho faseado" e passa a ser
MODELADO E IMPLEMENTADO por completo. É o coração comercial do produto: vender
a plataforma para clínicas centralizarem toda a operação (atendimentos, dados,
financeiro). Planos vendidos tanto para clínica quanto para profissional solo.
**Status:** Aprovada (substitui a estratégia faseada anterior do D-012).

### D-013 — Papéis do sistema (RBAC)
**Níveis de acesso:**
- Super Admin (FITVO) — gestão da plataforma inteira.
- Clínica (tenant) + Admin de Clínica — gerência do tenant.
- Profissional — atende pacientes dentro de suas especialidades.
- Paciente/Aluno — consome serviços.
**Regra-chave:** "Admin de Clínica" e "Profissional" são papéis DESACOPLADOS.
Uma pessoa pode ter um, outro ou ambos.
**Status:** Aprovada.

### D-014 — Visão dentro da clínica
**Decisão:** Somente o Admin de Clínica tem visão ampla. Profissionais não
enxergam o trabalho uns dos outros por padrão.
**Status:** Aprovada.

### D-015 — Administrador puro vê operacional, NÃO clínico
**Decisão:** Pode existir administrador puro (gerente administrativo, não é
profissional de saúde). Ele acessa dados FINANCEIROS/OPERACIONAIS e dashboards
agregados da clínica, mas NÃO acessa dado CLÍNICO do paciente (anamnese,
avaliações, prescrições). Separação dado-operacional ≠ dado-clínico é
obrigatória e protege juridicamente.
**Status:** Aprovada.

### D-016 — Consentimento e Compartilhamento como domínio de primeira classe
**Decisão:** Paciente é o titular dos dados (LGPD) e controla ativamente o
consentimento. Pode: autorizar/revogar compartilhamento entre profissionais
(granular, por profissional), exportar seus dados (portabilidade) e solicitar
exclusão. "Consentimento" é entidade de primeira classe controlada pelo paciente.
**Compartilhamento entre profissionais:** SEMPRE autorizado pelo paciente,
NUNCA automático.
**Status:** Aprovada.

### D-017 — Motor de compartilhamento orientado a eventos ("notificações inteligentes")
**Decisão:** Quando um paciente passa a ter múltiplos profissionais na
plataforma, o sistema detecta a sobreposição (evento) e dispara notificação
inteligente sugerindo compartilhamento de contexto — condicionado ao
consentimento do paciente. Implementado via arquitetura orientada a eventos
(BullMQ + workers). Justifica o domínio de eventos do projeto.
**Status:** Aprovada.

---

## Bloco 5 — Financeiro e Modelo de Cobrança

### D-018 — Dois fluxos de dinheiro
**Fluxo A (assinatura SaaS):** profissional/clínica paga a assinatura do FITVO.
Dinheiro cai na conta do FITVO. Sem peso regulatório.
**Fluxo B (aluno → profissional):** aluno paga consulta/mensalidade ao
profissional ATRAVÉS do app. Habilita atendimento remoto (mundo todo) e
presencial. DEVE ser implementado como SPLIT via Asaas: cada profissional/
clínica tem subconta, o dinheiro NUNCA passa pela conta do FITVO (evita virar
facilitador de pagamento / obrigações BACEN). FITVO pode cobrar taxa por
transação como receita adicional.
**Status:** Aprovada.
**PENDENTE:** Fluxo B é obrigatório no onboarding ou opcional (profissional
pode cobrar por fora)? → decide se a subconta Asaas é obrigatória.

### D-019 — Estrutura de planos
**Clínicas/organizações:** pacotes por número de pacientes.
**Profissionais:** pacotes por número de usuários, incluindo pacote ESTAGIÁRIO
(até 2 alunos, valor reduzido) como porta de entrada.
**Trial:** 7 dias grátis por CPF/CNPJ; depois trava funcionalidades.
**Aluno:** sempre grátis.
**Status:** Aprovada.
**PENDENTE:** limite por pacientes ATIVOS (com definição de "ativo") ou por
total CADASTRADOS? (recomendação: ativos, com definição clara).

### D-020 — Régua de cobrança e suspensão
**Avisos:** 3 dias antes do vencimento → no dia → 2 dias vencido ("não
identificamos, desconsidere se já pagou") → 4 dias ("suspensão em breve") →
7 dias vencido → SUSPENSÃO (app estático, só funções mínimas).
**Trial anti-abuso:** vinculado a CPF/CNPJ (impede recriar conta para novo trial).
**Princípio-chave:** SUSPENSÃO ≠ EXCLUSÃO. Dados clínicos permanecem intactos
após suspensão (guarda legal + retomada ao voltar a pagar).
**Status:** Aprovada.
**PENDENTE (LGPD):** tempo de retenção dos dados após suspensão antes de
arquivamento/anonimização (ex.: 12 meses → notifica → arquiva). Definir número.

---

## Bloco 5 — Complementos e Fechamento

### D-018 (COMPLEMENTO) — Fluxo B é OBRIGATÓRIO
**Decisão:** O profissional DEVE receber via FITVO. Subconta Asaas = passo
obrigatório do onboarding; profissional não atende antes de configurá-la.
**Justificativa:** reúne dados financeiros (faturamento, inadimplência, ticket
médio → dashboards e futuros produtos de crédito) e aumenta o custo de saída
(lock-in saudável).
**UX crítica:** geração de cobrança (boleto/PIX/cartão) em poucos toques;
envio automático ao paciente (push + app + e-mail); webhook Asaas atualiza
status em TEMPO REAL (tela reflete "pago" sem refresh). Deve ser fácil,
automático e moderno — sem engasgos.
**Taxa:** profissional define o valor livremente; FITVO retém taxa mínima por
transação via split.
**Status:** Aprovada.

### D-019 (COMPLEMENTO) — Planos recorrentes com periodicidade
**Decisão:** Em toda modalidade, suportar recorrência mensal, trimestral,
semestral e anual. Vale para AMBOS os níveis: assinatura profissional→FITVO e
cobrança profissional→paciente. Asaas tem recorrência nativa (não construir
motor do zero).
**Status:** Aprovada.
**PENDENTE:** desconto de periodicidades longas é configurável pelo
profissional ou fixo pela plataforma?

### D-019b — Definição de paciente ATIVO (fecha pendência)
**Decisão:** Limite do plano conta pacientes ATIVOS por uso atual (vínculo
aberto + atividade recente), não público cadastrado total. Definição exata de
"recente" a cravar na modelagem.
**Status:** Aprovada (princípio fechado).

### D-020 (COMPLEMENTO) — Retenção pós-suspensão (fecha pendência LGPD)
**Decisão:** Suspenso → sem retorno → 12 meses de retenção → descarte.
Ressalva: "descarte" de dado clínico pode exigir ANONIMIZAÇÃO em vez de
exclusão pura, conforme obrigação de guarda. Marcar para revisão jurídica.
**Status:** Aprovada.

### D-021 — Cancelamento, estorno e reembolso (NOVO — a detalhar)
**Escopo:** política de cancelamento de recorrência, estorno/chargeback de
cartão, reembolso parcial/total, e tratamento da taxa FITVO em caso de estorno
(quem arca). Sub-domínio do financeiro com regras explícitas.
**Status:** PENDENTE — detalhar em bloco próprio (não improvisar).

---

## Bloco 6 — Camadas de Abstração (parte 1: IA) + Nota de Chargeback

### D-021 (COMPLEMENTO) — Chargeback vs. Reembolso: distinção crítica
**Esclarecimento:** um aviso de "sem devolução após pagamento" cobre REEMBOLSO
voluntário (que o FITVO/profissional controla), mas NÃO impede CHARGEBACK
(paciente contesta direto na operadora do cartão; estorno forçado, alheio a
qualquer termo do app).
**Desenho correto:** no modelo de split, o risco de chargeback fica com o
Asaas/subconta do profissional — o Asaas debita da subconta de quem recebeu o
split, não da conta do FITVO. Termo de reembolso protege os reembolsos
voluntários; chargeback segue regras da operadora.
**Ação:** incluir aviso de política de reembolso (válido), sem confiar nele
contra chargeback. Redação jurídica do termo importa — revisar no D-021 final.
**Status:** Esclarecido; política formal ainda PENDENTE.

### D-022 — Estratégia de IA: casos de uso e faseamento
**Princípio:** poucos casos de IA com efeito "uau" no MVP; resto pós-MVP.
Escolha por impacto-percebido / esforço.
**MVP:**
- Geração de treino/dieta assistida por IA a partir de parâmetros do paciente
  (carro-chefe; diferencial vs. MFit/Dietbox).
- Assistente de anamnese / estruturação de texto livre em campos.
**Pós-MVP:**
- Análise de evolução do paciente (precisa de histórico acumulado; efeito só
  aparece com o tempo).
- Assistente de chat para paciente/aluno (maior risco regulatório; exige
  guarda-corpos: só fala do plano prescrito, nunca prescreve, sempre remete ao
  profissional).
**Status:** Aprovada (pendente confirmação do usuário sobre a ordem invertida).

### D-023 — Intensidade de IA por nicho (ambição vs. ordem de entrega)
**Ambição final:** IA full para profissional; uso mínimo para paciente
(consumo); full para aluno.
**Ordem de entrega (por segurança):** IA full para PROFISSIONAL primeiro (ele é
responsável técnico e valida a saída). IA para aluno/paciente vem depois, com
guarda-corpos — mesmo que o alvo final seja "full". Motivo: IA falando direto
com leigo sobre saúde é o maior risco; com profissional no meio há filtro.
**Status:** Proposta — aguardando validação do usuário.

### D-024 — Package de abstração de IA (fazer agora)
**Decisão:** criar package de abstração de IA com interface única (gerar texto,
gerar estruturado, embedding) e adaptadores plugáveis por provider (OpenAI,
Anthropic, Gemini, DeepSeek, local). Domínio chama a interface, nunca o
provider. Lançar com 1 provider; adicionar outros = escrever adaptador.
Barato agora, alinhado aos documentos.
**Status:** Aprovada.

---

## Bloco 5/6 — Fechamento de Chargeback/Reembolso + Confirmações de IA

### D-021 (FECHAMENTO) — Regra de chargeback e reembolso por fluxo
**Fluxo B (aluno → profissional):**
- Risco de CHARGEBACK é do PROFISSIONAL. FITVO não contesta (não é dinheiro
  nosso). Asaas debita da subconta do profissional. Profissional aceita termo
  no onboarding financeiro assumindo esse risco; resolução segue regras da
  operadora, não do FITVO.
- REEMBOLSO voluntário: decisão do profissional, dentro da política da
  plataforma (FITVO oferece a ferramenta). Termo ao paciente: reembolsos
  seguem a política do profissional.
- Taxa FITVO sobre a transação: NÃO devolvida em reembolso (serviço de
  processamento foi prestado).
**Fluxo A (profissional → FITVO):**
- Dinheiro do FITVO; sem split. FITVO lida com a operadora se houver contestação.
- Política: SEM reembolso após o trial de 7 dias (trial = "teste antes de
  comprar"). Padrão de mercado, defensável pela existência do trial.
**ATENÇÃO JURÍDICA (pré-lançamento):** redação exata dos termos e conformidade
com o CDC (direito de arrependimento de 7 dias em compra à distância pode
interagir com "sem reembolso"). Regra de negócio e fluxo técnico definidos
aqui; texto legal final é com advogado habilitado. Não é impeditivo.
**Status:** Regra de negócio APROVADA; redação jurídica pendente de advogado.

### D-022 (CONFIRMADO) — Casos de IA no MVP
Geração de treino/dieta assistida + estruturação de anamnese no MVP.
Análise de evolução e chat para aluno = pós-MVP. **Confirmado pelo usuário.**

### D-023 (CONFIRMADO) — Ordem de entrega de IA invertida por segurança
IA full para profissional primeiro; IA para aluno depois, com guarda-corpos.
Alvo final "full" para ambos mantido. **Confirmado pelo usuário.**

---

## Bloco 6 — Camadas de Abstração (parte 2) + Termos + Notificações

### D-025 — Aceite de termos individualizado por contexto e versionado
**Decisão:** Aceite de termos GRANULAR por especialidade/contexto (nutrição,
treino, medicina — cada um com seu termo próprio, pois têm implicações legais
distintas). Aceite VERSIONADO: registrar qual versão do termo a pessoa aceitou
e quando. Quando o termo muda, exigir novo aceite.
**Reembolso (complemento ao D-021):** sem reembolso após contratação — acesso
fica disponível pelos 30 dias independente de uso, além dos 7 dias grátis
prévios. Termos devem deixar isso explícito.
**Status:** Aprovada.

### D-026 — Storage/Cache/Filas: abstração mínima, sem otimização prematura de custo
**Storage:** interface S3-compatible (upload, download, URL assinada) + 1
adaptador. Provedor escolhido por CUSTO DE EGRESS na hora (muitas fotos/docs);
"S3-compatible" ≠ AWS obrigatório. Não acoplar.
**Cache:** Redis, abstração fina (get/set/invalidate). Uso: sessão, rate
limiting, dados quentes.
**Filas:** BullMQ + Redis, abstração para enfileirar jobs. Uso: notificações,
webhooks Asaas, motor de compartilhamento, IA assíncrona.
**Princípio:** abstração existe para testabilidade e desacoplamento do domínio,
NÃO para suportar providers hipotéticos. NÃO otimizar custo de infra no dia 1 —
volume baixo, conta pequena; a abstração permite trocar provider depois sem
refatorar. Pesquisar preços atuais só perto do deploy real.
**Status:** Aprovada.

### D-027 — Notificações multi-canal
**Canais no MVP:** push (FCM), e-mail, in-app (sininho), SMS. WhatsApp FORA do
MVP (aprovação de template + custo = projeto à parte).
**Preferências:** usuário controla canais por tipo de notificação (opt-out de
e-mail é requisito legal).
**Central in-app:** notificações persistem na central até o usuário apagar.
Ao apagar, somem para o usuário (soft delete no sistema). Notificações
sensíveis (financeiras, de consentimento) mantidas em log por obrigação legal
mesmo após "apagadas" da tela — alinhado a "nunca apagar dados automaticamente".
**Status:** Aprovada.

---

## PENDÊNCIAS ATIVAS
- Desconto de periodicidade (trimestral/semestral/anual): configurável pelo
  profissional ou fixo pela plataforma?
- Definição exata de "paciente ativo" (janela de atividade recente).
- Política formal de cancelamento (redação com advogado — pré-lançamento).
- RLS Postgres como defesa em profundidade (baixa prioridade).
- Pesquisa de preços de infra (storage/cache/filas) — quando perto do deploy.

## BLOCOS AINDA NÃO ABERTOS
- Abstração de Auth e Pagamento (fecha o Bloco 6).
- Auth técnica: refresh token, rotação, RBAC técnico, DI no Fastify.
- Estratégia de API: versionamento, erros RFC 7807, idempotência, paginação.
- Estrutura final do monorepo + responsabilidade de cada package.
- Modelagem de domínio detalhada + schema Prisma.

## Bloco 6 — Fechamento: Auth e Pagamento

### D-028 — Abstração de Pagamento (Asaas)
**Decisão:** package de pagamento com interface (criar cobrança, criar
assinatura recorrente, criar split, processar reembolso, tratar webhook) +
adaptador Asaas. Abstração isola o domínio dos detalhes da API do Asaas
(testabilidade + eventual troca futura de gateway). Asaas é central e
BR-específico.
**Status:** Aprovada.

### D-029 — Auth próprio: JWT com rigor de segurança (packages/auth)
**Decisão:** autenticação própria (JWT + refresh), encapsulada em
`packages/auth`. NÃO usar serviço gerenciado (controle, margem, escala; evita
custo por usuário e dependência de terceiro no ativo mais crítico).
**Medidas de segurança obrigatórias:**
- Access token de vida curta + refresh token com ROTAÇÃO a cada uso (novo token
  invalida o anterior).
- DETECÇÃO DE REUSO de refresh token → revoga toda a família de tokens da
  sessão (indício de roubo).
- Revogação real de sessão via rastreamento de refresh tokens no Redis
  (logout, troca de senha, suspeita de invasão matam sessões ativas).
- Hashing com Argon2 (acima do bcrypt).
- Verificação de e-mail obrigatória.
- Rate limiting no login (anti força bruta).
- Recuperação de senha segura (token de uso único, expiração curta).
- Estrutura pronta para MFA desde já (sem retrofit).
**Status:** Aprovada.

### D-030 — MFA pós-MVP
**Decisão:** estrutura pronta no MVP; ativação pós-MVP, começando pelos papéis
sensíveis (admin de clínica, médico).
**Status:** Aprovada.

---

## Bloco 7 — Estratégia de API

### D-031 — Erros: duas camadas (técnica + amigável)
**Decisão:** API devolve erro técnico padronizado (RFC 7807: type, title,
status, detail, rastreamento) para máquina/debug; o front/app TRADUZ para
mensagem amigável ao usuário final ("Não foi possível salvar. Tente
novamente."). As duas camadas convivem — não competem. Mensagem amigável é
OBRIGATÓRIA (requisito explícito do usuário).
**Status:** Aprovada.

### D-032 — Contratos sempre atualizados e documentados
**Decisão:** OpenAPI/Swagger sempre sincronizado com a implementação. Contrato
é fonte de verdade da API; documentação automática. (Casa com regra dos
documentos: "código e documentação nunca devem divergir".)
**Status:** Aprovada.

### D-033 — API privada e segura (padrão de sistema grande)
**Decisão:** API privada, autenticada, com o padrão de segurança de sistema de
grande porte (auth JWT do D-029, RBAC do D-013, rate limiting, CORS restrito,
Helmet, sanitização/validação de entrada — conforme documentos). Nada de
endpoint público sem necessidade.
**Status:** Aprovada.

### D-034 — Versionamento na URL
**Decisão:** versão na URL (/v1/...). Simples e explícito.
**Status:** Aprovada.

### D-035 — Idempotência obrigatória em operações financeiras
**Decisão:** chave de idempotência obrigatória em operações críticas
(pagamento, criação de cobrança, split) para evitar duplicação em caso de
retry. Padrão de gateways sérios.
**Status:** Aprovada.

### D-036 — Paginação híbrida (REVISADO)
**Decisão:** dois padrões, cada um onde serve melhor ao usuário:
- FEEDS que rolam (notificações/sininho, históricos de avaliação/treino/
  pagamento no app): CURSOR-BASED (rolagem infinita, sem repetir/pular itens).
- TABELAS ADMINISTRATIVAS (admin da clínica vendo pacientes, financeiro,
  relatórios): PAGINAÇÃO NUMERADA (offset) — "página 1 de 20", navegação
  salteada, ordenação por coluna. É o que o gestor espera numa tabela.
**Justificativa:** o usuário de tabela administrativa quer navegar por páginas;
o usuário de feed quer rolar. Cada tela usa o padrão adequado.
**Status:** Aprovada (revisado após decisão do usuário: tabelas admin por
paginação, não rolagem).

---

## Bloco 8 — Estrutura do Monorepo

### D-037 — Monorepo único (Turborepo + pnpm workspaces)
**Decisão:** TODO o projeto num único monorepo. Ao abrir a pasta `fitvo/` no
editor, todas as pastas estão visíveis (apps + packages). Apps são
independentes (build/deploy próprios), mas coabitam o mesmo repositório.
Esclarecimento de vocabulário: "apps separados" = aplicações independentes,
NÃO repositórios separados.
**Status:** Aprovada.

### D-038 — Apps
```
apps/
  api/          # Modular monolith (Fastify). Vertical slice por domínio.
  worker/       # BullMQ: notificações, webhooks Asaas, IA async, motor de
                # compartilhamento (D-017), régua de cobrança.
  mobile/       # Expo. App "3-em-1" (aluno + profissional), contextos por
                # especialidade.
  web-personal/ # Next.js. Painel do profissional/clínica. Deploy próprio.
  web-admin/    # Next.js. Super Admin FITVO. Deploy próprio, SEPARADO do
                # web-personal.
  site/         # Next.js. Landing/institucional/marketing.
```
**Status:** Aprovada.

### D-039 — Packages
```
packages/
  auth/            # JWT + refresh rotation + revogação (D-029).
  payments/        # Asaas: cobrança, recorrência, split, reembolso, webhook (D-028).
  ai/              # Multi-provider, interface única + adaptadores (D-024).
  storage/         # S3-compatible (D-026).
  cache/           # Redis (D-026).
  queue/           # BullMQ (D-026).
  notifications/   # Multi-canal: push/email/in-app/SMS (D-027).
  database/        # Prisma schema, migrations, client.
  contracts/       # Tipos/DTOs compartilhados + OpenAPI (D-032).
  validation/      # Schemas Zod compartilhados.
  ui-web/          # Design system WEB (React).
  ui-mobile/       # Design system MOBILE (React Native).
  brand-tokens/    # (PROPOSTO) tokens de marca compartilhados: cores (verde
                   # FITVO), tipografia, espaçamento — fonte única consumida
                   # pelos dois design systems. AGUARDA validação do usuário.
  config/          # Config compartilhada.
  observability/   # Logging estruturado, request/correlation ID, tracing.
  eslint-config/   # ESLint compartilhado.
  typescript-config/ # tsconfig base.
  testing/         # Utilitários de teste.
```
**Status:** Aprovada (brand-tokens pendente de OK).

### D-040 — Organização interna da API: vertical slice por domínio
**Decisão:** cada domínio é uma fatia vertical autocontida (auth, patient,
workout, nutrition, billing, consent, professional, clinic...), com suas
camadas internas (domínio, aplicação, infra, interface). Facilita extração
futura para serviço sem grande refatoração.
**Status:** Aprovada.

---

### D-039 (COMPLEMENTO) — brand-tokens confirmado; design system a definir
**Confirmado:** package `brand-tokens` compartilhado (cores, tipografia,
espaçamento) consumido pelos dois design systems.
**IMPORTANTE:** design system, LOGO e paleta ainda NÃO estão definidos. Qualquer
cor/marca em memória ("verde vibrante" etc.) é PROVISÓRIA. Definir formalmente
em bloco de design próprio antes de qualquer UI final.
**Status:** Confirmado.

### D-037/D-038 (CONFIRMADO) — vocabulário do monorepo validado pelo usuário.

---

## Bloco 9 — Modelagem de Domínio

### Parte (a) — Identidade e Papéis

### D-041 — Conta separada de perfis de papel
**Decisão:** `account` (identidade: e-mail, senha, nome, documento) é separada
dos PERFIS de papel (`professional_profile`, `patient_profile`, membership de
clínica/admin). Uma conta = 1 login = N papéis. NÃO usar tabela única de
usuário com "tipo" fixo.
**Sustenta:** Léo (nutricionista + educador físico), admin-que-também-atende,
profissional-que-também-é-paciente.
**Status:** Aprovada.

### D-042 — Login por e-mail
**Decisão:** identificador de login principal = e-mail (universal, serve para
profissional remoto global). E-mail único por conta.
**Status:** Aprovada.

### D-043 — Documento fiscal obrigatório, tipo conforme papel
**Decisão:** documento obrigatório no cadastro.
- Clínica (tenant): SEMPRE CNPJ (mora na entidade `clinic`/tenant).
- Profissional (médico/nutricionista/educador): CPF ou CNPJ (atua como PF ou
  PJ/MEI).
- Paciente: CPF.
- Documento da PESSOA mora na `account`; documento da CLÍNICA mora no tenant.
**UX de pagamento:** documento do pagador vem AUTOPREENCHIDO (já existe no
cadastro); escolhe pessoa vs. clínica conforme quem paga. Reduz fricção (D-018).
**Anti-abuso de trial:** trial por CPF/CNPJ (D-019) usa esse documento.
**Status:** Aprovada.

### D-044 — Conta multi-papel: profissional + paciente simultâneos
**Decisão:** uma mesma conta pode acumular papel de profissional E de paciente
ao mesmo tempo (ex.: personal que treina com outro personal). Perfis
independentes sob a mesma conta.
**Status:** Aprovada.

---

### Parte (b) — Clínica, Profissional e Especialidade

### D-045 — Todo profissional pertence a um tenant
**Decisão:** solo = tenant de 1 pessoa (criado automaticamente no cadastro).
Clínica = tenant multi-profissional. Mesma estrutura para ambos.
**Status:** Aprovada.

### D-046 — Verificação de registro POR especialidade
**Decisão:** verificação (D-010) é por especialidade, não por profissional.
Léo tem CREF (educador) e CRN (nutricionista) verificados separadamente. Cada
`professional_specialty` tem seu próprio status de verificação.
**Status:** Aprovada.

### D-047 — Especialidades = lista fixa da plataforma (MVP)
**Decisão:** especialidades são catálogo fixo controlado pela plataforma
(treino, nutrição, medicina...). Sem especialidade livre no MVP.
**Status:** Aprovada.

### D-048 — Onboarding de profissional na clínica: só por convite
**Decisão:** clínica cadastra profissional pelo painel admin → link → cadastro
→ acesso ao app já dentro do workspace, com permissões/contextos. É a ÚNICA
porta de entrada para uma clínica. Quem se cadastra por fora (app/web) só vira
profissional INDEPENDENTE.
**Consequência de modelagem:** "convite de profissional" (admin→profissional) é
um TIPO de convite distinto do "convite de paciente" (profissional→paciente,
D-006). Dois fluxos, regras diferentes.
**Status:** Aprovada.

### D-049 — Clínica = workspace concentrador
**Decisão:** clínica é um workspace que concentra vários profissionais e suas
informações, sob um admin.
**Status:** Aprovada.

### D-050 — Taxa FITVO na clínica: split com taxa MENOR (RESOLVIDO)
**Decisão:** dinheiro paciente↔profissional dentro da clínica TAMBÉM passa pelo
split do FITVO. Preserva dados financeiros granulares (D-018) e aplica taxa
MENOR que a do profissional solo — vira diferencial comercial para clínicas
("menor taxa por transação") sem perder receita nem visibilidade.
**Modelagem:** a TAXA é atributo CONFIGURÁVEL por tenant/plano (solo = taxa
maior; clínica = taxa menor; clínica grande = taxa negociável no futuro). NÃO
hardcoded.
**Status:** Aprovada.

### D-051 — Verificação sempre individual pela plataforma (RESOLVIDO)
**Decisão:** mesmo cadastrado por uma clínica, o profissional passa pela
verificação de registro da PLATAFORMA (CREF/CRM por especialidade). A clínica
NÃO atesta habilitação por conta própria. Profissional cadastrado NÃO atende
até a plataforma verificar seu registro naquela especialidade.
**Justificativa:** protege o FITVO juridicamente — não-habilitado atendendo
pela plataforma gera responsabilidade para o FITVO independente de quem cadastrou.
**Status:** Aprovada.

---

### Parte (c) — Paciente, Vínculo, Convite e Consentimento

### D-052 — Vínculo = paciente ↔ (profissional + especialidade); "ambientes"
**Decisão:** o vínculo (`bond`) conecta paciente a um profissional NUMA
especialidade. Léo educador + Léo nutricionista = DOIS vínculos.
**Materialização na UX (visão do usuário):** o app tem AMBIENTES por
especialidade (contextos), habilitados conforme o contratado — "vários apps
dentro do mesmo app". Cada ambiente = um vínculo. Trocar de tab/menu = trocar
de vínculo. O app mostra só o que pertence àquele vínculo.
**Consequência (resolve requisito do Bloco 1):** paciente nunca vê dados de um
profissional dentro do ambiente de outro. Dados corporais duplicados
(D-004) ficam isolados por ambiente — resolve o "não confundir o aluno".
**Vínculo é a entidade central:** anamnese, avaliações, treinos, cobranças —
tudo pendura no vínculo.
**Status:** Aprovada.

### D-053 — Encerramento de vínculo preserva histórico
**Decisão:** vínculo encerrado vira ARQUIVO; dados preservados (nunca apagar +
guarda legal de dado clínico). Paciente continua vendo o histórico dele após o
encerramento. Profissional mantém o registro conforme obrigação de guarda.
**Status:** Aprovada.

### D-054 — Consentimento granular por profissional
**Decisão:** paciente autoriza CADA compartilhamento individualmente, por
profissional (reafirma D-016). Sem "modo compartilhar geral"; sem
compartilhamento automático intra-clínica.
**Status:** Aprovada.

### D-055 — Convite de paciente: 7 dias, reenviável
**Decisão:** convite profissional→paciente (D-006) expira em 7 dias, reenviável.
Estados: enviado, aceito, expirado, recusado (+ reenviado).
**Status:** Aprovada.

---

### Parte (d) — Financeiro

### D-056 — Duas frentes de cobrança
**Frente 1 — Assinatura (Fluxo A: profissional/clínica → FITVO):** tenant tem
`plan` + `subscription` recorrente. Régua de avisos/suspensão (D-020) no fim do
período contratado. Sem reembolso após contratação (D-025).
**Frente 2 — Cobrança de paciente (Fluxo B: paciente → profissional, split):**
profissional emite `charge` (boleto/PIX/cartão) contra um vínculo; paciente
paga; Asaas faz split (parte do profissional na subconta + taxa FITVO por
tenant, D-050); webhook atualiza status em tempo real (D-018); chargeback é
risco do profissional (D-021).
**Registro:** ambas geram `payment`/`transaction` com IDs de correlação do Asaas.
**Status:** Aprovada.

### D-057 — Dois níveis de "plano" (distinção crítica)
**Nível 1 — Plano da plataforma (FITVO→profissional):** pacotes que o FITVO
vende (estagiário até 2 alunos, solo, clínica-por-pacientes). Preços definidos
pela plataforma.
**Nível 2 — Plano do profissional (profissional→paciente):** valores que o
PROFISSIONAL define para cobrar seus pacientes (ex.: mensal R$300, tri R$800).
Profissional monta os planos; cobrança do aluno roda automática.
**Status:** Aprovada.

### D-058 — Precificação do Nível 1: pagamento adiantado com desconto progressivo
**Decisão:** planos FITVO têm 4 periodicidades: mensal (preço cheio, recorrente)
e trimestral/semestral/anual (pagamento INTEIRO adiantado do período, preço
proporcional MENOR, desconto progressivo). Melhora fluxo de caixa + retenção.
**Régua (D-020):** aplica no fim do PERÍODO CONTRATADO (renovação), não todo mês.
**Modelagem:** desconto por periodicidade é CONFIGURÁVEL (preço por combinação
plano×periodicidade armazenado; não hardcoded). Igual à taxa por tenant (D-050).
**Status:** Aprovada.

### D-059 — Plano do Nível 2 definido pelo profissional, cobrança automática
**Decisão:** profissional define preços/periodicidades dos planos dele; cobrança
do aluno fica automática (recorrência Asaas).
**Status:** Aprovada.

### D-060 — Definição de "paciente ativo" (fecha D-019b)
**Decisão:** paciente ATIVO = vínculo com cobrança ativa/paga no período.
Conta quem gera receita (cobrança paga vigente), não quem só está cadastrado.
Amarra o limite do plano à realidade financeira.
**Status:** Aprovada.

### D-061 — Carteira/extrato do profissional no FITVO
**Decisão:** profissional tem carteira/extrato dentro do app (recebido, a
receber, taxas), sem depender do painel Asaas. Reforça lock-in (D-018) e
alimenta dashboards.
**Status:** Aprovada.

### D-062 — Cobrança de paciente: avulsa E recorrente
**Decisão:** profissional pode emitir cobrança AVULSA (consulta única) e
RECORRENTE (mensalidade). Avulsa é essencial para médico/nutrólogo (consulta
única comum).
**Status:** Aprovada.

---

### Parte (e) — Domínios de Conteúdo (ESQUELETO LEVE — detalhar por fase)

### D-063 — Estrutura dos domínios de conteúdo (esqueleto)
**Treino (ref. MFit/Personal Fit/Tecnofit):** `exercise` (biblioteca), `workout`/
`routine` (ficha/programa), séries/repetições/carga/descanso. Pendura no vínculo
de treino.
**Nutrição (ref. Dietbox):** `meal_plan`, refeições, base de alimentos (ex.:
TACO/USDA), cálculo de macros. Pendura no vínculo de nutrição.
**Médico/nutrologia (MVP enxuto, D-011):** atendimento, anotações de consulta,
prontuário, folha de receita IMPRESSA (não eletrônica). Anamnese/prontuário são
o núcleo. Pendura no vínculo médico.
**Transversal:** anamnese, avaliação física, medidas, fotos de evolução —
versão por especialidade, isolada por vínculo (D-004/D-052).
**Nota:** detalhamento fino (campos exatos, estrutura de série etc.) fica para
a fase de cada domínio, com a referência aberta. Estruturais decididos aqui.
**Status:** Aprovada (esqueleto).

### D-064 — Bibliotecas: base compartilhada + itens próprios
**Decisão:** plataforma fornece catálogo base (exercícios com vídeo/descrição,
alimentos com dados nutricionais); profissional usa e complementa com itens
próprios. Itens próprios são PRIVADOS do profissional por padrão (não aparecem
para outros). Curadoria futura pode promover itens bons à base compartilhada.
**Valor:** reduz atrito de entrada (sem tela vazia) + biblioteca curada vira
ativo/diferencial de marketing difícil de copiar.
**Status:** Aprovada.

### D-065 — Anamnese/avaliação com modelo por especialidade
**Decisão:** cada especialidade (treino/nutrição/médico) tem modelo PRÓPRIO de
campos de anamnese e avaliação. Sem formulário genérico único. Casa com
ambientes isolados por vínculo (D-052).
**Status:** Aprovada.

---

## BLOCO 9 COMPLETO — modelagem de domínio fechada (identidade, prestador,
## relacionamento, financeiro, esqueleto de conteúdo).

## Bloco 10 — Fundação Técnica e Operação

### D-066 — i18n preparado, lançamento em pt-BR
**Decisão:** estrutura preparada para i18n desde já (textos externalizados, não
hardcoded); lançamento só em pt-BR. Adicionar idioma no futuro = novo arquivo
de tradução, sem caçar strings. Custo ~zero agora.
**Status:** Aprovada.

### D-067 — Datas/horas em UTC no banco, conversão na exibição
**Decisão:** tudo em UTC no banco; conversão para o fuso do usuário só na
exibição. Cada usuário tem fuso preferido no perfil. Evita erro de horário em
atendimento cross-fuso (agenda, cobrança, check-in).
**Status:** Aprovada.

### D-068 — Ambientes: Dev + Staging + Produção
**Decisão:** três ambientes. Staging homologa a build real antes de promover à
produção. Cada ambiente com suas variáveis/secrets isolados.
**Status:** Aprovada.

### D-069 — Dinheiro em centavos (inteiro), nunca float
**Decisão:** todo valor monetário como INTEIRO em centavos; formatação "R$ X,XX"
só na exibição. Regra INEGOCIÁVEL — float causa erro de arredondamento,
inaceitável em sistema com split de dinheiro de terceiros.
**Status:** Aprovada.

---

### D-070 — Estratégia de testes: pirâmide com foco no core
**Decisão:** unit + integração concentrados no CORE de risco (auth, financeiro/
split, consentimento, motor de compartilhamento); E2E nos fluxos CRÍTICOS
(login, cobrança, aceite de convite). Não perseguir cobertura total —
priorizar comportamento e risco. Evitar excesso de mocks (docs).
**Status:** Aprovada.

### D-071 — CI bloqueia merge (branch protection)
**Decisão:** Pull Request só faz merge se TODAS as etapas passarem: lint,
typecheck, testes, build, security scan, dependency scan. Falhou qualquer uma →
merge bloqueado. Torna real a regra dos documentos ("nenhum código aceito se
qualquer etapa falhar").
**Status:** Aprovada.

### D-072 — CI/CD no GitHub Actions
**Decisão:** GitHub Actions. Integra com o repo, gratuito no início, padrão de
mercado.
**Status:** Aprovada.

### D-073 — Observabilidade desde o dia 1
**Decisão:** log estruturado em JSON + request ID + correlation ID desde o
início; health checks. Gancho preparado para Sentry e OpenTelemetry (tracing)
futuros. Permite rastrear requisição inteira em produção. Alinhado à regra
"observabilidade nunca depois".
**Status:** Aprovada.

---

## BLOCO 10 COMPLETO — fundação técnica e operação fechada.

## ===== PLANEJAMENTO ESTRUTURAL FITVO: COMPLETO (73 decisões, D-001 a D-073) =====
## Pronto para gerar CLAUDE.md (enxuto) + ADRs separados por decisão.
## Fora do escopo agora (por sequência/terceiros): detalhe fino de conteúdo por
## fase; design system + logo (bloco próprio); redação jurídica dos termos.
