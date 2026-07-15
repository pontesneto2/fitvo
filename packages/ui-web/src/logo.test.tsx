import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Logo } from './logo';

describe('Logo (web)', () => {
  it('wordmark auto: renderiza a arte light E dark (alternadas por tema)', () => {
    render(<Logo />);
    const arts = screen.getAllByRole('img', { name: 'FITVO' });
    expect(arts.length).toBe(2);
    expect(arts[0]?.innerHTML).toContain('<svg');
    // uma escondida no light, a outra no dark
    expect(arts.some((a) => a.className.includes('dark:hidden'))).toBe(true);
    expect(arts.some((a) => a.className.includes('hidden'))).toBe(true);
  });

  it('theme explícito renderiza uma única arte, com a altura de `size`', () => {
    render(<Logo theme="light" size={48} />);
    const art = screen.getByRole('img', { name: 'FITVO' });
    expect(art.style.height).toBe('48px');
    // FIT em brand-500 (#0fa678) presente na arte light
    expect(art.innerHTML.toLowerCase()).toContain('#0fa678');
  });

  it('variante icon: símbolo provisório com traço brand-500 e detalhe energy-400', () => {
    render(<Logo variant="icon" title="FITVO" />);
    const icon = screen.getByRole('img', { name: 'FITVO' });
    const html = icon.innerHTML.toLowerCase();
    expect(html).toContain('#0fa678'); // traço do "V" (brand-500)
    expect(html).toContain('#00e676'); // detalhe de energia (energy-400)
  });

  it('title customiza o rótulo acessível', () => {
    render(<Logo theme="dark" title="FITVO — início" />);
    expect(screen.getByRole('img', { name: 'FITVO — início' })).toBeTruthy();
  });
});
