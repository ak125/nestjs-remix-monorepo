# Vague 3 — Audit des 46 vues `SECURITY DEFINER`

> **Date** : 2026-04-22
> **Status** : `SCOPE_SCANNED` (audit only — aucune modification DB ni PR)
> **Source** : Supabase advisor `security_definer_view` (ERROR, EXTERNAL)
> **Project** : `cxpojprgwgubzjyqzmoq`
> **Auteur** : Claude (audit demandé après vagues 1+2a-2e RLS hardening)

---

## Résumé exécutif

46 vues `public.*` (45 vues + 1 matview) sont définies avec `SECURITY DEFINER`,
ce qui signifie qu'elles s'exécutent avec les droits du créateur (souvent
`postgres` superuser) au lieu de ceux du caller. Combiné avec les `GRANT` sur
`anon`/`authenticated` encore actifs sur la quasi-totalité, ces vues
**bypassent les RLS qu'on vient de mettre en place** dans les vagues 1-2e.

### Verdict global recommandé

| Action | Vues | Stratégie |
|---|---|---|
| **CONVERT INVOKER + REVOKE public** | 38 | Convertir en `SECURITY INVOKER`, REVOKE anon/authenticated, garder service_role. Le backend tourne en service_role (BYPASSRLS) donc fonctionne. Sécurité = égale ou meilleure car l'attaquant anon perd l'accès. |
| **KEEP DEFINER** (motif technique) | 7 | Sitemaps, agrégats cross-RLS, ou accès cross-schema vers `tecdoc_map`/`tecdoc_raw`. À réviser cas par cas. |
| **NEEDS REVIEW** | 1 | `v_pieces_seo_safe` lit `pieces` table — usage à investiguer. |

### Risque actuel (avant remediation)

- Un attaquant avec l'`SUPABASE_ANON_KEY` peut interroger ces 46 vues via
  PostgREST. Même si les tables sous-jacentes ont RLS activée (vagues 1-2e),
  les vues `SECURITY DEFINER` font le SELECT au nom du créateur (postgres,
  qui bypass RLS), exposant des données qui ne devraient être accessibles
  qu'au backend.
- **Données les plus exposées** : `__pg_gammes` (catalogue alias), KG diag
  stats, SEO analytics (clicks/impressions agrégées), DB monitoring (table
  health, index usage).

---

## Méthodologie

1. Liste exhaustive des 46 vues parsée depuis l'output advisor cached
   (`/home/deploy/.claude/projects/-opt-automecanik-app/.../mcp-supabase-get_advisors-1776865430984.txt`).
2. Métadonnées DB : `pg_class.reloptions`, taille, `public_grants`.
3. Définitions SQL extraites via `pg_views.definition` (250 chars).
4. Tables sous-jacentes extraites par regex sur `FROM`/`JOIN`.
5. Usage code grep dans `backend/src/**/*.ts` et `frontend/app/**/*.{ts,tsx}`,
   exclu `database.types.ts`.
6. Frontend audit : **0 vue** appelée directement par supabase-js (cohérent
   avec le pattern global du repo).

---

## Catégorie A — CONVERT INVOKER + REVOKE public (38 vues)

**Pattern de remediation** :
```sql
ALTER VIEW public.<view_name> SET (security_invoker = true);
REVOKE ALL ON public.<view_name> FROM anon, authenticated;
GRANT SELECT ON public.<view_name> TO service_role;
```

Ces vues sont **lues uniquement par le backend** (service_role, BYPASSRLS) ou
par des dashboards admin authentifiés via JWT. Aucune n'est appelée par le
frontend en direct.

### A.1 — KG (Knowledge Graph) — 7 vues

| Vue | Tables sous-jacentes | Usage | Recommandation |
|---|---|---|---|
| `kg_active_nodes` | `kg_nodes` | Migration SQL définit la vue | INVOKER + REVOKE |
| `kg_active_edges` | `kg_edges` | idem | INVOKER + REVOKE |
| `kg_diagnosis_stats` | `kg_edges`, `kg_nodes` | Migration | INVOKER + REVOKE |
| `kg_observables_with_context` | `kg_nodes` | Migration | INVOKER + REVOKE |
| `kg_feedback_stats` | `kg_feedback_events`, `kg_nodes` | Migration | INVOKER + REVOKE |
| `kg_maintenance_summary` | `kg_edges`, `kg_nodes` | Migration | INVOKER + REVOKE |
| `kg_truth_labels_dashboard` | `kg_nodes` | Migration | INVOKER + REVOKE |
| `kg_truth_labels_stats` | `kg_truth_labels` | Migration | INVOKER + REVOKE |
| `kg_rag_sync_stats` | `kg_rag_sync_log` | Migration | INVOKER + REVOKE |
| `kg_rag_sync_errors` | `kg_rag_sync_log` | Migration | INVOKER + REVOKE |

### A.2 — SEO analytics & A/B testing — 5 vues

| Vue | Tables | Usage | Recommandation |
|---|---|---|---|
| `seo_link_ctr` | `seo_link_clicks` | 0 backend, admin only | INVOKER + REVOKE |
| `seo_ab_testing_formula_ctr` | `seo_link_clicks` | idem | INVOKER + REVOKE |
| `seo_ab_testing_top_formulas` | `seo_link_clicks`, `seo_link_impressions` | idem | INVOKER + REVOKE |
| `seo_ab_testing_verbs` | `seo_link_clicks` | idem | INVOKER + REVOKE |
| `seo_ab_testing_nouns` | `seo_link_clicks` | idem | INVOKER + REVOKE |

### A.3 — SEO monitoring — 6 vues

| Vue | Tables | Usage | Recommandation |
|---|---|---|---|
| `v_seo_internal_link_stats` | `__seo_internal_link` | Migration | INVOKER + REVOKE |
| `v_seo_crawl_stats_7d` | `__seo_crawl_log` | Migration | INVOKER + REVOKE |
| `v_seo_last_googlebot_crawl` | `__seo_crawl_log` | Migration | INVOKER + REVOKE |
| `v_seo_keywords_unmatched` | `__seo_keywords` | Migration | INVOKER + REVOKE |
| `v_seo_interpolation_alerts_24h` | `__seo_interpolation_alerts` | Migration | INVOKER + REVOKE |
| `v_seo_interpolation_alerts_weekly` | `__seo_interpolation_alerts`, `pieces_gamme` | Migration | INVOKER + REVOKE |

### A.4 — Pipeline & substitution — 5 vues

| Vue | Tables | Usage | Recommandation |
|---|---|---|---|
| `v_pipeline_dashboard` | `pipeline_event_log` | 0 backend, admin only | INVOKER + REVOKE |
| `v_pipeline_batch_summary` | `pipeline_event_log` | 0 backend, admin only | INVOKER + REVOKE |
| `v_pipeline_step_stats` | `pipeline_event_log` | 0 backend, admin only | INVOKER + REVOKE |
| `v_substitution_funnel` | `__substitution_logs` | 1 backend (admin) | INVOKER + REVOKE |
| `v_substitution_daily` | `__substitution_logs` | 1 backend (admin) | INVOKER + REVOKE |

### A.5 — DB monitoring (admin only) — 4 vues

| Vue | Tables | Usage | Recommandation |
|---|---|---|---|
| `v_index_usage` | `pg_stat_user_indexes` | 0 backend, admin SQL only | INVOKER + REVOKE |
| `v_table_health` | `pg_stat_user_tables` | 0 backend, admin SQL only | INVOKER + REVOKE |
| `v_performance_monitoring` | `pg_stat_user_tables` | 0 backend, admin SQL only | INVOKER + REVOKE |
| `v_import_lock_status` | `pipeline_event_log` + RPC | 0 backend, admin only | INVOKER + REVOKE |

### A.6 — Gamme/SEO dashboards — 4 vues

| Vue | Tables | Usage | Recommandation |
|---|---|---|---|
| `v_conseil_pack_coverage` | `__seo_gamme_conseil`, `pieces_gamme` | 1 backend (admin) | INVOKER + REVOKE |
| `v_gamme_content_orphans` | `__seo_gamme*`, `__seo_r1_gamme_slots`, `pieces_gamme` | 0 backend, admin only | INVOKER + REVOKE |
| `v_gamme_readiness` | `__seo_*`, `gamme_aggregates`, `pieces_gamme`, `v_conseil_pack_coverage` | 0 backend, admin only | INVOKER + REVOKE |
| `v_gamme_seo_dashboard` (matview) | n/a (refresh job) | 1 backend (admin refresh) | INVOKER + REVOKE |

### A.7 — Tecdoc tooling (admin) — 3 vues

| Vue | Tables | Usage | Recommandation |
|---|---|---|---|
| `v_tecdoc_dlnr_reconciliation` | `pieces`, `pieces_marque`, `tecdoc_map`, `tecdoc_raw` | 0 backend, admin only | INVOKER + REVOKE — **mais** lit cross-schema (`tecdoc_map.*`, `tecdoc_raw.*`), vérifier que service_role a SELECT sur ces schémas |
| `v_tecdoc_activation_candidates` | `auto_type`, `gamme_aggregates`, `pieces_*` | 0 backend, admin only | INVOKER + REVOKE |
| `v_tecdoc_unlinked_pieces_reason` | `auto_type`, `pieces_*`, `tecdoc_map`, `v_tecdoc_activation_candidates` | 0 backend, admin only | INVOKER + REVOKE |

### A.8 — Thresholds, KW, R5 — 4 vues

| Vue | Tables | Usage | Recommandation |
|---|---|---|---|
| `v_thresholds_by_family` | `gate_thresholds` | 0 backend, admin only | INVOKER + REVOKE |
| `v_thresholds_comparison` | `gate_thresholds` | 0 backend, admin only | INVOKER + REVOKE |
| `v_kw_pipeline_status` | 21+ tables (cross-pipeline status) | 0 backend, admin only | INVOKER + REVOKE — **mais** dépend de `__pg_gammes` (KEEP DEFINER, voir B.1) |
| `v_r5_consolidation_status` | `__seo_gamme_conseil`, `__seo_observable` | 0 backend, admin only | INVOKER + REVOKE |

---

## Catégorie B — KEEP DEFINER (7 vues)

Ces vues ont une raison technique légitime de conserver `SECURITY DEFINER` :
elles agrègent / lisent **au-delà des frontières RLS naturelles** et sont
appelées par des contextes (sitemap generator, lookup public catalog) où la
conversion casserait le service ou le pattern d'usage.

### B.1 — Catalogue cross-RLS — 1 vue

| Vue | Tables | Pourquoi KEEP DEFINER |
|---|---|---|
| `__pg_gammes` | `pieces_gamme`, `gamme_seo_metrics` | **Vue agrégat fondamentale** : utilisée par 3 fichiers backend ET par `v_kw_pipeline_status`. Référencée dans memory `MEMORY.md` ("Vue `__pg_gammes` fixée 2026-04-08 : 232 gammes G1/G2"). Conversion INVOKER nécessite GRANT SELECT explicite à anon/authenticated, ce qui élargit le surface — préférable de garder DEFINER + REVOKE explicit anon/auth grants. |

**Action recommandée** : KEEP DEFINER + REVOKE all from anon/authenticated +
GRANT SELECT to service_role only.

### B.2 — Sitemaps — 2 vues

| Vue | Tables | Pourquoi KEEP DEFINER |
|---|---|---|
| `__sitemap_p_link_index` | `__sitemap_p_link`, `pieces_gamme` | Sitemap generator. Si appelé par cron/route SSR avec service_role → INVOKER OK. Mais si historiquement appelé par anon (PostgREST direct depuis crawler interne ?) → KEEP DEFINER. **À investiguer.** |
| `__sitemap_vehicules` | `__sitemap_marque`, `__sitemap_motorisation` | Idem. 1 fichier backend détecté. |

**Action recommandée** : audit du callsite réel (cron sitemap NestJS ?
endpoint Remix loader ?) avant décision. Si 100% backend service_role →
CONVERT INVOKER. Sinon KEEP DEFINER + REVOKE.

### B.3 — Cross-schema vers tecdoc_map / tecdoc_raw — 1 vue

| Vue | Tables | Pourquoi KEEP DEFINER |
|---|---|---|
| `__tecdoc_losch_log` | `tecdoc_map.losch_log` | Lit le schéma `tecdoc_map` (hors `public`). `service_role` peut ne pas avoir GRANT sur ce schéma. KEEP DEFINER assure que la vue lit avec les droits du créateur (probablement `postgres` ou un role ayant SELECT cross-schema). |

**Action recommandée** : KEEP DEFINER + REVOKE all from anon/authenticated.
Service_role accès via DEFINER. Vérifier les grants `tecdoc_map` schema avant
toute conversion.

### B.4 — Audit-only / forbidden conversion — 3 vues

Pour les 3 vues `v_tecdoc_*` (catégorie A.7), elles dépendent aussi de
schémas externes — la conversion INVOKER nécessite un audit grants
`tecdoc_map.*` / `tecdoc_raw.*` préalable. À traiter dans la même PR que
B.3 ou en séparé.

---

## Catégorie C — NEEDS REVIEW (1 vue)

| Vue | Tables | Question ouverte |
|---|---|---|
| `v_pieces_seo_safe` | `pieces`, `__quarantine_items` | Lit la table `pieces` (massive table catalogue, status RLS à confirmer). Convertir en INVOKER pourrait casser si `pieces` a RLS et que le caller est anon. **À vérifier** : qui lit `v_pieces_seo_safe` (sitemap ? backend SEO ?) et quel role. |

---

## Plan d'exécution proposé (si tu donnes GO)

### Option 1 — Une PR par cluster fonctionnel (recommandé)

1. **PR vague 3a — KG views** (10 vues, A.1) — risque le plus bas
2. **PR vague 3b — SEO analytics + monitoring** (11 vues, A.2 + A.3) — risque bas
3. **PR vague 3c — Pipeline + DB monitoring** (9 vues, A.4 + A.5) — risque bas
4. **PR vague 3d — Gamme dashboards + KW + R5** (8 vues, A.6 + A.8) — risque moyen (dépendances cross-vue)
5. **PR vague 3e — Tecdoc tooling** (3 vues, A.7) — risque moyen (cross-schema)
6. **PR vague 3f — KEEP DEFINER + REVOKE pattern** (`__pg_gammes`, sitemaps, `__tecdoc_losch_log`) — risque ciblé
7. **PR vague 3g — `v_pieces_seo_safe` review + decision**

### Option 2 — Deux PR

1. **PR vague 3-batch1** : 38 vues catégorie A (CONVERT INVOKER) en bloc
2. **PR vague 3-batch2** : 8 vues catégorie B+C (KEEP DEFINER + REVOKE, audit cross-schema)

### Option 3 — Grosse PR unique

Tout en une fois — risqué (38 ALTER + 7 cas spéciaux), pas recommandé pour
review.

### Pattern technique pour CONVERT INVOKER

```sql
-- Per view :
ALTER VIEW public.<view_name> SET (security_invoker = true);
REVOKE ALL ON public.<view_name> FROM anon, authenticated;
-- service_role déjà a tous les droits (BYPASSRLS), pas de GRANT nécessaire
```

### Pattern technique pour KEEP DEFINER + REVOKE

```sql
-- Per view :
REVOKE ALL ON public.<view_name> FROM anon, authenticated;
-- DEFINER reste, mais l'attaquant anon perd l'accès via PostgREST
```

---

## Points d'attention non bloquants

1. **`__pg_gammes` (1 fichier .sql d'origine introuvable côté repo)** :
   définition pas dans `backend/supabase/migrations/`. Probablement créée
   directement via MCP avant la discipline migrations. À documenter.

2. **Tables `tecdoc_map` et `tecdoc_raw`** : schémas séparés non audités
   ici. Une vague 5 séparée pourrait s'occuper de leur RLS / grants.

3. **Matview `v_gamme_seo_dashboard`** : si elle a un job de refresh, ce
   job doit tourner en service_role (qui aura SELECT sur les sources
   sous-jacentes). À vérifier.

4. **Discovery des 102 policies `USING(true)` non flaggées** (cf. PR #109
   commit message) : reste à traiter en vague 4 si demandé.

---

## Coverage manifest

```
scope_requested              : Vague 3 — audit des vues SECURITY DEFINER
scope_actually_scanned       : 46 vues (45 + 1 matview), schema public uniquement
files_read_count             : 0 fichiers code modifiés, 1 fichier rapport créé
db_writes                    : 0 (audit only, aucun ALTER ni REVOKE)
prs_created                  : 0 (audit only, conformément à option A demandée)
excluded_paths               : schémas tecdoc_map/tecdoc_raw (hors scope)
unscanned_zones              : RPC functions SECURITY DEFINER (advisor n'a pas flaggé celles-ci dans cette catégorie ; à auditer séparément si scope élargi)
corrections_proposed         : 38 CONVERT INVOKER + 7 KEEP DEFINER + REVOKE + 1 NEEDS REVIEW
corrections_applied          : 0
remaining_unknowns           :
  - Callsite réel des sitemaps (cron NestJS vs loader Remix vs anon crawler)
  - Grants service_role sur schémas tecdoc_map / tecdoc_raw
  - Caller de v_pieces_seo_safe
  - Refresh job de v_gamme_seo_dashboard (matview)
final_status                 : SCOPE_SCANNED — recommandations prêtes, attente de décision humaine
```
