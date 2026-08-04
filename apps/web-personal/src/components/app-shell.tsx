'use client';

import { Avatar, Button, Icon, Logo, SideNav, Tooltip } from '@fitvo/ui-web';
import {
  Dumbbell,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

import { useMe } from '@/lib/use-me';

import { ThemeToggle } from './theme-toggle';

const NAV_ITEMS = [
  {
    value: '/painel',
    label: 'Início',
    href: '/painel',
    icon: <Icon icon={LayoutDashboard} size="sm" />,
  },
  {
    value: '/painel/alunos',
    label: 'Alunos',
    href: '/painel/alunos',
    icon: <Icon icon={Users} size="sm" />,
  },
  {
    value: '/painel/biblioteca',
    label: 'Biblioteca',
    href: '/painel/biblioteca',
    icon: <Icon icon={Dumbbell} size="sm" />,
  },
];

const COLLAPSED_STORAGE_KEY = 'fitvo:nav-collapsed';

/**
 * Item ATIVO por prefixo, nao por igualdade: `/painel/alunos/bond-1/planos/plan-1`
 * precisa manter "Alunos" aceso. O `/painel` e o caso especial — como prefixo de
 * todos os outros, ele so acende na rota exata.
 */
function activeNavValue(pathname: string): string {
  const match = NAV_ITEMS.filter((item) => item.value !== '/painel').find((item) =>
    pathname.startsWith(item.value),
  );
  return match?.value ?? '/painel';
}

export function AppShell({ children }: { readonly children: ReactNode }): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, isSuccess } = useMe();

  // Nasce expandido e so encolhe depois que a preferencia salva e lida: o
  // caminho oposto (nascer encolhido) piscaria o rail para quem nunca colapsou,
  // e o localStorage nao existe no render do servidor.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true');
  }, []);

  function toggleCollapsed(): void {
    setCollapsed((previous) => {
      const next = !previous;
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  }

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
      <aside
        className={[
          'flex shrink-0 flex-col gap-6 border-r border-line bg-surface-raised p-3',
          'transition-[width] duration-normal ease-standard motion-reduce:transition-none',
          collapsed ? 'w-[68px]' : 'w-60',
        ].join(' ')}
      >
        <div className={collapsed ? 'flex justify-center pt-2' : 'px-2 pt-2'}>
          <Logo size={26} variant={collapsed ? 'icon' : 'wordmark'} />
        </div>

        <SideNav
          items={NAV_ITEMS}
          value={activeNavValue(pathname)}
          collapsed={collapsed}
          aria-label="Navegação principal"
        />

        {/* O colapso fica no rodape do proprio menu: no desktop o rail e um
            estado da navegacao, nao um botao de "abrir menu" no cabecalho. */}
        <div className="mt-auto">
          <Tooltip content={collapsed ? 'Expandir menu' : 'Recolher menu'} side="right">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              className={collapsed ? 'w-full justify-center px-0' : 'w-full justify-start'}
            >
              <Icon icon={collapsed ? PanelLeftOpen : PanelLeftClose} size="sm" />
              {collapsed ? null : 'Recolher'}
            </Button>
          </Tooltip>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-line bg-surface px-4 md:px-6">
          <p className="min-w-0 truncate font-heading text-h3 font-medium text-fg">
            {me?.displayName ?? ''}
          </p>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {me ? <Avatar name={me.displayName} size="sm" /> : null}
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <Icon icon={LogOut} size="sm" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
