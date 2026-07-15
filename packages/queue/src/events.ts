/**
 * Contratos de eventos que trafegam pela fila (D-017). Ficam aqui, junto da
 * abstracao de fila, porque tanto o produtor (API) quanto o consumidor (worker)
 * dependem de @fitvo/queue — e o ponto compartilhado mais limpo (packages/
 * contracts segue sem DTO de negocio). Payloads sao dados puros e serializaveis.
 */

/** Nome da fila do motor de compartilhamento (D-017). */
export const SHARING_QUEUE = 'fitvo-sharing';

/** Nome do job publicado quando um vinculo (bond) e aberto. */
export const BOND_CREATED_EVENT = 'bond.created';

/**
 * Evento `bond.created`: emitido apos o aceite de um convite de paciente abrir
 * um vinculo. Alimenta o motor de deteccao de sobreposicao (D-017). Carrega o
 * tenantId do profissional para preservar o contexto de origem (o motor em si
 * opera sobre o paciente, que e o titular — D-016).
 */
export interface BondCreatedEvent {
  patientProfileId: string;
  professionalProfileId: string;
  specialtyId: string;
  tenantId: string;
}

/** Nome da fila da regua de cobranca (Fluxo A — ADR-0004). */
export const BILLING_QUEUE = 'fitvo-billing';

/**
 * Nome do job repetido (cron) que dispara uma varredura da regua de cobranca. O
 * scheduler enfileira com `repeatEveryMs`; o worker roda a transicao de status +
 * lembretes a cada tick.
 */
export const RULER_TICK_EVENT = 'ruler.tick';

/** Payload do tick da regua — instante da varredura (ISO UTC). Dado puro. */
export interface RulerTickEvent {
  /** Momento de referencia da varredura (ISO 8601, UTC — D-067). */
  at: string;
}

/**
 * Tipo de lembrete da regua de cobranca (ADR-0004): aviso 3 dias antes ->
 * vencimento -> 2 dias vencido -> 4 dias vencido -> suspensao aos 7 dias. A
 * ENTREGA (push/e-mail) e GATED (D-028) — o worker so enfileira o lembrete.
 */
export type SubscriptionReminderKind =
  'pre_due_3d' | 'due' | 'overdue_2d' | 'overdue_4d' | 'suspended';

/** Nome do job de lembrete de assinatura publicado pela regua. */
export const SUBSCRIPTION_REMINDER_EVENT = 'subscription.reminder';

/** Payload do lembrete de assinatura (Fluxo A). Dado puro e serializavel. */
export interface SubscriptionReminderEvent {
  subscriptionId: string;
  tenantId: string;
  kind: SubscriptionReminderKind;
  /** Vencimento do periodo atual (ISO 8601, UTC — D-067). */
  dueDate: string | null;
}
