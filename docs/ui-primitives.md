# FITVO — Camada de UI: primitivos (ui-web / ui-mobile)

> Documento versionado da camada de componentes. Complementa
> `design-system.md` (identidade) e `design-system-components.md` (spec por
> componente, fonte da verdade dos estados/tokens). Aqui fica **o que já foi
> construído, como e por quê** — convenções, catálogo, inferências de dark-mode
> e pendências. Materializado a partir da memória de sessão para não se perder.

Pacotes: **`@fitvo/ui-web`** (React + Tailwind, via preset sobre
`@fitvo/brand-tokens`) e **`@fitvo/ui-mobile`** (React Native, `ThemeProvider` +
resolvers por tema). Ambos consumidos como **TS cru** (sem build). Branch de
trabalho: `worktree-brand-tokens`.

## Convenções (decididas com o responsável — seguir sem reinventar)

- **Zero hardcode.** Todo valor visual vem de `@fitvo/brand-tokens`. Se falta
  token, cria-se o token — nunca chumbar valor no componente.
- **Naming semântico web** (evita `text-text-*`/`border-border-*`): `fg`/
  `fg-muted`/`fg-subtle` (texto), `surface`/`surface-raised`/`surface-overlay`
  (fundo), `line`/`line-hover`/`line-focus` (borda), `focus` (anel → `ring-focus`).
  As CSS vars `--text-*`/`--border-*` são a identidade canônica; o preset só
  nomeia a utility. Mapa em `packages/ui-web/src/tailwind-preset.ts`.
- **Padrão de arquivo por componente:**
  - Web: `packages/ui-web/src/<nome>.tsx` (+ `<nome>.test.tsx`, render real via
    `@testing-library/react`+jsdom, sem jest-dom, asserts com `toBeTruthy()`).
  - Mobile: `packages/ui-mobile/src/<nome>-variants.ts` (lógica de cor/dimensão
    PURA, sem `react-native`) + `<nome>-variants.test.ts` (vitest, env node) +
    `<nome>.tsx` (componente RN). **Render RN completo não é montado** — exige
    harness próprio (jest + preset RN), decisão de infra separada e PENDENTE.
- **Controlável:** usa a prop de valor se dada (`value !== undefined`), senão
  estado interno.
- **Overlays** (Select, Modal, Toast, Tooltip): web = elemento posicionado +
  fade/slide por classes condicionais + fecha ao clicar fora / Esc; mobile = RN
  `Modal`/`Animated` (fade/slide), sem medição de layout onde não faz sentido.
- **Ícones:** SVG inline (web) / desenho com `View`/bordas (mobile). **Lucide
  ainda NÃO adotado** — ver Pendências §19.
- **Dark não especificado no doc → inferência documentada** (não improviso):
  superfícies/bordas neutras seguem a regra §21 "sobe na rampa"; cores de
  marca/acento/perigo permanecem agnósticas de tema. **Cada inferência é
  registrada** no doc-comment do componente E no corpo do commit.
- **`exactOptionalPropertyTypes` está ON:** nunca passar `undefined` explícito a
  prop opcional — usar spread condicional `{...(x ? {p:x} : {})}` ou tipar
  `?: T | undefined` no ponto de repasse.
- **Antes de cada componente:** reler a seção § + §0 (tokens de interação) + §21
  (dark) no `design-system-components.md`; confirmar cada token em
  `packages/brand-tokens/src/*.ts`. Estado não especificado → PARAR e perguntar.
- **Verificação antes de cada commit:** `typecheck` + `lint` + `test` dos dois
  pacotes verdes. O hook `lint-staged` reformata (prettier) no commit; rerodar
  `test` sobre o estado commitado. Conventional Commits, `git add` explícito
  (nunca `.`/`-A`), trailer `Co-Authored-By: Claude Opus 4.8 (1M context)`.

## Catálogo de componentes

Cada item: web + mobile + testes + galeria (artifact HTML light/dark), um commit.

| § | Componente | Commit | Notas / inferência de dark |
|---|---|---|---|
| 1 | Button | `71e2792`+`50eb26d` | 5 variantes, 3 tamanhos, todos os estados. |
| 2 | Input/Field/Textarea | `158fd62`+`11be725` | status default/error/success; a11y; `field-styles`/`useFieldColors`. |
| 4/5/6 | Checkbox/Radio/Switch | `1dba87c`+`29f9624` | controles booleanos; `toggle-variants`. Dark §4/§5/§6 inferido (borda semântica + §21). |
| 3 | Select/Dropdown (+searchable) | `9e8b0aa`+`655eb66` | 1º overlay + teclado; combobox estende (não duplica). Menu = `surfaceRaised`. |
| 7 | Card | `87ca24e` | elevação semântica; 4 variantes. "ativo" dark = base `neutral-900`. |
| 8 | Badge/Tag | `0cd5ac7` | 24px, 9 variantes + removível (× hover tom-200). Acentos agnósticos; só `neutral` adapta. |
| 9 | Tabs | `4026660` | indicador 2px DESLIZANTE (web offsetLeft/width; mobile onLayout+Animated); acento por ambiente. Dark: texto ativo acento-700→400; hover neutral-800. |
| 10 | Menu lateral/SideNav | `925b6d5` | item ativo brand-50/700, ícone 600, barra 3px; `href`→`<a aria-current>`. Dark: hover sobe stop; ativo agnóstico. |
| 11 | Breadcrumb | `ff868ea` | atual `aria-current` sem link, separador `/`, hover brand-600 (agnóstico). |
| 12 | Modal/Dialog | `51d3725` | **FOCUS TRAP** manual (web, sem portal/dep, `fixed inset-0`); scrim token; Esc/overlay/× fecham; enter/exit anim. Mobile: RN Modal (blur omitido, sem dep). |
| 13 | Toast | `4e892ad` | `Toast` + fila `ToastProvider`/`useToast` (sem dep). 5 variantes; auto-dismiss 5s (error manual). Superfície tingida agnóstica; título/desc fixam tons ESCUROS nos 2 temas. |
| 14 | Tooltip | `024bff9` | tokens `tooltip`/`tooltip-fg` (INVERTEM); 400/100ms; hover+foco (web), press longo (mobile); aria-describedby+Esc. Sem inferência (doc define os 2 temas). |
| 16 | Tabela + Paginação | `aa42dea` | genérica por colunas; `aria-sort` controlado; `Pagination` numerada (atual brand-500). Mobile = grade compacta (paginação só web). Dark: header=surfaceBase(900), linhas raised(800), hover/sep neutral-700. |
| 18 | Avatar + AvatarGroup | `abe9f0f` | sizes token `avatarSize`; fallback iniciais brand-100/700; borda 2px; grupo "+N". `getInitials` pura. Fallback agnóstico. |
| 15 | Skeleton/EmptyState/ErrorState | `8be0370` | estados de tela; compõem `Button`; `role=alert`; msg amigável (ADR-0005). Skeleton: web pulse nativo / mobile Animated cor; dark neutral-800→700. Sucesso = Toast. |
| 9/20 | Logo + assets de marca | `1aef665`+`8a19427` | wordmark (arte oficial, cores baked=tokens) + **ícone provisório**. Web embute SVG; mobile via `source` PNG do app. |
| 19 | Ícones (Lucide) + componente `Icon` | `757bd88` | `lucide-react`/`lucide-react-native` (imports nomeados, tree-shaking ok). Substitui TODO o SVG inline/desenho manual anterior (Select, Badge, Toast, Modal, Checkbox, Button spinner, Table sort, states, Logo ícone provisório no mobile — agora `SvgXml` da mesma arte do web, não mais um "V" de texto). |

**Contagem de testes:** ui-web **128**, ui-mobile **81**.

## Framework glue (base, commits `a625c13`/`4c83379`/`5fa2104`)

- `ui-web`: `buildThemeCss()` (CSS vars em `:root`/`.dark`) + `fitvoTailwindPreset`
  (semânticos via `var(--token)`, primitivos, escalas não-cor). Tipado por
  estrutura (sem dep `tailwindcss`).
- `ui-mobile`: `themes` (pares light/dark pré-achatados) + `ThemeProvider`/
  `useTheme`. Depende só de `react` (peer); o app alimenta o modo via
  `useColorScheme()` do react-native na borda.

## Pendências (aguardando decisão/execução)

- **§17 Gráficos/dataviz** — DESTRAVADO pelo responsável: **web = Recharts**,
  **mobile = victory-native** (único ponto onde web e mobile não compartilham
  lib — aceitável). Ambos consomem a ordem de séries do §17 e a regra "nunca cor
  como único diferenciador". Roteado ao **agente principal**; ver
  `handoff-design.md`.
- **§20 restante** — ilustrações, gráficos avançados, componentes de domínio,
  onboarding, impressão: DEFERIDO (dependem de decisões que ainda não existem).
  A **logo** já foi definida (símbolo isolado ainda provisório).
- **Harness de render RN** (jest + preset RN) — implementar para tornar os testes
  de mobile completos (hoje cobrem só a lógica pura dos `*-variants`).
- Cola do preset num app real (Next) + `content` do Tailwind apontando p/ ui-web.
