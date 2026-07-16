import { describe, expect, it } from 'vitest';

import { chartSeries, dashPattern, dashPatterns, seriesColor } from './charts';
import type { ColorName } from './colors';
import { black, colors, stops, white } from './colors';
import { shadows, shadowToCss, shadowToNative } from './elevation';
import { accentRamp, environments } from './environments';
import { focusRing } from './focus';
import { iconFamily, iconSize, iconStroke } from './icons';
import type { SemanticColorName } from './semantic-colors';
import { cssVarNames, semanticColors } from './semantic-colors';
import { cssVarRef, resolveTheme, toCssVariables } from './theme';
import type { Environment } from './types';
import { fontFamily, fontWeight, textStyles } from './typography';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const colorNames = Object.keys(colors) as ColorName[];
const semanticNames = Object.keys(semanticColors) as SemanticColorName[];
const environmentNames = Object.keys(environments) as Environment[];

describe('rampas de cor', () => {
  it('tem exatamente 10 stops canonicos (50 -> 900)', () => {
    expect(stops).toHaveLength(10);
  });

  it('toda rampa tem todos os stops com hex valido', () => {
    for (const name of colorNames) {
      for (const stop of stops) {
        expect(colors[name][stop], `${name}-${stop}`).toMatch(HEX);
      }
    }
  });

  it('white e black sao puros', () => {
    expect(white).toBe('#FFFFFF');
    expect(black).toBe('#000000');
  });
});

describe('tokens semanticos', () => {
  it('todo token tem light e dark validos', () => {
    for (const name of semanticNames) {
      const pair = semanticColors[name];
      expect(pair.light, `${name}.light`).toMatch(HEX);
      expect(pair.dark, `${name}.dark`).toMatch(HEX);
    }
  });

  it('todo token semantico tem uma CSS var nomeada', () => {
    for (const name of semanticNames) {
      expect(cssVarNames[name]).toMatch(/^--[a-z-]+$/);
    }
  });
});

describe('ambientes', () => {
  it('o acento de cada ambiente aponta para uma rampa real', () => {
    for (const env of environmentNames) {
      expect(colorNames).toContain(environments[env].accent);
      expect(accentRamp(env)[500]).toMatch(HEX);
    }
  });
});

describe('resolvedores de tema', () => {
  it('resolveTheme escolhe o valor do modo pedido', () => {
    expect(resolveTheme('light').textPrincipal).toBe(semanticColors.textPrincipal.light);
    expect(resolveTheme('dark').textPrincipal).toBe(semanticColors.textPrincipal.dark);
  });

  it('toCssVariables mapeia nome da var -> valor do modo', () => {
    expect(toCssVariables('dark')['--text-principal']).toBe(semanticColors.textPrincipal.dark);
  });

  it('cssVarRef devolve var(...)', () => {
    expect(cssVarRef('textPrincipal')).toBe('var(--text-principal)');
  });
});

describe('anel de foco e graficos', () => {
  it('a cor do anel de foco tem light e dark', () => {
    expect(focusRing.color.light).toMatch(HEX);
    expect(focusRing.color.dark).toMatch(HEX);
  });

  it('a ordem de series dos graficos tem so cores validas', () => {
    expect(chartSeries.length).toBeGreaterThan(0);
    for (const serie of chartSeries) {
      expect(serie).toMatch(HEX);
    }
  });

  it('seriesColor cicla pela ordem do token chartSeries', () => {
    expect(seriesColor(0)).toBe(chartSeries[0]);
    expect(seriesColor(chartSeries.length)).toBe(seriesColor(0));
  });

  it('dashPattern: solido na 1a serie, tracejados diferentes depois (§17 — cor nao e o unico diferenciador)', () => {
    expect(dashPattern({ key: 'a', label: 'A' }, 0)).toBe('0');
    expect(dashPattern({ key: 'b', label: 'B' }, 1)).not.toBe(
      dashPattern({ key: 'a', label: 'A' }, 0),
    );
  });

  it('dash explicito na config vence o padrao por indice', () => {
    expect(dashPattern({ key: 'a', label: 'A', dash: '4 4' }, 0)).toBe('4 4');
  });

  it('todos os padroes de traco sao distintos entre si', () => {
    expect(new Set(dashPatterns).size).toBe(dashPatterns.length);
  });
});

describe('elevacao', () => {
  it('flat nao tem sombra', () => {
    expect(shadowToCss(shadows.flat.light)).toBe('none');
  });

  it('subtle tem a sombra definitiva do §0', () => {
    expect(shadowToCss(shadows.subtle.light)).toBe('0px 1px 2px 0px rgba(0, 0, 0, 0.04)');
  });

  it('no dark a sombra fica em metade da opacidade', () => {
    expect(shadows.raised.dark.opacity).toBeCloseTo(shadows.raised.light.opacity / 2);
    expect(shadows.overlay.dark.opacity).toBeCloseTo(shadows.overlay.light.opacity / 2);
  });

  it('shadowToNative expoe a elevation dp do Android', () => {
    expect(shadowToNative(shadows.overlay.light).elevation).toBe(8);
  });
});

// Decisoes de design fechadas em 2026-07-15 (design-system.md §9). Estes testes
// travam os valores OFICIAIS — mudar exige decisao explicita, nao acidente.
describe('decisoes de design oficiais', () => {
  it('tipografia: Poppins (titulos) 500/600 e Inter (corpo) 400/500/600', () => {
    expect(fontFamily.heading).toBe('Poppins');
    expect(fontFamily.body).toBe('Inter');
    expect(fontWeight.regular).toBe(400);
    expect(fontWeight.medium).toBe(500);
    expect(fontWeight.semibold).toBe(600);
    // Poppins so nos pesos 500 (H3) e 600 (display/H1/H2); Inter no corpo (400).
    expect(textStyles.h3.fontWeight).toBe(500);
    expect(textStyles.display.fontWeight).toBe(600);
    expect(textStyles.body.fontWeight).toBe(400);
  });

  it('icones: familia Lucide, tamanhos 16/20/24, stroke 1.5', () => {
    expect(iconFamily).toBe('lucide');
    expect(iconSize.sm).toBe(16);
    expect(iconSize.md).toBe(20);
    expect(iconSize.lg).toBe(24);
    expect(iconStroke).toBe(1.5);
  });

  it('dark fino: superficies sobem 900->800->700, foco em brand-400', () => {
    expect(semanticColors.surfaceBase.dark).toBe(colors.neutral[900]);
    expect(semanticColors.surfaceRaised.dark).toBe(colors.neutral[800]);
    expect(semanticColors.surfaceOverlay.dark).toBe(colors.neutral[700]);
    expect(semanticColors.borderFocus.dark).toBe(colors.brand[400]);
    expect(focusRing.color.dark).toBe(colors.brand[400]);
  });
});
