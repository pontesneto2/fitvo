import { hash, verify } from '@node-rs/argon2';

import type { PasswordHasher } from './types';

/**
 * Hasher de senha com Argon2id (D-029). Parametros conservadores e seguros por
 * padrao; ajustaveis por ambiente se necessario.
 */
export class Argon2PasswordHasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return hash(plain);
  }

  async verify(hashed: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashed, plain);
    } catch {
      // Hash malformado ou incompativel — trata como nao-correspondente.
      return false;
    }
  }
}
