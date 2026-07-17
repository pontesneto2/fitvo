import { NextResponse } from 'next/server';

import { apiFetch, refreshSession } from '@/lib/api';
import type { Me } from '@/lib/auth';

/**
 * Conta autenticada (proxy de GET /v1/auth/me). Prova que o Bearer do cookie
 * funciona ponta a ponta. Se o access token expirou (401), tenta rotacionar uma
 * vez com o refresh e repete — silent refresh sem expor token ao cliente.
 */
export async function GET(): Promise<NextResponse> {
  let res = await apiFetch('/auth/me');

  if (res.status === 401 && (await refreshSession())) {
    res = await apiFetch('/auth/me');
  }

  if (!res.ok) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
  }

  const me = (await res.json()) as Me;
  return NextResponse.json(me);
}
