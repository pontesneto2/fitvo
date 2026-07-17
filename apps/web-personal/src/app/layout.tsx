import './globals.css';

import { buildThemeCss } from '@fitvo/ui-web/css';
import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import type { ReactNode } from 'react';

import { themeInitScript } from '@/lib/theme';

import { Providers } from './providers';

// Fontes da marca (design-system.md §5): Poppins nos titulos, Inter no corpo.
// Self-hosted pelo next/font (sem request externo em runtime) e expostas como CSS
// vars que o tailwind.config referencia em `font-heading` / `font-body`.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-heading',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FITVO — Painel do profissional',
  description: 'Painel de gestao do profissional e da clinica.',
};

export default function RootLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <html lang="pt-BR" className={`${poppins.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* CSS vars semanticas do design system (light em :root, dark em .dark) —
            injecao unica exigida pelo ui-web/css. */}
        <style dangerouslySetInnerHTML={{ __html: buildThemeCss() }} />
        {/* Anti-FOUC: aplica o tema salvo/preferido antes da primeira pintura. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
