# FITVO — Design System

> Fonte da verdade da identidade visual. Todo trabalho de UI (web e mobile)
> deve consumir estes tokens via `packages/brand-tokens`. Nunca hardcodar cor,
> fonte, espaçamento ou raio.

---

## 1. Personalidade da marca

- **Energética e vibrante** (fitness, movimento, motivação).
- **Acessível e amigável** (democrática, sem intimidar).
- **Moderna** (visual autoral, nunca genérico/"cara de IA").
- Tensão administrada: a mesma marca serve treino (mais vibrante) e medicina
  (mais contida). Cada ambiente herda o DNA e ajusta a intensidade — ver §7.
- Light + dark mode desde o início (obrigatório em todos os tokens).

---

## 2. Cor — estratégia

**Cor-mãe controlada + neons de acento.** A base sustenta texto e áreas grandes;
os neons trazem energia em doses.

- **Cor-mãe (brand):** teal-verde médio `#0FA678`. Identidade institucional —
  logo, login, landing, elementos de marca. **É a cor primária do FITVO.**
- **Acento de energia (energy):** neon esmeralda `#00E676`. Ações principais,
  destaques, sucesso. O brilho do dia a dia.
- **Acento de conquista (lime):** verde-lima elétrico `#39FF14`. Celebração
  (meta batida, recorde, barra completa). Uso PARCIMONIOSO.

> **Acessibilidade:** os neons (`energy-400`, `lime-400`) NUNCA recebem texto
> pequeno em cima — contraste insuficiente. Usar em elementos gráficos (barras,
> ícones, destaques, glows no dark). Para texto sobre fundo colorido, usar o
> stop 800/900 da rampa.

---

## 3. Rampas de cor (50 → 900)

Cada cor é uma escala: 50 = fundo sutil; 400/500 = cor cheia; 900 = contraste
máximo. Valores em light mode; dark resolvido por token (§8).

### brand — verde-marca (PRIMÁRIA)
`50 #E6F7F1` · `100 #C1EDDD` · `200 #8EDCC3` · `300 #54C7A4` · `400 #22B088` ·
`500 #0FA678` · `600 #0C8862` · `700 #0A6E50` · `800 #08543E` · `900 #053A2B`

### energy — neon esmeralda (energia / sucesso)
`50 #E4FFF0` · `100 #B9FFD9` · `200 #7DFFB8` · `300 #3DFF97` · `400 #00E676` ·
`500 #00C765` · `600 #00A554` · `700 #008443` · `800 #006332` · `900 #004321`

### lime — lima elétrico (conquista / acento de treino)
`50 #F0FFE6` · `100 #DBFFC0` · `200 #BFFF8E` · `300 #9CFF52` · `400 #39FF14` ·
`500 #5FD40F` · `600 #4DAE0C` · `700 #3B8709` · `800 #2A6206` · `900 #193B04`

### amber — âmbar (acento de nutrição)
`50 #FFF6E6` · `100 #FFE9C0` · `200 #FFD68E` · `300 #FFBE52` · `400 #FF9F1C` ·
`500 #E58200` · `600 #BD6A00` · `700 #945300` · `800 #6B3C00` · `900 #422500`

### clinic — azul (acento de medicina)
`50 #E6F4FC` · `100 #C0E2F7` · `200 #8ECBEF` · `300 #52AEE3` · `400 #2D9CDB` ·
`500 #1B7FB8` · `600 #146695` · `700 #0E4D72` · `800 #08344F` · `900 #04202F`

### purple — roxo (categorização / dados)
`50 #F0EDFC` · `100 #D6CCF6` · `200 #B7A6EE` · `300 #9781E4` · `400 #7B5FD8` ·
`500 #6242C0` · `600 #4E3399` · `700 #3B2673` · `800 #29184F` · `900 #180D2E`

### pink — rosa (categorização / dados)
`50 #FCEAF2` · `100 #F7C2D8` · `200 #EF93B6` · `300 #E66492` · `400 #DB3D74` ·
`500 #C02460` · `600 #991B4C` · `700 #731338` · `800 #4F0C26` · `900 #2E0616`

### cyan — ciano (categorização / dados)
`50 #E4FBFC` · `100 #B6F2F6` · `200 #82E6ED` · `300 #45D4DE` · `400 #1CBFCB` ·
`500 #109FA9` · `600 #0C7E86` · `700 #095E64` · `800 #063E42` · `900 #032325`

### danger — vermelho (erro)
`50 #FCEBEB` · `100 #F7C1C1` · `200 #F09595` · `300 #EA6B6A` · `400 #E24B4A` ·
`500 #C43231` · `600 #A32D2D` · `700 #7E2020` · `800 #591414` · `900 #380C0C`

### warning — amarelo-alerta (aviso)
`50 #FFF8E6` · `100 #FDECC0` · `200 #FBDC8E` · `300 #F9C94E` · `400 #FFB020` ·
`500 #E09400` · `600 #B67800` · `700 #8C5C00` · `800 #634000` · `900 #3A2500`

### neutral — neutros (fundos, bordas, textos — ≈80% da UI)
`50 #F7F9F8` · `100 #ECEFEE` · `200 #D8DDDB` · `300 #B4BBB8` · `400 #8A9491` ·
`500 #616B68` · `600 #48514E` · `700 #323A37` · `800 #1E2523` · `900 #0F1513`

---

## 4. Cores de texto (3 níveis)

| Token             | Uso                                        | Light     | Dark      |
|-------------------|--------------------------------------------|-----------|-----------|
| `text-principal`  | Títulos, valores, conteúdo lido de fato    | `#0F1513` | `#F7F9F8` |
| `text-auxiliar`   | Legendas, descrições, labels de apoio      | `#48514E` | `#B4BBB8` |
| `text-sutil`      | Placeholders, dicas, metadados, timestamps | `#8A9491` | `#616B68` |

Texto funcional sobre fundo claro: usar stop 700/800 da rampa correspondente
(`danger-700` erro, `warning-800` aviso, `energy-800` sucesso).

---

## 5. Tipografia

- **Títulos:** **Poppins** (geométrica, amigável, energética) — headlines,
  números de destaque, wordmark.
- **Corpo:** **Inter** (legível em tamanho pequeno) — texto, labels, dados.
- Ambas gratuitas (Google Fonts), uso comercial livre.
- **Web:** via CSS/Google Fonts.
- **Mobile (Expo):** fontes EMBARCADAS (bundled) via `expo-font` — NÃO usar
  fonte nativa do sistema. A marca é idêntica em iOS e Android.

### Escala tipográfica (base; ajustar por densidade — §6)
- Display / H1: 28–32px · Poppins 600
- H2: 22–24px · Poppins 600
- H3: 18px · Poppins 500
- Body: 16px · Inter 400 (line-height 1.6)
- Body pequeno: 14px · Inter 400
- Caption/meta: 12px · Inter 400

Sentence case em toda a UI (nunca Title Case, nunca ALL CAPS).

**Pesos por fonte:** Poppins 500 e 600; Inter 400, 500 e 600. O Inter usa três
pesos por ser a fonte de trabalho — 400 no corpo, 500 em labels/botões, 600 no
cabeçalho de tabela; restringir a dois quebraria a hierarquia.

---

## 6. Forma e estilo

### Cantos (raio) — bem arredondados, em escala
- Pequeno (inputs, botões pequenos): ~8px
- Médio (botões, campos): ~12px
- Grande (cards): ~16px
- Full (pills, tags, avatares): 999px

Cada elemento usa seu raio proporcional — não um raio único para tudo.

### Elevação / sombra — SEMÂNTICA
- Dia a dia: sombras quase imperceptíveis (quase flat), apoiadas em bordas finas.
- Elevação real reservada ao que PEDE ATENÇÃO: alertas, modais, notificações
  importantes, ações críticas.
- **Princípio:** quanto mais alto o elemento "flutua", mais importante/urgente.
  Elevação é sinal, não decoração.
- **Níveis (valores definitivos):**
  - `flat` — card comum / superfície base: sem sombra.
  - `subtle` — card em hover / leve destaque: `0 1px 2px rgba(0,0,0,0.04)`.
  - `raised` — dropdown, popover, toast, card de atenção: `0 4px 12px rgba(0,0,0,0.08)`.
  - `overlay` — modal, drawer: `0 12px 32px rgba(0,0,0,0.16)`.

### Dark mode — superfícies e foco
- Sombra funciona mal sobre fundo escuro (o fundo absorve). No dark a elevação se
  expressa por SUPERFÍCIE mais clara — subir na rampa neutra — com a sombra em
  METADE da opacidade, só como reforço sutil.
- Superfícies: base `neutral-900`, card `neutral-800`, elevado `neutral-700`
  (→ `neutral-600` no nível mais alto).
- Hover genérico: subir um stop na rampa neutra (ex.: `neutral-800` → `neutral-700`).
- Anel de foco no dark: `brand-400` (mais claro que o `brand-300` do light, para
  contrastar). Estados finos por componente em `design-system-components.md` §21.

### Densidade — ADAPTÁVEL por contexto
- **Mobile:** compacto (margens/espaços reduzidos — mais informação em tela
  estreita).
- **Painel web (profissional):** respirável (mais espaço, foco no atendimento,
  sensação premium).
- **Painel admin:** compacto (tabelas, dashboards, financeiro — muito dado por
  tela).

Implementar como "chave de densidade" (compacto/confortável): mesmos componentes
e tokens, espaçamento ajustado por contexto.

### Animações e micro-interações — PADRÃO
- Presentes por padrão: hover, transições de estado, feedback de toque, entrada
  de listas.
- Rápidas e funcionais (servem à clareza, não ao show-off).
- Respeitar SEMPRE `prefers-reduced-motion`.
- Não sacrificar performance.

---

## 7. Cor por ambiente (especialidade)

Cada ambiente (ADR-0001, D-052) herda a marca e ganha um acento próprio:

| Ambiente | Acento         | Rampa    | Tom                  |
|----------|----------------|----------|----------------------|
| Treino   | Lima elétrico  | `lime`   | energia, performance |
| Nutrição | Âmbar natural  | `amber`  | comida, calor        |
| Medicina | Azul-confiança | `clinic` | calma, credibilidade |

Cor-mãe (verde) e neutros permanecem constantes em todos os ambientes. Só o
acento muda. No ambiente médico, reduzir a intensidade geral (menos saturação,
mais respiro) para o tom mais sóbrio que o contexto clínico pede.

---

## 8. Regras de implementação

- Tudo consumido de `packages/brand-tokens` — nunca hardcodar.
- Todo token tem valor light e dark; o dark é automático por tema, nunca
  "inversão manual".
- Web e mobile COMPARTILHAM tokens (cores, fontes, espaçamento, tamanhos) via
  `brand-tokens`; os COMPONENTES são separados (`ui-web` / `ui-mobile`).
- Acessibilidade é baseline: contraste AA em texto, foco visível,
  `prefers-reduced-motion`, alvos de toque adequados no mobile.
- Antes de criar componente, reutilizar o existente (ver CLAUDE.md).

---

## 9. Pendências de design

**Decisões fechadas (2026-07-15)** — refletidas nos tokens:
- **Tipografia:** pesos definitivos (§5) — Poppins 500/600; Inter 400/500/600.
- **Elevação:** valores definitivos (§6); no dark, superfície mais clara + sombra
  a metade da opacidade.
- **Iconografia:** família **Lucide** (`lucide-react` / `lucide-react-native`,
  MIT). Tokens em `design-system-components.md` §19.
- **Dark fino:** superfícies, hover, foco e estados de input em
  `design-system-components.md` §21.
- **Logo (wordmark):** identidade final definida. As artes oficiais vivem em
  `packages/brand-tokens/assets/logo/` (SVG + PNG, uma variante por tema).
  **Hierarquia oficial:** "FIT" em `brand-500` (`#0FA678`) no tema light /
  branco (`#FFFFFF`) no tema dark; "VO" em `energy-400` (`#00E676`) em ambos os
  temas — o neon no "VO" fecha o nome com a cor de energia da marca. FIT é a
  base (marca), VO é o destaque (energia). A regra anterior de "FIT em destaque"
  / "FIT dominante" (herdada do briefing inicial, em Poppins `brand-800`) foi
  **SUPERADA pela identidade final — não aplicar.** O **símbolo isolado** ainda é
  provisório (ver `design-system-components.md` §20).

**Ainda em aberto:**
- Ilustrações e imagens de marca.
- **shadcn/ui + MCP** para a camada web — decisão **ADIADA**. O preset Tailwind
  permanece neutro (ver CLAUDE.md); não adotar sem ordem.
