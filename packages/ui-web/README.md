# @fitvo/ui-web

Design system WEB (React/Next + Tailwind). Camada de **cola** entre os tokens
framework-neutros de [`@fitvo/brand-tokens`](../brand-tokens) e o Tailwind
(design-system.md §8). Componentes visuais entram aqui conforme
`docs/design-system-components.md` for implementado.

## O que já existe

- **`buildThemeCss()`** (`@fitvo/ui-web/css`) — gera as CSS custom properties
  semânticas em `:root` (light) e `.dark` (dark). Injetar uma vez no CSS global.
- **`fitvoTailwindPreset`** / **`fitvoTailwindTheme`** (`@fitvo/ui-web/tailwind`)
  — preset Tailwind: cores semânticas via `var(--token)`, rampas primitivas,
  espaçamento, raio, sombra, tipografia e movimento vindos dos tokens.

## Uso

```ts
// tailwind.config.ts
import { fitvoTailwindPreset } from '@fitvo/ui-web/tailwind';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [fitvoTailwindPreset], // darkMode: 'class' já embutido
};
```

```ts
// gerar globals.css (build/script) — ou injetar em <style> no layout raiz
import { buildThemeCss } from '@fitvo/ui-web/css';

const css = buildThemeCss(); // blocos :root e .dark
```

Alternar tema = adicionar/remover a classe `dark` na raiz (`<html>`). As classes
utilitárias seguem o modo ativo sem inversão manual no componente.

### Chaves de cor semântica (Tailwind)

Para evitar o "duplo" feio (`text-text-*`, `border-border-*`), a utility usa nome
limpo; a CSS var canônica (`--text-*`, `--surface-*`, `--border-*`) permanece:

| Token (CSS var)     | Classe Tailwind                          |
|---------------------|------------------------------------------|
| `--text-principal`  | `text-fg`                                |
| `--text-auxiliar`   | `text-fg-muted`                          |
| `--text-sutil`      | `text-fg-subtle`                         |
| `--surface-base`    | `bg-surface`                             |
| `--surface-raised`  | `bg-surface-raised`                      |
| `--border-default`  | `border-line`                            |
| `--border-hover`    | `border-line-hover`                      |
| `--border-focus`    | `border-line-focus`                      |
| `--focus-ring`      | `ring-focus`                             |
| `--tooltip-surface` | `bg-tooltip` / `--tooltip-text` → `text-tooltip-fg` |

As rampas primitivas mantêm o nome (`bg-brand-500`, `text-danger-600`…).
