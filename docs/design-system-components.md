# FITVO — Design System: Componentes e Estados

> Complemento de `docs/design-system.md` (que define cor, tipografia e forma).
> Este documento define **como cada componente se comporta em cada estado**,
> especificando o token exato de cada situação.
>
> **CONTRATO:** todo componente do FITVO consome os tokens definidos aqui e em
> `design-system.md`, via `packages/brand-tokens`. Nunca improvisar valor.
> Seções marcadas como `[A DEFINIR]` têm valores PROVISÓRIOS — o código deve
> consumi-los normalmente; quando o valor for ajustado no token, a UI inteira
> acompanha sem alteração de código. **Esse é o objetivo: valor muda no sistema,
> nunca no componente.**

---

## 0. Tokens base de interação

Aplicam-se a todos os componentes.

### Duração de animação
| Token | Valor | Uso |
|---|---|---|
| `duration-instant` | 100ms | feedback de toque, mudança de cor |
| `duration-fast` | 150ms | hover, foco, transições de estado |
| `duration-normal` | 250ms | entrada/saída de elementos, expand |
| `duration-slow` | 400ms | modais, drawers, transições de página |

### Easing
| Token | Valor | Uso |
|---|---|---|
| `ease-standard` | cubic-bezier(0.4, 0, 0.2, 1) | padrão geral |
| `ease-in` | cubic-bezier(0.4, 0, 1, 1) | saída de elementos |
| `ease-out` | cubic-bezier(0, 0, 0.2, 1) | entrada de elementos |

> Todas as animações respeitam `prefers-reduced-motion`: quando ativo, reduzir
> para `duration-instant` ou remover movimento (manter só mudança de cor).

### Anel de foco (acessibilidade — obrigatório)
| Token | Valor |
|---|---|
| `focus-ring-width` | 3px |
| `focus-ring-color` | `brand-300` (light) / `brand-400` (dark) |
| `focus-ring-offset` | 2px |

Todo elemento interativo DEVE ter foco visível. Nunca remover outline sem
substituir por anel equivalente.

### Espaçamento (escala base)
`space-1` 4px · `space-2` 8px · `space-3` 12px · `space-4` 16px · `space-5` 20px ·
`space-6` 24px · `space-8` 32px · `space-10` 40px · `space-12` 48px · `space-16` 64px

### Densidade
| Contexto | Chave | Ajuste |
|---|---|---|
| Mobile | `compact` | espaçamentos reduzidos ~25% |
| Painel web (profissional) | `comfortable` | escala base |
| Painel admin | `compact` | espaçamentos reduzidos ~25% |

### Elevação (valores definitivos)
| Token | Sombra (light) | Uso |
|---|---|---|
| `flat` | nenhuma | card comum, superfície base |
| `subtle` | `0 1px 2px rgba(0,0,0,0.04)` | card em hover, leve destaque |
| `raised` | `0 4px 12px rgba(0,0,0,0.08)` | dropdown, popover, toast, card de atenção |
| `overlay` | `0 12px 32px rgba(0,0,0,0.16)` | modal, drawer |

Mapa dos termos qualitativos usados nas tabelas abaixo: "quase imperceptível" =
`flat` · "sombra sutil" / "sutil" = `subtle` · "elevação média" = `raised` ·
"elevação alta" = `overlay`.

> **Dark mode:** no dark a elevação se expressa por superfície mais clara (subir
> na rampa neutra), com a sombra em METADE da opacidade só como reforço. Ver §21.

---

## 1. Botão

### Alturas
| Tamanho | Altura | Padding H | Fonte |
|---|---|---|---|
| `sm` | 32px | `space-3` | Inter 14 / 500 |
| `md` (padrão) | 40px | `space-4` | Inter 14 / 500 |
| `lg` | 48px | `space-6` | Inter 16 / 500 |

Raio: `radius-md` (12px). Transição: `duration-fast` `ease-standard`.

### Variante: Primário
| Estado | Fundo | Texto | Borda | Extra |
|---|---|---|---|---|
| normal | `brand-500` | `#FFFFFF` | — | sombra sutil |
| hover | `brand-600` | `#FFFFFF` | — | — |
| foco | `brand-500` | `#FFFFFF` | — | anel de foco |
| ativo/pressed | `brand-700` | `#FFFFFF` | — | scale 0.98 |
| disabled | `neutral-200` | `text-sutil` | — | cursor not-allowed |
| loading | `brand-500` | `#FFFFFF` | — | spinner, texto oculto |

### Variante: Energia (ação de destaque / CTA principal)
| Estado | Fundo | Texto | Extra |
|---|---|---|---|
| normal | `energy-400` | `brand-900` | sombra sutil |
| hover | `energy-500` | `brand-900` | — |
| foco | `energy-400` | `brand-900` | anel de foco |
| ativo | `energy-600` | `#FFFFFF` | scale 0.98 |
| disabled | `neutral-200` | `text-sutil` | — |

> Texto SEMPRE escuro (`brand-900`) sobre neon — nunca branco (contraste).

### Variante: Secundário (outline)
| Estado | Fundo | Texto | Borda |
|---|---|---|---|
| normal | transparente | `brand-600` | 1px `neutral-200` |
| hover | `brand-50` | `brand-700` | 1px `brand-300` |
| foco | transparente | `brand-600` | 1px `brand-500` + anel |
| ativo | `brand-100` | `brand-800` | 1px `brand-500` |
| disabled | transparente | `text-sutil` | 1px `neutral-200` |

### Variante: Ghost (texto)
| Estado | Fundo | Texto |
|---|---|---|
| normal | transparente | `brand-600` |
| hover | `neutral-100` | `brand-700` |
| foco | transparente | `brand-600` + anel |
| ativo | `neutral-200` | `brand-800` |
| disabled | transparente | `text-sutil` |

### Variante: Destrutivo
| Estado | Fundo | Texto |
|---|---|---|
| normal | `danger-400` | `#FFFFFF` |
| hover | `danger-500` | `#FFFFFF` |
| foco | `danger-400` | `#FFFFFF` + anel (`danger-200`) |
| ativo | `danger-600` | `#FFFFFF` |
| disabled | `neutral-200` | `text-sutil` |

---

## 2. Input / Textarea

Altura: 40px (`md`), textarea mínimo 80px. Raio: `radius-sm` (8px).
Padding: `space-3`. Fonte: Inter 14/400. Transição: `duration-fast`.

| Estado | Fundo | Borda | Texto | Extra |
|---|---|---|---|---|
| normal | `neutral-50` | 1px `neutral-200` | `text-principal` | — |
| hover | `neutral-50` | 1px `neutral-300` | `text-principal` | — |
| foco | `#FFFFFF` | 1px `brand-500` | `text-principal` | anel de foco |
| preenchido | `#FFFFFF` | 1px `neutral-200` | `text-principal` | — |
| disabled | `neutral-100` | 1px `neutral-200` | `text-sutil` | cursor not-allowed |
| readonly | `neutral-100` | 1px `neutral-200` | `text-auxiliar` | — |
| erro | `danger-50` | 1px `danger-400` | `text-principal` | mensagem `danger-700` |
| sucesso | `energy-50` | 1px `energy-500` | `text-principal` | ícone `energy-600` |

- Placeholder: `text-sutil`.
- Label: Inter 14/500, `text-auxiliar`, `space-2` acima do campo.
- Mensagem de erro: Inter 12/400, `danger-700`, `space-1` abaixo.
- Texto de ajuda: Inter 12/400, `text-sutil`.

---

## 3. Select / Dropdown

Trigger: mesmas regras do Input (todos os estados).

### Menu (painel aberto)
| Propriedade | Valor |
|---|---|
| Fundo | `#FFFFFF` (light) / `neutral-800` (dark) |
| Borda | 1px `neutral-200` |
| Raio | `radius-md` (12px) |
| Sombra | elevação média (menu pede atenção) |
| Animação | fade + slide 4px, `duration-fast` `ease-out` |

### Item do menu
| Estado | Fundo | Texto |
|---|---|---|
| normal | transparente | `text-principal` |
| hover | `neutral-100` | `text-principal` |
| foco (teclado) | `brand-50` | `brand-700` |
| selecionado | `brand-50` | `brand-700` + ícone check `brand-500` |
| disabled | transparente | `text-sutil` |

---

## 4. Checkbox

Tamanho: 20px. Raio: `radius-sm` (8px, levemente arredondado).

| Estado | Fundo | Borda | Ícone |
|---|---|---|---|
| normal | transparente | 1.5px `neutral-300` | — |
| hover | `brand-50` | 1.5px `brand-400` | — |
| foco | transparente | 1.5px `brand-500` + anel | — |
| marcado | `brand-500` | 1.5px `brand-500` | check `#FFFFFF` |
| marcado+hover | `brand-600` | 1.5px `brand-600` | check `#FFFFFF` |
| indeterminado | `brand-500` | 1.5px `brand-500` | traço `#FFFFFF` |
| disabled | `neutral-100` | 1.5px `neutral-200` | — |
| disabled+marcado | `neutral-300` | 1.5px `neutral-300` | check `neutral-50` |
| erro | transparente | 1.5px `danger-400` | — |

Animação do check: `duration-instant`, escala 0.8→1.

---

## 5. Radio

Tamanho: 20px. Raio: full (círculo). Estados idênticos ao Checkbox, com ponto
central em vez de check:

| Estado | Fundo | Borda | Ponto interno |
|---|---|---|---|
| normal | transparente | 1.5px `neutral-300` | — |
| hover | `brand-50` | 1.5px `brand-400` | — |
| foco | transparente | 1.5px `brand-500` + anel | — |
| selecionado | `#FFFFFF` | 1.5px `brand-500` | 8px `brand-500` |
| disabled | `neutral-100` | 1.5px `neutral-200` | — |

---

## 6. Switch (toggle)

Trilho: 44×24px, raio full. Botão: 20px, raio full, `#FFFFFF`, sombra sutil.
Transição: `duration-fast` `ease-standard`.

| Estado | Trilho | Botão |
|---|---|---|
| desligado | `neutral-300` | `#FFFFFF` à esquerda |
| desligado+hover | `neutral-400` | `#FFFFFF` |
| ligado | `brand-500` | `#FFFFFF` à direita |
| ligado+hover | `brand-600` | `#FFFFFF` |
| foco | (cor do estado) | + anel de foco |
| disabled desligado | `neutral-200` | `neutral-100` |
| disabled ligado | `brand-200` | `neutral-50` |

---

## 7. Card

Raio: `radius-lg` (16px). Padding: `space-4` (compact) / `space-6` (comfortable).

| Variante | Fundo | Borda | Sombra |
|---|---|---|---|
| padrão | `#FFFFFF` / `neutral-800` (dark) | 1px `neutral-200` | quase imperceptível |
| interativo (normal) | `#FFFFFF` | 1px `neutral-200` | quase imperceptível |
| interativo (hover) | `#FFFFFF` | 1px `neutral-300` | sutil + translateY(-2px) |
| interativo (ativo) | `neutral-50` | 1px `neutral-300` | quase imperceptível |
| interativo (foco) | `#FFFFFF` | 1px `brand-500` + anel | sutil |
| destaque/atenção | `#FFFFFF` | 1px `brand-300` | elevação média |
| selecionado | `brand-50` | 1.5px `brand-500` | sutil |

> Lembrete (`design-system.md` §6): elevação é SEMÂNTICA. Card comum é quase
> flat; sombra perceptível só quando pede atenção.

---

## 8. Badge / Tag

Altura: 24px. Raio: full. Padding: `space-2`. Fonte: Inter 12/500.

| Variante | Fundo | Texto |
|---|---|---|
| neutro | `neutral-100` | `text-auxiliar` |
| marca | `brand-50` | `brand-700` |
| sucesso | `energy-50` | `energy-800` |
| aviso | `warning-50` | `warning-800` |
| erro | `danger-50` | `danger-700` |
| info | `clinic-50` | `clinic-700` |
| treino | `lime-50` | `lime-800` |
| nutrição | `amber-50` | `amber-800` |
| medicina | `clinic-50` | `clinic-800` |

Variante removível: ícone `×` com hover no tom 200 da mesma rampa.

---

## 9. Tabs (navegação por ambiente e geral)

| Estado | Texto | Indicador | Fundo |
|---|---|---|---|
| normal | `text-auxiliar` | — | transparente |
| hover | `text-principal` | — | `neutral-50` |
| ativo | `brand-700` | 2px `brand-500` | transparente |
| foco | `text-principal` | — | + anel |
| disabled | `text-sutil` | — | transparente |

Indicador animado: desliza entre tabs, `duration-normal` `ease-standard`.

> **Tabs de ambiente (treino/nutrição/medicina):** o indicador e o texto ativo
> usam o ACENTO do ambiente (`lime` / `amber` / `clinic`), não `brand`.
> Ver `design-system.md` §7.

---

## 10. Menu lateral / Navegação

| Estado | Fundo | Texto | Ícone |
|---|---|---|---|
| normal | transparente | `text-auxiliar` | `text-auxiliar` |
| hover | `neutral-100` | `text-principal` | `text-principal` |
| ativo | `brand-50` | `brand-700` | `brand-600` |
| ativo (barra) | + 3px `brand-500` à esquerda | | |
| foco | transparente | `text-principal` + anel | |
| disabled | transparente | `text-sutil` | `text-sutil` |

---

## 11. Breadcrumb

- Item normal: Inter 14/400, `text-auxiliar`.
- Item hover: `brand-600`, sublinhado.
- Item atual: `text-principal`, 500, sem link.
- Separador: `/` em `text-sutil`.

---

## 12. Modal / Dialog

| Propriedade | Valor |
|---|---|
| Overlay | `neutral-900` a 60% de opacidade + blur 4px |
| Fundo | `#FFFFFF` / `neutral-800` (dark) |
| Raio | `radius-lg` (16px) |
| Sombra | elevação alta (modal PEDE atenção) |
| Padding | `space-6` |
| Largura máx. | sm 400px · md 560px · lg 720px |
| Animação entrada | fade + scale 0.96→1, `duration-normal` `ease-out` |
| Animação saída | fade + scale 1→0.98, `duration-fast` `ease-in` |

- Fecha com `Esc`, clique no overlay e botão explícito.
- Foco preso dentro do modal (focus trap) — obrigatório.
- Título: Poppins 18/600, `text-principal`.

---

## 13. Toast / Notificação

Posição: topo-direita (web) / topo (mobile). Raio: `radius-md`. Padding: `space-4`.
Sombra: elevação média. Animação: slide + fade, `duration-normal` `ease-out`.
Auto-dismiss: 5s (erro: manual).

| Variante | Fundo | Borda-esq. | Ícone |
|---|---|---|---|
| sucesso | `energy-50` | 3px `energy-500` | `energy-600` |
| erro | `danger-50` | 3px `danger-400` | `danger-600` |
| aviso | `warning-50` | 3px `warning-400` | `warning-600` |
| info | `clinic-50` | 3px `clinic-400` | `clinic-600` |
| conquista | `lime-50` | 3px `lime-400` | `lime-600` |

Texto: título Inter 14/500 `text-principal`; descrição Inter 13/400 `text-auxiliar`.

---

## 14. Tooltip

| Propriedade | Valor |
|---|---|
| Fundo | `neutral-800` (light) / `neutral-100` (dark) |
| Texto | `neutral-50` (light) / `neutral-900` (dark), Inter 12/400 |
| Raio | `radius-sm` (8px) |
| Padding | `space-2` |
| Sombra | sutil |
| Delay | 400ms para abrir, 100ms para fechar |
| Animação | fade + slide 4px, `duration-fast` |

Nunca usar tooltip como único meio de transmitir informação essencial
(acessibilidade).

---

## 15. Estados de tela (obrigatórios)

Toda tela com dados implementa os quatro:

| Estado | Especificação |
|---|---|
| **Loading** | Skeleton com `neutral-100`→`neutral-200` shimmer (`duration-slow`, loop). Nunca spinner solto em tela cheia. |
| **Vazio** | Ilustração/ícone `neutral-300`, título Poppins 16/500 `text-principal`, descrição Inter 14/400 `text-auxiliar`, ação primária quando aplicável. |
| **Erro** | Ícone `danger-400`, título `text-principal`, mensagem AMIGÁVEL (nunca erro técnico — ver ADR-0005), botão "Tentar novamente". |
| **Sucesso** | Feedback via toast; para ações maiores, tela de confirmação com ícone `energy-500`. |

---

## 16. Tabela (painel admin / listagens)

| Elemento | Especificação |
|---|---|
| Cabeçalho | fundo `neutral-50`, texto Inter 12/600 `text-auxiliar`, uppercase off |
| Linha normal | fundo `#FFFFFF`, borda-bottom 1px `neutral-100` |
| Linha hover | fundo `neutral-50` |
| Linha selecionada | fundo `brand-50` |
| Célula | padding `space-3`, Inter 14/400 `text-principal` |
| Ordenação ativa | ícone `brand-500` |
| Paginação | numerada (ADR-0005) — botões ghost, atual em `brand-500` |

Densidade `compact` no admin (ver §0).

---

## 17. Gráficos e visualização de dados

Ordem de cores para séries (garante distinção visual):
1. `brand-500` · 2. `clinic-400` · 3. `amber-400` · 4. `purple-400` ·
5. `pink-400` · 6. `cyan-400` · 7. `lime-500` · 8. `energy-500`

- Grid/eixos: `neutral-200`. Labels: `text-sutil` Inter 12.
- Progresso/conquista: `lime-400` (ver `design-system.md` §2).
- Nunca usar cor como ÚNICO diferenciador (acessibilidade daltônica): combinar
  com padrão, ícone ou label.

---

## 18. Avatar

| Tamanho | Valor |
|---|---|
| `xs` 24px · `sm` 32px · `md` 40px · `lg` 56px · `xl` 80px |

Raio: full. Fallback: iniciais em `brand-100` com texto `brand-700`, Poppins 500.
Borda opcional: 2px `#FFFFFF` (em sobreposições/grupos).

---

## 19. Ícones

**Família definida: Lucide.** `lucide-react` na web, `lucide-react-native` no
mobile — mesma API nas duas plataformas, licença MIT. O `icon-stroke` de 1.5px é
o padrão nativo da família.

| Token | Valor |
|---|---|
| `icon-size-sm` | 16px |
| `icon-size-md` | 20px |
| `icon-size-lg` | 24px |
| `icon-stroke` | 1.5px |
| `icon-color-default` | `text-auxiliar` |
| `icon-color-active` | `brand-600` |

---

## 20. Seções reservadas `[A DEFINIR]`

Espaços já contratados para quando forem definidos. O código deve consumir os
tokens correspondentes desde já; ajustar o valor no sistema não exige tocar em
componente.

- **Ilustrações e imagens de marca** — estilo, paleta, uso em estados vazios.
- **Logo** — símbolo em exploração (mark do componente `Logo` é PROVISÓRIO, sem
  forma final); wordmark Poppins 600 (FIT `brand-500` / VO `energy-400`). Cor
  primária: `#0FA678`.
- **Gráficos avançados** — heatmap de frequência, comparativos de evolução.
- **Componentes de domínio** — card de exercício, card de refeição, linha do
  tempo de evolução, cartão de prescrição. Serão especificados na fase de cada
  domínio, sempre compondo os componentes-base deste documento.
- **Onboarding/tour** — padrão de destaque e passo a passo.
- **Impressão** — folha de receita (ADR-0003), relatórios em PDF.

---

## 21. Dark mode — superfícies e estados

Regra geral: no dark os componentes espelham a estrutura do light, mas as
superfícies SOBEM na rampa neutra em vez de descerem. Elevação por superfície,
não por sombra (§0). Todo componente funciona em light e dark sem alteração de
código — o valor vem do token, resolvido por tema.

### Superfícies (dark)
| Papel | Light | Dark |
|---|---|---|
| base (fundo do app) | `neutral-50` | `neutral-900` |
| card | `#FFFFFF` | `neutral-800` |
| elevado (modal, dropdown) | `#FFFFFF` | `neutral-700` |

### Bordas (dark)
| Papel | Light | Dark |
|---|---|---|
| padrão | `neutral-200` | `neutral-700` |
| hover | `neutral-300` | `neutral-600` |
| foco | `brand-500` | `brand-400` |

- **Hover genérico:** subir um stop na rampa neutra (ex.: `neutral-800` → `neutral-700`).
- **Anel de foco:** `brand-400` (mais claro que o `brand-300` do light).

### Input (dark)
| Estado | Fundo | Borda | Texto |
|---|---|---|---|
| normal | `neutral-800` | 1px `neutral-700` | `text-principal` (dark) |
| hover | `neutral-800` | 1px `neutral-600` | — |
| foco | `neutral-900` | 1px `brand-400` + anel `brand-400` | — |
| disabled | `neutral-800` | 1px `neutral-700` | `text-sutil` (dark) |
| erro | `danger-900` a 20% | 1px `danger-400` | — |

---

## Regras de consumo (inegociáveis)

1. Todo valor visual vem de `packages/brand-tokens`. Zero hardcode.
2. Componente novo? Verificar antes se já existe equivalente (ver CLAUDE.md).
3. Estado não especificado aqui? PARAR e perguntar — não improvisar.
4. Token faltando? Criar o token no sistema, nunca chumbar o valor no componente.
5. Todo elemento interativo tem foco visível e alvo de toque adequado (mín. 44px
   no mobile).
6. Todo componente funciona em light e dark sem alteração de código.
