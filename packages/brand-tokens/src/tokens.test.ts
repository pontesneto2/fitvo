import { describe, expect, it } from 'vitest';

import { chartSeries } from './charts';
import type { ColorName } from './colors';
import { black, colors, stops, white } from './colors';
import { shadows, shadowToCss, shadowToNative } from './elevation';
import { accentRamp, environments } from './environments';
import { focusRing } from './focus';
import type { SemanticColorName } from './semantic-colors';
import { cssVarNames, semanticColors } from './semantic-colors';
import { cssVarRef, resolveTheme, toCssVariables } from './theme';
import type { Environment } from './types';

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
