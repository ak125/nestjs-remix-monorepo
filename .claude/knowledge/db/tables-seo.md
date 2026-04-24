---
scope: SEO tables
sources:
  - backend/supabase/migrations/**/20260*_seo_*.sql
  - backend/supabase/migrations/**/20260*_kp_*.sql
last_scan: 2026-04-24
---

# Tables SEO & Blog

## Tables principales

| Table | Rôle | Remarques |
|---|---|---|
| `__seo_gamme_conseil` | Contenu sections conseils (S1–S8) par gamme | RLS active. Pollution OEM scannée par `pollution-scanner`. Jamais caster `sgc_id` → timestamptz. `sg_updated_at` = horodatage. |
| `__seo_keyword_plan_r1` à `r8` | Keyword plans par rôle R1–R8 | 1 plan par `pg_id` et par rôle. Format JSONB. |
| `__seo_keyword_results` | Résultats classification Google Ads | Écrit par `/kw-classify`, contient `vol_percentile`. |
| `__seo_keywords` | Keywords bruts Google Ads KP | Import via `import-gads-kp.py`. |
| `__seo_research_brief` | Briefs recherche Stage 1 pipeline v2 | Écrit par `research-agent`. |
| `__seo_page_brief` | Briefs de page enrichis Stage 2 | Écrit par `brief-enricher`. |
| `__seo_r2_keyword_plan` | R2 Product V3 audit-first | 6 phases (P0–P5), 11 quality gates. |
| `__seo_r4_keyword_plan` / `__seo_reference` | R4 Reference V2 + V4 audit-first | Pass A discover, Pass B compile. |
| `__seo_r5_keyword_plan` | R5 Diagnostic | 6 sections, safety gate. |
| `__seo_r6_keyword_plan` / `__seo_gamme_purchase_guide` | R6 Guide d'achat V2 | 7 prompts, compliance score. |
| `__seo_r7_keyword_plan` / `__seo_brand_*` | R7 Brand V3 | Section bundle JSON V3. |
| `__seo_r8_*` (7 tables) | R8 Vehicle V5 | Blocks, diversity scoring, fingerprinting, governance. |
| `__blog_advice`, `__blog_advice_h2`, `__blog_advice_h3` | Legacy blog (CMS hérité) | Source pour `legacy-recycler`. |
| `gamme_aggregates` | 241 gammes agrégées | RLS active. 243 – 2 (merge 3942→817, deprecate 3333). |

## Vues

| Vue | Rôle |
|---|---|
| `__pg_gammes` | 232 gammes G1/G2 publiables, exclut pg_level=0 + G3/G4 orphelines. Corrigée 2026-04-08. 100% avec alias. |

## Gotchas DB SEO

- **pg_level=0 = gamme parent agrégée** → exclure des pages catalogue
- **G3/G4 orphelines** → filtrées par `__pg_gammes`
- **Rate limit KP** : burst max 2 agents parallèles (sinon API 429)
- **R3 S5 threshold** : ≥ 70 pour être publiable
- **pg_id=3942** merged vers 817 (doublon historique) ; pg_id=3333 deprecated
- **pg_id=258** : cas TypeScript regex insuffisant → utiliser RPC `match_keyword_text_to_vehicle` (PR #132)

## Règles associées

- `.claude/rules/backend.md` — SupabaseBaseService, pas de Prisma
- `.claude/rules/agent-exit-contract.md` — anti-overclaim agents SEO
- MEMORY.md : `qa-seo.md`, `kw-pipeline-gads.md`, `kw-pipeline-status.md`, `r4-batch-progress.md`

## Accès

- Via NestJS : `SupabaseBaseService` → `.from('__seo_...')` ou `.rpc('...')`
- Via MCP Supabase (diagnostic + queries read-only)
- PAS de DROP/TRUNCATE sans validation humaine explicite (voir MEMORY)
