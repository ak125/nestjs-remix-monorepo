---
name: vehicle-ops
description: "Vehicle operations: lookup, V-Level classification, compatibility RPC, cache, data quality. Anti-patterns DB (no FK, TEXT columns, type_display string)."
argument-hint: "[diagnose|vlevel|cache|quality] [gamme-id or type-id]"
allowed-tools: Read, Grep, Glob, Bash, mcp__supabase__execute_sql
version: "1.0"
---

# Vehicle Operations — v1.0

Operations sur le domaine vehicule : diagnostic, classification V-Level v5.0, compatibilite pieces, cache Redis, qualite donnees.

**Domaine couvert :**
- 13 services backend (`backend/src/modules/vehicles/services/`)
- 3 tables principales (`auto_marque`, `auto_modele`, `auto_type`)
- Classification V-Level v5.0 (V2/V3/V4/V5)
- Compatibilite vehicule-pieces via RPC
- Cache Redis (1h TTL + 24h stale fallback)

---

## Quand proposer ce skill

| Contexte | Proposition |
|----------|------------|
| Bug vehicule (selector vide, annees manquantes, type non trouve) | `/vehicle-ops diagnose [type-id]` |
| Recalcul V-Level pour une gamme | `/vehicle-ops vlevel [pg-id]` |
| Performance lente sur pages pieces (>500ms) | `/vehicle-ops cache [pg-id]` |
| Verification qualite donnees vehicules | `/vehicle-ops quality` |

---

## Workflow Diagnose (4 phases)

### Phase 1 — LOCATE (identifier le vehicule)

1. Recuperer le `type_id` depuis l'URL, les params ou la requete utilisateur
2. Requete DB pour verifier l'existence :
   ```sql
   SELECT t.type_id, t.type_display, t.type_fuel, t.type_power_ps,
          t.type_year_from, t.type_year_to,
          m.modele_nom, m.modele_alias, m.modele_parent,
          ma.marque_nom, ma.marque_alias
   FROM auto_type t
   JOIN auto_modele m ON t.modele_id = m.modele_id
   JOIN auto_marque ma ON m.marque_id = ma.marque_id
   WHERE t.type_id = '[ID]'
   ```
3. **ATTENTION :** Le JOIN ci-dessus fonctionne en SQL direct mais PAS en PostgREST (no FK). Toujours utiliser MCP Supabase `execute_sql`.

### Phase 2 — CHECK (verifier coherence)

| Check | Attendu | Severite si echec |
|-------|---------|-------------------|
| `type_display` | `'1'` (string, PAS integer) | BLOQUANT |
| `type_year_from` / `type_year_to` | Annees valides, from <= to | MOYENNE |
| `modele_parent` | Existe si modele a un parent | HAUTE |
| `marque_display` | `'1'` pour marque visible | HAUTE |
| `type_fuel` | Valeur connue (diesel/essence/hybride/electrique/GPL) | HAUTE |
| Pieces compatibles | RPC `get_pieces_for_type_gamme` retourne des resultats | BLOQUANT |

### Phase 3 — TRACE (suivre le chemin de donnees)

Tracer le flux de bout en bout :
1. **DB** → `auto_type` (donnees brutes)
2. **Service** → `VehicleRpcService` ou `VehicleBrandsService` (business logic)
3. **Cache** → Redis key `vehicle:type:{typeId}` (1h TTL)
4. **Controller** → `VehiclesController` endpoint
5. **Frontend** → `useVehicleEnrichment` hook ou `VehicleSelector` composant

Identifier ou le probleme se situe dans la chaine.

### Phase 4 — FIX (corriger)

1. Corriger les BLOQUANTS en priorite
2. Proposer les fixes avec diff
3. Si migration necessaire → proposer `/db-migration`
4. Si endpoint casse → proposer `/backend-test`

---

## Workflow V-Level (5 phases)

### Phase 1 — FETCH

1. Recuperer la gamme depuis `pieces_gamme` :
   ```sql
   SELECT pg_id, pg_nom, pg_alias, gamme_universelle
   FROM pieces_gamme WHERE pg_id = [ID]
   ```
2. Recuperer les keywords :
   ```sql
   SELECT id, keyword, volume, v_level, type_ids, energy
   FROM __seo_keywords WHERE pg_id = [ID]
   ```
3. **Verifier `gamme_universelle`** : si true, ignorer l'energie dans le groupement

### Phase 2 — CLASSIFY (algo v5.0)

1. Pour chaque keyword avec `type_ids` non-vide : enrichir l'energie depuis `auto_type.type_fuel` si inconnue
2. Grouper par `[model + energy]` (ou juste `[model]` si `gamme_universelle`)
3. Par groupe : elire **V3 champion** = keyword avec le plus grand `volume` (premier si egalite)
4. Les autres keywords du groupe → **V4**
5. Parmi tous les V3 : selectionner les **top 10** par `volume` (dedupliques par `[model + energy]`) → **V2**
6. Vehicules en DB du meme `modele_parent` mais absents du CSV → **V5** (calcule dynamiquement)

### Phase 3 — VALIDATE

| Verification | Attendu | Action si echec |
|--------------|---------|-----------------|
| Au moins 1 V3 par groupe | Toujours | BLOQUANT — algo KO |
| V2 count <= 10 | Max 10 | HAUTE — dedup defaillant |
| V4 count > 0 si groupe > 1 keyword | Logique | WARNING — verifier groupement |
| Pas de V1 ou V6 | Deferred | INFO — ignorer |
| Distribution coherente | V3 >= V2, V4 >= 0 | HAUTE — recalculer |

### Phase 4 — UPDATE

1. Batch update `__seo_keywords` par lots de 1000 :
   ```sql
   UPDATE __seo_keywords SET v_level = 'V3' WHERE id IN (...)
   ```
2. Utiliser MCP Supabase `execute_sql` (pas de psql)
3. Logger le nombre de mises a jour par niveau

### Phase 5 — REFRESH

1. Rafraichir `gamme_aggregates` pour la gamme
2. Verifier que les compteurs V2/V3/V4 sont coherents avec les keywords
3. Si enrichissement SEO impacte → signaler a `seo-content-architect`

---

## Workflow Cache (3 phases)

### Phase 1 — AUDIT

Verifier les cles Redis :
- `gamme:rpc:v2:{pgId}` — donnees gamme (1h fresh)
- `gamme:rpc:v2:stale:{pgId}` — fallback (24h)
- `vehicle:type:{typeId}` — vehicule enrichi
- `brand_id:{marqueId}`, `brand_alias:{alias}`, `brand_name:{name}`

Hit ratio attendu : >80%. Si inferieur → cache froid ou TTL trop court.

### Phase 2 — WARM

Prechauffer les gammes populaires :
```typescript
warmCache(pgIds: number[]) // batches de 10, parallele
```
Utiliser la liste des gammes G1 (indexees) comme priorite.

### Phase 3 — INVALIDATE

Apres migration schema ou modification de donnees vehicule :
1. Purger les cles impactees
2. Re-warmer les gammes G1
3. Verifier le hit ratio post-purge

---

## Anti-Patterns (BLOCK)

| # | Anti-Pattern | Pourquoi c'est dangereux | Solution |
|---|-------------|-------------------------|----------|
| 1 | PostgREST joins `auto_type` ↔ `auto_modele` | **No FK** — joins echouent silencieusement, retournent vide | 2-step query (modeles d'abord, puis types avec `.in()`) |
| 2 | `type_display = 1` (integer) | DB stocke `'1'` (TEXT) — comparaison echoue | `type_display = '1'` (string) |
| 3 | Colonne `type_year` | **N'existe PAS** | `type_year_from` / `type_year_to` (TEXT, pas integer) |
| 4 | Ignorer `gamme_universelle` | Essuie-glaces, filtres a huile ignorent le carburant | Verifier flag dans `pieces_gamme` avant groupement V-Level |
| 5 | Utiliser `score_seo` | **Supprime en v5.0** | Utiliser `volume` directement |
| 6 | Persister V5 en DB | V5 = calcule dynamiquement via `getV5Siblings()` | Ne JAMAIS stocker V5 |
| 7 | Refs OEM non normalisees | Formats varies ("77 01 206 343" vs "7701206343") | Normaliser (strip spaces/dashes) avant dedup |
| 8 | Pas de pagination grandes marques | BMW, RENAULT >1000 types — timeout | Toujours paginer (offset/limit) |

---

## Niveaux de Severite

| Niveau | Symbole | Definition | Exemples |
|--------|---------|-----------|----------|
| **BLOQUANT** | :no_entry: | Vehicule inaccessible ou donnees corrompues | type introuvable, V-Level corrompu, RPC timeout >2s, pieces vides |
| **HAUTE** | :warning: | Donnees incorrectes impactant l'affichage | cache miss >50%, type_display mal filtre, FK manuelle cassee, energie inconnue |
| **MOYENNE** | :bulb: | Donnees incompletes sans impact critique | annees manquantes, alias undefined dans URL, dedup OEM incomplet |
| **BASSE** | :information_source: | Optimisations | cache TTL non-optimal, enrichissement partiel, fallback stale utilise |

---

## Schema Reference

### Tables principales

| Table | Colonnes cles | Pieges |
|-------|--------------|--------|
| `auto_marque` | marque_id, marque_nom, marque_alias, marque_display | display est TEXT ('1'/'0') |
| `auto_modele` | modele_id, marque_id, modele_nom, modele_alias, modele_parent | **Pas de FK** vers auto_type |
| `auto_type` | type_id (TEXT), modele_id, type_fuel, type_power_ps, type_year_from (TEXT), type_year_to (TEXT), type_display (TEXT) | type_id est TEXT pas INT, pas de type_year |

### Tables V-Level

| Table | Role |
|-------|------|
| `__seo_keywords` | Classification V-Level (v_level, volume, pg_id, type_ids, energy) |
| `pieces_gamme` | Gammes avec flag `gamme_universelle` |
| `gamme_aggregates` | Compteurs agreges (V2/V3/V4 counts, priority_score) |
| `__seo_type_vlevel` | Donnees V-Level par type (historique) |

### Energies reconnues

`diesel` | `essence` | `hybride` | `electrique` | `GPL`

Detection depuis `auto_type.type_fuel` ou patterns dans les keywords.

---

## Key Files

### Backend
- `backend/src/modules/vehicles/services/` — 13 services (brands, models, types, search, cache, enrichment, RPC, meta, motor codes, profile, bestsellers, SEO)
- `backend/src/modules/admin/services/gamme-vlevel.service.ts` — Algo V-Level v5.0
- `backend/src/modules/catalog/services/vehicle-pieces-compatibility.service.ts` — RPC compatibilite
- `backend/src/modules/admin/controllers/admin-vehicle-resolve.controller.ts` — Bulk type resolution

### Frontend
- `frontend/app/components/vehicle/VehicleSelector.tsx` — Selecteur vehicule (compact/full modes)
- `frontend/app/hooks/useVehicleEnrichment.ts` — Hook React Query pour enrichissement bulk

### Specs
- `.spec/features/g-v-classification.md` — Spec V-Level v5.0 (25 decisions)

---

## Requetes Diagnostiques Utiles

### Verifier un type_id
```sql
SELECT t.type_id, t.type_display, t.type_fuel, t.type_power_ps,
       t.type_year_from, t.type_year_to,
       m.modele_nom, ma.marque_nom
FROM auto_type t
JOIN auto_modele m ON t.modele_id = m.modele_id
JOIN auto_marque ma ON m.marque_id = ma.marque_id
WHERE t.type_id = '[ID]'
```

### Distribution V-Level pour une gamme
```sql
SELECT v_level, COUNT(*) as count, SUM(volume) as total_volume
FROM __seo_keywords
WHERE pg_id = [PG_ID]
GROUP BY v_level
ORDER BY v_level
```

### Types sans modele parent (orphelins potentiels)
```sql
SELECT t.type_id, t.type_fuel, m.modele_nom, m.modele_parent
FROM auto_type t
JOIN auto_modele m ON t.modele_id = m.modele_id
WHERE m.modele_parent IS NULL
AND t.type_display = '1'
LIMIT 20
```

### Gammes universelles
```sql
SELECT pg_id, pg_nom, gamme_universelle
FROM pieces_gamme
WHERE gamme_universelle = true
```

---

## Format de Sortie

```markdown
## Vehicle Ops — [operation] [id]

### Diagnostic
- Type ID : [id] | Display : [1/0] | Fuel : [diesel/essence/...]
- Marque : [nom] | Modele : [nom] | Generation : [parent]
- Annees : [from]-[to]
- V-Level : [V2/V3/V4/V5] | Volume : [N]

### Issues

#### BLOQUANT (N)
- [fichier:ligne ou table:colonne] Description du probleme

#### HAUTE (N)
- [fichier:ligne ou table:colonne] Description du probleme

#### MOYENNE (N)
- Description

#### BASSE (N)
- Description

### Actions
- [ ] [action corrective avec fichier cible]

### Verdict
- SAIN — 0 BLOQUANT, 0 HAUTE
- [N] ISSUE(S) A CORRIGER — [N] BLOQUANT(s), [N] HAUTE(s)
```

---

## Interaction avec Autres Skills

| Skill | Direction | Declencheur |
|-------|-----------|-------------|
| `seo-content-architect` | ← recoit | V-Level impacte le contenu SEO (V2/V3 = pages indexees) |
| `db-migration` | ← recoit | Migrations sur auto_type/auto_modele/auto_marque |
| `backend-test` | → propose | Apres fix vehicule, valider endpoints avec curl |
| `frontend-design` | → propose | Si VehicleSelector casse, proposer rebuild composant |
