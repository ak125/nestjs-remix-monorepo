import { z } from "zod";
import { DomainIdSchema } from "../shared/domain";
import { StatusSchema } from "../shared/status";
import { OwnerIdSchema } from "../shared/owner";
import { AccessSurfaceSchema } from "../shared/access-surface";

// V1 MINIMAL — 3 top-level fields only: schemaVersion, adr, rpcs[].
// Everything else (SQL signature args/returnType, SECURITY DEFINER deep
// security analysis, RPC→RPC dependency graph, usedBy callsite cross-check)
// belongs elsewhere — see rpc.yaml doctrine.
//
// Anti-parallel-truth (canon §46 Loi B):
//   - domain         : reused from shared/domain.ts (refined to forbid UNKNOWN)
//   - status         : reused from shared/status.ts (5 values)
//   - owner          : reused from shared/owner.ts (CodeOwners-style, PR-5)
//   - accessSurface  : reused from shared/access-surface.ts (PROMOTED from
//                      db-contract.ts in PR-R prep commit)
//
// L2 ⊆ L1 + overlay:
//   - L2 fields { id, name } are a subset of L1 RpcEntry (audit/registry/rpc.json).
//   - L2 adds 4 governance overlay fields { domain, owner, status, accessSurface[] }
//     that L1 cannot auto-extract (all 180 L1 entries currently have
//     domain=UNKNOWN, status=UNKNOWN — confirms governance gap PR-R fills).
//   - L1 fields explicitly omitted from L2: args, returnType, language,
//     securityDefiner, searchPath, definedInMigrations, usedBy, parseMode,
//     parseWarnings, parseError, schema, sourceConfidence, per-entry
//     schemaVersion — V2 concerns (signature, security analysis, dependency
//     graph) — out of PR-R V1 scope.

const SemverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "schemaVersion must be semver (X.Y.Z)");

const AdrIdSchema = z
  .string()
  .regex(/^ADR-\d{3,}$/, "adr must be ADR-NNN");

// Reuse DomainIdSchema (D1..D15 + UNKNOWN) but reject UNKNOWN: canon SoT
// requires explicit attribution. Mirror db-contract / dep-governance pattern.
const ContractDomainSchema = DomainIdSchema.refine(
  (d) => d !== "UNKNOWN",
  {
    message:
      "rpc.yaml domains must be explicit (D1..D15) — UNKNOWN is forbidden in canon SoT",
  },
);

// L1 id format = `<schema>.<name>` (verified on audit/registry/rpc.json
// 180 entries). All entries today use `public.<name>` but the schema
// allows any lowercase Postgres-valid schema prefix for forward-compat
// (e.g., `pgcrypto.*`, `vault.*` extensions which appear as kind=extension).
const RpcIdSchema = z
  .string()
  .regex(
    /^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/,
    "id must be `schema.name` lowercase (matches L1 audit/registry/rpc.json format)",
  );

const RpcNameSchema = z
  .string()
  .regex(
    /^[a-z_][a-z0-9_]*$/,
    "name must be a lowercase Postgres identifier (unqualified, no schema prefix)",
  );

const RpcContractEntrySchema = z
  .object({
    id: RpcIdSchema,                                        // `schema.name` matches L1
    name: RpcNameSchema,                                    // unqualified name
    domain: ContractDomainSchema,                           // D1..D15 (no UNKNOWN)
    owner: OwnerIdSchema,                                   // CodeOwners-style
    status: StatusSchema,                                   // 5 values (LIVE/LEGACY/DEPRECATED/ARCHIVED/UNKNOWN)
    accessSurface: z.array(AccessSurfaceSchema).min(1).max(8),  // who can call (1+, no overlap with forbidden V1)
    securityDefinerExpected: z.boolean().default(false),    // declared expectation (V1 = boolean only; V2 deep analysis)
    notes: z.string().max(300).optional(),                  // free-text rationale
  })
  .strict()
  .superRefine((entry, ctx) => {
    // id format must encode name: `<schema>.<name>` ⇒ name part must match the `name` field.
    const idName = entry.id.split(".").slice(1).join(".");
    if (idName !== entry.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `id-name mismatch: id="${entry.id}" decodes name="${idName}" but name field is "${entry.name}"`,
        path: ["id"],
      });
    }
    // accessSurface must not have duplicates within the array.
    const seen = new Set<string>();
    for (const s of entry.accessSurface) {
      if (seen.has(s)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate accessSurface value: "${s}"`,
          path: ["accessSurface"],
        });
        break;
      }
      seen.add(s);
    }
  });

export const RpcContractSchema = z
  .object({
    schemaVersion: SemverSchema,
    adr: AdrIdSchema,
    // .max(2000) is a SANITY CAP only (defends against accidental import of
    // a 50k file). The operational soft threshold (~100 for V1) is enforced
    // by the size-warning test (§4.6) — that's where ratchet conversations happen.
    rpcs: z.array(RpcContractEntrySchema).min(1).max(2000),
  })
  .strict()
  .superRefine((c, ctx) => {
    const ids = c.rpcs.map((r) => r.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate rpc.id: ${[...new Set(dupes)].join(", ")}`,
        path: ["rpcs"],
      });
    }
  });

export type RpcContract = z.infer<typeof RpcContractSchema>;
export type RpcContractEntry = z.infer<typeof RpcContractEntrySchema>;

export {
  RpcContractEntrySchema,
  RpcIdSchema,
  RpcNameSchema,
  ContractDomainSchema,
};
