---
check: rpc-registry-drift
severity: high
confidence: high
expected_false_positive_rate: 0.05
autofixable: false
sources:
  - audit/registry/canonical.json
  - .spec/00-canon/repository-registry/*.yaml
  - pg_proc via supabase MCP
incidents_proven:
  - "#691 (2026-05-22, SWR job-name↔processor contract pinning — dead injection dropped)"
risk_documented:
  - reference_postgrest_stable_function_write_readonly.md
---

# Check : RPC Registry Drift

## Pattern audité

Fonctions RPC déclarées dans la spec L2 (`.spec/00-canon/repository-registry/`
ou `audit/registry/canonical.json` champ `rpc`) qui :

1. **N'existent pas dans `pg_proc`** (déclarées côté spec, absentes côté DB)
2. **Existent dans `pg_proc` mais absentes de la spec** (DB drift sans
   registry mis à jour)
3. **Signature divergente** : nombre/types d'arguments ne matchent pas
   entre spec et `pg_proc.proargtypes`

## Origine

PR #691 a corrigé un contrat job-name↔processor SWR où un processor mort
était injecté faute de validation registry↔runtime. Pattern identique
applicable aux RPC Postgres.

## Méthode

1. Lire la liste RPC déclarée dans `audit/registry/canonical.json` (champ
   `rpc` ou via la projection L1+L2).
2. Lire `pg_proc` via supabase MCP :
   ```sql
   SELECT proname, pronargs, proargtypes::regtype[]
   FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace
   ```
3. Comparer set spec vs set DB, signaler 3 catégories de findings :
   - `spec_only` (déclaré mais absent DB)
   - `db_only` (existe DB mais pas spec)
   - `signature_drift` (présent des deux côtés, signature ≠)

## Sortie attendue (JSON)

```json
{
  "check": "rpc-registry-drift",
  "pass": false,
  "findings": [
    {
      "rpc": "rpc_legacy_helper",
      "category": "db_only",
      "severity": "medium",
      "hint": "Ajouter au registry L2 ou DROP FUNCTION"
    },
    {
      "rpc": "rpc_seo_url_generate",
      "category": "signature_drift",
      "spec_args": ["text", "int4"],
      "db_args": ["text", "int4", "boolean"],
      "severity": "high"
    }
  ],
  "summary": { "spec_count": 197, "db_count": 199, "drift": 2 }
}
```

## Faux positifs connus

- Fonctions internes (préfixe `_`) parfois absentes du registry par
  convention. Mitigation : exclure regex `^_`.
- Extensions Postgres (pg_cron, pg_net) ajoutent des fonctions
  pas dans la spec. Mitigation : filtrer par `pronamespace = 'public'` et
  ignorer schémas d'extensions.

## Limites

- Comparaison nominale, pas sémantique (le corps SQL n'est pas comparé).
- Ne détecte pas les RPC consommés en TypeScript mais absents partout
  (couvert par check séparé `attribution-write-gap` pour la partie write).
