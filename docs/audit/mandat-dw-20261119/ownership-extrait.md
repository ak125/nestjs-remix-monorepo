# Ownership des fichiers ajoutés : extrait

Cette branche ne modifie pas `ownership.yaml`. Ce fichier est réservé au
propriétaire (`.spec/00-canon/**`).

## Fichiers ajoutés et globs existants

Relevé à la base `4c61f7600`.

| fichier ajouté | glob de `.spec/00-canon/repository-registry/ownership.yaml` |
|---|---|
| `backend/src/modules/catalog/services/r2-title-collision.service.ts` | `backend/src/modules/catalog/**` |
| `backend/src/modules/catalog/services/__tests__/r2-title-collision.service.test.ts` | `backend/src/modules/catalog/**` |
| `backend/src/modules/products/services/__tests__/cross-selling-seo-r2-title.test.ts` | `backend/src/modules/products/**` |
| `docs/audit/mandat-dw-20261119/**` | `docs/audit/**` |
| `backend/supabase/migrations/20261119_seo_r2_title_all_gammes.sql` | **aucun** |
| `backend/supabase/migrations/20261119_seo_r2_title_all_gammes.down.sql` | **aucun** |

La garde « Block-new (owner + domain required) » refuse donc les deux fichiers
de migration :

- Les globs SEO existants (`*seo_r2_v2*`, `*seo_control*`, etc.) ne les couvrent pas.
- Les renommer pour qu'un glob existant les couvre contournerait la garde.
- Ils ont été renommés une seule fois, de `…_trial_pg10_pg316` en `…_all_gammes`, pour suivre le périmètre du complément 1. Aucun glob ne couvre l'un ou l'autre nom.

## Patch proposé, non appliqué

Il revient au pilotage, par commit signé. Il suit le précédent
`20261003_r5_redirect_target_require_conseils_article*.sql` (domaine D14,
`@ak125/seo-team`). Il remplace le glob proposé pour l'ancien nom.

```diff
+  # Mandat DW et complément 1 (19/11/2026) : titre R2 sans prix, toutes gammes
+  # (gabarit __seo_gamme_car.sgc_title, 118 lignes). Couvre .sql + .down.sql.
+  - glob: backend/supabase/migrations/20261119_seo_r2_title_all_gammes*.sql
+    domain: D14
+    owner: '@ak125/seo-team'
+    sourceConfidence: high
+    risk: low
```
