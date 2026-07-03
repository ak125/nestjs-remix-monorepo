---
check: cwv-beacon-ingestion-gap
severity: high
confidence: high
expected_false_positive_rate: 0.05
autofixable: false
sources:
  - frontend/app/**/*.{ts,tsx} (grep web-vitals library calls)
  - __seo_cwv_raw via supabase MCP (count human rows last 24h)
  - audit/registry/canonical.json
risk_documented:
  - feedback_cwv_rum_stack_already_exists.md
---

# Check : CWV Beacon Ingestion Gap (RUM raw)

## Pattern audité

La stack RUM web-vitals est **présente côté code** (import `web-vitals`,
`onINP/onLCP/onCLS` + POST beacon) mais **aucun beacon humain n'arrive** dans
`__seo_cwv_raw` (bloc 3, landing beacons, TTL ~48 h) sur les dernières 24 h.

C'est le **premier maillon** de la chaîne RUM : `__seo_cwv_raw` → `__seo_cwv_hourly`
→ `__seo_cwv_daily_rum`. Si le raw est vide, rien ne peut être agrégé en aval.

> **NE PAS confondre** avec `cwv-aggregation-coverage-gap` (raw **présent** mais non
> agrégé) ni avec `__seo_cwv_daily` (table **lab PageSpeed**, échantillon top-1k —
> distincte de la chaîne RUM `__seo_cwv_daily_rum`).

## Méthode

1. Grep `from 'web-vitals'` dans `frontend/app/**/*.{ts,tsx}` — confirmer `onINP`,
   `onLCP`, `onCLS` + l'appel beacon (`/api/seo/cwv/beacon`).
2. Query `__seo_cwv_raw` via supabase MCP (humains uniquement — les bots vont dans
   `__seo_event_log`, jamais ici) :
   ```sql
   SELECT count(*) FILTER (WHERE received_at >= now() - interval '24 hours'
                             AND ua_class = 'human') AS human_rows_24h,
          max(received_at) AS last_beacon
   FROM __seo_cwv_raw;
   ```
3. Findings :
   - `web-vitals wired + human_rows_24h = 0` → `beacon_ingestion_gap` (severity high) :
     le beacon n'atteint plus la table (route `/api/seo/cwv/beacon` KO, BotGuard trop
     large, CDN qui drop, ou collecte volontairement coupée).
   - `web-vitals non wired` → hors scope ici (signale `library_not_wired`, severity high,
     mais c'est un autre check).
   - `human_rows_24h > 0` → `pass`.

## Sortie attendue (JSON)

```json
{
  "check": "cwv-beacon-ingestion-gap",
  "pass": false,
  "findings": [
    {
      "category": "beacon_ingestion_gap",
      "library_calls_grep_count": 3,
      "human_rows_24h": 0,
      "last_beacon": "2026-06-20T09:00:00Z",
      "severity": "high",
      "fix_hint": "Vérifier la route POST /api/seo/cwv/beacon (CwvBeaconController) + que BotGuard/CDN ne droppe pas les beacons humains. Mémoire feedback_cwv_rum_stack_already_exists.md"
    }
  ],
  "summary": { "library_wired": true, "raw_ingestion_live": false }
}
```

## Faux positifs connus

- Période de freeze / très faible trafic nocturne. Mitigation : fenêtre 24 h tolérante ;
  pondérer par le trafic GA4 si disponible.
- Migration de la route beacon en cours. Mitigation : documenter dans
  `top-priorities.md` § `ACTIVE_INCIDENTS`.

## Limites

- Ne vérifie pas la **qualité** des beacons (attribution complète, device split). Hors
  scope V1 — détecter un pipeline d'entrée mort suffit.
- Ne propose pas de fix automatique.
