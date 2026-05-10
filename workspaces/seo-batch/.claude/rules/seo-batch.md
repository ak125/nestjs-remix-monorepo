# Règles SEO Batch

S'applique aux runs depuis `workspaces/seo-batch/`. Complète (sans les remplacer) les règles génériques monorepo (`/opt/automecanik/app/CLAUDE.md`).

## Sources de vérité

- **RAG knowledge** : `/opt/automecanik/rag/knowledge/` (gammes `.md`, vehicles, constructeurs). **Ne jamais seed du contenu métier depuis le LLM** — incident breezy-eagle 2026-04-18, 350 entrées rollback.
- **DB Supabase** via MCP (`mcp__supabase__execute_sql` ou `mcp__claude_ai_Supabase__execute_sql`). Tables : `__seo_*`, `__rag_*`, `__pg_*`, `__diag_*`, `__blog_*`. Pas de DROP/TRUNCATE sans validation humaine.
- **Vault gouvernance** : `/opt/automecanik/governance-vault/ledger/knowledge/` pour les recettes canon (V-Level, KW pipeline, gamme audit).

## Pièges DB connus

- `gamme_aggregates` (241 lignes, RLS active) : **jamais caster `sgc_id` en `timestamptz`**. Utiliser `sg_updated_at` pour les filtres temporels.
- **V-Level v5.0** : T = keywords, V = vehicles. V3 = champion, V4 = rest, V5 = sibling, V2 = top10. Le script canon est `scripts/seo/rebuild-type-vlevel.py` (l'ancien `recalculate_vlevel.py` est archivé).
- **Vehicles** : 53 959 types, dont 30 502 legacy (`< 60000`, intacte) + 23 457 remappés (`60000-83456`, noindex). Ne pas mélanger les ranges.
- **Gammes G1/G2** : 232 gammes éligibles via vue `__pg_gammes` (exclut pg_level=0 + G3/G4 orphelines), 100 % avec alias.

## V-Level / KW pipeline

- Imports KW (`insert-missing-keywords.ts`) : utiliser **les RPC SQL** `match_keyword_text_to_vehicle(p_text)` et `_batch(text[])` (PR monorepo #132, 2026-04-23). **Ne plus** ajouter de regex hardcodées pour les véhicules anciens (2cv, 4l, c15, espace, xantia, saxo, etc.).
- `--suggest-aliases` obligatoire pour les rejets >5 % volume (rule R-SEO-KW-01-05 vault canon).
- Rejets ≥ 50 % d'un volume = check **cross-gamme scope** obligatoire (R-SEO-KW-06).
- `RAG_ONLY_ENRICHED` est un statut **PASS** (pas un BLOCK). Vue `v_kw_pipeline_status` distingue FULLY / RAG_ONLY / NO_CSV (147/232 gammes G1/G2 sont RAG_ONLY, 19 FULLY, 66 NO_CSV — chiffres 2026-04-25).

## Anti-patterns SEO

- **Pas de scrape "parts-feed"** (catalogue fournisseur) sans recipe canon. Termes neutres uniquement dans nouveaux fichiers (jamais "tecdoc" dans contenus créés ici).
- **Pas de commit de contenu seedé** — toute génération R1-R8 doit s'appuyer sur RAG `.md` + KW DB, pas sur l'imagination du LLM.
- **Pas de trigger sitemap** (`POST /api/sitemap/v10/generate-all`) sans validation explicite. Incident 2026-04-18.
- **R7 vs R8** : R7 = hub marque transversal. R8 = page véhicule (modele/motorisation/type_id). Ne **jamais** dériver R8 vers une page gamme.

## Contrat de sortie agents

`./agent-exit-contract.md` — règle non-négociable applicable à tous les agents R*.
