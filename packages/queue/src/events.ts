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
