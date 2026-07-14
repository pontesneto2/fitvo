# ADR-0004 — Financeiro: Cobrança, Split e Planos

**Status:** Aceito
**Decisões cobertas:** D-018 a D-021, D-025, D-050, D-056 a D-062, D-069

## Contexto

O FITVO cobra assinatura de profissionais/clínicas e intermedeia o pagamento
paciente→profissional. Intermediar dinheiro de terceiros tem peso regulatório.
O produto quer reunir dados financeiros e manter cobrança fluida.

## Decisão

**Dois fluxos:**
- **Fluxo A (assinatura, profissional/clínica → FITVO):** dinheiro do FITVO.
- **Fluxo B (paciente → profissional):** obrigatório, via **split no Asaas**.
  Cada profissional/clínica tem subconta; o dinheiro nunca passa pela conta do
  FITVO (evita virar facilitador de pagamento). FITVO retém taxa por transação.
  Habilita atendimento remoto global e presencial. Subconta Asaas = passo
  obrigatório do onboarding.

**Split e cobrança:** profissional emite cobrança (boleto/PIX/cartão) contra um
vínculo, avulsa ou recorrente; envio automático ao paciente; webhook do Asaas
atualiza status em tempo real. Idempotência obrigatória nas operações
financeiras.

**Taxa:** configurável por tenant. Solo paga taxa maior; clínica paga taxa menor
(diferencial comercial). Dentro da clínica o dinheiro também passa pelo split
(preserva dados granulares).

**Chargeback vs. reembolso:**
- Chargeback no Fluxo B é risco do profissional (Asaas debita da subconta dele);
  FITVO não contesta. Profissional aceita esse risco no onboarding.
- Reembolso voluntário é decisão do profissional; taxa FITVO não é devolvida.
- Fluxo A: sem reembolso após contratação (há trial de 7 dias antes).

**Planos (dois níveis):**
- **Nível 1 (FITVO→profissional):** pacotes da plataforma (estagiário até 2
  alunos, solo, clínica-por-pacientes). Periodicidades mensal/tri/semestral/
  anual; períodos longos são pagos adiantados e têm desconto progressivo.
  Preços configuráveis (não hardcoded).
- **Nível 2 (profissional→paciente):** o profissional define preços e
  periodicidades; cobrança do aluno é automática.

**Régua de cobrança/suspensão (Fluxo A):** avisos em 3 dias antes → vencimento →
2 dias vencido → 4 dias → suspensão aos 7 dias vencido (app estático, funções
mínimas). Suspensão ≠ exclusão. Trial por CPF/CNPJ.

**Paciente ativo (limite do plano):** vínculo com cobrança ativa/paga no período.

**Carteira/extrato:** o profissional vê recebido/a receber/taxas dentro do FITVO.

**Dinheiro:** sempre inteiro em centavos, nunca float.

**Retenção pós-suspensão:** sem retorno → 12 meses retido → descarte
(possível anonimização de dado clínico, a revisar juridicamente).

## Alternativas consideradas

- **Guarda-e-repassa (dinheiro na conta do FITVO):** transformaria o FITVO em
  instituição de pagamento (obrigações BACEN). Rejeitado — usar split Asaas.
- **Fluxo B opcional / clínica sem split:** perderia dados financeiros
  granulares. Rejeitado — split em todos os casos, com taxa menor na clínica.
- **Float para dinheiro:** erro de arredondamento inaceitável. Rejeitado.

## Consequências

- Dados financeiros ricos (faturamento, inadimplência, ticket) → dashboards e
  futuros produtos de crédito; lock-in saudável.
- Política de cancelamento/estorno precisa de redação jurídica (CDC, direito de
  arrependimento) antes do lançamento — pendência de advogado.
