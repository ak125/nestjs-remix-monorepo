# R-SEO-09 Phase 2 — AST Canonical Surface Diff

> Canon source : `governance-vault/ledger/rules/rules-seo-pagerole.md` (R-SEO-09).
> Ce doc = pointer + protocole local d'enforcement Phase 2.

## Pourquoi Phase 2

Phase 1 (retiré) hard-blockait **toute** modification de fichier sous
`frontend/app/routes/**/*.tsx` par chemin pur, sans analyse de contenu.
False positive sur 100% des codemods className-only — 5 PRs successifs
(side-tab, pure-black-white, ai-color-palette, bounce-easing, husky-hardening)
ont dû exclure manuellement les ~97 issues de routes du backlog impeccable.

Phase 2 parse l'AST de chaque route file modifié, extrait la **canonical
surface** (la projection des éléments qui peuvent changer une URL canon ou
son discovery sitemap), et compare base vs head. Codemod-safe → PASS.
Canonical change → HARD BLOCK.

## Canonical surface

Voir [`scripts/seo/lib/canonical-surface-extractor.mjs`](../../scripts/seo/lib/canonical-surface-extractor.mjs)
pour la spec authoritative. Résumé :

| Élément | Couverture | Pourquoi |
|---------|------------|----------|
| `filename` | exact (rename = block) | Remix flat-routes : filename = URL pattern |
| `default export name` | identifier | Renames impact Remix routing identity / sitemap entries |
| `export const meta` return | structure + valeurs (incl. canonical URL string) | Title, description, robots, canonical link |
| `export const links` return | structure + valeurs | `rel="canonical"` / `rel="alternate"` |
| `export const handle` return | structure + valeurs | `sitemap.*`, breadcrumb, route id canon |
| `export const loader` return | KEYS uniquement matching `/canonical|canonicalUrl|url|seo|meta/i` | Shape canonical-affecting (valeurs dynamiques exclues) |

**Ignoré** (codemod-safe surface) :
- JSX `className` strings (Tailwind class rewrites — impeccable cascade)
- Internal `<Link to>` JSX attributes (navigation interne, pas URL canon)
- Hook calls (`useState`, `useEffect`, `useLoaderData`, …)
- Import statements
- Local helper / component declarations
- Comments / formatting / whitespace
- Loader return shape **non**-canonical (pagination, items, totals, …)

## Override (escape hatch)

Si une modification touche légitimement la canonical surface (rename
intentionnel, déprécation, refactoring SEO approuvé) :

1. Documenter la décision dans le PR body (avant/après, motivation, owner)
2. Ajouter le label `r-seo-09-override` sur la PR (UI GitHub)
3. Le workflow CI passe `R_SEO_09_OVERRIDE=1` au CLI → bypass + warning log

L'override audit trail reste dans les logs CI et dans l'historique des
labels GitHub. **JAMAIS** contourner via force-merge admin ou suppression
du check — c'est exactement le scénario que R-SEO-09 protège.

## Utilisation locale

```bash
# Mode --pr : exit 1 si block (équivalent CI)
node scripts/seo/check-url-immutability.mjs --pr

# Mode --audit : observation seulement, exit 0 toujours
node scripts/seo/check-url-immutability.mjs --audit

# Avec un base différent
BASE_REF=origin/dev node scripts/seo/check-url-immutability.mjs --pr

# Avec override (test local)
R_SEO_09_OVERRIDE=1 node scripts/seo/check-url-immutability.mjs --pr
```

## Surface adjacente (warn-only)

Phase 2 émet des warnings (sans block) pour les services backend canonical
qui peuvent matérialiser ou casser une URL, sans analyse AST encore :

- `backend/src/modules/seo/**/*canonical*.ts`
- `backend/src/modules/seo/**/*seo-canonical*.ts`
- `backend/src/modules/seo/**/*sitemap*.ts`
- `backend/src/modules/seo/**/*redirect*.ts`

Phase 3 (follow-up non-planifié) étendra l'AST diff à ces services.

## Tests

10 fixtures pairs (5 positives codemod-safe + 5 négatives canonical change)
sous [`scripts/seo/__tests__/fixtures/r-seo-09/`](../../scripts/seo/__tests__/fixtures/r-seo-09/).
Plus 6 tests integration CLI sous
[`r-seo-09-phase2-cli.test.mjs`](../../scripts/seo/__tests__/r-seo-09-phase2-cli.test.mjs).

```bash
node --test scripts/seo/__tests__/r-seo-09-phase2.test.mjs
node --test scripts/seo/__tests__/r-seo-09-phase2-cli.test.mjs
```

## Migration depuis Phase 1

Le script `scripts/seo/check-url-immutability.sh` est supprimé. Le workflow
appelle directement la CLI Node `check-url-immutability.mjs`. Aucun
changement d'API observable côté reviewer — l'override label garde le même
nom (`r-seo-09-override`), les exit codes sont identiques (0 / 1 / 2).
