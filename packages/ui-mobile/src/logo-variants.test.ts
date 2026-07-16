import { describe, expect, it } from 'vitest';

import { LOGO_WORDMARK_ASPECT } from './logo-variants';

describe('logo-variants (§9/§20)', () => {
  it('proporção do wordmark ~1.642 (largura/altura da arte)', () => {
    expect(LOGO_WORDMARK_ASPECT).toBeCloseTo(1.642, 2);
  });
});
