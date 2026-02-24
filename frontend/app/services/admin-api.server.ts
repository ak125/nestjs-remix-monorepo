/**
 * Admin API client — lightweight helper for Remix admin loaders/actions.
 *
 * Combines existing utilities:
 *  - getInternalApiUrlFromRequest (URL construction)
 *  - Cookie forwarding from the incoming request
 *
 * Usage in a loader:
 *   const data = await adminFetch<MyType>("/api/admin/endpoint", request);
 *
 * With POST body:
 *   const result = await adminFetch<Res>("/api/admin/action", request, {
 *     method: "POST",
 *     body: { key: "value" },
 *   });
 */

import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";

export interface AdminFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  /** Extra headers merged with defaults (Cookie + Content-Type). */
  headers?: Record<string, string>;
}

/**
 * Fetch an internal backend endpoint with cookie forwarding.
 *
 * Throws a Response on non-2xx so Remix's error boundary handles it.
 */
export async function adminFetch<T = unknown>(
  path: string,
  request: Request,
  options?: AdminFetchOptions,
): Promise<T> {
  const url = getInternalApiUrlFromRequest(path, request);
  const cookie = request.headers.get("Cookie") || "";

  const res = await fetch(url, {
    method: options?.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      ...options?.headers,
    },
    ...(options?.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });

  if (!res.ok) {
    throw new Response(
      `Admin API ${options?.method || "GET"} ${path}: ${res.status}`,
      {
        status: res.status,
      },
    );
  }

  return res.json() as Promise<T>;
}

/**
 * Same as adminFetch but returns null on 404 instead of throwing.
 * Useful for optional data that may not exist yet.
 */
export async function adminFetchOptional<T = unknown>(
  path: string,
  request: Request,
  options?: AdminFetchOptions,
): Promise<T | null> {
  const url = getInternalApiUrlFromRequest(path, request);
  const cookie = request.headers.get("Cookie") || "";

  const res = await fetch(url, {
    method: options?.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      ...options?.headers,
    },
    ...(options?.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new Response(
      `Admin API ${options?.method || "GET"} ${path}: ${res.status}`,
      {
        status: res.status,
      },
    );
  }

  return res.json() as Promise<T>;
}

/**
 * Fetch multiple admin endpoints in parallel with Promise.allSettled.
 * Returns an array of results — fulfilled values or null for failed ones.
 */
export async function adminFetchAll<T extends readonly unknown[]>(
  requests: { [K in keyof T]: [path: string, options?: AdminFetchOptions] },
  request: Request,
): Promise<{ [K in keyof T]: T[K] | null }> {
  const promises = requests.map(([path, options]) =>
    adminFetch(path, request, options).catch(() => null),
  );

  const results = await Promise.all(promises);
  return results as { [K in keyof T]: T[K] | null };
}
