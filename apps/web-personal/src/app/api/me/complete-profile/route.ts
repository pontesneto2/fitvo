import { NextResponse } from 'next/server';

import { apiFetch, refreshSession } from '@/lib/api';

/**
 * Completar perfil (proxy de PATCH /v1/auth/me/complete-profile) — gate da
 * spec §5. Mesmo padrão dos demais proxies: o Bearer vive no cookie httpOnly e
 * nunca chega ao cliente; um 401 tenta rotacionar o refresh UMA vez e repete.
 *
 * O BFF NÃO revalida o corpo: quem valida é o contrato compartilhado
 * (`completeProfileSchema`, D-032) na borda da API. Duplicar a regra aqui
 * criaria uma segunda cópia livre para divergir.
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as unknown;
  const send = (): Promise<Response> =>
    apiFetch('/auth/me/complete-profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  let res = await send();
  if (res.status === 401 && (await refreshSession())) {
    res = await send();
  }

  const payload = (await res.json().catch(() => null)) as unknown;
  return NextResponse.json(payload ?? { error: 'Falha ao completar o perfil.' }, {
    status: res.status,
  });
}
