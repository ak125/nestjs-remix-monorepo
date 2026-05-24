# Opportunity Lens — usage

Query SQL analytique manuelle pour identifier les pages à fort potentiel d'amélioration AI-readiness × SEO × probe.

## Scope V1

Limité aux URLs présentes dans `workspaces/ai-probe/prompts.yaml` (20 prompts au moment du V1). Pas de scan exhaustif GSC. À faire évoluer si le volume probe augmente.

## Exécution

```bash
# Depuis le runtime DEV avec accès à la DB :
PGPASSWORD="$DB_PASS" psql "$DATABASE_URL" \
  -f scripts/analytics/opportunity-lens.sql \
  --csv \
  > /tmp/opportunity-lens-$(date +%Y%m%d).csv
```

Ou via Supabase MCP `execute_sql` en lecture seule.

## Colonnes de sortie

| Colonne | Sens |
|---|---|
| `target_url` | URL canon (depuis prompts.yaml) |
| `impressions_30d` | Somme impressions GSC sur 30j (device=all) |
| `clicks_30d` | Somme clicks GSC sur 30j |
| `avg_position` | Position moyenne GSC |
| `has_tldr` | `ai_has_extractable_tldr` le plus récent (NULL si jamais mesuré) |
| `has_faq` | `ai_has_faq_schema` le plus récent |
| `has_sources` | `ai_has_visible_sources` le plus récent |
| `opportunity_class` | Classification heuristique (voir ci-dessous) |

## Classes d'opportunité

| Class | Action recommandée |
|---|---|
| `no-gsc-signal` | URL canon mais pas d'impressions GSC — vérifier indexation. |
| `high-impr-low-ai-readiness` | Impressions OK mais pas de TL;DR ni FAQ schema — **priorité fix AI-readiness** (extension PageQualityScore wired in Task 1.4) |
| `mid-pos-improvable` | Position 10-20, AI-readiness incomplète — fix schema + TL;DR pour rank improvement |
| `impressions-but-no-clicks` | CTR 0 — title/desc à revoir (mais ⚠️ `feedback_no_touch_meta_h1_if_optimized` strict — vérifier que pas déjà optimisée) |
| `baseline` | Pas de signal d'opportunité clair |

## Triage humain

Pour chaque ligne `high-impr-low-ai-readiness` ou `mid-pos-improvable` : ouvrir une PR d'amélioration ciblée (FAQ schema, TL;DR extractible, sources visibles). **Ne JAMAIS auto-publier** — respect `feedback_no_auto_page_suppression_ever` + HITL canon.

## Hors-scope

- Pas de scoring composite numérique (cf. spec §4.5 "no scoring, no DB").
- Pas d'ingestion auto dans une DB.
- Pas de notification automatique.
- Pas de jointure avec la probe AI manuelle (cycles CSV restent stand-alone V1).

## Mémoires liées

- `[[project_a_b_c_surfaces_distinction]]`
- `[[feedback_no_touch_meta_h1_if_optimized]]`
- `[[feedback_no_auto_page_suppression_ever]]`
