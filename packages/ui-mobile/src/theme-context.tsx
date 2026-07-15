import type { ResolvedTheme, ThemeMode } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import { createContext, createElement, useContext, useMemo } from 'react';

import { themes } from './themes';

/**
 * Contexto de tema para MOBILE (design-system.md §8). Expoe o modo corrente e as
 * cores semanticas ja resolvidas para aquele modo — o componente le do contexto,
 * nunca inverte cor a mao.
 *
 * O modo e um INPUT: o app Expo alimenta o `useColorScheme()` do react-native
 *   <ThemeProvider mode={useColorScheme() ?? 'light'}>...</ThemeProvider>
 * Assim o package nao depende de react-native (so de react) — a leitura da
 * plataforma fica na borda do app.
 */
export interface Theme {
  readonly mode: ThemeMode;
  readonly colors: ResolvedTheme;
}

const ThemeContext = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  /** Modo ativo (padrao `light`). Ligue ao `useColorScheme()` do react-native. */
  readonly mode?: ThemeMode;
  readonly children: ReactNode;
}

export function ThemeProvider({ mode = 'light', children }: ThemeProviderProps): ReactNode {
  const value = useMemo<Theme>(() => ({ mode, colors: themes[mode] }), [mode]);
  return createElement(ThemeContext.Provider, { value }, children);
}

/** Le o tema corrente. Lanca se usado fora de `<ThemeProvider>`. */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (theme === null) {
    throw new Error('useTheme deve ser usado dentro de <ThemeProvider>.');
  }
  return theme;
}
