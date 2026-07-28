import { registerProfessionalSchema } from '@fitvo/validation';
import { NextResponse } from 'next/server';

import { apiUrl } from '@/lib/api';
import { type LoginResult } from '@/lib/auth';
import { setSessionCookies } from '@/lib/session';

/**
 * BFF do cadastro de profissional. Espelha o BFF de login: valida o corpo,
 * chama POST /v1/auth/register/professional e grava os tokens em cookies
 * httpOnly — o browser nunca ve o token.
 *
 * Validação CONTRACT-FIRST (D-032): reusa o `registerProfessionalSchema` de
 * `@fitvo/validation` — o MESMO schema que a API valida — em vez de um mirror
 * que pode divergir. O cliente normaliza (tira máscara, ISO na data) antes de
 * postar; aqui só reconferimos o contrato do fio.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = registerProfessionalSchema.safeParse(body);
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
