import { z } from 'zod';
import { DomainIdSchema } from '../shared/domain';
import { OwnerIdSchema } from '../shared/owner';
import { AccessSurfaceSchema as SharedAccessSurfaceSchema } from '../shared/access-surface';

// V1 MINIMAL — 3 top-level fields only: schemaVersion, adr, tables[].
// Everything else (column DDL, RLS state, deletePolicy, RPC signatures,
// row counts, runtime metrics) belongs elsewhere — see db.yaml doctrine.
// One file = one invariant kind. Adding fields here = ADR + schemaVersion bump.

const SemverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'schemaVersion must be semver (X.Y.Z)');

const AdrIdSchema = z
  .string()
  .regex(/^ADR-\d{3,}$/, 'adr must be ADR-NNN');

// Reuse the canonical DomainIdSchema (D1..D15 + UNKNOWN) but reject UNKNOWN
// in db.yaml: this file is a human-edited canon SoT — domains MUST be
// explicit. UNKNOWN is only a Layer 1 auto-classification escape hatch.
const ContractDomainSchema = DomainIdSchema.refine(
  (d) => d !== 'UNKNOWN',
  { message: 'db.yaml domains must be explicit (D1..D15) — UNKNOWN is forbidden in canon SoT' },
);

// Alias for backward compatibility with existing db-contract consumers.
// Single source of truth = OwnerIdSchema in shared/owner.ts (PR-5).
const OwnerSchema = OwnerIdSchema;

// Table name in `schema.name` form (Postgres lowercase; underscores allowed,
// leading underscore allowed for private tables like __seo_page).
const TableNameSchema = z
  .string()
  .regex(/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/, 'table name must be schema.name (lowercase)');

// Alias for backward compatibility with existing db-contract consumers.
// Single source of truth = AccessSurfaceSchema in shared/access-surface.ts (PR-R).
const AccessSurfaceSchema = SharedAccessSurfaceSchema;

const CriticalitySchema = z.enum(['critical', 'high', 'normal']);

const TableSchema = z
  .object({
    name: TableNameSchema,
    domain: ContractDomainSchema,
    owner: OwnerSchema,
    criticality: CriticalitySchema,
    allowed_access_surfaces: z.array(AccessSurfaceSchema).min(1).max(8),
    forbidden_access_surfaces: z.array(AccessSurfaceSchema).min(1).max(8),
    notes: z.string().max(500).optional(),
  })
  .strict()
  .superRefine((t, ctx) => {
    const overlap = t.allowed_access_surfaces.filter((s) =>
      t.forbidden_access_surfaces.includes(s),
    );
    if (overlap.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `allowed_access_surfaces and forbidden_access_surfaces overlap on "${t.name}": ${[...new Set(overlap)].join(', ')}`,
        path: ['allowed_access_surfaces'],
      });
    }
  });

export const DbContractSchema = z
  .object({
    schemaVersion: SemverSchema,
    adr: AdrIdSchema,
    tables: z.array(TableSchema).min(1).max(20),
  })
  .strict()
  .superRefine((c, ctx) => {
    const names = c.tables.map((t) => t.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    if (dupes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate table.name: ${[...new Set(dupes)].join(', ')}`,
        path: ['tables'],
      });
    }
  });

export type DbContract = z.infer<typeof DbContractSchema>;
export {
  TableSchema,
  AccessSurfaceSchema,
  CriticalitySchema,
  OwnerSchema,
  TableNameSchema,
};
