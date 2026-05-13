import { z } from 'zod';

// V1 MINIMAL — 4 top-level fields only: schemaVersion, adr, layers, boundaries.
// Everything else (domains/pinned, runtimeEntrypoints, documentedRuntimeFlows,
// forbiddenAstgrepEdges, ownershipBoundaries) belongs in dedicated contract files
// (PR-3 db.yaml, PR-4 runtime-topology.yaml, PR-5 ownership.yaml, PR-6 astgrep-contract.yaml).
// One file = one invariant kind. See architecture.yaml header doctrine for full rationale.

const SemverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'schemaVersion must be semver (X.Y.Z)');

// V1 FROZEN — 5 fields only. The contract is NOT a depcruise DSL.
// Adding fields here (dependencyTypes, pathNot, via, moreThanOneDependencyType, …)
// would turn architecture.yaml into a parallel depcruise grammar. Extension requires
// schemaVersion bump + ADR justification.
const DepcruiseEmitSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'depcruise rule name must be kebab-case'),
    severity: z.enum(['warn', 'error', 'info']),
    comment: z.string().min(1),
    fromPath: z.string().min(1),
    toPath: z.string().min(1),
  })
  .strict();

const BoundarySchema = z
  .object({
    id: z.string().min(1).regex(/^[a-z0-9-]+$/),
    rationale: z.string().min(10),
    emitDepcruise: z.array(DepcruiseEmitSchema).min(1),
  })
  .strict()
  .superRefine((b, ctx) => {
    const names = b.emitDepcruise.map((r) => r.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    if (dupes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate depcruise rule names in boundary "${b.id}": ${[...new Set(dupes)].join(', ')}`,
        path: ['emitDepcruise'],
      });
    }
  });

const LayerSchema = z
  .object({
    id: z.string().min(1).regex(/^[a-z0-9-]+$/),
    rootGlobs: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const ArchitectureContractSchema = z
  .object({
    schemaVersion: SemverSchema,
    adr: z.string().regex(/^ADR-\d{3,}$/, 'adr must be ADR-NNN'),
    layers: z.array(LayerSchema).min(2).max(10),
    boundaries: z.array(BoundarySchema).min(1).max(15),
  })
  .strict()
  .superRefine((c, ctx) => {
    // Cross-boundary uniqueness: each emitted depcruise rule name appears once.
    const allNames = c.boundaries.flatMap((b) => b.emitDepcruise.map((r) => r.name));
    const dupes = allNames.filter((n, i) => allNames.indexOf(n) !== i);
    if (dupes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate emitDepcruise.name across boundaries: ${[...new Set(dupes)].join(', ')}`,
        path: ['boundaries'],
      });
    }
  });

export type ArchitectureContract = z.infer<typeof ArchitectureContractSchema>;
export { BoundarySchema, DepcruiseEmitSchema, LayerSchema };
