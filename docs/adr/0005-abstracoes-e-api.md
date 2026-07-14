# ADR-0005 — Camadas de Abstração, IA, Notificações e API

**Status:** Aceito
**Decisões cobertas:** D-022 a D-028, D-031 a D-036, D-025

## Contexto

Os documentos do projeto pedem que o domínio nunca dependa de tecnologia
concreta, com packages de abstração plugáveis. A API deve seguir padrões de
sistema grande. A IA é diferencial, mas tem risco quando fala com leigos.

## Decisão

**Abstrações (packages):** IA, storage, cache, filas, notificações, auth,
pagamento — cada um com interface própria e adaptador. O domínio chama a
interface, nunca o provider. Nível de abstração mínimo: existe para
testabilidade e desacoplamento, não para suportar providers hipotéticos. Não
otimizar custo de infra no dia 1 (a abstração permite trocar depois).

**IA:**
- Package multi-provider (interface única: gerar texto, gerar estruturado,
  embedding) com adaptadores (OpenAI, Anthropic, Gemini, DeepSeek, local).
  Lançar com 1 provider; adicionar outro = novo adaptador.
- MVP: geração de treino/dieta assistida + estruturação de anamnese.
- Pós-MVP: análise de evolução; chat para paciente (com guarda-corpos: só fala
  do plano prescrito, nunca prescreve, sempre remete ao profissional).
- Intensidade final: full para profissional; full para aluno; mínima para
  paciente/consumo. Ordem de entrega: profissional primeiro (ele valida a
  saída), aluno depois com guarda-corpos.

**Notificações:** multi-canal — push (FCM), e-mail, in-app (sininho), SMS.
WhatsApp fora do MVP. Usuário controla preferências por canal. Central in-app
persiste até o usuário apagar (soft delete); notificações sensíveis
(financeiras, de consentimento) mantidas em log por obrigação legal.

**Storage/cache/filas:** storage S3-compatible (escolher provedor por custo de
egress; "S3-compatible" ≠ AWS obrigatório); cache Redis; filas BullMQ + Redis.

**Pagamento:** abstração sobre o Asaas (cobrança, recorrência, split, reembolso,
webhook).

**API:**
- Erros em duas camadas: técnico padronizado (RFC 7807) + tradução amigável no
  front (mensagem amigável é obrigatória).
- Contratos OpenAPI/Swagger sempre sincronizados com a implementação.
- API privada, autenticada, com segurança de sistema grande (JWT, RBAC, rate
  limiting, CORS restrito, Helmet, sanitização/validação).
- Versão na URL (`/v1/...`).
- Idempotência obrigatória em operações financeiras.
- Paginação híbrida: cursor nos feeds que rolam; paginação numerada (offset) nas
  tabelas administrativas.

**Termos:** aceite granular por contexto (nutrição/treino/medicina, cada um com
seu termo) e versionado (registrar qual versão foi aceita e quando).

## Alternativas consideradas

- **Abstração pesada "multi-cloud" desde já:** overengineering; viola a
  prioridade de simplicidade. Rejeitado — abstração fina.
- **Cursor em tudo ou offset em tudo:** cada tipo de tela tem necessidade
  distinta. Optou-se por híbrido.
- **IA full para o aluno desde o lançamento:** maior risco regulatório (IA
  falando de saúde com leigo). Adiada com guarda-corpos.

## Consequências

- Trocar de provider (IA, storage, gateway) é escrever um adaptador, não
  refatorar o domínio.
- Um só padrão de erro e contrato em toda a API facilita clientes (web/mobile).
