import { NextResponse } from 'next/server';

import { apiUrl } from '@/lib/api';
import { acceptInviteInputSchema, type AcceptInviteResult } from '@/lib/auth';

/**
 * BFF do aceite de convite de paciente. Publico (o token de uso unico e a
 * autorizacao) — sem cookie de sessao no request, e a API NAO devolve tokens
 * (so cria a conta/vinculo — D-006/D-052/D-055): o paciente loga a parte
 * depois. Rate limit real ja e da API (5/min).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = acceptInviteInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos.' }, { status: 400 });
  }

  const res = await fetch(`${apiUrl()}/patients/invites/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed.data),
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 400) {
      return NextResponse.json(
        { error: 'Convite invalido, expirado, revogado ou ja utilizado.' },
        { status: 400 },
      );
    }
    if (res.status === 409) {
      return NextResponse.json(
        { error: 'Voce ja tem um vinculo ativo com este profissional nesta especialidade.' },
        { status: 409 },
      );
    }
    if (res.status === 429) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um minuto e tente de novo.' },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: 'Nao foi possivel aceitar o convite agora.' },
      { status: 502 },
    );
  }

  const data = (await res.json()) as AcceptInviteResult;
  return NextResponse.json(data, { status: 201 });
}
