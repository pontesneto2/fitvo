# Dívida de Hardening da API — Segurança e Estabilidade

> Relatório de estado, ponto no tempo (2026-07-18). Deriva de um diagnóstico
> interno da API contra o que os ADRs prometem: D-033 ("API privada e segura,
> padrão de sistema grande"), D-035 (idempotência financeira) e D-073
> (observabilidade).
>
> **O que este documento faz:** registra **o que falta, o critério de aceite e a
> prioridade** de cada item de dívida. **O que ele deliberadamente NÃO faz:**
> passo-a-passo de exploração, `file:line` de vetor aberto, ou descrição de furo
> ainda não corrigido. Motivo: o repositório é **público** (ver o aviso no topo do
> `CLAUDE.md` — "bots varrem repositórios públicos em minutos"). Um inventário com
> localização e prova de conceito seria um mapa de exploração. O detalhe técnico
> fino é mantido fora do repositório até o item estar corrigido.
>
> A **fonte única do plano** é o `docs/roadmap.md`; este documento é a avaliação
> que o alimenta, não um segundo backlog. A priorização abaixo (1 = morde
> primeiro) é do responsável.

---

## Já fechado

- **P1 — Token de autenticação em log — CORRIGIDO (PR #63).** O stub de e-mail de
  auth passou a registrar **apenas o destinatário**; o logger de abstração ganhou
  `redact` de campos sensíveis como rede de segurança. Os testes foram
  **invertidos**: antes descreviam o comportamento antigo, agora **reprovam** o
  vazamento — se alguém o reintroduzir, o CI pega. É "o que este check reprova?"
  aplicado.

## Saudável hoje (não é dívida — registrado para dar o retrato inteiro)

- **Idempotência financeira (D-035):** real e garantida por restrição de
  unicidade — não há caminho de cobrança duplicada. Cobre cobrança, assinatura e
  o webhook do gateway.
- **Validação de entrada:** uniforme — toda rota valida no framework e revalida
  no handler. Não é "só nas rotas que alguém lembrou".

---

## Dívida priorizada

### P2 — Endurecimento de CORS
- **O que falta:** a política de origem precisa ser **restritiva por padrão**, em
  vez de depender de configuração de ambiente ser lembrada. O ADR-0005 promete
  "CORS restrito"; falta o código honrar isso por construção.
- **Critério de aceite:** sem origem permissiva por default; a ausência de
  configuração explícita em produção **falha no boot, ruidosamente** (nunca cai
  em permissivo em silêncio); comportamento coberto por teste.
- **Área/risco de merge:** `apps/api` (bootstrap). Sem regra de negócio — baixo
  risco.

### P3 — Paginação nas listagens
- **O que falta:** as listagens de coleção ainda não têm paginação nem teto de
  página. O ADR-0005 promete paginação híbrida (cursor/offset). Sem teto, uma
  coleção grande de um único tenant é materializada inteira — **degradação
  acidental, sem má intenção** (uma clínica grande basta).
- **Critério de aceite:** todo endpoint de lista aceita cursor/offset com **teto
  de página aplicado no servidor** (o cliente não amplia o teto); default sensato;
  contrato no OpenAPI; teste que reprova lista sem teto.
- **Área/risco de merge:** `apps/api` + repositórios. Preservar escopo por tenant.

### P4 — Timeout e resiliência de dependências externas (par)
- **O que falta:** não há timeout de request nem de query, e os adapters de
  dependência externa (a começar pelo gateway de pagamento) não têm timeout,
  retry com backoff nem disjuntor. Uma dependência lenta prende o request.
- **Critério de aceite:**
  - timeout de request no servidor **e** timeout de query no banco, configuráveis;
  - todo adapter externo com timeout explícito (via `AbortSignal`), retry com
    backoff para falhas transitórias, e limite de falha / disjuntor;
  - degradação previsível (**erro rápido**) quando a dependência não responde, em
    vez de request pendurado; teste com dependência lenta simulada.
- **Área/risco de merge:** `apps/api` + packages de adapter. **Toca o gateway de
  pagamento → financeiro → revisão humana obrigatória.**

### P5 — Topologia do rate limit
- **O que falta:** o rate limit não usa store compartilhado nem está configurado
  para enxergar o cliente real atrás do proxy de deploy. Nessa topologia ele
  perde eficácia (não sobrevive a reinício, não coordena entre réplicas, e não
  distingue o cliente correto).
- **Critério de aceite:** store compartilhado (o Redis já presente no processo);
  confiança de proxy configurada para a identidade do cliente ser a chave certa;
  os limites por login e globais preservados; comportamento verificado atrás de
  proxy.
- **Área/risco de merge:** `apps/api` (bootstrap) + infra. Sem regra de negócio.

---

## Observabilidade (D-073) — parcial, não bloqueante

- **O que falta:** o correlation ID existe na borda HTTP, mas não se propaga para
  o código de aplicação nem para as chamadas a dependências externas; o log de
  negócio não fica correlacionado ao request. Além disso, o `redact` introduzido
  no PR #63 (e depois estendido a `cookie`/`set-cookie`) cobre o logger de
  abstração, **não** o logger do servidor HTTP — falta estender.
- **Critério de aceite:** contexto de request (request/correlation ID) propagado
  a serviços, repositórios e adapters, incluído no log de negócio e no header de
  saída das chamadas externas; `redact` aplicado também ao logger do servidor.
- **Prioridade:** abaixo de P5 (robustez de operação, não exposição). Entra
  quando o responsável definir.

### Furos remanescentes do `redact` (log de abstração) — parcial, não bloqueante
- **O que falta (maior superfície):** o **logger do servidor HTTP** (Fastify, em
  `apps/api`) é instanciado à parte e **não** passa pelo logger de abstração —
  logo não tem nem `redact` nem `serializers` de request/response. É a maior
  superfície de log (uma linha por request); hoje o serializer padrão não emite
  header nem corpo, mas qualquer log de header/corpo adicionado ali vaza sem
  rede. Duplica, sob outro ângulo, o "falta estender ao logger do servidor" da
  seção acima — o critério de aceite é o mesmo.
- **O que falta (profundidade):** o `redact` do logger de abstração censura o
  campo sensível **no topo e em um único nível** de aninhamento. Um segredo
  aninhado a **dois ou mais níveis** não é censurado. É rede de segurança, não o
  piso (o dever primário segue sendo não logar o segredo na origem), mas a
  cobertura é rasa por construção.
- **Critério de aceite:** logger do servidor coberto por `redact`/`serializers`
  equivalentes aos do logger de abstração; a censura alcança o aninhamento real
  dos payloads logados (não só um nível); comportamento coberto por teste que
  **reprova** o vazamento (não só "passa").
- **Prioridade:** junto da observabilidade acima (rede de segurança, não
  exposição ativa hoje). Entra quando o responsável definir.

---

## A reconciliar / derivados

- **README a reconciliar (repassar à sessão do `web-personal`):** o `README.md`
  em edição por outra sessão descreve o stub de auth **registrando o token no
  console** — comportamento que o PR #63 tornou **falso**. Precisa remover essa
  menção antes de ir para `main`. Documento que mente sobre segurança é pior que
  documento incompleto. (Não editar o arquivo não-commitado de outra sessão — é
  aviso para quem o commitará.)

- **Fluxo de dev de auth (dívida derivada do #63):** fechar o token em log removeu
  o caminho pelo qual o dev obtinha o link de verificação/reset localmente (o
  token é hasheado no banco — sem recuperação). Registrado como **item próprio**
  no `docs/roadmap.md` (BLOQUEADO — RESPONSÁVEL), com a solução recomendada
  (mecanismo dev-only atrás de flag, apenas em `NODE_ENV=development`, que falha
  ruidosamente em produção). Não implementado — o PR mínimo do #63 foi a escolha
  certa; isto é o follow-up.
