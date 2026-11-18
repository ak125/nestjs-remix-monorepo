# Candidats à l’archivage — format du lot D (mandat CA, 2026-11-18)

> **Aucune migration n’est écrite.** Ce document liste des candidats et leurs preuves, au format de `backend/supabase/migrations/20261001_archive_dead_tables_lot_d.sql` (PR #1650). Chaque lot reste un acte de Marwane : migration passée par « 🗄️ Apply Supabase migrations (manual) », essai à blanc d’abord.

## Lots précédents (contexte)

Source : `audit/massdoc-db-hygiene-candidates-2026-09-15.md` (worktree `db-hygiene-20260915`, non versionné sur `main`).

| Lot | Contenu | PR | État en base le 2026-11-18 |
|---|---|---|---|
| A | index doublons exacts | #1619 (`20260929_drop_exact_duplicate_indexes.sql`) | appliqué (déduit : la PR suivante #1649 s’appuie dessus) |
| B | 26 index jamais lus de `pieces_price` | #1649 (`20261001_drop_pieces_price_unused_indexes.sql`) | appliqué (mesuré : seuls les index que le fichier garde existent encore) |
| C | schéma `tecdoc_rebuild` (946 Mo) | — | schéma absent (mesuré) |
| D | 7 tables mortes → `_archive` | #1650 (`20261001_archive_dead_tables_lot_d.sql`) | appliqué (mesuré : `cars_engine`, `__qa_audit_*`, `signal_s*` sont dans `_archive`) |
| E | rétention 90 j de `__soft_404_events` | #1620 | appliqué (mesuré : cron#31) |

Le présent lot se nomme donc **F** (proposé). Il se découpe en deux :

- **F1** : 19 tables sans règle de suppression particulière.
- **F2** : 20 tables `__seo_*`, `__diag_*`, `kg_*` : `deletePolicy = ADR_REQUIRED` dans `.spec/00-canon/repository-registry/delete-policy.yaml`. Un archivage n’est pas une suppression, mais une décision écrite de Marwane est demandée avant ce lot.

Retirée de la liste par le complément CA-2 (décision de Marwane citée par le pilotage) : `support_tickets` (décision 25, désormais « prévue »). Une table prévue par une décision n’est jamais candidate, même vide et sans code.

## En-tête proposé (même plan que le lot D)

```text
-- Scope (lignes exactes comptées le 2026-11-18 10:12 UTC) :
--   [F1]
--   public.__agent_runs                                   7 lignes
--   public.__catalog_import_history                       3 lignes
--   public.__marketing_analytics_digests                  0 lignes
--   public.__marketing_content_library                    0 lignes
--   public.__marketing_guest_posts                        0 lignes
--   public.__qa_protected_meta_hash                     140 lignes
--   public.__rag_check_history                            3 lignes
--   public.__rag_pipeline_incidents                      30 lignes
--   public.__rag_readiness                             1219 lignes
--   public.__v_level_computed                            16 lignes
--   public.__v_level_raw                                 16 lignes
--   public.error_statistics                               0 lignes
--   public.gamme_filter_criteria                        320 lignes
--   public.norm_vehicle                                   0 lignes
--   public.rm_data_version                               24 lignes
--   public.rm_listing_content                             0 lignes
--   public.rm_oem_top                                     0 lignes
--   public.stg_compatibility                              0 lignes
--   public.audit_vlevel_pg424_snapshot_20260608        1616 lignes
--   [F2]
--   public.__diag_safe_phrases                           17 lignes
--   public.__seo_ai_runs                                  0 lignes
--   public.__seo_audit_history                            4 lignes
--   public.__seo_cannibalization_recommendations        662 lignes
--   public.__seo_content_audit                           23 lignes
--   public.__seo_diagnostic                               0 lignes
--   public.__seo_gamme_gsc_baseline                       0 lignes
--   public.__seo_observable_policy                       32 lignes
--   public.__seo_r2_page_content                          0 lignes
--   public.__seo_r2_page_versions                         0 lignes
--   public.__seo_r2_qa_reviews                            0 lignes
--   public.__seo_r2_regeneration_queue                    0 lignes
--   public.__seo_reality_audit                            1 lignes
--   public.__seo_revert_candidates_log                    0 lignes
--   public.__seo_role_content                             0 lignes
--   public.kg_audit_log                                   0 lignes
--   public.kg_edge_history                                0 lignes
--   public.kg_learning_log                                0 lignes
--   public.kg_node_history                                0 lignes
--   public.kg_weight_adjustments                          0 lignes
--
-- POURQUOI : 0 écriture depuis le 2026-09-17 (pg_stat_user_tables) ; 0 appel du rôle de l’API dans
--   pg_stat_statements ; 0 lecteur ou écrivain dans le code (git grep, hors migrations, docs et types générés) ;
--   0 vue, 0 règle, 0 fonction, 0 cron, 0 clé étrangère entrante ; hors publication et hors extension.
-- POURQUOI SET SCHEMA _archive ET PAS DROP : réversible par ALTER TABLE … SET SCHEMA public ;
--   données, index, contraintes, triggers et policies suivent la table.
-- HORS LOT : tous les pieces_media_img* (zone interdite) ; les tables « à trancher » de l’inventaire ;
--   __seo_snapshot_cf_rum (décision collecteur, voir inventaire §4.1).
-- EFFETS CONNUS : clés étrangères sortantes conservées vers public (liste ci-dessous) ; triggers
--   enforce_agent_write_scope / updated_at déplacés avec la table ; types générés à régénérer.
-- IDEMPOTENT : chaque table déplacée seulement si elle est encore dans public.
-- APPLICATION : Actions → « 🗄️ Apply Supabase migrations (manual) », only_ids = <id>, essai à blanc d’abord.
-- ROLLBACK : .down.sql symétrique (SET SCHEMA public).
-- PRÉCONTRÔLE (fail-closed, comme le lot D) : _archive existe et appartient à postgres ; aucun rôle de
--   l’API n’a USAGE dessus ; pour chaque table : nombre de lignes = nombre ci-dessus, table simple (relkind r),
--   propriétaire postgres, hors extension, hors publication.
```

## Preuves par table

`git grep` : `git grep -l -w -F <table>` au commit `f0081e635142`. La colonne donne les fichiers trouvés **hors** migrations, documentation et types générés : 0 partout (mesuré). Les autres colonnes sont mesurées en base.

| Table | Lot | Lignes exactes | Mo | Code (grep) | Migrations / docs | Vues · règles · fonctions · cron · FK entrantes | FK sortantes | Triggers | Écritures depuis 09-17 | seq/idx | Appels API | Dépt |
|---|---|---:|---:|---:|---|---|---|---|---|---|---:|---|
| `__agent_runs` | F1 | 7 | 0.1 | 0 | 1 / 4 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 11/0 | 0 | 23 ia-agents |
| `__catalog_import_history` | F1 | 3 | 0.1 | 0 | 0 / 4 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 13/0 | 0 | 10 catalog |
| `__diag_safe_phrases` | F2 | 17 | 0.0 | 0 | 2 / 5 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 6/0 | 0 | 11 diagnostic |
| `__marketing_analytics_digests` | F1 | 0 | 0.0 | 0 | 0 / 3 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 19/0 | 0 | 04 marketing |
| `__marketing_content_library` | F1 | 0 | 0.0 | 0 | 0 / 3 | 0 · 0 · 0 · 0 · 0 | — | trg_mcl_updated_at | 0/0/0 | 15/0 | 0 | 04 marketing |
| `__marketing_guest_posts` | F1 | 0 | 0.0 | 0 | 0 / 5 | 0 · 0 · 0 · 0 · 0 | __marketing_campaigns, __marketing_outreach | — | 0/0/0 | 19/0 | 0 | 04 marketing |
| `__qa_protected_meta_hash` | F1 | 140 | 0.4 | 0 | 0 / 5 | 0 · 0 · 0 · 0 · 0 | — | trg_write_scope___qa_protected_meta_hash | 0/0/0 | 13/4 | 0 | 07 seo |
| `__rag_check_history` | F1 | 3 | 0.0 | 0 | 1 / 2 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 9/0 | 0 | 09 wiki |
| `__rag_pipeline_incidents` | F1 | 30 | 0.1 | 0 | 2 / 4 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 7/0 | 0 | 09 wiki |
| `__rag_readiness` | F1 | 1219 | 1.1 | 0 | 1 / 2 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 14/4 | 0 | 09 wiki |
| `__seo_ai_runs` | F2 | 0 | 0.0 | 0 | 1 / 1 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 16/0 | 0 | 07 seo |
| `__seo_audit_history` | F2 | 4 | 0.0 | 0 | 1 / 2 | 0 · 0 · 0 · 0 · 0 | — | trg_write_scope___seo_audit_history | 0/0/0 | 12/0 | 0 | 07 seo |
| `__seo_cannibalization_recommendations` | F2 | 662 | 0.8 | 0 | 1 / 1 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 16/4 | 0 | 07 seo |
| `__seo_content_audit` | F2 | 23 | 0.2 | 0 | 0 / 1 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 18/0 | 0 | 07 seo |
| `__seo_diagnostic` | F2 | 0 | 0.0 | 0 | 0 / 5 | 0 · 0 · 0 · 0 · 0 | — | trg_write_scope___seo_diagnostic | 0/0/0 | 22/0 | 0 | 07 seo |
| `__seo_gamme_gsc_baseline` | F2 | 0 | 0.0 | 0 | 1 / 3 | 0 · 0 · 0 · 0 · 0 | — | trg_write_scope___seo_gamme_gsc_baseline | 0/0/0 | 17/0 | 0 | 07 seo |
| `__seo_observable_policy` | F2 | 32 | 0.0 | 0 | 1 / 3 | 0 · 0 · 0 · 0 · 0 | — | trg_write_scope___seo_observable_policy | 0/0/0 | 10/0 | 0 | 07 seo |
| `__seo_r2_page_content` | F2 | 0 | 0.0 | 0 | 2 / 4 | 0 · 0 · 0 · 0 · 0 | __seo_r2_pages | trg_r2_page_content_updated_at | 0/0/0 | 4/0 | 0 | 07 seo |
| `__seo_r2_page_versions` | F2 | 0 | 0.0 | 0 | 2 / 4 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 15/0 | 0 | 07 seo |
| `__seo_r2_qa_reviews` | F2 | 0 | 0.0 | 0 | 2 / 4 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 12/0 | 0 | 07 seo |
| `__seo_r2_regeneration_queue` | F2 | 0 | 0.0 | 0 | 2 / 4 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 6/0 | 0 | 07 seo |
| `__seo_reality_audit` | F2 | 1 | 0.1 | 0 | 1 / 1 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 11/0 | 0 | 07 seo |
| `__seo_revert_candidates_log` | F2 | 0 | 0.0 | 0 | 0 / 1 | 0 · 0 · 0 · 0 · 0 | __seo_content_events | — | 0/0/0 | 17/0 | 0 | 07 seo |
| `__seo_role_content` | F2 | 0 | 0.0 | 0 | 2 / 3 | 0 · 0 · 0 · 0 · 0 | __seo_page_brief | trg_write_scope___seo_role_content | 0/0/0 | 27/0 | 0 | 07 seo |
| `__v_level_computed` | F1 | 16 | 0.1 | 0 | 0 / 5 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 16/0 | 0 | 10 catalog |
| `__v_level_raw` | F1 | 16 | 0.0 | 0 | 0 / 5 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 14/0 | 0 | 10 catalog |
| `error_statistics` | F1 | 0 | 0.0 | 0 | 0 / 4 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 8/0 | 0 | 22 data |
| `gamme_filter_criteria` | F1 | 320 | 0.1 | 0 | 1 / 3 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 6/0 | 0 | 10 catalog |
| `kg_audit_log` | F2 | 0 | 0.0 | 0 | 2 / 7 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 11/0 | 0 | 11 diagnostic |
| `kg_edge_history` | F2 | 0 | 0.0 | 0 | 3 / 7 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 6/0 | 0 | 11 diagnostic |
| `kg_learning_log` | F2 | 0 | 0.0 | 0 | 2 / 6 | 0 · 0 · 0 · 0 · 0 | kg_cases | — | 0/0/0 | 8/0 | 0 | 11 diagnostic |
| `kg_node_history` | F2 | 0 | 0.0 | 0 | 3 / 7 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 6/0 | 0 | 11 diagnostic |
| `kg_weight_adjustments` | F2 | 0 | 0.0 | 0 | 4 / 7 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 10/0 | 0 | 11 diagnostic |
| `norm_vehicle` | F1 | 0 | 0.0 | 0 | 0 / 4 | 0 · 0 · 0 · 0 · 0 | import_batch, stg_vehicle | — | 0/0/0 | 10/0 | 0 | 10 catalog |
| `rm_data_version` | F1 | 24 | 0.1 | 0 | 0 / 3 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 6/0 | 0 | 10 catalog |
| `rm_listing_content` | F1 | 0 | 0.0 | 0 | 0 / 3 | 0 · 0 · 0 · 0 · 0 | rm_listing | — | 0/0/0 | 1/1 | 0 | 10 catalog |
| `rm_oem_top` | F1 | 0 | 0.0 | 0 | 0 / 3 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 1/0 | 0 | 10 catalog |
| `stg_compatibility` | F1 | 0 | 0.0 | 0 | 0 / 4 | 0 · 0 · 0 · 0 · 0 | import_batch | — | 0/0/0 | 3/0 | 0 | 10 catalog |
| `audit_vlevel_pg424_snapshot_20260608` | F1 | 1616 | 0.2 | 0 | 1 / 1 | 0 · 0 · 0 · 0 · 0 | — | — | 0/0/0 | 0/0 | 0 | 10 catalog |

Règles et vues : 0 objet `pg_rewrite` ne dépend d’un candidat (mesuré, `q15_candidates`).

## Points d’attention (déduit)

- `__qa_protected_meta_hash` (140 lignes) : son nom évoque la protection des meta et H1 optimisés. Aucun code ne la lit ; confirmer qu’aucune garde hors dépôt n’en dépend avant de l’archiver.
- `__seo_role_content` garde une clé étrangère vers `__seo_page_brief` (vivante) ; `__marketing_guest_posts` vers `__marketing_campaigns` et `__marketing_outreach` ; `norm_vehicle` et `stg_compatibility` vers `import_batch` ; `__seo_r2_page_content` vers `__seo_r2_pages` ; ces tables cibles restent dans public.
- `__rag_readiness` (1 219 lignes) et `__seo_cannibalization_recommendations` (662 lignes) sont les plus grosses ; un export avant archivage est possible mais pas nécessaire (SET SCHEMA garde les données).
- `audit_vlevel_pg424_snapshot_20260608` : copie datée du 2026-06-08, 1 616 lignes, 0 lecture depuis le 2026-09-17.

## Exclus volontairement

- Les 8 tables `pieces_media_img_*` (sauvegardes et reprises de juin et mai 2026) : zone interdite, trace d’un incident. Jamais candidates.
- Toute table à trancher, même vide : il faut d’abord la réponse à sa question (inventaire §7).
