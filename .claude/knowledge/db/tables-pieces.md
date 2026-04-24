---
scope: Pieces tables
sources:
  - backend/supabase/migrations/**/20260*_pieces_*.sql
last_scan: 2026-04-24
---

# Tables Pieces (catalogue pièces)

## Tables principales

| Table | Rôle | Remarques |
|---|---|---|
| `pieces` | Catalogue pièces maître | PK `id`. Colonnes dédoublées TEXT + `_i` INTEGER (voir Gotchas). |
| `pieces_media_img` | Images produits TEXT (legacy) | ~80K images actives. Recovery post-incident 2026-04-11. |
| `pieces_media_img_i` | Index entier des images | Recréé 2026-04-12 via RPC `get_piece_detail`. Cache Redis actif. |
| `pieces_relation_type` | Relations pièces (cross-refs flux fournisseur) | Pollution flux fournisseur scannée 2026-04-13. |
| `pieces_compatibility` | Compatibilité pièce ↔ véhicule | Jointure avec `types` véhicule via V-Level. |

## Duplication colonnes TEXT + `_i`

**Pattern récurrent** dans les tables issues du flux fournisseur (`pieces`, etc.) :
- Colonne `foo TEXT` (ancienne, données brutes du flux)
- Colonne `foo_i INTEGER` (internal ID, celle à utiliser)

**Règle** : toujours utiliser les IDs internes (`*_i`), jamais les colonnes brutes préfixées par le namespace fournisseur.
Voir MEMORY.md `feedback_internal_ids.md` (règle émergente post-incident pieces_media_img).
Règle ast-grep d'enforcement non activée pour l'instant (voir parts-feed.md).

## Incident 2026-04-11 — pagination bug

- Bug de pagination dans script d'import → 80K images actives supprimées
- Recovery via Supabase backups (MEMORY.md `incident-images-2026-04-11.md`)
- Post-mortem : pagination offset + validation de bornes

## RPC critiques

| RPC | Rôle |
|---|---|
| `get_piece_detail(piece_id_i)` | Détail pièce avec média + compat. Cache Redis 10 min. |
| `match_keyword_text_to_vehicle(p_text)` | Extrait vehicles d'un keyword texte. Remplace regex hardcodé (PR #132). |
| `extract_vehicle_keywords(pg_id)` | Batch variant. Utilise RPC SQL STABLE. |

## Gotchas

- Ne JAMAIS utiliser les colonnes brutes préfixées par le namespace fournisseur en code applicatif
- Cache Redis : invalider après update via `pieces:detail:*` pattern
- `pieces_media_img` vs `pieces_media_img_i` : utiliser `_i` pour lookups, legacy TEXT pour affichage
- PAS de FK sur `types` (design imposé par le flux fournisseur, voir memory `vehicle-ops`)

## Règles associées

- MEMORY.md : `feedback_internal_ids.md`, `incident-images-2026-04-11.md`, `db-pieces-indexes.md`
- MEMORY.md : `tecdoc-integration.md` — pipeline V2, 78K actives, SEO protection 301+noindex
