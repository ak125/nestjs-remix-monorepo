# Le ledger dit « appliquée ». La base dit « absente ». 24 fois.

> Mesuré le 2026-09-07 sur le projet live, **lecture seule**. Reproductible :
> `python3 scripts/audit/extract-declared-objects.py /tmp/declared.json` produit la
> liste des objets déclarés par chaque migration ; la requête catalogue qui vérifie
> leur existence est dérivée de cette liste. Aucune mutation.

## Le fait

`infra.schema_migrations` compte **300 lignes `applied`, 0 `failed`, 0 `applying`,
0 drift**. C'est vrai — et ça ne veut pas dire ce qu'on croit :

| origine de la ligne | nombre | ce que la ligne prouve |
|---|---|---|
| `baseline-2026-05-16` | **221** | rien n'a été exécuté — l'objet est *supposé* déjà là |
| `baseline-33810961050` (2026-09-02) | **49** | idem |
| exécutions réelles | **30** | la migration a tourné, durée mesurée |

**270 des 300 lignes sont des suppositions**, pas des exécutions. C'est le mode
d'emploi documenté de `--baseline` (« adopter le moteur sur un projet où les
migrations sont déjà déployées par un autre canal ») — mais **rien n'a jamais
vérifié la supposition**.

## La vérification, faite

Pour chaque fichier de migration, les objets déclarés (`CREATE TABLE`, `VIEW`,
`FUNCTION`, `TYPE`, `ALTER TYPE … ADD VALUE`) ont été extraits puis cherchés au
catalogue, **tous schémas confondus**.

> ⚠️ Les décomptes de ce tableau sont un premier passage manuel. Ils ont été corrigés
> le même jour par la mesure mécanisée — voir la section « Correction » en fin de document.

| type d'objet | déclarés vérifiés | absents |
|---|---|---|
| relations (tables, vues) | 148 | **38** |
| fonctions | 37 | **10** |
| types | 11 | **3** |
| valeurs d'enum | 5 | **1** |

Les 38 relations absentes se séparent proprement en deux :

**a) 14 archivées volontairement** — présentes dans le schéma `_archive`, déplacées
par `SET SCHEMA` : les 7 tables `__agentic_*`, `__seo_entity`,
`__seo_entity_score_v10`, `v_seo_dashboard_kpis`, `v_seo_index_losses_7d`,
`v_seo_operational_queue`, `v_seo_temperature_stats`, `v_seo_url_health`.
Ce n'est pas une anomalie du ledger, c'est un archivage — mais il n'a laissé
**aucune trace de migration** dans le dépôt, et le code qui les lit n'a pas suivi.

**b) 24 introuvables dans tous les schémas** — déclarées par une migration que le
ledger dit `applied`, et nulle part en base :

`__lighthouse_alerts` · `__lighthouse_runs` · `__marketing_brief` ·
`__phase2a_audit_reports` · `__retention_trigger_rules` · `__seo_crux_alert_state` ·
`__seo_crux_field_history` · `__seo_entity_health` · `__seo_index_status` ·
`__seo_sitemap_file` · `__seo_snapshot_cf_analytics` · `__seo_snapshot_runtime_logs` ·
`__seo_surface_duplicate_decisions` · `__seo_surface_duplicate_scores` ·
`__seo_surface_fingerprints` · `__ux_captures` · `__ux_debt` · `__ux_design_systems` ·
`__ux_perf_gates` · `mcp_validation_log` · `rag_documents` ·
`supplier_inventory_snapshots` · `supplier_runtime_profile` · `supplier_truth_projection`

Fonctions absentes : `calculate_risk_flags` · `count_sitemap_urls_by_temperature` ·
`detect_satellite_pages` · `get_sitemap_urls_by_temperature` · `get_stabilize_pages` ·
`kg_diagnose` · `link_satellites_to_entities` · `refresh_temperature_scores` ·
`snapshot_index_status` · `sync_entity_health_from_scores`.
Types absents : `claim_priority_enum` · `claim_status_enum` · `quote_status_enum`.
Valeur d'enum absente : `seo_event_type.crux_fetch_run`.

## Ce qui est réellement cassé aujourd'hui

10 des 24 relations introuvables sont **lues par du code applicatif** — 27 sites
d'appel `.from()`. Chacun est un `42P01` latent, invisible au typecheck (le client
Supabase n'est pas typé `Database`) :

| relation absente | appels `.from()` |
|---|---|
| `__seo_index_status` | 6 |
| `__marketing_brief` | 4 |
| `__seo_crux_field_history` | 4 |
| `__seo_entity_health` | 3 |
| `rag_documents` | 3 |
| `__seo_crux_alert_state` | 2 |
| `mcp_validation_log` | 2 |
| `__phase2a_audit_reports` | 1 |
| `__seo_snapshot_cf_analytics` | 1 |
| `__seo_snapshot_runtime_logs` | 1 |

S'y ajoutent les 3 fonctions du sitemap v10 appelées par `callRpc` et les 5 `.from()`
vers des objets archivés, déjà décrits dans
`audit/ledger-tail-owner-decisions-2026-09-04.md`.

## La cause racine

Ce n'est pas « une migration a raté ». C'est que **`--baseline` inscrit une hypothèse
au même rang qu'un fait**, et que rien dans la chaîne ne la confronte ensuite au
catalogue. Le moteur vérifie la fraîcheur ledger ↔ *fichiers* (checksum, drift,
`--status`) ; personne ne vérifie ledger ↔ *base*.

L'exemple le plus net : `20260514_seo_crux_field_history`, baselinée le 2026-05-16,
`execution_ms = 0`. Elle déclare une table partitionnée, une table d'état d'alerte,
4 index, la RLS, 4 politiques et une valeur d'enum. **Aucun de ces objets n'existe.**
Le code, lui, les lit : l'endpoint `GET /api/admin/seo-monitoring/timeseries/crux`
et `CruxAlerterService` (dormant, non planifié).

## Le correctif structurel

**Un gate de cohérence ledger ↔ catalogue**, dans la même famille que les invariants
existants : pour chaque migration `applied`, les objets qu'elle déclare doivent
exister — ou l'écart doit être déclaré explicitement.

**Livré le même jour.** `scripts/audit/check-ledger-catalog-ratchet.py` (ex-
`extract-declared-objects.py`) porte l'extraction, la confrontation au catalogue et
un ratchet symétrique sur `audit/baselines/ledger-catalog-baseline.json`. Il est
branché sur la sonde nocturne existante (`migration-ledger-freshness.yml`) — pas de
nouveau workflow, pas de second détecteur, et le contrat read-only du workflow est
préservé : uniquement des `SELECT` sur les catalogues système.

Ce qu'il ne faut **pas** faire : rejouer les 270 baselines. La plupart des objets
existent ; l'archivage de 14 relations était délibéré ; et certaines familles
absentes (`__ux_*`, `__lighthouse_*`) correspondent à des chantiers jamais activés,
qu'il faut retirer plutôt que ressusciter.

## Ce qui attend un arbitrage

Pour chacune des 24 relations introuvables, une seule question : **ressusciter ou
retirer ?** Les trois familles se distinguent bien :

| famille | relations | lecture recommandée |
|---|---|---|
| chantiers jamais activés | `__ux_*` (4), `__lighthouse_*` (2), `__phase2a_audit_reports`, `__retention_trigger_rules`, `mcp_validation_log` | **retirer** le code lecteur ; les tables n'ont jamais servi |
| supplier-truth | `supplier_inventory_snapshots`, `supplier_truth_projection`, `supplier_runtime_profile` | **retirer** — PR #837 a déjà tranché : le canon est `supplier_offer_snapshot` ; cf. §1 du brief |
| surfaces SEO vivantes | `__seo_index_status`, `__seo_crux_*`, `__seo_entity_health`, `__seo_surface_*`, `__seo_sitemap_file`, `__seo_snapshot_*`, `__marketing_brief`, `rag_documents` | **cas par cas** — zone SEO indexée, accord nominatif requis |

_Aucune action prise. Ce document mesure et instruit ; il ne tranche pas._

---

## Correction du 2026-09-07 (même jour) — les chiffres ci-dessus étaient un premier passage

Ce document a été écrit à partir d'une extraction manuelle. En la mécanisant pour en
faire un garde (`scripts/audit/check-ledger-catalog-ratchet.py`), deux défauts du
parseur sont apparus, tous deux dus au DDL construit dans une chaîne
`EXECUTE format('CREATE TABLE … %I …')` : un nom vide et le faux nom `if` (le moteur
d'expressions rétrograde sur `IF NOT EXISTS` quand `%I` ne peut pas être un
identifiant). La règle d'exclusion des partitions datées était par ailleurs une
constante en dur qui n'attrapait que 3 des 24 partitions concernées.

Mesure mécanisée, reproductible, confrontée au catalogue le même jour :

| nature | déclarées vérifiées | absentes de TOUS les schémas |
|---|---|---|
| relations (tables, vues) | 214 | **46** |
| fonctions | 242 | **50** |
| types | 20 | **8** |
| valeurs d'enum | 21 | **1** |

**105 absences**, dont 5 sont déclarées par `20260520_supplier_truth_v1`, qui est
**pending** — le garde ne reproche rien à une migration jamais appliquée. Restent
**100 absences imputables à des migrations que le ledger dit `applied`**, figées dans
`audit/baselines/ledger-catalog-baseline.json` : 26 tables, 15 vues, 50 fonctions,
8 types, 1 valeur d'enum.

Le sens de l'écart va dans la même direction que le constat initial : le défaut est
**plus large** que ce que ce document annonçait, pas plus étroit. Ce qui tenait déjà
tient toujours — la séparation entre les 14 relations archivées (présentes dans
`_archive`, donc jamais listées ici) et les absences réelles, l'analyse des appels
`.from()` vivants, et la cause racine. Seuls les décomptes changent, et c'est
désormais une machine qui les tient.
