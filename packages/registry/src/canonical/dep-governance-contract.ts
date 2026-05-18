import { z } from "zod";
import { DomainIdSchema } from "../shared/domain";
import { OwnerIdSchema } from "../shared/owner";
import { FamilyIdSchema } from "../shared/family";

// V1 MINIMAL — 3 top-level fields only: schemaVersion, adr, dependencies[].
// Everything else (license restrictions, version constraints, CVE info,
// workspace deps, phantom-dep detection, cross-family forbidden imports)
// belongs elsewhere — see dep-governance.yaml doctrine.
//
// Anti-parallel-truth (canon §46 Loi B):
//   - family : reused from shared/family.ts (NEW shared in PR-D, 14 values)
//   - domain : reused from shared/domain.ts (D1..D15, then refined to forbid UNKNOWN)
//   - owner  : reused from shared/owner.ts (CodeOwners-style)
//   - id     : aligned with L1 entries/dep-entry.ts format `npm:<name>@<version>`
//
// L2 ⊆ L1 + overlay:
//   - L2 fields { id, name } are a subset of L1 DepEntry.
//   - L2 adds 3 governance overlay fields { family, domain, owner } that L1
//     cannot auto-extract (governance attribution).
//   - L1 fields explicitly omitted from L2: source, version, workspaces,
//     declaredIn, status, sourceConfidence, schemaVersion (per-entry) — these
//     are extraction/runtime concerns, not invariants of governance.

const SemverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "schemaVersion must be semver (X.Y.Z)");

const AdrIdSchema = z
  .string()
  .regex(/^ADR-\d{3,}$/, "adr must be ADR-NNN");

// Reuse DomainIdSchema (D1..D15 + UNKNOWN) but reject UNKNOWN: this file is
// a human-edited canon SoT — domains MUST be explicit. Mirror db-contract.ts:20
// + runtime-contract.ts.
const ContractDomainSchema = DomainIdSchema.refine(
  (d) => d !== "UNKNOWN",
  {
    message:
      "dep-governance.yaml domains must be explicit (D1..D15) — UNKNOWN is forbidden in canon SoT",
  },
);

// L1 id format = `npm:<name>@<version>` (verified on audit/registry/deps.json
// 232 entries). Strict format match enables cross-contract test §4.2.
//
// Version part accepts SemVer-range chars: `^`, `~`, `>=`, `<=`, `>`, `<`,
// digits, dots, hyphens (prerelease), plus signs (build metadata), letters
// (alpha/beta/rc tags). The `*` wildcard belongs to workspace: ids only and
// is intentionally rejected here (PR-D V1 scope = npm only, not workspace).
const DepIdSchema = z
  .string()
  .regex(
    /^npm:[@a-zA-Z0-9._/-]+@[\^~><=a-zA-Z0-9._\-+]+$/,
    "id must be `npm:<name>@<version>` (matches L1 audit/registry/deps.json format)",
  );

const DepNameSchema = z
  .string()
  .regex(
    /^[@a-zA-Z0-9._/-]+$/,
    "name must be a valid npm package name (scoped or unscoped)",
  );

const DepGovernanceEntrySchema = z
  .object({
    id: DepIdSchema,
    name: DepNameSchema,
    family: FamilyIdSchema,         // canonical family classification (NEW)
    domain: ContractDomainSchema,   // primary consuming domain (D1..D15)
    owner: OwnerIdSchema,           // CodeOwners-style FK, runtime check via test §4.4b
    notes: z.string().max(300).optional(),  // free-text rationale, e.g. "used by paybox-callback only"
  })
  .strict()
  .superRefine((entry, ctx) => {
    // id format must encode name: `npm:<name>@<version>` ⇒ stripped name matches `name` field.
    const idName = entry.id.replace(/^npm:/, "").replace(/@[^@]+$/, "");
    if (idName !== entry.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `id-name mismatch: id="${entry.id}" decodes name="${idName}" but name field is "${entry.name}"`,
        path: ["id"],
      });
    }
  });

export const DepGovernanceContractSchema = z
  .object({
    schemaVersion: SemverSchema,
    adr: AdrIdSchema,
    // .max(2000) is a SANITY CAP only (defends against accidental import of
    // a 50k file). The operational soft threshold (~500) is enforced by the
    // size-warning test (§4.6) — that's where ratchet conversations happen.
    dependencies: z.array(DepGovernanceEntrySchema).min(1).max(2000),
  })
  .strict()
  .superRefine((c, ctx) => {
    const ids = c.dependencies.map((d) => d.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate dependency.id: ${[...new Set(dupes)].join(", ")}`,
        path: ["dependencies"],
      });
    }
    const names = c.dependencies.map((d) => d.name);
    const nameDupes = names.filter((n, i) => names.indexOf(n) !== i);
    if (nameDupes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate dependency.name (different versions same package — choose one): ${[...new Set(nameDupes)].join(", ")}`,
        path: ["dependencies"],
      });
    }
  });

export type DepGovernanceContract = z.infer<typeof DepGovernanceContractSchema>;
export type DepGovernanceEntry = z.infer<typeof DepGovernanceEntrySchema>;

export {
  DepGovernanceEntrySchema,
  DepIdSchema,
  DepNameSchema,
  ContractDomainSchema,
};
