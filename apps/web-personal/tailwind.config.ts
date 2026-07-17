import { fitvoTailwindPreset } from '@fitvo/ui-web/tailwind';
import type { Config } from 'tailwindcss';

/**
 * Tailwind do web-personal. Toda a identidade (cores semanticas via var(--token),
 * rampas, espaco, raio, sombra, tipografia, movimento) vem do preset do design
 * system — nada de valor hardcoded aqui. `content` inclui a fonte do ui-web para
 * o purge nao remover as classes usadas pelos componentes.
 *
 * Unico override: `fontFamily` aponta para as CSS vars que o next/font injeta
 * (`--font-heading` = Poppins, `--font-body` = Inter, design-system.md §5),
 * substituindo os nomes literais do preset pela versao self-hosted/otimizada.
 */
const config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui-web/src/**/*.{ts,tsx}'],
  presets: [fitvoTailwindPreset as unknown as Partial<Config>],
  theme: {
    extend: {
      fontFamily: {
        heading: ['var(--font-heading)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
} satisfies Config;

export default config;
