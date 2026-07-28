import { registerClinicSchema } from '@fitvo/validation';
import { NextResponse } from 'next/server';

import { apiUrl } from '@/lib/api';
import { type LoginResult } from '@/lib/auth';
import { setSessionCookies } from '@/lib/session';

/**
 * BFF do cadastro público de clínica (D-139). Espelha o BFF do autônomo: valida
 * o corpo com o `registerClinicSchema` COMPARTILHADO (@fitvo/validation — o mesmo
 * que a API valida, contract-first D-032), chama POST /v1/auth/register/clinic e
 * grava os tokens em cookies httpOnly — o browser nunca vê o token. O cliente
 * normaliza (tira máscara, ISO na data) antes de postar.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = registerClinicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos.' }, { status: 400 });
  }

  const res = await fetch(`${apiUrl()}/auth/register/clinic`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed.data),
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 409) {
      return NextResponse.json({ error: 'Ja existe uma conta com esse e-mail.' }, { status: 409 });
    }
    if (res.status === 400) {
      return NextResponse.json({ error: 'Dados invalidos.' }, { status: 400 });
    }
    if (res.status === 404) {
      return NextResponse.json({ error: 'Especialidade invalida.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Nao foi possivel criar a conta agora.' }, { status: 502 });
  }

  const data = (await res.json()) as LoginResult;
  await setSessionCookies(data.tokens);
  return NextResponse.json({ account: data.account }, { status: 201 });
}
