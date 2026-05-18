# @repo/registry

Zod schemas + TypeScript types for the **Repository Control Plane V1** (ADR-058).

## Architecture

3-layer registry per ADR-058 :

| Layer | Path | Generated ? | SoT ? |
|-------|------|-------------|-------|
| 1 — data auto | `audit/registry/{files,db,rpc,deps,runtime}.json` | yes (PR-C) | yes (couple with Layer 2) |
| 2 — overlay manuel | `.spec/00-canon/repository-registry/*.yaml` | no (PR-D) | yes (couple with Layer 1) |
| 3 — projection canonique | `audit/registry/canonical.json` | yes (PR-E) | **never** — reproductible depuis L1+L2 |

> **Règle invariante** : la SoT est le couple Layer 1 auto + Layer 2 overlay.
> Layer 3 est une projection canonique générée. Si elle diverge, on rebuild ;
> on ne l'édite jamais à la main.

## Exports

- **Shared** : `Status`, `SourceConfidence`, `DomainId`, `FileKind`, `Risk`,
  `DeletePolicy`, `DerivedFrom`, `SchemaVersion` (= `'1.0.0'`)
- **Layer 1 entries** : `FileEntry`, `DbTableEntry`, `RpcEntry`, `DepEntry`,
  `RuntimeEntry`
- **Layer 2 overlay** : `OwnershipEntry`/`OwnershipRegistry`, `DomainEntry`/`DomainsRegistry`,
  `StatusOverrideEntry`/`StatusOverrides`, `DeletePolicyEntry`/`DeletePolicyOverlay`
- **Layer 3 canonical** : `CanonicalRegistry`, `CanonicalMeta`

## Invariants V1

1. **V1-1 Versioning SemVer** : tous les schemas portent `schemaVersion: '1.0.0'`.
   Évolution selon §Schema Evolution Policy d'ADR-058 (Patch / Minor 30j /
   Major 60j + migrations).
2. **V1-2 Déterminisme strict** : appliqué par les builders Layer 1 (PR-C),
   pas par les schemas.
3. **V1-3 Classification jamais forcée** : `StatusSchema` inclut `UNKNOWN`,
   `SourceConfidenceSchema` permet `low`. Builders ne throw jamais.
4. **V1-4 Schema invariants minimaux** : implémenté dans
   `scripts/registry/validate-invariants.ts` (PR-E), pas dans ce package.
5. **V1-5 Tests round-trip** : ce package — 1 test valide + 1 test invalide
   par schema minimum.

## Usage

```ts
import { FileEntrySchema, type FileEntry, SchemaVersion } from "@repo/registry";

const entry: FileEntry = FileEntrySchema.parse({
  schemaVersion: SchemaVersion,
  id: "seo.r7.brand-enricher",
  path: "backend/src/modules/seo/services/r7-brand-enricher.service.ts",
  domain: "D3",
  kind: "service",
  status: "LIVE",
  owner: "@ak125/seo-team",
  sourceConfidence: "high",
  runtime: true,
  loc: 320,
});
```

## Hors scope V1 (différé)

- **V1.5** : `zod-to-json-schema` export, generated `.d.ts` distribution, RefId
  URN format (`kind:domain:id`), `classificationTrail[]` per entry, `fast-check`
  property-based tests.
- **V2** : MCP server (`@repo/registry-mcp`), SLSA L2 provenance, canonical-v2
  schema breaking change.

Voir ADR-058 §Scope V1 / V1.5 / V2 et le plan directeur monorepo
`/home/deploy/.claude/plans/verifier-la-vraie-logical-whistle.md`.

## Scripts

```bash
npm run -w @repo/registry typecheck   # tsc --noEmit
npm run -w @repo/registry test        # tsx --test src/**/*.test.ts
npm run -w @repo/registry build       # tsc
```

## Voir aussi

- ADR-058 : `governance-vault/ledger/decisions/adr/ADR-058-repository-control-plane.md`
- MOC : `governance-vault/ops/moc/MOC-Repository-Control-Plane.md`
- Plan directeur : `/home/deploy/.claude/plans/verifier-la-vraie-logical-whistle.md`
- Pattern de référence : `packages/seo-roles/` (`@repo/seo-roles`)
