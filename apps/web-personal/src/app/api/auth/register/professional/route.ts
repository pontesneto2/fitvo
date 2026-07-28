import { NextResponse } from 'next/server';

import { apiUrl } from '@/lib/api';
import { type LoginResult, registerProfessionalInputSchema } from '@/lib/auth';
import { setSessionCookies } from '@/lib/session';

/**
 * BFF do cadastro de profissional. Espelha o BFF de login: valida o corpo,
 * chama POST /v1/auth/register/professional e grava os tokens em cookies
 * httpOnly — o browser nunca ve o token.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = registerProfessionalInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos.' }, { status: 400 });
  }

  const res = await fetch(`${apiUrl()}/auth/register/professional`, {
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
