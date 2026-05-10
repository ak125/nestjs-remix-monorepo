---
integration: parts-feed
pipeline: V2
last_scan: 2026-04-24
---

# Intégration parts-feed (catalogue fournisseur pièces)

## Pipeline V2 (actif)

- **78K types actifs** (véhicules)
- **Remap 23K types legacy** (IDs `60000` à `83456`) avec protection SEO :
  - `noindex` sur les pages remap (évite duplicate content)
  - redirection `301` vers types canoniques
- **Legacy 30 502 types** (IDs `< 60000`) conservée intacte

## Règle IDs internes

**CRITIQUE** : toujours utiliser les IDs internes, jamais les colonnes brutes du flux fournisseur.

- Pattern des colonnes : `foo TEXT` (brut, issu du flux) + `foo_i INTEGER` (ID interne canonique)
- Règle ast-grep d'enforcement non activée pour l'instant (en attente décision sur le pattern à matcher)
- Incident racine : pollution `pieces_media_img` détectée 2026-04-13

## Root cause ingestion (2026-04-13)

- Rapport de fix : [.spec/reports/tecdoc-ingestion-rootcause-2026-04-13.md](../../../.spec/reports/tecdoc-ingestion-rootcause-2026-04-13.md) (nom historique conservé côté reports)
- Symptôme : `pieces_relation_type` pollué par des relations fournisseur non filtrées en amont

## Fichiers applicatifs

- `backend/src/modules/substitution/` — équivalences pièces (cross-refs flux fournisseur)
- `backend/src/modules/vehicles/` — mapping types + V-Level (utilise `type_display`, pas `type_relfollow` — voir commit 729ff632)
- `backend/src/modules/catalog/` — V-Level classification T/V

## Gotchas

- **V-Level v5.0** : T=keywords, V=vehicles. V3=champion, V4=rest, V5=sibling, V2=top10
- **type_display** obligatoire dans le vehicle-rag-generator (pas `type_relfollow` qui pollue)
- `types < 60000` : legacy intacte, pas de noindex
- `types 60000-83456` : remap, `noindex` + `301` obligatoires
- PAS de FK sur la table `types` (design imposé par le flux fournisseur — ne pas forcer)

## Règles associées

- MEMORY.md — entrées historiques sur ce pipeline (nom historique conservé côté memory) et `feedback_internal_ids.md`, `vehicle-ops.md`
- Rapport racine : `.spec/reports/tecdoc-ingestion-rootcause-2026-04-13.md`
- Mapping canon : `.spec/00-canon/db-governance/tecdoc-apply-mapping.md`
