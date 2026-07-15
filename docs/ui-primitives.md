# UI Primitivos — status de construção

> Complementa `docs/design-system.md` (identidade) e
> `docs/design-system-components.md` (especificação por componente/estado —
> a fonte de verdade de COMO cada um se comporta). Este documento registra O
> QUE JÁ FOI CONSTRUÍDO em `packages/ui-web` e `packages/ui-mobile`, as
> convenções decididas ao longo da construção, e o que falta. Ver
> `docs/roadmap.md` para onde isso se encaixa no plano geral.

## Construídos

Cada primitivo abaixo existe em `ui-web` (React + Tailwind) e `ui-mobile`
(React Native), consumindo `@fitvo/brand-tokens`, com testes e galeria
revisados um a um.

- **Button** (§1) — 5 variantes (primary/energy/secondary/ghost/destructive),
  3 tamanhos, todos os estados.
- **Input + Field + Textarea** (§2 completo + dark §21) — Input
  default/error/success; Textarea multilinha; Field compõe rótulo+ajuda+erro
  com a11y.
- **Checkbox + Radio + Switch** (§4/§5/§6) — controles booleanos, 20px
  (switch 44×24).
- **Select / Dropdown** (§3) — overlay + navegação por teclado; modo
  `searchable` (combobox) estende o mesmo componente.
- **Card** (§7) — container de superfície, elevação semântica, 4 variantes.
- **Badge/Tag** (§8).
- **Tabs** (§9).
- **Menu lateral / Navegação** (§10).
- **Breadcrumb** (§11).
- **Modal/Dialog** (§12).
- **Toast/Notificação** (§13).
- **Tooltip** (§14).
- **Estados de tela — Skeleton/EmptyState/ErrorState** (§15) — estados
  obrigatórios em telas com dados (sucesso é via Toast, não vira componente
  próprio); EmptyState/ErrorState compõem o Button existente.
- **Tabela + Paginação** (§16).
- **Avatar + AvatarGroup** (§18).
- **Logo** — wordmark fechado (Poppins 600, "FIT" `brand-500` / "VO"
  `energy-400`, ver `docs/design-system.md` §9); mark **PROVISÓRIO** (forma
  geométrica, sem símbolo de marca) até o símbolo final ser decidido —
  `showMark={false}` oculta o mark sem tocar o wordmark.

**Pendente** (não construído): Gráficos avançados/domínio (§17, §20 —
reservados para as fases de conteúdo), Onboarding/tour (§20), Impressão
(§20). Ver `docs/roadmap.md` para ordem.

## Convenções decididas

- **Naming semântico web** (evita `text-text-*`/`border-border-*`): chave
  Tailwind = `fg`/`fg-muted`/`fg-subtle` (texto), `surface*` (fundo),
  `line`/`line-hover`/`line-focus` (borda), `focus` (anel). As CSS vars
  `--text-*`/`--border-*` seguem como identidade canônica. Mapa no README do
  `ui-web`.
- **Testes de componente**: web via `@testing-library/react` + jsdom (render
  real); mobile extrai a lógica de cor/tamanho para arquivos `*-variants.ts`
  (sem `react-native`) e testa sob vitest. Render RN completo NÃO montado —
  exigiria harness próprio (jest + preset RN), decisão de infra separada e
  pendente.
- `react-native` e `react` estão no lockfile (peer/dev do `ui-mobile`).
- Web usa classes Tailwind (estados por pseudo-classe, dark pela cascata);
  mobile usa `StyleSheet` + resolver por estado. Superfícies do Input
  dependem do tema (resolver mobile recebe `mode`); rampas do Button são
  agnósticas de tema.
- **Sem dependências novas** além de `react`/`react-native` (peer): nenhum
  primitivo até aqui — incluindo o mark provisório do Logo — usa ícones ou
  SVG externos; quando a decisão do símbolo final do Logo fechar, avaliar se
  entra `lucide-react`/`lucide-react-native` (já a família oficial de ícones,
  `docs/design-system-components.md` §19) ou um asset próprio.

## Pendências

- Harness de teste de render RN (jest + preset RN) — se/quando adotar.
- Cola do preset Tailwind num app real (Next) + `content` apontando para
  `ui-web`.
- Símbolo final do Logo (decisão humana — ver `docs/roadmap.md`, bloqueado
  por responsável).
