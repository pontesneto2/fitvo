import { NextResponse } from 'next/server';

import { apiUrl } from '@/lib/api';
import type { SpecialtyListResult } from '@/lib/specialty';

/**
 * BFF do catalogo de especialidades (proxy de GET /v1/specialties — D-047).
 * Publico, sem Bearer (mesmo motivo do endpoint na API: o cadastro que o
 * consome tambem e publico). So repassa — sem cache no browser, o catalogo
 * pode mudar (embora raramente).
 */
export async function GET(): Promise<NextResponse> {
  const res = await fetch(`${apiUrl()}/specialties`, { cache: 'no-store' });
  if (!res.ok) {
    return NextResponse.json(
      { error: 'Nao foi possivel carregar as especialidades agora.' },
      { status: 502 },
    );
  }
  const data = (await res.json()) as SpecialtyListResult;
  return NextResponse.json(data);
}
