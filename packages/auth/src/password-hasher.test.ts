import { describe, expect, it } from 'vitest';

import { Argon2PasswordHasher } from './password-hasher';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('gera hash e verifica a senha correta', async () => {
    const hashed = await hasher.hash('senha-super-secreta');
    expect(hashed).not.toBe('senha-super-secreta');
    expect(await hasher.verify(hashed, 'senha-super-secreta')).toBe(true);
  });

  it('rejeita a senha incorreta', async () => {
    const hashed = await hasher.hash('senha-correta');
    expect(await hasher.verify(hashed, 'senha-errada')).toBe(false);
  });

  it('retorna false para hash malformado', async () => {
    expect(await hasher.verify('nao-e-um-hash', 'qualquer')).toBe(false);
  });
});
