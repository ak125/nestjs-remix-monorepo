import { z } from "zod";

/**
 * Canonical owner identifier shared across Repository Contracts (architecture,
 * db, runtime-topology, future workers/events/cache/rpc/capabilities).
 *
 * V1 — permissive: `z.string().min(1)`.
 *
 * The runtime FK enforcement is performed by cross-contract tests (e.g.
 * runtime-contract test §4.4b checks that every `entry.owner` appears as an
 * `owner:` value in `ownership.yaml`). The schema stays permissive at V1 to
 * avoid forcing a global ownership canonicalization PR before any contract
 * can adopt the type.
 *
 * V2 (post canonicalization PR) — promote to `z.enum([...])` with the
 * exhaustive list of canonical owner ids declared in `ownership.yaml`. Once
 * V2 lands, the per-contract test 4b becomes redundant with Zod and can be
 * removed.
 *
 * Anti-parallel-truth: every contract that needs to reference an owner MUST
 * import this schema, never `z.string().min(1)` inline. That guarantees a
 * single point of canonicalization in V2.
 *
 * @see [[feedback_verify_shared_schemas_before_inventing_zod]]
 * @see [[repository-contract-series-canon-20260514]] §46 Loi B
 */
export const OwnerIdSchema = z.string().min(1);

export type OwnerId = z.infer<typeof OwnerIdSchema>;
