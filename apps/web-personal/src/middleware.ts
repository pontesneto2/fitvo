import { type NextRequest, NextResponse } from 'next/server';

import { REFRESH_COOKIE } from '@/lib/cookies';

/**
 * Guarda das rotas do painel. Checagem barata de PRESENCA do cookie de sessao
 * (o refresh, de vida longa); a validacao real e da API no Bearer. Sem sessao ->
 * redireciona para /login. Nao usa next/headers (indisponivel no edge).
 */
export function middleware(request: NextRequest): NextResponse {
  if (request.cookies.has(REFRESH_COOKIE)) {
    return NextResponse.next();
  }
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/painel/:path*'],
};
