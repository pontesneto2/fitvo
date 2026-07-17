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

## Compatibilidade — travas de versão (consumidores)

Quem consome este pacote (o preset + os componentes) herda duas travas, até a
migração de major:

- **Tailwind v3.** O `fitvoTailwindPreset` usa o formato v3 (`presets: []`,
  `theme.extend`, `darkMode: 'class'`). O Tailwind v4 (config CSS-first) exige
  adaptação — não adotar sem migrar o preset.
- **React 18.** `peerDependencies.react` é `>=18` e os tipos/dev são `^18.3`. Um app
  consumidor (ex.: `apps/web-personal`) fica em **React 18**, sobre **Next 15** — cujo
  peer aceita `^18.2.0 || ^19` e **não exige React 19**. (Next 14 ficou fora: tem
  vulnerabilidades High sem correção na linha 14.x — só em 15+; ver troubleshooting.)
  A migração para React 19 (dívida do roadmap — *"não é bump, é migração"*: `ref` vira
  prop) atravessa este pacote, mas é **separada** da versão do Next; quando for feita,
  os apps sobem junto.
