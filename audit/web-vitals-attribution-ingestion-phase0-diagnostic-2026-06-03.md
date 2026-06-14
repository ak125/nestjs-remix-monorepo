# Web-Vitals Attribution Ingestion — Phase 0 Diagnostic (READ-ONLY)

**Date :** 2026-06-03
**TOP priority :** `web-vitals-attribution-ingestion`
**Incident bordé :** `web-vitals-attribution-unstable` (actif)
**Mode :** lecture seule. Supabase MCP read-only (projet `cxpojprgwgubzjyqzmoq`), grep code, registry. **Zéro mutation** : aucune table, aucun backfill, aucun flag, aucun cron, aucun DEV relancé.
**Doctrine :** Phase 0 empirique avant tout plan (`feedback_empirical_phase_0_first`) · CWV stack existe déjà, ne pas reconstruire (`feedback_cwv_rum_stack_already_exists`) · vérifier l'existant (`feedback_verify_existing_first`).

---

## Verdict global

**`DIAGNOSTIC_READY` — la priorité est très majoritairement DÉJÀ LIVRÉE, pas un chantier neuf.** Le pipeline d'ingestion + attribution existe, est gouverné, et **collecte en live**. Mais une **dérive runtime active** (l'incident) provoque une **perte de données imminente** : l'agrégation `raw → hourly → daily_rum` est arrêtée depuis ~2 jours alors que le raw (TTL ~48h) continue d'affluer.

- **NE PAS** construire d'ingestion/beacon/table : tout existe (RCOP 6 blocs mergés 05-24→05-29, #803/#811 résiduels mergés 06-01).
- **Cause racine architecturale** : l'agrégation tourne dans un **worker BullMQ piloté par un flag DEV-only** (`SEO_CWV_AGGREGATION_ENABLED=true` seulement dans `backend/.env`), sur une **machine DEV actuellement hung**. Une chaîne de données PROD dépend du poste DEV = anti-pattern `deployment.md`. → fix robuste = **pg_cron** appelant les RPC `aggregate_cwv_*` existantes (découplé de l'app), pas un replay manuel.
- **1 garde anti-perte (#811) mergée mais NON appliquée** au live (drift axe #4 deployment.md) → le filet qui aurait dû alerter est lui-même absent.
- **Fenêtre de perte ouverte** : 2 022 échantillons humains (48 h) à sauver par replay avant purge TTL — stopgap, pas le fix.

---

## État de la chaîne (vérité live, mesurée)

Topologie (canon mémoire) : `sendBeacon /api/seo/cwv/beacon → __seo_cwv_raw` (jour, TTL ~48h, human-only) `→ aggregate_cwv_hourly() → __seo_cwv_hourly` (TTL 14j) `→ aggregate_cwv_daily_rum() → __seo_cwv_daily_rum` (SoT field).

| Tier | rows | newest | oldest | Lecture |
|---|---|---|---|---|
| `__seo_cwv_raw` (human) | 2 570 | **2026-06-03 16:14** (frais) | 2026-06-01 00:34 | ✅ collecte vivante |
| `__seo_cwv_hourly` | 871 | **2026-06-01 13:00** | 2026-05-30 00:00 | ⛔ **figé ~2 j** |
| `__seo_cwv_daily_rum` | 118 | **2026-06-01** | 2026-05-30 | ⛔ **figé ~2 j** |

> Le beacon (ingestion) **marche** : raw frais à l'heure du probe. L'**agrégation** est l'étage cassé — exactement le symptôme `web-vitals-attribution-unstable`.

**Attribution (dimension éponyme) — saine côté collecte**, sur raw < 24 h (1 022 lignes) :
- `funnel_step` renseigné : **1022/1022** (100 %)
- `attribution` jsonb peuplé : **478/1022** (~47 % — normal : web-vitals n'attache l'attribution que sur une partie des métriques/navigations)
- surfaces distinctes : 4 · échantillons **R2 `/pieces`** : **631** · échantillons **INP** : 75
- → la donnée d'attribution arrive bien ; elle est juste **bloquée à l'étage agrégation** avant d'atteindre le SoT field.

---

## Findings

### Finding 1 — `critical` · agrégation figée + perte de données imminente (= l'incident)

**Mesuré :** 48 heures de raw humain présentes mais **jamais agrégées** dans `__seo_cwv_hourly`.

| Métrique | Valeur |
|---|---|
| heures manquantes | **48** |
| échantillons humains non agrégés | **2 022** |
| plus ancienne heure manquante | 2026-06-01 14:00 UTC |
| plus récente heure manquante | 2026-06-03 13:00 UTC |

**Fenêtre de perte :** le raw a un TTL ~48 h. Les échantillons du 06-01 14:00 seront **purgés vers le 06-03 ~14:00+** sans avoir été agrégés → **perte définitive**. Le backfill n'est possible que **tant que le raw n'est pas purgé** (les RPC `aggregate_cwv_*` lisent le raw).

**Cause racine — ARCHITECTURALE, pas une valeur de flag (chaîne de preuve) :**
1. L'agrégation est un **job répétable BullMQ** enregistré dans le **process worker** (`CwvAggregationSchedulerService` dans `backend/src/workers/worker.module.ts:135`, boot via `backend/src/workers/main.ts`), `onModuleInit` gardé par `isEnabled()`.
2. `SEO_CWV_AGGREGATION_ENABLED=true` existe **uniquement dans `backend/.env:287` (DEV)**. `.env.example:223=false`, `preprod.schema.ts:61` optional/default-false (#803). → **PROD/PREPROD n'agrègent jamais**.
3. Le **process worker n'est pas en cours d'exécution** (aucun `dist/workers/main.js` dans `ps`), et `npm run dev` ne démarre que l'API (`dist/main.js`), **pas** le worker.
4. La machine **DEV elle-même est hung** : `curl localhost:3000/health` → `http=000` (timeout), `npm run dev` bloqué depuis le 31/05.

→ **Une chaîne de données PROD (beacon→raw tourne sur PROD) dépend d'un flag DEV-only + d'un process worker DEV.** C'est l'anti-pattern explicite de `deployment.md` : **DEV = poste opérateur, PAS un host runtime**. L'agrégation s'est arrêtée à 06-01 13:00 = quand le worker DEV a cessé. Un replay manuel **re-cassera** au prochain hang DEV → ce serait du bricolage.

**Solution robuste recommandée (structurelle, owner-gated) — découpler l'agrégation du process applicatif :**
- **Cible : pg_cron appelant directement `aggregate_cwv_hourly()` + `aggregate_cwv_daily_rum()`** (RPC VOLATILE déjà existantes) **dans la DB**, là où vit la donnée — toujours-actif, zéro dépendance app/worker/flag/DEV, survit aux restarts. C'est le pattern canon des autres rotations (`feedback_partitioned_snapshot_tables_need_premake_cron`) et ça élimine la cause racine au lieu de la replâtrer. Aujourd'hui : **aucun pg_cron `aggregate_cwv*`** (mesuré, Finding 2).
- *Alternative si on garde BullMQ* : faire tourner le worker sur le **runtime PROD** (49.12.233.2) avec le flag gouverné en env PROD — mais ça garde une dépendance process vs la robustesse pg_cron.

**Stopgap urgent (owner, fenêtre TTL qui se ferme, NON le fix) :** replay idempotent `aggregate_cwv_hourly(<hour>)` × 48 (06-01 14:00 → 06-03 13:00) + `aggregate_cwv_daily_rum(<date>)` × 3, AVANT purge raw. À ne faire **que** comme sauvetage des 2 022 échantillons ; la vraie correction = pg_cron ci-dessus.

### Finding 2 — `high` · garde anti-perte #811 mergée mais NON appliquée au live

**Mesuré :**
- `detect_cwv_aggregation_coverage_gap()` dans `pg_proc` : **0** (fonction absente du live)
- pg_cron pour ce détecteur : **NONE**
- pg_cron `aggregate_cwv%` : **NONE**
- alertes `cwv_aggregation_coverage_gap` ouvertes : **0**

**Lecture :** la migration `20260601_seo_cwv_aggregation_coverage_alert.sql` (#811, mergée 06-01) est **écrite mais pas appliquée** à la DB live — drift axe #4 `deployment.md` (migrations mergées ≠ auto-appliquées). C'est précisément pour ça que **Finding 1 est passé silencieux** : le filet conçu pour alerter sur ce trou n'existe pas encore côté runtime. De plus, **aucun pg_cron `aggregate_cwv*`** n'est planifié → l'agrégation ne dépend que du scheduler BullMQ (Finding 1), sans filet cron.

**Action owner (owner-gated, additif réversible) :** appliquer l'additif `20260601_*` au live (Studio SQL, tx propre) pour activer le détecteur + son pg_cron. Aligne le runtime sur le code mergé et arme le filet anti-perte.

---

## Non-findings (vérifiés, écartés)

- **« Il faut construire l'ingestion CWV »** : faux. Beacon + raw + hourly + daily_rum + taxonomie `@repo/cwv-taxonomy` + dashboard RPCs existent et sont mergés (RCOP #728/#731/#732/#733/#734 ; #803/#811). Reconstruire = triple duplication (canon).
- **« L'attribution n'est pas collectée »** : faux. `funnel_step` 100 %, `attribution` jsonb 47 % (attendu), R2 `/pieces` bien représenté (631/24 h).
- **`__seo_cwv_daily` (CrUX/PSI) vide** : connu, exclusion gouvernée V0.A (`CwvFetcherService` sans call site) — **hors scope** de ce TOP (RUM ≠ CrUX). Ne pas confondre avec `__seo_cwv_daily_rum` (le vrai SoT field, lui peuplé jusqu'au 06-01).

---

## Verdict & sortie

| Verdict | Issue |
|---|---|
| `DIAGNOSTIC_READY` | **← retenu.** Chaîne existante + 2 dérives runtime localisées + chiffres actionnables. |
| `BUILD` ingestion | **NON** — tout est déjà livré (anti-bricolage). |
| `OWNER_DECISION` runtime | **← Finding 1 & 2.** Fix structurel = **pg_cron `aggregate_cwv_*`** (découple l'agrégation du worker/flag/DEV) + apply migration #811 (filet d'alerte). Stopgap = replay 48 h avant purge TTL. Tout owner-gated (Studio / runtime READ_ONLY=false), **hors de ce que je dois muter** (no DEV bricolé, no flag flip, no cron créé, no backfill par moi). |

**Pas de PR code applicative à ouvrir.** Le code (RPC `aggregate_cwv_hourly/daily_rum`, beacon, schéma) est **complet et correct** ; le gap est **architectural/ops** : l'orchestration de l'agrégation est mal placée (worker DEV-only au lieu d'un pg_cron DB-side). Le fix robuste est une **migration pg_cron** (DDL additif réversible) + l'application de #811 — owner-gated.

Ce que je peux préparer **sans exécuter** (pour relecture owner) :
1. la **migration pg_cron** `aggregate_cwv_*` (schedule horaire @ :05 + daily @ 00:15 UTC, idempotente, pattern canon) — DDL, pas d'exécution ;
2. le **script de replay borné** `/tmp` des 48 h (stopgap, sauvetage des 2 022 échantillons).
Aucune mutation runtime/DB par moi sans GO nominatif.

---

## Annexe — requêtes (toutes READ-ONLY, reproductibles)

1. schéma colonnes (`information_schema.columns`) des 3 tiers
2. flow+freshness : `count/max/min` par tier
3. migration-applied : `pg_proc` / `cron.job` / `__seo_event_log` open alerts
4. quantif perte : raw-hours LEFT JOIN hourly-hours, `ua_class='human'`, grâce 2 h
5. attribution : `attribution IS NOT NULL`, `funnel_step`, surfaces, R2, INP sur raw < 24 h

Projet Supabase `cxpojprgwgubzjyqzmoq`. Aucune donnée mutée. DEV:3000 non sollicité (instable, hors-scope).
