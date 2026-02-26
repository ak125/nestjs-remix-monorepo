# Disque de frein - ordre d'execution recommandé

Objectif: éviter les scripts hybrides et garder une séparation stricte.

1. Schema / provenance columns
- `20260213_add_purchase_guide_source_provenance.sql`
- `20260214_add_purchase_guide_source_verification.sql`

2. Provenance source only
- `20260213_set_disque_frein_source_provenance.sql`

3. Verification pipeline only
- `20260214_verify_disque_frein_source.sql`

4. Content only
- `20260213_update_disque_frein_content.sql`

5. Preview content (sans persistance)
- `../dry-run/20260213_disque_frein_content_dry_run.sql`

Validation SQL:

```sql
SELECT
  sgpg_pg_id,
  sgpg_source_type,
  sgpg_source_uri,
  sgpg_source_verified,
  sgpg_source_verified_by
FROM __seo_gamme_purchase_guide
WHERE sgpg_pg_id = '82';
```
