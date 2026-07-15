import { createHash, randomBytes } from 'node:crypto';

/**
 * Token de convite de profissional (D-014). Mesma disciplina dos tokens de auth
 * (D-029): o segredo em claro (`generateInviteToken`) e entregue ao convidado
 * uma unica vez; o banco guarda apenas o hash (`hashInviteToken`). O token em
 * claro nunca e persistido nem registrado em log.
 */

/** Gera um segredo opaco (256 bits) seguro para URL. */
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hash de armazenamento — o token em claro nunca e persistido. */
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
