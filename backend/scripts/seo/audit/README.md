# SEO seo-v9 PR-1 — Audit inventaire (READ-ONLY)

## But

Livrer la matrice de validation `docs/seo/legacy_to_monorepo_gap_matrix.md` qui mappe chaque fichier PHP legacy à son équivalent monorepo (statut + gap + priorité). Condition sine qua non avant tout PR-2 de refactor.

Plan stratégique référence : `/home/deploy/.claude/plans/apres-investigation-seo-on-iterative-spark.md` (v15, approuvé 2026-05-08).

## Lancer le script

### Pré-requis
- Variables d'environnement : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Backend NestJS démarré sur `--base-url` pour les endpoints actuels et `/api/seo-dynamic-v4/*`.

### Commande complète (preprod DEV)

```bash
cd backend
npx tsx scripts/seo/audit-v9-inventaire.ts \
  --base-url=http://46.224.118.55 \
  --output-json=audit/seo-v9-inventaire-$(date +%Y-%m-%d).json \
  --output-md=docs/seo/legacy_to_monorepo_gap_matrix.md
```

### Mode sans Supabase (volets 1-2-3-5 seulement)

Pas encore implémenté — futur flag `--skip-volet-4` à ajouter si besoin. En l'état le volet 4 throw et arrête le script.

## Volets

| # | Volet | Module | Output |
|---|---|---|---|
| 1 | Inventaire services SEO | `audit/inventory-services.ts` | `service_inventory[]` |
| 2 | Diff fingerprint V4 vs actuel (50 URLs) | `audit/diff-v4-vs-current.ts` | `diff_samples[]` |
| 3 | Audit R2 routes Remix | `audit/r2-routes-audit.ts` | `r2_routes_audit` |
| 4 | Sample volume R2 indexable | `audit/r2-volume-sample.ts` | `r2_volume_stats` |
| 5 | Comparaison PHP vs Remix (skip-friendly) | `audit/php-vs-remix-comparison.ts` | `php_vs_remix_comparison` |

## Tests

```bash
cd backend && npx vitest run scripts/seo/audit
```

## Critères de succès PR-1
- ✅ `legacy_to_monorepo_gap_matrix.md` généré avec ≥ 10 lignes baseline + lignes enrichies par volets.
- ✅ Inventaire complet : 0 service SEO non recensé.
- ✅ Tableau quantifié `14 services cibles × {existant, partiel, manquant}`.
- ✅ Décision PR-2 documentée : refactor / compléter / raccorder.
- ✅ Identification 3-5 manques **réels** prioritaires.

## Ce que PR-1 N'EST PAS
- Pas de modification de code applicatif (`backend/src/`, `frontend/app/`).
- Pas de migration DB.
- Pas de refactor des services SEO existants — ça arrive en PR-2 (HOLD).
