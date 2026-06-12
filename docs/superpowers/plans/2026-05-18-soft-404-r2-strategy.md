# Soft-404 R2-PRODUIT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre la page Remix `/pieces/:gamme/:marque/:modele/:type.html` quand `count(pieces)=0` pour passer d'un "Non disponible" générique à un hub de rebond compat-aware (multi-tier ranking + JSON-LD ItemList + télémétrie append-only), tout en maintenant `HTTP 200 + noindex,follow`.

**Architecture:** Nouveau service backend `RmAlternativesService` (single-write-path) qui produit un payload v2 (`alternativeVehicles` + `alternativeGammes` + `relatedModels`) filtré par `EXISTS pieces_relation_type` et trié par tiers de proximité catalogue. Frontend refactor du composant `NoProductsAlternatives` en 3 blocs hiérarchisés + meta enrichie (JSON-LD `ItemList`, title/desc/og dynamiques). Télémétrie append-only via table `__soft_404_events` + vue `v_soft_404_demand_30d`. Cache Redis 5 min keyed `alt:{type_id}:{pg_id}:v1`. URL strictement préservée.

**Tech Stack:** NestJS (backend services + controllers + Zod DTO), Supabase Postgres (table + vue), Redis (cache aside), Remix + Vitest (frontend), Tailwind + shadcn/ui + lucide-react (UI), Jest (backend tests), GitHub Actions (smoke CI), OTel (observabilité).

**Worktree:** `/opt/automecanik/app-worktrees/soft-404-r2-strategy/` (branche `feat/soft-404-r2-strategy`).

**Spec source:** [docs/superpowers/specs/2026-05-18-soft-404-r2-strategy-design.md](../specs/2026-05-18-soft-404-r2-strategy-design.md)

---

## Files Created or Modified

### Backend (NestJS)

| Action | Path | Responsabilité |
|---|---|---|
| Create | `backend/supabase/migrations/20260518120000_soft_404_events.sql` | Table append-only + vue 30j + indexes |
| Create | `backend/src/modules/rm/dto/alternatives-v2.dto.ts` | Schémas Zod input/output v2 |
| Create | `backend/src/modules/rm/services/gamme-clusters.const.ts` | Catalogue statique des clusters de gammes (V1) |
| Create | `backend/src/modules/rm/services/rm-alternatives.service.ts` | Service unique de ranking compat-aware multi-tier |
| Create | `backend/src/modules/rm/services/__tests__/rm-alternatives.service.test.ts` | Tests unitaires Jest du service |
| Create | `backend/src/modules/rm/services/rm-soft404-tracker.service.ts` | Beacon append-only + throttling Redis |
| Create | `backend/src/modules/rm/services/__tests__/rm-soft404-tracker.service.test.ts` | Tests unitaires tracker |
| Modify | `backend/src/modules/rm/controllers/rm.controller.ts` | `GET /alternatives` v2 + `POST /alternatives/track-soft-404` |
| Modify | `backend/src/modules/rm/rm.module.ts` | Wire des 2 nouveaux services |
| Modify | `backend/src/modules/rm/services/rm-builder.service.ts` | Suppression de l'ancienne `getAlternatives` (single-write-path) |

### Frontend (Remix)

| Action | Path | Responsabilité |
|---|---|---|
| Modify | `frontend/app/components/pieces/NoProductsAlternatives.tsx` | 3 blocs hiérarchisés + lead capture link |
| Modify | `frontend/app/utils/pieces-vehicle.loader.server.ts` | Parse payload v2 + beacon fire-and-forget |
| Modify | `frontend/app/utils/pieces-vehicle.meta.ts` | Title/desc/og dynamiques + JSON-LD `ItemList` |
| Create | `frontend/tests/unit/no-products-alternatives.test.tsx` | Test Vitest du composant (3 blocs + JSON-LD) |
| Create | `frontend/tests/unit/pieces-vehicle-meta.test.ts` | Test Vitest de la meta function |

### Infra / CI / Gouvernance

| Action | Path | Responsabilité |
|---|---|---|
| Create | `scripts/ci/soft-404-fixtures.txt` | Liste des 5 URLs fixtures |
| Create | `scripts/ci/assert-soft-404.py` | Assertions HTTP + meta + JSON-LD |
| Modify | `.github/workflows/ci.yml` | Job `soft-404-smoke` |
| Modify | `audit/ownership.yaml` | Entry table `__soft_404_events` → seo-platform |

### Vault (PR séparée, hors de ce monorepo)

| Action | Path | Responsabilité |
|---|---|---|
| Create | `governance-vault/ledger/decisions/adr/ADR-soft-404-r2-strategy.md` | ADR léger pattern soft-404 |
| Create | `governance-vault/runbooks/soft-404-telemetry.md` | Runbook rétention 90j + ownership |

---

## Task 1: Migration SQL `__soft_404_events`

**Files:**
- Create: `backend/supabase/migrations/20260518120000_soft_404_events.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- 20260518120000_soft_404_events.sql
-- Soft-404 R2 telemetry : append-only events + vue agrégée 30j.
-- Owner: seo-platform. ADR: ADR-soft-404-r2-strategy.
-- Rétention: 90j (cron purge dans seo-routines, planifié post-merge).

BEGIN;

CREATE TABLE IF NOT EXISTS __soft_404_events (
  id        bigserial PRIMARY KEY,
  pg_id     integer NOT NULL,
  type_id   integer NOT NULL,
  ts        timestamptz NOT NULL DEFAULT now(),
  referrer  text,
  ua_class  text NOT NULL CHECK (ua_class IN ('bot', 'browser', 'unknown'))
);

CREATE INDEX IF NOT EXISTS idx_soft404_pair_ts
  ON __soft_404_events(pg_id, type_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_soft404_browser_ts
  ON __soft_404_events(ts) WHERE ua_class = 'browser';

CREATE OR REPLACE VIEW v_soft_404_demand_30d AS
SELECT
  pg_id,
  type_id,
  COUNT(*)::int AS hits,
  MAX(ts) AS last_seen
FROM __soft_404_events
WHERE ts > now() - interval '30 days'
  AND ua_class = 'browser'
GROUP BY pg_id, type_id
HAVING COUNT(*) >= 3
ORDER BY hits DESC;

COMMENT ON TABLE __soft_404_events IS
  'Soft-404 R2 telemetry, append-only, 90d retention. Ownership: seo-platform. ADR: ADR-soft-404-r2-strategy.';

COMMIT;
```

- [ ] **Step 2: Vérifier la syntaxe SQL localement**

Run:
```bash
psql "$DATABASE_URL" -f backend/supabase/migrations/20260518120000_soft_404_events.sql --dry-run 2>&1 || \
  echo "Pas de dry-run en psql; passer Step 3 via test idempotent"
```

Si pas de `psql` local : ouvrir le fichier et vérifier syntaxe à l'œil (BEGIN/COMMIT, types, indexes nommés, view sans SELECT *).

- [ ] **Step 3: Test idempotence**

Le fichier utilise `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE VIEW` → ré-exécutable sans erreur. Vérifier visuellement.

- [ ] **Step 4: Commit**

```bash
git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy add \
  backend/supabase/migrations/20260518120000_soft_404_events.sql

git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy commit -m "$(cat <<'EOF'
feat(db): soft-404 telemetry table + 30d aggregate view

Append-only __soft_404_events (pg_id, type_id, ts, referrer, ua_class)
+ v_soft_404_demand_30d (hits >= 3 sur 30j). Idempotent via IF NOT
EXISTS. Owner: seo-platform.

Spec: docs/superpowers/specs/2026-05-18-soft-404-r2-strategy-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Mettre à jour `audit/ownership.yaml`

**Files:**
- Modify: `audit/ownership.yaml`

- [ ] **Step 1: Lire le format existant pour repérer la section**

Run:
```bash
grep -n "domain:\|D-seo-platform\|migrations" /opt/automecanik/app-worktrees/soft-404-r2-strategy/audit/ownership.yaml | head -20
```

- [ ] **Step 2: Ajouter l'entrée feature-scoped (pas de glob, mémoire `no_broad_migration_glob_in_ownership`)**

Localiser la section migrations / seo-platform et ajouter :

```yaml
- path: "backend/supabase/migrations/20260518120000_soft_404_events.sql"
  domain: D-seo-platform
  owner: "@seo-platform"
  reason: "Soft-404 R2 telemetry table + view (ADR-soft-404-r2-strategy)"
```

Si la section utilise une autre structure de clés (ex. `paths:` array), suivre exactement la convention locale.

- [ ] **Step 3: Valider le YAML**

Run:
```bash
python3 -c "import yaml; yaml.safe_load(open('/opt/automecanik/app-worktrees/soft-404-r2-strategy/audit/ownership.yaml'))" && echo OK
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy add audit/ownership.yaml

git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy commit -m "$(cat <<'EOF'
chore(ownership): register __soft_404_events migration to seo-platform

Feature-scoped entry (no glob) per memory feedback_no_broad_migration_glob_in_ownership.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: DTO Zod v2

**Files:**
- Create: `backend/src/modules/rm/dto/alternatives-v2.dto.ts`

- [ ] **Step 1: Écrire le fichier DTO**

```typescript
// backend/src/modules/rm/dto/alternatives-v2.dto.ts
import { z } from 'zod';

export const AlternativesV2QuerySchema = z.object({
  gamme_id: z.coerce.number().int().positive(),
  type_id: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(1).max(24).default(12),
});
export type AlternativesV2Query = z.infer<typeof AlternativesV2QuerySchema>;

export const TrackSoft404BodySchema = z.object({
  pg_id: z.number().int().positive(),
  type_id: z.number().int().positive(),
});
export type TrackSoft404Body = z.infer<typeof TrackSoft404BodySchema>;

export const AlternativeVehicleSchema = z.object({
  type_id: z.string(),
  type_name: z.string(),
  type_alias: z.string().nullable(),
  type_fuel: z.string(),
  type_power_ps: z.string(),
  type_year_from: z.string(),
  type_year_to: z.string(),
  modele_id: z.number().int(),
  modele_name: z.string(),
  modele_alias: z.string(),
  marque_id: z.number().int(),
  marque_name: z.string(),
  marque_alias: z.string(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
export type AlternativeVehicle = z.infer<typeof AlternativeVehicleSchema>;

export const AlternativeGammeSchema = z.object({
  pg_id: z.number().int(),
  pg_name: z.string(),
  pg_alias: z.string(),
  pg_pic: z.string().nullable(),
  piece_count: z.number().int().nonnegative(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
export type AlternativeGamme = z.infer<typeof AlternativeGammeSchema>;

export const RelatedModelSchema = z.object({
  modele_id: z.number().int(),
  modele_name: z.string(),
  modele_alias: z.string(),
  marque_id: z.number().int(),
  marque_name: z.string(),
  marque_alias: z.string(),
  representative_type_id: z.string(),
  representative_type_alias: z.string(),
});
export type RelatedModel = z.infer<typeof RelatedModelSchema>;

export const AlternativesV2ResponseSchema = z.object({
  success: z.literal(true),
  version: z.literal('v2'),
  etag: z.string(),
  alternativeVehicles: z.array(AlternativeVehicleSchema),
  alternativeGammes: z.array(AlternativeGammeSchema),
  relatedModels: z.array(RelatedModelSchema),
});
export type AlternativesV2Response = z.infer<typeof AlternativesV2ResponseSchema>;
```

- [ ] **Step 2: Vérifier le typecheck**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy && \
  npx --workspace=backend tsc --noEmit -p backend/tsconfig.json 2>&1 | grep alternatives-v2 || echo OK
```

Expected: `OK` (aucune erreur dans le DTO).

- [ ] **Step 3: Commit**

```bash
git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy add \
  backend/src/modules/rm/dto/alternatives-v2.dto.ts

git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy commit -m "$(cat <<'EOF'
feat(rm): zod schemas for alternatives v2 + soft-404 tracking

Single source of truth for query / body / response shapes. Schemas
exposed pour parsing controller et pour tests (réutilisables).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Catalogue statique des clusters de gammes

**Files:**
- Create: `backend/src/modules/rm/services/gamme-clusters.const.ts`

- [ ] **Step 1: Écrire le squelette des clusters**

Le catalogue exact des `member_pg_ids` exige une **requête forensique catalogue pre-merge** (cf. spec §3.3.2). Le squelette V1 contient des entrées vérifiables et un fallback gracieux pour ce qui manque.

```typescript
// backend/src/modules/rm/services/gamme-clusters.const.ts
/**
 * Clusters de gammes (V1 statique).
 *
 * - `parent_pg_id` : pg_id de la gamme "parent système" (ex. système freinage complet).
 *   Si null, on ignore le tier 2 pour ce cluster.
 * - `member_pg_ids` : gammes du même cluster (tier 1).
 *
 * Pre-merge action : confirmer les member_pg_ids avec le pôle catalogue via :
 *   SELECT pg_id, pg_name FROM pieces_gamme WHERE pg_name ILIKE '%frein%' ORDER BY pg_name;
 *
 * Une gamme absente de tous les clusters retombe sur le tier 3 (popularité catalogue).
 * Dégradation gracieuse : pas d'erreur, juste un ranking moins pertinent.
 *
 * V1.5 : envisager une colonne `pg_cluster TEXT` dans `pieces_gamme` si la liste devient ingérable.
 */
export interface GammeCluster {
  readonly parent_pg_id: number | null;
  readonly member_pg_ids: readonly number[];
}

export const GAMME_CLUSTERS: Readonly<Record<string, GammeCluster>> = Object.freeze({
  // Cluster freinage arrière (pg_id 3859 confirmé : Kit de freins arrière)
  'freinage-arriere': {
    parent_pg_id: null, // à confirmer pre-merge (gamme "système freinage" si existe)
    member_pg_ids: [3859],
  },
  // Cluster freinage avant
  'freinage-avant': {
    parent_pg_id: null,
    member_pg_ids: [],
  },
  // Autres clusters macro à valider pre-merge :
  'allumage': { parent_pg_id: null, member_pg_ids: [] },
  'distribution': { parent_pg_id: null, member_pg_ids: [] },
  'filtration': { parent_pg_id: null, member_pg_ids: [] },
  'refroidissement': { parent_pg_id: null, member_pg_ids: [] },
  'suspension': { parent_pg_id: null, member_pg_ids: [] },
  'transmission': { parent_pg_id: null, member_pg_ids: [] },
});

/**
 * Renvoie le cluster auquel appartient un pg_id, ou null si aucun match.
 */
export function findClusterFor(pg_id: number): GammeCluster | null {
  for (const cluster of Object.values(GAMME_CLUSTERS)) {
    if (cluster.member_pg_ids.includes(pg_id)) {
      return cluster;
    }
  }
  return null;
}
```

- [ ] **Step 2: Vérifier typecheck**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy && \
  npx --workspace=backend tsc --noEmit -p backend/tsconfig.json 2>&1 | grep gamme-clusters || echo OK
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy add \
  backend/src/modules/rm/services/gamme-clusters.const.ts

git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy commit -m "$(cat <<'EOF'
feat(rm): static gamme clusters skeleton (V1)

7 macro-clusters (freinage-arr, freinage-av, allumage, distribution,
filtration, refroidissement, suspension, transmission). Squelette
fonctionnel avec dégradation gracieuse — member_pg_ids confirmés par
le pôle catalogue avant merge final.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Tests unitaires `RmAlternativesService` (test-first)

**Files:**
- Create: `backend/src/modules/rm/services/__tests__/rm-alternatives.service.test.ts`

Ce test est écrit **avant** le service (TDD). Il restera rouge jusqu'au Task 6.

- [ ] **Step 1: Écrire les tests**

```typescript
// backend/src/modules/rm/services/__tests__/rm-alternatives.service.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RmAlternativesService } from '../rm-alternatives.service';
import { SupabaseBaseService } from '../../../../shared/supabase-base.service';
import { CacheService } from '../../../cache/cache.service';

describe('RmAlternativesService', () => {
  let service: RmAlternativesService;
  let cacheMock: jest.Mocked<Partial<CacheService>>;
  let supabaseMock: any;

  beforeEach(async () => {
    cacheMock = {
      get: jest.fn(),
      set: jest.fn(),
    };
    // Chainable mock Supabase ; chaque .from() retourne un thenable contrôlable.
    const builder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };
    supabaseMock = { from: jest.fn(() => builder), rpc: jest.fn(), __builder: builder };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RmAlternativesService,
        { provide: SupabaseBaseService, useValue: { client: supabaseMock } },
        { provide: CacheService, useValue: cacheMock },
      ],
    }).compile();
    service = module.get<RmAlternativesService>(RmAlternativesService);
  });

  describe('compute()', () => {
    it('retourne le payload depuis le cache si présent (cache hit)', async () => {
      const cached = {
        success: true as const,
        version: 'v2' as const,
        etag: 'sha256-cached',
        alternativeVehicles: [],
        alternativeGammes: [],
        relatedModels: [],
      };
      cacheMock.get!.mockResolvedValue(JSON.stringify(cached));

      const result = await service.compute(11836, 3859, 12);

      expect(cacheMock.get).toHaveBeenCalledWith('alt:11836:3859:v1');
      expect(supabaseMock.from).not.toHaveBeenCalled();
      expect(result).toEqual(cached);
    });

    it('produit un etag sha256-stable et écrit dans le cache (cache miss)', async () => {
      cacheMock.get!.mockResolvedValue(null);
      // Stub minimal pour ne pas crasher en miss
      supabaseMock.__builder.single.mockResolvedValue({ data: null, error: null });

      const r1 = await service.compute(11836, 3859, 12);
      const r2 = await service.compute(11836, 3859, 12);

      expect(r1.etag).toMatch(/^sha256-[0-9a-f]{64}$/);
      // Etag déterministe : même input → même etag
      expect(r1.etag).toEqual(r2.etag);
      expect(cacheMock.set).toHaveBeenCalled();
    });

    it('attribue tier=1 aux véhicules du même modele_id', async () => {
      // Stub deeper du fetch véhicules : on retourne 2 candidats, dont 1 même modele_id
      const ranking = await (service as any).rankVehicles(
        [
          { type_id: '11838', modele_id: 33053, marque_id: 33, modele_parent: null, power_ps: 258 },
          { type_id: '99999', modele_id: 12345, marque_id: 33, modele_parent: null, power_ps: 150 },
        ],
        { target_type_id: 11836, target_modele_id: 33053, target_modele_parent: null, target_marque_id: 33, target_power_ps: 218 },
      );
      expect(ranking[0].tier).toBe(1);
      expect(ranking[0].type_id).toBe('11838');
    });

    it('filtre les véhicules qui n\'ont aucune relation pieces_relation_type pour la gamme (compat-aware)', async () => {
      // Stub fetch véhicules : Supabase devrait être interrogé avec EXISTS pieces_relation_type
      // (verif statique par regex sur le SQL généré côté service)
      cacheMock.get!.mockResolvedValue(null);
      supabaseMock.__builder.single.mockResolvedValue({ data: null, error: null });

      await service.compute(11836, 3859, 12);

      // On vérifie que le service appelle bien la table pieces_relation_type dans son flow
      const fromCalls = supabaseMock.from.mock.calls.map((c: any[]) => c[0]);
      expect(fromCalls).toEqual(expect.arrayContaining(['pieces_relation_type']));
    });
  });

  describe('output canonical', () => {
    it('produit un JSON canonical (clés triées) avant hashing', async () => {
      const a = (service as any).canonicalize({ b: 1, a: 2 });
      const b = (service as any).canonicalize({ a: 2, b: 1 });
      expect(a).toEqual(b);
    });
  });
});
```

- [ ] **Step 2: Run, attendre échec**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy/backend && \
  npx jest src/modules/rm/services/__tests__/rm-alternatives.service.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '../rm-alternatives.service'`.

- [ ] **Step 3: Commit du test rouge**

```bash
git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy add \
  backend/src/modules/rm/services/__tests__/rm-alternatives.service.test.ts

git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy commit -m "$(cat <<'EOF'
test(rm): failing tests for RmAlternativesService (TDD red)

Tests: cache hit/miss, etag déterministe, tier=1 même modele_id,
filtre compat-aware via pieces_relation_type, canonical JSON.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Implémentation `RmAlternativesService`

**Files:**
- Create: `backend/src/modules/rm/services/rm-alternatives.service.ts`

- [ ] **Step 1: Écrire le service complet**

```typescript
// backend/src/modules/rm/services/rm-alternatives.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SupabaseBaseService } from '../../../shared/supabase-base.service';
import { CacheService } from '../../cache/cache.service';
import { findClusterFor } from './gamme-clusters.const';
import type {
  AlternativesV2Response,
  AlternativeVehicle,
  AlternativeGamme,
  RelatedModel,
} from '../dto/alternatives-v2.dto';

const CACHE_TTL_SECONDS = 300; // 5 min
const CACHE_KEY_PREFIX = 'alt';
const CACHE_KEY_VERSION = 'v1';

const TIER_WEIGHT = { 1: 1.0, 2: 0.8, 3: 0.5 } as const;

interface VehicleCandidate {
  type_id: string;
  type_name: string;
  type_alias: string | null;
  type_fuel: string;
  type_power_ps: string;
  type_year_from: string;
  type_year_to: string;
  modele_id: number;
  modele_name: string;
  modele_alias: string;
  modele_parent: number | null;
  marque_id: number;
  marque_name: string;
  marque_alias: string;
  power_ps_num: number;
}

interface VehicleTarget {
  target_type_id: number;
  target_modele_id: number;
  target_modele_parent: number | null;
  target_marque_id: number;
  target_power_ps: number;
}

@Injectable()
export class RmAlternativesService {
  private readonly logger = new Logger(RmAlternativesService.name);

  constructor(
    private readonly supabase: SupabaseBaseService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Compute alternatives v2 payload (multi-tier, compat-aware, cache-aside).
   *
   * @param type_id véhicule de référence
   * @param pg_id gamme de référence
   * @param limit max résultats par catégorie (clampé 1..24 en amont)
   */
  async compute(type_id: number, pg_id: number, limit: number): Promise<AlternativesV2Response> {
    const cacheKey = `${CACHE_KEY_PREFIX}:${type_id}:${pg_id}:${CACHE_KEY_VERSION}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as AlternativesV2Response;
      } catch (e) {
        this.logger.warn(`Cache parse error for ${cacheKey}, recomputing`);
      }
    }

    const target = await this.loadTarget(type_id);
    if (!target) {
      const empty = this.buildResponse([], [], []);
      await this.cache.set(cacheKey, JSON.stringify(empty), CACHE_TTL_SECONDS);
      return empty;
    }

    const [vehicleCands, gammeRows, modelRows] = await Promise.all([
      this.fetchVehicleCandidates(target, pg_id, limit * 3),
      this.fetchCompatibleGammes(type_id, pg_id, limit * 2),
      this.fetchRelatedModels(target, pg_id, 4),
    ]);

    const vehicles = this.rankVehicles(vehicleCands, target).slice(0, Math.min(6, limit));
    const gammes = this.rankGammes(gammeRows, pg_id).slice(0, Math.min(8, limit));
    const models = await this.attachRepresentativeTypes(modelRows, pg_id);

    const response = this.buildResponse(vehicles, gammes, models);
    await this.cache.set(cacheKey, JSON.stringify(response), CACHE_TTL_SECONDS);
    return response;
  }

  private async loadTarget(type_id: number): Promise<VehicleTarget | null> {
    const { data, error } = await this.supabase.client
      .from('auto_type')
      .select('type_modele_id, type_marque_id, type_power_ps')
      .eq('type_id_i', type_id)
      .single();
    if (error || !data) return null;
    const modele_id = parseInt((data as any).type_modele_id, 10);
    if (Number.isNaN(modele_id)) return null;

    const { data: modele } = await this.supabase.client
      .from('auto_modele')
      .select('modele_parent, modele_marque_id')
      .eq('modele_id', modele_id)
      .single();
    return {
      target_type_id: type_id,
      target_modele_id: modele_id,
      target_modele_parent: (modele as any)?.modele_parent ?? null,
      target_marque_id: parseInt((data as any).type_marque_id, 10),
      target_power_ps: parseInt((data as any).type_power_ps, 10) || 0,
    };
  }

  private async fetchVehicleCandidates(
    target: VehicleTarget,
    pg_id: number,
    raw_limit: number,
  ): Promise<VehicleCandidate[]> {
    // Étape 1 : IDs de types compatibles avec la gamme
    const { data: compat } = await this.supabase.client
      .from('pieces_relation_type')
      .select('rtp_type_id')
      .eq('rtp_pg_id', pg_id)
      .limit(2000);

    const compat_ids = (compat ?? []).map((r: any) => parseInt(r.rtp_type_id, 10)).filter(Boolean);
    if (compat_ids.length === 0) return [];

    // Étape 2 : enrichir via auto_type (filtrer marque = même que la cible pour Tier 1-3)
    const { data: types } = await this.supabase.client
      .from('auto_type')
      .select(
        'type_id, type_id_i, type_name, type_alias, type_fuel, type_power_ps, ' +
          'type_year_from, type_year_to, type_modele_id, type_marque_id, type_display, type_relfollow',
      )
      .in('type_id_i', compat_ids.slice(0, 1500))
      .eq('type_marque_id', String(target.target_marque_id))
      .eq('type_display', '1')
      .eq('type_relfollow', '1')
      .limit(raw_limit);

    if (!types || types.length === 0) return [];

    // Étape 3 : enrichir modèles
    const modele_ids = Array.from(new Set(types.map((t: any) => parseInt(t.type_modele_id, 10))));
    const { data: modeles } = await this.supabase.client
      .from('auto_modele')
      .select('modele_id, modele_name, modele_alias, modele_marque_id, modele_parent')
      .in('modele_id', modele_ids);

    const modele_index = new Map<number, any>((modeles ?? []).map((m: any) => [m.modele_id, m]));

    // Étape 4 : marque
    const { data: marque } = await this.supabase.client
      .from('auto_marque')
      .select('marque_id, marque_name, marque_alias')
      .eq('marque_id', target.target_marque_id)
      .single();

    return types
      .filter((t: any) => parseInt(t.type_id_i, 10) !== target.target_type_id)
      .map((t: any) => {
        const m = modele_index.get(parseInt(t.type_modele_id, 10));
        if (!m) return null;
        return {
          type_id: String(t.type_id),
          type_name: String(t.type_name),
          type_alias: t.type_alias ?? null,
          type_fuel: String(t.type_fuel ?? ''),
          type_power_ps: String(t.type_power_ps ?? ''),
          type_year_from: String(t.type_year_from ?? ''),
          type_year_to: String(t.type_year_to ?? ''),
          modele_id: m.modele_id,
          modele_name: m.modele_name,
          modele_alias: m.modele_alias,
          modele_parent: m.modele_parent,
          marque_id: (marque as any)?.marque_id ?? target.target_marque_id,
          marque_name: (marque as any)?.marque_name ?? '',
          marque_alias: (marque as any)?.marque_alias ?? '',
          power_ps_num: parseInt(t.type_power_ps, 10) || 0,
        } as VehicleCandidate;
      })
      .filter((v): v is VehicleCandidate => v !== null);
  }

  rankVehicles(candidates: VehicleCandidate[], target: VehicleTarget): AlternativeVehicle[] {
    const seen_modeles = new Set<number>();
    return candidates
      .map((c) => {
        const tier: 1 | 2 | 3 =
          c.modele_id === target.target_modele_id
            ? 1
            : target.target_modele_parent !== null && c.modele_parent === target.target_modele_parent
              ? 2
              : 3;
        const power_proximity = 1 - Math.min(1, Math.abs(c.power_ps_num - target.target_power_ps) / 500);
        const score = TIER_WEIGHT[tier] * Math.max(0.1, power_proximity);
        return { c, tier, score };
      })
      .sort((a, b) => (b.score - a.score) || a.c.type_id.localeCompare(b.c.type_id))
      .filter(({ c }) => {
        if (seen_modeles.has(c.modele_id)) return false;
        seen_modeles.add(c.modele_id);
        return true;
      })
      .map(({ c, tier }) => ({
        type_id: c.type_id,
        type_name: c.type_name,
        type_alias: c.type_alias,
        type_fuel: c.type_fuel,
        type_power_ps: c.type_power_ps,
        type_year_from: c.type_year_from,
        type_year_to: c.type_year_to,
        modele_id: c.modele_id,
        modele_name: c.modele_name,
        modele_alias: c.modele_alias,
        marque_id: c.marque_id,
        marque_name: c.marque_name,
        marque_alias: c.marque_alias,
        tier,
      }));
  }

  private async fetchCompatibleGammes(
    type_id: number,
    exclude_pg_id: number,
    raw_limit: number,
  ): Promise<Array<{ pg_id: number; pg_name: string; pg_alias: string; pg_pic: string | null; pg_top: string; piece_count: number }>> {
    // Récupère les pg_id compatibles via pieces_relation_type, compte les pieces, enrichit via pieces_gamme.
    const { data: rels } = await this.supabase.client
      .from('pieces_relation_type')
      .select('rtp_pg_id')
      .eq('rtp_type_id', type_id)
      .limit(2000);

    const counts = new Map<number, number>();
    (rels ?? []).forEach((r: any) => {
      const id = parseInt(r.rtp_pg_id, 10);
      if (!id || id === exclude_pg_id) return;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    const pg_ids = Array.from(counts.keys()).slice(0, raw_limit);
    if (pg_ids.length === 0) return [];

    const { data: gammes } = await this.supabase.client
      .from('pieces_gamme')
      .select('pg_id, pg_name, pg_alias, pg_pic, pg_top, pg_display')
      .in('pg_id', pg_ids)
      .eq('pg_display', '1');

    return (gammes ?? []).map((g: any) => ({
      pg_id: g.pg_id,
      pg_name: g.pg_name,
      pg_alias: g.pg_alias,
      pg_pic: g.pg_pic,
      pg_top: g.pg_top,
      piece_count: counts.get(g.pg_id) ?? 0,
    }));
  }

  rankGammes(
    rows: Array<{ pg_id: number; pg_name: string; pg_alias: string; pg_pic: string | null; pg_top: string; piece_count: number }>,
    reference_pg_id: number,
  ): AlternativeGamme[] {
    const cluster = findClusterFor(reference_pg_id);
    const cluster_members = new Set(cluster?.member_pg_ids ?? []);
    const cluster_parent = cluster?.parent_pg_id ?? null;

    return rows
      .map((r) => {
        const tier: 1 | 2 | 3 = cluster_members.has(r.pg_id)
          ? 1
          : cluster_parent !== null && r.pg_id === cluster_parent
            ? 2
            : 3;
        const popularity = Math.log(1 + r.piece_count);
        const top_boost = r.pg_top === '1' ? 1.2 : 1.0;
        const score = TIER_WEIGHT[tier] * popularity * top_boost;
        return { r, tier, score };
      })
      .sort((a, b) => (b.score - a.score) || (a.r.pg_id - b.r.pg_id))
      .map(({ r, tier }) => ({
        pg_id: r.pg_id,
        pg_name: r.pg_name,
        pg_alias: r.pg_alias,
        pg_pic: r.pg_pic,
        piece_count: r.piece_count,
        tier,
      }));
  }

  private async fetchRelatedModels(
    target: VehicleTarget,
    pg_id: number,
    limit: number,
  ): Promise<Array<{ modele_id: number; modele_name: string; modele_alias: string }>> {
    // Modèles de la même marque qui ont au moins 1 type compatible avec la gamme.
    const { data: compat_types } = await this.supabase.client
      .from('pieces_relation_type')
      .select('rtp_type_id')
      .eq('rtp_pg_id', pg_id)
      .limit(2000);
    const compat_type_ids = (compat_types ?? []).map((r: any) => parseInt(r.rtp_type_id, 10));
    if (compat_type_ids.length === 0) return [];

    const { data: types } = await this.supabase.client
      .from('auto_type')
      .select('type_modele_id')
      .in('type_id_i', compat_type_ids.slice(0, 2000))
      .eq('type_marque_id', String(target.target_marque_id))
      .eq('type_display', '1');

    const modele_ids = Array.from(
      new Set(
        (types ?? [])
          .map((t: any) => parseInt(t.type_modele_id, 10))
          .filter((id: number) => id && id !== target.target_modele_id),
      ),
    );
    if (modele_ids.length === 0) return [];

    const { data: modeles } = await this.supabase.client
      .from('auto_modele')
      .select('modele_id, modele_name, modele_alias, modele_display')
      .in('modele_id', modele_ids)
      .eq('modele_display', 1)
      .limit(limit);

    return (modeles ?? []).map((m: any) => ({
      modele_id: m.modele_id,
      modele_name: m.modele_name,
      modele_alias: m.modele_alias,
    }));
  }

  private async attachRepresentativeTypes(
    modeles: Array<{ modele_id: number; modele_name: string; modele_alias: string }>,
    pg_id: number,
  ): Promise<RelatedModel[]> {
    if (modeles.length === 0) return [];
    const result: RelatedModel[] = [];
    for (const m of modeles) {
      // Type le plus relié pour ce modele × pg
      const { data: types } = await this.supabase.client
        .from('auto_type')
        .select('type_id, type_alias, type_modele_id, type_marque_id')
        .eq('type_modele_id', String(m.modele_id))
        .eq('type_display', '1')
        .limit(50);
      if (!types || types.length === 0) continue;
      const type_ids = types.map((t: any) => parseInt(t.type_id, 10));
      const { data: rels } = await this.supabase.client
        .from('pieces_relation_type')
        .select('rtp_type_id')
        .in('rtp_type_id', type_ids)
        .eq('rtp_pg_id', pg_id);
      const reliable = (rels ?? [])
        .map((r: any) => parseInt(r.rtp_type_id, 10))
        .reduce((acc, id) => acc.set(id, (acc.get(id) ?? 0) + 1), new Map<number, number>());
      if (reliable.size === 0) continue;
      const best = [...reliable.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
      const rep = types.find((t: any) => parseInt(t.type_id, 10) === best[0]);
      if (!rep) continue;
      result.push({
        modele_id: m.modele_id,
        modele_name: m.modele_name,
        modele_alias: m.modele_alias,
        marque_id: parseInt((rep as any).type_marque_id, 10),
        marque_name: '',
        marque_alias: '',
        representative_type_id: String((rep as any).type_id),
        representative_type_alias: String((rep as any).type_alias ?? ''),
      });
    }
    return result;
  }

  /**
   * Canonical JSON : clés triées récursivement. Utilisé pour l'etag.
   */
  canonicalize(input: unknown): string {
    if (input === null || typeof input !== 'object') return JSON.stringify(input);
    if (Array.isArray(input)) return '[' + input.map((v) => this.canonicalize(v)).join(',') + ']';
    const keys = Object.keys(input as Record<string, unknown>).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + this.canonicalize((input as any)[k])).join(',') + '}';
  }

  private buildResponse(
    vehicles: AlternativeVehicle[],
    gammes: AlternativeGamme[],
    models: RelatedModel[],
  ): AlternativesV2Response {
    const payload = {
      alternativeVehicles: vehicles,
      alternativeGammes: gammes,
      relatedModels: models,
    };
    const etag = 'sha256-' + createHash('sha256').update(this.canonicalize(payload)).digest('hex');
    return {
      success: true,
      version: 'v2',
      etag,
      ...payload,
    };
  }
}
```

- [ ] **Step 2: Run tests, vérifier passage**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy/backend && \
  npx jest src/modules/rm/services/__tests__/rm-alternatives.service.test.ts --no-coverage 2>&1 | tail -15
```

Expected: tous tests passent (5/5).

Si un test échoue : lire le diff, ajuster le service (pas le test, sauf si le test contient une erreur évidente).

- [ ] **Step 3: Commit**

```bash
git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy add \
  backend/src/modules/rm/services/rm-alternatives.service.ts

git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy commit -m "$(cat <<'EOF'
feat(rm): implement RmAlternativesService (multi-tier ranking, compat-aware)

- Tier 1 (modele identique), Tier 2 (modele_parent), Tier 3 (marque)
- Filtre EXISTS pieces_relation_type pour véhicules/gammes/modèles
- Cache Redis 5 min, etag sha256 sur canonical JSON
- relatedModels avec type représentatif (max(pieces_relation_type))
- Dégradation gracieuse cluster vide → tier 3 popularité

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Tests + implémentation `RmSoft404TrackerService`

**Files:**
- Create: `backend/src/modules/rm/services/rm-soft404-tracker.service.ts`
- Create: `backend/src/modules/rm/services/__tests__/rm-soft404-tracker.service.test.ts`

- [ ] **Step 1: Tests (TDD red)**

```typescript
// backend/src/modules/rm/services/__tests__/rm-soft404-tracker.service.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RmSoft404TrackerService } from '../rm-soft404-tracker.service';
import { SupabaseBaseService } from '../../../../shared/supabase-base.service';
import { CacheService } from '../../../cache/cache.service';

describe('RmSoft404TrackerService', () => {
  let service: RmSoft404TrackerService;
  let cache: jest.Mocked<Partial<CacheService>>;
  let supabaseInsert: jest.Mock;

  beforeEach(async () => {
    cache = { get: jest.fn(), set: jest.fn() };
    supabaseInsert = jest.fn().mockResolvedValue({ error: null });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RmSoft404TrackerService,
        {
          provide: SupabaseBaseService,
          useValue: { client: { from: () => ({ insert: supabaseInsert }) } },
        },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    service = module.get<RmSoft404TrackerService>(RmSoft404TrackerService);
  });

  it('classifie un UA Googlebot comme "bot"', () => {
    expect(service.classifyUA('Mozilla/5.0 (compatible; Googlebot/2.1; ...)')).toBe('bot');
  });
  it('classifie un UA Chrome comme "browser"', () => {
    expect(service.classifyUA('Mozilla/5.0 (Macintosh; ...) Chrome/120')).toBe('browser');
  });
  it('classifie un UA inconnu comme "unknown"', () => {
    expect(service.classifyUA('curl/8.5.0')).toBe('unknown');
  });

  it('throttle: ne réinsère pas si la même session a déjà tracké < 60s', async () => {
    cache.get!.mockResolvedValue('1');
    await service.track({ pg_id: 3859, type_id: 11836 }, { sessionId: 's1', ua: 'Chrome/120', referrer: null });
    expect(supabaseInsert).not.toHaveBeenCalled();
  });

  it('insère sinon, et pose le flag Redis 60s', async () => {
    cache.get!.mockResolvedValue(null);
    await service.track({ pg_id: 3859, type_id: 11836 }, { sessionId: 's2', ua: 'Mozilla/5.0 Chrome/120', referrer: '/x' });
    expect(supabaseInsert).toHaveBeenCalledWith(expect.objectContaining({
      pg_id: 3859, type_id: 11836, ua_class: 'browser', referrer: '/x',
    }));
    expect(cache.set).toHaveBeenCalledWith('track-soft-404:s2', '1', 60);
  });
});
```

- [ ] **Step 2: Run, attendre fail**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy/backend && \
  npx jest src/modules/rm/services/__tests__/rm-soft404-tracker.service.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../rm-soft404-tracker.service'`.

- [ ] **Step 3: Implémentation**

```typescript
// backend/src/modules/rm/services/rm-soft404-tracker.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../shared/supabase-base.service';
import { CacheService } from '../../cache/cache.service';

export type UaClass = 'bot' | 'browser' | 'unknown';

const BOT_PATTERNS = /(Googlebot|bingbot|YandexBot|DuckDuckBot|Baiduspider|Slurp|AhrefsBot|SemrushBot|FacebookExternalHit|Twitterbot|LinkedInBot)/i;
const BROWSER_PATTERNS = /(Chrome|Safari|Firefox|Edge|Opera|Mozilla\/5\.0).+(AppleWebKit|Gecko|Trident)/i;

@Injectable()
export class RmSoft404TrackerService {
  private readonly logger = new Logger(RmSoft404TrackerService.name);

  constructor(
    private readonly supabase: SupabaseBaseService,
    private readonly cache: CacheService,
  ) {}

  classifyUA(ua: string | null | undefined): UaClass {
    if (!ua) return 'unknown';
    if (BOT_PATTERNS.test(ua)) return 'bot';
    if (BROWSER_PATTERNS.test(ua)) return 'browser';
    return 'unknown';
  }

  async track(
    body: { pg_id: number; type_id: number },
    ctx: { sessionId: string | null; ua: string | null; referrer: string | null },
  ): Promise<void> {
    const sessionId = ctx.sessionId ?? 'anon-' + body.type_id + '-' + body.pg_id;
    const throttleKey = `track-soft-404:${sessionId}`;
    const recent = await this.cache.get(throttleKey);
    if (recent) return;

    const ua_class = this.classifyUA(ctx.ua);
    const { error } = await (this.supabase.client.from('__soft_404_events') as any).insert({
      pg_id: body.pg_id,
      type_id: body.type_id,
      referrer: ctx.referrer,
      ua_class,
    });
    if (error) {
      this.logger.warn(`Soft-404 track insert failed: ${error.message}`);
      return;
    }
    await this.cache.set(throttleKey, '1', 60);
  }
}
```

- [ ] **Step 4: Run tests, passer vert**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy/backend && \
  npx jest src/modules/rm/services/__tests__/rm-soft404-tracker.service.test.ts --no-coverage 2>&1 | tail -10
```

Expected: 5/5 PASS.

- [ ] **Step 5: Commit (tests + impl)**

```bash
git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy add \
  backend/src/modules/rm/services/rm-soft404-tracker.service.ts \
  backend/src/modules/rm/services/__tests__/rm-soft404-tracker.service.test.ts

git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy commit -m "$(cat <<'EOF'
feat(rm): RmSoft404TrackerService + UA classifier + Redis throttling

- UA classification (bot / browser / unknown) sans fingerprinting
- Throttle 1/min/session via Redis (key track-soft-404:{sessionId})
- Append-only insert __soft_404_events
- 5 tests TDD verts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Wire les nouveaux services dans `RmModule`

**Files:**
- Modify: `backend/src/modules/rm/rm.module.ts`

- [ ] **Step 1: Lire le fichier**

Run:
```bash
cat /opt/automecanik/app-worktrees/soft-404-r2-strategy/backend/src/modules/rm/rm.module.ts
```

- [ ] **Step 2: Ajouter les imports + providers**

Ajouter en haut, à côté des imports existants :

```typescript
import { RmAlternativesService } from './services/rm-alternatives.service';
import { RmSoft404TrackerService } from './services/rm-soft404-tracker.service';
```

Ajouter dans le `providers: [...]` array (et `exports: [...]` si exporté) :

```typescript
providers: [
  // ... services existants ...
  RmAlternativesService,
  RmSoft404TrackerService,
],
exports: [
  // ... existants ...
  RmAlternativesService,
  RmSoft404TrackerService,
],
```

- [ ] **Step 3: Vérifier typecheck**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy && \
  npx --workspace=backend tsc --noEmit -p backend/tsconfig.json 2>&1 | tail -10
```

Expected: pas d'erreur sur `rm.module.ts`.

- [ ] **Step 4: Commit**

```bash
git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy add backend/src/modules/rm/rm.module.ts

git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy commit -m "$(cat <<'EOF'
chore(rm): wire RmAlternativesService and RmSoft404TrackerService into RmModule

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Refactor `RmController` — `/alternatives` v2 + `/track-soft-404`

**Files:**
- Modify: `backend/src/modules/rm/controllers/rm.controller.ts`

- [ ] **Step 1: Lire la portion à modifier**

Run:
```bash
sed -n '1,40p;245,290p' /opt/automecanik/app-worktrees/soft-404-r2-strategy/backend/src/modules/rm/controllers/rm.controller.ts
```

- [ ] **Step 2: Imports et constructeur**

En haut du fichier, ajouter aux imports NestJS :

```typescript
import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Headers,
  Logger,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UsePipes,
} from '@nestjs/common';
import type { Request } from 'express';
import { ZodValidationPipe } from '<chemin-existant-projet>'; // si projet utilise ZodValidationPipe ; sinon parse Zod manuellement
import { RmAlternativesService } from '../services/rm-alternatives.service';
import { RmSoft404TrackerService } from '../services/rm-soft404-tracker.service';
import { TrackSoft404BodySchema, type TrackSoft404Body } from '../dto/alternatives-v2.dto';
```

> **Note pour l'agent** : si le projet n'a pas de `ZodValidationPipe` partagé, faire un parsing inline :
> ```typescript
> const parsed = TrackSoft404BodySchema.safeParse(rawBody);
> if (!parsed.success) throw new BadRequestException(parsed.error.message);
> ```
> Grep pour vérifier : `grep -rn "ZodValidationPipe" backend/src --include='*.ts' | head -3`

Constructeur enrichi :

```typescript
constructor(
  private readonly rmBuilder: RmBuilderService,
  private readonly rmAlternatives: RmAlternativesService,
  private readonly rmTracker: RmSoft404TrackerService,
) {}
```

- [ ] **Step 3: Remplacer `getAlternatives`**

Remplacer le bloc lignes ~260-285 (l'ancien `@Get('alternatives')`) par :

```typescript
@Get('alternatives')
async getAlternatives(
  @Query('gamme_id', ParseIntPipe) gamme_id: number,
  @Query('type_id', ParseIntPipe) type_id: number,
  @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
) {
  try {
    const clampedLimit = Math.min(Math.max(limit, 1), 24);
    return await this.rmAlternatives.compute(type_id, gamme_id, clampedLimit);
  } catch (err) {
    this.logger.warn(
      `Alternatives v2 endpoint error gamme=${gamme_id} type=${type_id}: ${err instanceof Error ? err.message : err}`,
    );
    return {
      success: true,
      version: 'v2',
      etag: 'sha256-empty',
      alternativeVehicles: [],
      alternativeGammes: [],
      relatedModels: [],
    };
  }
}

@Post('alternatives/track-soft-404')
@HttpCode(HttpStatus.NO_CONTENT)
async trackSoft404(
  @Body() body: unknown,
  @Req() req: Request,
  @Headers('user-agent') ua: string | undefined,
  @Headers('referer') referer: string | undefined,
): Promise<void> {
  const parsed = TrackSoft404BodySchema.safeParse(body);
  if (!parsed.success) return; // fire-and-forget : silent reject

  const sessionId = (req as any)?.session?.id ?? null;
  await this.rmTracker.track(parsed.data, {
    sessionId,
    ua: ua ?? null,
    referrer: referer ?? null,
  });
}
```

- [ ] **Step 4: Vérifier le typecheck et lancer les tests backend**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy && \
  npx --workspace=backend tsc --noEmit -p backend/tsconfig.json 2>&1 | tail -10
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy/backend && \
  npx jest src/modules/rm --no-coverage 2>&1 | tail -10
```

Expected: tsc sans erreur, jest tous verts (sur scope rm).

- [ ] **Step 5: Commit**

```bash
git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy add \
  backend/src/modules/rm/controllers/rm.controller.ts

git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy commit -m "$(cat <<'EOF'
feat(rm): controller v2 — alternatives compat-aware + track-soft-404 beacon

GET /api/rm/alternatives délègue à RmAlternativesService (payload v2).
POST /api/rm/alternatives/track-soft-404 : beacon append-only, 204 No
Content, fire-and-forget, Zod-validated.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Retirer l'ancienne `getAlternatives` de `RmBuilderService` (single-write-path)

**Files:**
- Modify: `backend/src/modules/rm/services/rm-builder.service.ts`

- [ ] **Step 1: Confirmer qu'aucun autre call site n'utilise `rmBuilder.getAlternatives`**

Run:
```bash
grep -rn "rmBuilder.getAlternatives\|rm-builder.*getAlternatives" \
  /opt/automecanik/app-worktrees/soft-404-r2-strategy --include='*.ts' | grep -v '\.spec\.ts\|\.test\.ts'
```

Expected: aucune occurrence en dehors de `rm-builder.service.ts` lui-même (le controller vient d'être migré).

- [ ] **Step 2: Supprimer la méthode**

Lire les lignes ~710-780 (cf. cartographie initiale) et supprimer la méthode `getAlternatives` complète + ses helpers privés s'ils ne sont pas utilisés ailleurs (grep avant de supprimer chaque helper).

- [ ] **Step 3: Vérifier typecheck + tests**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy && \
  npx --workspace=backend tsc --noEmit -p backend/tsconfig.json 2>&1 | tail -10
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy/backend && \
  npx jest src/modules/rm --no-coverage 2>&1 | tail -10
```

Expected: tsc sans erreur, jest vert.

- [ ] **Step 4: Commit**

```bash
git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy add \
  backend/src/modules/rm/services/rm-builder.service.ts

git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy commit -m "$(cat <<'EOF'
refactor(rm): remove legacy getAlternatives from RmBuilderService (single-write-path)

Toutes les références passent par RmAlternativesService. RmBuilderService
ne porte plus la logique alternatives. Conforme mémoire feedback_single_write_path_needs_bypass_scanner.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Frontend — Extension du type `NoProductsData`

**Files:**
- Modify: `frontend/app/components/pieces/NoProductsAlternatives.tsx` (uniquement les types, refactor full au Task 14)

- [ ] **Step 1: Étendre l'interface `NoProductsData`**

Repérer le bloc lignes 7-34 actuel et ajouter :

```typescript
export interface VehicleContext {
  marqueName: string;
  modeleName: string;
  typeName: string;
  typeFuel: string;
  typePowerPs: string;
  yearFrom: string;
  yearTo: string;
}

export interface RelatedModel {
  modele_id: number;
  modele_name: string;
  modele_alias: string;
  marque_id: number;
  marque_name: string;
  marque_alias: string;
  representative_type_id: string;
  representative_type_alias: string;
}

// AlternativeVehicle existant : ajouter tier + champs catalogue
export interface AlternativeVehicle {
  type_id: string;
  type_name: string;
  type_alias: string | null;
  type_fuel: string;
  type_power_ps: string;
  type_year_from: string;
  type_year_to: string;
  modele_id: number;
  modele_name: string;
  modele_alias: string;
  marque_id: number;
  marque_name: string;
  marque_alias: string;
  tier: 1 | 2 | 3;
}

// AlternativeGamme existant : ajouter tier + piece_count
export interface AlternativeGamme {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  pg_pic: string | null;
  piece_count: number;
  tier: 1 | 2 | 3;
}

export interface NoProductsData {
  noProducts: true;
  gammeId: number;
  gammeAlias: string;
  gammeName: string;
  vehicleLabel: string;
  vehicleContext: VehicleContext;
  alternativeGammes: AlternativeGamme[];
  alternativeVehicles: AlternativeVehicle[];
  relatedModels: RelatedModel[];
}
```

- [ ] **Step 2: Vérifier que le typecheck passe (le composant body ne consomme pas encore les nouveaux champs)**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy/frontend && \
  npx tsc --noEmit 2>&1 | grep "NoProducts\|pieces-vehicle" | head -10
```

Expected: erreurs attendues côté loader (qui ne fournit pas encore `vehicleContext` ni `relatedModels`) — c'est le travail du Task 12.

- [ ] **Step 3: Commit partiel (types only)**

```bash
git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy add \
  frontend/app/components/pieces/NoProductsAlternatives.tsx

git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy commit -m "$(cat <<'EOF'
chore(pieces): extend NoProductsData type for v2 payload

Ajout VehicleContext, RelatedModel, tier sur AlternativeVehicle et
AlternativeGamme. Implémentation du rendu suit (Task 14).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Frontend — Loader parse v2 + beacon

**Files:**
- Modify: `frontend/app/utils/pieces-vehicle.loader.server.ts`

- [ ] **Step 1: Lire le bloc concerné (~lignes 240-310)**

Run:
```bash
sed -n '240,310p' /opt/automecanik/app-worktrees/soft-404-r2-strategy/frontend/app/utils/pieces-vehicle.loader.server.ts
```

- [ ] **Step 2: Adapter le parsing du fetch alternatives**

Remplacer le type local du fetch (~lignes 257-275 du fichier original) par :

```typescript
const alternativesData = await fetchJsonOrNull<{
  success: boolean;
  version?: 'v2';
  etag?: string;
  alternativeGammes: Array<{
    pg_id: number;
    pg_name: string;
    pg_alias: string;
    pg_pic: string | null;
    piece_count: number;
    tier: 1 | 2 | 3;
  }>;
  alternativeVehicles: Array<{
    type_id: string;
    type_name: string;
    type_alias: string | null;
    type_fuel: string;
    type_power_ps: string;
    type_year_from: string;
    type_year_to: string;
    modele_id: number;
    modele_name: string;
    modele_alias: string;
    marque_id: number;
    marque_name: string;
    marque_alias: string;
    tier: 1 | 2 | 3;
  }>;
  relatedModels: Array<{
    modele_id: number;
    modele_name: string;
    modele_alias: string;
    marque_id: number;
    marque_name: string;
    marque_alias: string;
    representative_type_id: string;
    representative_type_alias: string;
  }>;
}>(
  `http://127.0.0.1:3000/api/rm/alternatives?gamme_id=${gammeId}&type_id=${vehicleIds.typeId}&limit=12`,
);
```

- [ ] **Step 3: Construire `vehicleContext`**

Dans la branche `noProducts` (autour de la ligne 289), construire l'objet enrichi à partir des données véhicule déjà chargées en amont du loader :

```typescript
return {
  noProducts: true as const,
  gammeId,
  gammeAlias: gammeData.alias,
  gammeName: gammeData.name,
  vehicleLabel,
  vehicleContext: {
    marqueName: vehicleData.marque.marque_name,
    modeleName: vehicleData.modele.modele_name,
    typeName: vehicleData.type.type_name,
    typeFuel: vehicleData.type.type_fuel ?? '',
    typePowerPs: vehicleData.type.type_power_ps ?? '',
    yearFrom: vehicleData.type.type_year_from ?? '',
    yearTo: vehicleData.type.type_year_to ?? '',
  },
  alternativeGammes: alternativesData?.alternativeGammes ?? [],
  alternativeVehicles: alternativesData?.alternativeVehicles ?? [],
  relatedModels: alternativesData?.relatedModels ?? [],
} satisfies NoProductsData;
```

Si les noms des variables locales diffèrent (`vehicleData`, `gammeData`) : adapter au code existant en grep `vehicleLabel\|vehicleData\|gammeData` dans le fichier.

- [ ] **Step 4: Beacon serveur fire-and-forget**

Juste avant le `return` de la branche noProducts, ajouter :

```typescript
// Beacon télémétrie fire-and-forget (n'attend jamais)
void fetch('http://127.0.0.1:3000/api/rm/alternatives/track-soft-404', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'user-agent': request.headers.get('user-agent') ?? '',
    referer: request.headers.get('referer') ?? '',
  },
  body: JSON.stringify({ pg_id: gammeId, type_id: vehicleIds.typeId }),
}).catch(() => {
  /* swallow: jamais bloquant */
});
```

- [ ] **Step 5: Typecheck**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy/frontend && \
  npx tsc --noEmit 2>&1 | grep "pieces-vehicle.loader" | head -10
```

Expected: 0 erreur sur ce fichier.

- [ ] **Step 6: Commit**

```bash
git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy add \
  frontend/app/utils/pieces-vehicle.loader.server.ts

git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy commit -m "$(cat <<'EOF'
feat(pieces): loader parses alternatives v2 payload + soft-404 beacon

- Type fetch enrichi (tier, piece_count, relatedModels, vehicleContext)
- Beacon serveur fire-and-forget vers /api/rm/alternatives/track-soft-404
- Jamais bloquant : catch silencieux côté beacon

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Frontend — Meta dynamique + JSON-LD `ItemList`

**Files:**
- Modify: `frontend/app/utils/pieces-vehicle.meta.ts`
- Create: `frontend/tests/unit/pieces-vehicle-meta.test.ts`

- [ ] **Step 1: Test Vitest (TDD red)**

```typescript
// frontend/tests/unit/pieces-vehicle-meta.test.ts
import { describe, it, expect } from 'vitest';
import { buildPiecesVehicleMeta } from '~/utils/pieces-vehicle.meta';
import type { NoProductsData } from '~/components/pieces/NoProductsAlternatives';

const noProductsFixture: NoProductsData = {
  noProducts: true,
  gammeId: 3859,
  gammeAlias: 'kit-de-freins-arriere',
  gammeName: 'Kit de freins arrière',
  vehicleLabel: 'BMW Série 5 (F10-F18) 525 d',
  vehicleContext: {
    marqueName: 'BMW',
    modeleName: 'Série 5 (F10-F18)',
    typeName: '525 d',
    typeFuel: 'Diesel',
    typePowerPs: '218',
    yearFrom: '2011',
    yearTo: '2016',
  },
  alternativeGammes: [
    { pg_id: 3860, pg_name: 'Disques arrière', pg_alias: 'disques-arriere', pg_pic: null, piece_count: 42, tier: 1 },
  ],
  alternativeVehicles: [],
  relatedModels: [],
};

describe('buildPiecesVehicleMeta — soft-404 branch', () => {
  const meta = buildPiecesVehicleMeta(noProductsFixture, { pathname: '/pieces/kit-de-freins-arriere-3859/bmw-33/serie-5-f10-f18-33053/2-0-525-d-11836.html' } as any);

  it('inclut robots: noindex, follow', () => {
    expect(meta.find((m: any) => m.name === 'robots')?.content).toBe('noindex, follow');
  });

  it('title contient gamme + véhicule + motif "non référencé"', () => {
    const title = meta.find((m: any) => m.title)?.title as string;
    expect(title).toMatch(/Kit de freins arrière/);
    expect(title).toMatch(/BMW/);
    expect(title).toMatch(/non référencé|alternatives/i);
  });

  it('description évoque le véhicule complet et les alternatives', () => {
    const desc = meta.find((m: any) => m.name === 'description')?.content as string;
    expect(desc).toMatch(/525 d/);
    expect(desc).toMatch(/alternative/i);
  });

  it('émet un JSON-LD ItemList', () => {
    const ld = meta.find((m: any) => m['script:ld+json']);
    expect(ld).toBeDefined();
    const parsed = (ld as any)['script:ld+json'];
    expect(parsed['@type']).toBe('ItemList');
    expect(Array.isArray(parsed.itemListElement)).toBe(true);
  });

  it('og:title et og:description présents et cohérents', () => {
    const ogt = meta.find((m: any) => m.property === 'og:title')?.content;
    const ogd = meta.find((m: any) => m.property === 'og:description')?.content;
    expect(ogt).toBeTruthy();
    expect(ogd).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, attendre échec**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy/frontend && \
  npx vitest run tests/unit/pieces-vehicle-meta.test.ts 2>&1 | tail -20
```

Expected: FAIL (la fonction ne traite pas encore la branche soft-404).

- [ ] **Step 3: Étendre `buildPiecesVehicleMeta`**

Lire le fichier `pieces-vehicle.meta.ts` actuel, ajouter une branche "noProducts" qui détecte `data?.noProducts === true` et produit :

```typescript
// frontend/app/utils/pieces-vehicle.meta.ts
import type { NoProductsData } from '~/components/pieces/NoProductsAlternatives';
// ... imports existants ...

const SITE = 'AutoMecanik';

function buildSoft404Meta(data: NoProductsData, pathname: string) {
  const ctx = data.vehicleContext;
  const years = ctx.yearFrom && ctx.yearTo ? `${ctx.yearFrom}-${ctx.yearTo}` : ctx.yearFrom || ctx.yearTo;
  const ps = ctx.typePowerPs ? `${ctx.typePowerPs}ch ` : '';
  const fuel = ctx.typeFuel ? `${ctx.typeFuel} ` : '';
  const vehicleSuffix = `${ctx.marqueName} ${ctx.modeleName} ${ctx.typeName}${years ? ` (${years})` : ''}`.trim();

  const title = `${data.gammeName} non référencé pour ${vehicleSuffix} — Alternatives | ${SITE}`;
  const description = `Le ${data.gammeName.toLowerCase()} n'est pas référencé pour la ${ctx.marqueName} ${ctx.modeleName} ${ctx.typeName} ${ps}${fuel}${years ? `(${years})` : ''}. Découvrez les pièces compatibles et les autres motorisations qui disposent de ce produit.`.replace(/\s+/g, ' ').trim();

  const itemList: any[] = [];
  data.alternativeVehicles.slice(0, 6).forEach((v, i) => {
    itemList.push({
      '@type': 'ListItem',
      position: itemList.length + 1,
      name: `${data.gammeName} pour ${v.marque_name} ${v.modele_name} ${v.type_name}`,
      url: `/pieces/${data.gammeAlias}-${data.gammeId}/${v.marque_alias}-${v.marque_id}/${v.modele_alias}-${v.modele_id}/${v.type_alias ?? v.type_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${v.type_id}.html`,
    });
  });
  data.alternativeGammes.slice(0, 4).forEach((g) => {
    itemList.push({
      '@type': 'ListItem',
      position: itemList.length + 1,
      name: `${g.pg_name} pour ${ctx.marqueName} ${ctx.modeleName} ${ctx.typeName}`,
      url: `/pieces/${g.pg_alias}-${g.pg_id}.html`,
    });
  });

  return [
    { title },
    { name: 'description', content: description },
    { name: 'robots', content: 'noindex, follow' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `Alternatives ${data.gammeName} pour ${vehicleSuffix}`,
        itemListElement: itemList,
      },
    },
  ];
}

// Modifier la fonction principale exportée :
export const buildPiecesVehicleMeta: MetaFunction = ({ data, location }) => {
  if (data && (data as any).noProducts === true) {
    return buildSoft404Meta(data as NoProductsData, location?.pathname ?? '');
  }
  // ... logique existante pour la branche nominale (produits présents) ...
  // (ne pas modifier le chemin nominal)
};
```

- [ ] **Step 4: Run tests, vert**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy/frontend && \
  npx vitest run tests/unit/pieces-vehicle-meta.test.ts 2>&1 | tail -15
```

Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy add \
  frontend/app/utils/pieces-vehicle.meta.ts \
  frontend/tests/unit/pieces-vehicle-meta.test.ts

git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy commit -m "$(cat <<'EOF'
feat(pieces): soft-404 dynamic meta + JSON-LD ItemList

- Title/desc contextualisés (gamme + véhicule + motif "non référencé")
- robots: noindex, follow conservé
- og:title / og:description
- JSON-LD ItemList des alternatives (top 6 véhicules + top 4 gammes)
- 5 tests Vitest verts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Frontend — Refactor `NoProductsAlternatives` (3 blocs + lead capture)

**Files:**
- Modify: `frontend/app/components/pieces/NoProductsAlternatives.tsx`
- Create: `frontend/tests/unit/no-products-alternatives.test.tsx`

- [ ] **Step 1: Test Vitest (TDD red)**

```typescript
// frontend/tests/unit/no-products-alternatives.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createRemixStub } from '@remix-run/testing';
import { NoProductsAlternatives, type NoProductsData } from '~/components/pieces/NoProductsAlternatives';

function fixture(over: Partial<NoProductsData> = {}): NoProductsData {
  return {
    noProducts: true,
    gammeId: 3859,
    gammeAlias: 'kit-de-freins-arriere',
    gammeName: 'Kit de freins arrière',
    vehicleLabel: 'BMW Série 5 525 d',
    vehicleContext: {
      marqueName: 'BMW', modeleName: 'Série 5 (F10-F18)', typeName: '525 d',
      typeFuel: 'Diesel', typePowerPs: '218', yearFrom: '2011', yearTo: '2016',
    },
    alternativeVehicles: [
      { type_id: '11838', type_name: '530 d', type_alias: '3-0-530-d', type_fuel: 'Diesel',
        type_power_ps: '258', type_year_from: '2011', type_year_to: '2016',
        modele_id: 33053, modele_name: 'Série 5 (F10-F18)', modele_alias: 'serie-5-f10-f18',
        marque_id: 33, marque_name: 'BMW', marque_alias: 'bmw', tier: 1 },
    ],
    alternativeGammes: [
      { pg_id: 3860, pg_name: 'Disques arrière', pg_alias: 'disques-arriere', pg_pic: null, piece_count: 42, tier: 1 },
    ],
    relatedModels: [
      { modele_id: 33054, modele_name: 'Série 5 (G30-G31)', modele_alias: 'serie-5-g30-g31',
        marque_id: 33, marque_name: 'BMW', marque_alias: 'bmw',
        representative_type_id: '12345', representative_type_alias: '3-0-530-d-g30' },
    ],
    ...over,
  };
}

function renderWithRouter(data: NoProductsData) {
  const Stub = createRemixStub([{ path: '/', Component: () => <NoProductsAlternatives data={data} /> }]);
  return render(<Stub />);
}

describe('NoProductsAlternatives — 3 blocs', () => {
  it('rend H1 contextualisé', () => {
    const { container } = renderWithRouter(fixture());
    const h1 = container.querySelector('h1')!;
    expect(h1.textContent).toMatch(/Kit de freins arrière/);
    expect(h1.textContent).toMatch(/BMW|525/);
  });

  it('affiche le bloc véhicules frères en premier', () => {
    const { getByText } = renderWithRouter(fixture());
    expect(getByText(/motorisations|véhicules frères|autres motorisations/i)).toBeDefined();
  });

  it('affiche le bloc gammes compatibles', () => {
    const { getByText } = renderWithRouter(fixture());
    expect(getByText(/Disques arrière/)).toBeDefined();
  });

  it('affiche le bloc autres générations (relatedModels)', () => {
    const { getByText } = renderWithRouter(fixture());
    expect(getByText(/G30-G31|autres générations/i)).toBeDefined();
  });

  it('contient un lien lead capture /contact?ref=soft-404', () => {
    const { container } = renderWithRouter(fixture());
    const lead = container.querySelector('a[href^="/contact?ref=soft-404"]');
    expect(lead).not.toBeNull();
    expect(lead?.getAttribute('href')).toMatch(/gamme=3859/);
    expect(lead?.getAttribute('href')).toMatch(/type=/);
  });

  it('si relatedModels vide, bloc 3 absent', () => {
    const { queryByText } = renderWithRouter(fixture({ relatedModels: [] }));
    expect(queryByText(/autres générations/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, fail attendu**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy/frontend && \
  npx vitest run tests/unit/no-products-alternatives.test.tsx 2>&1 | tail -20
```

Expected: 5-6 tests FAIL (le composant ne rend pas encore les nouveaux blocs).

- [ ] **Step 3: Refactor du composant (3 blocs)**

Remplacer le corps de `NoProductsAlternatives` (lignes 47-159 du fichier original) en gardant les types ajoutés en Task 11. Structure cible :

```tsx
import { Link } from '@remix-run/react';
import { Search, ArrowRight, Car, Package, GitBranch, MessageSquare } from 'lucide-react';
import { memo } from 'react';
import { ErrorSearchBar } from '~/components/errors/ErrorSearchBar';
import { PopularCategories } from '~/components/errors/PopularCategories';

// ... interfaces (Task 11) ...

function buildGammeVehicleUrl(
  gamme: { pg_alias: string; pg_id: number },
  v: { type_id: string; type_alias: string | null; type_name: string;
       modele_id: number; modele_alias: string;
       marque_id: number; marque_alias: string },
): string {
  const gammeSlug = `${gamme.pg_alias}-${gamme.pg_id}`;
  const marqueSlug = `${v.marque_alias}-${v.marque_id}`;
  const modeleSlug = `${v.modele_alias}-${v.modele_id}`;
  const typeSlug = `${v.type_alias ?? v.type_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${v.type_id}`;
  return `/pieces/${gammeSlug}/${marqueSlug}/${modeleSlug}/${typeSlug}.html`;
}

function buildRelatedModelUrl(
  gamme: { pg_alias: string; pg_id: number },
  m: RelatedModel,
): string {
  return buildGammeVehicleUrl(gamme, {
    type_id: m.representative_type_id,
    type_alias: m.representative_type_alias,
    type_name: m.modele_name,
    modele_id: m.modele_id,
    modele_alias: m.modele_alias,
    marque_id: m.marque_id,
    marque_alias: m.marque_alias,
  });
}

export const NoProductsAlternatives = memo(function NoProductsAlternatives({
  data,
}: { data: NoProductsData }) {
  const gammeUrl = `/pieces/${data.gammeAlias}-${data.gammeId}.html`;
  const contactUrl = `/contact?ref=soft-404&gamme=${data.gammeId}&type=${
    data.alternativeVehicles[0]?.type_id ?? ''
  }`;
  const ctx = data.vehicleContext;
  const vehicleH1 = `${data.gammeName} — non référencé pour votre ${ctx.marqueName} ${ctx.modeleName} ${ctx.typeName}`;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-4">
              <Package className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{vehicleH1}</h1>
            <p className="text-lg text-gray-600 mb-4">
              Cette pièce n'est pas référencée pour votre véhicule. Découvrez les alternatives compatibles ci-dessous.
            </p>
            <Link to={gammeUrl} className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
              Voir tous les {data.gammeName.toLowerCase()}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="mb-8 max-w-2xl mx-auto">
            <ErrorSearchBar placeholder="Rechercher une pièce, un véhicule..." />
          </div>

          {/* Bloc 1 — Véhicules frères */}
          {data.alternativeVehicles.length > 0 && (
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Car className="w-5 h-5 mr-2 text-blue-500" />
                D'autres motorisations de la {ctx.marqueName} {ctx.modeleName} ont ce {data.gammeName.toLowerCase()}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.alternativeVehicles.map((v) => (
                  <Link
                    key={v.type_id}
                    to={buildGammeVehicleUrl({ pg_alias: data.gammeAlias, pg_id: data.gammeId }, v)}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-blue-50 hover:shadow-sm transition-all group"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700">
                        {v.marque_name} {v.modele_name}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        {v.type_name} · {v.type_power_ps}ch · {v.type_fuel}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Bloc 2 — Gammes compatibles */}
          {data.alternativeGammes.length > 0 && (
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Search className="w-5 h-5 mr-2 text-green-500" />
                D'autres pièces compatibles avec votre {ctx.marqueName} {ctx.modeleName} {ctx.typeName}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {data.alternativeGammes.map((g) => (
                  <Link
                    key={g.pg_id}
                    to={`/pieces/${g.pg_alias}-${g.pg_id}.html`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-green-50 hover:shadow-sm transition-all group"
                  >
                    {g.pg_pic && (
                      <img
                        src={`https://img.automecanik.com/gamme/${g.pg_pic}`}
                        alt={g.pg_name}
                        className="w-10 h-10 object-contain flex-shrink-0"
                        loading="lazy" width={40} height={40}
                      />
                    )}
                    <span className="text-sm font-medium text-gray-700 group-hover:text-green-700 line-clamp-2">
                      {g.pg_name}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Bloc 3 — Autres générations */}
          {data.relatedModels.length > 0 && (
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <GitBranch className="w-5 h-5 mr-2 text-purple-500" />
                Autres générations de {ctx.marqueName} {ctx.modeleName.replace(/\s*\([^)]+\)\s*/g, '')} qui proposent ce kit
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.relatedModels.map((m) => (
                  <Link
                    key={m.modele_id}
                    to={buildRelatedModelUrl({ pg_alias: data.gammeAlias, pg_id: data.gammeId }, m)}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-purple-50 hover:shadow-sm transition-all group"
                  >
                    <span className="text-sm font-medium text-gray-800 group-hover:text-purple-700">
                      {m.marque_name} {m.modele_name}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Lead capture */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6 mb-6 text-center">
            <MessageSquare className="w-8 h-8 mx-auto text-blue-500 mb-2" />
            <p className="text-sm text-gray-700 mb-3">
              Vous cherchez précisément un {data.gammeName.toLowerCase()} pour votre {ctx.marqueName} {ctx.modeleName} {ctx.typeName} ?
            </p>
            <Link
              to={contactUrl}
              className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700"
            >
              Décrivez votre besoin <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <PopularCategories title="Catégories populaires" columns={4} />
          </div>
        </div>
      </div>
    </div>
  );
});
```

- [ ] **Step 4: Run tests, vert**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy/frontend && \
  npx vitest run tests/unit/no-products-alternatives.test.tsx 2>&1 | tail -15
```

Expected: 6/6 PASS.

- [ ] **Step 5: Commit**

```bash
git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy add \
  frontend/app/components/pieces/NoProductsAlternatives.tsx \
  frontend/tests/unit/no-products-alternatives.test.tsx

git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy commit -m "$(cat <<'EOF'
feat(pieces): NoProductsAlternatives — 3 blocs hiérarchisés + lead capture

- Bloc 1 (PRIO) : motorisations frères même modèle/gen
- Bloc 2 : gammes compatibles pour ce véhicule
- Bloc 3 : autres générations qui proposent cette gamme
- Lead capture link /contact?ref=soft-404&gamme=&type=
- Conditionnement : un bloc vide ne s'affiche pas
- 6 tests Vitest verts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: CI — Fixtures + script d'assertion smoke

**Files:**
- Create: `scripts/ci/soft-404-fixtures.txt`
- Create: `scripts/ci/assert-soft-404.py`

- [ ] **Step 1: Fixtures**

Avant merge final, lancer cette requête pour confirmer 4 paires soft-404 supplémentaires (la 1 étant déjà connue) :

```sql
-- Requête pour générer 4 fixtures à compléter dans le fichier
SELECT t.type_alias || '-' || t.type_id AS type_slug,
       m.modele_alias || '-' || m.modele_id AS modele_slug,
       ma.marque_alias || '-' || ma.marque_id AS marque_slug,
       pg.pg_alias || '-' || pg.pg_id AS gamme_slug
FROM auto_type t
JOIN auto_modele m ON m.modele_id = t.type_modele_id::int
JOIN auto_marque ma ON ma.marque_id = m.modele_marque_id::int
CROSS JOIN pieces_gamme pg
WHERE t.type_display = '1' AND t.type_relfollow = '1'
  AND m.modele_display = 1 AND ma.marque_display = 1 AND pg.pg_display = '1'
  AND NOT EXISTS (SELECT 1 FROM pieces_relation_type r
                  WHERE r.rtp_type_id::int = t.type_id_i AND r.rtp_pg_id::int = pg.pg_id)
ORDER BY random()
LIMIT 4;
```

Créer le fichier `scripts/ci/soft-404-fixtures.txt` :

```
# Soft-404 fixtures (chaque ligne : URL relative à tester via curl)
# Format : /pieces/<gamme>/<marque>/<modele>/<type>.html
# Vérifié 2026-05-18.
/pieces/kit-de-freins-arriere-3859/bmw-33/serie-5-f10-f18-33053/2-0-525-d-11836.html
# À compléter pre-merge via la requête de génération ci-dessus :
# /pieces/...
# /pieces/...
# /pieces/...
# /pieces/...
```

- [ ] **Step 2: Script d'assertion Python**

```python
# scripts/ci/assert-soft-404.py
"""
Assertions soft-404 R2 page.

Usage:
  curl -s -i "http://localhost:3000/pieces/.../...html" | python3 scripts/ci/assert-soft-404.py

Critères :
  - HTTP 200
  - <meta name="robots" content="noindex, follow">
  - JSON-LD avec @type ItemList
  - Au moins 1 lien /pieces/ dans le bloc alternatives (non comptés : PopularCategories)
"""
import re
import sys
import json

raw = sys.stdin.buffer.read().decode("utf-8", errors="replace")

# Split entête / corps (curl -i)
if "\r\n\r\n" in raw:
    header, body = raw.split("\r\n\r\n", 1)
elif "\n\n" in raw:
    header, body = raw.split("\n\n", 1)
else:
    header, body = "", raw

errors = []

# 1. HTTP 200
m = re.search(r"HTTP/[\d.]+\s+(\d+)", header) if header else None
status = int(m.group(1)) if m else 200  # si pas d'entête, on accepte le body brut
if status != 200:
    errors.append(f"HTTP status {status} != 200")

# 2. robots noindex, follow
robots = re.search(r'<meta[^>]+name=["\']robots["\'][^>]+content=["\']([^"\']+)["\']', body, re.I)
if not robots:
    errors.append("meta robots manquant")
elif "noindex" not in robots.group(1).lower() or "follow" not in robots.group(1).lower():
    errors.append(f"meta robots != noindex,follow ({robots.group(1)})")

# 3. JSON-LD ItemList
ld_match = re.search(
    r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    body, re.S | re.I,
)
if not ld_match:
    errors.append("JSON-LD absent")
else:
    try:
        ld = json.loads(ld_match.group(1))
        if isinstance(ld, list):
            has_itemlist = any(item.get("@type") == "ItemList" for item in ld)
        else:
            has_itemlist = ld.get("@type") == "ItemList"
        if not has_itemlist:
            errors.append(f"JSON-LD présent mais @type != ItemList (got {ld.get('@type') if isinstance(ld, dict) else 'list'})")
    except json.JSONDecodeError as e:
        errors.append(f"JSON-LD invalide: {e}")

# 4. >= 1 lien interne /pieces/ hors PopularCategories
# Heuristique : on cherche au moins un href /pieces/<gamme>-<id>/<marque>/<modele>/<type>.html (avec slashs)
deep_links = re.findall(r'href=["\'](/pieces/[^"\']*?/[^"\']*?/[^"\']*?\.html)["\']', body)
if len(deep_links) == 0:
    errors.append("Aucun lien profond /pieces/.../.../...html (alternatives véhicules absentes)")

# Résultat
if errors:
    print("FAIL")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
print("PASS")
```

- [ ] **Step 3: Tester localement**

Run:
```bash
curl -s -i "http://localhost:3000/pieces/kit-de-freins-arriere-3859/bmw-33/serie-5-f10-f18-33053/2-0-525-d-11836.html" | \
  python3 /opt/automecanik/app-worktrees/soft-404-r2-strategy/scripts/ci/assert-soft-404.py
```

Expected: **FAIL** au début (le déploiement local n'a pas encore les changements pris en compte). Le passage vert arrivera après le rebuild local en Task 18.

- [ ] **Step 4: Commit**

```bash
git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy add \
  scripts/ci/soft-404-fixtures.txt \
  scripts/ci/assert-soft-404.py

git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy commit -m "$(cat <<'EOF'
ci(smoke): soft-404 R2 fixtures + assertions script

assert-soft-404.py : HTTP 200, robots noindex follow, JSON-LD ItemList,
>= 1 lien profond /pieces/.../.../...html. Stable, sans dépendance.
soft-404-fixtures.txt : 1 fixture confirmée + 4 à compléter pre-merge
via requête fournie.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: CI — Workflow `soft-404-smoke`

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Identifier où ajouter le job**

Run:
```bash
grep -nE "^  [a-z-]+:\s*$|name:" /opt/automecanik/app-worktrees/soft-404-r2-strategy/.github/workflows/ci.yml | head -30
```

Repérer un job qui démarre déjà le serveur (typiquement après `build`).

- [ ] **Step 2: Ajouter le job**

À la fin de la section `jobs:`, ajouter :

```yaml
  soft-404-smoke:
    name: 🩹 Soft-404 smoke
    runs-on: ubuntu-latest
    needs: [lint] # ou le job de build/test si dispo
    env:
      NODE_OPTIONS: "--max-old-space-size=4096"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: "npm"
      - run: npm ci
      - run: npm run build
      - name: Start server background
        run: |
          (npm run start &) && sleep 20
      - name: Run smoke assertions
        run: |
          set -e
          while IFS= read -r url; do
            [[ "$url" =~ ^# ]] && continue
            [[ -z "$url" ]] && continue
            echo "🔎 $url"
            curl -s -i "http://localhost:3000$url" | python3 scripts/ci/assert-soft-404.py
          done < scripts/ci/soft-404-fixtures.txt
```

> **Si le repo a déjà un job qui démarre le serveur + tourne d'autres smoke**, intégrer plutôt une step d'assertion dans ce job pour éviter de redémarrer. Grep `npm run start\|playwright\|smoke` dans le yaml.

- [ ] **Step 3: Validation YAML**

Run:
```bash
python3 -c "import yaml; yaml.safe_load(open('/opt/automecanik/app-worktrees/soft-404-r2-strategy/.github/workflows/ci.yml'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy add .github/workflows/ci.yml

git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy commit -m "$(cat <<'EOF'
ci: add soft-404 smoke job (5 fixtures, HTTP + meta + JSON-LD)

Job bloquant : asserte que les pages soft-404 R2 renvoient 200,
noindex+follow, JSON-LD ItemList et au moins un lien profond
/pieces/.../.../...html.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Validation locale bout-en-bout

- [ ] **Step 1: Stack locale**

Run:
```bash
cd /opt/automecanik/app && docker compose ps && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/health
```

Expected: `200`.

> Si la stack tourne sur le worktree principal `/opt/automecanik/app` (pas le worktree dédié) : appliquer un build incremental côté backend/frontend. Si HMR est actif (`npm run dev`), pas besoin de rebuild.

- [ ] **Step 2: Migration appliquée**

Run (Supabase MCP) :
```sql
-- vérifier que la table existe en DEV
SELECT to_regclass('public.__soft_404_events') AS exists_;
```

Si NULL → exécuter la migration via le pipeline de migration habituel (`backend/supabase/migrations`).

- [ ] **Step 3: Curl l'URL de référence et inspecter**

Run:
```bash
curl -s "http://localhost:3000/pieces/kit-de-freins-arriere-3859/bmw-33/serie-5-f10-f18-33053/2-0-525-d-11836.html" > /tmp/r8_after.html
echo "size=$(wc -c < /tmp/r8_after.html)"
grep -oE '<meta[^>]+name="robots"[^>]+>' /tmp/r8_after.html
grep -oE '"@type":\s*"ItemList"' /tmp/r8_after.html | head -1
grep -oE 'href="(/pieces/[^"]+/[^"]+/[^"]+\.html)"' /tmp/r8_after.html | head -5
```

Expected:
- size > 60_000
- meta robots `noindex, follow`
- `"@type":"ItemList"` présent
- ≥ 1 lien profond `/pieces/.../.../.../...html`

- [ ] **Step 4: Smoke assertions**

Run:
```bash
curl -s -i "http://localhost:3000/pieces/kit-de-freins-arriere-3859/bmw-33/serie-5-f10-f18-33053/2-0-525-d-11836.html" | \
  python3 /opt/automecanik/app-worktrees/soft-404-r2-strategy/scripts/ci/assert-soft-404.py
```

Expected: `PASS`.

- [ ] **Step 5: Test de l'endpoint v2 directement**

Run:
```bash
curl -s "http://localhost:3000/api/rm/alternatives?gamme_id=3859&type_id=11836&limit=12" | python3 -c "
import json,sys
d = json.load(sys.stdin)
print('version:', d.get('version'))
print('etag:', d.get('etag'))
print('vehicles:', len(d.get('alternativeVehicles', [])))
print('gammes:', len(d.get('alternativeGammes', [])))
print('related:', len(d.get('relatedModels', [])))
v = d.get('alternativeVehicles', [])
if v:
    print('top vehicle:', v[0]['marque_name'], v[0]['modele_name'], v[0]['type_name'], 'tier=', v[0]['tier'])
"
```

Expected:
- `version: v2`
- `etag: sha256-…`
- `top vehicle: BMW Série 5 (F10-F18) ...` (PAS Alfa Romeo)

- [ ] **Step 6: Vérifier le beacon a tracé**

Run (Supabase MCP) :
```sql
SELECT COUNT(*) AS hits, MAX(ts) AS last_seen
FROM __soft_404_events
WHERE pg_id = 3859 AND type_id = 11836 AND ts > now() - interval '5 minutes';
```

Expected: `hits >= 1`.

---

## Task 18: Validation — Lint / Build / Tests complets

- [ ] **Step 1: Lint backend + frontend**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy && \
  npm run lint 2>&1 | tail -30
```

Expected: 0 erreur.

- [ ] **Step 2: Tests backend (scope rm)**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy/backend && \
  npx jest src/modules/rm --no-coverage 2>&1 | tail -10
```

Expected: tous verts.

- [ ] **Step 3: Tests frontend (scope unit)**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy/frontend && \
  npx vitest run tests/unit/no-products-alternatives.test.tsx tests/unit/pieces-vehicle-meta.test.ts 2>&1 | tail -15
```

Expected: tous verts.

- [ ] **Step 4: Build complet**

Run:
```bash
cd /opt/automecanik/app-worktrees/soft-404-r2-strategy && \
  npm run build 2>&1 | tail -20
```

Expected: success, pas d'erreur TS.

---

## Task 19: PR + Self-review verdict

- [ ] **Step 1: Self-review checklist (cf. spec §7.4)**

Vérifier point par point avant push :

```
[ ] URL strictement préservée (curl -sI sur fixture renvoie 200 et même path)
[ ] noindex, follow conservé sur la page soft-404
[ ] Aucun secret hardcodé (grep -rE "key|secret|token|password" sur le diff)
[ ] Aucune nouvelle ENV var
[ ] Aucune ADR canon nouvelle dans le monorepo (vault PR séparée)
[ ] Spec et plan committés
[ ] Tests TDD verts
[ ] Smoke local PASS
[ ] Lint vert
[ ] Migration idempotente (CREATE IF NOT EXISTS, CREATE OR REPLACE VIEW)
```

- [ ] **Step 2: Push branche**

Run:
```bash
git -C /opt/automecanik/app-worktrees/soft-404-r2-strategy push -u origin feat/soft-404-r2-strategy
```

- [ ] **Step 3: Ouvrir la PR**

Run:
```bash
gh pr create --repo ak125/nestjs-remix-monorepo \
  --base main --head feat/soft-404-r2-strategy \
  --title "feat(seo): soft-404 R2 — multi-tier alternatives + JSON-LD ItemList + telemetry" \
  --body "$(cat <<'EOF'
## Summary

Refonte de la page R2-PRODUIT quand `count(pieces) = 0` :

- **Backend** : `RmAlternativesService` (multi-tier compat-aware, cache Redis 5min, etag sha256).
- **Frontend** : 3 blocs hiérarchisés (motorisations frères → gammes compatibles → autres générations) + lead capture link + JSON-LD ItemList.
- **Télémétrie** : table append-only `__soft_404_events` + vue 30j.
- **Smoke CI** : job bloquant sur 5 fixtures (200 + noindex,follow + ItemList + lien profond).
- URL strictement préservée, noindex,follow conservé.

## Spec et plan

- Spec : [docs/superpowers/specs/2026-05-18-soft-404-r2-strategy-design.md](docs/superpowers/specs/2026-05-18-soft-404-r2-strategy-design.md)
- Plan : [docs/superpowers/plans/2026-05-18-soft-404-r2-strategy.md](docs/superpowers/plans/2026-05-18-soft-404-r2-strategy.md)

## Test plan

- [x] `npm run lint` vert
- [x] Tests Jest backend (rm) verts
- [x] Tests Vitest frontend (pieces) verts
- [x] `scripts/ci/assert-soft-404.py` PASS sur fixture confirmée
- [x] `GET /api/rm/alternatives?gamme_id=3859&type_id=11836` retourne BMW (pas Alfa Romeo)
- [x] Beacon insère dans `__soft_404_events`

## Anti-régressions

- Pas de changement URL/slug/canonical ✓
- Pas de meta optimisée touchée (les meta avant étaient des placeholders dégradés) ✓
- Pas de nouvelle ENV var ✓
- Migration idempotente ✓

## Self-review verdict

APPROVE

## V1.5/V2 deferred (gate-on-evidence)

Cf. spec §9 — rien d'implémenté ici.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Mention vault PR séparée**

Dans un commentaire de la PR, ajouter :

> 📦 ADR léger + runbook télémétrie dans une PR vault séparée : `ak125/governance-vault#<n>` (à ouvrir).

---

## Vault (PR séparée, parallèle à la PR principale)

> **Ces tâches s'exécutent dans `/opt/automecanik/governance-vault/` sur sa propre branche** — pas dans le worktree monorepo.

### Task V1: ADR léger `ADR-soft-404-r2-strategy.md`

**Files:**
- Create: `governance-vault/ledger/decisions/adr/ADR-XXXX-soft-404-r2-strategy.md` (numéro libre attribué pre-merge)

- [ ] **Step 1: Écrire l'ADR**

Frontmatter selon canon vault v1.0.1 (cf. `governance-vault/templates/adr-template.md` si présent) :

```markdown
---
adr_id: ADR-XXXX
title: Soft-404 R2-PRODUIT strategy — multi-tier alternatives + ItemList + telemetry
status: accepted
date: 2026-05-18
owner: seo-platform
related: [ADR-016, ADR-022, ADR-026, ADR-031]
---

## Context
URL `/pieces/:gamme/:marque/:modele/:type.html` peut servir une page sans pièces (couple gamme×type vide dans `pieces_relation_type`). Pattern existant : page "Non disponible" + noindex, mais alternatives non-pertinentes (alphabétique, hors marque).

## Decision
Adopter un pattern soft-404 R2 unifié :
1. HTTP 200 + robots: noindex, follow.
2. Pas de canonical (anti-pattern Google sur noindex).
3. JSON-LD ItemList pour transfert de link-equity via crawl follow.
4. Ranking multi-tier compat-aware (modele_id > modele_parent > marque_id).
5. Télémétrie append-only `__soft_404_events` + vue 30j, ownership seo-platform.
6. Cache Redis 5min, etag sha256 sur canonical JSON (replay-safe).

## Consequences
- Page soft-404 devient hub de rebond mesurable.
- Demand-list pour le pôle catalogue via `v_soft_404_demand_30d`.
- Nouvelle surface op (1 table) provisionnée avec runbook + ownership.

## Alternatives considered
- Réécrire le code en page 404 : refusé (perte de link-equity, mauvaise UX).
- Canonicaliser vers `/pieces/:gamme.html` : refusé (signal contradictoire avec noindex).
- ML scoring sémantique : déferred V2 (gate-on-evidence).
```

- [ ] **Step 2: Self-review marker dans la PR body**

```
Self-review verdict: APPROVE
```

- [ ] **Step 3: Commit + PR sur ak125/governance-vault**

```bash
cd /opt/automecanik/governance-vault
git checkout -b adr/soft-404-r2-strategy
git add ledger/decisions/adr/ADR-XXXX-soft-404-r2-strategy.md
git commit -m "adr: soft-404 R2 strategy"
git push -u origin adr/soft-404-r2-strategy
gh pr create --title "adr: soft-404 R2 strategy" --body "Self-review verdict: APPROVE"
```

### Task V2: Runbook télémétrie

**Files:**
- Create: `governance-vault/runbooks/soft-404-telemetry.md`

- [ ] **Step 1: Écrire le runbook**

```markdown
# Runbook — Soft-404 telemetry

**Owner:** seo-platform  
**Table:** `__soft_404_events`  
**Vue:** `v_soft_404_demand_30d`  
**Rétention:** 90 jours (purge cron)

## Quoi
Table append-only des événements soft-404 (page R2 sans pièce compatible). Sert à mesurer la demande non couverte par le catalogue.

## Schéma
- pg_id (int), type_id (int), ts (timestamptz), referrer (text), ua_class (bot/browser/unknown).

## Requêtes utiles

### Demand-list catalogue (à pousser à l'équipe contenu)
SELECT * FROM v_soft_404_demand_30d LIMIT 50;

### Distribution UA (hygiène anti-bot)
SELECT ua_class, COUNT(*) FROM __soft_404_events WHERE ts > now()-interval '7 days' GROUP BY 1;

### Purge manuelle (au cas où le cron a sauté)
DELETE FROM __soft_404_events WHERE ts < now() - interval '90 days';

## Alarmes
- Volume `browser` >5000/jour sur 3 jours → escalade catalogue (demand-list pertinente).
- Volume `bot` >50% des hits → revoir les patterns UA.

## SLO associés
- Voir spec `docs/superpowers/specs/2026-05-18-soft-404-r2-strategy-design.md` §6.
```

- [ ] **Step 2: Commit + PR**

```bash
git -C /opt/automecanik/governance-vault add runbooks/soft-404-telemetry.md
git -C /opt/automecanik/governance-vault commit -m "runbook: soft-404 telemetry"
git -C /opt/automecanik/governance-vault push
gh pr create --title "runbook: soft-404 telemetry"
```

---

## Self-review du plan (à l'agent qui implémente)

Avant de marquer le plan terminé :

1. **Spec coverage** :
   - Spec §3.1 architecture → Tasks 6, 9, 12, 14 ✓
   - Spec §3.2 datamodel + migration → Task 1, 2 ✓
   - Spec §3.3 algorithme ranking → Task 6 ✓
   - Spec §3.4 cache Redis → Task 6 ✓
   - Spec §3.5 OTel : **partiellement couvert** — l'instrumentation OTel exacte dépend de l'infra du projet. Si la stack OTel est déjà en place sur d'autres services NestJS, l'agent réutilise `@Span()` / `tracer.startActiveSpan()` ; sinon, log fallback (le SLO sera mesuré via Redis metrics + access logs).
   - Spec §4 contrats API → Task 3 (DTO), Task 9 (controller) ✓
   - Spec §5 composants frontend → Tasks 11, 12, 13, 14 ✓
   - Spec §6 SLO → smoke CI Task 16 ✓ (les SLO p95 sont mesurés en prod, pas en CI)
   - Spec §7 sécurité → Zod validation, throttling, ua_class : Task 3, 7, 9 ✓
   - Spec §8 roll-out → Task 17, 18, 19 ✓

2. **Placeholder scan** : grep TBD/TODO/FIXME → seuls les 2 placeholders déclarés du spec (cluster catalogue, fixtures 2-5) restent, et ils sont des **action items pre-merge bloquants explicites**.

3. **Type consistency** : `AlternativeVehicle` / `AlternativeGamme` / `RelatedModel` identiques entre `dto/alternatives-v2.dto.ts` et `NoProductsAlternatives.tsx`. `compute(type_id, pg_id, limit)` signature identique entre service, tests, controller. `vehicleContext` shape identique entre loader, meta, composant. ✓

---

## Plan complet et sauvegardé

Fichier : `docs/superpowers/plans/2026-05-18-soft-404-r2-strategy.md`

### Deux options d'exécution

**1. Subagent-Driven (recommandé)** — Je dispatche un subagent par tâche, review entre chaque, itération rapide. Skill : `superpowers:subagent-driven-development`.

**2. Inline Execution** — J'exécute les tâches en série dans cette session avec checkpoints. Skill : `superpowers:executing-plans`.

Lequel choisis-tu ?
