# Phase 3 — Full Structural Audit (300 tables)

> **Version** : 1.3.2
> **Date** : 2026-03-14
> **Statut** : V2 COMPLETE
> **Projet Supabase** : `cxpojprgwgubzjyqzmoq`
> **Methode** : `information_schema` + `pg_constraint` + `pg_stat_user_tables` + grep backend
> **Perimetre** : toutes les tables du schema `public` (~200 tables reelles + vues materialisees)
> **Conventions** : evidence = measured / inferred / suspected. Aucun verdict d'action sans gate prealable.

---

## 1. Executive Summary

| Metrique | Valeur | Evidence |
|----------|--------|----------|
| Tables schema public | **~200** (le total de 300 inclut vues, tables auth/storage/extensions) | measured |
| Taille totale | **~86 GB** | measured |
| Tables avec donnees (>0 rows) | **~100** | measured |
| Tables vides (0 rows) | **~100** | measured |
| Tables sans PK | **3** (`pieces_relation_type`, `pieces_media_img`, `rm_rebuild_queue`) | measured |
| Tables avec FK | **~25** (sur ~200) | measured |
| Tables avec dette type TEXT | **~15** (IDs, prix, dates stockes en TEXT) | measured |

### Problemes critiques (P0)

| # | Probleme | Tables | Impact | Evidence |
|---|----------|--------|--------|----------|
| P0-1 | **PK manquante** | `pieces_relation_type` (9.7 GB, 146M rows), `pieces_media_img` (953 MB, 4.6M rows) | Integrite, dedup impossible | measured |
| P0-2 | **Prix en TEXT** | `pieces_price` (11 prix), `___xtr_order_line` (20 prix), `___xtr_order` (8 prix) | Casts permanents, comparaisons invalides | measured |
| P0-3 | **IDs en TEXT** | `___xtr_msg` (7 ID), `pieces_criteria` (5 ID), `auto_type` (4 ID) | Expression indexes requis | measured |
| P0-4 | **~100 tables vides** | Voir section 5 | Classification requise | measured |

### Problemes importants (P1)

| # | Probleme | Tables | Impact | Evidence |
|---|----------|--------|--------|----------|
| P1-1 | **0 FK sur catalogue** | Toute la famille `pieces_*` sauf `pieces` (2 FK) | Jointures implicites | measured |
| P1-2 | **Dates en TEXT** | `auto_type` (4 dates), `pieces_price` (2 dates) | Tri impossible sans cast | measured |
| P1-3 | **Tables legacy** | `___config_old`, `pieces_marque_next`, `__cross_gamme_car_new` | Nommage ambigu | measured |

---

## 2. Tables Tier 1 — Catalogue TecDoc (>100 MB) — Etat post-V2

| Table | Taille | Rows | PK | FK | ID TEXT | Prix TEXT | SoT | TecDoc Role | Verdict | Gate | Readiness TecDoc |
|-------|--------|------|----|----|--------|----------|-----|-------------|---------|------|-----------------|
| pieces_relation_criteria | 33 GB | 157M | ✓ | 0 | 0 | 0 | source | source_catalog | FK_CANDIDATE_B | needs_validation | ready_with_guardrails |
| pieces_ref_search | 16 GB | 73M | ✓ | 0 | 2 | 0 | derived | derived | FK_CANDIDATE_A | needs_validation | ready_for_v4_after_cleanup |
| ___xtr_msg | 11 GB | 15M | ✓ | 0 | **7** | 0 | legacy | non_tecdoc | TYPE_MIGRATION_REQUIRED | needs_validation | out_of_scope |
| pieces_relation_type | 9.7 GB | 146M | **✗** | 0 | 0 | 0 | source | source_catalog | **PK_STRATEGY_REQUIRED** | conditional_ready | **conditional_ready_for_v4** |
| pieces_criteria | 5.4 GB | 17.6M | ✓ | 0 | **5** | 0 | source | source_catalog | TYPE_MIGRATION_REQUIRED + FK_CANDIDATE_A | needs_validation | **ready_for_v4_after_cleanup** |
| pieces | 1.4 GB | 4M | ✓ | **2** | 0 | 0 | **source** | source_catalog | REFERENCE | ready | **ready** |
| pieces_media_img | 953 MB | 4.6M | **✗** | 0 | **2** | 0 | source | source_catalog | **PK_STRATEGY_REQUIRED** | ready_after_cleanup | **ready_for_v4_after_cleanup** |
| pieces_ref_ean | 512 MB | 3M | ✓ | 0 | **1** | 0 | source | source_catalog | FK_CANDIDATE_A | needs_validation | ready_for_v4_after_cleanup |
| pieces_price | 354 MB | 442K | ✓ | 0 | **4** | **11** | source | source_catalog | **TYPE_MIGRATION_REQUIRED** (P0) | needs_validation | **ready_for_v4_after_cleanup** |
| pieces_list | 302 MB | 1.8M | ✓ | 0 | **2** | 0 | source | source_catalog | FK_CANDIDATE_A | needs_validation | ready_for_v4_after_cleanup |
| __seo_page | 114 MB | 322K | ✓ | 1 | 0 | 0 | reference | seo_dep | OK | ready | ready_with_guardrails |

**Legende** :
- **Verdict** = nature du probleme structurel (PK_STRATEGY_REQUIRED, TYPE_MIGRATION_REQUIRED, FK_CANDIDATE_A/B/C, OK, REFERENCE)
- **Gate** = statut d'execution immediat (`ready` = action possible, `needs_validation` = audit prealable requis, `blocked` = prerequis non rempli)
- **Readiness TecDoc** = statut metier vis-a-vis de l'update TecDoc (`ready`, `ready_with_guardrails`, `blocked_by_pk`, `blocked_by_type_debt`, `blocked_by_fk_uncertainty`, `blocked_by_duplicate_risk`, `out_of_scope`)
- **SoT** = `source` (table primaire canonique) / `derived` (projection/recherche, pas source d'integrite) / `reference` (surface dependante, jamais source catalogue) / `legacy` / `unknown`

> `ready_with_guardrails` = exploitable dans le pipeline TecDoc comme surface derivee/projection, jamais comme source canonique catalogue.

### Strategie PK pour tables sans contrainte

| Table | Rows | candidate_strategy | Detail |
|-------|------|--------------------|--------|
| `pieces_relation_type` | 146M | composite_pk ou deduplicate_then_composite | Audit unicite V2.1 requis |
| `pieces_media_img` | 4.6M | surrogate_pk ou deduplicate_then_composite | Audit unicite V2.1 requis |
| `rm_rebuild_queue` | 0 | trivial_empty_table_pk | Table vide, ajout immediat possible |

---

## 3. Tables Tier 2 — Metier (1 MB — 100 MB)

| Table | Taille | Rows | PK | FK | Domaine | TecDoc Role | Verdict | Gate |
|-------|--------|------|----|----|---------|-------------|---------|------|
| __sitemap_p_link | 92 MB | 473K | ✓ | 0 | SEO | seo_dep | OK | ready |
| __cross_gamme_car_new | 41 MB | 175K | ✓ | 0 | Cross | derived | DUPLICATE_SCOPE_VALIDATION_REQUIRED | needs_validation |
| auto_type_number_code | 37 MB | 165K | ✓ | 0 | Vehicle | lookup | OK | ready |
| auto_type | 37 MB | 49K | ✓ | 0 | Vehicle | source_catalog | TYPE_MIGRATION_REQUIRED | needs_validation |
| ___xtr_customer | 34 MB | 59K | ✓ | 0 | XTR | non_tecdoc | TYPE_MIGRATION_REQUIRED | needs_validation |
| ___xtr_customer_*_address | 29 MB x2 | 59K | ✓ | 0 | XTR | non_tecdoc | OK | ready |
| seo_link_impressions | 25 MB | 104K | ✓ | 0 | SEO | non_tecdoc | OK | ready |
| __seo_gamme_conseil | 18 MB | 2.2K | ✓ | 0 | SEO | seo_dep | OK | ready |
| pieces_criteria_link | 18 MB | 77K | ✓ | 0 | Catalog | source_catalog | TYPE_MIGRATION_REQUIRED | needs_validation |
| __cross_gamme_car | 13 MB | 75K | ✓ | 0 | Cross | derived | DUPLICATE_SCOPE_VALIDATION_REQUIRED | needs_validation |
| __seo_keywords | 11 MB | 4.6K | ✓ | 0 | SEO | seo_dep | OK | ready |
| __seo_keyword_type_mapping | 11 MB | **0** | ✓ | 1 | SEO | seo_dep | EMPTY_ACTIVE_DESIGN | ready |
| pieces_gamme | 10 MB | 9.7K | ✓ | 0 | Catalog | source_catalog | TYPE_MIGRATION_REQUIRED | needs_validation |
| cars_engine | 10 MB | 36K | ✓ | 0 | Vehicle | lookup | OK | ready |

---

## 4. Tables Tier 3 — Config/Lookup/Small (<1 MB, >0 rows)

~60 tables actives. Toutes ont des PK (sauf `rm_rebuild_queue`). Points notables :

| Table | Rows | Probleme | TecDoc Role | Verdict | Gate |
|-------|------|----------|-------------|---------|------|
| ___xtr_order_line | 2.5K | 20 prix TEXT | non_tecdoc | TYPE_MIGRATION_REQUIRED | needs_validation |
| ___xtr_order | 1.6K | 8 prix TEXT | non_tecdoc | TYPE_MIGRATION_REQUIRED | needs_validation |
| ___config_old | 1 | Legacy | non_tecdoc | **DROP_READY** | ready |
| pieces_marque | 992 | 15 TEXT | source_catalog | TYPE_MIGRATION_REQUIRED | needs_validation |
| pieces_criteria_group | 4.3K | 3 ID TEXT | source_catalog | TYPE_MIGRATION_REQUIRED | needs_validation |
| auto_modele | 5.7K | 21 TEXT | source_catalog | TYPE_MIGRATION_REQUIRED | needs_validation |
| ___xtr_invoice* | 1 | 8 prix TEXT | non_tecdoc | TYPE_MIGRATION_REQUIRED | needs_validation |
| pieces_details | 1 | 5 ID TEXT | source_catalog | NEAR_EMPTY | needs_validation |
| pieces_ref_oem | 1 | — | source_catalog | NEAR_EMPTY | needs_validation |
| rm_rebuild_queue | 0 | **no PK** | non_tecdoc | PK_STRATEGY_REQUIRED | blocked |

---

## 5. Tables vides (0 rows) — Classification

| Classification | Count | Critere | Action |
|---------------|-------|---------|--------|
| **EMPTY_ACTIVE_DESIGN** | ~25 | Infrastructure deployee, consumers code confirmes | KEEP |
| **EMPTY_STAGING_REQUIRED** | ~10 | `stg_*`, `__staging_*`, `import_*` — pipeline import | KEEP |
| **EMPTY_OPTIONAL_FEATURE** | ~15 | Features pas encore activees (marketing, video, lighthouse) | KEEP, monitor |
| **EMPTY_ORPHAN_SUSPECT** | ~10 | 0 consumers code, pas de migration recente | Grep backend avant decision |
| **EMPTY_DROP_CANDIDATE** | ~8 | 0 rows, 0 consumers, 0 FK, aucun usage detecte | A valider puis DROP |

### Detail par groupe

| Groupe | Classification | Tables | Exemples |
|--------|---------------|--------|----------|
| Import pipeline | EMPTY_STAGING_REQUIRED | 10 | `import_batch`, `stg_*`, `__staging_*`, `__import_*` |
| Normalization | EMPTY_ACTIVE_DESIGN | 6 | `norm_article/brand/vehicle`, `natural_key_*` |
| Cross-reference | EMPTY_ACTIVE_DESIGN | 3 | `xref_article/brand/vehicle` |
| Decision engine | EMPTY_ACTIVE_DESIGN | 3 | `decision_article/brand/compat` |
| RM partitions | EMPTY_ACTIVE_DESIGN | 7 | `rm_listing_products_g*` |
| Knowledge graph | EMPTY_OPTIONAL_FEATURE | 8 | `kg_cases`, `kg_*_history`, `kg_*_log` |
| Marketing | EMPTY_OPTIONAL_FEATURE | 6 | `__marketing_campaigns/weekly_plans/...` |
| Video | EMPTY_OPTIONAL_FEATURE | 3 | `__video_assets/variants/templates` |
| Monitoring | EMPTY_ORPHAN_SUSPECT | 5 | `__lighthouse_*`, `__cron_runs`, `__airlock_bundles` |
| SEO empty | EMPTY_ORPHAN_SUSPECT | 5 | `__seo_quality_log`, `__seo_diagnostic`, ... |
| Commerce | EMPTY_DROP_CANDIDATE | 4 | `reviews`, `support_tickets`, `error_logs`, `error_statistics` — a confirmer contre backlog produit |

> **Regle** : aucune table classee EMPTY_DROP_CANDIDATE ne peut etre supprimee sans double validation :
> 1. Absence de consumer technique (grep backend + RPCs + vues)
> 2. Absence d'intention produit confirmee (backlog)

> **Cas special** : `__seo_keyword_type_mapping` (11 MB, 0 rows) — table vide mais 1 FK entrante. Classee EMPTY_ACTIVE_DESIGN.

---

## 6. Tables legacy / doublons

| Table | Taille | Rows | Flag | Evidence | Verdict | Gate |
|-------|--------|------|------|----------|---------|------|
| `___config_old` | 224 KB | 1 | OLD | measured (remplacee par `___config`) | **DROP_READY** | ready | rollback: recreate from migration |
| `pieces_marque_next` | 8 KB | 0 | NEXT | measured (vide, 0 consumers) | **DROP_READY** | ready | rollback: recreate from migration |
| `golden_set_products` | 32 KB | 0 | — | measured (vide, test) | **DROP_READY** | ready | rollback: recreate from migration |
| `__cross_gamme_car_new` | 41 MB | 175K | NEW | suspected (table active malgre suffixe _new) | **DUPLICATE_SCOPE_VALIDATION_REQUIRED** | needs_validation | — |
| `__cross_gamme_car` | 13 MB | 75K | — | suspected (doublon partiel de _new ?) | **DUPLICATE_SCOPE_VALIDATION_REQUIRED** | needs_validation | — |
| `gate_thresholds` | 96 KB | 17 | — | measured (config active) | KEEP | ready |

### Doublons suspects a investiguer (Vague 2)

| Paire | Question | Evidence |
|-------|----------|----------|
| `__cross_gamme_car` vs `__cross_gamme_car_new` | SoT ? Merger ? Supprimer l'ancien ? | suspected |
| `___meta_tags_ariane` vs `__blog_meta_tags_ariane` | 2 tables breadcrumbs, 5 rows chacune | suspected |

---

## 7. Matrice TEXT critique — Tables prioritaires pour shadow columns

| Table | Taille | IDs TEXT | Prix TEXT | Dates TEXT | TecDoc Role | Priorite |
|-------|--------|---------|----------|-----------|-------------|----------|
| `pieces_price` | 354 MB | 4 | **11** | 2 | source_catalog | **P0** |
| `pieces_criteria` | 5.4 GB | **5** | 0 | 1 | source_catalog | P1 |
| `___xtr_msg` | 11 GB | **7** | 0 | 1 | non_tecdoc | P1 |
| `auto_type` | 37 MB | **4** | 0 | **4** | source_catalog | P1 |
| `___xtr_order_line` | 2.6 MB | 7 | **20** | 1 | non_tecdoc | P2 |
| `___xtr_order` | 1.8 MB | 7 | **8** | 2 | non_tecdoc | P2 |
| `___xtr_invoice*` | 304 KB x2 | 10 | **16** | 1 | non_tecdoc | P2 |
| `pieces_criteria_link` | 18 MB | 3 | 0 | 0 | source_catalog | P2 |
| `pieces_gamme` | 10 MB | 1 | 0 | 0 | source_catalog | P3 |
| `pieces_marque` | 656 KB | 0 | 0 | 0 | source_catalog | P3 |
| `auto_modele` | 1.1 MB | 0 | 0 | 0 | source_catalog | P3 |

---

## 8. Jointures implicites candidates a formalisation FK

### Categorie A — Naming coherent + usage RPC confirme + cible PK connue

| Table source | Colonne | Evidence |
|-------------|---------|----------|
| pieces_media_img | pmi_piece_id | inferred (naming + usage RPC) |
| pieces_ref_ean | pre_piece_id | inferred |
| pieces_ref_search | prs_piece_id | inferred |
| pieces_price | pri_piece_id | inferred |
| pieces_list | pli_piece_id | inferred |
| pieces_criteria | pc_piece_id | inferred |

> 6 jointures vers `pieces.piece_id`. Naming coherent, usage confirme dans les RPCs.

### Categorie B — Naming coherent, validation type/cardinalite manquante

| Table source | Colonne | Table cible | Colonne cible | Evidence |
|-------------|---------|-------------|---------------|----------|
| pieces_relation_criteria | rcp_type_id | pieces_relation_type | rtp_type_id | inferred (F4 perf-findings.md) |
| pieces_relation_type | rtp_piece_id | pieces | piece_id | inferred (naming) |

> Jointures utilisees dans le hot path RPC. Cibles probables mais types a verifier (TEXT vs INT).

### Categorie C — Cible non confirmee

| Table source | Colonne | Cible supposee | Probleme | Evidence |
|-------------|---------|---------------|----------|----------|
| pieces_relation_type | rtp_type_id | ? | Cible non identifiee formellement | suspected |

> Necessite grep backend + analyse RPC pour identifier la table cible.

**Rappel** : toute FK ajoutee utilisera le pattern `NOT VALID` + `VALIDATE` en background (zero lock).

---

## 9. Verdicts par table — Resume

| Verdict | Count | Description |
|---------|-------|-------------|
| **OK** | ~80 | Aucune action structurelle |
| **TYPE_MIGRATION_REQUIRED** | ~15 | Shadow columns (TEXT → type natif) |
| **PK_STRATEGY_REQUIRED** | 3 | Audit unicite prealable obligatoire |
| **FK_CANDIDATE_A** | 6 | FK quasi certaines, audit orphelins prealable |
| **FK_CANDIDATE_B** | 2 | FK probables, verification types prealable |
| **FK_CANDIDATE_C** | 1 | FK incertaines, cible a identifier |
| **EMPTY_ACTIVE_DESIGN** | ~25 | Tables vides, infrastructure deployee |
| **EMPTY_STAGING_REQUIRED** | ~10 | Tables import/staging |
| **EMPTY_OPTIONAL_FEATURE** | ~15 | Features non activees |
| **EMPTY_ORPHAN_SUSPECT** | ~10 | A verifier par grep |
| **EMPTY_DROP_CANDIDATE** | ~8 | 0 consumers, 0 rows |
| **DROP_READY** | 3 | `___config_old`, `pieces_marque_next`, `golden_set_products` |
| **DUPLICATE_SCOPE_VALIDATION_REQUIRED** | 3 | Doublons a investiguer |
| **NEAR_EMPTY** | ~8 | 1 row, probablement init/test |

---

## 10. Preconditions before any schema change

1. **Aucune PK ajoutee** sans audit d'unicite (SELECT count(*) vs count(DISTINCT ...))
2. **Aucune FK ajoutee** sans audit d'orphelins (valeurs sans correspondance dans la table cible)
3. **Aucune shadow column** sans mapping de cast deterministe (compter les valeurs non-castables)
4. **Aucune fusion de table** sans preuve de couverture fonctionnelle (grep + consumers)
5. **Aucun renommage** de table active sans cartographie complete des consumers (backend + RPCs + vues)
6. **Aucune decision TecDoc** sans classification source_of_truth confirmee

---

## 11. Criteres de sortie — Vague 2

Une table peut passer en Vague 4 (corrections structurelles) **seulement si** :

1. `source_of_truth` confirmee (pas `unknown`)
2. `readiness_tecdoc` ≠ `out_of_scope`
3. **PK** : unicite prouvee ou strategie validee (V2.1)
4. **FK** : orphelins mesures et plan traitable (V2.2)
5. **Types** : taux de cast invalide mesure et < 0.1% (V2.3)
6. **Consumers** cartographies si table active metier (V2.5)

> Detail de l'execution dans `phase-3-v2-validation-plan.md`.

### Priorite operationnelle V2

Ordre de traitement (tables bloquantes pour readiness TecDoc en premier) :

1. `pieces_relation_type` — blocked_by_pk, 146M rows, hot path F4
2. `pieces_media_img` — blocked_by_pk, 4.6M rows
3. `pieces_price` — blocked_by_type_debt, 11 prix TEXT (P0)
4. `pieces_criteria` — blocked_by_type_debt, 5 IDs TEXT
5. `auto_type` — type_migration, 4 IDs + 4 dates TEXT
6. `__cross_gamme_car` / `_new` — duplicate_scope
7. `___config_old` / `pieces_marque_next` / `golden_set_products` — drop_ready (trivial)

> Une table peut sortir de V2 avec statut `ready_for_v4`, `blocked` (investigation supplementaire), ou `deferred` (hors perimetre TecDoc immediat).

---

## 12. Plan d'action recommande (Vagues 2-6)

### Vague 2 — Validation structurelle (READ-ONLY)

| # | Action | Cible | Methode |
|---|--------|-------|---------|
| 2.1 | Audit candidate PK (unicite) | `pieces_relation_type`, `pieces_media_img` | SQL GROUP BY/HAVING + sampled/full validation selon volumetrie |
| 2.2 | Audit orphelins FK | 6 FK cat. A + 2 FK cat. B | SQL LEFT JOIN ... WHERE cible IS NULL |
| 2.3 | Audit colonnes TEXT critiques | 11 tables P0-P2 | SQL cast test (count non-castable) |
| 2.4 | Audit doublons table/table | `__cross_gamme_car*`, `___meta_tags_ariane*` | Schema comparison + row overlap |
| 2.5 | Classification source de verite | Tier 1+2 tables | Grep backend + RPC analysis |
| 2.6 | Verdict readiness TecDoc par table | Tables source_catalog | Synthese 2.1-2.5 |

**Livrable** : enrichissement de ce document V1.2.0 avec resultats mesures.

### Vague 3 — Nettoyage trivial (0 risque) — DONE 2026-03-15

1. ~~DROP `___config_old`, `pieces_marque_next`, `golden_set_products`~~ — migration `vague3_drop_obsolete_tables` appliquee
2. Documenter decision `__cross_gamme_car` vs `_new` (apres V2.4)

### Vague 4 — Corrections structurelles non-destructives

4a. ADD PK (apres V2.1 unicite confirmee) — PARTIAL 2026-03-15
    - ✅ `rm_rebuild_queue` PK (rmrq_gamme_id, rmrq_vehicle_id)
    - ✅ `pieces_media_img` PK (pmi_piece_id, pmi_name) — 10 headers CSV deleted first
    - ✅ `pieces_relation_type` — 146M rows, table swap batch (v2 with PK, old renamed `_old`). Index `popular` recréé, `type_composite` pending (timeout)
4b. ADD shadow columns + batch backfill (apres V2.3 cast valide) — DONE 2026-03-15
    - ✅ `pieces_price` : 15 shadow cols (13 NUMERIC + 1 TIMESTAMPTZ + 1 DATE), 442K rows backfilled
    - ✅ `auto_type` : 8 shadow cols (INTEGER), 49K rows backfilled
4c. ADD FK NOT VALID + VALIDATE (apres V2.2 orphelins resolus) — PARTIAL 2026-03-15
    - ✅ 707 orphelins supprimés (6 tables Cat A)
    - ✅ Shadow cols `*_piece_id_i INTEGER` ajoutées + backfillées sur 6 tables (442K+1.8M+3M+4.6M+17.6M+73M)
    - `pieces_ref_search` : table swap v2 (avec prs_piece_id_i), old gardée. Index kind recréé, autres index pending (timeout 70M+)
    - ✅ FK VALIDATED sur 6 tables (`*_piece_id_i` → `pieces(piece_id)`)
    - ✅ Tables _old droppées (pieces_relation_type_old, pieces_ref_search_old)
    - ✅ Index `pieces_ref_search` recréés (7/7) via pg_cron background
    - ✅ Index `type_composite` `pieces_relation_type` recréé via pg_cron background

### Vague 5 — Migration code (backend) — DONE 2026-03-15

Column swap en DB (zero code change) : colonnes TEXT renommées `*_text`, shadow cols prennent le nom original.
- ✅ `pieces_price` : 16 colonnes swappées (13 NUMERIC + 1 TIMESTAMPTZ + 1 DATE + 1 INTEGER)
- ✅ `auto_type` : 8 colonnes swappées (INTEGER)
- ✅ 5 tables piece_id swappées (INTEGER) : media_img, list, ref_ean, criteria, ref_search
- ✅ Types TS régénérés (number au lieu de string)

### Vague 6 — TecDoc Update Readiness

Classification finale `SAFE` / `FIXED` / `DOCUMENTED` + dry-run update.

---

## 13. Resultats Vague 2 — Validation Structurelle (2026-03-14)

> Toutes les mesures ci-dessous sont **read-only**. Aucune modification schema n'a ete effectuee.

### V2.5 — Source de Verite (measured)

| Table | Backend consumers | RPC consumers | SoT verdict | Confidence |
|-------|-------------------|---------------|-------------|------------|
| `__cross_gamme_car_new` | 1 (blog-article-relation) | 3-4 RPCs | **derived** | medium |
| `__cross_gamme_car` | 1 (gamme-detail-enricher) | 4-5 RPCs | **derived** (deprecated) | high |
| `pieces_ref_search` | 6 services | 4 RPCs | **derived** (search index) | high |

> Aucune des 3 tables n'est source de verite. `__cross_gamme_car` est marquee pour deprecation (migrate to `_new` then DROP).

### V2.4 — Doublons (measured)

**Paire 1 : `__cross_gamme_car` vs `__cross_gamme_car_new`**

| Metrique | Valeur |
|----------|--------|
| Schema | Compatible (6 cols vs 7 cols — `_new` a `cgc_mdg_id` en plus) |
| Key | `(cgc_pg_id, cgc_type_id)` |
| Old rows | 75 289 |
| New rows | 175 524 |
| Common | 68 202 |
| Old only | 7 087 |
| New only | 105 540 |
| **Verdict** | **candidate_successor** — couvre 90.6% de old + 105K lignes additionnelles, mais 7 087 lignes old_only restent a migrer (quasi-superset non strict) |

> Decision : migrer les 7 087 orphelins `old_only` vers `_new`, puis deprecer `__cross_gamme_car`.

**Paire 2 : `___meta_tags_ariane` vs `__blog_meta_tags_ariane`**

| Metrique | Valeur |
|----------|--------|
| Schema | **Identique** (9 cols, memes noms/types) |
| Key | `mta_id` |
| Total triple | 5 |
| Total blog | 5 |
| Common | 0 |
| **Verdict** | **DISJOINT** — meme structure, donnees totalement differentes |

> Pas de doublon de donnees. Tables distinctes par domaine (catalog vs blog).

### V2.1 — Audit PK (measured)

| Table | Total rows | Candidate key | Duplicate groups | Duplicate rows | Strategy | Gate |
|-------|-----------|---------------|-----------------|---------------|----------|------|
| `pieces_relation_type` | 146 371 196 | `(rtp_type_id, rtp_piece_id)` | **0** (5% sample = 7.3M rows) | 0 | **composite_pk_candidate_high_confidence** | conditional_ready |
| `pieces_media_img` | 4 623 813 | `(pmi_piece_id, pmi_name)` | **1** (10 header rows CSV) | 9 | **deduplicate_first(10) + validate_key_semantics** | ready_after_cleanup |
| `rm_rebuild_queue` | 0 | `(rmrq_gamme_id, rmrq_vehicle_id)` | — | — | **trivial_empty_table_pk** | ready |

> `pieces_relation_type` : full scan timeout (146M), mais 5% sample (7.3M rows) = 0 doublons. Confidence high mais non exhaustive — full validation requise avant ADD CONSTRAINT.
> `pieces_media_img` : 10 rows sont des headers CSV importes comme donnees (`pmi_piece_id = 'pmi_piece_id'`). 9 lignes excedentaires a supprimer (1 canonique conservee). Cle candidate `(pmi_piece_id, pmi_name)` valide sous hypothese que `pmi_name` identifie une image de maniere stable par piece — a confirmer contre usage applicatif.

### V2.3 — Castability TEXT (measured)

**`pieces_price`** (442 173 rows) :

| Colonne | Type cible | Total | Empty | Castable | Invalid | Ratio | Verdict |
|---------|-----------|-------|-------|----------|---------|-------|---------|
| pri_public_ht | NUMERIC | 442K | 0 | 442 173 | 0 | 0% | **cast_safe** |
| pri_gros_ht | NUMERIC | 442K | 0 | 442 173 | 0 | 0% | **cast_safe** |
| pri_achat_ht | NUMERIC | 442K | 0 | 442 173 | 0 | 0% | **cast_safe** |
| pri_vente_ht | NUMERIC | 442K | 0 | 442 173 | 0 | 0% | **cast_safe** |
| pri_vente_ttc | NUMERIC | 442K | 0 | 442 173 | 0 | 0% | **cast_safe** |
| pri_consigne_ht | NUMERIC | 442K | — | — | 0 | 0% | **cast_safe** |
| pri_consigne_ttc | NUMERIC | 442K | — | — | 0 | 0% | **cast_safe** |
| pri_remise | NUMERIC | 442K | — | — | 0 | 0% | **cast_safe** |
| pri_marge | NUMERIC | 442K | — | — | 0 | 0% | **cast_safe** |
| pri_frais_port_ht | NUMERIC | 442K | — | — | 0 | 0% | **cast_safe** |
| pri_frais_supp_ht | NUMERIC | 442K | — | — | 0 | 0% | **cast_safe** |
| pri_tva | NUMERIC | 442K | — | — | 0 | 0% | **cast_safe** |
| pri_vente_tn_ttc | NUMERIC | 442K | — | — | 0 | 0% | **cast_safe** |
| pri_date_from | TIMESTAMPTZ | 442K | 0 | 442 173 | 0* | 0% | **cast_safe** |
| pri_date_to | DATE | 442K | — | — | 0 | 0% | **cast_safe** |

> *`pri_date_from` : format ISO timestamp (`2022-07-01T00:00:00.000Z`), pas `YYYY-MM-DD`. Cast safe en TIMESTAMPTZ (pas DATE simple).

**`auto_type`** (48 918 rows) :

| Colonne | Type cible | Invalid | Verdict |
|---------|-----------|---------|---------|
| type_id | INTEGER | 0 | **cast_safe** |
| type_tmf_id | INTEGER | 0 | **cast_safe** |
| type_modele_id | INTEGER | 0 | **cast_safe** |
| type_marque_id | INTEGER | 0 | **cast_safe** |
| type_month_from | INTEGER | 0 | **cast_safe** |
| type_year_from | INTEGER | 0 | **cast_safe** |
| type_month_to | INTEGER | 0 | **cast_safe** |
| type_year_to | INTEGER | 0 | **cast_safe** |

> **Verdict global V2.3** : 0% invalid sur toutes les colonnes testees. Shadow columns safe pour les 2 tables P0-P1.

### V2.2 — FK Orphelins (measured)

**Cat. A — vers `pieces.piece_id`** :

| Table | Colonne | Non-castable | Orphans | Total | Ratio | Verdict |
|-------|---------|-------------|---------|-------|-------|---------|
| pieces_media_img | pmi_piece_id | 10 (headers) | 77 | 4.6M | 0.002% | **FK_READY_AFTER_CLEANUP** |
| pieces_ref_ean | pre_piece_id | 0 | 83 | 3M | 0.003% | **FK_READY_AFTER_CLEANUP** |
| pieces_ref_search | prs_piece_id | 0 | 219 | 73M | 0.0003% | **FK_READY_AFTER_CLEANUP** |
| pieces_price | pri_piece_id | 0 | 12 | 442K | 0.003% | **FK_READY_AFTER_CLEANUP** |
| pieces_list | pli_piece_id | 0 | 7 | 1.8M | 0.0004% | **FK_READY_AFTER_CLEANUP** |
| pieces_criteria | pc_piece_id | 0 | 309 | 17.6M | 0.002% | **FK_READY_AFTER_CLEANUP** |

> Tous < 0.01%. Total orphelins Cat A : **707 rows** sur ~100M. Plan : DELETE orphelins avant ADD FK.

**Cat. B — jointures inter-catalogue** :

| FK candidate | Non-castable | Orphans | Evidence | Verdict |
|-------------|-------------|---------|----------|---------|
| `rcp_type_id → rtp_type_id` | 0 (same type) | **0** (exhaustif) | measured | **FK_READY** |
| `rtp_piece_id → piece_id` | 0 (INTEGER) | **0** (sample 10K) | sampled | **FK_READY** (confidence medium) |

### V2.6 — Matrice Readiness TecDoc (SYNTHESE)

| Table | SoT (V2.5) | Doublons (V2.4) | PK (V2.1) | Types (V2.3) | FK (V2.2) | **Readiness V2** |
|-------|-----------|----------------|-----------|-------------|-----------|-----------------|
| **pieces** | source | — | ✓ | OK | ✓ (ref) | **ready_for_v4** |
| **pieces_relation_type** | source | — | candidate high confidence (sample 5%) | OK (INTEGER) | FK_READY (B) | **conditional_ready_for_v4** (full PK validation pending) |
| **pieces_media_img** | source | — | dedup 10 rows + key semantics validation | type_debt_non_blocking_for_v4 | FK_READY_AFTER_CLEANUP(77) | **ready_for_v4_after_cleanup** |
| **pieces_price** | source | — | ✓ | cast_safe (0%) | FK_READY_AFTER_CLEANUP(12) | **ready_for_v4_after_cleanup** |
| **pieces_criteria** | source | — | ✓ | cast_safe (0%) | FK_READY_AFTER_CLEANUP(309) | **ready_for_v4_after_cleanup** |
| **pieces_ref_search** | derived | — | ✓ | cast_safe (0%) | FK_READY_AFTER_CLEANUP(219) | **ready_for_v4_after_cleanup** |
| **pieces_ref_ean** | source | — | ✓ | — | FK_READY_AFTER_CLEANUP(83) | **ready_for_v4_after_cleanup** |
| **pieces_list** | source | — | ✓ | — | FK_READY_AFTER_CLEANUP(7) | **ready_for_v4_after_cleanup** |
| **pieces_relation_criteria** | source | — | ✓ | OK | FK_READY (B) | **ready_for_v4** |
| **auto_type** | source | — | ✓ | cast_safe (0%) | — | **ready_for_v4** |
| **__cross_gamme_car** | derived (deprecated) | subset partiel couvert a 90.6% par _new | ✓ | TEXT | — | **deferred** (migrate 7087 old_only to _new) |
| **__cross_gamme_car_new** | derived | candidate_successor (quasi-superset non strict) | ✓ | TEXT | — | **ready_for_v4_after_gap_resolution** |

> **Resultat** : **3 tables ready_for_v4** (pieces, pieces_relation_criteria, auto_type), **6 ready_for_v4_after_cleanup** (FK orphelins), 1 conditional_ready (PK pending), 1 ready_after_cleanup (PK + key semantics), 1 ready_after_gap_resolution, 1 deferred. 0 blocked.
> **Prerequis Vague 4** : DELETE 707 orphelins Cat A + DELETE 10 header rows `pieces_media_img` + full PK validation `pieces_relation_type` + migrate 7087 old_only `__cross_gamme_car` → `_new`.

---

## Refs croisees

| Document | Role |
|----------|------|
| domain-map.md V1.4.3 | Classification 15 domaines |
| final-exec-summary.md V1.4.2 | Baseline perf Phase 1-2 |
| db-monitoring-runbook.md V1.0.0 | Monitoring M1-M6 |
| table-remediation-matrix.md V1.4.2 | Decisions Phase 1 |
| perf-findings.md V1.0.3 | F1-F4, T1-T6 |
