---
check: cwv-ingestion-gap
severity: medium
confidence: high
expected_false_positive_rate: 0.05
autofixable: false
sources:
  - frontend/app/**/*.{ts,tsx} (grep web-vitals library calls)
  - __seo_cwv_daily via supabase MCP (count rows last 7d)
  - audit/registry/canonical.json
risk_documented:
  - feedback_cwv_rum_stack_already_exists.md
---

# Check : CWV Ingestion Gap

## Pattern audité

La stack RUM web-vitals est **présente côté code** (import `web-vitals`,
appels `onINP/onLCP/onCLS`) mais l'ingestion `__seo_cwv_daily` est **vide
ou stale** (aucune nouvelle ligne sur les 7 derniers jours).

**Impact** : sans ingestion CWV, impossible de mesurer l'effet des
optimisations CWV (le présent skill perd sa boucle de mesure).

## Origine

Mémoire [feedback_cwv_rum_stack_already_exists.md](feedback_cwv_rum_stack_already_exists.md)
documente le constat : la stack est wirée (web-vitals → Sentry+GA4),
table `__seo_cwv_daily` existe (cf. `reference_seo_partition_rotation_pattern.md`),
mais le gap d'ingestion vers la table interne reste un risque structurel.

## Méthode

1. Grep `from 'web-vitals'` dans `frontend/app/**/*.{ts,tsx}` — confirmer
   présence de `onINP`, `onLCP`, `onCLS` calls.
2. Query `__seo_cwv_daily` via supabase MCP :
   ```sql
   SELECT
     COUNT(*) FILTER (WHERE date >= CURRENT_DATE - 7) AS rows_last_7d,
     MAX(date) AS last_date
   FROM __seo_cwv_daily
   ```
3. Findings :
   - `web-vitals lib appelée + rows_last_7d = 0` → `ingestion_gap` (severity medium)
   - `web-vitals lib non appelée` → `library_not_wired` (severity high) —
     pas couvert par ce check, signale plutôt qu'une régression silencieuse
   - `rows_last_7d > 0 et last_date >= today - 2` → `pass`

## Sortie attendue (JSON)

```json
{
  "check": "cwv-ingestion-gap",
  "pass": false,
  "findings": [
    {
      "category": "ingestion_gap",
      "library_calls_grep_count": 3,
      "rows_last_7d": 0,
      "last_date": "2026-04-12",
      "severity": "medium",
      "fix_hint": "Vérifier le pipeline backend qui consomme l'event web-vitals (route Remix /api/cwv ou edge function). Mémoire feedback_cwv_rum_stack_already_exists.md"
    }
  ],
  "summary": { "library_wired": true, "ingestion_live": false }
}
```

## Faux positifs connus

- Période de freeze (release lock, week-end) où l'ingestion est volontairement
  stoppée. Mitigation : seuil 7 jours déjà tolérant.
- Migration en cours du pipeline d'ingestion (cas transitoire). Mitigation :
  documenter dans `top-priorities.md` section `ACTIVE_INCIDENTS`.

## Limites

- Ne vérifie pas la **qualité** des rows ingérées (Sentry vs GA4 vs interne
  peuvent diverger). Hors scope V1 — l'objectif ici est juste de détecter
  un pipeline mort.
- Ne propose pas de fix automatique — pointer vers la mémoire est suffisant.
