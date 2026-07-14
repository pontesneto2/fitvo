import { describe, expect, it } from 'vitest';

import { TESTING_PACKAGE } from './index';

describe('@fitvo/testing', () => {
  it('expoe o identificador do pacote', () => {
    expect(TESTING_PACKAGE).toBe('@fitvo/testing');
  });
});
