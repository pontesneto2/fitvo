'use client';

import { Avatar, Button, Icon, Logo, SideNav } from '@fitvo/ui-web';
import { LayoutDashboard, LogOut } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';

import { useMe } from '@/lib/use-me';

import { ThemeToggle } from './theme-toggle';

// So o item da rota que existe (esqueleto). Novos itens entram com as telas reais
// — nao inventar navegacao para telas que nao foram pedidas.
const NAV_ITEMS = [
  {
    value: '/painel',
    label: 'Início',
    href: '/painel',
    icon: <Icon icon={LayoutDashboard} size="sm" />,
  },
];

export function AppShell({ children }: { readonly children: ReactNode }): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, isSuccess } = useMe();

  /**
   * GATE DE COMPLETAR-PERFIL (spec §5). Quem foi pre-cadastrado por terceiro
   * sem o minimo funcional cai em `/completar-perfil` antes de ver o painel.
   *
   * O valor vem DERIVADO do servidor (`profileComplete` em `/me`) — a UI so o
   * consome, nunca refaz a conta; duas derivacoes divergiriam e passariam a
   * discordar sobre quem esta bloqueado.
   *
   * `isSuccess` e a guarda contra o falso positivo: enquanto o /me nao
   * respondeu, `me` e `undefined` e redirecionar ali mandaria TODO MUNDO para
   * a tela de completar a cada carregamento.
   *
   * Este e o gate de UX. Nao substitui autorizacao: a API continua sendo a
   * fonte de verdade sobre o que cada conta pode fazer.
   */
  useEffect(() => {
    if (isSuccess && me && !me.profileComplete) {
      router.replace('/completar-perfil');
    }
  }, [isSuccess, me, router]);

  // Enquanto o redirect nao acontece, nao pinta o painel para quem esta
  // bloqueado — evita o flash da tela que a pessoa ainda nao pode usar.
  if (isSuccess && me && !me.profileComplete) {
    return null;
  }

  async function onLogout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="flex w-60 flex-col gap-6 border-r border-line bg-surface-raised p-4">
        <div className="px-2 pt-2">
          <Logo size={26} />
        </div>
        <SideNav items={NAV_ITEMS} value={pathname} aria-label="Navegação principal" />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-6">
          <h1 className="font-heading text-h3 font-medium text-fg">Painel</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {me ? <Avatar name={me.displayName} size="sm" /> : null}
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <Icon icon={LogOut} size="sm" />
              Sair
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
