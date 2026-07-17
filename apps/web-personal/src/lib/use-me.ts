import { useQuery } from '@tanstack/react-query';

import type { Me } from './auth';

async function fetchMe(): Promise<Me> {
  const res = await fetch('/api/me');
  if (!res.ok) {
    throw new Error('Nao autenticado.');
  }
  return (await res.json()) as Me;
}

/** Conta autenticada, via o proxy BFF /api/me (TanStack Query — ADR-0005). */
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: fetchMe, retry: false });
}
