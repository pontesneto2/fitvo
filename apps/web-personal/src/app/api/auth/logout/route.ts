import { NextResponse } from 'next/server';

import { apiFetch } from '@/lib/api';
import { clearSessionCookies, getAccessToken } from '@/lib/session';

/**
 * BFF do logout. Best-effort: revoga a sessao no servidor (D-029) e sempre limpa
 * os cookies locais, mesmo que a chamada a API falhe.
 */
export async function POST(): Promise<NextResponse> {
  if (await getAccessToken()) {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
  }
  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
