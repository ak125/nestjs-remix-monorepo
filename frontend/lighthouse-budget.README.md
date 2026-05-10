# `lighthouse-budget.json` — anti-régression baseline

## Rôle

Ce fichier est le budget Lighthouse appliqué par
[`.github/workflows/perf-gates.yml`](../.github/workflows/perf-gates.yml).
**Son seul rôle est de prévenir les régressions de performance**, pas
d'imposer des objectifs aspirationnels.

> "Start with a baseline performance budget. Measure your current
> performance, then set budgets just above those values."
> — [web.dev/performance-budgets-101](https://web.dev/articles/performance-budgets-101)

## Calibration courante

Mesures de référence prises sur CI run
[`25178882039`](https://github.com/ak125/nestjs-remix-monorepo/actions/runs/25178882039)
(2026-04-30, après merge des 3 couches du plan TTI home : PR #227 warm
cache families, PR #229 manualChunks app-level + Remix v3 future flags,
PR #230 DI direct loader sans HTTP loopback) :

| Métrique | Pic mesuré | Budget actuel | Headroom |
|---|---:|---:|---:|
| First Contentful Paint | 9 195 ms (pieces) | 10 200 ms | +11 % |
| Largest Contentful Paint | 10 005 ms (pieces) | 11 100 ms | +11 % |
| Time to Interactive | 10 922 ms (pieces) | 12 100 ms | +11 % |
| Total Blocking Time | 125 ms (home) | 500 ms | enveloppe variance |
| Cumulative Layout Shift | n/a | 0.25 | défaut Lighthouse |
| Script size | 1 117 KB (pieces) | 1 250 KB | +12 % |
| Stylesheet size | 354 KB | 400 KB | +13 % |
| Total size | 1 590 KB (pieces) | 1 800 KB | +13 % |
| Script count | 22 (pieces, constructeurs) | 30 | +36 % |
| Stylesheet count | 3 (constructeurs) | 10 | enveloppe |

URLs auditées : `/`, `/pieces/<long-slug>`, `/constructeurs/renault-140.html`.
Le budget `path: "/*"` couvre les trois — calibré sur la **pire** valeur
observée à travers les trois pages.

### Trajectoire vs baseline pré-plan

Pour mémoire, la baseline pré-plan (CI run
[`25175348869`](https://github.com/ak125/nestjs-remix-monorepo/actions/runs/25175348869),
post-PR #224 exit-124 flake fix mais avant les 3 couches) :

| Métrique | Avant plan | Après plan | Delta home (CI) |
|---|---:|---:|---:|
| FCP home | 10 766 ms | **2 712 ms** | **−75 %** |
| LCP home | 11 527 ms | 3 312 ms | −71 % |
| TTI home | 11 656 ms | 8 776 ms | −25 % |
| Script count peak | 44 | **22** | −50 % |

Le pic se déplace : la **home** est maintenant clean (FCP < 3 s), mais
les pages `/pieces/<slug>` et `/constructeurs/<slug>.html` restent
contraintes par leur propre latence loader (TTFB pieces 3 264 ms,
constructeurs 416 ms). Couches futures (5/6 hors plan TTI home actuel)
devront s'attaquer à ces routes.

## Comment évoluer

1. **Tighten** dès qu'une PR ship une amélioration mesurable
   (ex : nouveau lazy-loading, replacement d'une dep lourde, critical
   CSS extraction). Mettre à jour ce README + le JSON dans le même
   commit pour que la régression soit détectée.

2. **Loosen jamais** sans justification écrite ici. Si une PR fait
   monter une métrique, le bon réflexe est d'optimiser, pas de
   relâcher le budget.

3. **Rebaseliner** annuellement après campagnes de perf majeures.

## Hors-scope du budget

Le travail d'optimisation perf réel (réduction structurelle des
bundles, critical CSS, lazy hydration, audit de dépendances lourdes
comme recharts/tiptap/lucide) est tracké comme projet engineering
séparé. Ce gate sert uniquement à empêcher les régressions pendant
qu'on bosse l'optim.

## Historique

- **2026-04-30 (rev 2)** : recalibration après merge des 3 couches du
  plan TTI home (PR #227 warm cache, PR #229 manualChunks + v3 flags,
  PR #230 DI direct loader). FCP home mesuré : 10 766 → 2 712 ms (−75 %).
  Script count peak : 44 → 22 (−50 %). Budget resserré pour figer les
  gains et détecter toute régression.
- **2026-04-30 (rev 1)** : calibration initiale empirique post-fix
  exit-124 (PR #224). Budgets précédents (script 400 KB, stylesheet
  150 KB, TTI 6 s) étaient aspirationnels et n'avaient jamais
  réellement tourné en CI à cause du flake. Premier baseline mesuré.
