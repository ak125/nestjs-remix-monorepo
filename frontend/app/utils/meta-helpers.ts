import { type MetaFunction } from "@remix-run/node";

/**
 * Helper for noindex/nofollow routes (admin, commercial, account, staff).
 * Lives in a regular .ts file (not .server.ts) because MetaFunction
 * runs on both client and server during SPA navigation.
 */
export function createNoIndexMeta(title: string): ReturnType<MetaFunction> {
  return [
    { title: `${title} | Automecanik` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}
