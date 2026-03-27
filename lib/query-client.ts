import { fetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { enqueueOperation, isNetworkError } from "./offlineQueue";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SKIP_QUEUE_ROUTES = ["/api/login", "/api/logout", "/api/auth", "/api/register", "/api/licenca"];

function shouldQueue(method: string, route: string): boolean {
  if (!WRITE_METHODS.has(method.toUpperCase())) return false;
  return !SKIP_QUEUE_ROUTES.some((r) => route.startsWith(r));
}

export function getApiUrl(): string {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const { protocol, hostname, port, origin } = window.location;
    const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;

    if (configuredApiUrl) {
      return configuredApiUrl;
    }

    // Local web dev usually serves UI on :8000 and API on :5000.
    if ((hostname === "localhost" || hostname === "127.0.0.1") && port === "8000") {
      return `${protocol}//${hostname}:5000`;
    }

    return window.location.origin;
  }

  let host = process.env.EXPO_PUBLIC_DOMAIN;

  if (!host) {
    throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  }

  let url = new URL(`https://${host}`);

  return url.href;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
  options?: { skipQueue?: boolean }
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  try {
    const res = await fetch(url.toString(), {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
  } catch (err) {
    if (
      !options?.skipQueue &&
      shouldQueue(method, route) &&
      isNetworkError(err)
    ) {
      await enqueueOperation({ method, path: route, body: data });
    }
    throw err;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url.toString(), {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
