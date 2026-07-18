import { NextResponse } from 'next/server';

import { apiUrl } from '@/lib/api';
import { loginInputSchema, type LoginResult } from '@/lib/auth';
import { setSessionCookies } from '@/lib/session';

/**
 * BFF do login. Recebe {email,password} do formulario, chama POST /v1/auth/login,
 * e grava os tokens em cookies httpOnly — o browser nunca ve o token. Devolve so a
 * conta (dado nao sensivel) para a UI.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = loginInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos.' }, { status: 400 });
  }

  const res = await fetch(`${apiUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed.data),
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 401) {
      return NextResponse.json({ error: 'E-mail ou senha invalidos.' }, { status: 401 });
    }
    if (res.status === 429) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um minuto e tente de novo.' },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: 'Nao foi possivel entrar agora.' }, { status: 502 });
  }

  const data = (await res.json()) as LoginResult;
  await setSessionCookies(data.tokens);
  return NextResponse.json({ account: data.account });
}
