import type { ThemeMode } from '@fitvo/brand-tokens';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ThemeProvider } from './theme-context';

/**
 * Helper de teste (harness de render RN — ui-primitives.md): a maioria dos
 * componentes le `useTheme()`, entao renderizar sem `<ThemeProvider>` lanca. Usar
 * em todo `*.test.tsx` no lugar do `render` cru do RTL.
 */
export function renderWithTheme(ui: ReactElement, mode: ThemeMode = 'light') {
  return render(<ThemeProvider mode={mode}>{ui}</ThemeProvider>);
}

export * from '@testing-library/react-native';
