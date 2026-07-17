import type { AuthTokens } from './auth';
import { getAccessToken, getRefreshToken, setSessionCookies } from './session';

/**
 * Cliente server-side da API FITVO. Vive so no servidor (BFF): le o Bearer do
 * cookie httpOnly e nunca expoe token ao browser. NAO importar de client component.
 */
export function apiUrl(): string {
  const url = process.env.API_URL;
  if (!url) {
    throw new Error('API_URL nao configurada — ver apps/web-personal/.env.example.');
  }
  return url;
}

/** Chamada a API anexando o access token do cookie, se houver. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  return fetch(`${apiUrl()}${path}`, { ...init, headers, cache: 'no-store' });
}

/**
 * Rotaciona a sessao com o refresh token do cookie (D-029: rotacao a cada uso) e
 * grava os novos cookies. Retorna false se nao ha refresh ou a API recusou.
 */
export async function refreshSession(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;

  const res = await fetch(`${apiUrl()}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  if (!res.ok) return false;

  const data = (await res.json()) as { tokens: AuthTokens };
  await setSessionCookies(data.tokens);
  return true;
}
