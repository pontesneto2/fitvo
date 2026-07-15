# @fitvo/ui-mobile

Design system MOBILE (React Native/Expo). Camada de **cola** entre os tokens
framework-neutros de [`@fitvo/brand-tokens`](../brand-tokens) e o runtime RN
(design-system.md §8). Componentes visuais entram aqui conforme
`docs/design-system-components.md` for implementado.

## O que já existe

- **`themes`** — pares `{light,dark}` dos tokens semânticos pré-achatados em dois
  mapas planos `nome -> hex` (RN não tem cascata CSS; resolve em runtime).
- **`ThemeProvider`** / **`useTheme()`** — contexto que expõe o modo corrente e as
  cores já resolvidas. Depende apenas de `react` (não de react-native): o app
  alimenta o modo pela borda.

## Uso

```tsx
import { useColorScheme } from 'react-native';
import { ThemeProvider, useTheme } from '@fitvo/ui-mobile';

function App() {
  const scheme = useColorScheme(); // 'light' | 'dark' | null
  return (
    <ThemeProvider mode={scheme ?? 'light'}>
      <Screen />
    </ThemeProvider>
  );
}

function Screen() {
  const { colors } = useTheme();
  return <View style={{ backgroundColor: colors.surfaceBase }} />;
}
```

Escalas não-cor (espaço, raio, tipografia, sombra via `shadowToNative`) vêm direto
de `@fitvo/brand-tokens`.
