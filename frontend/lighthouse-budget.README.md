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
[`25175348869`](https://github.com/ak125/nestjs-remix-monorepo/actions/runs/25175348869)
(2026-04-30, après PR #224 qui a fixé le flake `exit 124` masquant
ces mesures depuis des mois) :

| Métrique | Pic mesuré | Budget actuel | Headroom |
|---|---:|---:|---:|
| First Contentful Paint | 10 766 ms | 11 500 ms | +6.8 % |
| Largest Contentful Paint | 11 527 ms | 12 500 ms | +8.4 % |
| Time to Interactive | 11 656 ms | 12 500 ms | +7.2 % |
| Total Blocking Time | n/a | 2 500 ms | défaut prudent |
| Cumulative Layout Shift | n/a | 0.25 | défaut Lighthouse |
| Script size | 1 197 KB | 1 300 KB | +8.6 % |
| Stylesheet size | 354 KB | 400 KB | +13 % |
| Total size | n/a | 2 400 KB | enveloppe |
| Script count | 44 | 50 | +13.6 % |
| Stylesheet count | n/a | 10 | enveloppe |

URLs auditées : `/`, `/pieces/<long-slug>`, `/constructeurs/renault-140.html`.
Le budget `path: "/*"` couvre les trois — calibré sur la **pire** valeur
observée à travers les trois pages.

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

- **2026-04-30** : calibration initiale empirique post-fix exit-124
  (PR #224). Budgets précédents (script 400 KB, stylesheet 150 KB,
  TTI 6 s) étaient aspirationnels et n'avaient jamais réellement
  tourné en CI à cause du flake. Premier baseline mesuré.
