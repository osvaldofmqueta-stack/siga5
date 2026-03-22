import { getApiUrl } from './query-client';

async function req<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const base = getApiUrl();
  const url = new URL(path, base).toString();
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => req<T>('GET', path),
  post: <T>(path: string, body: unknown) => req<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => req<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => req<T>('PATCH', path, body),
  delete: <T>(path: string) => req<T>('DELETE', path),
};
