'use client';

import { ToastProvider } from '@fitvo/ui-web';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

/**
 * Providers client-side do app: TanStack Query (stack oficial — ADR-0005) e a fila
 * de toasts do design system. O QueryClient nasce uma vez por montagem (useState)
 * para nao ser recriado a cada render.
 */
export function Providers({ children }: { readonly children: ReactNode }): ReactNode {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
