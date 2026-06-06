# V3 decision-pack dry-run pipeline

Outillage **READ-ONLY + DRY-RUN** pour résoudre les V3 (couple gamme + véhicule) vers la meilleure page
`/pieces/{gamme}/{marque}/{modele}/{type}.html`. **Automatise la procédure (preuve + contrôle), jamais la
décision métier ni la mutation.**

- `vlevel-v3-pipeline.ts` — script (3 sous-commandes).
- `vlevel-v3-web-evidence.json` — seed de preuves web, **alimenté manuellement** (jamais de scraping auto) ;
  override la puissance « diesel par défaut » sur les cas importants (V2 / fort volume).

## Commandes

```bash
npm run vlevel:v3:decision-pack -- --pg-id 82      # génère audit/vlevel-v3-decision-pack-<gamme>-<date>.{md,csv,json}
npm run vlevel:v3:validate-pack -- --file audit/...csv
npm run vlevel:v3:apply-pack    -- --file audit/...csv --dry-run     # before/after + UPDATE/rollback SQL (ZÉRO écriture)
npm run vlevel:v3:apply-pack    -- --file audit/...csv --apply --owner-approved   # ⛔ REFUSÉ par design
```

Env : lit `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (process.env, sinon `backend/.env`). Pas de `DATABASE_URL`
dans ce repo — accès via `@supabase/supabase-js`, uniquement `.select()`.

## Pipeline (7 étapes) — où s'arrête l'automatisation

| # | Étape | Automatisé ? |
|---|---|---|
| 1 | investigation DB (+ web frugal manuel → seed) | partiel |
| 2 | scoring / classification | ✅ `decision-pack` |
| 3 | decision-pack md/csv/json | ✅ |
| 4 | **validation owner** (édite `owner_decision`) | ❌ humain — le script PROPOSE (`_CANDIDATE`) |
| 5 | validate + dry-run | ✅ `validate-pack`, `apply-pack --dry-run` |
| 6 | **apply réel** | ⛔ NON implémenté (stub gated, refuse, n'écrit jamais) |
| 7 | contrôle after | futur |

## Doctrine encodée
- **Diesel par défaut** uniquement si keyword modèle-seul / énergie absente.
- Énergie explicite (`1.5 dci`), **version sportive** (`gti`, `rs`…) ou essence explicite → **V3 distinct**.
- **Essence ≠ diesel = véhicules différents** : l'essence courante reste un V3 distinct, jamais supprimée.
- **Cross-gamme** (keyword d'une autre pièce) → jamais `APPROVE`.

## Classification proposée (le script propose, l'owner tranche)
`APPROVE_CANDIDATE` (diesel-default web ≥78) · `APPROVE_DISTINCT_CANDIDATE` (essence/sport explicite) ·
`REVIEW_OWNER` (médiane DB fallback / conflit / cross-gamme) · `DEFER_REMAP` (sous-modèle, orphan) ·
`DEFER_CATALOG_GAP` (modèle absent du catalogue). L'owner édite `owner_decision` en
`APPROVE | APPROVE_DISTINCT | REVIEW | DEFER | REJECT`.

## Garanties
- Aucun `UPDATE/INSERT/DELETE`, aucun recalcul `v_level`, aucune publication, aucune mutation cachée.
- `--apply --owner-approved` **refuse** : ce build ne peut pas écrire en DB. Le SQL produit en dry-run est
  une **preuve**, pas une exécution.
- `REVIEW` / `DEFER` / `REJECT` sont **exclues** de tout apply.
