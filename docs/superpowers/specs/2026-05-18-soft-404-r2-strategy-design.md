# Soft-404 R2-PRODUIT — Stratégie best-in-class V1

- **Date** : 2026-05-18
- **Owner** : @fafa (SEO platform)
- **Scope** : route Remix `/pieces/:gamme/:marque/:modele/:type.html` lorsque le couple `(type_id, pg_id)` retourne 0 pièce compatible
- **Status** : design approuvé, plan d'implémentation à rédiger (`writing-plans` skill)
- **Branche** : `feat/soft-404-r2-strategy` (worktree `/opt/automecanik/app-worktrees/soft-404-r2-strategy`)
- **URL canonique préservée** : `/pieces/:gamme/:marque/:modele/:type.html` (mémoire `feedback_no_url_changes_ever`)

---

## 1. Contexte et problème

### 1.1 Observation terrain

URL de référence vérifiée le 2026-05-18 :
`/pieces/kit-de-freins-arriere-3859/bmw-33/serie-5-f10-f18-33053/2-0-525-d-11836.html`

- HTTP 200, 313 ms, 61 KB ✓
- `robots: noindex, follow` ✓ (correct)
- Véhicule canonique : BMW 525d F10/F18 218 ps Diesel 2011-2016, `type_display='1'`, `type_relfollow='1'`
- Gamme canonique : `kit-de-freins-arriere` (pg_id 3859), `pg_display='1'`, `gamme_universelle=false`
- RPC `get_pieces_for_type_gamme[_v2/v3/v4](11836, 3859)` → `count: 0`, `pieces: []`, `blocs: []`
- Relation brute `pieces_relation_type(rtp_type_id=11836, rtp_pg_id=3859)` = **0 ligne**

Le triplet véhicule existe et est SEO-éligible, mais le catalogue n'a aucune référence pour ce couple précis. Le type 11836 dispose pourtant de 19 403 relations sur 356 gammes ; la gamme 3859 couvre 6 772 autres types. C'est un trou ciblé.

### 1.2 État actuel du rendu

Le composant `NoProductsAlternatives` (`frontend/app/components/pieces/NoProductsAlternatives.tsx`, 159 lignes) est déjà câblé en fallback du loader. Il propose un header, une barre de recherche, deux blocs d'alternatives et `PopularCategories`. Le squelette structurel est sain.

Les défauts observés portent sur la **qualité de la donnée injectée** par `/api/rm/alternatives` :

- `alternativeGammes` : retournées par ordre alphabétique (`Agregat de freinage`, `Alternateur`, `Amortisseur`, …) **sans filtre de compatibilité réelle** avec le type 11836.
- `alternativeVehicles` : retournent ALFA ROMEO 145 au lieu de motorisations BMW Série 5 F10 (528d, 530d, 535d…) ou d'autres BMW Série 5 (E60, G30).
- Aucun JSON-LD `ItemList` n'est émis : Google crawle en `follow` mais ne dispose d'aucun signal structuré pour propager la link-equity.
- Aucune télémétrie : impossible de connaître le volume de soft-404, leur distribution, ni le rebond utilisateur.
- Aucune capture de demande commerciale (lead).

### 1.3 Cause racine

Une logique d'alternatives non compat-aware (probable jointure sans `EXISTS pieces_relation_type`) et un ranking absent (pas de pondération de proximité catalogue). Le composant est un récipient correct, le ranking est en chocolat.

---

## 2. Objectifs et non-objectifs

### 2.1 Objectifs (V1)

1. **Ranking moderne, compat-aware, déterministe** des alternatives véhicules / gammes / modèles.
2. **Indexation propre** : maintien `noindex, follow` + JSON-LD `ItemList` pour transfert de link-equity.
3. **Layout 3-blocs hiérarchisés** : motorisations frères → gammes compatibles → autres générations.
4. **Lead capture inline** : lien `/contact?ref=soft-404&gamme={pg_id}&type={type_id}` — route `frontend/app/routes/contact.tsx` existante (vérifié 2026-05-18, ne lit pas encore les querystrings côté loader). V1 : querystrings utilisées uniquement pour analytics (tracking d'attribution) ; le formulaire de contact reste vide. V1.5 deferred : extension `contact.tsx` loader pour pré-remplir le subject à partir des querystrings (≤10 lignes), gate-on-evidence si le taux de soumission est suffisant.
5. **Télémétrie minimale append-only** : table `__soft_404_events` + vue `v_soft_404_demand_30d`, pour alimenter la roadmap catalogue.
6. **SLO p95 < 200 ms** sur `/api/rm/alternatives` + cache Redis 5 min + OTel span.
7. **Aucune modification d'URL, de slug, de canonical, de meta optimisée existante.**

### 2.2 Non-objectifs (deferred V1.5 / V2, gate-on-evidence)

- Tier 4 cross-brand (Audi A6, Mercedes Classe E mêmes specs).
- Drawer form Conform pour devis personnalisé.
- Dashboard Grafana de soft-404.
- Worker cron de demand-list pour le pôle catalogue.
- A/B copy testing via GrowthBook.
- Embeddings sémantiques pour clustering inter-gammes.
- Pages "soft-404 gamme seule" (`/pieces/:gamme.html` vide) : hors scope, ce design ne couvre que R2.

### 2.3 Principes non négociables

- **Pas de bricolage** : ranking en tiers explicites + JSON canonical + replay-safe.
- **Single-write-path** : un seul endpoint d'alternatives (`/api/rm/alternatives`), un seul composant Remix.
- **Forensic strict read-only sur les tables catalogue** : aucune écriture dans `pieces_relation_type`, `auto_*`, `pieces_gamme`.
- **No new ENV var** : on réutilise `SUPABASE_*` et `REDIS_URL`.
- **Une seule surface nouvelle (table télémétrie) = dette opérationnelle provisionnée** (ownership + retention + runbook).

---

## 3. Architecture cible

### 3.1 Diagramme de flux

```
Browser
  │
  ▼ GET /pieces/:gamme/:marque/:modele/:type.html
Remix loader (pieces-vehicle.loader.server.ts)
  │
  ├── RPC get_pieces_for_type_gamme_v4(type_id, pg_id) → count
  │       └── count > 0 → PiecesVehicleContent (chemin nominal, hors scope)
  │       └── count = 0 → branche "noProducts"
  │
  ▼ branche noProducts
fetch /api/rm/alternatives?gamme_id=&type_id=&limit=N
  │
  ▼
RmAlternativesService.compute(type_id, pg_id)
  │
  ├── Tier resolver : load auto_type, auto_modele (parent), auto_marque
  ├── Compat filter : EXISTS pieces_relation_type
  ├── Score & sort : tier weight × proximity × popularity
  └── Canonical JSON output (fast-json-stable-stringify) → sha256
  │
  ▼ Redis SET alt:{type_id}:{pg_id}:v1 ex=300 (5 min)
  │
  ▼ Response { alternativeVehicles, alternativeGammes, relatedModels, etag }
  │
Loader assemble NoProductsData → composant NoProductsAlternatives
  │
  ▼ rendu HTML
   - JSON-LD ItemList (top 10 alternatives)
   - 3 blocs (vehicles tier1+2, gammes, relatedModels)
   - Lead-capture link
   - Beacon POST /api/rm/track-soft-404 (fire-and-forget, sendBeacon)
```

### 3.2 Modèle de données

#### 3.2.1 Lecture (sans modification de schéma)

| Table / Fonction | Usage | Mode |
|---|---|---|
| `auto_type` | Charger `type_modele_id`, `type_fuel`, `type_power_ps`, `type_year_from/to` | Read-only |
| `auto_modele` | Charger `modele_marque_id`, `modele_parent`, alias | Read-only |
| `auto_marque` | Charger alias, display | Read-only |
| `pieces_gamme` | Charger cluster gamme (à introduire en V1.5, fallback liste statique en V1) | Read-only |
| `pieces_relation_type` | Filtre dur `EXISTS` sur tous les candidats | Read-only |
| `get_pieces_for_type_gamme_v4` | Confirme `count=0` côté loader | RPC existant |

#### 3.2.2 Écriture (1 migration unique)

```sql
-- backend/supabase/migrations/<ts>_soft_404_events.sql
BEGIN;

CREATE TABLE __soft_404_events (
  id        bigserial PRIMARY KEY,
  pg_id     integer NOT NULL,
  type_id   integer NOT NULL,
  ts        timestamptz NOT NULL DEFAULT now(),
  referrer  text,
  ua_class  text NOT NULL CHECK (ua_class IN ('bot', 'browser', 'unknown'))
);

CREATE INDEX idx_soft404_pair_ts ON __soft_404_events(pg_id, type_id, ts DESC);
CREATE INDEX idx_soft404_ts ON __soft_404_events(ts) WHERE ua_class = 'browser';

CREATE VIEW v_soft_404_demand_30d AS
SELECT
  pg_id,
  type_id,
  COUNT(*) AS hits,
  MAX(ts)  AS last_seen
FROM __soft_404_events
WHERE ts > now() - interval '30 days'
  AND ua_class = 'browser'
GROUP BY 1, 2
HAVING COUNT(*) >= 3
ORDER BY hits DESC;

COMMENT ON TABLE __soft_404_events IS 'Soft-404 R2 telemetry, append-only, 90d retention (cron purge). Ownership: seo-platform. ADR-soft-404-r2-strategy.';

COMMIT;
```

Cron purge journalier (à placer dans le scheduler existant de `seo-routines`, pas de nouvelle infra) :
```sql
DELETE FROM __soft_404_events WHERE ts < now() - interval '90 days';
```

#### 3.2.3 Ownership

Ajout à `audit/ownership.yaml` (mémoire `feedback_no_broad_migration_glob_in_ownership` — pas de glob, feature-scoped) :

```yaml
- path: "backend/supabase/migrations/*_soft_404_events.sql"
  domain: D-seo-platform
  owner: "@seo-platform"
  reason: "Soft-404 R2 telemetry table"
```

### 3.3 Algorithme de ranking

#### 3.3.1 Alt-véhicules (top 6)

```typescript
type Tier = 1 | 2 | 3;

const TIER_WEIGHT: Record<Tier, number> = { 1: 1.0, 2: 0.8, 3: 0.5 };

interface CandidateVehicle {
  type_id: number;
  modele_id: number;
  marque_id: number;
  modele_parent: number | null;
  power_ps: number;
  fuel: string;
  tier: Tier;       // 1 = same modele_id, 2 = same modele_parent, 3 = same marque_id
}

// Étape 1 : récupérer tous les types compatibles via EXISTS
//   SELECT t.type_id, t.type_modele_id::int AS modele_id, ...
//   FROM auto_type t
//   JOIN auto_modele m ON m.modele_id = t.type_modele_id::int
//   WHERE t.type_display = '1' AND t.type_relfollow = '1'
//     AND EXISTS (SELECT 1 FROM pieces_relation_type r
//                 WHERE r.rtp_type_id::int = t.type_id_i AND r.rtp_pg_id::int = $pg_id)
//     AND m.modele_marque_id = $marque_id_target
//
// Étape 2 : tier par proximité catalogue
//   tier = 1 si t.type_modele_id::int == $modele_id_target
//   tier = 2 si m.modele_id == $modele_parent_target
//   tier = 3 sinon (même marque)
//
// Étape 3 : score = TIER_WEIGHT[tier]
//                 * (1 - |power_ps - target_power| / 500)  // proximité puissance
//                 * popularity_boost(type_id)              // log(count(pieces_relation_type))
//
// Étape 4 : tri score DESC, type_id ASC stable, dedup par modele_id, limit 6
```

#### 3.3.2 Alt-gammes (top 8)

```typescript
// Étape 1 : récupérer toutes les gammes compatibles avec ce type_id
//   SELECT pg.pg_id, pg.pg_name, pg.pg_alias, pg.pg_pic, pg.pg_top,
//          COUNT(r.*) AS piece_count
//   FROM pieces_gamme pg
//   JOIN pieces_relation_type r ON r.rtp_pg_id::int = pg.pg_id
//   WHERE pg.pg_display = '1' AND r.rtp_type_id::int = $type_id
//   GROUP BY pg.pg_id, ...
//
// Étape 2 : cluster proximity (V1 = liste statique en code, V1.5 = colonne pg_cluster)
//   Cluster freinage (pg_id 3859 → 3860 disques-arr, 3861 plaquettes-arr, 3862 etrier-arr, ...)
//   tier = 1 si gamme dans le même cluster
//   tier = 2 si gamme parent (système freinage complet)
//   tier = 3 sinon
//
// Étape 3 : score = TIER_WEIGHT[tier]
//                 * log(1 + piece_count)
//                 * (pg_top === '1' ? 1.2 : 1.0)
//
// Étape 4 : tri score DESC, pg_id ASC stable, limit 8
```

**V1 cluster source** : constante TypeScript `GAMME_CLUSTERS` colocalisée avec le service. Squelette à 7 clusters macros (freinage, allumage, distribution, filtration, refroidissement, suspension, transmission), structure :

```typescript
export const GAMME_CLUSTERS: Record<string, { parent_pg_id: number; member_pg_ids: number[] }> = {
  "freinage-arriere": { parent_pg_id: <à confirmer>, member_pg_ids: [3859, /* disques-arr, plaquettes-arr, etrier-arr */] },
  // ... 6 autres clusters
};
```

**Action pre-merge bloquante** : peuplement exact des `member_pg_ids` validé par le pôle catalogue via une requête SQL forensique (top-30 gammes par `pieces_relation_type` count + analyse sémantique des `pg_name`). Non-bloquant si quelques clusters restent partiels : un cluster vide retombe simplement sur Tier 3 (gammes populaires) — dégradation gracieuse, jamais d'erreur.

**V1.5 cluster source** (gate-on-evidence) : colonne `pg_cluster TEXT` ajoutée à `pieces_gamme` si la liste statique TypeScript devient ingérable ou si l'analyse `v_soft_404_demand_30d` montre des clusters majeurs manquants.

#### 3.3.3 Modèles frères (top 4, nouveau bloc)

```typescript
// Autres générations de la même marque qui proposent cette gamme
//   SELECT DISTINCT m.modele_id, m.modele_name, m.modele_alias
//   FROM auto_modele m
//   WHERE m.modele_marque_id = $marque_id_target
//     AND m.modele_id != $modele_id_target
//     AND m.modele_display = 1
//     AND EXISTS (SELECT 1 FROM auto_type t
//                 JOIN pieces_relation_type r ON r.rtp_type_id::int = t.type_id_i
//                 WHERE t.type_modele_id::int = m.modele_id AND r.rtp_pg_id::int = $pg_id)
//
// Ranking : modele_year DESC (générations récentes en premier), limit 4
```

**URL générée** : pas de route R3 dédiée (`pieces.$gamme.$marque.$modele.html.tsx` n'existe pas dans `frontend/app/routes/`). On retombe sur la route R2 existante avec un **type représentatif** du modèle frère, calculé en backend comme suit :

```sql
-- Type représentatif = type le plus relié dans pieces_relation_type pour ce modele × pg
SELECT t.type_id, t.type_alias, t.type_name
FROM auto_type t
JOIN pieces_relation_type r ON r.rtp_type_id::int = t.type_id_i
WHERE t.type_modele_id::int = $sibling_modele_id
  AND r.rtp_pg_id::int = $pg_id
  AND t.type_display = '1'
GROUP BY t.type_id, t.type_alias, t.type_name
ORDER BY COUNT(*) DESC, t.type_id ASC
LIMIT 1
```

URL finale : `/pieces/{gamme-alias-id}/{marque-alias-id}/{sibling-modele-alias-id}/{representative-type-alias-id}.html`. Garantit un atterrissage sur une page R2 peuplée (puisque le type représentatif a au moins une `pieces_relation_type` pour ce `pg_id`).

### 3.4 Cache Redis

```
Clé    : alt:{type_id}:{pg_id}:v1
Valeur : JSON canonical (fast-json-stable-stringify) + champ "etag" = sha256 du payload
TTL    : 300 secondes (5 min)
Mode   : cache-aside, miss → compute → set
Invalidation : passive (TTL). Pas de bus d'invalidation V1.
```

Justification du TTL court : les alternatives reflètent l'état du catalogue ; un enrichissement (ajout de `pieces_relation_type`) doit se propager rapidement. 5 min ≈ équilibre charge/fraîcheur.

### 3.5 OTel & logs

- Span `soft_404.alternatives.compute` avec attributs `type_id`, `pg_id`, `tier_counts`, `cache_hit`.
- Span `soft_404.track` pour le beacon.
- Pas de log structuré custom : OTel suffit (mémoire `feedback_no_bricolage_clean_layer`).

---

## 4. Contrats d'API

### 4.1 `GET /api/rm/alternatives` v2

**Query params** :
- `gamme_id` (int, required)
- `type_id` (int, required)
- `limit` (int, optional, default 12)

**Response 200** :
```json
{
  "success": true,
  "version": "v2",
  "etag": "sha256-...",
  "alternativeVehicles": [
    {
      "type_id": "11838",
      "type_name": "530 d",
      "type_alias": "3-0-530-d",
      "type_fuel": "Diesel",
      "type_power_ps": "258",
      "type_year_from": "2011",
      "type_year_to": "2016",
      "modele_id": 33053,
      "modele_name": "Série 5 (F10-F18)",
      "modele_alias": "serie-5-f10-f18",
      "marque_id": 33,
      "marque_name": "BMW",
      "marque_alias": "bmw",
      "tier": 1
    }
  ],
  "alternativeGammes": [
    {
      "pg_id": 3860,
      "pg_name": "Disques de frein arrière",
      "pg_alias": "disques-de-frein-arriere",
      "pg_pic": "disques-de-frein-arriere.png",
      "piece_count": 142,
      "tier": 1
    }
  ],
  "relatedModels": [
    {
      "modele_id": 33054,
      "modele_name": "Série 5 (G30-G31)",
      "modele_alias": "serie-5-g30-g31",
      "marque_id": 33,
      "marque_name": "BMW",
      "marque_alias": "bmw"
    }
  ]
}
```

Versionnage : `version: "v2"` côté payload, route URL inchangée. Compatibilité descendante non requise (un seul consommateur, le loader Remix).

### 4.2 `POST /api/rm/track-soft-404`

**Body** :
```json
{ "pg_id": 3859, "type_id": 11836 }
```

**Comportement** :
- Insert append-only dans `__soft_404_events`.
- `ua_class` dérivé serveur depuis `User-Agent` (tokens : `bot` si `Googlebot|bingbot|...`, `browser` si UA navigateur connu, `unknown` sinon — règle simple, pas de fingerprinting).
- `referrer` capté depuis `Referer` header.
- Throttling : limite 1 insert / session / minute (clé Redis `track-soft-404:{session_id}` TTL 60s).
- Response 204 No Content (fire-and-forget côté client via `navigator.sendBeacon`).

### 4.3 Smoke test CI

`.github/workflows/ci.yml` ajoute un job `soft-404-smoke`. Fixtures à valider en pre-merge (5 paires `(type_id, pg_id)` aujourd'hui connues vides, à reconfirmer avant merge via requête `WHERE NOT EXISTS pieces_relation_type`) :

| # | URL | type_id | pg_id |
|---|-----|---------|-------|
| 1 | `/pieces/kit-de-freins-arriere-3859/bmw-33/serie-5-f10-f18-33053/2-0-525-d-11836.html` | 11836 | 3859 |
| 2 | `<à compléter pre-merge>` | — | — |
| 3 | `<à compléter pre-merge>` | — | — |
| 4 | `<à compléter pre-merge>` | — | — |
| 5 | `<à compléter pre-merge>` | — | — |

```bash
for url in $(cat scripts/ci/soft-404-fixtures.txt); do
  curl -s "http://localhost:3000${url}" | python3 scripts/ci/assert-soft-404.py
done
```

Assertions :
- HTTP 200
- `<meta name="robots" content="noindex, follow">` présent
- `<script type="application/ld+json">` contenant `"@type":"ItemList"` présent
- Au moins 1 lien `/pieces/...` dans le bloc alternatives (≠ PopularCategories)

---

## 5. Composants Remix

### 5.1 `NoProductsAlternatives.tsx` (refonte)

Structure (3 blocs au lieu de 2) :

```tsx
<main>
  <Bandeau status />                             // H1 + sous-titre contextualisés
  <ErrorSearchBar />                             // existant
  <BlocVehiculesFreres   data={tier1+2} />       // NOUVEAU PRIORITAIRE
  <BlocGammesCompatibles data={gammes} />        // renommé
  <BlocModelesFreres     data={relatedModels} /> // NOUVEAU
  <LeadCaptureInline />                          // NOUVEAU (Link, pas form)
  <PopularCategories />                          // existant fallback
</main>
```

Tous les sous-blocs sont des composants enfants colocalisés dans le même fichier (cohérence avec le pattern existant). Si le fichier dépasse ~300 lignes, on extrait en `NoProductsAlternatives/` directory.

### 5.2 `pieces-vehicle.meta.ts`

Ajoute :
- `title` dynamique avec contexte véhicule + gamme + statut "non référencé"
- `description` dynamique invitant aux alternatives
- `og:title`, `og:description`, `og:image` cohérents
- `<script type="application/ld+json">` `ItemList` des 10 premières alternatives (mix vehicles + gammes)

`robots: noindex, follow` est confirmé conservé.

### 5.3 `pieces-vehicle.loader.server.ts`

Adaptations :
- Appel `/api/rm/alternatives` reste sur même URL, parse le payload v2.
- Passe `relatedModels` au composant via `NoProductsData` étendu.
- Émet le beacon serveur-side via `fetch` non-await (`void this.trackSoftFourOhFour(...)`) — fire-and-forget, jamais bloquant le rendu (mémoire `backend.md` "non-blocking onModuleInit" applicable au pattern).

### 5.4 Type `NoProductsData` étendu

```typescript
export interface NoProductsData {
  noProducts: true;
  gammeId: number;
  gammeAlias: string;
  gammeName: string;
  vehicleLabel: string;
  vehicleContext: {                          // NOUVEAU
    marqueName: string;
    modeleName: string;
    typeName: string;
    typeFuel: string;
    typePowerPs: string;
    yearFrom: string;
    yearTo: string;
  };
  alternativeGammes: AlternativeGamme[];
  alternativeVehicles: AlternativeVehicle[];
  relatedModels: RelatedModel[];             // NOUVEAU
}
```

---

## 6. SLO et observabilité

| Métrique | Cible V1 | Source | Alarme |
|---|---|---|---|
| p95 `/api/rm/alternatives` | < 200 ms | OTel | warn > 250 ms 5 min |
| Cache hit ratio Redis | > 70% | Redis INFO | warn < 50% 1 h |
| Couverture alternatives (≥1 véhicule OU ≥1 gamme) | > 95% | Smoke CI sur fixtures | block PR si < 95% |
| Soft-404 page rendu | 200 + noindex,follow + ItemList | Synthetic Playwright | block PR si fail |
| Beacon error rate | < 1% | OTel `soft_404.track` | warn > 5% 5 min |

**UA crawler synthetic** : `AutoMecanikSoft404Crawler/1.0 (+https://automecanik.com/bots)` — identifiable, jamais Googlebot spoof (mémoire `feedback_synthetic_bot_ua_never_spoof_googlebot`).

---

## 7. Sécurité et gouvernance

### 7.1 Surface d'attaque

- `POST /api/rm/track-soft-404` : pas d'auth requise (page publique), throttling 1/min/session via Redis, validation Zod stricte `{ pg_id: z.number().int().positive(), type_id: z.number().int().positive() }`.
- Aucune fuite de données catalogue : seuls `pg_id`/`type_id` (publics dans l'URL) sont enregistrés.
- Pas de cookie session créé côté beacon (utilise le cookie existant si présent).

### 7.2 RGPD

- `referrer` peut contenir un domaine externe → conservé 90 jours, pas d'IP, pas d'UA brut (seul `ua_class` ∈ {`bot`, `browser`, `unknown`}).
- Vue `v_soft_404_demand_30d` n'expose aucune donnée nominative.
- Documentation politique de rétention dans le runbook (`governance-vault/runbooks/soft-404-telemetry.md`).

### 7.3 Governance vault

- **ADR léger** dans `governance-vault/ledger/decisions/adr/ADR-soft-404-r2-strategy.md` (numéro libre attribué au moment de la PR vault) actant :
  - Pattern noindex+follow+ItemList pour soft-404 R2.
  - Multi-tier ranking compat-aware.
  - Télémétrie append-only avec ownership `seo-platform`.
- PR vault séparée du monorepo (mémoire `vault-flow-direction` + `feedback_vault_self_review_before_admin_merge`).

### 7.4 Self-review obligatoire

Avant merge :
- [ ] Marker `Self-review verdict: APPROVE` dans PR body.
- [ ] Checklist 8 items (mémoire `feedback_vault_self_review_before_admin_merge`).
- [ ] Aucun secret hardcodé.
- [ ] Aucune nouvelle ENV var.
- [ ] Aucune ADR canon nouvelle dans le monorepo (uniquement référence vault).

---

## 8. Plan de roll-out

### 8.1 Étapes (1 PR atomique)

1. Migration SQL `__soft_404_events` (incluant baseline si nécessaire, mémoire `feedback_migration_engine_baseline_pattern`).
2. Service backend `RmAlternativesService` (refonte interne, route stable).
3. Controller : ajout endpoint `POST /api/rm/track-soft-404`.
4. Composant frontend `NoProductsAlternatives.tsx` (3 blocs + lead capture).
5. `pieces-vehicle.meta.ts` (title/desc/og/ItemList).
6. `pieces-vehicle.loader.server.ts` (parse v2 + beacon).
7. `audit/ownership.yaml` (entry table télémétrie).
8. `.github/workflows/ci.yml` (smoke test soft-404).
9. ADR vault (PR séparée).

### 8.2 Critères de merge

- Tous les checks CI verts.
- Smoke test soft-404 passe sur les 5 fixtures.
- p95 mesuré local < 200 ms sur les 5 fixtures.
- Self-review verdict APPROVE.
- Évidence empirique : capture de l'URL de référence avant/après (HTML diff + lighthouse).

### 8.3 Rollback

- Pas de feature flag V1 (page de fallback, pas un nouveau parcours critique).
- En cas d'incident : revert PR (branche protected, mémoire `feedback_rollback_via_revert_pr_branch_protected`).
- La table `__soft_404_events` reste en place après revert (sans consommateur) ; suppression à la prochaine migration housekeeping.

### 8.4 Post-déploiement (J+7)

Métriques à vérifier sur préprod 49.12.233.2:3200 puis DEV 46.224.118.55 :
- Couverture alternatives mesurée sur 100 paires soft-404 réelles : ≥ 95%.
- `v_soft_404_demand_30d` montre une distribution non triviale (au moins 10 couples avec hits ≥ 3).
- p95 latence backend < 200 ms confirmé.

---

## 9. Roadmap deferred (gate-on-evidence)

Aucune phase optionnelle implémentée V1 (mémoire `feedback_optional_phase_must_be_evidence_driven`). Les phases ci-dessous sont **non planifiées** ; activées uniquement sur evidence chiffrée.

| Phase | Trigger | Surface |
|---|---|---|
| V1.5 — `/contact` loader lit `?gamme=&type=` et pré-remplit le subject | CTR `/contact` > 0,5% mais conversion < 10% | `frontend/app/routes/contact.tsx` (≤10 lignes) |
| V1.5 — Drawer form Conform inline | CTR `/contact` < 0,5% après 14 jours | Frontend uniquement |
| V1.5 — Colonne `pg_cluster` | Liste statique TS jugée incomplète après audit catalogue | Migration DDL + UPDATE seeds |
| V1.5 — Tier 4 cross-brand | Vue `v_soft_404_demand_30d` montre concentration sur véhicules sans frères même marque | Service backend |
| V2 — Grafana board | Volume hits/jour > 1 000 | Dashboard + alerting |
| V2 — Worker cron demand-list | Catalogue ops demande priorisation auto | Cron + endpoint admin |
| V2 — A/B copy testing | Conversion < attendu | GrowthBook |

---

## 10. Références

### 10.1 Mémoires applicables

- `feedback_no_url_changes_ever` — URL préservée, aucun changement canonical/slug
- `feedback_no_touch_meta_h1_if_optimized` — meta actuelles dégradées, donc améliorables
- `feedback_no_questionnaire_propose_best` — design unique présenté
- `feedback_no_bricolage_escalate_to_industry_standard` — pattern canon e-commerce + Google soft-404
- `feedback_v1_first_dont_build_ultimate_engine_too_early` — V1 seul livrable
- `feedback_new_token_type_equals_operational_debt` — télémétrie provisionnée
- `feedback_single_write_path_needs_bypass_scanner` — un seul endpoint alternatives
- `feedback_deterministic_input_hash_canonical_json` — cache key replay-safe
- `feedback_no_broad_migration_glob_in_ownership` — ownership feature-scoped
- `feedback_synthetic_bot_ua_never_spoof_googlebot` — UA crawler identifiable
- `feedback_branch_scope_discipline` — branche dédiée depuis main
- `feedback_commit_via_worktree_when_concurrent_agents` — worktree dédié

### 10.2 Fichiers touchés

| Fichier | Action |
|---|---|
| `backend/src/modules/rm/services/rm-alternatives.service.ts` | Refonte |
| `backend/src/modules/rm/controllers/rm.controller.ts` | Ajout endpoint track + DTO v2 |
| `backend/src/modules/rm/dto/alternatives-v2.dto.ts` | Création (Zod) |
| `backend/supabase/migrations/<ts>_soft_404_events.sql` | Création |
| `frontend/app/components/pieces/NoProductsAlternatives.tsx` | Refonte |
| `frontend/app/utils/pieces-vehicle.loader.server.ts` | Adaptation parsing v2 + beacon |
| `frontend/app/utils/pieces-vehicle.meta.ts` | Ajout title/desc/og/JSON-LD ItemList |
| `audit/ownership.yaml` | Entry télémétrie |
| `.github/workflows/ci.yml` | Job smoke soft-404 |
| `scripts/ci/assert-soft-404.py` | Création smoke assert |
| `governance-vault/ledger/decisions/adr/ADR-soft-404-r2-strategy.md` | PR vault séparée |
| `governance-vault/runbooks/soft-404-telemetry.md` | PR vault séparée |

### 10.3 Sources externes

- Google Search Central — "Soft 404 errors" : https://developers.google.com/search/docs/crawling-indexing/http-network-errors#soft-404-errors
- Schema.org `ItemList` : https://schema.org/ItemList
- MDN `Navigator.sendBeacon` : https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon

---

_Spec rédigée 2026-05-18 ; en attente de revue utilisateur avant rédaction du plan d'implémentation via `writing-plans`._
