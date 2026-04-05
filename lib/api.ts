import { getApiUrl } from './query-client';
import { getAuthToken } from '../context/AuthContext';
import { enqueueOperation, isNetworkError } from './offlineQueue';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SKIP_QUEUE_ROUTES = ['/api/login', '/api/logout', '/api/auth', '/api/register', '/api/licenca'];

function shouldQueue(method: string, route: string): boolean {
  if (!WRITE_METHODS.has(method.toUpperCase())) return false;
  return !SKIP_QUEUE_ROUTES.some((r) => route.startsWith(r));
}

async function req<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  options?: { skipQueue?: boolean }
): Promise<T> {
  const base = getApiUrl();
  const url = new URL(path, base).toString();

  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  } catch (err) {
    if (
      !options?.skipQueue &&
      shouldQueue(method, path) &&
      isNetworkError(err)
    ) {
      await enqueueOperation({ method, path, body });
    }
    throw err;
  }
}

export const api = {
  get:    <T>(path: string)                               => req<T>('GET',    path),
  post:   <T>(path: string, body: unknown)                => req<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown)                => req<T>('PUT',    path, body),
  patch:  <T>(path: string, body: unknown)                => req<T>('PATCH',  path, body),
  delete: <T>(path: string, options?: { skipQueue?: boolean }) => req<T>('DELETE', path, undefined, options),
};
