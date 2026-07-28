import { describe, expect, it } from 'vitest';

import { generateInviteToken, hashInviteToken } from './invite-token';

describe('invite-token', () => {
  it('gera tokens unicos e seguros para URL', () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).not.toBe(b);
    // base64url: sem +, / ou = e nao vazio.
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThan(20);
  });

  it('hasheia de forma deterministica (sha256 hex de 64 chars)', () => {
    const token = generateInviteToken();
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(hashInviteToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('nunca devolve o token em claro (hash != token)', () => {
    const token = generateInviteToken();
    expect(hashInviteToken(token)).not.toBe(token);
  });

  it('produz hashes distintos para tokens distintos', () => {
    expect(hashInviteToken(generateInviteToken())).not.toBe(hashInviteToken(generateInviteToken()));
  });
});
