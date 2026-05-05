# @repo/seo-roles

Single source of truth for canonical SEO page roles in the AutoMecanik monorepo.

## Règle métier figée

> **Legacy accepté en entrée, canon obligatoire en sortie.**

- Entrée tolérée : valeurs DB historiques (`R1_pieces`, `R3_BLOG`, `R3_guide`, `R3_guide_howto`, `R6_BUYING_GUIDE`, lowercase variants, etc.)
- Sortie obligatoire : `R0_HOME`, `R1_ROUTER`, `R2_PRODUCT`, `R3_CONSEILS`, `R4_REFERENCE`, `R5_DIAGNOSTIC`, `R6_GUIDE_ACHAT`, `R6_SUPPORT`, `R7_BRAND`, `R8_VEHICLE`

## FORBIDDEN_ROLE_IDS

Ces valeurs sont **rejetées** par `normalizeRoleId()` car ambiguës ou retirées :

- `R3` (bare) — ambigu entre R3_CONSEILS et R6_GUIDE_ACHAT, demande désambiguïsation contextuelle
- `R6` (bare) — ambigu entre R6_GUIDE_ACHAT et R6_SUPPORT
- `R9` — la gouvernance n'appartient plus à la série R*, voir série G*
- `R3_GUIDE` — orphan role déprécié (pas de route, pas de contrat)

## Exports

### Core (PR-0A, v0.1.0)

| Symbol | Type | Usage |
|--------|------|-------|
| `RoleId` | enum | Énumération canonique des rôles |
| `ROLE_ID_LIST` | `RoleId[]` | Itération / validation |
| `LEGACY_ROLE_ALIASES` | `Record<string, RoleId>` | Mapping legacy → canonical |
| `FORBIDDEN_ROLE_IDS` | `readonly string[]` | Liste des rôles ambigus à rejeter |
| `normalizeRoleId(input)` | `(string) => RoleId \| null` | Normalisation tolérante (entrées) |
| `assertCanonicalRole(role)` | `(string) => RoleId` | Assertion stricte (sorties) |
| `roleIdToPageType(roleId)` | `(RoleId) => string \| null` | Conversion vers worker page_type |
| `pageTypeToRoleId(pageType)` | `(string) => RoleId \| null` | Conversion depuis worker page_type |
| `getRoleDisplayLabel(role)` | `(string) => string` | Label FR pour UI admin |
| `getRoleShortLabel(role)` | `(string) => string` | Label court (R1, R3, ...) |
| `ROLE_BADGE_COLORS` | `Record<RoleId, string>` | Classes Tailwind par rôle |

### Compile-time + Runtime guards (PR-0B, v0.2.0)

| Symbol | Type | Usage |
|--------|------|-------|
| `CanonicalRoleId` | branded type | `RoleId & { __brand: 'CanonicalRoleId' }` — empêche compile-time qu'un string brut soit retourné comme rôle canonique |
| `assertCanonicalRoleStrict(role)` | `(string) => CanonicalRoleId` | Assertion stricte retournant un type branded (force le pipeline normalize → assert → return) |
| `isCanonicalRoleId(role)` | type guard | Predicate pour TypeScript narrowing |
| `tolerantRoleSchema` | Zod | Schema acceptant canonical OR legacy, transform → `CanonicalRoleId`. À utiliser pour les **entrées** (request bodies, DB rows) |
| `canonicalRoleSchema` | Zod | Schema strict acceptant uniquement canonical. À utiliser pour les **sorties** (response payloads) |
| `roleIdNativeEnum` | Zod | `z.nativeEnum(RoleId)` pour génération OpenAPI |

## Cas particulier — `R6` ambigu

`getRoleDisplayLabel('R6')` retourne `"R6 · Legacy à qualifier"` sans normalisation silencieuse. La résolution `R6 → R6_GUIDE_ACHAT | R6_SUPPORT` requiert le **contexte URL**, fourni par un adapter serveur (futur `RoleDisambiguationService` côté backend NestJS) qui appellera la PL/pgSQL `assign_page_role_from_url()`. Ce package reste pur — aucune dépendance Supabase, aucun appel réseau.

> **Note PR-0B** : l'adapter `RoleDisambiguationService` est **différé en PR-4B** (où la PL/pgSQL `assign_page_role_from_url()` sera également patchée pour retourner les valeurs canoniques `R6_GUIDE_ACHAT`/`R6_SUPPORT` au lieu des formes courtes `R6` actuelles). Implémenter l'adapter en PR-0B nécessiterait soit (a) une duplication de patterns URL côté TypeScript (interdit par contrat), soit (b) un bridge temporaire short→canonical (bricolage). PR-2 peut consommer Zod boundary directement sans cet adapter.

## Usage

```typescript
// Backend NestJS — Zod boundary pattern (PR-0B)
import { z } from 'zod';
import { tolerantRoleSchema, canonicalRoleSchema } from '@repo/seo-roles';

const ResponseSchema = z.object({
  role: canonicalRoleSchema, // strict, refuse legacy en sortie
  metadata: z.record(z.unknown()),
});

const RowSchema = z.object({
  role: tolerantRoleSchema, // tolérant, transform legacy → canonical
});

@Get(':slug')
async getReference(@Param('slug') slug: string) {
  const raw = await this.db.query(...);
  const normalized = RowSchema.parse(raw); // accepte R3_BLOG, R3_guide, etc.
  return ResponseSchema.parse(normalized); // garantit canonical en sortie
}
```

```typescript
// Backend NestJS — branded type compile-time guard (PR-0B)
import { CanonicalRoleId, assertCanonicalRoleStrict } from '@repo/seo-roles';

function getRole(): CanonicalRoleId {
  const raw = readFromDb();
  return assertCanonicalRoleStrict(raw); // ✅ branded
  // return "R3_BLOG"; // ❌ TS2322 : Type 'string' is not assignable to 'CanonicalRoleId'
}
```

```typescript
// Frontend Remix — display only (PR-0A)
import { getRoleDisplayLabel, ROLE_BADGE_COLORS } from '@repo/seo-roles';

<Badge className={ROLE_BADGE_COLORS[role]}>
  {getRoleDisplayLabel(role)}
</Badge>
```

## Build

```bash
npm run build       # tsc → dist/
npm run typecheck   # no emit, just verify
npm run test        # tsx --test
```

## Reference

- Canon vault : `.spec/00-canon/db-governance/legacy-canon-map.md`
- ADR : `governance-vault/ledger/decisions/adr/ADR-037-agent-naming-canon.md`
- Roadmap : plan PR-0A → PR-1 → PR-0B → PR-2 → PR-3 → PR-4A/B → PR-5
