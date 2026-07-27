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
| Initial load JS (closure d'imports statiques `entry.client` + `root`), gzip | 319 kB | **322 KB** | ~1 % | **Critique** : blocage first paint. Liste **dérivée du graphe réel**, pas écrite à la main — vérifiée par `scripts/ci/verify-size-limit-initial-load.mjs`. |
| Total JS (all chunks), gzip | 884 KB | **1000 KB** | 12 % | Hygiène globale — catch toute injection massive |
| Total CSS, gzip | 49 KB | **60 KB** | 18 % | CSS bloat |
| sentry-vendor chunk, gzip | 159 KB | **180 KB** | 12 % | Vendor le plus lourd (chargé async normalement) |
| react-vendor chunk, gzip | 97 KB | **110 KB** | 12 % | Vendor critique (React + ReactDOM) |
| Route R2 produit-véhicule (`pieces/.../$type.html`) chunk, gzip | 31 KB | **34 KB** | 10 % | Poids chargé à **chaque vue R2** (page produit, commerce) — guard par-page |
| Route R1 gamme (`pieces/$slug`) chunk, gzip | 14 KB | **16 KB** | 14 % | Poids chargé à **chaque vue R1** (routage gamme / SEO) — guard par-page |

Pourquoi des budgets séparés par vendor : régression **locale** (catch précisément quelle dep gonfle, plutôt qu'un total flou).

## Garde-fou : `scripts/ci/verify-size-limit-initial-load.mjs`

`npm run size` lance ce script **avant** size-limit. Il ferme les deux façons dont ce
gate peut être vert en mesurant la mauvaise chose :

1. **Motif vide.** Un glob qui ne matche aucun fichier contribue 0 octet — size-limit
   ne s'en plaint pas, le budget rétrécit en silence. Le script **échoue** sur tout
   motif à 0 match, dans n'importe quelle entrée.
2. **Dérive vis-à-vis du graphe réel.** La liste « Initial load » n'est pas crue sur
   parole : le script recalcule la **closure des imports statiques** depuis
   `entry.client-*` et `root-*` dans `build/client/assets/`, et exige que les globs
   configurés couvrent **exactement** cette closure (il rapporte les manquants et les
   surnuméraires).

Un `import()` dynamique est une requête réseau distincte : il reste volontairement
**hors** du budget initial.

Conséquence pratique : re-chunker (nouveau vendor, split, fusion) fait échouer le gate
en **imprimant la liste de globs corrigée** à recopier — la correction est mécanique.

### Seuil `COVERAGE_REQUIRED_BYTES` (1 KiB)

Un chunk du graphe initial **≥ 1 KiB doit** être couvert (échec sinon) ; en dessous il
est **signalé mais toléré**. Raison mesurée, pas théorique : à commit identique, le
build émet localement un chunk `errors-*.js` de ~30 octets que **le runner CI n'émet
pas**. Épingler ce nom rend le gate instable ; l'ignorer coûte quelques centaines
d'octets au pire. Le défaut que ce gate existe pour empêcher pesait **101 KiB** — 1 KiB
est donc un plancher sûr, et les chunks non couverts restent **imprimés**, jamais
masqués.

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
- **2026-07-27 (recalibration « Initial load », PR fix/size-limit-initial-load-globs)** :
  le budget mesurait un sous-ensemble depuis la migration Vite 8 / Rolldown. Le motif
  `radix-vendor-*.js` ne matchait **plus aucun fichier** (Rolldown replie ce chunk dans
  `app-ui-primitives`), et 8 chunks du graphe initial n'étaient **jamais comptés** :
  `app-shell`, `app-ui-primitives`, `lucide-vendor`, `rolldown-runtime`, `site`,
  `errors`, `ErrorGeneric`, `LazyFooter`. Mesuré : **209,6 KiB comptés contre 311 KiB
  réels — 101 KiB d'angle mort**, sous une limite de 216 KB qui passait donc toujours.
  **Ce n'est pas une régression** : ces octets étaient déjà livrés, seule la mesure était
  fausse. La liste est désormais dérivée du graphe réel et la limite recalée sur la
  mesure (319,14 kB → **322 KB**, même serrage ~1 % que l'ancienne 214,7 → 216).
  Garde-fou ajouté pour que le cas ne puisse pas se reproduire silencieusement.
- **Historique antérieur** : voir [`lighthouse-budget.README.md`](./lighthouse-budget.README.md) — fichier conservé exclusivement pour le job `lighthouse:` PREPROD post-deploy de `ci.yml` (observe-only, mesure timing synthétique sur serveur réel). Ne migre pas vers size-limit : contexte différent (artefact statique vs serveur deployed). Détails dans son README.
