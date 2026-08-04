'use client';

import { ToastProvider } from '@fitvo/ui-web';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import { DataProvider } from '@/data/context';

/**
 * Providers client-side do app: TanStack Query (stack oficial — ADR-0005), a fila
 * de toasts do design system e a camada de dados do painel. O QueryClient nasce
 * uma vez por montagem (useState) para nao ser recriado a cada render.
 *
 * O `DataProvider` e o unico lugar que decide QUAL implementacao de dados o
 * painel usa (hoje o mock em memoria — ver `src/data/`). Auth/cadastro NAO
 * passam por ele: aquelas telas ja falam com a API real via as rotas BFF.
 */
export function Providers({ children }: { readonly children: ReactNode }): ReactNode {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <DataProvider>
        <ToastProvider>{children}</ToastProvider>
      </DataProvider>
    </QueryClientProvider>
  );
}
