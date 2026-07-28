import { createHash, randomBytes } from 'node:crypto';

/**
 * Token de convite — COMPARTILHADO por todos os fluxos de convite (profissional
 * de clinica D-014, paciente D-006, estagiario D-142). Mora em `shared/` e nao
 * num slice porque nao pertence a nenhum: e a mesma disciplina de segredo nos
 * tres. (Vivia em `modules/clinic/`, e o slice de paciente ja importava de la —
 * acoplamento entre slices que a mudanca de casa desfaz.)
 *
 * Mesma disciplina dos tokens de auth (D-029): o segredo em claro
 * (`generateInviteToken`) e entregue ao convidado uma unica vez; o banco guarda
 * apenas o hash (`hashInviteToken`). O token em claro nunca e persistido nem
 * registrado em log.
 */

/** Gera um segredo opaco (256 bits) seguro para URL. */
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hash de armazenamento — o token em claro nunca e persistido. */
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
