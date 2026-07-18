import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';

/** Layout das rotas protegidas do painel (SideNav + header). A guarda de acesso
 *  fica no middleware; aqui so a moldura. */
export default function PainelLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return <AppShell>{children}</AppShell>;
}
