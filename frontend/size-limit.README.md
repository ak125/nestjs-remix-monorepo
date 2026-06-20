# `.size-limit.json` — gate déterministe de régression bundle

## Outil : [size-limit](https://github.com/ai/size-limit) (Andrey Sitnik)

Standard industriel pour le budgétisation de bundles JS/CSS. Adopté par React, Redux, MobX, Prettier, Lodash, etc. Maintenu par l'auteur de PostCSS, Browserslist, Autoprefixer.

## Pourquoi pas un script custom ?

Le monorepo a successivement utilisé :

1. **Lighthouse-CI synthétique** (jusqu'à 2026-05-14) — boot serveur localhost mocké, Chrome headless. Variance 14.5× sur runner partagé, flake rate 13 % empirique (cf. PR #504 / #506).
2. **`scripts/perf/bundle-stats.mjs` custom** (PR #506) — raw bytes, 6 budgets, ~70 lignes maison. Déterministe ✓ mais réinvente la roue.
3. **Inline bash `Bundle size check (gzip)` dans `ci.yml`** (~60 lignes, warn-only `::warning::`) — gzip ✓ mais non-bloquant ET source de vérité dupliquée.
4. **size-limit** (ce PR #507) — **déclaratif, gzip natif, source unique, standard maintenu**.

## Pourquoi size-limit spécifiquement (vs alternatives) ?

| Tool | Gzip | Brotli | Declarative | PR diff (action) | Maintained | Adopté par |
|--|:--:|:--:|:--:|:--:|:--:|--|
| **size-limit** | ✓ | ✓ | JSON / package.json | ✓ via `andresz1/size-limit-action` | ✓ (auteur PostCSS) | React, Redux, MobX, Prettier |
| bundlewatch | ✓ | ✗ | JSON | ✓ | semi-actif | — |
| bundlesize | ✓ | ✗ | JSON | ✓ | **archived** 2019 | — |
| Lighthouse-CI | ✓ | ✗ | JSON | ✓ | ✓ | mais synthétique sur Chrome |
| Custom script | dépend | dépend | dépend | non | — | nous-mêmes seuls |

size-limit gagne sur tous les axes pour notre cas (gate PR sur build statique).

## Métriques gatées (toutes `error`)

| Budget | Mesuré (`9797b488`) | Limite | Headroom | Rôle |
|--|--:|--:|--:|--|
| Initial load JS (5 chunks always loaded), gzip | 183 KB | **210 KB** | 13 % | **Critique** : blocage first paint. React/Radix/root/entry/app-core cumulés. |
| Total JS (all chunks), gzip | 884 KB | **1000 KB** | 12 % | Hygiène globale — catch toute injection massive |
| Total CSS, gzip | 49 KB | **60 KB** | 18 % | CSS bloat |
| sentry-vendor chunk, gzip | 159 KB | **180 KB** | 12 % | Vendor le plus lourd (chargé async normalement) |
| react-vendor chunk, gzip | 97 KB | **110 KB** | 12 % | Vendor critique (React + ReactDOM) |
| Route R2 produit-véhicule (`pieces/.../$type.html`) chunk, gzip | 31 KB | **34 KB** | 10 % | Poids chargé à **chaque vue R2** (page produit, commerce) — guard par-page |
| Route R1 gamme (`pieces/$slug`) chunk, gzip | 14 KB | **16 KB** | 14 % | Poids chargé à **chaque vue R1** (routage gamme / SEO) — guard par-page |

Pourquoi des budgets séparés par vendor : régression **locale** (catch précisément quelle dep gonfle, plutôt qu'un total flou).

## Usage

```bash
# Build + check
npm run build && npm run size

# Depuis le workspace frontend
npm run -w @fafa/frontend size

# Détail / debug
npx size-limit --json   # JSON output
```

## Comment évoluer

### Resserrer un budget

Dès qu'une PR ship une amélioration (lazy-loading, dep replacement, code-splitting amélioré). Mettre à jour `.size-limit.json` ET ce README dans le même commit. Calibration recommandée : **mesure × 1.10** (10 % headroom seulement après optimisation).

### Relâcher un budget

**Jamais sans justification écrite dans ce README**, datée, par owner @ak125. Si une PR fait monter une métrique : optimiser, ou écarter la dep. Relâcher = dette.

### Ajouter une nouvelle métrique

Pour qu'une métrique soit éligible au gate :
- **Déterministe** : mêmes octets en entrée ⇒ mêmes octets en sortie, indépendant du runner
- **Calculable sans booter Chrome ou un serveur** (élimine TBT/LCP/FCP synthétiques)
- **Calibrée** sur ≥ 3 builds successifs, budget = pic mesuré × 1.15 min

### Promouvoir un check `warn` vers `error`

size-limit ne supporte que `error` (exit code) — pas de niveau `warn`. C'est intentionnel : un budget non-bloquant n'est pas un budget. Si une métrique n'est pas mûre pour `error`, elle ne devrait pas être dans `.size-limit.json`.

## Hors-scope explicite

| Hors scope | Pourquoi | Alternative |
|--|--|--|
| Mesurer TBT / LCP / FCP / TTI / CLS en CI | Synthétique sur runner partagé = variance > signal (incident 2026-05-14, ratio 14.5×) | **CrUX field monitoring** (chantier ADR séparé : cron + CrUX API + alerting si p75 dépasse seuils CWV officiels) |
| Time-to-execute (parse + eval JS) en CI | `@size-limit/time` utilise Puppeteer → re-introduit Chrome + variance CPU | CrUX `INP` field |
| Per-route bundle pour **toutes** les routes | Nécessite parser le manifest Vite/Remix | Les **routes-clés** (R2 produit, R1 gamme) sont désormais gatées via glob sur le nom de chunk flat-routes (stable) — no-match = **échec CI** (`exit 1`, pas de silent-pass). `Total JS` couvre l'agrégat |
| Audit one-shot manuel | Pas le rôle d'un gate CI | Lighthouse local / PSI / `webpack-bundle-analyzer` |

## Historique

- **2026-05-14 (création, PR #507)** : adoption size-limit. Élimination du script custom `bundle-stats.mjs` (PR #506) et du bloc inline gzip de `ci.yml`. Source de vérité unique : `frontend/.size-limit.json`. Calibration empirique sur build commit `9797b488` (post PR #506 merge).
- **Historique antérieur** : voir [`lighthouse-budget.README.md`](./lighthouse-budget.README.md) — fichier conservé exclusivement pour le job `lighthouse:` PREPROD post-deploy de `ci.yml` (observe-only, mesure timing synthétique sur serveur réel). Ne migre pas vers size-limit : contexte différent (artefact statique vs serveur deployed). Détails dans son README.
