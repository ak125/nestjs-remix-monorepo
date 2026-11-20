# Ownership des fichiers ajoutés : extrait

`ownership.yaml` n'est pas modifié. Les fichiers ajoutés par cette branche relèvent de
globs qui existent déjà dans `.spec/00-canon/repository-registry/ownership.yaml`, à la
base `origin/main` `3600225ce` :

```yaml
  - glob: backend/supabase/migrations/2026*_pricing_*.sql
    domain: D11
    owner: '@ak125'
    sourceConfidence: high
    risk: high
```

Ce glob couvre :

- `backend/supabase/migrations/20261119_pricing_klaxcar_sortie_vente.sql`
- `backend/supabase/migrations/20261119_pricing_klaxcar_sortie_vente.down.sql`

C'est la même entrée que pour le précédent `20261116_pricing_frozen_masked_dispo_zero*.sql` (#2096).

Pour `docs/audit/klaxcar-sortie-vente-20261118/**`, voir le résultat de la garde
`scripts/registry/check-new-files.js` consigné plus bas.

## Si une entrée dédiée est malgré tout souhaitée

Ce patch n'est pas appliqué : il revient au pilotage, par commit signé.

```diff
+  # Mandat DB KLAXCAR (19/11/2026) : sortie de vente des 8 487 lignes pieces_price
+  # de la marque 2590 (pri_dispo '0' + FROZEN). Couvre .sql + .down.sql.
+  - glob: backend/supabase/migrations/20261119_pricing_klaxcar_sortie_vente*.sql
+    domain: D11
+    owner: '@ak125'
+    sourceConfidence: high
+    risk: high
```
