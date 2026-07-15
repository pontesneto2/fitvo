import { cssVarNames, semanticColors } from '@fitvo/brand-tokens';
import { describe, expect, it } from 'vitest';

import { buildThemeCss } from './css-variables';
import { fitvoTailwindPreset, fitvoTailwindTheme } from './tailwind-preset';

describe('buildThemeCss', () => {
  const css = buildThemeCss();

  it('emite os blocos :root (light) e .dark (dark)', () => {
    expect(css).toContain(':root {');
    expect(css).toContain('.dark {');
  });

  it('inclui todas as CSS vars semanticas nos dois modos', () => {
    for (const varName of Object.values(cssVarNames)) {
      expect(css).toContain(`${varName}:`);
    }
    // Uma var por modo => cada nome aparece exatamente duas vezes.
    const occurrences = css.split(`${cssVarNames.textPrincipal}:`).length - 1;
    expect(occurrences).toBe(2);
  });

  it('usa o valor light no :root e o dark no .dark', () => {
    const [root, dark] = css.split('.dark {');
    expect(root).toContain(semanticColors.surfaceBase.light);
    expect(dark).toContain(semanticColors.surfaceBase.dark);
  });

  it('respeita seletores customizados', () => {
    const scoped = buildThemeCss({
      rootSelector: '[data-theme="light"]',
      darkSelector: '[data-theme="dark"]',
    });
    expect(scoped).toContain('[data-theme="light"] {');
    expect(scoped).toContain('[data-theme="dark"] {');
  });
});

describe('fitvoTailwindTheme', () => {
  it('mapeia cores semanticas para var(--token) sob chave Tailwind limpa', () => {
    // Chave limpa (fg/surface/line), sem o "duplo" text-text-*/border-border-*;
    // a CSS var canonica permanece --text-*/--surface-*.
    expect(fitvoTailwindTheme.colors['surface']).toBe('var(--surface-base)');
    expect(fitvoTailwindTheme.colors['fg']).toBe('var(--text-principal)');
    expect(fitvoTailwindTheme.colors['fg-subtle']).toBe('var(--text-sutil)');
    expect(fitvoTailwindTheme.colors['line']).toBe('var(--border-default)');
    expect(fitvoTailwindTheme.colors['focus']).toBe('var(--focus-ring)');
  });

  it('expoe as rampas primitivas como valor fixo', () => {
    expect(fitvoTailwindTheme.colors.brand).toMatchObject({ 500: expect.any(String) });
    expect(fitvoTailwindTheme.colors.white).toBe('#FFFFFF');
  });

  it('converte escalas numericas para px', () => {
    expect(fitvoTailwindTheme.spacing['4']).toBe('16px');
    expect(fitvoTailwindTheme.borderRadius.lg).toBe('16px');
    expect(fitvoTailwindTheme.fontSize.body).toBe('16px');
  });

  it('flat nao tem sombra', () => {
    expect(fitvoTailwindTheme.boxShadow.flat).toBe('none');
  });
});

describe('fitvoTailwindPreset', () => {
  it('ativa darkMode por classe e embute o tema', () => {
    expect(fitvoTailwindPreset.darkMode).toBe('class');
    expect(fitvoTailwindPreset.theme.extend).toBe(fitvoTailwindTheme);
  });
});
