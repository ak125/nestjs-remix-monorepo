# Ownership des migrations ajoutées : extrait

`ownership.yaml` n'est pas modifié par cette branche. Le fichier est réservé au
propriétaire (`.spec/00-canon/**`).

La garde « Block-new (owner + domain required) » refuse les deux fichiers de
migration de cette branche. Aucun glob de
`.spec/00-canon/repository-registry/ownership.yaml` ne leur donne de propriétaire
ni de domaine, à la base `4c61f7600` :

- `backend/supabase/migrations/20261119_seo_r2_title_trial_pg10_pg316.sql`
- `backend/supabase/migrations/20261119_seo_r2_title_trial_pg10_pg316.down.sql`

Les globs SEO existants (`*seo_r2_v2*`, `*seo_control*`, etc.) ne les couvrent pas.
Les renommer pour qu'un glob les couvre contournerait la garde ; ils ne sont donc
pas renommés. Les autres fichiers ajoutés (`docs/audit/mandat-dw-20261119/**`, le
test backend) passent la garde.

## Patch proposé, non appliqué

Il revient au pilotage, par commit signé. Il suit le précédent
`20261003_r5_redirect_target_require_conseils_article*.sql` (domaine D14,
`@ak125/seo-team`).

```diff
+  # Mandat DW (19/11/2026) : essai de titre R2 sans prix sur les gammes 10 et 316
+  # (gabarit __seo_gamme_car.sgc_title, 2 lignes). Couvre .sql + .down.sql.
+  - glob: backend/supabase/migrations/20261119_seo_r2_title_trial_pg10_pg316*.sql
+    domain: D14
+    owner: '@ak125/seo-team'
+    sourceConfidence: high
+    risk: low
```
