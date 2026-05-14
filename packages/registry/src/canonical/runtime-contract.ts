import { z } from "zod";
import { DomainIdSchema } from "../shared/domain";
import { StatusSchema } from "../shared/status";
import { OwnerIdSchema } from "../shared/owner";
import { RuntimeKindSchema } from "../entries/runtime-entry";

// V1 MINIMAL — 3 top-level fields only: schemaVersion, adr, entrypoints[].
// Everything else (queue concurrency, cron schedules, cache TTL, RPC
// signatures, HTTP auth gates, event subscribers) belongs elsewhere — see
// runtime-topology.yaml doctrine. One file = one invariant kind.
//
// Anti-parallel-truth (canon §46 Loi B):
//   - kind   : reused from entries/runtime-entry.ts (Layer 1 enum, 10 values)
//   - status : reused from shared/status.ts (5 values)
//   - domain : reused from shared/domain.ts (D1..D15 + UNKNOWN, then refined)
//   - owner  : reused from shared/owner.ts (CodeOwners-style)
//   - layer  : NOT an enum here — referenced as string + cross-validated
//              against architecture.yaml#layers[].id (test §4.5a) and
//              against inferLayerFromPath(path, architectureLayers) (test §4.5b).
//
// L2 ⊆ L1 + overlay:
//   - L2 fields { id, kind, path, status } are a subset of L1 RuntimeEntry.
//   - L2 adds 3 overlay fields { layer, domain, owner } that L1 cannot
//     auto-extract (governance attribution).
//   - L1 fields explicitly omitted from L2: sourceConfidence (extraction
//     metadata), dependsOn (startup DAG), servesRoute / servesPath (runtime
//     details), per-entry schemaVersion (top-level only here).

const SemverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "schemaVersion must be semver (X.Y.Z)");

const AdrIdSchema = z
  .string()
  .regex(/^ADR-\d{3,}$/, "adr must be ADR-NNN");

// Reuse DomainIdSchema (D1..D15 + UNKNOWN) but reject UNKNOWN: this file is
// a human-edited canon SoT — domains MUST be explicit. UNKNOWN is only a
// Layer 1 auto-classification escape hatch. Mirror db-contract.ts:20.
const ContractDomainSchema = DomainIdSchema.refine(
  (d) => d !== "UNKNOWN",
  {
    message:
      "runtime-topology.yaml domains must be explicit (D1..D15) — UNKNOWN is forbidden in canon SoT",
  },
);

// L1 id format = `runtime:<path>` (verified on audit/registry/runtime.json
// 470 entries). Strict format match enables the cross-contract test §4.2 to
// validate that every L2 entry id exists in L1.
const RuntimeIdSchema = z
  .string()
  .regex(
    /^runtime:[a-zA-Z0-9._\-/]+$/,
    "id must be `runtime:<path>` (matches L1 audit/registry/runtime.json format)",
  );

const RuntimePathSchema = z
  .string()
  .regex(
    /^[a-zA-Z0-9._\-/]+$/,
    "path must be a monorepo-relative POSIX path (no leading slash, no spaces)",
  );

// Layer is intentionally `z.string()` here. The set of valid layer ids is
// declared in architecture.yaml#layers[].id. Cross-contract tests §4.5a/§4.5b
// validate FK + path-coherence.
const RuntimeContractEntrypointSchema = z
  .object({
    id: RuntimeIdSchema,
    kind: RuntimeKindSchema,
    path: RuntimePathSchema,
    layer: z.string().min(1),
    domain: ContractDomainSchema,
    owner: OwnerIdSchema,
    status: StatusSchema,
  })
  .strict()
  .superRefine((entry, ctx) => {
    // id format must encode path: `runtime:<path>` ⇒ strip prefix matches path.
    const expectedId = `runtime:${entry.path}`;
    if (entry.id !== expectedId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `id "${entry.id}" must equal "runtime:${entry.path}" (id encodes path)`,
        path: ["id"],
      });
    }
  });

export const RuntimeContractSchema = z
  .object({
    schemaVersion: SemverSchema,
    adr: AdrIdSchema,
    // .max(5000) is a SANITY CAP only (defends against accidental import of
    // a 50k file). The operational soft threshold (~600) is enforced by the
    // size-warning test (§4.6), which is the place to ratchet — never bump
    // this max() to 700/900/etc as a substitute for that conversation.
    entrypoints: z.array(RuntimeContractEntrypointSchema).min(1).max(5000),
  })
  .strict()
  .superRefine((c, ctx) => {
    const ids = c.entrypoints.map((e) => e.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate entrypoint.id: ${[...new Set(dupes)].join(", ")}`,
        path: ["entrypoints"],
      });
    }
  });

export type RuntimeContract = z.infer<typeof RuntimeContractSchema>;
export type RuntimeContractEntrypoint = z.infer<
  typeof RuntimeContractEntrypointSchema
>;

export {
  RuntimeContractEntrypointSchema,
  RuntimeIdSchema,
  RuntimePathSchema,
  ContractDomainSchema,
};
