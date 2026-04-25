# R8 HTML Distinct Render — Spec courte

**Date** : 2026-04-25
**Branche** : `feat/r8-html-distinct-render`
**Objectif** : Réduire le duplicate content cross-motorisations sur les pages R8 (`/constructeurs/:brand/:model/:type.html`) en câblant les données DB existantes + le système de switches legacy + JSON-LD Vehicle, **sans scraping et sans toucher au RAG** (respecte ADR-022 L1).

## Baseline (mesuré 2026-04-25 21:32 UTC)

`r8-diversity-check --modele-id 140004` (Clio III) :
- 3 sibling pages dans `__seo_r8_pages` (la majorité des 30+ motorisations Clio III rendent via fallback DB)
- avg_diversity 68.3 %, verdict REVIEW
- Collisions sur `faq_signature` (pool 7) et `category_signature` (pool 7)

## Diagnostic frontend

`frontend/app/routes/constructeurs.$brand.$model.$type.tsx` (1258 LOC) rend 7 sections :
- HeroSection — variable ✅
- BreadcrumbSection — variable ✅
- SeoIntroSection — vient du RAG enricher (souvent vide)
- **TrustSection — 100 % boilerplate, identique sur 53 959 pages** ❌
- AntiErrorsSection — 85 % boilerplate ❌
- HowtoSection — 80 % boilerplate ❌
- R8EnrichedSection — optionnel, souvent vide

## Données déjà disponibles (vérifiées 2026-04-25)

| Source | Contenu | Lien type_id |
|---|---|---|
| `auto_type` | type_name, type_engine, type_fuel, type_power_ps, type_power_kw, type_liter, type_year_*, type_month_*, type_body | direct |
| `__cross_gamme_car_new` | Gammes applicables au véhicule | `cgc_type_id` |
| `__diag_maintenance_operation` | Ops entretien (label, intervalles km/mois, sévérité) | via `related_pg_id` |
| `__diag_related_parts` | Pièces co-changées + probabilité | via `drp_source_pg_id` |
| `__diag_symptom` | Pannes/symptômes (label, urgence) | via `system_id` |
| `__seo_type_switch` | 134 phrases (5 alias) | rotation hash(type_id) |
| `__seo_item_switch` | 7 964 phrases (3 alias) | rotation hash(type_id) |
| `__seo_gamme_car_switch` | 6 542 phrases (3 alias) | rotation hash(type_id) |
| `__seo_family_gamme_car_switch` | 3 790 phrases (6 alias) | rotation hash(type_id) |

**Total : 18 430 phrases switch + 6 tables data, 0 % câblées sur R8 actuellement.**

## Plan d'implémentation (incrémental, commits atomiques)

1. **Cut TrustSection** de la page R8 (déplacement vers footer global ou layout partagé) — gain immédiat, commit isolé.
2. **TechSpecsSection** (nouvelle) : table specs depuis `auto_type` (kW, cylindrée, body, période mensuelle, code moteur si dispo).
3. **JSON-LD Vehicle Schema.org** dans `<head>` via `meta()` Remix (`@type:Vehicle`, `vehicleEngine`, `vehicleConfiguration`, `manufacturer`, `dateVehicleFirstRegistered`, `vehicleModelDate`).
4. **MaintenanceSection** : top 3-5 ops depuis `__diag_maintenance_operation × cross_gamme_car_new`.
5. **TopPartsSection** : pièces co-changées depuis `__diag_related_parts` triées par `drp_probability`.
6. **SymptomsSection** : top symptômes depuis `__diag_symptom` filtrés par system applicable.
7. **Switches rotation** câblée sur Howto/AntiErrors/SeoIntro avec seed=type_id (pattern `brand-bestsellers.service.ts:235-280`).

## Mesure post-implémentation

- `python3 scripts/qa/r8-diversity-check.py --modele-id 140004` après chaque commit majeur
- Si verdict toujours REVIEW/FAIL après les 7 étapes → **2e PR distincte** pour scraping (couple, vmax, masse, code moteur K9K) via `__rag_proposals` propose-before-write (ADR-022).

## Hors scope explicite

- ❌ Scraping web (reporté à PR séparée si nécessaire après mesure)
- ❌ Modifications RAG `vehicles/*.md` (ADR-022 L1 violée si on touche)
- ❌ Modifications du backend RPC `build_vehicle_page_payload` au-delà de l'ajout de fields lus depuis DB

## Réversibilité

`git revert` du squash-merge annule tout. Aucun write DB/RAG, uniquement frontend + ajout SQL dans le RPC loader (read-only).

## Refs

- ADR-022 R8 RAG Control Plane (vault, accepted 2026-04-25)
- Honest debrief : `governance-vault/ledger/knowledge/r8-vehicle-enrichment-stage1-honest-debrief-20260425.md`
- Pattern legacy switch : `backend/src/modules/vehicles/services/brand-bestsellers.service.ts:235-280`
- Config switches : `backend/src/config/seo-switch-aliases.config.ts`
