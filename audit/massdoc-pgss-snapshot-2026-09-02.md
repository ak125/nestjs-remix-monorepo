# massdoc — snapshot d'archive `pg_stat_statements` (S0.1, 2026-09-02)

> **Statut** : archive de référence, lecture seule. Capturé **avant** toute correction
> de la Wave A du plan massdoc et **avant** tout reset. Ce fichier est la seule trace
> des baselines pré-correction : le store `pg_stat_statements` est partagé (dashboard
> Supabase), saturé (`dealloc = 135`, 4 901 / 5 000 entrées) et détruit par tout
> `pg_stat_statements_reset()` global (NO-GO n° 10).
>
> Données brutes : [`massdoc-pgss-snapshot-2026-09-02.json`](massdoc-pgss-snapshot-2026-09-02.json).

## Manifeste de fenêtre

| Champ | Valeur |
|---|---|
| Capturé le | 2026-09-02T00:12:55Z |
| Projet | PROD `cxpojprgwgubzjyqzmoq`, eu-west-3 |
| PostgreSQL | 17.4 (Supabase `17.4.1.042`, canal `ga`) |
| `pg_stat_statements_info.stats_reset` | **2025-12-10T14:33:12Z** (265 j) |
| `dealloc` / entrées / `pg_stat_statements.max` | 135 / 4 901 / 5 000 — **store saturé** |
| `pg_stat_statements.track` | `top` |
| `track_io_timing` | **off** — `total_exec_time` = temps mur I/O comprise, **pas du CPU** |
| `shared_buffers` / `effective_cache_size` / `work_mem` | 4 GB / 12 GB / 16 MB |
| `max_connections` | 240 |
| `pg_stat_database.stats_reset` | 2025-06-06T17:00:09Z (453 j) — origine du « 94,16 % » |
| `pg_database_size` | 257 236 339 859 o (≈ 240 Go) |
| `main` au moment de la capture | `b9bffc494` |
| `cron.job` actifs | 18 (liste dans le JSON) |

## Ce que ce snapshot peut et ne peut pas soutenir

| Affirmation | Soutenue par | **Jamais** par |
|---|---|---|
| « RPC X est mort » | 0 appel sur 14 j couvrant ≥ 1 batch admin (S0.3) | une lecture du cumulé |
| « X coûte N ms » | fenêtre bornée ≥ 14 j, `n ≥ 1 200` | la moyenne cumulée (mélange deux corps de fonction) |
| « le correctif a gagné Δ » | fenêtres avant/après **appariées** (même jour de semaine + heure) | une comparaison post-fix ↔ ce snapshot cumulé |
| « index inutilisé » | `idx_scan` + `last_idx_scan` + contre-vérification PK/RPC/vues/code | `idx_scan = 0` seul |

Le store étant saturé, `stats_since` **ne prouve pas** une fenêtre continue : une ligne
évincée puis recréée repart de zéro silencieusement. Toujours agréger par `queryid`
(9 `userid` distincts : 16480 = service_role backend, 16384 = postgres/import, 16478 = anon).

## Top par `total_exec_time` — verdict de vivacité (établi par le code appelant, pas par le compteur)

| # | Fonction / requête | Appels | Moy. ms | `stats_since` | Verdict |
|---|---|---|---|---|---|
| 1 | `get_alternative_vehicles_for_gamme` | 423 002 | 9 006 | 2026-03-09 | **FOSSILE** — appelant supprimé 2026-05-18 (`15b5f4d8f`) ; corps réécrit 2026-04-21 (ADR-017) |
| 2 | `rm_get_page_complete_v2` | 8 347 827 | 279 | 2026-01-18 | **LIVE** — page R2 ; cache Redis n'écrivait jamais `count = 0` → **A2** |
| 3 | `get_pieces_for_type_gamme_v3` | 2 421 213 | 504 | 2025-12-10 | **LIVE** — 100 % CPU (5 × `process_seo_template`), `https://https://` live → **B1** |
| 4 | `get_soft_404_alternatives` | 498 769 (+2 951 anon) | 935 | 2026-05-20 | **LIVE P0** — 2 795 blocs lus/appel ; cache `alt:*` TTL 300 s inefficace → **A2** |
| 5 | `INSERT INTO tecdoc_map.source_linkages` | 13 919 | 20 509 | 2026-03-26 | campagne d'import mars-avril 2026 (one-shot) |
| 6 | `rebuild_vehicle_page_cache` | 28 528 | 6 469 | 2026-04-20 | côté écriture de `__vehicle_page_cache` (mesure nette pour B6) |
| 7 | `get_vehicle_page_data_optimized` | 151 789 | 1 069 | 2025-12-30 | **FOSSILE** — fonction `DROP` 20260421, absente de `pg_proc` |
| 8 | `SELECT rtp_piece_id FROM pieces_relation_type WHERE rtp_type_id=$1 AND rtp_ga_id=$2` (count exact) | 110 663 | 1 167 | 2026-03-15 | **LIVE** — `seo-monitor.processor.ts:234`, colonne non indexée → **A1** |
| 9 | `rm_get_page_complete` (v1) | 83 095 | 1 362 | 2026-01-17 | fossile probable — client `fetchRmPage` sans appelant |
| 10 | `get_vehicle_compatible_gammes_php` | 1 516 599 | 71 | 2025-12-10 | LIVE, acceptable |
| 18 | `get_alternative_gammes_for_vehicle` | 473 769 | 26 | 2026-03-09 | **FOSSILE** jumeau du n° 1 (même appelant, même `stats_since`) |

Rangs 11-17, 19-31, 33-50 : INSERT de campagne d'import (`tecdoc_map`, `pieces`,
`pieces_relation_type`, userid 16384), lookups `storage.objects`, petites RPC.

## Conditions de validité pour toute mesure ultérieure

Une fenêtre de comparaison n'est valide que si, aux deux bornes : `stats_reset` inchangé,
`dealloc` inchangé, même SHA `main`, aucun delta négatif. Sinon la fenêtre est **INVALIDE**,
jamais clampée.

Erratum canon à porter (owner-gated, `.spec/00-canon/**`) : `change-control-plan.md:21` et
`perf-findings.md:41` affirment « `pg_stat_statements` indisponible sur Supabase managed » —
faux depuis ≥ 2025-12-10 ; l'erratum doit ajouter en contrepartie la limite `track_io_timing = off`.
