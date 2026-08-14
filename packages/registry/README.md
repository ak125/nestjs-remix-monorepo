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
  `StatusOverrideEntry`/`StatusOverrides`, `DeletePolicyEntry`/`DeletePolicyOverlay`,
  `AutomationEntry`/`AutomationReality` (+ `AutomationModeEnum`, `IntendedModeEnum`,
  `RuntimeEvidence`, etc. — see `overlay/automation-reality.ts`)
- **Layer 3 canonical** : `CanonicalRegistry`, `CanonicalMeta`

## Automation Reality Registry

`AutomationReality` (overlay file `.spec/00-canon/repository-registry/automation-reality.yaml`)
formalises the distinction between automation **DESIGN** (cabled — workflow,
script, migration exists) and automation **REALITY** (running — trigger fired,
output produced, consumer observed). First registry in the monorepo to model
this gap as `intended_mode` vs `actual_mode`.

**Key rules (anti-fourre-tout)** :

- `actual_mode: ACTIVE` requires `runtime_evidence` proving trigger + output +
  consumer signals (or explicit `"no-consumer-by-design"` for audit-only systems).
- `intended_mode = MANUAL` + `actual_mode = MANUAL` → 0 gap, no `missing_step`
  required. MANUAL is a valid design (human-by-doctrine, e.g. PR-9 rule #27),
  NOT incomplete automation.
- `actual_mode: WARN_ONLY_DEGRADED` requires evidence with a note containing
  `"regression"` (prevents the field becoming a catch-all bucket).
- `last_verified_at` must NEVER be bumped by a bot. Three defenses : Zod regex
  on `last_verified_by` (must be `@github-handle` or `seed:*`), CI gate
  `automation-registry-no-auto-bump.yml`, README explicit norm.
- When `evidence` references a `line:`, an `excerpt:` substring is REQUIRED
  to detect silent drift after file edits.

**How to add an entry** (post-merge V1) :

```bash
# 1. Edit overlay
$EDITOR .spec/00-canon/repository-registry/automation-reality.yaml

# 2. Validate locally before commit (Zod + evidence path + excerpt drift)
npx tsx scripts/registry/validate-automation-overlay.ts

# 3. Modifying the overlay requires regenerating the canonical projection :
node scripts/registry/build-canonical-registry.js
git add audit/registry/canonical.json .spec/00-canon/repository-registry/automation-reality.yaml
```

**Governance gravity defense** : the registry has a soft cap of ≤30 entries
in V1 before pattern re-evaluation. Each `ACTIVE` entry maintains ≤3 runtime
probes (trigger/output/consumer). PRs adding >5 entries at once require
explicit justification. See `/home/deploy/.claude/plans/utiliser-superpower-oui-frolicking-bengio.md`
§"Defense against governance gravity".

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

### Resynchroniser les projections L1+L3 — `npm run registry:heal`

```bash
npm run registry:heal   # rebuild + git add + git commit des 6 audit/registry/*.json
```

**Pourquoi un script dédié plutôt qu'un `git add` manuel.** Le pre-commit
[`check-no-manual-edit-generated.sh`](../../scripts/registry/check-no-manual-edit-generated.sh)
refuse tout staging de `audit/registry/*.json` qui ne satisfait pas **deux** conditions :
`npm_lifecycle_event` matchant `^registry:` **et** la reproductibilité (il relance
`npm run registry` et compare les sha256).

Or `npm_lifecycle_event` n'existe que dans les processus **enfants** d'un script npm : après
un `npm run registry` terminé, un `git commit` lancé depuis le shell ne la porte plus. La
procédure suggérée par le message du guard — « run `npm run registry` to regenerate, then
git add » — était donc inapplicable telle quelle, et aucun script npm ne faisait le staging.
`registry:heal` fournit ce chaînon : le `git commit` s'exécute **dans** le script, hérite de
`npm_lifecycle_event=registry:heal`, et la garde valide légitimement les deux conditions.

Ce n'est pas un contournement : la condition (b) reste intégralement appliquée — le guard
rebuild et compare, et rejette tout contenu non reproductible depuis les sources L1+L2
courantes. C'est d'ailleurs elle que le script lui-même désigne comme *« the substantive
defense »*.

> ⚠️ **À exécuter depuis Linux (serveur DEV), jamais depuis un poste Windows** — tant que
> `files.json` n'est pas traité (voir ci-dessous).

#### État de la reproductibilité cross-plateforme (2026-08-14)

Mesuré en confrontant un build Windows au runner Linux **au même commit**, via les `sha256`
que le step *Freshness diff* imprime désormais par artefact :

| Projection | Cross-plateforme | Note |
|---|---|---|
| `runtime.json` | ✅ identique | |
| `db.json` | ✅ identique | |
| `rpc.json` | ✅ identique | |
| `deps.json` | ✅ identique | **corrigé** — `path.join()` injectait `backend\package.json` dans 216 `declaredIn` |
| `files.json` | ❌ **diverge** | cause non isolée |
| `canonical.json` | ❌ diverge | par ricochet : il agrège `files.json` |

**`files.json` — ce qui a été éliminé** (chaque piste vérifiée puis infirmée) : `localeCompare`
(absent de `scripts/registry/`), `readdirSync` non trié, `sortById` (déjà codepoint),
`Date.now`/`random` dans le builder canonical, ordre des steps CI (reproduit en local à
l'identique), input gitignoré parmi les 10 `inputHashes` (tous versionnés), casse des imports
(0 divergence vs `git ls-files`), séparateurs Windows (0 backslash), fichiers untracked
capturés (0 dans le cache comme dans la projection).

**Ce qui reste** : `files.json` dérive de `audit/cache/codebase-inventory.json` — un cache
**gitignoré**, absent des `inputHashes`, comparé par aucun gate. Les 2837 entrées sont
identiques des deux côtés ; ce sont les **valeurs** qui diffèrent, et le diff (576 lignes)
correspond aux champs `runtime`/`status` de ~288 entrées — soit la reachability transitive
calculée sur les `imports` de ce cache, produits par `dependency-cruiser`. La divergence est
donc vraisemblablement dans la résolution d'imports de cet outil tiers selon l'OS.

Trancher demande de comparer deux caches générés sur les deux OS au même commit — le cache
étant gitignoré, cela suppose un accès simultané aux deux machines.

**Périmètre.** `registry:heal` couvre les **6** projections. Le bot
[`registry-deps-self-heal.yml`](../../.github/workflows/registry-deps-self-heal.yml) n'en
couvre que **4** (`deps`, `pr-9-inventory`, `canonical`, `llm-map`) et *abort* si autre chose
bouge : `files.json`, `runtime.json`, `db.json` et `rpc.json` n'ont aucun chemin de resync
automatique et relèvent de ce script (cf. les resyncs manuelles #990, #1078, #1116).

## Voir aussi

- ADR-058 : `governance-vault/ledger/decisions/adr/ADR-058-repository-control-plane.md`
- MOC : `governance-vault/ops/moc/MOC-Repository-Control-Plane.md`
- Plan directeur : `/home/deploy/.claude/plans/verifier-la-vraie-logical-whistle.md`
- Pattern de référence : `packages/seo-roles/` (`@repo/seo-roles`)
