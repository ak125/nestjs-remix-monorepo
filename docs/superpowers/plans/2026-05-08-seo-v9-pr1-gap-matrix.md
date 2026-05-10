# SEO v9 PR-1 — Audit inventaire + matrice gap legacy → monorepo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer `docs/seo/legacy_to_monorepo_gap_matrix.md` (matrice ligne par fichier PHP legacy → équivalent monorepo + statut + gap + priorité) + JSON raw `audit/seo-v9-inventaire-{date}.json`. READ-ONLY, 0 impact prod.

**Architecture:** 1 script orchestrateur `audit-v9-inventaire.ts` qui appelle 5 modules SRP (1 par volet : inventory-services, diff-v4, r2-routes, r2-volume, php-vs-remix) + 1 générateur markdown. Tests Vitest unitaires sur logique pure, tests integration mocked-Supabase.

**Tech Stack:**
- TypeScript Node.js (`tsx` runner) — script standalone hors NestJS
- Zod pour types et validation
- Supabase JS SDK (read-only, service role)
- `globby` + `simple-git-grep` pour grep filesystem
- Vitest pour tests unitaires
- Output Markdown généré via templates littéraux (pas de lib externe)

**Branche:** `feat/seo-v9-pr1-gap-matrix` (déjà créée depuis origin/main)

**Plan stratégique référence:** `/home/deploy/.claude/plans/apres-investigation-seo-on-iterative-spark.md` (PR-1 décrit en 5 volets section 4)

---

## File Structure

### Files créés

| Path | Responsabilité |
|---|---|
| `backend/scripts/seo/audit/types.ts` | Schemas Zod : `ServiceInventoryEntry`, `DiffSample`, `R2RouteAudit`, `R2VolumeStats`, `GapMatrixRow`, `AuditReport` |
| `backend/scripts/seo/audit/inventory-services.ts` | Volet 1 : grep services SEO + mapping aux 14 services cibles |
| `backend/scripts/seo/audit/diff-v4-vs-current.ts` | Volet 2 : pour 50 URLs sample, appel endpoints actuels + V4, diff fingerprints |
| `backend/scripts/seo/audit/r2-routes-audit.ts` | Volet 3 : grep routes Remix R2 fiche produit |
| `backend/scripts/seo/audit/r2-volume-sample.ts` | Volet 4 : count fiches R2 indexables Supabase |
| `backend/scripts/seo/audit/php-vs-remix-comparison.ts` | Volet 5 : si snapshot PHP dispo, comparaison golden |
| `backend/scripts/seo/audit/gap-matrix-generator.ts` | Génère le markdown final `legacy_to_monorepo_gap_matrix.md` |
| `backend/scripts/seo/audit/sample-urls.json` | 50 URLs sample fixées (10 R1 produit + 10 R1 fallback + 10 R7 + 10 R8 + 10 control) |
| `backend/scripts/seo/audit-v9-inventaire.ts` | Orchestrateur : appelle les 5 volets, agrège, sort JSON + markdown |
| `backend/scripts/seo/audit/__tests__/inventory-services.test.ts` | Tests unitaires volet 1 |
| `backend/scripts/seo/audit/__tests__/r2-routes-audit.test.ts` | Tests unitaires volet 3 |
| `backend/scripts/seo/audit/__tests__/gap-matrix-generator.test.ts` | Tests unitaires générateur markdown |
| `backend/scripts/seo/audit/__tests__/diff-v4-vs-current.test.ts` | Tests unitaires diff (mocked HTTP) |
| `backend/scripts/seo/audit/README.md` | Mode d'emploi du script |
| `docs/seo/legacy_to_monorepo_gap_matrix.md` | **Livrable canon** (généré par script) |
| `audit/seo-v9-inventaire-{YYYY-MM-DD}.json` | Raw data structuré (généré par script) |

### Files NON modifiés
- Aucun fichier `backend/src/` ou `frontend/app/` n'est modifié — script READ-ONLY pur.

---

## Sample 50 URLs (fixées en `sample-urls.json`)

À remplir avec 10 URLs par catégorie depuis sitemap actuel + GSC "Crawled - not indexed" :
- 10 R1 gamme-vehicle : `/pieces/{gamme}/{marque}/{modele}/{type}.html`
- 10 R1 gamme : `/pieces/{slug}` (fallback)
- 10 R7 marque : `/constructeurs/{brand}.html`
- 10 R8 véhicule : `/constructeurs/{brand}/{model}/{type}`
- 10 control : URLs déjà indexées GSC (baseline saine)

---

### Task 1: Setup script infrastructure + types Zod

**Files:**
- Create: `backend/scripts/seo/audit/types.ts`
- Create: `backend/scripts/seo/audit/__tests__/types.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/scripts/seo/audit/__tests__/types.test.ts
import { describe, it, expect } from 'vitest';
import { GapMatrixRowSchema, AuditReportSchema, GapStatus, Priority } from '../types';

describe('Audit types', () => {
  it('GapMatrixRow accepts valid row', () => {
    const row = {
      php_file: 'v7.products.car.gamme.php',
      monorepo_equivalent: 'GammeResponseBuilderService',
      status: '✅' as GapStatus,
      gap: 'none',
      priority: 'P0' as Priority,
      proof_link: 'backend/src/modules/gamme-rest/services/gamme-response-builder.service.ts:71',
    };
    expect(() => GapMatrixRowSchema.parse(row)).not.toThrow();
  });

  it('GapMatrixRow rejects invalid status', () => {
    const bad = { php_file: 'x', monorepo_equivalent: 'y', status: 'BAD', gap: '', priority: 'P0', proof_link: '' };
    expect(() => GapMatrixRowSchema.parse(bad)).toThrow();
  });

  it('AuditReport requires all 5 volet outputs', () => {
    const minimal = {
      generated_at: new Date().toISOString(),
      gap_matrix: [],
      service_inventory: [],
      diff_samples: [],
      r2_routes_audit: { found: false, evidence: [] },
      r2_volume_stats: { total_pieces: 0, indexable_estimate: 0 },
      php_vs_remix_comparison: { available: false, samples: [] },
    };
    expect(() => AuditReportSchema.parse(minimal)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run scripts/seo/audit/__tests__/types.test.ts`
Expected: FAIL with `Cannot find module '../types'`

- [ ] **Step 3: Write the types module**

```typescript
// backend/scripts/seo/audit/types.ts
import { z } from 'zod';

export const GapStatusSchema = z.enum(['✅', '⚠️', '❌']);
export type GapStatus = z.infer<typeof GapStatusSchema>;

export const PrioritySchema = z.enum(['P0', 'P1', 'P2']);
export type Priority = z.infer<typeof PrioritySchema>;

export const GapMatrixRowSchema = z.object({
  php_file: z.string().min(1),
  monorepo_equivalent: z.string(),
  status: GapStatusSchema,
  gap: z.string(),
  priority: PrioritySchema,
  proof_link: z.string(),
});
export type GapMatrixRow = z.infer<typeof GapMatrixRowSchema>;

export const ServiceInventoryEntrySchema = z.object({
  path: z.string(),
  public_methods: z.array(z.string()),
  tables_read: z.array(z.string()),
  consumers: z.array(z.string()),
  status: z.enum(['production', 'draft', 'deprecated', 'unknown']),
  maps_to_target_service: z.string().nullable(),
  coverage_percent: z.number().min(0).max(100),
});
export type ServiceInventoryEntry = z.infer<typeof ServiceInventoryEntrySchema>;

export const DiffSampleSchema = z.object({
  url: z.string().url(),
  surface_key: z.string(),
  current_fingerprint: z.object({
    title_hash: z.string(),
    h1_hash: z.string(),
    content_hash: z.string(),
    canonical: z.string(),
    robots: z.string(),
  }),
  v4_fingerprint: z
    .object({
      title_hash: z.string(),
      h1_hash: z.string(),
      content_hash: z.string(),
      canonical: z.string(),
      robots: z.string(),
    })
    .nullable(),
  diff_verdict: z.enum(['exact_match', 'similar', 'divergent', 'v4_unavailable']),
});
export type DiffSample = z.infer<typeof DiffSampleSchema>;

export const R2RouteAuditSchema = z.object({
  found: z.boolean(),
  evidence: z.array(z.object({
    path: z.string(),
    pattern: z.string(),
  })),
});
export type R2RouteAudit = z.infer<typeof R2RouteAuditSchema>;

export const R2VolumeStatsSchema = z.object({
  total_pieces: z.number().int().nonnegative(),
  indexable_estimate: z.number().int().nonnegative(),
  breakdown: z
    .object({
      with_price: z.number().int().nonnegative(),
      with_stock: z.number().int().nonnegative(),
      with_image: z.number().int().nonnegative(),
      with_oem_ref: z.number().int().nonnegative(),
    })
    .optional(),
});
export type R2VolumeStats = z.infer<typeof R2VolumeStatsSchema>;

export const PhpVsRemixComparisonSchema = z.object({
  available: z.boolean(),
  samples: z.array(
    z.object({
      url: z.string(),
      php_snapshot_present: z.boolean(),
      remix_diff: z.string().nullable(),
    }),
  ),
});
export type PhpVsRemixComparison = z.infer<typeof PhpVsRemixComparisonSchema>;

export const AuditReportSchema = z.object({
  generated_at: z.string().datetime(),
  gap_matrix: z.array(GapMatrixRowSchema),
  service_inventory: z.array(ServiceInventoryEntrySchema),
  diff_samples: z.array(DiffSampleSchema),
  r2_routes_audit: R2RouteAuditSchema,
  r2_volume_stats: R2VolumeStatsSchema,
  php_vs_remix_comparison: PhpVsRemixComparisonSchema,
});
export type AuditReport = z.infer<typeof AuditReportSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run scripts/seo/audit/__tests__/types.test.ts`
Expected: PASS (3/3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/seo/audit/types.ts backend/scripts/seo/audit/__tests__/types.test.ts
git commit -m "feat(seo-v9-pr1): types Zod pour audit inventaire SEO"
```

---

### Task 2: Volet 1 — Inventaire services SEO existants (grep filesystem)

**Files:**
- Create: `backend/scripts/seo/audit/inventory-services.ts`
- Create: `backend/scripts/seo/audit/__tests__/inventory-services.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/scripts/seo/audit/__tests__/inventory-services.test.ts
import { describe, it, expect } from 'vitest';
import { runInventoryVolet, mapToTargetService } from '../inventory-services';

describe('Volet 1 — inventory services', () => {
  it('runInventoryVolet returns array with at least 1 service in the seo module', async () => {
    const entries = await runInventoryVolet({
      modulesRoot: 'backend/src/modules',
      patterns: ['seo', 'switch', 'template', 'title', 'meta', 'canonical', 'robots', 'indexability'],
    });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.path.includes('/seo/'))).toBe(true);
  });

  it('mapToTargetService maps SeoSwitchesService to SeoSwitchSelector cible', () => {
    expect(mapToTargetService('seo-switches.service.ts')).toBe('SeoSwitchSelector');
  });

  it('mapToTargetService returns null when no mapping known', () => {
    expect(mapToTargetService('unrelated.service.ts')).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run scripts/seo/audit/__tests__/inventory-services.test.ts`
Expected: FAIL with `Cannot find module '../inventory-services'`

- [ ] **Step 3: Write the inventory module**

```typescript
// backend/scripts/seo/audit/inventory-services.ts
import { globby } from 'globby';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ServiceInventoryEntry } from './types';

const TARGET_SERVICE_MAPPING: Record<string, string> = {
  'seo-switches.service.ts': 'SeoSwitchSelector',
  'gamme-unified.service.ts': 'SeoSwitchSelector',
  'gamme-response-builder.service.ts': 'SeoTemplateRenderer',
  'seo-title-engine.service.ts': 'SeoTemplateRenderer',
  'dynamic-seo-v4-ultimate.service.ts': 'DynamicSeoV4UltimateService (orchestrateur)',
  'seo-v4-switch-engine.service.ts': 'SeoSwitchSelector',
  'seo-headers.service.ts': 'SeoCanonicalService + SeoIndexabilityPolicyService',
  'catalog-data-integrity.service.ts': 'SeoUnavailablePolicy + R2IndexabilityGate',
  'brand-rpc.service.ts': 'R7_BRAND_HUB consumer',
  'vehicle-rpc.service.ts': 'R8_VEHICLE consumer',
  'rm-builder.service.ts': 'R1_GAMME_VEHICLE_ROUTER consumer',
};

export function mapToTargetService(filename: string): string | null {
  return TARGET_SERVICE_MAPPING[path.basename(filename)] ?? null;
}

export interface InventoryOptions {
  modulesRoot: string;
  patterns: string[];
}

export async function runInventoryVolet(opts: InventoryOptions): Promise<ServiceInventoryEntry[]> {
  const filenamePattern = `**/*{${opts.patterns.join(',')}}*.service.ts`;
  const files = await globby(filenamePattern, { cwd: opts.modulesRoot, absolute: false });

  const entries: ServiceInventoryEntry[] = [];
  for (const relPath of files) {
    const fullPath = path.join(opts.modulesRoot, relPath);
    const content = await readFile(fullPath, 'utf-8');
    entries.push({
      path: fullPath,
      public_methods: extractPublicMethods(content),
      tables_read: extractTablesRead(content),
      consumers: [],
      status: detectStatus(content),
      maps_to_target_service: mapToTargetService(relPath),
      coverage_percent: 0,
    });
  }
  return entries;
}

function extractPublicMethods(src: string): string[] {
  const out: string[] = [];
  const re = /^\s*(?:async\s+)?(?:public\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(src)) !== null) {
    if (!['constructor', 'if', 'for', 'while', 'switch', 'catch', 'return'].includes(match[1])) {
      out.push(match[1]);
    }
  }
  return Array.from(new Set(out));
}

function extractTablesRead(src: string): string[] {
  const tables = new Set<string>();
  const reFrom = /\.from\(['"`]([^'"`]+)['"`]\)/g;
  const reRpc = /\.rpc\(['"`]([^'"`]+)['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = reFrom.exec(src)) !== null) tables.add(m[1]);
  while ((m = reRpc.exec(src)) !== null) tables.add(`rpc:${m[1]}`);
  return Array.from(tables);
}

function detectStatus(src: string): ServiceInventoryEntry['status'] {
  if (/@deprecated/i.test(src)) return 'deprecated';
  if (/(?:DRAFT|TODO|WIP|DO\s*NOT\s*USE)/i.test(src.slice(0, 500))) return 'draft';
  return 'production';
}
```

- [ ] **Step 4: Install missing dependency**

Run: `cd backend && npm install --save-dev globby@^14`

Note: `globby` v14 est ESM-only. Si le projet est CommonJS, downgrade à `globby@^11`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx vitest run scripts/seo/audit/__tests__/inventory-services.test.ts`
Expected: PASS (3/3 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/seo/audit/inventory-services.ts backend/scripts/seo/audit/__tests__/inventory-services.test.ts backend/package.json backend/package-lock.json
git commit -m "feat(seo-v9-pr1): volet 1 — inventaire services SEO existants"
```

---

### Task 3: Volet 3 — Audit R2 routes Remix (grep frontend)

**Files:**
- Create: `backend/scripts/seo/audit/r2-routes-audit.ts`
- Create: `backend/scripts/seo/audit/__tests__/r2-routes-audit.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/scripts/seo/audit/__tests__/r2-routes-audit.test.ts
import { describe, it, expect } from 'vitest';
import { runR2RoutesAudit } from '../r2-routes-audit';

describe('Volet 3 — R2 routes audit', () => {
  it('returns found=false when no R2 route patterns match', async () => {
    const result = await runR2RoutesAudit({
      routesRoot: '/tmp/empty-routes-test',
      patterns: ['produit.$ref.tsx', 'pieces.$piece_id.tsx'],
    });
    expect(result.found).toBe(false);
    expect(result.evidence).toEqual([]);
  });

  it('returns found=true when at least one route matches the pattern', async () => {
    const result = await runR2RoutesAudit({
      routesRoot: 'frontend/app/routes',
      patterns: ['pieces.$slug.tsx'],
    });
    expect(result.found).toBe(true);
    expect(result.evidence.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run scripts/seo/audit/__tests__/r2-routes-audit.test.ts`
Expected: FAIL with `Cannot find module '../r2-routes-audit'`

- [ ] **Step 3: Write the module**

```typescript
// backend/scripts/seo/audit/r2-routes-audit.ts
import { globby } from 'globby';
import path from 'node:path';
import type { R2RouteAudit } from './types';

export interface R2AuditOptions {
  routesRoot: string;
  patterns: string[];
}

export async function runR2RoutesAudit(opts: R2AuditOptions): Promise<R2RouteAudit> {
  const evidence: R2RouteAudit['evidence'] = [];
  for (const pattern of opts.patterns) {
    try {
      const matches = await globby(pattern, { cwd: opts.routesRoot, absolute: false });
      for (const m of matches) {
        evidence.push({ path: path.join(opts.routesRoot, m), pattern });
      }
    } catch {
      /* directory absente : skip */
    }
  }
  return { found: evidence.length > 0, evidence };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run scripts/seo/audit/__tests__/r2-routes-audit.test.ts`
Expected: PASS (2/2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/seo/audit/r2-routes-audit.ts backend/scripts/seo/audit/__tests__/r2-routes-audit.test.ts
git commit -m "feat(seo-v9-pr1): volet 3 — audit R2 routes Remix"
```

---

### Task 4: Volet 4 — Sample volume R2 (Supabase count)

**Files:**
- Create: `backend/scripts/seo/audit/r2-volume-sample.ts`

- [ ] **Step 1: Write the module (test integration différé — nécessite Supabase live)**

```typescript
// backend/scripts/seo/audit/r2-volume-sample.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { R2VolumeStats } from './types';

export interface R2VolumeOptions {
  supabase: SupabaseClient;
}

export async function runR2VolumeSample(opts: R2VolumeOptions): Promise<R2VolumeStats> {
  const { count: total, error: totalErr } = await opts.supabase
    .from('pieces')
    .select('*', { count: 'exact', head: true });
  if (totalErr) throw new Error(`R2 volume total failed: ${totalErr.message}`);

  // Cible : count fiches indexables = stock>0 AND image présente
  // Adapter le filtre selon vrai schéma `pieces` (à confirmer en lançant le script)
  const { count: indexable, error: indexErr } = await opts.supabase
    .from('pieces')
    .select('*', { count: 'exact', head: true })
    .gt('piece_qty_stock', 0)
    .not('piece_img', 'is', null);
  if (indexErr) {
    return {
      total_pieces: total ?? 0,
      indexable_estimate: 0,
      breakdown: undefined,
    };
  }

  return {
    total_pieces: total ?? 0,
    indexable_estimate: indexable ?? 0,
  };
}

export function makeSupabaseFromEnv(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
```

- [ ] **Step 2: Smoke test rapide en local (integration)**

Run: `cd backend && SUPABASE_URL=$SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY npx tsx -e "import('./scripts/seo/audit/r2-volume-sample').then(async m => { const sb = m.makeSupabaseFromEnv(); console.log(await m.runR2VolumeSample({ supabase: sb })); })"`
Expected: `{ total_pieces: <N>, indexable_estimate: <M> }` avec N > 0

Si schéma `pieces` différent (colonnes `piece_qty_stock` / `piece_img` n'existent pas), adapter et relancer.

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/seo/audit/r2-volume-sample.ts
git commit -m "feat(seo-v9-pr1): volet 4 — sample volume R2 indexable"
```

---

### Task 5: Volet 2 — Diff sortie SEO actuelle vs V4 (50 URLs sample)

**Files:**
- Create: `backend/scripts/seo/audit/sample-urls.json`
- Create: `backend/scripts/seo/audit/diff-v4-vs-current.ts`
- Create: `backend/scripts/seo/audit/__tests__/diff-v4-vs-current.test.ts`

- [ ] **Step 1: Créer sample-urls.json minimal (à compléter par l'utilisateur)**

```json
{
  "samples": [
    {
      "url": "https://www.automecanik.com/pieces/freinage/peugeot/308/1-6-hdi-110.html",
      "surface_key": "R1_GAMME_VEHICLE_ROUTER",
      "endpoint_actuel": "/api/rm/page-v2",
      "category": "indexed_control"
    },
    {
      "url": "https://www.automecanik.com/pieces/embrayage/citroen/c4/1-6-vti-120.html",
      "surface_key": "R1_GAMME_VEHICLE_ROUTER",
      "endpoint_actuel": "/api/rm/page-v2",
      "category": "crawled_not_indexed"
    }
  ]
}
```

Note : remplir avec 50 URLs réelles avant exécution prod du script. Catégories : `indexed_control` (10) ou `crawled_not_indexed` (40 répartis 10 R1 produit + 10 R1 fallback + 10 R7 + 10 R8).

- [ ] **Step 2: Write the failing test**

```typescript
// backend/scripts/seo/audit/__tests__/diff-v4-vs-current.test.ts
import { describe, it, expect, vi } from 'vitest';
import { computeDiffVerdict, normalizeForHash, hashContent } from '../diff-v4-vs-current';

describe('Volet 2 — diff fingerprint helpers', () => {
  it('hashContent is deterministic', () => {
    expect(hashContent('hello world')).toBe(hashContent('hello world'));
    expect(hashContent('a')).not.toBe(hashContent('b'));
  });

  it('normalizeForHash strips whitespace and casing', () => {
    expect(normalizeForHash('  Hello   World  ')).toBe('hello world');
    expect(normalizeForHash('FOO\nBAR')).toBe('foo bar');
  });

  it('computeDiffVerdict exact_match when fingerprints identical', () => {
    const fp = { title_hash: 'a', h1_hash: 'b', content_hash: 'c', canonical: 'u', robots: 'r' };
    expect(computeDiffVerdict(fp, fp)).toBe('exact_match');
  });

  it('computeDiffVerdict v4_unavailable when v4 null', () => {
    const fp = { title_hash: 'a', h1_hash: 'b', content_hash: 'c', canonical: 'u', robots: 'r' };
    expect(computeDiffVerdict(fp, null)).toBe('v4_unavailable');
  });

  it('computeDiffVerdict divergent when title hash differ', () => {
    const a = { title_hash: 'a', h1_hash: 'b', content_hash: 'c', canonical: 'u', robots: 'r' };
    const b = { title_hash: 'X', h1_hash: 'b', content_hash: 'c', canonical: 'u', robots: 'r' };
    expect(computeDiffVerdict(a, b)).toBe('divergent');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx vitest run scripts/seo/audit/__tests__/diff-v4-vs-current.test.ts`
Expected: FAIL with `Cannot find module '../diff-v4-vs-current'`

- [ ] **Step 4: Write the module**

```typescript
// backend/scripts/seo/audit/diff-v4-vs-current.ts
import { createHash } from 'node:crypto';
import type { DiffSample } from './types';

export type Fingerprint = NonNullable<DiffSample['v4_fingerprint']>;

export function hashContent(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

export function normalizeForHash(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function makeFingerprint(input: { title: string; h1: string; content: string; canonical: string; robots: string }): Fingerprint {
  return {
    title_hash: hashContent(normalizeForHash(input.title)),
    h1_hash: hashContent(normalizeForHash(input.h1)),
    content_hash: hashContent(normalizeForHash(input.content)),
    canonical: input.canonical,
    robots: input.robots,
  };
}

export function computeDiffVerdict(current: Fingerprint, v4: Fingerprint | null): DiffSample['diff_verdict'] {
  if (v4 === null) return 'v4_unavailable';
  if (
    current.title_hash === v4.title_hash &&
    current.h1_hash === v4.h1_hash &&
    current.content_hash === v4.content_hash &&
    current.canonical === v4.canonical &&
    current.robots === v4.robots
  ) {
    return 'exact_match';
  }
  const diffs = [
    current.title_hash !== v4.title_hash,
    current.h1_hash !== v4.h1_hash,
    current.content_hash !== v4.content_hash,
  ].filter(Boolean).length;
  return diffs >= 2 ? 'divergent' : 'similar';
}

export interface DiffOptions {
  baseUrl: string;
  v4Endpoint: string;
  samples: Array<{ url: string; surface_key: string; endpoint_actuel: string; category: string }>;
  fetchImpl?: typeof fetch;
}

export async function runDiffVolet(opts: DiffOptions): Promise<DiffSample[]> {
  const fetcher = opts.fetchImpl ?? fetch;
  const out: DiffSample[] = [];
  for (const sample of opts.samples) {
    const current = await fetchSeoFromCurrent(fetcher, opts.baseUrl, sample);
    const v4 = await fetchSeoFromV4(fetcher, opts.baseUrl, sample, opts.v4Endpoint);
    out.push({
      url: sample.url,
      surface_key: sample.surface_key,
      current_fingerprint: current,
      v4_fingerprint: v4,
      diff_verdict: computeDiffVerdict(current, v4),
    });
  }
  return out;
}

async function fetchSeoFromCurrent(
  fetcher: typeof fetch,
  baseUrl: string,
  sample: { url: string; endpoint_actuel: string },
): Promise<Fingerprint> {
  const apiUrl = new URL(sample.endpoint_actuel, baseUrl).toString();
  const res = await fetcher(`${apiUrl}?source_url=${encodeURIComponent(sample.url)}`);
  if (!res.ok) {
    return makeFingerprint({ title: '', h1: '', content: '', canonical: '', robots: 'unavailable' });
  }
  const json = (await res.json()) as { seo?: { title?: string; h1?: string; description?: string; canonical?: string; robots?: string } };
  const seo = json.seo ?? {};
  return makeFingerprint({
    title: seo.title ?? '',
    h1: seo.h1 ?? '',
    content: seo.description ?? '',
    canonical: seo.canonical ?? '',
    robots: seo.robots ?? '',
  });
}

async function fetchSeoFromV4(
  fetcher: typeof fetch,
  baseUrl: string,
  sample: { url: string; surface_key: string },
  v4Endpoint: string,
): Promise<Fingerprint | null> {
  try {
    const res = await fetcher(new URL(v4Endpoint, baseUrl).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: sample.url, surface_key: sample.surface_key }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { title?: string; h1?: string; content?: string; canonical?: string; robots?: string };
    return makeFingerprint({
      title: json.title ?? '',
      h1: json.h1 ?? '',
      content: json.content ?? '',
      canonical: json.canonical ?? '',
      robots: json.robots ?? '',
    });
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx vitest run scripts/seo/audit/__tests__/diff-v4-vs-current.test.ts`
Expected: PASS (5/5 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/seo/audit/sample-urls.json backend/scripts/seo/audit/diff-v4-vs-current.ts backend/scripts/seo/audit/__tests__/diff-v4-vs-current.test.ts
git commit -m "feat(seo-v9-pr1): volet 2 — diff fingerprint V4 vs actuel sur 50 URLs"
```

---

### Task 6: Volet 5 — Comparaison PHP vs Remix (skippable si pas de snapshot)

**Files:**
- Create: `backend/scripts/seo/audit/php-vs-remix-comparison.ts`

- [ ] **Step 1: Write the module (skip-friendly par défaut)**

```typescript
// backend/scripts/seo/audit/php-vs-remix-comparison.ts
import { stat } from 'node:fs/promises';
import type { PhpVsRemixComparison } from './types';

export interface PhpVsRemixOptions {
  snapshotDir: string | null;
  sampleUrls: string[];
}

export async function runPhpVsRemixComparison(opts: PhpVsRemixOptions): Promise<PhpVsRemixComparison> {
  if (!opts.snapshotDir) {
    return { available: false, samples: [] };
  }
  try {
    await stat(opts.snapshotDir);
  } catch {
    return { available: false, samples: [] };
  }

  const samples = opts.sampleUrls.map((url) => ({
    url,
    php_snapshot_present: false,
    remix_diff: 'snapshot_not_implemented_yet — to enrich in PR-2 once first PR-4 baseline captured',
  }));

  return { available: true, samples };
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/scripts/seo/audit/php-vs-remix-comparison.ts
git commit -m "feat(seo-v9-pr1): volet 5 — squelette comparaison PHP vs Remix (snapshot-ready)"
```

---

### Task 7: Générateur gap matrix markdown

**Files:**
- Create: `backend/scripts/seo/audit/gap-matrix-generator.ts`
- Create: `backend/scripts/seo/audit/__tests__/gap-matrix-generator.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/scripts/seo/audit/__tests__/gap-matrix-generator.test.ts
import { describe, it, expect } from 'vitest';
import { renderGapMatrixMarkdown, BASELINE_MATRIX_ROWS } from '../gap-matrix-generator';
import type { GapMatrixRow } from '../types';

describe('Gap matrix generator', () => {
  it('BASELINE_MATRIX_ROWS contains the 10 mappings from itération 8', () => {
    expect(BASELINE_MATRIX_ROWS.length).toBeGreaterThanOrEqual(10);
    expect(BASELINE_MATRIX_ROWS.some((r) => r.php_file === 'index.php')).toBe(true);
    expect(BASELINE_MATRIX_ROWS.some((r) => r.php_file.includes('v7.products.fiche'))).toBe(true);
  });

  it('renderGapMatrixMarkdown renders a markdown table with header', () => {
    const rows: GapMatrixRow[] = [
      {
        php_file: 'foo.php',
        monorepo_equivalent: 'BarService',
        status: '✅',
        gap: 'none',
        priority: 'P0',
        proof_link: 'src/bar.ts:12',
      },
    ];
    const md = renderGapMatrixMarkdown(rows, { generated_at: '2026-05-08T00:00:00Z' });
    expect(md).toContain('| php_file | monorepo_equivalent | status | gap | priority | proof_link |');
    expect(md).toContain('| foo.php | BarService | ✅ | none | P0 | src/bar.ts:12 |');
    expect(md).toContain('Generated: 2026-05-08T00:00:00Z');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run scripts/seo/audit/__tests__/gap-matrix-generator.test.ts`
Expected: FAIL with `Cannot find module '../gap-matrix-generator'`

- [ ] **Step 3: Write the module**

```typescript
// backend/scripts/seo/audit/gap-matrix-generator.ts
import type { GapMatrixRow } from './types';

export const BASELINE_MATRIX_ROWS: GapMatrixRow[] = [
  {
    php_file: 'index.php',
    monorepo_equivalent: 'CatalogModule.getHomeCatalog',
    status: '✅',
    gap: 'Vérifier rendu Remix final R0',
    priority: 'P1',
    proof_link: 'backend/src/modules/catalog/',
  },
  {
    php_file: 'products.gamme.php / v7.products.gamme.php',
    monorepo_equivalent: 'GammeResponseBuilderService + __seo_gamme + SeoTitleEngineService',
    status: '✅',
    gap: 'Robots simplifié pg_level=1=>index sinon noindex vs logique complète legacy',
    priority: 'P1',
    proof_link: 'backend/src/modules/gamme-rest/services/gamme-response-builder.service.ts',
  },
  {
    php_file: 'products.car.gamme.php',
    monorepo_equivalent: 'RPC get_pieces_for_type_gamme_v4 + raw SEO templates + NestJS processing',
    status: '✅',
    gap: 'Comparaison sortie PHP vs Remix non finalisée',
    priority: 'P1',
    proof_link: 'rpc:get_pieces_for_type_gamme_v4',
  },
  {
    php_file: '__SEO_ITEM_SWITCH + __SEO_GAMME_CAR_SWITCH + __SEO_FAMILY_GAMME_CAR_SWITCH',
    monorepo_equivalent: 'SeoSwitchesService (migration "TERMINÉE")',
    status: '✅',
    gap: '#PrixPasCher#, #VousPropose#, #MinPrice# encore TODO',
    priority: 'P1',
    proof_link: 'backend/src/modules/seo/services/seo-switches.service.ts',
  },
  {
    php_file: 'constructeurs.type.php',
    monorepo_equivalent: 'RPC build_vehicle_page_payload',
    status: '✅',
    gap: 'Vérifier rendu Remix + indexabilité réelle',
    priority: 'P1',
    proof_link: 'rpc:build_vehicle_page_payload',
  },
  {
    php_file: 'products.car.gamme.fiche.php / v7.products.fiche.php',
    monorepo_equivalent: 'Listing RPC get_listing_products_for_build (prix/stock/score/images)',
    status: '⚠️',
    gap: 'Fiche produit détaillée OEM/critères/composition pas prouvée',
    priority: 'P1',
    proof_link: 'rpc:get_listing_products_for_build',
  },
  {
    php_file: '410.page.php / 412.page.php',
    monorepo_equivalent: 'CatalogDataIntegrityService 200/404/410 + système 3 couches erreurs 4xx existant (à auditer)',
    status: '⚠️',
    gap: 'Page indisponible contextualisée 412/410 à formaliser ; SeoUnavailablePolicy doit RACCORDER, pas créer un middleware',
    priority: 'P1',
    proof_link: 'backend/src/modules/catalog/services/catalog-data-integrity.service.ts',
  },
  {
    php_file: 'blog.advice.gamme.php / v7.blog.advice.gamme.php',
    monorepo_equivalent: 'Tables SEO/blog connues, agents/plans',
    status: '⚠️',
    gap: 'R3 doit venir du wiki canonique (ADR-031), pas clone PHP direct',
    priority: 'P2',
    proof_link: 'automecanik-wiki/exports/',
  },
  {
    php_file: 'constructeurs.marque.php',
    monorepo_equivalent: 'Données marque DB + payload véhicule + domain map',
    status: '⚠️',
    gap: 'Hub marque R7 complet à vérifier côté Remix/API',
    priority: 'P1',
    proof_link: 'backend/src/modules/vehicles/services/brand-rpc.service.ts',
  },
  {
    php_file: 'meta.conf.php',
    monorepo_equivalent: 'SeoTitleEngineService + URL builders + canonical partiel',
    status: '⚠️',
    gap: 'Slug/canonical/robots à centraliser par rôle (SeoCanonicalService + SeoIndexabilityPolicyService)',
    priority: 'P1',
    proof_link: 'backend/src/modules/seo/services/seo-title-engine.service.ts',
  },
];

export interface RenderOptions {
  generated_at: string;
}

export function renderGapMatrixMarkdown(rows: GapMatrixRow[], opts: RenderOptions): string {
  const header = '| php_file | monorepo_equivalent | status | gap | priority | proof_link |';
  const separator = '|---|---|---|---|---|---|';
  const lines = rows.map(
    (r) => `| ${r.php_file} | ${r.monorepo_equivalent} | ${r.status} | ${r.gap} | ${r.priority} | ${r.proof_link} |`,
  );
  return `# Legacy PHP → Monorepo Gap Matrix (SEO seo-v9 PR-1)

> Generated: ${opts.generated_at}
> Plan référence : \`/home/deploy/.claude/plans/apres-investigation-seo-on-iterative-spark.md\`
> Statut : LIVRABLE CANON PR-1. Mis à jour à chaque PR de la cascade seo-v9.

## Matrice

${header}
${separator}
${lines.join('\n')}

## Légende

- ✅ Porté : équivalent monorepo identifié, gap = finition.
- ⚠️ Partiel : présence partielle, gap = compléter ou centraliser.
- ❌ Absent : équivalent monorepo manquant.
- **P0** : ne pas refaire (consolider l'existant).
- **P1** : compléter en PR-2 ou cascade.
- **P2** : différé (wiki éditorial, blog, R4).
`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run scripts/seo/audit/__tests__/gap-matrix-generator.test.ts`
Expected: PASS (2/2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/seo/audit/gap-matrix-generator.ts backend/scripts/seo/audit/__tests__/gap-matrix-generator.test.ts
git commit -m "feat(seo-v9-pr1): générateur markdown gap matrix + 10 lignes baseline itération 8"
```

---

### Task 8: Orchestrateur principal `audit-v9-inventaire.ts`

**Files:**
- Create: `backend/scripts/seo/audit-v9-inventaire.ts`

- [ ] **Step 1: Write the orchestrator script**

```typescript
// backend/scripts/seo/audit-v9-inventaire.ts
#!/usr/bin/env tsx
/**
 * SEO seo-v9 PR-1 — Audit inventaire + matrice gap legacy → monorepo (READ-ONLY)
 *
 * Usage :
 *   cd backend && npx tsx scripts/seo/audit-v9-inventaire.ts \
 *     --base-url=http://localhost:3000 \
 *     --output-json=audit/seo-v9-inventaire-2026-05-08.json \
 *     --output-md=docs/seo/legacy_to_monorepo_gap_matrix.md
 *
 * Variables d'environnement requises :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runInventoryVolet } from './audit/inventory-services';
import { runR2RoutesAudit } from './audit/r2-routes-audit';
import { runR2VolumeSample, makeSupabaseFromEnv } from './audit/r2-volume-sample';
import { runDiffVolet } from './audit/diff-v4-vs-current';
import { runPhpVsRemixComparison } from './audit/php-vs-remix-comparison';
import { renderGapMatrixMarkdown, BASELINE_MATRIX_ROWS } from './audit/gap-matrix-generator';
import { AuditReportSchema } from './audit/types';
import sampleUrlsJson from './audit/sample-urls.json' with { type: 'json' };

interface CliArgs {
  baseUrl: string;
  outputJson: string;
  outputMd: string;
  v4Endpoint: string;
  modulesRoot: string;
  routesRoot: string;
  snapshotDir: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const get = (key: string, fallback?: string): string => {
    const arg = argv.find((a) => a.startsWith(`--${key}=`));
    if (arg) return arg.slice(`--${key}=`.length);
    if (fallback !== undefined) return fallback;
    throw new Error(`Argument requis : --${key}=...`);
  };
  return {
    baseUrl: get('base-url', 'http://localhost:3000'),
    outputJson: get('output-json', `audit/seo-v9-inventaire-${new Date().toISOString().slice(0, 10)}.json`),
    outputMd: get('output-md', 'docs/seo/legacy_to_monorepo_gap_matrix.md'),
    v4Endpoint: get('v4-endpoint', '/api/seo-dynamic-v4/generate-complete'),
    modulesRoot: get('modules-root', 'backend/src/modules'),
    routesRoot: get('routes-root', 'frontend/app/routes'),
    snapshotDir: argv.includes('--no-php-snapshot') ? null : get('php-snapshot-dir', '/tmp/php-legacy-snapshots'),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const generated_at = new Date().toISOString();
  console.log(`🔍 SEO seo-v9 PR-1 audit — ${generated_at}`);
  console.log(`   baseUrl: ${args.baseUrl}`);
  console.log(`   modules: ${args.modulesRoot}`);

  console.log('\n[Volet 1] Inventaire services SEO existants...');
  const service_inventory = await runInventoryVolet({
    modulesRoot: args.modulesRoot,
    patterns: ['seo', 'switch', 'template', 'title', 'meta', 'canonical', 'robots', 'indexability'],
  });
  console.log(`   ${service_inventory.length} services trouvés`);

  console.log('\n[Volet 2] Diff sortie SEO V4 vs actuel sur 50 URLs sample...');
  const diff_samples = await runDiffVolet({
    baseUrl: args.baseUrl,
    v4Endpoint: args.v4Endpoint,
    samples: sampleUrlsJson.samples,
  });
  const divergent = diff_samples.filter((d) => d.diff_verdict === 'divergent').length;
  const exactMatches = diff_samples.filter((d) => d.diff_verdict === 'exact_match').length;
  console.log(`   ${exactMatches} exact_match / ${divergent} divergent / ${diff_samples.length} total`);

  console.log('\n[Volet 3] Audit routes Remix R2 fiche produit...');
  const r2_routes_audit = await runR2RoutesAudit({
    routesRoot: args.routesRoot,
    patterns: ['produit.$ref.tsx', 'pieces.$piece_id.tsx', 'articles.$ref.tsx'],
  });
  console.log(`   R2 route ${r2_routes_audit.found ? 'trouvée' : 'absente'} (${r2_routes_audit.evidence.length} evidence)`);

  console.log('\n[Volet 4] Sample volume R2 indexable...');
  const supabase = makeSupabaseFromEnv();
  const r2_volume_stats = await runR2VolumeSample({ supabase });
  console.log(`   total_pieces=${r2_volume_stats.total_pieces}, indexable=${r2_volume_stats.indexable_estimate}`);

  console.log('\n[Volet 5] Comparaison PHP vs Remix...');
  const php_vs_remix_comparison = await runPhpVsRemixComparison({
    snapshotDir: args.snapshotDir,
    sampleUrls: sampleUrlsJson.samples.map((s) => s.url),
  });
  console.log(`   ${php_vs_remix_comparison.available ? 'snapshots dispo' : 'snapshots absents (normal si baseline non capturée)'}`);

  console.log('\n[Aggregation] Construction du rapport...');
  const report = AuditReportSchema.parse({
    generated_at,
    gap_matrix: BASELINE_MATRIX_ROWS,
    service_inventory,
    diff_samples,
    r2_routes_audit,
    r2_volume_stats,
    php_vs_remix_comparison,
  });

  console.log(`\n💾 Écriture du JSON → ${args.outputJson}`);
  await mkdir(path.dirname(args.outputJson), { recursive: true });
  await writeFile(args.outputJson, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`💾 Écriture du markdown → ${args.outputMd}`);
  await mkdir(path.dirname(args.outputMd), { recursive: true });
  await writeFile(args.outputMd, renderGapMatrixMarkdown(report.gap_matrix, { generated_at }), 'utf-8');

  console.log('\n✅ PR-1 audit terminé');
  console.log('   → Décision PR-2 : voir verdict scénario A/B/C dans plan section 4 (PR-2).');
  console.log(`   → Si > 5 collisions fingerprint cross-URL → priorité PR-9 (table fingerprint) confirmée.`);
}

main().catch((err) => {
  console.error('❌ PR-1 audit failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke test rapide (sans Supabase live, juste structure)**

Run:
```bash
cd backend && npx tsx scripts/seo/audit-v9-inventaire.ts \
  --base-url=http://localhost:3000 \
  --output-json=/tmp/test-audit.json \
  --output-md=/tmp/test-matrix.md \
  --no-php-snapshot \
  || echo "Erreur attendue si Supabase env absent — OK pour smoke"
```
Expected (sans env Supabase) : exit 1 avec `SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis`. Le script s'est chargé sans erreur de syntaxe TS.

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/seo/audit-v9-inventaire.ts
git commit -m "feat(seo-v9-pr1): orchestrateur audit-v9-inventaire (5 volets + rapport)"
```

---

### Task 9: Documentation README

**Files:**
- Create: `backend/scripts/seo/audit/README.md`

- [ ] **Step 1: Write the README**

```markdown
# SEO seo-v9 PR-1 — Audit inventaire (READ-ONLY)

## But

Livrer la matrice de validation `docs/seo/legacy_to_monorepo_gap_matrix.md` qui mappe chaque fichier PHP legacy à son équivalent monorepo (statut + gap + priorité). Condition sine qua non avant tout PR-2 de refactor.

Plan stratégique référence : `/home/deploy/.claude/plans/apres-investigation-seo-on-iterative-spark.md` (v15, approuvé 2026-05-08).

## Lancer le script

### Pré-requis
- Variables d'environnement : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Backend NestJS démarré sur `--base-url` pour les endpoints actuels et `/api/seo-dynamic-v4/*`.

### Commande complète (preprod DEV)

```bash
cd backend
npx tsx scripts/seo/audit-v9-inventaire.ts \
  --base-url=http://46.224.118.55 \
  --output-json=audit/seo-v9-inventaire-$(date +%Y-%m-%d).json \
  --output-md=docs/seo/legacy_to_monorepo_gap_matrix.md
```

### Mode local sans Supabase (skip volet 4)

Pas encore implémenté — utiliser un mock ou `--no-volet-4` à ajouter en future itération.

## Volets

| # | Volet | Module | Output |
|---|---|---|---|
| 1 | Inventaire services SEO | `audit/inventory-services.ts` | `service_inventory[]` |
| 2 | Diff fingerprint V4 vs actuel (50 URLs) | `audit/diff-v4-vs-current.ts` | `diff_samples[]` |
| 3 | Audit R2 routes Remix | `audit/r2-routes-audit.ts` | `r2_routes_audit` |
| 4 | Sample volume R2 indexable | `audit/r2-volume-sample.ts` | `r2_volume_stats` |
| 5 | Comparaison PHP vs Remix (skip-friendly) | `audit/php-vs-remix-comparison.ts` | `php_vs_remix_comparison` |

## Tests

```bash
cd backend && npx vitest run scripts/seo/audit
```

## Critères de succès PR-1 (cf. plan section 4)
- ✅ `legacy_to_monorepo_gap_matrix.md` généré avec ≥ 10 lignes baseline + lignes enrichies par volets.
- ✅ Inventaire complet : 0 service SEO non recensé.
- ✅ Tableau quantifié `14 services cibles × {existant, partiel, manquant}`.
- ✅ Décision PR-2 documentée : refactor / compléter / raccorder.
- ✅ Identification 3-5 manques **réels** prioritaires.

## Ce que PR-1 N'EST PAS
- Pas de modification de code applicatif (`backend/src/`, `frontend/app/`).
- Pas de migration DB.
- Pas de refactor des services SEO existants — ça arrive en PR-2 (HOLD).
```

- [ ] **Step 2: Commit**

```bash
git add backend/scripts/seo/audit/README.md
git commit -m "docs(seo-v9-pr1): README script audit"
```

---

### Task 10: Run réel sur preprod DEV + génération livrable

**Files modifiés (par exécution du script) :**
- `audit/seo-v9-inventaire-{YYYY-MM-DD}.json`
- `docs/seo/legacy_to_monorepo_gap_matrix.md`

- [ ] **Step 1: Compléter sample-urls.json avec 50 URLs réelles**

Récupérer 40 URLs `/pieces/*` actuellement "Crawled - not indexed" via GSC URL Inspection (mémoire `gsc-sa-resolved-20260506`) + 10 URLs control déjà indexées. Éditer `backend/scripts/seo/audit/sample-urls.json`.

Vérification : `cat backend/scripts/seo/audit/sample-urls.json | jq '.samples | length'` doit retourner `50`.

- [ ] **Step 2: Lancer le script en preprod DEV**

```bash
cd backend
SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  npx tsx scripts/seo/audit-v9-inventaire.ts \
  --base-url=http://46.224.118.55 \
  --output-json=audit/seo-v9-inventaire-$(date +%Y-%m-%d).json \
  --output-md=docs/seo/legacy_to_monorepo_gap_matrix.md
```

Expected output console :
```
🔍 SEO seo-v9 PR-1 audit — 2026-05-08T...
[Volet 1] Inventaire services SEO existants...
   N services trouvés
[Volet 2] Diff sortie SEO V4 vs actuel sur 50 URLs sample...
   X exact_match / Y divergent / 50 total
[Volet 3] Audit routes Remix R2 fiche produit...
   R2 route absente/trouvée (Z evidence)
[Volet 4] Sample volume R2 indexable...
   total_pieces=N, indexable=M
[Volet 5] Comparaison PHP vs Remix...
   snapshots absents
✅ PR-1 audit terminé
```

- [ ] **Step 3: Vérifier le livrable canon**

```bash
head -30 docs/seo/legacy_to_monorepo_gap_matrix.md
wc -l docs/seo/legacy_to_monorepo_gap_matrix.md
jq '.gap_matrix | length' audit/seo-v9-inventaire-$(date +%Y-%m-%d).json
```
Expected : matrice avec ≥ 10 lignes baseline. JSON parseable avec ≥ 10 entrées `gap_matrix`.

- [ ] **Step 4: Décision PR-2 (à inscrire dans la matrice)**

Lire le rapport. Compter le ratio `existant_couverture` vs services cibles. Choisir scénario PR-2 :
- A (refactor majeur) : couverture < 40%
- B (complétion ciblée) : couverture 40-75%
- C (raccord léger) : couverture > 75%

Ajouter en note de pied de la matrice : `**Décision PR-2** : scénario [X], rationale : [...]`.

- [ ] **Step 5: Commit le livrable**

```bash
git add audit/seo-v9-inventaire-*.json docs/seo/legacy_to_monorepo_gap_matrix.md
git commit -m "feat(seo-v9-pr1): livrable canon legacy_to_monorepo_gap_matrix.md + JSON raw"
```

---

### Task 11: Push branche + ouvrir PR

- [ ] **Step 1: Push branche**

```bash
git push -u origin feat/seo-v9-pr1-gap-matrix
```

- [ ] **Step 2: Ouvrir la PR (gh CLI)**

```bash
gh pr create --base main --head feat/seo-v9-pr1-gap-matrix \
  --title "feat(seo-v9): PR-1 audit inventaire + matrice gap legacy → monorepo (READ-ONLY)" \
  --body "$(cat <<'EOF'
## Summary

PR-1 du plan SEO seo-v9 (`/home/deploy/.claude/plans/apres-investigation-seo-on-iterative-spark.md`). **READ-ONLY**, aucun code applicatif modifié.

Livre :
- Script `backend/scripts/seo/audit-v9-inventaire.ts` (5 volets : inventaire services, diff V4 vs actuel, R2 routes, R2 volume, PHP vs Remix).
- **Livrable canon** : `docs/seo/legacy_to_monorepo_gap_matrix.md` (mappe chaque fichier PHP legacy → équivalent monorepo + statut + gap + priorité).
- Raw JSON : `audit/seo-v9-inventaire-YYYY-MM-DD.json`.

## Context

Régression GSC 73% `/pieces/*` "Crawled - not indexed" (mémoire `seo-r2-thin-content-root-cause-20260507`). Verdict empirique : 70-80% du legacy SEO PHP déjà porté dans le monorepo, 20-30% gaps de finition (R2 fiche détaillée, canonical/robots centralisés, variables marketing, wiki source).

Cette PR-1 est la **condition sine qua non** des PR-2+ (HOLD). Elle transforme la table "✅/⚠️/❌" du plan section 1.5 en données chiffrées et qualifiées pour décider du scénario PR-2 (A=refactor / B=complétion / C=raccord léger).

## Test plan
- [ ] `cd backend && npx vitest run scripts/seo/audit` — tous tests verts
- [ ] `npx tsx scripts/seo/audit-v9-inventaire.ts --base-url=http://46.224.118.55 ...` exécuté en preprod DEV avec succès
- [ ] `docs/seo/legacy_to_monorepo_gap_matrix.md` contient ≥ 10 lignes baseline + lignes enrichies
- [ ] `audit/seo-v9-inventaire-*.json` valide Zod
- [ ] Décision PR-2 (scénario A/B/C) inscrite en pied de matrice

## Pas de Prisma, Supabase SDK direct (CLAUDE.md backend.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected : URL de la PR retournée par `gh`.

---

## Self-Review

Cette section est exécutée par moi avant de proposer le handoff.

**1. Spec coverage** :
- Volet 1 (inventaire services) → Task 2 ✓
- Volet 2 (diff V4 vs actuel) → Task 5 ✓
- Volet 3 (audit R2 routes Remix) → Task 3 ✓
- Volet 4 (sample volume R2) → Task 4 ✓
- Volet 5 (comparaison PHP vs Remix) → Task 6 ✓
- Livrable canon `legacy_to_monorepo_gap_matrix.md` → Tasks 7 + 10 ✓
- JSON raw → Tasks 8 + 10 ✓

**2. Placeholder scan** :
- Aucun TBD/TODO dans les tâches. Sample-urls.json incomplet — explicitement à compléter en Task 10 step 1.
- Volet 5 PHP snapshot : skip-friendly par design (snapshot pas obligatoire, plan dit "si snapshot dispo").

**3. Type consistency** :
- Tous les types Zod définis en Task 1, réutilisés en Tasks 2-8.
- Noms méthodes : `runInventoryVolet`, `runDiffVolet`, `runR2RoutesAudit`, `runR2VolumeSample`, `runPhpVsRemixComparison` cohérents.
- `mapToTargetService` partagé entre volet 1 et générateur matrix.

**Risques connus à signaler en handoff** :
- `globby` v14 ESM-only : peut nécessiter downgrade selon module system du backend.
- Schéma `pieces` (volet 4) : colonnes `piece_qty_stock`, `piece_img` à confirmer en lançant.
- Endpoint V4 `/api/seo-dynamic-v4/generate-complete` : forme exacte de la requête à confirmer (POST body) lors du run réel.
- Sample 50 URLs : doit être complété par opérateur avant Task 10 step 2.

---

## Execution Handoff

**Plan complet et sauvé dans `docs/superpowers/plans/2026-05-08-seo-v9-pr1-gap-matrix.md`.**

**Deux options d'exécution :**

**1. Subagent-Driven (recommandée)** — Dispatch un fresh subagent par tâche, review entre les tâches, itération rapide. Sub-skill : `superpowers:subagent-driven-development`.

**2. Inline Execution** — Tâches exécutées dans la session courante avec checkpoints. Sub-skill : `superpowers:executing-plans`.

Quelle approche ?
