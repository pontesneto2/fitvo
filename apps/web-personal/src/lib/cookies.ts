/**
 * Nomes e opcoes dos cookies de sessao. Modulo sem dependencia de `next/headers`
 * de proposito: e importado tanto pelos route handlers (via session.ts) quanto
 * pelo middleware (runtime edge), que nao pode usar `next/headers`.
 */
export const ACCESS_COOKIE = 'fitvo_at';
export const REFRESH_COOKIE = 'fitvo_rt';

/** Fallbacks de maxAge (segundos) quando o expiry nao vem no corpo da API. */
export const ACCESS_MAX_AGE_FALLBACK = 60 * 15; // 15 min
export const REFRESH_MAX_AGE_FALLBACK = 60 * 60 * 24 * 7; // 7 dias

export const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
} as const;
