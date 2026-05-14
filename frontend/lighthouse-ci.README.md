# `lighthouse-ci.config.json` — anti-régression structurelle

## Philosophie du gate (post-restructuration 2026-05-14)

Lighthouse-CI sur runner GitHub partagé mesure **deux familles de signaux**, de natures différentes :

| Famille | Exemples | Caractère | Niveau gate |
|--|--|--|--|
| **Structurelle** | `resource-summary:script:size`, `script:count`, `total:size` | Déterministe — un build produit toujours les mêmes octets, peu importe le runner | **`error`** (vrai gate, ne flake jamais) |
| **Temporelle (synthétique)** | `total-blocking-time`, `largest-contentful-paint`, `first-contentful-paint`, `interactive`, `cumulative-layout-shift` | Synthétique — Chrome headless + throttling simulé sur 2 vCPU partagés, variance >10× observée | **`warn`** (visible PR comment + step summary, non-bloquant) |

**Pourquoi cette séparation** (incident 2026-05-14, [PR-recap](https://github.com/ak125/nestjs-remix-monorepo/pull/504)) :

- TBT mesuré 14.5× au-dessus du median sur runner contention (1823 ms vs 160 ms baseline), **sur code identique** (PR ne faisant que des suppressions de dead code)
- Flake rate observé : 13 % sur les 100 dernières runs `perf-gates`
- 6/6 failures récentes tombent sur `total-blocking-time` uniquement, jamais sur LCP/FCP/CLS/TTI/resources
- `runs: 3` + agrégation `median` réduit à ~4.6 % mais ne supprime pas la cause racine

**Cause racine** : un gate PR doit reposer sur des signaux **déterministes vis-à-vis du code review**. Les timings synthétiques échouent ce critère sur infra partagée. La vraie surveillance CWV utilisateur appartient à un autre layer (CrUX field data, monitoring continu PROD), pas à un gate PR.

## Structure du fichier

```jsonc
{
  "ci": {
    "collect": { "numberOfRuns": 3 },         // median-of-3 pour stabiliser les warns affichés
    "assert": {
      "assertions": {
        "resource-summary:script:size": ["error", { "maxNumericValue": 1280000 }],
        "total-blocking-time":          ["warn",  { "maxNumericValue": 500, "aggregationMethod": "median" }]
        // ...
      }
    }
  }
}
```

Unité `maxNumericValue` : **bytes** pour les `resource-summary:*` (vs KB dans l'ancien `lighthouse-budget.json`), **ms** pour les timings, scalaire pour CLS.

## Calibration courante (héritée de l'ancien budget — 2026-04-30)

URLs auditées (cf. workflows `.github/workflows/perf-gates.yml` et `ci.yml`) : `/`, `/pieces/<long-slug>`, `/constructeurs/<slug>.html`. Le budget couvre les trois — calibré sur la **pire** valeur observée à travers les pages.

### Métriques `error` (déterministes)

| Métrique | Pic mesuré | Budget actuel | Headroom |
|--|--:|--:|--:|
| Script size | 1 117 KB (pieces) | 1 280 000 B = 1 250 KB | +12 % |
| Stylesheet size | 354 KB | 409 600 B = 400 KB | +13 % |
| Total size | 1 590 KB (pieces) | 1 843 200 B = 1 800 KB | +13 % |
| Script count | 22 (pieces, constructeurs) | 30 | +36 % |
| Stylesheet count | 3 (constructeurs) | 10 | enveloppe |

Référence : CI run [`25178882039`](https://github.com/ak125/nestjs-remix-monorepo/actions/runs/25178882039) (2026-04-30, post-PR #227+#229+#230 plan TTI home).

### Métriques `warn` (synthétiques, monitoring visuel)

| Métrique | Pic mesuré | Seuil warn | Note |
|--|--:|--:|--|
| FCP | 9 195 ms (pieces) | 10 200 ms | Visible PR comment, ne bloque pas |
| LCP | 10 005 ms (pieces) | 11 100 ms | Idem |
| TTI | 10 922 ms (pieces) | 12 100 ms | Idem |
| TBT | 125 ms (home) | 500 ms | Cible monitoring CrUX PROD à terme |
| CLS | n/a | 0.25 | Idem |

## Comment évoluer

### Resserrer un budget `error`

Dès qu'une PR ship une amélioration structurelle (lazy-loading, replacement d'une dep lourde, critical CSS extraction). Mettre à jour ce README + le JSON dans le même commit pour que la régression future soit détectée.

### Promouvoir un `warn` vers `error`

**Pré-requis non-négociable** : démontrer que la métrique est suffisamment stable sur runner GitHub partagé. Sample minimum : 50 runs `perf-gates` sur PRs touchant le SSR-relevant, calculer la distribution (p50/p95/max). Si `p95 < 0.5 × seuil cible`, alors promotion en `error` envisageable. Sinon, garder en `warn`.

### Loosen un budget

Jamais sans justification écrite ici. Si une PR fait monter une métrique, le bon réflexe est **d'optimiser**, pas de relâcher.

### Rebaseliner

Annuellement après campagnes de perf majeures, ou suite à un fix structurel majeur (ex : rewrite du loader principal, downgrade de stack lourde).

## Hors-scope du gate

| Hors scope | Pourquoi | Où ça vit |
|--|--|--|
| Monitoring CWV utilisateurs réels | Donnée field, pas synthétique. Source ranking SEO Google. | À tracker en chantier ADR séparé (CrUX API + cron + alerting). |
| Audits one-shot de perf | Travail d'optimisation structurelle (bundle splitting, lazy hydration, audit deps lourdes recharts/tiptap/lucide) | Projet engineering séparé, sprint perf dédié. |

Ce gate **prévient les régressions structurelles**. Il ne **mesure pas** la perf utilisateur réelle.

## Historique

- **2026-05-14 (rev 3)** : restructuration `budget.json` → `lighthouse-ci.config.json`. Séparation explicite `error` (resources, déterministe) vs `warn` (timings, synthétique noisy). Migration `budgetPath` → `configPath`. Élimine la flake structurelle observée sur runner partagé (13 %). PR ouverte suite à incident PR #497 (rerun re-fail), après PR #504 (`runs: 3`) qui réduit la flake mais ne traite pas la cause racine.
- **2026-04-30 (rev 2)** : recalibration après merge des 3 couches du plan TTI home (PR #227 warm cache, PR #229 manualChunks + v3 flags, PR #230 DI direct loader). FCP home mesuré : 10 766 → 2 712 ms (−75 %). Script count peak : 44 → 22 (−50 %).
- **2026-04-30 (rev 1)** : calibration initiale empirique post-fix exit-124 (PR #224). Budgets précédents étaient aspirationnels et n'avaient jamais réellement tourné en CI à cause du flake. Premier baseline mesuré.
