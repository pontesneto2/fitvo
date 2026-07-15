# Handoff — fim da sessão de design (camada de UI)

> Esta foi a **última sessão dedicada ao design system**. O trabalho será
> consolidado numa conversa só. Este documento preserva o que ficou pendente, em
> que ordem atacar, e o contexto que só existia nesta sessão.

## Estado entregue

- **Design system de primitivos COMPLETO** (§1–§16, §18, §15) em `ui-web` +
  `ui-mobile`, cada um com testes e galeria. Ver `docs/ui-primitives.md` (catálogo
  + convenções + commits).
- **Logo definida** (wordmark oficial + ícone provisório); regra do wordmark
  corrigida no `design-system.md` §9 e §20.
- Testes: **ui-web 128, ui-mobile 81**. `typecheck`+`lint`+`test` verdes no
  monorepo inteiro. Branch `worktree-brand-tokens`.
- **PR aberto aguardando revisão do responsável** — NÃO fazer auto-merge
  (`--admin`) apesar de UI ser área de auto-merge; o responsável quer revisar
  pelo volume.

## Pendências e ordem de ataque

Roteamento definido pelo responsável (o **agente principal** assume o que sobra):

1. **§19 Ícones (Lucide) — primeiro, é correção de dívida.**
   - Adotar `lucide-react` (ui-web) e `lucide-react-native` (ui-mobile) — mesma
     API, MIT. Já é decisão fechada (`design-system.md` §9, tokens §19: sm 16 /
     md 20 / lg 24 / stroke 1.5).
   - Criar componente `Icon` como wrapper fino consumindo os tokens
     (`iconSize`, `iconStroke`, `iconColor.default`/`.active`).
   - **Substituir TODO o SVG inline / desenho manual** dos componentes já feitos
     (Select chevron/check, Badge ×, Toast ícones, Modal ×, Tabs, states, Logo
     ícone provisório no mobile etc.). SVG espalhado é a duplicação que o
     CLAUDE.md proíbe — foi tolerado só enquanto §19 estava travado.
   - Confirmar **tree-shaking** do lucide (importar só o ícone usado).
2. **Harness de render RN** (jest + preset RN) — sem ele os testes de mobile são
   parciais (só a lógica pura dos `*-variants`). Depois de §19.
3. **§17 Gráficos/dataviz** — DESTRAVADO, com ressalva de biblioteca:
   - **Web: Recharts** (declarativo, cor por prop → consome tokens, padrão React).
   - **Mobile: victory-native** (ou `react-native-svg` + victory) — Recharts NÃO
     roda em RN. Este é o **único** ponto onde web e mobile não compartilham lib.
   - Ambos consomem a ordem de séries do §17 (`brand-500`, `clinic-400`,
     `amber-400`, `purple-400`, `pink-400`, `cyan-400`, `lime-500`, `energy-500`).
   - Regra: **nunca cor como único diferenciador** (combinar padrão/ícone/label).
   - **Apresentar o plano ao responsável antes de implementar** (quais wrappers,
     como os tokens entram).
4. **§20 restante** — MANTÉM DEFERIDO: ilustrações, gráficos avançados,
   componentes de domínio, onboarding, impressão. Dependem de coisas que ainda
   não existem (campos finos de treino/dieta, arte final). A logo saiu do §20.

### Fora do escopo do agente de design (para o agente principal)

- **Política de Merge** e **`docs/roadmap.md`** — JÁ EM ANDAMENTO no **PR #17**
  (`docs/politica-de-merge`, "docs: politica de merge + roadmap versionado";
  `docs/roadmap.md` já está lá). **Não recriar** — só revisar/mergear o #17.
  (Antes eu havia listado "criar roadmap.md" por não saber do #17; corrigido para
  evitar trabalho duplicado — a mesma lição que gerou os PRs #18/#19 paralelos.)
- §19 (Lucide) e §17 (dataviz) acima — para o agente que assumir.

## Contexto que só existe nesta sessão (preservar)

- **Regra do wordmark estava desatualizada no doc.** O briefing inicial dizia
  "FIT em destaque" (Poppins `brand-800`); a identidade FINAL é o oposto: **FIT =
  base (`brand-500`/branco no dark), VO = destaque (`energy-400`)**. Corrigido em
  `design-system.md` §9 e removidas as menções a "FIT dominante". Se algum outro
  doc/briefing repetir a regra antiga, está SUPERADO.
- **Logos:** as artes oficiais estavam **soltas e não versionadas** no working
  dir (untracked) — agora commitadas em `packages/brand-tokens/assets/logo/`
  (SVG otimizado com SVGO 39KB→13KB + PNG, por tema). Existe também um
  `icon-logo-fitvo.png` de **2,3 MB** (raster pesado, provável export de app
  icon) que **NÃO foi commitado** — se for útil como asset de loja, otimizar
  antes; não serve como símbolo tokenizável.
- **Ícone/símbolo isolado é PROVISÓRIO** (`icon-fitvo-provisional.svg`: "V"
  `brand-500` + detalhe `energy-400`). Trocável só substituindo o arquivo e
  regerando `packages/ui-web/src/logo-art.ts` (script inline no commit `1aef665`).
  Quando o símbolo definitivo existir, é a hora de: (a) substituir o asset,
  (b) no mobile, trocar o desenho provisório pelo `Icon`/asset real (liga com §19).
- **Web Logo embute o SVG** (`logo-art.ts`) para ser self-contained (sem config
  de bundler); IDs de `mask`/`filter` foram namespaceados por tema (`fl-`/`fd-`)
  para light+dark coexistirem no DOM sem colisão. **Mobile Logo** recebe a
  `source` (PNG) do app via `require` — resolução de asset em RN pertence ao
  bundler do app (evita quebrar o `tsc` do pacote com `require` de `.png`).
- **Gotcha recorrente:** `exactOptionalPropertyTypes` ON — não passar `undefined`
  explícito a prop opcional (spread condicional ou `?: T | undefined`).
- **`gitleaks` não roda local** (só no CI) — o hook avisa e pula; o gate de
  segredos é aplicado no CI.

## Próximo passo imediato

Aguardar revisão/aprovação do PR. Após merge, o agente que seguir começa por
**§19 (Lucide + Icon + remoção do SVG inline)**.
