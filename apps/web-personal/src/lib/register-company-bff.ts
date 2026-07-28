import type { z } from 'zod';

import { apiUrl } from '@/lib/api';
import { type LoginResult } from '@/lib/auth';
import { setSessionCookies } from '@/lib/session';

/**
 * BFF do cadastro público de EMPRESA — clínica (D-139) e academia (D-141).
 *
 * Os dois BFFs fazem exatamente a mesma coisa (spec §4.2/§4.3: é o mesmo
 * cadastro), mudando só o schema e o caminho da API. Em vez de duas rotas com o
 * mesmo corpo copiado, o corpo mora aqui e cada rota declara sua vertical: a
 * tradução de erro e a gravação de cookie são idênticas, e devem continuar
 * idênticas.
 *
 * Valida com o schema COMPARTILHADO de `@fitvo/validation` — o MESMO que a API
 * valida (contract-first, D-032) —, chama a API e grava os tokens em cookies
 * httpOnly: o browser nunca vê o token. O cliente normaliza (tira máscara, ISO
 * na data) antes de postar.
 */
export async function handleCompanyRegistration(
  request: Request,
  schema: z.ZodType,
  apiPath: string,
): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Dados invalidos.' }, { status: 400 });
  }

  const res = await fetch(`${apiUrl()}${apiPath}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed.data),
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 409) {
      return Response.json({ error: 'Ja existe uma conta com esse e-mail.' }, { status: 409 });
    }
    if (res.status === 400) {
      return Response.json({ error: 'Dados invalidos.' }, { status: 400 });
    }
    if (res.status === 404) {
      return Response.json({ error: 'Especialidade invalida.' }, { status: 404 });
    }
    return Response.json({ error: 'Nao foi possivel criar a conta agora.' }, { status: 502 });
  }

  const data = (await res.json()) as LoginResult;
  await setSessionCookies(data.tokens);
  return Response.json({ account: data.account }, { status: 201 });
}
