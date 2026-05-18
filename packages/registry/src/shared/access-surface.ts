import { z } from "zod";

/**
 * Canonical access surface enum — describes WHO can call a given resource
 * (DB table, RPC function, edge function, HTTP endpoint, etc.).
 *
 * Originally declared privately in `canonical/db-contract.ts:35` as part of
 * `allowed_access_surfaces` / `forbidden_access_surfaces` for tables. PR-R
 * (RPC Contract V1) needs the same enum for RPC `accessSurface[]` field —
 * promoted here to avoid parallel-truth duplication.
 *
 * Db-contract.ts re-exports this as `AccessSurfaceSchema` (alias) for
 * backward compatibility. Single source of truth = this file.
 *
 * Surfaces:
 *   - `backend`        : NestJS controllers / services (server runtime)
 *   - `rpc`            : called from another RPC function (Postgres-internal)
 *   - `frontend`       : Remix loaders/actions (SSR runtime)
 *   - `anon`           : unauthenticated client (Supabase JS with anon key)
 *   - `authenticated`  : authenticated client (Supabase JS with user JWT)
 *   - `service_role`   : Supabase service role key (bypass RLS)
 *   - `edge_function`  : Supabase Edge Functions (Deno runtime)
 *   - `worker`         : BullMQ worker process (Node runtime, separate from main)
 *
 * Adding a value REQUIRES schemaVersion bump on consuming contracts (db.yaml,
 * rpc.yaml) + ADR if the surface introduces a new security boundary.
 *
 * @see [[feedback_verify_shared_schemas_before_inventing_zod]]
 * @see [[repository-contract-series-canon-20260514]] §46 Loi B
 */
export const AccessSurfaceSchema = z.enum([
  "backend",
  "rpc",
  "frontend",
  "anon",
  "authenticated",
  "service_role",
  "edge_function",
  "worker",
]);

export type AccessSurface = z.infer<typeof AccessSurfaceSchema>;
