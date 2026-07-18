import { cookies } from 'next/headers';

import type { AuthTokens } from './auth';
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE_FALLBACK,
  baseCookieOptions,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE_FALLBACK,
} from './cookies';

/**
 * Sessao guardada em cookies httpOnly (BFF — ADR do cliente web). O browser nunca
 * ve o token em JS; XSS nao rouba a sessao. So chamavel de route handler / server
 * action (cookies().set() nao vale em render de Server Component).
 *
 * No Next 15 o `cookies()` e ASSINCRONO — por isso os helpers sao `async`.
 */
function maxAgeFrom(expiresAt: string | undefined, fallback: number): number {
  if (!expiresAt) return fallback;
  const seconds = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
  return seconds > 0 ? seconds : fallback;
}

export async function setSessionCookies(tokens: AuthTokens): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.accessToken, {
    ...baseCookieOptions,
    maxAge: maxAgeFrom(tokens.accessExpiresAt, ACCESS_MAX_AGE_FALLBACK),
  });
  store.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions,
    maxAge: maxAgeFrom(tokens.refreshExpiresAt, REFRESH_MAX_AGE_FALLBACK),
  });
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}
