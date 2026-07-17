import { NextResponse } from 'next/server';

import { refreshSession } from '@/lib/api';

/** BFF do refresh: rotaciona os tokens a partir do refresh cookie. */
export async function POST(): Promise<NextResponse> {
  const ok = await refreshSession();
  return NextResponse.json({ ok }, { status: ok ? 200 : 401 });
}
