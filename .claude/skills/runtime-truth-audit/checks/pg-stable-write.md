---
check: pg-stable-write
severity: critical
confidence: high
expected_false_positive_rate: 0.05
autofixable: false
sources:
  - pg_proc via supabase MCP (provolatile, prosrc)
incidents_proven:
  - "#693 (2026-05-22, GSC 5xx, fonction SEO marquée STABLE qui contenait DELETE — fail PostgREST read-only tx)"
risk_documented:
  - reference_postgrest_stable_function_write_readonly.md
---

# Check : Postgres STABLE/IMMUTABLE Functions That Write

## Pattern audité

Fonctions Postgres marquées `STABLE` ou `IMMUTABLE` (volatility ≠ `VOLATILE`)
dont le corps contient une instruction d'écriture : `INSERT`, `UPDATE`,
`DELETE`, `TRUNCATE`, `COPY`, ou `CALL` vers une autre fonction écrivante.

**Impact** : PostgREST exécute les `STABLE/IMMUTABLE` dans une transaction
read-only. L'écriture lève `cannot execute X in a read-only transaction`,
visible côté client comme **5xx silencieux**, alors qu'un test SQL direct
passe (sans la contrainte read-only).

## Origine

PR #693 (2026-05-22) — incident GSC 5xx massif causé par une RPC SEO marquée
`STABLE` qui faisait `DELETE` dans une table de cache. Cas confirmé par
`pg_proc.provolatile = 's'` + body contenant `DELETE FROM`. Mémoire
[reference_postgrest_stable_function_write_readonly.md](reference_postgrest_stable_function_write_readonly.md)
documente le pattern complet.

## Méthode

1. Lister les fonctions non-`VOLATILE` :
   ```sql
   SELECT proname, provolatile, prosrc
   FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace
     AND provolatile IN ('s', 'i')  -- STABLE or IMMUTABLE
   ```
2. Pour chaque, grep `prosrc` (case-insensitive, mot-frontière) :
   ```regex
   \b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|TRUNCATE|COPY \w+ FROM)
   ```
3. Pour les matches, finding `severity: critical` (toujours — risque
   data-loss + 5xx silencieux).

## Sortie attendue (JSON)

```json
{
  "check": "pg-stable-write",
  "pass": false,
  "findings": [
    {
      "function": "rpc_cleanup_old_keywords",
      "volatility": "STABLE",
      "writes": ["DELETE FROM __seo_keywords WHERE ..."],
      "severity": "critical",
      "fix_hint": "ALTER FUNCTION rpc_cleanup_old_keywords VOLATILE;"
    }
  ],
  "summary": { "scanned": 199, "violating": 1 }
}
```

## Faux positifs connus

- Fonctions qui écrivent dans une `TEMP TABLE` (technique acceptable en
  STABLE car local à la session). Mitigation : whitelist explicite
  `CREATE TEMP TABLE` ou commentaire `-- safe-temp-write`.
- String literals contenant `DELETE FROM` dans une chaîne dynamique non
  exécutée. Faible probabilité — le regex peut être affiné si signalé.

## Limites

- Ne détecte pas les écritures via `EXECUTE format(...)` dynamique
  (couverture régex limitée — risque résiduel à documenter).
- Ne détecte pas les fonctions PL/pgSQL appelant une autre fonction
  qui écrit (chaînage). À ajouter dans une V2 si pattern observé en PROD.

## Action recommandée pour les findings

- `ALTER FUNCTION <name> VOLATILE;` (ne pas tenter `STABLE` + tx workaround)
- Si la fonction doit rester `STABLE` (pour le query planner), extraire
  l'écriture vers une fonction `VOLATILE` séparée appelée séparément.
