# Inventaire des tables de massdoc — 2026-11-18 (mandat CA, étape 1)

> Niveau L0 : relevé daté, pas une règle. Relevé SELECT en lecture seule, 2026-11-18 entre 09:58 et 10:12 UTC, commit du code `f0081e635142`. Compteurs d’activité depuis la remise à zéro du 2026-09-17 00:53 UTC (≈ 62 jours). Aucune donnée de client lue : noms, comptes et tailles seulement. Version machine : `audit/massdoc-table-inventory-2026-11-18.json`.

Légende des preuves : **mesuré** = relevé en base ou `git grep` ; **déduit** = règle appliquée aux mesures ; **proposé** = à décider par Marwane ; **non fait** = hors de portée de ce relevé.

## 1. Réponse simple

- Le schéma public compte **718 objets de table** (mesuré). **355** ne sont que des tranches de 17 tables partitionnées : on les compte une fois, au parent. Il reste **363 tables**.
- **211 sont utiles** aujourd’hui (écrites, lues par l’application ou par une fonction appelée) — déduit. Parmi elles, 30 sont branchées mais vides et jamais écrites depuis le 2026-09-17 (une file vide, un journal sans incident…).
- **40 peuvent être archivées** (déplacées dans `_archive`, pas supprimées) : 39 tables mortes et 1 copie datée — déduit. Les 8 autres copies datées sont des `pieces_media_img_*` : zone interdite, gardées.
- **104 sont à trancher** : chaque ligne porte la question à poser. Aucune n’est archivée par ce relevé.
- **0 table prévue** (créée après le 2026-09-01 et jamais écrite) — déduit.

## 2. Synthèse par classe

| Classe | Tables | Taille (Mo) |
|---|---:|---:|
| vivante | 211 | 130 838.4 |
| prévue | 0 | 0.0 |
| copie datée | 9 | 178.8 |
| morte | 39 | 4.0 |
| à trancher | 104 | 1 038.0 |
| **Total** | **363** | 132 059.3 |

Contrôle : somme des classes = 363 = 346 tables simples + 17 parents partitionnés (mesuré, `q1_counts`).

## 3. Synthèse par département

Département = module qui écrit la table (mesuré), sinon module qui la lit, sinon préfixe du nom (déduit). Le module `admin` (01) est trop large et n’est pas utilisé pour attribuer.

| Département | vivante | prévue | copie datée | morte | à trancher | Total |
|---|---:|---:|---:|---:|---:|---:|
| 04 marketing | 9 | 0 | 0 | 3 | 2 | 14 |
| 06 content | 10 | 0 | 0 | 0 | 0 | 10 |
| 07 seo | 79 | 0 | 0 | 15 | 26 | 120 |
| 08 media | 5 | 0 | 8 | 0 | 1 | 14 |
| 09 wiki | 3 | 0 | 0 | 3 | 0 | 6 |
| 10 catalog | 30 | 0 | 1 | 9 | 43 | 83 |
| 11 diagnostic | 17 | 0 | 0 | 6 | 13 | 36 |
| 12 supplier | 2 | 0 | 0 | 0 | 2 | 4 |
| 13 sales | 16 | 0 | 0 | 0 | 3 | 19 |
| 14 support | 12 | 0 | 0 | 1 | 1 | 14 |
| 15 logistics | 2 | 0 | 0 | 0 | 1 | 3 |
| 16 pricing | 6 | 0 | 0 | 0 | 4 | 10 |
| 17 finance | 0 | 0 | 0 | 0 | 2 | 2 |
| 20 product | 1 | 0 | 0 | 0 | 4 | 5 |
| 21 runtime | 3 | 0 | 0 | 0 | 0 | 3 |
| 22 data | 0 | 0 | 0 | 1 | 0 | 1 |
| 23 ia-agents | 15 | 0 | 0 | 1 | 2 | 18 |
| 24 people | 1 | 0 | 0 | 0 | 0 | 1 |

## 4. Tables partitionnées (comptées une fois)

| Parent | Classe | Tranches | Vides | Futures | Première → dernière | Rotation (cron) | Rétention en service | Jours couverts |
|---|---|---:|---:|---:|---|---|---|---:|
| `__seo_cwv_daily` | à trancher | 11 | 11 | 3 | 2026-04-01 → 2027-02-01 | cron#16 observability-partition-rotation + cron#22 seo-ensure-monthly-partitions | avance 3 mois, supprime après 18 mois | 103 |
| `__seo_cwv_daily_rum` | vivante | 10 | 3 | 3 | 2026-05-01 → 2027-02-01 | cron#20 cwv-daily-rum-rotation | avance 3 mois, supprime après 12 mois | 103 |
| `__seo_cwv_hourly` | vivante | 18 | 3 | 3 | 2026-11-04 → 2026-11-21 | cron#19 cwv-hourly-rotation | avance 3 j, supprime après 14 j | 4 |
| `__seo_cwv_raw` | vivante | 6 | 3 | 3 | 2026-11-16 → 2026-11-21 | cron#18 cwv-raw-rotation | avance 3 j, supprime après 2 j | 4 |
| `__seo_ga4_daily` | vivante | 11 | 3 | 3 | 2026-04-01 → 2027-02-01 | cron#16 observability-partition-rotation + cron#22 seo-ensure-monthly-partitions | avance 3 mois, supprime après 18 mois | 103 |
| `__seo_gsc_daily` | vivante | 11 | 3 | 3 | 2026-04-01 → 2027-02-01 | cron#16 observability-partition-rotation + cron#22 seo-ensure-monthly-partitions | avance 3 mois, supprime après 18 mois | 103 |
| `__seo_gsc_daily_page_totals` | vivante | 9 | 3 | 3 | 2026-06-01 → 2027-02-01 | cron#22 seo-ensure-monthly-partitions | crée seulement : aucune suppression | 103 |
| `__seo_gsc_daily_pages` | vivante | 9 | 3 | 3 | 2026-06-01 → 2027-02-01 | cron#22 seo-ensure-monthly-partitions | crée seulement : aucune suppression | 103 |
| `__seo_gsc_daily_property_total` | vivante | 9 | 3 | 3 | 2026-06-01 → 2027-02-01 | cron#22 seo-ensure-monthly-partitions | crée seulement : aucune suppression | 103 |
| `__seo_gsc_daily_totals` | vivante | 9 | 3 | 3 | 2026-06-01 → 2027-02-01 | cron#22 seo-ensure-monthly-partitions | crée seulement : aucune suppression | 103 |
| `__seo_quality_history` | vivante | 8 | 7 | 1 | 2026-05-01 → 2026-12-01 | cron#17 quality-history-partition-rotation | crée seulement : aucune suppression | 44 |
| `__seo_snapshot_cf_rum` | à trancher | 105 | 105 | 14 | 2026-08-20 → 2026-12-02 | cron#15 snapshot-partition-rotation | avance 14 j, supprime après 90 j | 15 |
| `__seo_snapshot_synthetic` | vivante | 105 | 32 | 14 | 2026-08-20 → 2026-12-02 | cron#15 snapshot-partition-rotation | avance 14 j, supprime après 90 j | 15 |
| `pieces_price_history` | vivante | 9 | 7 | 1 | 2026-05-01 → 2026-12-01 + DEFAULT | cron#24 pieces-price-history-partition-rotation | crée seulement : aucune suppression | 44 |
| `pricing_decision_snapshot` | à trancher | 9 | 9 | 1 | 2026-05-01 → 2026-12-01 + DEFAULT | cron#25 pricing-decision-snapshot-partition-rotation | crée seulement : aucune suppression | 44 |
| `rm_listing_products` | à trancher | 7 | 7 | 0 | None → None + DEFAULT | aucun | aucune rotation (partitions par gamme) | — |
| `supplier_offer_snapshot` | à trancher | 9 | 9 | 1 | 2026-05-01 → 2026-12-01 + DEFAULT | cron#26 supplier-offer-snapshot-partition-rotation | crée seulement : aucune suppression | 44 |

Total : 355 tranches, dont 214 vides (mesuré, `exists()` par tranche).

### 4.1 `__seo_snapshot_cf_rum` : 105 tranches vides

- **Mesuré** : 105 tranches sur 105 sont vides (du 2026-08-20 au 2026-12-02), 0 insertion depuis le 2026-09-17. La rotation cron#15 tourne chaque nuit et réussit (dernier passage 2026-11-18 02:20 UTC).
- **Mesuré dans le code** : l’écrivain existe (`backend/src/modules/seo-control-plane/collectors/cf-rum/cf-rum.service.ts`, PR #583 du 2026-05-17). Son ordonnanceur ne démarre que si `SEO_CP_CF_RUM_ENABLED=true` ; la valeur par défaut est `false` (`cf-rum.scheduler.service.ts`, `backend/.env.example:271`) et la variable est absente du `backend/.env` du DEV.
- **Déduit** : la collecte n’est pas « arrêtée » ; elle n’a vraisemblablement jamais été activée ici. Aucune écriture depuis au moins le 2026-08-20 (plus ancienne tranche gardée par la rétention de 90 jours).
- **Non établi** : la valeur du drapeau en PROD (aucun accès), et l’existence de lignes entre le 2026-05-17 et le 2026-08-20 (tranches déjà supprimées par la rotation).
- Décision déjà posée au lot D (2026-09-15) et toujours ouverte : activer le collecteur (jeton Cloudflare) **ou** retirer `cf_rum` de `maintain_snapshot_partitions`. Rien n’est changé par ce mandat.

### 4.2 Écart avec le contrôle `partition-cron-gap`

Le contrôle (`.claude/skills/runtime-truth-audit/checks/partition-cron-gap.md`, script `scripts/audit/runtime-truth/partition-cron-gap.ts`) lit la fonction `__gov_m8_partition_coverage()`. Relevée le 2026-11-18 10:09 UTC (mesuré), elle ne signale **rien** : toutes les tables ont un cron et au moins 4 jours devant elles (`__seo_cwv_hourly` et `__seo_cwv_raw` : 4 jours, au-dessus des seuils 2 et 7 jours du script pour une table avec cron).

Ce que le contrôle ne voit pas (mesuré ici) :
1. **Rétention absente** : 8 tables partitionnées reçoivent de nouvelles tranches sans que les anciennes soient jamais supprimées (`__seo_gsc_daily_page_totals`, `__seo_gsc_daily_pages`, `__seo_gsc_daily_property_total`, `__seo_gsc_daily_totals`, `__seo_quality_history`, `pieces_price_history`, `pricing_decision_snapshot`, `supplier_offer_snapshot`). Le contrôle ne lit pas la rétention.
2. **Tables tournées mais toujours vides** : `__seo_snapshot_cf_rum` (105/105 vides) passe le contrôle. Il ne regarde pas si les tranches reçoivent des lignes.
3. **Partitions par liste** : `rm_listing_products` (7 tranches, sans cron) est ignorée, la fonction ne lit que les partitions par plage.
4. Le test « a un cron » accepte tout cron dont la commande contient `maintain…partition` : un cron qui en tourne une autre suffit.

Ces écarts sont signalés, pas corrigés (hors mandat).

## 5. Autres schémas (une ligne chacun)

- `_archive` : 62 tables (670 Mo) et 15 vues ; contient déjà les lots D (cars_engine, __qa_audit_*, signal_s*) ; aucune nouvelle entrée par ce mandat (mesuré).
- `tecdoc_doc / tecdoc_ext / tecdoc_map / tecdoc_norm / tecdoc_raw` : 28 tables + 3 vues matérialisées, ≈ 3,7 Go ; hors périmètre (une ligne) (mesuré).
- `auth` : 27 tables, 1,1 Mo ; géré par Supabase, hors périmètre (mesuré).
- `storage` : 10 tables, 2,2 Go ; géré par Supabase, hors périmètre (mesuré).
- `realtime` : 2 tables + 1 partitionnée, 56 ko ; géré par Supabase, hors périmètre (mesuré).
- `cron` : 2 tables, 10 Mo ; job_run_details purgé par cron#32 (lot E du 09-15 voisin) (mesuré).
- `supabase_migrations / vault / _filter / infra / extensions` : 1 + 1 + 1 + 1 tables, vues d’extension ; hors périmètre (mesuré).
- `public (hors tables)` : 45 vues et 4 vues matérialisées, non classées par ce mandat (mesuré).

## 6. Tables à archiver (candidats)

40 tables. Détail des preuves et format du lot : `docs/audit/mandat-ca-20261118/candidats-archivage.md`.

## 7. Tables à trancher, avec leur question

| Table | Dépt | Mo | Lignes (est.) | Question |
|---|---|---:|---:|---|
| `___config_ip` | 20 product | 0.1 | 3 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `___footer_menu` | 20 product | 0.1 | 13 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `___header_menu` | 20 product | 0.1 | 6 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `___xtr_invoice` | 17 finance | 0.3 | 1 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? (19 appels du rôle de l’API mesurés) |
| `___xtr_invoice_line` | 17 finance | 0.3 | 1 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `___xtr_order_line_equiv_ticket` | 13 sales | 0.1 | 13 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? (2 appels du rôle de l’API mesurés) |
| `__abandoned_cart_emails` | 13 sales | 0.0 | 0 | Code présent mais table vide et jamais écrite depuis le 2026-09-17 : fonctionnalité non activée (laquelle, quand ?) ou abandonnée ? |
| `__catalog_id_mapping` | 10 catalog | 0.5 | 950 | Seules des fonctions SQL jamais appelées la citent (get_automecanik_id, get_catalog_mapping_stats, get_external_id, merge_staging_brands) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__cnit_raw` | 10 catalog | 16.8 | 55060 | Aucun lecteur dans le dépôt mais 8376 parcours d’index et 7866 parcours séquentiels depuis le 2026-09-17 : quel lecteur extérieur ? Le relevé du 2026-09-15 la garde : source RAW du chantier R8 levier A. |
| `__diag_context_questions` | 11 diagnostic | 0.0 | 5 | Seules des fonctions SQL jamais appelées la citent (get_context_questions) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__diag_related_parts` | 11 diagnostic | 0.1 | 7 | Seules des fonctions SQL jamais appelées la citent (diagnose_symptoms) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__diag_symptom_family` | 11 diagnostic | 0.1 | 35 | Seules des fonctions SQL jamais appelées la citent (diagnose_symptoms) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__diag_symptoms` | 11 diagnostic | 0.1 | 31 | Seules des fonctions SQL jamais appelées la citent (diagnose_symptoms, get_symptoms_by_subsystem) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__import_batch_contract` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (check_gate_g0, create_batch_contract, create_batch_contract_v2, get_import_gate_report) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__import_gate_status` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (all_gates_passed, can_merge_batch, check_gate, get_import_gate_report) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__import_manifest` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (check_gate_g0, check_manifest_complete) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__import_proof` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (check_gate, get_import_gate_report) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__marketing_campaigns` | 04 marketing | 0.0 | 0 | Code présent mais table vide et jamais écrite depuis le 2026-09-17 : fonctionnalité non activée (laquelle, quand ?) ou abandonnée ? |
| `__marketing_outreach` | 04 marketing | 0.0 | 0 | Code présent mais table vide et jamais écrite depuis le 2026-09-17 : fonctionnalité non activée (laquelle, quand ?) ou abandonnée ? |
| `__quarantine_history` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (add_to_quarantine, apply_quarantine_rules, resolve_quarantine_item) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__quarantine_items` | 10 catalog | 0.1 | 0 | Seules des fonctions SQL jamais appelées la citent (add_to_quarantine, apply_quarantine_rules, get_purchase_excluded_ids, get_quarantine_dashboard) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__quarantine_rules` | 10 catalog | 0.0 | 4 | Seules des fonctions SQL jamais appelées la citent (apply_quarantine_rules) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__seo_action_outcome` | 07 seo | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (rpc_seo_action_outcomes_materialize_v1, rpc_seo_action_outcomes_v1) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__seo_content_events` | 07 seo | 0.2 | 23 | Seules des fonctions SQL jamais appelées la citent (seo_apply_h1_write) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__seo_cwv_daily` | 07 seo | 0.3 | 0 | Seul un cron d’entretien la touche (cron#16 observability-partition-rotation) ; vide et jamais écrite depuis le 2026-09-17. L’écrivain existe (cwv-fetcher.service.ts) mais n’a rien écrit : l’activer, ou abandonner la table (et son entretien) ? |
| `__seo_entity_sources` | 07 seo | 0.0 | 0 | Nom présent dans le code sans requête reconnue (scripts/audit/build-db-usage-map.test.ts) : usage réel ? |
| `__seo_gsc_links_weekly` | 07 seo | 0.0 | 0 | Code présent mais table vide et jamais écrite depuis le 2026-09-17 : fonctionnalité non activée (laquelle, quand ?) ou abandonnée ? |
| `__seo_internal_link` | 07 seo | 0.0 | 0 | Code présent mais table vide et jamais écrite depuis le 2026-09-17 : fonctionnalité non activée (laquelle, quand ?) ou abandonnée ? |
| `__seo_keyword_type_mapping` | 07 seo | 11.1 | 0 | Seules des fonctions SQL jamais appelées la citent (get_extras_v4_type_ids, get_missing_v4_type_ids, get_vlevel_champions, get_vlevel_section_k_extras) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__seo_policy_evaluations` | 07 seo | 0.1 | 0 | Seules des fonctions SQL jamais appelées la citent (seo_apply_h1_write) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__seo_quality_log` | 07 seo | 0.0 | 0 | Code présent mais table vide et jamais écrite depuis le 2026-09-17 : fonctionnalité non activée (laquelle, quand ?) ou abandonnée ? |
| `__seo_r2_eligibility_log` | 07 seo | 0.0 | 0 | Citée seulement en commentaire dans le code, aucune écriture ni lecture d’application mesurée : archiver après retrait du commentaire ? |
| `__seo_r2_embeddings` | 07 seo | 3.3 | 0 | Citée seulement en commentaire dans le code, aucune écriture ni lecture d’application mesurée : archiver après retrait du commentaire ? Le relevé du 2026-09-15 la garde : base du pilote R2 v2. |
| `__seo_r2_keyword_plan` | 07 seo | 0.0 | 0 | Code présent mais table vide et jamais écrite depuis le 2026-09-17 : fonctionnalité non activée (laquelle, quand ?) ou abandonnée ? |
| `__seo_r2_metrics` | 07 seo | 0.0 | 0 | Citée seulement en commentaire dans le code, aucune écriture ni lecture d’application mesurée : archiver après retrait du commentaire ? |
| `__seo_r2_page_snapshot` | 07 seo | 0.0 | 0 | Sans code, mais des vues ou clés étrangères en dépendent (__seo_r2_pages) : ces objets sont-ils eux-mêmes utilisés ? |
| `__seo_r2_pages` | 07 seo | 0.1 | 0 | Citée seulement en commentaire dans le code, aucune écriture ni lecture d’application mesurée : archiver après retrait du commentaire ? |
| `__seo_r2_signatures` | 07 seo | 0.1 | 0 | Citée seulement en commentaire dans le code, aucune écriture ni lecture d’application mesurée : archiver après retrait du commentaire ? |
| `__seo_r6_image_prompts` | 07 seo | 0.1 | 2 | Seulement citée par des scripts manuels (scripts/audit/editorial-authority-sinks.ts) : ces scripts servent-ils encore ? |
| `__seo_r7_qa_reviews` | 07 seo | 0.0 | 0 | Code présent mais table vide et jamais écrite depuis le 2026-09-17 : fonctionnalité non activée (laquelle, quand ?) ou abandonnée ? |
| `__seo_r7_regeneration_queue` | 07 seo | 0.0 | 0 | Code présent mais table vide et jamais écrite depuis le 2026-09-17 : fonctionnalité non activée (laquelle, quand ?) ou abandonnée ? |
| `__seo_r8_engine_family_stats` | 07 seo | 0.0 | 0 | Code présent mais table vide et jamais écrite depuis le 2026-09-17 : fonctionnalité non activée (laquelle, quand ?) ou abandonnée ? |
| `__seo_snapshot_cf_rum` | 07 seo | 4.3 | 0 | Seul un cron d’entretien la touche (cron#15 snapshot-partition-rotation) ; vide et jamais écrite depuis le 2026-09-17. L’écrivain existe (cf-rum.service.ts) mais n’a rien écrit : l’activer, ou abandonner la table (et son entretien) ? |
| `__seo_type_vlevel` | 07 seo | 1.8 | 6476 | Seulement citée par des scripts manuels (scripts/seo/rebuild-type-vlevel.py) : ces scripts servent-ils encore ? |
| `__sitemap_marque` | 07 seo | 0.1 | 35 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `__sitemap_motorisation` | 07 seo | 2.8 | 12756 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `__sitemap_p_xml` | 07 seo | 0.7 | 1960 | Seulement citée par des scripts manuels (backend/scripts/seo/audit/r2-volume-sample.ts, scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `__sitemap_search_link` | 07 seo | 0.2 | 1 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `__staging_article_mapping` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (get_staging_stats) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__staging_brand_mapping` | 10 catalog | 0.7 | 1900 | Seules des fonctions SQL jamais appelées la citent (get_staging_stats, merge_staging_brands, validate_staging_brands) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__staging_piece_compat` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (get_staging_stats) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__staging_vehicle_mapping` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (get_staging_stats) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `__tecdoc_import_log` | 10 catalog | 0.0 | 0 | Seulement citée par des scripts manuels (scripts/tecdoc-import.py) : ces scripts servent-ils encore ? |
| `__tecdoc_supplier_mapping` | 10 catalog | 0.2 | 846 | Seulement citée par des scripts manuels (scripts/db/tecdoc-api-surface-fixture.sql, scripts/tecdoc-import.py) : ces scripts servent-ils encore ? |
| `__video_templates` | 08 media | 0.0 | 0 | Code présent mais table vide et jamais écrite depuis le 2026-09-17 : fonctionnalité non activée (laquelle, quand ?) ou abandonnée ? |
| `am_2022_suppliers` | 12 supplier | 0.9 | 1087 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `auto_modele_group` | 10 catalog | 0.6 | 1957 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `auto_modele_robot` | 10 catalog | 0.1 | 1 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `auto_type_motor_fuel` | 10 catalog | 0.1 | 26 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `catalog_pricing_baseline` | 16 pricing | 0.0 | 0 | Seul un cron d’entretien la touche (cron#23 rls-reconcile-internal-tables) ; vide et jamais écrite depuis le 2026-09-17. Aucun écrivain dans le code : chantier à reprendre ou à archiver ? |
| `catalog_pricing_baseline_meta` | 16 pricing | 0.0 | 0 | Sans code, mais des vues ou clés étrangères en dépendent (catalog_pricing_baseline) : ces objets sont-ils eux-mêmes utilisés ? |
| `decision_article` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (build_article_decisions, get_decision_report, move_decisions_to_quarantine) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `decision_brand` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (apply_decisions_shadow, build_brand_decisions, get_decision_report, move_decisions_to_quarantine) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `decision_compat` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (move_decisions_to_quarantine) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `error_logs` | 20 product | 0.1 | 0 | Code présent mais table vide et jamais écrite depuis le 2026-09-17 : fonctionnalité non activée (laquelle, quand ?) ou abandonnée ? |
| `gamme_seo_audit` | 10 catalog | 0.0 | 0 | Code présent mais table vide et jamais écrite depuis le 2026-09-17 : fonctionnalité non activée (laquelle, quand ?) ou abandonnée ? |
| `gate_thresholds` | 23 ia-agents | 0.1 | 17 | Seules des fonctions SQL jamais appelées la citent (get_threshold) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `import_batch` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (create_import_batch, finalize_import_batch, get_batch_report) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `kg_case_outcomes` | 11 diagnostic | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (kg_auto_infer_outcomes) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `kg_cases` | 11 diagnostic | 0.1 | 0 | Seules des fonctions SQL jamais appelées la citent (kg_auto_infer_outcomes) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `kg_diagnostic_cases` | 11 diagnostic | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (kg_get_learning_stats, kg_record_case, kg_record_outcome) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `kg_feedback_config` | 11 diagnostic | 0.0 | 12 | Seules des fonctions SQL jamais appelées la citent (kg_calculate_bayesian_weight, kg_calculate_truth_label_reliability, kg_calculate_weight_with_truth_labels, kg_record_feedback) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `kg_feedback_events` | 11 diagnostic | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (kg_calculate_bayesian_weight, kg_record_feedback) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `kg_rag_mapping` | 11 diagnostic | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (kg_rag_get_node_id, kg_rag_upsert_mapping) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `kg_rag_sync_log` | 11 diagnostic | 0.0 | 0 | Seulement citée par des scripts manuels (workspaces/seo-batch/.claude/skills/rag-ops/scripts/rag_audit.py) : ces scripts servent-ils encore ? |
| `kg_review_queue` | 11 diagnostic | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (kg_approve_node, kg_reject_node, kg_submit_for_review) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `kg_truth_labels` | 11 diagnostic | 0.1 | 0 | Seules des fonctions SQL jamais appelées la citent (kg_calculate_truth_label_reliability, kg_calculate_weight_with_truth_labels, kg_record_truth_label) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `natural_key_article` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (build_article_decisions, get_nk_stats) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `natural_key_brand` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (build_brand_decisions, get_nk_stats, get_or_create_brand_nk, resolve_brand_multilevel) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `natural_key_vehicle` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (get_nk_stats) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `norm_article` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (build_article_decisions) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `norm_brand` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (apply_decisions_shadow, build_brand_decisions, finalize_import_batch, get_batch_report) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `pieces_criteria_group` | 10 catalog | 1.3 | 4266 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `pieces_details` | 10 catalog | 0.2 | 1 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `pieces_gamme_display_history` | 10 catalog | 0.0 | 0 | Seul un cron d’entretien la touche (cron#23 rls-reconcile-internal-tables) ; vide et jamais écrite depuis le 2026-09-17. L’écrivain existe (public.catalog_gamme_display_activate()) mais n’a rien écrit : l’activer, ou abandonner la table (et son entretien) ? |
| `pieces_list` | 10 catalog | 426.6 | 1805831 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `pieces_ref_ean` | 10 catalog | 559.7 | 3018757 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `pieces_status` | 10 catalog | 0.1 | 13 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `pipeline_event_log` | 23 ia-agents | 0.1 | 0 | Seules des fonctions SQL jamais appelées la citent (cleanup_old_pipeline_logs, complete_pipeline_step, log_pipeline_event) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `pricing_decision_snapshot` | 16 pricing | 0.6 | 0 | Seul un cron d’entretien la touche (cron#25 pricing-decision-snapshot-partition-rotation) ; vide et jamais écrite depuis le 2026-09-17. Aucun écrivain dans le code : chantier à reprendre ou à archiver ? |
| `promo_usage` | 13 sales | 0.0 | 0 | Code présent mais table vide et jamais écrite depuis le 2026-09-17 : fonctionnalité non activée (laquelle, quand ?) ou abandonnée ? |
| `quantity_discounts` | 16 pricing | 0.1 | 6 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `reviews` | 14 support | 0.1 | 0 | Code présent mais table vide et jamais écrite depuis le 2026-09-17 : fonctionnalité non activée (laquelle, quand ?) ou abandonnée ? |
| `rm_build_log` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (complete_rebuild_job) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `rm_listing_products` | 10 catalog | 0.5 | 0 | Seules des fonctions SQL jamais appelées la citent (check_rm_products_integrity, create_rm_listing_products_partition) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `rm_product` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (check_rm_products_integrity) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `shipping_rates_cache` | 15 logistics | 0.1 | 5 | Seulement citée par des scripts manuels (scripts/analyze_full_database.py) : ces scripts servent-ils encore ? |
| `stg_article` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (get_batch_report) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `stg_brand` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (finalize_import_batch, get_batch_report, normalize_batch_brands) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `stg_vehicle` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (get_batch_report) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `supplier_offer_snapshot` | 12 supplier | 0.4 | 0 | Seul un cron d’entretien la touche (cron#26 supplier-offer-snapshot-partition-rotation) ; vide et jamais écrite depuis le 2026-09-17. Aucun écrivain dans le code : chantier à reprendre ou à archiver ? |
| `xref_article` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (build_article_decisions, get_batch_report) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `xref_brand` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (build_brand_decisions, get_batch_report, resolve_batch_brands, resolve_brand_multilevel) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |
| `xref_vehicle` | 10 catalog | 0.0 | 0 | Seules des fonctions SQL jamais appelées la citent (get_batch_report) : chantier abandonné à archiver avec ses fonctions, ou à reprendre ? |

## 8. Inventaire complet (une ligne par table)

Colonnes : classe (déduit), département, taille et lignes estimées (mesuré), écritures depuis le 2026-09-17 (insert/update/delete, mesuré), parcours séquentiels/index (mesuré), écrivains et lecteurs dans le code (mesuré, `git grep`), dépendances SQL (mesuré), famille de conservation (proposé).

| Table | Classe | Dépt | Mo | Lignes | Écritures i/u/d | seq/idx | Écrivains (code) | Lecteurs (code) | SQL | Famille |
|---|---|---|---:|---:|---|---|---|---|---|---|
| `___config` | vivante | 21 runtime | 0.4 | 1 | 0/0/0 | 50/0 | mod/admin/services/gamme-seo-thresholds.service.ts | mod/admin/services/gamme-seo-thresholds.service.ts, mod/config/config.module.ts +1 | — | tables de l’ancien site |
| `___config_admin` | vivante | 24 people | 0.2 | 11 | 0/7/0 | 635/31 | — | backend/src/auth/auth.service.ts, mod/staff/dto/staff.dto.ts +4 | fn 3 | tables de l’ancien site |
| `___config_ip` | à trancher | 20 product | 0.1 | 3 | 0/0/0 | 12/0 | — | — | — | tables de l’ancien site |
| `___footer_menu` | à trancher | 20 product | 0.1 | 13 | 0/0/0 | 14/0 | — | — | — | tables de l’ancien site |
| `___header_menu` | à trancher | 20 product | 0.1 | 6 | 0/0/0 | 16/0 | — | — | — | tables de l’ancien site |
| `___legal_pages` | vivante | 14 support | 0.1 | 16 | 0/0/0 | 29/1135 | — | mod/support/services/legal-page.service.ts | — | tables de l’ancien site |
| `___meta_tags_ariane` | vivante | 07 seo | 0.2 | 5 | 0/0/0 | 3502/0 | — | backend/src/database/services/meta-tags-ariane-data.service.ts, mod/metadata/services/optimized-breadcrumb.service.ts +2 | fn 1; fn morte 1 | tables de l’ancien site |
| `___xtr_customer` | vivante | 14 support | 49.3 | 59198 | 16/59109/0 | 188/60417 | mod/users/services/profile.service.ts | backend/src/database/services/promo-data.service.ts, backend/src/database/services/supabase-base.service.ts +13 | fn 2; FK← 1 | tables de l’ancien site |
| `___xtr_customer_billing_address` | vivante | 14 support | 27.6 | 59109 | 0/0/0 | 19/1717 | — | frontend/app/routes/account_.orders.$orderId.invoice.tsx | — | tables de l’ancien site |
| `___xtr_customer_delivery_address` | vivante | 15 logistics | 27.6 | 59110 | 0/0/0 | 19/1718 | — | mod/shipping/shipping.service.ts, frontend/app/routes/account_.orders.$orderId.invoice.tsx | — | tables de l’ancien site |
| `___xtr_delivery_agent` | vivante | 15 logistics | 0.2 | 1 | 0/0/0 | 25/0 | — | backend/src/database/services/shipping-data.service.ts | — | tables de l’ancien site |
| `___xtr_delivery_ape_corse` | vivante | 13 sales | 0.1 | 9 | 0/0/0 | 639/0 | — | mod/cart/services/shipping-calculator.service.ts | — | tables de l’ancien site |
| `___xtr_delivery_ape_domtom1` | vivante | 13 sales | 0.1 | 7 | 0/0/0 | 636/0 | — | mod/cart/services/shipping-calculator.service.ts | — | tables de l’ancien site |
| `___xtr_delivery_ape_domtom2` | vivante | 13 sales | 0.1 | 7 | 0/0/0 | 635/0 | — | mod/cart/services/shipping-calculator.service.ts | — | tables de l’ancien site |
| `___xtr_delivery_ape_france` | vivante | 13 sales | 0.1 | 9 | 0/0/0 | 658/0 | — | mod/cart/services/shipping-calculator.service.ts | — | tables de l’ancien site |
| `___xtr_invoice` | à trancher | 17 finance | 0.3 | 1 | 0/0/0 | 86/0 | — | — | — | tables de l’ancien site |
| `___xtr_invoice_line` | à trancher | 17 finance | 0.3 | 1 | 0/0/0 | 43/0 | — | — | — | tables de l’ancien site |
| `___xtr_msg` | vivante | 14 support | 10306.5 | 15342444 | 77/0/0 | 473/47592 | — | mod/errors/services/redirect.service.ts, mod/messages/messages.controller.ts +3 | — | tables de l’ancien site |
| `___xtr_order` | vivante | 13 sales | 2.3 | 1690 | 17/37/0 | 5313/131638 | mod/orders/controllers/orders.controller.ts, mod/payments/controllers/paybox-callback.controller.ts | backend/src/database/services/orders.service.ts, mod/admin/services/reporting.service.ts +15 | fn 5; FK← 3 | tables de l’ancien site |
| `___xtr_order_history` | vivante | 13 sales | 0.1 | 23 | 19/0/0 | 105/34 | — | mod/orders/services/order-status.service.ts | fn 1 | tables de l’ancien site |
| `___xtr_order_line` | vivante | 13 sales | 3.0 | 2530 | 17/1/0 | 132/44231 | — | mod/admin/services/seo-control.service.ts, mod/orders/services/orders.service.ts +6 | fn 3 | tables de l’ancien site |
| `___xtr_order_line_equiv_ticket` | à trancher | 13 sales | 0.1 | 13 | 0/0/0 | 90/8 | — | — | — | tables de l’ancien site |
| `___xtr_order_line_status` | vivante | 13 sales | 0.1 | 10 | 0/0/0 | 27/0 | — | mod/orders/services/order-actions.service.ts | — | tables de l’ancien site |
| `___xtr_order_status` | vivante | 13 sales | 0.1 | 5 | 0/0/0 | 105/4 | — | mod/orders/services/order-status.service.ts | FK← 1 | tables de l’ancien site |
| `___xtr_supplier` | vivante | 12 supplier | 0.1 | 70 | 0/0/0 | 52/4 | — | backend/src/database/services/piece-price-data.service.ts, mod/orders/services/order-line-supplier-proposal.ts +5 | — | tables de l’ancien site |
| `___xtr_supplier_link_pm` | vivante | 12 supplier | 0.1 | 108 | 0/0/0 | 27/20 | — | mod/supplier-truth/connectors/supplier-registry.ts, mod/supplier-truth/supplier-truth.repository.ts +1 | — | tables de l’ancien site |
| `__abandoned_cart_emails` | à trancher | 13 sales | 0.0 | 0 | 0/0/0 | 52/0 | — | mod/cart/services/abandoned-cart-data.service.ts | — | référentiel ou donnée métier |
| `__admin_audit_log` | vivante | 13 sales | 0.1 | 78 | 20/0/0 | 59/16 | mod/admin/services/command-center-orchestrator/execution-ledger.service.ts, mod/orders/listeners/order-audit.listener.ts +1 | mod/admin/services/command-center-orchestrator/execution-ledger.service.ts, mod/orders/listeners/order-audit.listener.ts +1 | fn morte 1 | journal |
| `__admin_job_health` | vivante | 21 runtime | 0.1 | 3 | 0/6001/0 | 12292/0 | mod/admin/services/admin-job-health.service.ts | mod/admin/services/admin-job-health.service.ts | — | référentiel ou donnée métier |
| `__agent_runs` | morte | 23 ia-agents | 0.1 | 7 | 0/0/0 | 11/0 | — | — | — | journal |
| `__blog_advice` | vivante | 06 content | 1.0 | 85 | 0/12/0 | 148670/5138383 | — | backend/check-tables-columns.py, mod/admin/services/gamme-detail-enricher.service.ts +15 | fn 7 | référentiel ou donnée métier |
| `__blog_advice_cross` | vivante | 06 content | 0.1 | 321 | 0/0/0 | 18/2135104 | — | — | — | référentiel ou donnée métier |
| `__blog_advice_h2` | vivante | 06 content | 2.4 | 447 | 0/0/0 | 357/2141190 | — | mod/blog/interfaces/blog.interfaces.ts | — | référentiel ou donnée métier |
| `__blog_advice_h3` | vivante | 06 content | 1.1 | 200 | 0/0/0 | 23/1777598 | — | mod/blog/blog.module.ts, mod/blog/interfaces/blog.interfaces.ts | — | référentiel ou donnée métier |
| `__blog_guide` | vivante | 06 content | 2.0 | 223 | 0/0/0 | 23374/26419 | — | mod/blog/controllers/blog.controller.ts, mod/blog/interfaces/blog.interfaces.ts +8 | fn 1 | référentiel ou donnée métier |
| `__blog_guide_h2` | vivante | 06 content | 8.4 | 1790 | 0/0/0 | 18/28178 | — | — | — | référentiel ou donnée métier |
| `__blog_guide_h3` | vivante | 06 content | 0.6 | 674 | 0/0/0 | 26/21361 | — | — | — | référentiel ou donnée métier |
| `__blog_meta_tags_ariane` | vivante | 07 seo | 0.2 | 5 | 0/0/0 | 26/0 | — | mod/seo/services/chain/seo-meta-registry.service.ts | — | référentiel ou donnée métier |
| `__blog_seo_marque` | vivante | 06 content | 0.1 | 1 | 0/0/0 | 46533/0 | — | backend/sql/021-create-rpc-get-brand-page-data-optimized.sql, mod/blog/blog.module.ts +1 | fn 2 | référentiel ou donnée métier |
| `__catalog_id_mapping` | à trancher | 10 catalog | 0.5 | 950 | 0/0/0 | 15/0 | — | — | fn morte 5 | import et préparation |
| `__catalog_import_history` | morte | 10 catalog | 0.1 | 3 | 0/0/0 | 13/0 | — | — | — | import et préparation |
| `__claims` | vivante | 14 support | 0.1 | 0 | 0/0/0 | 16956/0 | — | mod/support/services/claim.service.ts | — | référentiel ou donnée métier |
| `__cnit_raw` | à trancher | 10 catalog | 16.8 | 55060 | 0/0/0 | 7866/8376 | — | — | — | import et préparation |
| `__cross_gamme_car_new` | vivante | 06 content | 51.4 | 182131 | 0/0/0 | 6017/787258 | — | backend/check-tables-columns.py, backend/sql/021-create-rpc-get-brand-page-data-optimized.sql +4 | cron 1; fn 7; fn morte 5 | référentiel ou donnée métier |
| `__db_governance_snapshots` | vivante | 21 runtime | 0.1 | 30 | 0/0/0 | 8/0 | mod/system/services/db-governance.service.ts | mod/system/services/db-governance.service.ts | — | journal |
| `__diag_cause` | vivante | 11 diagnostic | 0.1 | 58 | 0/0/0 | 193/481 | — | backend/src/config/diag-canon.schema.ts, mod/diagnostic-engine/diagnostic-engine.data-service.ts | FK← 1 | référentiel ou donnée métier |
| `__diag_context_questions` | à trancher | 11 diagnostic | 0.0 | 5 | 0/0/0 | 15/0 | — | — | fn morte 1 | référentiel ou donnée métier |
| `__diag_link_provenance` | vivante | 11 diagnostic | 0.0 | 0 | 0/0/0 | 72/331 | — | backend/src/config/feature-flags.service.ts, mod/diagnostic-engine/diagnostic-engine.data-service.ts +4 | fn 1 | référentiel ou donnée métier |
| `__diag_maintenance_operation` | vivante | 11 diagnostic | 0.1 | 30 | 0/0/0 | 66/63 | — | mod/diagnostic-engine/diagnostic-engine.data-service.ts, mod/diagnostic-engine/engines/maintenance-intelligence.engine.ts +1 | FK← 1 | référentiel ou donnée métier |
| `__diag_maintenance_symptom_link` | vivante | 11 diagnostic | 0.1 | 75 | 0/0/0 | 104/4 | — | mod/diagnostic-engine/engines/maintenance-intelligence.engine.ts | — | référentiel ou donnée métier |
| `__diag_projection_conflicts` | vivante | 11 diagnostic | 0.0 | 0 | 0/0/0 | 61/0 | — | — | fn 1 | référentiel ou donnée métier |
| `__diag_projection_runs` | vivante | 11 diagnostic | 0.0 | 0 | 0/0/0 | 72/4 | — | — | fn 2; FK← 2 | journal |
| `__diag_related_parts` | à trancher | 11 diagnostic | 0.1 | 7 | 0/0/0 | 16/0 | — | — | fn morte 1 | référentiel ou donnée métier |
| `__diag_safe_phrases` | morte | 11 diagnostic | 0.0 | 17 | 0/0/0 | 6/0 | — | — | — | référentiel ou donnée métier |
| `__diag_safety_rule` | vivante | 11 diagnostic | 0.1 | 21 | 0/0/0 | 420/0 | — | mod/diagnostic-engine/diagnostic-engine.data-service.ts | — | référentiel ou donnée métier |
| `__diag_session` | vivante | 11 diagnostic | 1.0 | 175 | 43/0/0 | 49/33 | mod/diagnostic-engine/diagnostic-engine.data-service.ts | mod/diagnostic-engine/diagnostic-engine.data-service.ts | — | référentiel ou donnée métier |
| `__diag_symptom` | vivante | 11 diagnostic | 0.1 | 62 | 0/0/0 | 232/607 | — | mod/diagnostic-engine/diagnostic-engine.data-service.ts | FK← 2 | référentiel ou donnée métier |
| `__diag_symptom_cause_link` | vivante | 11 diagnostic | 0.1 | 162 | 0/0/0 | 113/474 | — | mod/diagnostic-engine/diagnostic-engine.data-service.ts, mod/diagnostic-engine/projection/diagnostic-projection-resolver.ts | fn 1; FK← 1 | référentiel ou donnée métier |
| `__diag_symptom_family` | à trancher | 11 diagnostic | 0.1 | 35 | 0/0/0 | 13/0 | — | — | fn morte 1 | référentiel ou donnée métier |
| `__diag_symptoms` | à trancher | 11 diagnostic | 0.1 | 31 | 0/0/0 | 20/0 | — | — | fn morte 2; FK← 1 | référentiel ou donnée métier |
| `__diag_system` | vivante | 11 diagnostic | 0.0 | 13 | 0/0/0 | 2188/181 | — | mod/diagnostic-engine/diagnostic-engine.data-service.ts | FK← 4 | référentiel ou donnée métier |
| `__error_logs` | vivante | 07 seo | 162.3 | 51272 | 92054/0/113991 | 82/123501 | — | mod/errors/controllers/internal-error-log.controller.ts, mod/errors/services/error-log.service.ts +3 | cron 1 | journal |
| `__gamme_page_cache` | vivante | 07 seo | 3.7 | 238 | 27/12/0 | 465/81803 | mod/gamme-rest/services/gamme-rpc.service.ts | mod/gamme-rest/controllers/admin-gamme-cache.controller.ts, mod/gamme-rest/services/gamme-rpc.service.ts | cron 1; fn 4 | cache ou projection recalculable |
| `__import_batch_contract` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 13/0 | — | — | fn morte 5 | import et préparation |
| `__import_gate_status` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 5/0 | — | — | fn morte 5 | import et préparation |
| `__import_manifest` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 11/0 | — | — | fn morte 2 | import et préparation |
| `__import_proof` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 7/0 | — | — | fn morte 2 | import et préparation |
| `__marketing_analytics_digests` | morte | 04 marketing | 0.0 | 0 | 0/0/0 | 19/0 | — | — | — | journal |
| `__marketing_backlinks` | vivante | 04 marketing | 0.1 | 122 | 0/0/0 | 33/2 | mod/marketing/services/marketing-data.service.ts | mod/marketing/services/marketing-data.service.ts | — | référentiel ou donnée métier |
| `__marketing_brand_rules` | vivante | 04 marketing | 0.0 | 22 | 0/0/0 | 25/0 | mod/marketing/templates/brand-rules-seed.ts | mod/marketing/services/marketing-hub-data.service.ts, mod/marketing/templates/brand-rules-seed.ts | — | référentiel ou donnée métier |
| `__marketing_campaigns` | à trancher | 04 marketing | 0.0 | 0 | 0/0/0 | 10/0 | — | mod/marketing/services/marketing-data.service.ts | FK← 3 | référentiel ou donnée métier |
| `__marketing_content_library` | morte | 04 marketing | 0.0 | 0 | 0/0/0 | 15/0 | — | — | — | référentiel ou donnée métier |
| `__marketing_content_roadmap` | vivante | 04 marketing | 0.1 | 58 | 0/0/0 | 21/0 | mod/marketing/services/marketing-data.service.ts | mod/marketing/services/marketing-data.service.ts | — | référentiel ou donnée métier |
| `__marketing_guest_posts` | morte | 04 marketing | 0.0 | 0 | 0/0/0 | 19/0 | — | — | — | référentiel ou donnée métier |
| `__marketing_kpi_snapshots` | vivante | 04 marketing | 0.0 | 1 | 0/0/0 | 6/0 | mod/marketing/services/marketing-data.service.ts | mod/marketing/services/marketing-data.service.ts | — | journal |
| `__marketing_outreach` | à trancher | 04 marketing | 0.0 | 0 | 0/0/0 | 19/0 | — | mod/marketing/services/marketing-data.service.ts | FK← 1 | référentiel ou donnée métier |
| `__marketing_social_posts` | vivante | 04 marketing | 0.2 | 0 | 0/0/0 | 53/0 | mod/marketing/services/marketing-hub-data.service.ts | mod/marketing/services/marketing-hub-data.service.ts | FK← 1 | référentiel ou donnée métier |
| `__marketing_utm_registry` | vivante | 04 marketing | 0.0 | 0 | 0/0/0 | 20/0 | mod/marketing/services/marketing-hub-data.service.ts | mod/marketing/services/marketing-hub-data.service.ts | — | référentiel ou donnée métier |
| `__marketing_weekly_plans` | vivante | 04 marketing | 0.1 | 0 | 0/0/0 | 20/0 | mod/marketing/services/marketing-hub-data.service.ts | mod/marketing/services/marketing-hub-data.service.ts | — | référentiel ou donnée métier |
| `__paybox_gate_log` | vivante | 13 sales | 0.0 | 4 | 0/0/0 | 377/2 | mod/payments/services/paybox-callback-gate.service.ts | mod/payments/services/paybox-callback-gate.service.ts | — | journal |
| `__pipeline_chain_queue` | vivante | 23 ia-agents | 1.0 | 2510 | 0/0/0 | 21/2 | mod/admin/services/execution-router.service.ts, backend/src/workers/processors/pipeline-chain.processor.ts | mod/admin/services/execution-router.service.ts, backend/src/workers/processors/pipeline-chain.processor.ts | fn 1; fn morte 2 | journal |
| `__qa_protected_meta_hash` | morte | 07 seo | 0.4 | 140 | 0/0/0 | 13/4 | — | — | — | référentiel ou donnée métier |
| `__quality_gamme_scores` | vivante | 07 seo | 0.6 | 232 | 0/0/0 | 15/4 | mod/admin/services/gamme-aggregator.service.ts | mod/admin/services/gamme-aggregator.service.ts | — | cache ou projection recalculable |
| `__quality_page_scores` | vivante | 07 seo | 1.6 | 921 | 0/0/0 | 20/12 | mod/admin/services/quality-scoring-engine.service.ts | mod/admin/services/gamme-aggregator.service.ts, mod/admin/services/quality-scoring-engine.service.ts | — | cache ou projection recalculable |
| `__quarantine_history` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 8/0 | — | — | fn morte 3 | import et préparation |
| `__quarantine_items` | à trancher | 10 catalog | 0.1 | 0 | 0/0/0 | 19/0 | — | — | fn morte 8; vues 1; FK← 1 | import et préparation |
| `__quarantine_rules` | à trancher | 10 catalog | 0.0 | 4 | 0/0/0 | 11/0 | — | — | fn morte 1 | import et préparation |
| `__quote_requests` | vivante | 14 support | 0.1 | 0 | 0/0/0 | 21/0 | mod/support/services/quote.service.ts | mod/support/services/quote.service.ts | FK← 1 | référentiel ou donnée métier |
| `__quotes` | vivante | 14 support | 0.0 | 0 | 0/0/0 | 14/0 | mod/support/services/quote.service.ts | mod/support/services/quote.service.ts | — | référentiel ou donnée métier |
| `__rag_change_events` | vivante | 09 wiki | 0.5 | 554 | 0/0/0 | 13/1 | — | — | fn 1 | journal |
| `__rag_check_history` | morte | 09 wiki | 0.0 | 3 | 0/0/0 | 9/0 | — | — | — | journal |
| `__rag_content_refresh_log` | vivante | 04 marketing | 2.0 | 913 | 0/0/0 | 26/6 | — | mod/admin/services/brief-template.service.ts, mod/marketing/services/marketing-data.service.ts | fn 1; fn morte 3 | journal |
| `__rag_knowledge` | vivante | 14 support | 10.2 | 619 | 0/0/0 | 38/476 | mod/rag-proxy/services/rag-admissibility-gate.service.ts, mod/rag-proxy/services/rag-cleanup.service.ts +2 | backend/src/config/phase2a-shadow-audit.constants.ts, mod/admin/services/vehicle-rag-generator.service.ts +6 | fn 2; fn morte 2 | référentiel ou donnée métier |
| `__rag_pipeline_incidents` | morte | 09 wiki | 0.1 | 30 | 0/0/0 | 7/0 | — | — | — | journal |
| `__rag_proposals` | vivante | 09 wiki | 0.1 | 1 | 0/0/0 | 29/0 | mod/admin/services/rag-proposal.service.ts, mod/admin/services/vehicle-rag-generator.service.ts | mod/admin/services/rag-proposal.service.ts, mod/admin/services/rag-proposal.types.ts +1 | FK← 1 | référentiel ou donnée métier |
| `__rag_readiness` | morte | 09 wiki | 1.1 | 1219 | 0/0/0 | 14/4 | — | — | — | référentiel ou donnée métier |
| `__rag_web_ingest_jobs` | vivante | 09 wiki | 1.0 | 290 | 0/0/0 | 12/2 | — | mod/admin/controllers/admin-keyword-planner.controller.ts | fn morte 1 | référentiel ou donnée métier |
| `__rag_webhook_audit` | vivante | 14 support | 0.1 | 9 | 0/0/0 | 10/0 | mod/rag-proxy/services/webhook-audit.service.ts | mod/rag-proxy/services/webhook-audit.service.ts | — | journal |
| `__refunds` | vivante | 13 sales | 0.0 | 0 | 0/0/0 | 16956/0 | mod/payments/services/payment.service.ts | mod/payments/services/payment.service.ts | — | référentiel ou donnée métier |
| `__seo_action_outcome` | à trancher | 07 seo | 0.0 | 0 | 0/0/0 | 17/0 | — | — | fn morte 2 | référentiel ou donnée métier |
| `__seo_admin_job` | vivante | 07 seo | 0.0 | 0 | 0/0/0 | 20/0 | — | mod/seo/r2/schemas/admin-job.schema.ts, mod/seo/r2/services/r2-r8-seed-job-orchestrator.service.ts | fn 2 | référentiel ou donnée métier |
| `__seo_ai_runs` | morte | 07 seo | 0.0 | 0 | 0/0/0 | 16/0 | — | — | — | journal |
| `__seo_audit_findings` | vivante | 07 seo | 0.1 | 0 | 0/0/0 | 165383/0 | mod/seo-monitoring/services/audit-findings.service.ts | mod/seo-monitoring/services/audit-findings.service.ts, frontend/app/routes/admin.seo-hub.findings.tsx +1 | fn 1 | référentiel ou donnée métier |
| `__seo_audit_history` | morte | 07 seo | 0.0 | 4 | 0/0/0 | 12/0 | — | — | — | journal |
| `__seo_brand_editorial` | vivante | 07 seo | 0.1 | 36 | 0/0/0 | 14/2 | — | mod/admin/services/brand-editorial.service.ts, mod/seo-monitoring/services/r-content-auditor.service.ts +1 | — | référentiel ou donnée métier |
| `__seo_brief_template` | vivante | 07 seo | 0.0 | 0 | 0/0/0 | 16/0 | mod/admin/services/brief-template.service.ts | mod/admin/services/brief-template.service.ts | FK← 1 | référentiel ou donnée métier |
| `__seo_cannibalization_recommendations` | morte | 07 seo | 0.8 | 662 | 0/0/0 | 16/4 | — | — | — | référentiel ou donnée métier |
| `__seo_canon_runtime_flags` | vivante | 07 seo | 0.0 | 1 | 0/0/0 | 10/0 | — | — | fn 1 | référentiel ou donnée métier |
| `__seo_confusion_pairs` | vivante | 07 seo | 0.2 | 124 | 0/0/0 | 16/3 | — | mod/admin/services/seo-cockpit.service.ts | — | référentiel ou donnée métier |
| `__seo_content_audit` | morte | 07 seo | 0.2 | 23 | 0/0/0 | 18/0 | — | — | — | journal |
| `__seo_content_block_versions` | vivante | 07 seo | 0.1 | 0 | 14/0/0 | 62/721 | mod/seo-projection/seo-projection-writer.service.ts | mod/seo-projection/seo-projection-writer.service.ts | vues 1; FK← 1 | référentiel ou donnée métier |
| `__seo_content_blocks` | vivante | 07 seo | 0.0 | 14 | 14/630/0 | 196/630 | mod/seo-projection/seo-projection-writer.service.ts | mod/seo-projection/seo-projection-writer.service.ts | vues 1; FK← 1 | référentiel ou donnée métier |
| `__seo_content_events` | à trancher | 07 seo | 0.2 | 23 | 0/0/0 | 20/0 | — | — | fn morte 1; vues 1; FK← 1 | journal |
| `__seo_crawl_hub` | vivante | 07 seo | 0.1 | 2 | 0/0/0 | 12/0 | mod/seo/services/sitemap-v10-hubs.service.ts | mod/seo/services/sitemap-v10-hubs.service.ts | — | référentiel ou donnée métier |
| `__seo_crawl_log` | vivante | 07 seo | 0.0 | 0 | 0/0/0 | 21/0 | mod/seo/services/googlebot-detector.service.ts | mod/seo/services/googlebot-detector.service.ts, mod/seo/services/risk-flags-engine.service.ts | vues 2 | journal |
| `__seo_cwv_daily` (P) | à trancher | 07 seo | 0.3 | 0 | 0/0/0 | 141/0 | mod/seo-monitoring/services/cwv-fetcher.service.ts | mod/seo-monitoring/controllers/seo-monitoring.controller.ts, mod/seo-monitoring/services/cwv-fetcher.service.ts | cron 2; fn 2 | partitions d’instantanés |
| `__seo_cwv_daily_rum` (P) | vivante | 07 seo | 2.5 | 7094 | 3219/3211/0 | 224/6667 | — | mod/seo-monitoring/services/cwv-dashboard.service.ts, frontend/app/routes/admin.seo-hub.cwv.tsx | cron 3; fn 4 | partitions d’instantanés |
| `__seo_cwv_hourly` (P) | vivante | 07 seo | 3.9 | 6897 | 6897/302589/0 | 3204/310198 | — | mod/seo-monitoring/services/cwv-dashboard.service.ts | cron 4; fn 4 | partitions d’instantanés |
| `__seo_cwv_raw` (P) | vivante | 07 seo | 12.2 | 15531 | 16248/0/0 | 53/2281 | mod/seo-monitoring/services/cwv-beacon.service.ts | mod/seo-monitoring/controllers/cwv-beacon.controller.ts, mod/seo-monitoring/services/cwv-beacon.service.ts +2 | cron 5; fn 6 | partitions d’instantanés |
| `__seo_diagnostic` | morte | 07 seo | 0.0 | 0 | 0/0/0 | 22/0 | — | — | — | référentiel ou donnée métier |
| `__seo_entity_fact_versions` | vivante | 07 seo | 0.1 | 0 | 4/0/0 | 242/0 | mod/seo-projection/seo-projection-writer.service.ts | mod/seo-projection/seo-projection-writer.service.ts | vues 1; FK← 1 | référentiel ou donnée métier |
| `__seo_entity_facts` | vivante | 07 seo | 0.1 | 4 | 4/180/0 | 84/184 | mod/seo-projection/seo-projection-writer.service.ts | mod/seo-projection/seo-projection-writer.service.ts | vues 1; FK← 3 | référentiel ou donnée métier |
| `__seo_entity_sources` | à trancher | 07 seo | 0.0 | 0 | 0/0/0 | 23/0 | — | — | — | référentiel ou donnée métier |
| `__seo_equip_gamme` | vivante | 07 seo | 0.3 | 137 | 0/0/0 | 14/859 | — | backend/check-tables-columns.py | fn 2 | référentiel ou donnée métier |
| `__seo_event_log` | vivante | 07 seo | 542.4 | 811554 | 201794/3/0 | 173/687391 | mod/admin/services/r8-vehicle-enricher.service.ts, mod/admin/services/seo-control.service.ts +7 | mod/admin/services/command-center-kpi.service.ts, mod/admin/services/r8-vehicle-enricher.service.ts +27 | cron 2; fn 4 | journal |
| `__seo_family_gamme_car_switch` | vivante | 07 seo | 3.2 | 3790 | 0/0/0 | 11/285 | backend/sql/fix-html-entities-seo-fragments.sql | backend/sql/006-create-rpc-get-pieces-for-type-gamme-v3.sql, backend/sql/fix-html-entities-seo-fragments.sql +6 | fn 1 | référentiel ou donnée métier |
| `__seo_ga4_daily` (P) | vivante | 07 seo | 79.8 | 160175 | 36935/0/0 | 2124/71406 | mod/seo-monitoring/services/ga4-daily-fetcher.service.ts | mod/admin/services/command-center-actions.service.ts, mod/seo-monitoring/controllers/seo-monitoring.controller.ts +2 | cron 2; fn 3 | partitions d’instantanés |
| `__seo_gamme` | vivante | 07 seo | 1.2 | 177 | 0/0/0 | 6075/2010 | — | backend/check-tables-columns.py, backend/find_explanation_column.py +12 | cron 1; fn 6; fn morte 2; vues 1 | référentiel ou donnée métier |
| `__seo_gamme_car` | vivante | 10 catalog | 1.2 | 118 | 0/0/0 | 2916630/4300 | backend/sql/012-update-seo-templates-add-motor-code.sql | backend/sql/004-create-rpc-get-pieces-for-type-gamme-v2.sql, backend/sql/005-create-indexes-oem-performance.sql +6 | fn 3; fn morte 1 | référentiel ou donnée métier |
| `__seo_gamme_car_switch` | vivante | 10 catalog | 1.9 | 6542 | 0/0/0 | 3673/220530 | — | backend/sql/006-create-rpc-get-pieces-for-type-gamme-v3.sql, mod/catalog/services/seo-template.service.ts +2 | fn 2 | référentiel ou donnée métier |
| `__seo_gamme_conseil` | vivante | 07 seo | 8.0 | 2790 | 0/0/0 | 6063/5924 | mod/admin/services/conseil-quality-scorer.service.ts | backend/check-tables-columns.py, backend/src/config/feature-flags.service.ts +16 | cron 1; fn 5; fn morte 2; vues 6 | référentiel ou donnée métier |
| `__seo_gamme_gsc_baseline` | morte | 07 seo | 0.0 | 0 | 0/0/0 | 17/0 | — | — | — | cache ou projection recalculable |
| `__seo_gamme_info` | vivante | 07 seo | 0.8 | 986 | 0/0/0 | 15/860 | — | backend/check-tables-columns.py, backend/find_explanation_column.py | fn 2 | référentiel ou donnée métier |
| `__seo_gamme_links` | vivante | 07 seo | 0.5 | 1199 | 0/0/0 | 13/0 | — | mod/admin/controllers/admin-keyword-planner.controller.ts | — | référentiel ou donnée métier |
| `__seo_gamme_purchase_guide` | vivante | 07 seo | 3.8 | 241 | 0/0/0 | 11191/11272 | — | backend/src/config/feature-flags.service.ts, backend/src/config/field-catalog.constants.ts +20 | cron 1; fn 6; fn morte 2; vues 5 | référentiel ou donnée métier |
| `__seo_generation_log` | vivante | 07 seo | 0.1 | 157 | 62/0/0 | 13/0 | mod/seo/services/sitemap-v10-data.service.ts | mod/seo/services/sitemap-v10-data.service.ts | fn morte 1 | journal |
| `__seo_gsc_daily` (P) | vivante | 07 seo | 229.2 | 260129 | 109003/282252/0 | 1747151/1704398 | — | mod/admin/services/seo-control.service.ts, mod/seo-monitoring/controllers/seo-monitoring.controller.ts +4 | cron 2; fn 8; fn morte 2 | partitions d’instantanés |
| `__seo_gsc_daily_page_totals` (P) | vivante | 07 seo | 230.8 | 380280 | 287850/327414/0 | 416/623144 | — | mod/admin/services/command-center-action-rules/seo-action.rules.ts, mod/admin/services/seo-control.service.ts +2 | cron 1; fn 2 | partitions d’instantanés |
| `__seo_gsc_daily_pages` (P) | vivante | 07 seo | 86.6 | 147978 | 73783/187195/0 | 177/261149 | — | mod/seo-monitoring/services/gsc-daily-fetcher.service.ts, packages/seo-types/src/observability.ts | cron 1; fn 2 | partitions d’instantanés |
| `__seo_gsc_daily_property_total` (P) | vivante | 07 seo | 0.4 | 158 | 82/426/0 | 52140/6575 | mod/seo-monitoring/services/gsc-daily-fetcher.service.ts | mod/admin/services/command-center-actions.service.ts, mod/admin/services/seo-control.service.ts +4 | cron 1; fn 3 | partitions d’instantanés |
| `__seo_gsc_daily_totals` (P) | vivante | 07 seo | 4.9 | 22887 | 11682/29608/0 | 102/41304 | — | mod/seo-monitoring/services/gsc-daily-fetcher.service.ts | cron 1; fn 1 | partitions d’instantanés |
| `__seo_gsc_links_weekly` | à trancher | 07 seo | 0.0 | 0 | 0/0/0 | 15/0 | — | mod/seo-monitoring/services/gsc-links-fetcher.service.ts | — | cache ou projection recalculable |
| `__seo_index_history` | vivante | 07 seo | 0.0 | 0 | 0/0/0 | 16/0 | mod/seo-monitoring/services/gsc-index-history-collector.service.ts | mod/admin/services/seo-cockpit.service.ts, mod/seo-monitoring/services/gsc-index-history-collector.service.ts +1 | vues 1 | journal |
| `__seo_internal_link` | à trancher | 07 seo | 0.0 | 0 | 0/0/0 | 24/0 | — | mod/seo/services/sitemap-v10-scoring.service.ts | vues 1 | référentiel ou donnée métier |
| `__seo_interpolation_alerts` | vivante | 07 seo | 0.0 | 0 | 0/0/0 | 5646/0 | — | — | fn morte 1; vues 2 | journal |
| `__seo_item_switch` | vivante | 07 seo | 2.9 | 7964 | 0/0/0 | 11/3509558 | — | backend/check-tables-columns.py, backend/find_explanation_column.py +4 | fn 3 | référentiel ou donnée métier |
| `__seo_keyword_cluster` | vivante | 07 seo | 0.1 | 3 | 0/0/0 | 14/4 | — | mod/admin/controllers/admin-keyword-clusters.controller.ts | FK← 1 | référentiel ou donnée métier |
| `__seo_keyword_results` | vivante | 07 seo | 9.3 | 10918 | 0/0/0 | 11/11 | mod/admin/controllers/admin-keyword-planner.controller.ts | mod/admin/controllers/admin-keyword-planner.controller.ts | vues 1 | référentiel ou donnée métier |
| `__seo_keyword_type_mapping` | à trancher | 07 seo | 11.1 | 0 | 0/0/0 | 14/0 | — | — | fn morte 5 | référentiel ou donnée métier |
| `__seo_keywords` | vivante | 10 catalog | 13.0 | 13978 | 0/0/0 | 65/6050 | mod/admin/services/gamme-vlevel.service.ts | backend/sql/vlevel_health_checks.sql, mod/admin/controllers/internal-seo-audit.controller.ts +8 | fn 8; fn morte 12; vues 2; FK← 1 | référentiel ou donnée métier |
| `__seo_marque` | vivante | 07 seo | 0.3 | 35 | 0/0/0 | 25/11395 | — | backend/sql/021-create-rpc-get-brand-page-data-optimized.sql, mod/seo/services/chain/seo-template-renderer.service.ts +2 | fn 1 | référentiel ou donnée métier |
| `__seo_observable` | vivante | 07 seo | 1.5 | 1176 | 0/0/0 | 52/159982 | mod/seo/services/seo-generator.service.ts, mod/seo/validation/diagnostic.service.ts | backend/src/config/field-catalog.constants.ts, mod/admin/services/execution-router.service.ts +5 | fn 6; fn morte 3; vues 2 | référentiel ou donnée métier |
| `__seo_observable_policy` | morte | 07 seo | 0.0 | 32 | 0/0/0 | 10/0 | — | — | — | référentiel ou donnée métier |
| `__seo_outbox_event` | vivante | 07 seo | 0.0 | 0 | 0/0/0 | 1981336/0 | mod/seo/r2/services/outbox-relay.service.ts | mod/seo/r2/queues/r8-enrichment.constants.ts, mod/seo/r2/services/outbox-relay.service.ts +1 | fn 2 | référentiel ou donnée métier |
| `__seo_page` | vivante | 07 seo | 119.5 | 321838 | 0/0/0 | 43/2 | — | backend/src/config/phase2a-shadow-audit.constants.ts, mod/admin/services/seo-cockpit.service.ts +6 | fn 1; fn morte 1; vues 2 | référentiel ou donnée métier |
| `__seo_page_brief` | vivante | 07 seo | 0.3 | 33 | 0/0/0 | 41/5 | mod/admin/services/brief-template.service.ts, mod/admin/services/page-brief.service.ts | backend/src/config/field-catalog.constants.ts, mod/admin/services/brief-template.service.ts +1 | FK← 2 | référentiel ou donnée métier |
| `__seo_policy_evaluations` | à trancher | 07 seo | 0.1 | 0 | 0/0/0 | 16/0 | — | — | fn morte 1; FK← 1 | journal |
| `__seo_projection_conflicts` | vivante | 07 seo | 0.0 | 0 | 0/0/0 | 76/0 | mod/seo-projection/seo-projection-writer.service.ts | mod/seo-projection/seo-projection-writer.service.ts | — | référentiel ou donnée métier |
| `__seo_projection_runs` | vivante | 07 seo | 0.1 | 26 | 45/45/0 | 137/6 | mod/seo-projection/seo-projection-writer.service.ts | mod/seo-projection/seo-projection-writer.service.ts | FK← 5 | journal |
| `__seo_quality_history` (P) | vivante | 07 seo | 0.7 | 338 | 0/0/0 | 161/0 | mod/seo-monitoring/services/quality-history-snapshot.service.ts | mod/seo-monitoring/services/quality-history-snapshot.service.ts | cron 1; fn 2 | partitions d’instantanés |
| `__seo_quality_log` | à trancher | 07 seo | 0.0 | 0 | 0/0/0 | 11/0 | — | mod/seo/services/sitemap-v10-scoring.service.ts | fn morte 2; vues 1 | journal |
| `__seo_r1_gamme_slots` | vivante | 07 seo | 1.0 | 169 | 0/0/0 | 120/10837 | — | backend/src/config/field-catalog.constants.ts, mod/agentic-engine/constants/agentic.constants.ts +3 | fn 2; fn morte 1; vues 3 | référentiel ou donnée métier |
| `__seo_r1_image_prompts` | vivante | 07 seo | 0.3 | 70 | 0/0/0 | 29/12413 | mod/admin/services/r1-image-prompt.service.ts | mod/admin/services/r1-image-prompt.service.ts, mod/gamme-rest/services/gamme-response-builder.service.ts +1 | — | référentiel ou donnée métier |
| `__seo_r1_keyword_plan` | vivante | 23 ia-agents | 1.3 | 265 | 0/0/0 | 40/12 | mod/admin/services/r1-keyword-plan-gates.service.ts | mod/admin/controllers/admin-keyword-planner.controller.ts, mod/admin/services/r1-image-prompt.service.ts +2 | fn 1; vues 2 | référentiel ou donnée métier |
| `__seo_r1_related_blocks_cache` | vivante | 07 seo | 0.3 | 238 | 0/0/0 | 17/11928 | — | mod/gamme-rest/controllers/admin-r1-related-blocks-cache.controller.ts, mod/gamme-rest/services/r1-related-resources.service.ts | fn 2 | cache ou projection recalculable |
| `__seo_r2_composition_inputs` | vivante | 07 seo | 0.0 | 0 | 0/0/0 | 15/0 | mod/seo/r2/services/r2-composition-input-snapshot.service.ts | mod/seo/r2/schemas/r2-composition.schema.ts, mod/seo/r2/services/r2-composition-input-snapshot.service.ts | — | référentiel ou donnée métier |
| `__seo_r2_eligibility_log` | à trancher | 07 seo | 0.0 | 0 | 0/0/0 | 12/0 | — | — | — | journal |
| `__seo_r2_embeddings` | à trancher | 07 seo | 3.3 | 0 | 0/0/0 | 19/0 | — | — | — | référentiel ou donnée métier |
| `__seo_r2_keyword_plan` | à trancher | 07 seo | 0.0 | 0 | 0/0/0 | 24/0 | — | backend/src/config/field-catalog.constants.ts, packages/seo-role-contracts/src/contracts/r2.ts | — | référentiel ou donnée métier |
| `__seo_r2_metrics` | à trancher | 07 seo | 0.0 | 0 | 0/0/0 | 3/0 | — | — | — | cache ou projection recalculable |
| `__seo_r2_page_content` | morte | 07 seo | 0.0 | 0 | 0/0/0 | 4/0 | — | — | — | référentiel ou donnée métier |
| `__seo_r2_page_snapshot` | à trancher | 07 seo | 0.0 | 0 | 0/0/0 | 20/0 | — | — | FK← 1 | référentiel ou donnée métier |
| `__seo_r2_page_versions` | morte | 07 seo | 0.0 | 0 | 0/0/0 | 15/0 | — | — | — | référentiel ou donnée métier |
| `__seo_r2_pages` | à trancher | 07 seo | 0.1 | 0 | 0/0/0 | 22/0 | — | — | FK← 4 | référentiel ou donnée métier |
| `__seo_r2_qa_reviews` | morte | 07 seo | 0.0 | 0 | 0/0/0 | 12/0 | — | — | — | journal |
| `__seo_r2_regeneration_queue` | morte | 07 seo | 0.0 | 0 | 0/0/0 | 6/0 | — | — | — | journal |
| `__seo_r2_signatures` | à trancher | 07 seo | 0.1 | 0 | 0/0/0 | 25/0 | — | — | — | référentiel ou donnée métier |
| `__seo_r3_image_prompts` | vivante | 14 support | 0.1 | 10 | 0/0/0 | 3722/0 | mod/admin/services/r3-image-prompt.service.ts, mod/rag-proxy/services/rag-image-management.service.ts | mod/admin/services/r3-image-prompt.service.ts, mod/blog/services/blog-seo.service.ts +1 | — | référentiel ou donnée métier |
| `__seo_r3_keyword_plan` | vivante | 23 ia-agents | 2.1 | 260 | 0/0/0 | 42/3727 | — | mod/admin/controllers/admin-keyword-planner.controller.ts, mod/admin/controllers/internal-seo-audit.controller.ts +3 | fn 1; vues 3 | référentiel ou donnée métier |
| `__seo_r4_batch_runs` | vivante | 07 seo | 0.1 | 1 | 0/0/0 | 22/0 | mod/admin/services/r4-content-enricher.service.ts | mod/admin/services/r4-content-enricher.service.ts | — | journal |
| `__seo_r4_keyword_plan` | vivante | 23 ia-agents | 0.9 | 70 | 0/0/0 | 28/0 | — | backend/src/config/r4-keyword-plan.constants.ts, mod/admin/controllers/admin-keyword-planner.controller.ts +2 | fn 1; vues 2 | référentiel ou donnée métier |
| `__seo_r5_keyword_plan` | vivante | 23 ia-agents | 0.2 | 7 | 0/0/0 | 15/0 | — | mod/admin/controllers/admin-keyword-planner.controller.ts, mod/agentic-engine/constants/agentic.constants.ts | — | référentiel ou donnée métier |
| `__seo_r6_image_prompts` | à trancher | 07 seo | 0.1 | 2 | 0/0/0 | 21/0 | — | — | — | référentiel ou donnée métier |
| `__seo_r6_keyword_plan` | vivante | 23 ia-agents | 1.9 | 241 | 0/0/0 | 20/3 | — | mod/admin/controllers/admin-keyword-planner.controller.ts, mod/admin/controllers/internal-seo-audit.controller.ts +1 | fn 1; vues 2 | référentiel ou donnée métier |
| `__seo_r7_fingerprints` | vivante | 07 seo | 0.4 | 263 | 0/0/0 | 15/0 | — | backend/src/config/r7-keyword-plan.constants.ts | — | référentiel ou donnée métier |
| `__seo_r7_page_versions` | vivante | 07 seo | 2.2 | 263 | 0/0/0 | 12/0 | — | backend/src/config/r7-keyword-plan.constants.ts | — | référentiel ou donnée métier |
| `__seo_r7_pages` | vivante | 07 seo | 0.8 | 36 | 0/0/0 | 48/14865 | — | backend/src/config/r7-keyword-plan.constants.ts, mod/admin/services/execution-router.service.ts +2 | FK← 4 | référentiel ou donnée métier |
| `__seo_r7_qa_reviews` | à trancher | 07 seo | 0.0 | 0 | 0/0/0 | 9/0 | — | backend/src/config/r7-keyword-plan.constants.ts | — | journal |
| `__seo_r7_regeneration_queue` | à trancher | 07 seo | 0.0 | 0 | 0/0/0 | 13/0 | — | backend/src/config/r7-keyword-plan.constants.ts | — | journal |
| `__seo_r8_engine_family_stats` | à trancher | 07 seo | 0.0 | 0 | 0/0/0 | 11/0 | — | backend/src/config/r8-keyword-plan.constants.ts | — | cache ou projection recalculable |
| `__seo_r8_fingerprints` | vivante | 07 seo | 0.4 | 170 | 0/0/0 | 33/0 | — | backend/src/config/r8-keyword-plan.constants.ts | — | référentiel ou donnée métier |
| `__seo_r8_keyword_plan` | vivante | 23 ia-agents | 0.1 | 1 | 0/0/0 | 38/0 | — | backend/src/config/r8-keyword-plan.constants.ts, mod/agentic-engine/constants/agentic.constants.ts | — | référentiel ou donnée métier |
| `__seo_r8_page_versions` | vivante | 07 seo | 1.0 | 170 | 0/0/0 | 37/51 | — | backend/src/config/r8-keyword-plan.constants.ts | — | référentiel ou donnée métier |
| `__seo_r8_pages` | vivante | 07 seo | 1.1 | 155 | 0/0/0 | 72529/89081 | — | backend/src/config/feature-flags.service.ts, backend/src/config/field-catalog.constants.ts +6 | fn 1; FK← 5 | référentiel ou donnée métier |
| `__seo_r8_qa_reviews` | vivante | 07 seo | 0.3 | 163 | 0/0/0 | 20/0 | — | backend/src/config/r8-keyword-plan.constants.ts | — | journal |
| `__seo_r8_regeneration_queue` | vivante | 07 seo | 0.0 | 6 | 0/0/0 | 18/0 | — | backend/src/config/r8-keyword-plan.constants.ts | — | journal |
| `__seo_r8_similarity_index` | vivante | 07 seo | 0.5 | 218 | 0/0/0 | 13/3 | — | backend/src/config/r8-keyword-plan.constants.ts | — | référentiel ou donnée métier |
| `__seo_r8_snapshot_store` | vivante | 07 seo | 0.0 | 0 | 0/0/0 | 21/0 | — | mod/seo/r2/services/r2-r8-gate-status.service.ts, mod/seo/r2/services/r8-parent-enrichment.service.ts +2 | fn 1; FK← 1 | référentiel ou donnée métier |
| `__seo_reality_audit` | morte | 07 seo | 0.1 | 1 | 0/0/0 | 11/0 | — | — | — | journal |
| `__seo_reference` | vivante | 07 seo | 3.8 | 239 | 0/0/0 | 57/232582 | mod/seo/services/reference.service.ts, mod/seo/services/seo-generator.service.ts | backend/src/config/field-catalog.constants.ts, backend/src/config/r4-keyword-plan.constants.ts +7 | fn 4; fn morte 5; vues 1 | référentiel ou donnée métier |
| `__seo_research_brief` | vivante | 23 ia-agents | 0.1 | 6 | 0/0/0 | 17/0 | — | mod/agentic-engine/constants/agentic.constants.ts | — | référentiel ou donnée métier |
| `__seo_revert_candidates_log` | morte | 07 seo | 0.0 | 0 | 0/0/0 | 17/0 | — | — | — | journal |
| `__seo_role_canon_forbidden` | vivante | 07 seo | 0.0 | 126 | 0/0/0 | 7/0 | — | — | fn 1 | référentiel ou donnée métier |
| `__seo_role_content` | morte | 07 seo | 0.0 | 0 | 0/0/0 | 27/0 | — | — | — | référentiel ou donnée métier |
| `__seo_role_template_pool` | vivante | 07 seo | 0.1 | 0 | 18/0/0 | 10/19 | — | mod/seo/registries/seo-variant-family.registry.ts, mod/seo/services/chain/seo-role-template-selector.service.ts | — | référentiel ou donnée métier |
| `__seo_snapshot_cf_rum` (P) | à trancher | 07 seo | 4.3 | 0 | 0/0/0 | 1623/211836 | mod/seo-control-plane/collectors/cf-rum/cf-rum.service.ts | mod/seo-control-plane/collectors/cf-rum/cf-rum.service.ts | cron 1; fn 1 | partitions d’instantanés |
| `__seo_snapshot_synthetic` (P) | vivante | 07 seo | 2854.6 | 1680375 | 1538696/0/0 | 1285/2437 | mod/seo-control-plane/collectors/synthetic-crawler/synthetic-crawler.service.ts | mod/seo-control-plane/collectors/synthetic-crawler/synthetic-crawler.service.ts | cron 1; fn 1 | partitions d’instantanés |
| `__seo_type_switch` | vivante | 10 catalog | 0.1 | 134 | 0/0/0 | 11/417549 | — | mod/catalog/services/seo-template.service.ts, mod/products/services/cross-selling-seo.service.ts +2 | fn 1 | référentiel ou donnée métier |
| `__seo_type_vlevel` | à trancher | 07 seo | 1.8 | 6476 | 0/0/0 | 25/12 | — | — | — | référentiel ou donnée métier |
| `__sitemap_blog` | vivante | 07 seo | 0.1 | 330 | 0/0/0 | 25/65 | — | mod/seo/services/sitemap-v10-hubs-priority.service.ts, mod/seo/services/sitemap-v10-static.service.ts | — | cache ou projection recalculable |
| `__sitemap_marque` | à trancher | 07 seo | 0.1 | 35 | 0/0/0 | 197/0 | — | — | vues 1 | cache ou projection recalculable |
| `__sitemap_motorisation` | à trancher | 07 seo | 2.8 | 12756 | 0/0/0 | 12/23 | — | — | — | cache ou projection recalculable |
| `__sitemap_p_link` | vivante | 07 seo | 99.1 | 472917 | 0/0/0 | 747/34941 | — | mod/seo/services/sitemap-v10-hubs-cluster.service.ts, mod/seo/services/sitemap-v10-hubs-priority.service.ts +4 | fn morte 1; vues 1 | cache ou projection recalculable |
| `__sitemap_p_xml` | à trancher | 07 seo | 0.7 | 1960 | 0/0/0 | 14/0 | — | — | — | cache ou projection recalculable |
| `__sitemap_search_link` | à trancher | 07 seo | 0.2 | 1 | 0/0/0 | 22/0 | — | — | — | cache ou projection recalculable |
| `__soft_404_events` | vivante | 07 seo | 129.1 | 498862 | 316703/0/427184 | 56/59 | — | — | cron 2; fn 2; vues 1 | journal |
| `__staging_article_mapping` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 14/0 | — | — | fn morte 1 | import et préparation |
| `__staging_brand_mapping` | à trancher | 10 catalog | 0.7 | 1900 | 0/0/0 | 8/4 | — | — | fn morte 3 | import et préparation |
| `__staging_piece_compat` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 11/0 | — | — | fn morte 1 | import et préparation |
| `__staging_vehicle_mapping` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 8/0 | — | — | fn morte 1 | import et préparation |
| `__substitution_logs` | vivante | 07 seo | 19.9 | 29305 | 14946/0/0 | 18/3 | mod/substitution/services/substitution-logger.service.ts | mod/substitution/services/substitution-logger.service.ts | vues 2 | journal |
| `__tecdoc_import_log` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 6/0 | — | — | — | import et préparation |
| `__tecdoc_supplier_mapping` | à trancher | 10 catalog | 0.2 | 846 | 0/0/0 | 7/0 | — | — | vues 2 | référentiel ou donnée métier |
| `__trend_signals` | vivante | 04 marketing | 0.0 | 0 | 0/0/0 | 11/0 | mod/trend-signals/trend-signals.service.ts | mod/trend-signals/processors/trend-signals.processor.ts, mod/trend-signals/sources/rappels-gouv-fr.fetcher.ts +1 | — | référentiel ou donnée métier |
| `__v_level_computed` | morte | 10 catalog | 0.1 | 16 | 0/0/0 | 16/0 | — | — | — | référentiel ou donnée métier |
| `__v_level_raw` | morte | 10 catalog | 0.0 | 16 | 0/0/0 | 14/0 | — | — | — | référentiel ou donnée métier |
| `__vehicle_page_cache` | vivante | 10 catalog | 244.8 | 28505 | 0/488/0 | 87/166547 | mod/vehicles/services/vehicle-rpc.service.ts | mod/admin/controllers/admin-vehicle-cache.controller.ts, mod/admin/services/r8-vehicle-enricher.service.ts +2 | fn 5 | cache ou projection recalculable |
| `__video_assets` | vivante | 08 media | 0.0 | 0 | 0/0/0 | 20/0 | mod/media-factory/services/video-data.service.ts | mod/media-factory/services/video-data.service.ts | — | référentiel ou donnée métier |
| `__video_audio_cache` | vivante | 08 media | 0.0 | 1 | 0/0/0 | 12/0 | mod/media-factory/services/audio-cache.service.ts | mod/media-factory/services/audio-cache.service.ts | — | cache ou projection recalculable |
| `__video_execution_log` | vivante | 08 media | 0.2 | 9 | 0/0/0 | 53/3 | mod/media-factory/services/postprocess.service.ts, mod/media-factory/services/video-job.service.ts +1 | mod/media-factory/services/postprocess.service.ts, mod/media-factory/services/video-job.service.ts +1 | FK← 1 | journal |
| `__video_productions` | vivante | 08 media | 0.1 | 2 | 0/0/0 | 54/0 | mod/media-factory/services/derivative-engine.service.ts, mod/media-factory/services/script-generator.service.ts +2 | mod/media-factory/services/derivative-engine.service.ts, mod/media-factory/services/script-generator.service.ts +2 | — | référentiel ou donnée métier |
| `__video_templates` | à trancher | 08 media | 0.0 | 0 | 0/0/0 | 16/0 | — | mod/media-factory/render/templates/template-registry.ts, mod/media-factory/services/video-data.service.ts | — | référentiel ou donnée métier |
| `__video_variants` | vivante | 08 media | 0.0 | 0 | 0/0/0 | 16/0 | mod/media-factory/services/postprocess.service.ts | mod/media-factory/services/postprocess.service.ts | — | référentiel ou donnée métier |
| `__write_audit_log` | vivante | 23 ia-agents | 2.0 | 2380 | 0/0/0 | 15/1 | backend/src/config/write-guard-ledger.service.ts | backend/src/config/write-guard-ledger.service.ts | — | journal |
| `__write_collision_ledger` | vivante | 23 ia-agents | 0.0 | 0 | 0/0/0 | 25/0 | backend/src/config/write-guard-ledger.service.ts | backend/src/config/write-guard-ledger.service.ts | — | journal |
| `_killswitch_audit` | vivante | 23 ia-agents | 0.0 | 0 | 0/0/0 | 2/0 | — | — | fn 1; fn morte 2 | journal |
| `_killswitch_breakglass` | vivante | 23 ia-agents | 0.0 | 0 | 0/0/0 | 8/0 | — | — | fn 1; fn morte 3 | référentiel ou donnée métier |
| `agent_scope_table_rules` | vivante | 23 ia-agents | 0.1 | 64 | 0/0/0 | 22/0 | — | — | fn 1 | référentiel ou donnée métier |
| `agent_write_scopes` | vivante | 23 ia-agents | 0.0 | 34 | 0/0/0 | 9/0 | — | — | fn 2 | référentiel ou donnée métier |
| `am_2022_suppliers` | à trancher | 12 supplier | 0.9 | 1087 | 0/0/0 | 13/2 | — | — | — | référentiel ou donnée métier |
| `audit_vlevel_pg424_snapshot_20260608` | copie datée | 10 catalog | 0.2 | 1616 | 0/0/0 | 0/0 | — | — | — | copie ponctuelle |
| `auto_marque` | vivante | 10 catalog | 0.1 | 117 | 0/0/0 | 140021/93919360 | — | backend/sql/004-create-rpc-get-pieces-for-type-gamme-v2.sql, backend/sql/006-create-rpc-get-pieces-for-type-gamme-v3.sql +17 | fn 14; fn morte 5; FK← 1 | référentiel ou donnée métier |
| `auto_modele` | vivante | 10 catalog | 2.3 | 8150 | 0/102/0 | 146636/93740065 | — | backend/sql/004-create-rpc-get-pieces-for-type-gamme-v2.sql, backend/sql/006-create-rpc-get-pieces-for-type-gamme-v3.sql +13 | fn 15; fn morte 11 | référentiel ou donnée métier |
| `auto_modele_group` | à trancher | 10 catalog | 0.6 | 1957 | 0/0/0 | 8/0 | — | — | — | référentiel ou donnée métier |
| `auto_modele_robot` | à trancher | 10 catalog | 0.1 | 1 | 0/0/0 | 9/0 | — | — | — | référentiel ou donnée métier |
| `auto_type` | vivante | 07 seo | 47.1 | 53959 | 0/0/0 | 9072/21911658 | — | backend/sql/004-create-rpc-get-pieces-for-type-gamme-v2.sql, backend/sql/006-create-rpc-get-pieces-for-type-gamme-v3.sql +20 | fn 18; fn morte 14; vues 2; FK← 2 | référentiel ou donnée métier |
| `auto_type_motor_code` | vivante | 10 catalog | 10.4 | 63091 | 0/0/0 | 426872/2590646 | — | backend/sql/004-create-rpc-get-pieces-for-type-gamme-v2.sql, backend/sql/005-create-indexes-oem-performance.sql +4 | fn 4; fn morte 1 | référentiel ou donnée métier |
| `auto_type_motor_fuel` | à trancher | 10 catalog | 0.1 | 26 | 0/0/0 | 29/0 | — | — | — | référentiel ou donnée métier |
| `auto_type_number_code` | vivante | 10 catalog | 35.9 | 165027 | 0/0/0 | 426872/2598168 | — | mod/catalog/services/compatibility.service.ts, mod/gamme-rest/services/gamme-rpc.service.ts +2 | fn 2 | référentiel ou donnée métier |
| `catalog_family` | vivante | 06 content | 0.2 | 19 | 0/0/0 | 27420/2625 | — | backend/check-tables-columns.py, backend/diagnose-supabase-connection.sh +7 | fn 8; fn morte 2 | référentiel ou donnée métier |
| `catalog_gamme` | vivante | 10 catalog | 0.1 | 177 | 0/0/0 | 5847314/137462 | — | backend/check-tables-columns.py, backend/sql/004-create-rpc-get-pieces-for-type-gamme-v2.sql +14 | cron 1; fn 13; fn morte 4 | référentiel ou donnée métier |
| `catalog_pricing_baseline` | à trancher | 16 pricing | 0.0 | 0 | 0/0/0 | 4/0 | — | mod/pricing/services/pricing.repository.ts | cron 1; fn 1 | cache ou projection recalculable |
| `catalog_pricing_baseline_meta` | à trancher | 16 pricing | 0.0 | 0 | 0/0/0 | 1/0 | — | — | FK← 1 | référentiel ou donnée métier |
| `crawl_budget_experiments` | vivante | 07 seo | 0.1 | 2 | 0/0/0 | 68/0 | mod/seo-logs/services/crawl-budget-supabase.service.ts | mod/seo-logs/services/crawl-budget-supabase.service.ts, mod/seo/services/sitemap-v10-pieces.service.ts | FK← 1 | référentiel ou donnée métier |
| `crawl_budget_metrics` | vivante | 07 seo | 0.0 | 0 | 0/0/0 | 6/0 | mod/seo-logs/services/crawl-budget-supabase.service.ts | mod/seo-logs/services/crawl-budget-supabase.service.ts | — | cache ou projection recalculable |
| `decision_article` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 9/0 | — | — | fn morte 3 | import et préparation |
| `decision_brand` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 9/0 | — | — | fn morte 4 | import et préparation |
| `decision_compat` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 9/0 | — | — | fn morte 1 | import et préparation |
| `error_logs` | à trancher | 20 product | 0.1 | 0 | 0/0/0 | 18/0 | — | mod/navigation/services/seo-menu.service.ts, mod/seo/seo.service.ts | fn morte 1 | journal |
| `error_statistics` | morte | 22 data | 0.0 | 0 | 0/0/0 | 8/0 | — | — | — | référentiel ou donnée métier |
| `gamme_aggregates` | vivante | 07 seo | 7.2 | 241 | 0/1053452/0 | 6010/1054361 | — | mod/admin/controllers/admin-keyword-planner.controller.ts, mod/admin/services/admin-gammes-seo.service.ts +2 | cron 1; fn 3; vues 3 | cache ou projection recalculable |
| `gamme_filter_criteria` | morte | 10 catalog | 0.1 | 320 | 0/0/0 | 6/0 | — | — | — | référentiel ou donnée métier |
| `gamme_seo_audit` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 8/0 | — | mod/admin/services/gamme-seo-audit.service.ts, mod/admin/services/seo-cockpit.service.ts | fn 2 | journal |
| `gamme_seo_metrics` | vivante | 10 catalog | 0.3 | 239 | 0/0/0 | 14/4321 | backend/sql/020-trigger-v2-uniqueness.sql, mod/admin/services/admin-gammes-seo.service.ts | backend/sql/020-trigger-v2-uniqueness.sql, mod/admin/services/admin-gammes-seo.service.ts | cron 1; fn 1; vues 1 | cache ou projection recalculable |
| `gate_thresholds` | à trancher | 23 ia-agents | 0.1 | 17 | 0/0/0 | 8/0 | — | — | fn morte 1; vues 2 | référentiel ou donnée métier |
| `ic_postback` | vivante | 13 sales | 4.1 | 5926 | 10/0/0 | 1927/2937 | mod/payments/controllers/payment-callback.controller.ts, mod/payments/repositories/payment-data.service.ts +1 | backend/src/database/services/orders.service.ts, mod/payments/controllers/payment-callback.controller.ts +3 | — | référentiel ou donnée métier |
| `import_batch` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 7/0 | — | — | fn morte 3; FK← 13 | import et préparation |
| `kg_audit_log` | morte | 11 diagnostic | 0.0 | 0 | 0/0/0 | 11/0 | — | — | — | journal |
| `kg_case_outcomes` | à trancher | 11 diagnostic | 0.0 | 0 | 0/0/0 | 8/0 | — | — | fn morte 1 | journal |
| `kg_cases` | à trancher | 11 diagnostic | 0.1 | 0 | 0/0/0 | 16/0 | — | — | fn morte 1; FK← 2 | référentiel ou donnée métier |
| `kg_confidence_config` | vivante | 11 diagnostic | 0.0 | 1 | 0/0/0 | 10/0 | — | — | fn 2 | référentiel ou donnée métier |
| `kg_diagnostic_cases` | à trancher | 11 diagnostic | 0.0 | 0 | 0/0/0 | 8/0 | — | — | fn morte 3 | référentiel ou donnée métier |
| `kg_edge_history` | morte | 11 diagnostic | 0.0 | 0 | 0/0/0 | 6/0 | — | — | — | journal |
| `kg_edges` | vivante | 11 diagnostic | 0.2 | 72 | 0/0/0 | 50/3 | mod/knowledge-graph/kg-data.service.ts | mod/knowledge-graph/kg-data.service.ts, mod/knowledge-graph/kg.service.ts | fn 5; fn morte 6; vues 4 | référentiel ou donnée métier |
| `kg_engine_families` | vivante | 11 diagnostic | 0.1 | 10 | 0/0/0 | 31/0 | — | — | fn 1; fn morte 2; vues 1 | référentiel ou donnée métier |
| `kg_feedback_config` | à trancher | 11 diagnostic | 0.0 | 12 | 0/0/0 | 6/0 | — | — | fn morte 4 | référentiel ou donnée métier |
| `kg_feedback_events` | à trancher | 11 diagnostic | 0.0 | 0 | 0/0/0 | 14/0 | — | — | fn morte 2; vues 1 | journal |
| `kg_learning_log` | morte | 11 diagnostic | 0.0 | 0 | 0/0/0 | 8/0 | — | — | — | journal |
| `kg_node_history` | morte | 11 diagnostic | 0.0 | 0 | 0/0/0 | 6/0 | — | — | — | journal |
| `kg_nodes` | vivante | 11 diagnostic | 0.5 | 89 | 0/0/0 | 153/147 | mod/knowledge-graph/kg-data.service.ts | mod/knowledge-graph/kg-data.service.ts | fn 8; fn morte 13; vues 7; FK← 4 | référentiel ou donnée métier |
| `kg_rag_mapping` | à trancher | 11 diagnostic | 0.0 | 0 | 0/0/0 | 13/0 | — | — | fn morte 2 | référentiel ou donnée métier |
| `kg_rag_sync_log` | à trancher | 11 diagnostic | 0.0 | 0 | 0/0/0 | 15/0 | — | — | fn morte 2; vues 2 | journal |
| `kg_reasoning_cache` | vivante | 11 diagnostic | 0.1 | 7 | 0/0/0 | 13/0 | mod/knowledge-graph/kg.service.ts | mod/knowledge-graph/kg-data.service.ts, mod/knowledge-graph/kg.service.ts | fn 1 | cache ou projection recalculable |
| `kg_review_queue` | à trancher | 11 diagnostic | 0.0 | 0 | 0/0/0 | 9/0 | — | — | fn morte 3 | journal |
| `kg_safety_triggers` | vivante | 11 diagnostic | 0.0 | 13 | 0/0/0 | 8/0 | — | — | fn 1 | référentiel ou donnée métier |
| `kg_truth_labels` | à trancher | 11 diagnostic | 0.1 | 0 | 0/0/0 | 19/0 | — | — | fn morte 3; vues 2 | référentiel ou donnée métier |
| `kg_weight_adjustments` | morte | 11 diagnostic | 0.0 | 0 | 0/0/0 | 10/0 | — | — | — | référentiel ou donnée métier |
| `natural_key_article` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 8/0 | — | — | fn morte 2 | import et préparation |
| `natural_key_brand` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 8/0 | — | — | fn morte 4 | import et préparation |
| `natural_key_vehicle` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 8/0 | — | — | fn morte 1 | import et préparation |
| `norm_article` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 10/0 | — | — | fn morte 1 | import et préparation |
| `norm_brand` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 10/0 | — | — | fn morte 6 | import et préparation |
| `norm_vehicle` | morte | 10 catalog | 0.0 | 0 | 0/0/0 | 10/0 | — | — | — | import et préparation |
| `order_idempotency` | vivante | 13 sales | 0.1 | 44 | 16/16/0 | 24158/18 | mod/orders/controllers/orders.controller.ts, mod/orders/services/order-cleanup.service.ts | mod/orders/controllers/orders.controller.ts, mod/orders/services/order-cleanup.service.ts +2 | — | référentiel ou donnée métier |
| `order_resume_tokens` | vivante | 13 sales | 0.1 | 42 | 16/0/0 | 68/7 | mod/orders/controllers/orders.controller.ts, mod/orders/services/order-cleanup.service.ts | mod/orders/controllers/orders.controller.ts, mod/orders/services/order-cleanup.service.ts | — | référentiel ou donnée métier |
| `password_resets` | vivante | 14 support | 0.1 | 17 | 1/0/0 | 10/1 | — | — | fn morte 1 | référentiel ou donnée métier |
| `pieces` | vivante | 10 catalog | 1718.8 | 4155716 | 0/7/0 | 225/576186051 | — | backend/sql/002-create-rpc-vehicle-compatible-gammes.sql, backend/sql/003-create-rpc-get-pieces-for-type-gamme.sql +43 | cron 1; fn 31; fn morte 23; vues 5; FK← 7 | référentiel ou donnée métier |
| `pieces_criteria` | vivante | 10 catalog | 9882.3 | 17881382 | 0/0/0 | 14/63155697 | — | backend/sql/003-create-rpc-get-pieces-for-type-gamme.sql, backend/sql/004-create-rpc-get-pieces-for-type-gamme-v2.sql +4 | fn 6; fn morte 1 | référentiel ou donnée métier |
| `pieces_criteria_group` | à trancher | 10 catalog | 1.3 | 4266 | 0/0/0 | 14/8 | — | — | — | référentiel ou donnée métier |
| `pieces_criteria_link` | vivante | 10 catalog | 23.9 | 77434 | 0/0/0 | 20/23837 | — | — | fn 1 | référentiel ou donnée métier |
| `pieces_details` | à trancher | 10 catalog | 0.2 | 1 | 0/0/0 | 18/0 | — | — | — | référentiel ou donnée métier |
| `pieces_display_history` | vivante | 10 catalog | 1.3 | 9316 | 0/0/0 | 2/0 | — | — | cron 1; fn 4 | journal |
| `pieces_gamme` | vivante | 14 support | 11.6 | 9719 | 0/0/0 | 96961/103618352 | mod/admin/services/admin-gammes-seo.service.ts, mod/rag-proxy/services/rag-image-management.service.ts | backend/check-tables-columns.py, backend/find_explanation_column.py +60 | cron 1; fn 36; fn morte 14; vues 10; FK← 5 | référentiel ou donnée métier |
| `pieces_gamme_cross` | vivante | 10 catalog | 0.4 | 1406 | 0/0/0 | 10/78 | — | mod/products/services/cross-selling-source.service.ts | — | référentiel ou donnée métier |
| `pieces_gamme_display_history` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 2/0 | — | — | cron 1; fn 3 | journal |
| `pieces_gamme_link_history` | vivante | 10 catalog | 0.0 | 1 | 0/0/0 | 2/0 | — | — | cron 1; fn 3 | journal |
| `pieces_list` | à trancher | 10 catalog | 426.6 | 1805831 | 0/0/0 | 6/0 | — | — | — | référentiel ou donnée métier |
| `pieces_marque` | vivante | 10 catalog | 0.6 | 992 | 0/0/0 | 24345/526516426 | — | backend/sql/003-create-rpc-get-pieces-for-type-gamme.sql, backend/sql/004-create-rpc-get-pieces-for-type-gamme-v2.sql +16 | fn 13; fn morte 12; vues 4; FK← 1 | référentiel ou donnée métier |
| `pieces_media_img` | vivante | 10 catalog | 3469.4 | 9631525 | 0/0/0 | 10/63130417 | — | backend/sql/003-create-rpc-get-pieces-for-type-gamme.sql, backend/sql/004-create-rpc-get-pieces-for-type-gamme-v2.sql +7 | fn 7; fn morte 3; vues 1 | référentiel ou donnée métier |
| `pieces_media_img_backup_pm3040_20260610` | copie datée | 08 media | 1.0 | 13477 | 0/0/0 | 0/0 | — | — | — | copie ponctuelle |
| `pieces_media_img_backup_pm3410_20260610` | copie datée | 08 media | 6.9 | 100020 | 0/0/0 | 0/0 | — | — | — | copie ponctuelle |
| `pieces_media_img_p1_backup_20260523` | copie datée | 08 media | 1.4 | 17951 | 0/0/0 | 0/0 | — | — | — | copie ponctuelle |
| `pieces_media_img_recover_flips_pm3040_20260610` | copie datée | 08 media | 2.5 | 16004 | 0/0/0 | 1/0 | — | — | — | copie ponctuelle |
| `pieces_media_img_recover_flips_pm3410_20260610` | copie datée | 08 media | 13.2 | 91579 | 0/0/0 | 1/0 | — | — | — | copie ponctuelle |
| `pieces_media_img_recover_manifest_pm3040_20260610` | copie datée | 08 media | 1.9 | 6452 | 0/0/0 | 1/0 | — | — | — | copie ponctuelle |
| `pieces_media_img_recover_manifest_pm3410_20260610` | copie datée | 08 media | 2.3 | 10171 | 0/0/0 | 1/0 | — | — | — | copie ponctuelle |
| `pieces_media_img_tier_c_flipped_20260523` | copie datée | 08 media | 149.5 | 1107390 | 0/0/0 | 1/0 | — | — | — | copie ponctuelle |
| `pieces_price` | vivante | 10 catalog | 519.0 | 476086 | 0/404/0 | 6536/70228759 | — | backend/sql/003-create-rpc-get-pieces-for-type-gamme.sql, backend/sql/004-create-rpc-get-pieces-for-type-gamme-v2.sql +16 | fn 18; fn morte 3 | référentiel ou donnée métier |
| `pieces_price_history` (P) | vivante | 16 pricing | 5.3 | 18038 | 387/0/0 | 609/207 | — | — | cron 2; fn 7 | partitions d’instantanés |
| `pieces_ref_brand` | vivante | 10 catalog | 1.2 | 5853 | 0/0/0 | 2590068/5339 | — | backend/sql/004-create-rpc-get-pieces-for-type-gamme-v2.sql, backend/sql/005-create-indexes-oem-performance.sql +5 | fn 5; fn morte 1 | référentiel ou donnée métier |
| `pieces_ref_ean` | à trancher | 10 catalog | 559.7 | 3018757 | 0/0/0 | 3/0 | — | — | fn morte 1 | référentiel ou donnée métier |
| `pieces_ref_oem` | vivante | 10 catalog | 3299.3 | 15415936 | 0/0/0 | 4/2575 | — | mod/search/controllers/search-debug.controller.ts, mod/search/services/search-enhanced-existing.service.ts +2 | — | référentiel ou donnée métier |
| `pieces_ref_search` | vivante | 10 catalog | 10599.6 | 72900712 | 0/0/0 | 6/51307179 | — | backend/sql/004-create-rpc-get-pieces-for-type-gamme-v2.sql, backend/sql/005-create-indexes-oem-performance.sql +10 | fn 5; fn morte 1 | référentiel ou donnée métier |
| `pieces_relation_criteria` | vivante | 10 catalog | 32619.2 | 157986384 | 0/0/0 | 4/68940055 | — | backend/sql/003-create-rpc-get-pieces-for-type-gamme.sql, backend/sql/004-create-rpc-get-pieces-for-type-gamme-v2.sql +3 | fn 5; fn morte 1 | référentiel ou donnée métier |
| `pieces_relation_type` | vivante | 10 catalog | 53049.4 | 367959136 | 0/0/0 | 13/1527240527 | mod/catalog/controllers/catalog-integrity.controller.ts | backend/sql/001-create-index-vehicle-compatibility.sql, backend/sql/001a-create-index-concurrently.sql +15 | fn 12; fn morte 16; vues 3 | référentiel ou donnée métier |
| `pieces_side_filtre` | vivante | 10 catalog | 0.0 | 5 | 0/0/0 | 63106426/0 | — | backend/sql/003-create-rpc-get-pieces-for-type-gamme.sql, backend/sql/004-create-rpc-get-pieces-for-type-gamme-v2.sql +3 | fn 5; fn morte 1 | référentiel ou donnée métier |
| `pieces_status` | à trancher | 10 catalog | 0.1 | 13 | 0/0/0 | 8/0 | — | — | — | référentiel ou donnée métier |
| `pipeline_event_log` | à trancher | 23 ia-agents | 0.1 | 0 | 0/0/0 | 10/0 | — | — | fn morte 3; vues 4 | journal |
| `price_import_batch_chunks` | vivante | 16 pricing | 0.1 | 25 | 1/2/0 | 12/2 | mod/pricing/services/pricing.repository.ts | mod/pricing/services/pricing.repository.ts | fn 3 | référentiel ou donnée métier |
| `price_import_batches` | vivante | 16 pricing | 0.1 | 13 | 1/2/0 | 51/25 | mod/pricing/services/pricing.repository.ts | mod/pricing/services/pricing.repository.ts | fn 3; FK← 11 | référentiel ou donnée métier |
| `pricing_decision_snapshot` (P) | à trancher | 16 pricing | 0.6 | 0 | 0/0/0 | 119/3 | — | — | cron 1; fn 1 | partitions d’instantanés |
| `pricing_rules` | vivante | 16 pricing | 0.0 | 6 | 0/0/0 | 9/0 | — | mod/pricing/services/pricing-strategy.service.ts, mod/pricing/services/pricing.repository.ts | — | référentiel ou donnée métier |
| `promo_codes` | vivante | 13 sales | 0.1 | 8 | 0/0/0 | 23/0 | — | backend/src/database/services/promo-data.service.ts | FK← 1 | référentiel ou donnée métier |
| `promo_usage` | à trancher | 13 sales | 0.0 | 0 | 0/0/0 | 7/0 | — | backend/src/database/services/promo-data.service.ts | — | référentiel ou donnée métier |
| `quantity_discounts` | à trancher | 16 pricing | 0.1 | 6 | 0/0/0 | 5/0 | — | — | — | référentiel ou donnée métier |
| `reviews` | à trancher | 14 support | 0.1 | 0 | 0/0/0 | 13/0 | — | mod/support/types/index.ts | — | référentiel ou donnée métier |
| `rm_build_log` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 8/0 | — | — | fn morte 1 | journal |
| `rm_data_version` | morte | 10 catalog | 0.1 | 24 | 0/0/0 | 6/0 | — | — | — | référentiel ou donnée métier |
| `rm_facet_config` | vivante | 10 catalog | 0.1 | 1 | 0/0/0 | 3/0 | — | — | fn 2; fn morte 1 | référentiel ou donnée métier |
| `rm_facets` | vivante | 10 catalog | 0.0 | 2 | 0/0/0 | 1/0 | — | — | fn 1 | référentiel ou donnée métier |
| `rm_listing` | vivante | 10 catalog | 0.1 | 3 | 0/0/0 | 18/0 | — | mod/rm/controllers/rm.controller.ts, mod/rm/rm.module.ts +2 | fn 2; fn morte 1; FK← 1 | référentiel ou donnée métier |
| `rm_listing_content` | morte | 10 catalog | 0.0 | 0 | 0/0/0 | 1/1 | — | — | — | référentiel ou donnée métier |
| `rm_listing_products` (P) | à trancher | 10 catalog | 0.5 | 0 | 0/0/0 | 89/0 | — | — | fn 1; fn morte 2 | partitions d’instantanés |
| `rm_oem_top` | morte | 10 catalog | 0.0 | 0 | 0/0/0 | 1/0 | — | — | — | référentiel ou donnée métier |
| `rm_product` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 20/0 | — | — | fn 2; fn morte 1 | référentiel ou donnée métier |
| `rm_rebuild_queue` | vivante | 10 catalog | 0.0 | 0 | 0/0/0 | 31/0 | — | — | fn 1; fn morte 3 | journal |
| `seo_link_clicks` | vivante | 07 seo | 0.8 | 581 | 174/0/0 | 17/21 | mod/seo/infrastructure/seo-link-tracking.service.ts | mod/seo/infrastructure/seo-link-tracking.service.ts | fn 1; vues 4 | référentiel ou donnée métier |
| `seo_link_impressions` | vivante | 07 seo | 122.5 | 459567 | 160840/0/0 | 5/17 | mod/seo/infrastructure/seo-link-tracking.service.ts | mod/seo/infrastructure/seo-link-tracking.service.ts | — | référentiel ou donnée métier |
| `seo_link_metrics_daily` | vivante | 07 seo | 0.0 | 0 | 0/0/0 | 9/0 | — | — | fn 1 | cache ou projection recalculable |
| `shipping_rates_cache` | à trancher | 15 logistics | 0.1 | 5 | 0/0/0 | 8/0 | — | — | — | cache ou projection recalculable |
| `stg_article` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 8/0 | — | — | fn morte 1; FK← 1 | import et préparation |
| `stg_brand` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 3/0 | — | — | fn morte 3; FK← 1 | import et préparation |
| `stg_compatibility` | morte | 10 catalog | 0.0 | 0 | 0/0/0 | 3/0 | — | — | — | import et préparation |
| `stg_vehicle` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 4/0 | — | — | fn morte 1; FK← 1 | import et préparation |
| `supplier_import_raw` | vivante | 16 pricing | 0.1 | 4 | 0/0/0 | 18/0 | mod/pricing/services/pricing.repository.ts | mod/pricing/services/pricing.repository.ts | FK← 1 | référentiel ou donnée métier |
| `supplier_offer_snapshot` (P) | à trancher | 12 supplier | 0.4 | 0 | 0/0/0 | 229/9 | — | mod/supplier-truth/supplier-sync.processor.ts, mod/supplier-truth/supplier-sync.runner.ts +3 | cron 1; fn 2 | partitions d’instantanés |
| `supplier_price_profiles` | vivante | 16 pricing | 0.0 | 1 | 0/0/0 | 18/0 | — | mod/pricing/services/pricing.repository.ts | — | référentiel ou donnée métier |
| `support_tickets` | morte | 14 support | 0.1 | 0 | 0/0/0 | 19/0 | — | — | — | référentiel ou donnée métier |
| `users` | vivante | 20 product | 0.0 | 2 | 0/0/0 | 6/0 | — | mod/admin/services/reporting.service.ts, mod/layout/services/layout.service.ts +1 | — | référentiel ou donnée métier |
| `write_scope_violations` | vivante | 23 ia-agents | 0.0 | 0 | 0/0/0 | 5/0 | — | — | fn 1 | journal |
| `xref_article` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 10/0 | — | — | fn morte 2 | import et préparation |
| `xref_brand` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 10/0 | — | — | fn morte 4 | import et préparation |
| `xref_vehicle` | à trancher | 10 catalog | 0.0 | 0 | 0/0/0 | 10/0 | — | — | fn morte 1 | import et préparation |

## 9. Limites

- Une seule base sert DEV, PREPROD et PROD : les compteurs couvrent tout le trafic, mais ne disent pas quel environnement lit (mesuré).
- Les compteurs d’activité et `pg_stat_statements` partent du 2026-09-17 00:53 UTC : une table lue une fois par trimestre peut paraître morte (limite).
- Le registre des migrations (`supabase_migrations.schema_migrations`) s’arrête au 2026-10-04 : les dates de création postérieures viennent des fichiers du dépôt, pas de la base (mesuré).
- Les lecteurs hors dépôt ont été cherchés dans les dépôts voisins du VPS DEV (rag, raw, wiki, auto-research, mcp-ga4, mcp-gsc, marketing, data, ~/bin) ; ni la PROD ni les postes de travail n’ont été vus (non fait).
- Un nom de table construit dynamiquement dans le code échappe au `git grep` ; seuls `gamme_${pgId}` et `_${hint}_` existent, et ne visent aucun candidat (mesuré).
- La classe « vivante » ne dit pas que la table est utile au métier, seulement qu’elle est écrite ou lue (déduit).
- Les vues et vues matérialisées du schéma public ne sont pas classées (non fait).
- Les familles de conservation sont tirées du nom et de la classe : c’est une proposition à relire (proposé).
