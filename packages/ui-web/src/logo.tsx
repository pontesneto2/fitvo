import type { ReactNode } from 'react';

import { cn } from './cn';
import { LOGO_ICON_PROVISIONAL, LOGO_WORDMARK_DARK, LOGO_WORDMARK_LIGHT } from './logo-art';

/**
 * Logo FITVO WEB (design-system.md §9 + design-system-components.md §20). Embute a
 * arte oficial (SVG, de `packages/brand-tokens/assets/logo/`, via `logo-art.ts`) —
 * self-contained, sem config de bundler nem resolução de asset.
 *
 * Variantes:
 * - `wordmark` (padrão): a marca por extenso. FIT `brand-500` (light) / branco
 *   (dark); VO `energy-400` em ambos. Cores BAKED na arte (= tokens por valor) — um
 *   wordmark é arte de marca fixa, não recolorida em runtime.
 * - `icon`: símbolo isolado. **PROVISÓRIO** (`icon-fitvo-provisional.svg`): "V"
 *   `brand-500` com detalhe `energy-400`. `TODO`: trocar pelo definitivo
 *   substituindo o arquivo em assets/logo + regerar `logo-art.ts` — sem tocar aqui.
 *
 * Tema: por padrão `auto` — mostra a arte light no tema claro e a dark no escuro,
 * via classes `dark:` (Tailwind), sem JS. `theme` explícito força uma variante.
 * `size` define a ALTURA (px); a largura acompanha a proporção (`viewBox`).
 */
export type LogoVariant = 'wordmark' | 'icon';
export type LogoTheme = 'auto' | 'light' | 'dark';

export interface LogoProps {
  readonly variant?: LogoVariant;
  readonly theme?: LogoTheme;
  /** Altura em px (a largura acompanha a proporção). Padrão 32. */
  readonly size?: number;
  /** Rótulo acessível (padrão "FITVO"). */
  readonly title?: string;
  readonly className?: string;
}

function Art({
  markup,
  title,
  height,
  className,
}: {
  readonly markup: string;
  readonly title: string;
  readonly height: number;
  readonly className?: string | undefined;
}): ReactNode {
  return (
    <span
      role="img"
      aria-label={title}
      className={cn('inline-block w-auto align-middle [&>svg]:h-full [&>svg]:w-auto', className)}
      style={{ height }}
      // Arte de marca estática (SVG confiável do próprio pacote), não entrada de usuário.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

export function Logo({
  variant = 'wordmark',
  theme = 'auto',
  size = 32,
  title = 'FITVO',
  className,
}: LogoProps): ReactNode {
  if (variant === 'icon') {
    return <Art markup={LOGO_ICON_PROVISIONAL} title={title} height={size} className={className} />;
  }

  if (theme === 'light') {
    return <Art markup={LOGO_WORDMARK_LIGHT} title={title} height={size} className={className} />;
  }
  if (theme === 'dark') {
    return <Art markup={LOGO_WORDMARK_DARK} title={title} height={size} className={className} />;
  }

  // auto: light no tema claro, dark no escuro (via `dark:`), sem JS.
  return (
    <>
      <Art
        markup={LOGO_WORDMARK_LIGHT}
        title={title}
        height={size}
        className={cn('dark:hidden', className)}
      />
      <Art
        markup={LOGO_WORDMARK_DARK}
        title={title}
        height={size}
        className={cn('hidden dark:inline-block', className)}
      />
    </>
  );
}
