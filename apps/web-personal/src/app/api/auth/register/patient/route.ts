import { NextResponse } from 'next/server';

import { apiUrl } from '@/lib/api';
import { type LoginResult, registerPatientInputSchema } from '@/lib/auth';
import { setSessionCookies } from '@/lib/session';

/**
 * BFF do cadastro de paciente. Espelha o BFF de login: valida o corpo, chama
 * POST /v1/auth/register/patient e grava os tokens em cookies httpOnly.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = registerPatientInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos.' }, { status: 400 });
  }

  const res = await fetch(`${apiUrl()}/auth/register/patient`, {
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
    return NextResponse.json({ error: 'Nao foi possivel criar a conta agora.' }, { status: 502 });
  }

  const data = (await res.json()) as LoginResult;
  await setSessionCookies(data.tokens);
  return NextResponse.json({ account: data.account }, { status: 201 });
}
