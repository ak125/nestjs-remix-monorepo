# Session A — Start snapshot (`pieces_relation_type` pollution fix)

> Date : 2026-04-13 15:35:40 UTC
> Branch : `fix/pieces-relation-type-pollution-session-a`
> Plan : `/home/deploy/.claude/plans/swirling-giggling-scott.md`
> Session de référence : `majestic-mixing-owl` (scan Phase 1 précédent, rapport `pieces-relation-type-pollution-2026-04-13.md`)

## Objectif de Session A

Freeze l'hémorragie, peupler `tecdoc_map.vehicle_registry`, patcher les scripts, tester sur sibling pour dlnr=21 uniquement. **Zéro mutation sur prod.**

## Baseline DB (pré-session)

| Table | Size (pg_total_relation_size) | Live tuples | Note |
|---|---|---|---|
| `public.pieces_relation_type` | 50 318 721 024 (**47 GB**) | 368 304 446 | ~60 % pollué selon scan précédent |
| `tecdoc_map.source_linkages` | 96 640 131 072 (**90 GB**) | 339 262 790 | +27 M depuis scan précédent (312 M → 339 M) |
| `tecdoc_raw.t400` | 18 658 336 768 (**17 GB**) | — | Contredit le rapport "138 M lignes" (17 GB = baseline normale) |
| `tecdoc_map.vehicle_registry` | — | **0 rows** (vide) | Blocage A.1 : peuplement obligatoire avant tout patch |

## Scratch / artefacts résiduels

| Artefact | État |
|---|---|
| `public.__tmp_poisoned_relations` | **N'existe plus** (perdu depuis Session `majestic-mixing-owl`) |
| `_archive.pieces_relation_type_poison_2026_04` | N'existe pas |
| `_archive.poisoned_piece_ids_2026_04` | N'existe pas |
| `_archive` schema | existe, 66 tables (aucune liée à cette pollution) |
| Triggers sur `pieces_relation_type` | aucun |

## Migrations draftées par session précédente

Les 2 fichiers suivants étaient présents en **untracked** (jamais committés, jamais appliqués en DB confirmé via `supabase_migrations.schema_migrations` → zéro ligne matching `20260413%`) :

- `backend/supabase/migrations/20260413_archive_polluted_pieces_relation_type.sql` (302 lignes)
- `backend/supabase/migrations/20260413_prevent_mass_relation_insert.sql` (116 lignes)

Conservés dans `git stash@{0}` (commit `1a095998` branche `main`) pour référence historique. **Ne seront pas appliqués** — approche bricolage (seuil numérique) remplacée par stratégie diff set-theoretic (voir plan §2 + §3).

## Processus / cron tecdoc actifs

| Check | Résultat |
|---|---|
| `crontab -l \| grep -iE 'tecdoc\|populate\|project-core'` | **aucun** |
| `systemctl list-timers \| grep -iE 'tecdoc\|populate'` | **aucun** |
| `ps aux \| grep -E 'populate-source\|project-core\|load-t400'` | **aucun** |

Conclusion : pas d'hémorragie active. Les scripts peuvent être renommés `.frozen` sans interrompre un job en cours.

## Cas de référence pour vérification

| Cible | Valeur actuelle | Valeur attendue après fix |
|---|---|---|
| `pieces_relation_type WHERE rtp_piece_id = '12185463'` (Valeo ref 671889, plaquette frein) | 34 912 relations (min_tid=1, max_tid=83410) | < 500 |
| P50 / MAX relations pour Valeo × plaquettes | inconnu (rapport annonce max 43 216, avg 30 070) | p50 ≈ 20-80, max ≤ 500 |
| Page Skoda Rapid 1.6 TDi (type 52395) — plaquettes Valeo (pg=402, pm=4820) | 249 pièces | 20-40 |

## Prochaines étapes A.0

- [x] Branch créée
- [x] Baseline snapshot écrite (ce fichier)
- [x] Migrations bricolage effectivement hors chemin (stash)
- [ ] Rename `populate-source-linkages.py` + `tecdoc-project-core.py` en `.frozen.20260413`
- [ ] Créer `DO-NOT-RUN-FROZEN.md` à côté

Puis A.1 : audit sources `vehicle_registry` (read-only) avant toute décision de peuplement.
