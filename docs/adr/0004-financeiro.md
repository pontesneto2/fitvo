# ADR-0004 — Financeiro: Cobrança, Split e Planos

**Status:** Aceito
**Decisões cobertas:** D-018 a D-021, D-025, D-050, D-056 a D-062, D-069
**Revisado:** 2026-07-17 — correção do D-021 (taxa FITVO no estorno é
comportamento do gateway, não uma escolha) e registro de fatos verificados da
mecânica de split do Asaas que confirmam o D-018.

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

**Mecânica do split (fatos verificados do Asaas — confirmam o D-018):**
- A cobrança é criada na subconta do **profissional** (quem prestou o serviço),
  com o FITVO como recebedor do split. O dinheiro nunca passa pela conta do
  FITVO — confirma o D-018.
- A taxa do Asaas é descontada **antes** do split; o split percentual incide
  sobre o `netValue`, não sobre o valor bruto. Ex.: cobrança de R$ 200 no
  cartão → Asaas desconta R$ 6,47 → netValue R$ 193,53 → split de 2% do FITVO
  rende R$ 3,87 (não R$ 4,00). A taxa do FITVO é margem limpa; o profissional
  absorve o custo do gateway.

**Custos do Asaas (referência — recaem sobre o profissional, não o FITVO):**
- **PIX:** R$ 1,99 fixo por transação recebida (R$ 0,99 nos 3 primeiros meses).
- **Boleto:** R$ 3,49 por cobrança recebida.
- **Cartão:** 2,99% + R$ 0,49, fixa independente do número de parcelas.

**Taxa:** configurável por tenant. Solo paga taxa maior; clínica paga taxa menor
(diferencial comercial). Dentro da clínica o dinheiro também passa pelo split
(preserva dados granulares).

**Chargeback vs. reembolso:**
- Chargeback no Fluxo B é risco do profissional (Asaas debita da subconta dele);
  FITVO não contesta. Profissional aceita esse risco no onboarding.
- Reembolso voluntário é decisão do profissional.
- **Taxa FITVO em caso de ESTORNO:** é estornada automaticamente pelo Asaas
  junto com o split — em estorno total da cobrança, o split também é estornado
  e todas as contas que receberam saldo têm a transferência revertida.
  Comportamento do gateway, **não configurável**. Aceito — estorno é evento
  raro e contornar o comportamento do gateway (cobrar a taxa por fora) traria
  complexidade desproporcional.
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
- **Cobrar a taxa FITVO fora do split** para preservá-la no estorno: rejeitado
  por complexidade desproporcional a um evento raro (ver D-021 — o Asaas estorna
  o split inteiro e não há como reter a taxa dentro do gateway).

## Consequências

- Dados financeiros ricos (faturamento, inadimplência, ticket) → dashboards e
  futuros produtos de crédito; lock-in saudável.
- Política de cancelamento/estorno precisa de redação jurídica (CDC, direito de
  arrependimento) antes do lançamento — pendência de advogado.
- **Nota fiscal (pendência operacional, não de engenharia):** o FITVO precisa
  emitir NF sobre o valor que recebe via split — é receita. Item para o
  contador.
