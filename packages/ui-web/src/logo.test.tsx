import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Logo } from './logo';

describe('Logo (web)', () => {
  it('renderiza o wordmark com FIT em brand-500 e VO em energy-400', () => {
    render(<Logo />);
    const wordmark = screen.getByLabelText('FITVO');
    expect(wordmark.textContent).toBe('FITVO');
    const children = Array.from(wordmark.children) as HTMLElement[];
    const fit = children[0];
    const vo = children[1];
    expect(fit?.textContent).toBe('FIT');
    expect(fit?.className).toContain('text-brand-500');
    expect(vo?.textContent).toBe('VO');
    expect(vo?.className).toContain('text-energy-400');
  });

  it('mostra o mark provisorio por padrao e permite ocultar', () => {
    const { container, rerender } = render(<Logo />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();

    rerender(<Logo showMark={false} />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('tamanho controla a classe de fonte do wordmark', () => {
    render(<Logo size="lg" />);
    expect(screen.getByLabelText('FITVO').className).toContain('text-h1');
  });
});
