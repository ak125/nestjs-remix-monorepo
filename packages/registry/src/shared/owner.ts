import { z } from "zod";

/**
 * Canonical owner identifier shared across Repository Contracts (architecture,
 * db, runtime-topology, future workers/events/cache/rpc/capabilities).
 *
 * V1 — CodeOwners-style format: `@org` or `@org/team`.
 *
 * Pattern matches the convention already in use across `db.yaml`,
 * `ownership.yaml`, and the (formerly-private) `OwnerSchema` from
 * `db-contract.ts`. PR-5 promotes this regex to a shared schema, then
 * `db-contract.ts` re-exports it as `OwnerSchema` (alias) for backward
 * compatibility. Single source of truth = this file.
 *
 * Examples:
 *   - `@ak125`              (org-level owner)
 *   - `@ak125/payments-team` (team-level owner)
 *
 * The Zod regex enforces format. The runtime FK enforcement (owner ∈
 * ownership.yaml owners) is delegated to per-contract cross-validation
 * tests (e.g. runtime-contract test §4.4b). V2 may promote to `z.enum([...])`
 * once `ownership.yaml` ownership ids are stable enough to enumerate.
 *
 * Anti-parallel-truth: every contract that needs to reference an owner MUST
 * import this schema, never define an inline regex. That guarantees a
 * single point of canonicalization in V2.
 *
 * @see [[feedback_verify_shared_schemas_before_inventing_zod]]
 * @see [[repository-contract-series-canon-20260514]] §46 Loi B
 */
export const OwnerIdSchema = z
  .string()
  .regex(
    /^@[a-z0-9-]+(\/[a-z0-9-]+)?$/,
    "owner must be @org or @org/team (lowercase + hyphens only)",
  );

export type OwnerId = z.infer<typeof OwnerIdSchema>;
