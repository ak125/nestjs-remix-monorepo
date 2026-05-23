---
check: attribution-write-gap
severity: high
confidence: medium
expected_false_positive_rate: 0.15
autofixable: false
sources:
  - audit/registry/canonical.json (db_tables, files)
  - backend/src/**/*.ts (grep AST ciblé)
  - pg_stat_user_tables.n_tup_ins / n_tup_upd via supabase MCP
incidents_proven:
  - "#695 (2026-05-22, F1 orl_website_url attribution orpheline + F5 prix custom non audité)"
---

# Check : Attribution Columns Without Runtime Writer

## Pattern audité

Colonnes de tables identifiées comme **attribution / tracking** (par
convention de nommage ou marqueur) qui ne reçoivent **aucun INSERT / UPDATE**
côté code runtime malgré une déclaration explicite côté schéma.

**Conventions d'attribution** : colonnes nommées `*_url`, `*_referrer`,
`*_attribution_*`, `*_source`, `*_campaign`, `*_utm_*`, ou marquées dans
le registry L2 avec tag `attribution`.

**Impact** : la donnée business arrive en BI/analytics comme `NULL` partout
alors que la spec promet une attribution complète — cas #695 où
`orl_website_url` était orpheline en runtime.

## Origine

PR #695 (2026-05-22) audit runtime-truth a révélé :
- F1 : `orl_website_url` (table `___order_lines`) écrite par 0 service
- F5 : prix `custom_price` reçu mais jamais audité

Pattern : la colonne existe en DDL, le registry la connaît, mais aucun
service NestJS ne l'écrit. Détection manuelle après l'incident.

## Méthode

1. Lister les colonnes candidates dans `audit/registry/canonical.json` (ou
   directement `information_schema.columns`) matchant les conventions de
   nommage attribution.
2. Pour chaque colonne `(table, col)` :
   a. Grep AST `backend/src/**/*.ts` pour `\.insert\(.*['"]col['"]` ou
      `\.update\(.*['"]col['"]` ou pattern Supabase équivalent.
   b. Compter les occurrences. Si 0 → finding `no_runtime_writer`.
   c. Vérifier `pg_stat_user_tables.n_tup_ins` pour confirmer absence
      d'écriture en runtime (corroboration DB-live, anti faux positif
      "grep manqué").
3. Cross-checker : si la colonne reçoit du trafic (n_tup_ins > 0) mais
   aucun service grepé → finding `unknown_writer` (severity medium,
   probablement extension ou trigger DB à documenter).

## Sortie attendue (JSON)

```json
{
  "check": "attribution-write-gap",
  "pass": false,
  "findings": [
    {
      "table": "___order_lines",
      "column": "orl_website_url",
      "category": "no_runtime_writer",
      "grep_count": 0,
      "n_tup_ins": 0,
      "severity": "high",
      "fix_hint": "Soit câbler l'écriture dans cart.service.ts (selon ADR-073), soit DROP COLUMN si la donnée n'est plus collectée"
    }
  ],
  "summary": { "candidates": 23, "no_writer": 1, "unknown_writer": 0 }
}
```

## Faux positifs connus

- Colonnes écrites uniquement par migration backfill (one-shot). Mitigation :
  vérifier la date de dernier `n_tup_ins` — si > 30 jours et 0 service runtime,
  c'est probablement legacy à drop.
- Colonnes écrites par trigger DB (jamais grepables côté TS). Mitigation :
  category `unknown_writer` + reviewer-decide.

## Limites

- Le pattern de naming attribution est heuristique. Ne couvre pas les
  conventions custom (préférer registry L2 tag `attribution` explicite si
  ajouté plus tard).
- Grep AST simplifié — ne détecte pas les écritures dynamiques via
  `Object.keys(payload).reduce(...)` génériques. Risque résiduel.
