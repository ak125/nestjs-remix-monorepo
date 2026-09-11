# `lighthouse-budget.json` — budgets timing post-deploy

## Rôle actuel (post-cascade size-limit 2026-05-14)

Ce fichier est consommé **uniquement** par le job `lighthouse:` post-deploy de [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), via [lighthouserc.cjs](../scripts/ci/lighthouserc.cjs). Il définit les seuils de timing (FCP/LCP/TTI/TBT/CLS) mesurés par Lighthouse-CI sur le **serveur PREPROD réel** (`localhost:3200` du runner self-hosted), **après deploy sur main**.

L’ancienne mention « non bloquant » contredisait le code de `treosh/lighthouse-ci-action@v12` : les assertions natives de niveau `error` font échouer l’action. Ce comportement et les seuils sont conservés. Le résumé affiche les budgets réellement configurés, et non des cibles différentes codées dans le YAML.

**Ce n'est pas un PR gate.** Le gate PR vit dans [`.github/workflows/perf-gates.yml`](../.github/workflows/perf-gates.yml) qui appelle [size-limit](https://github.com/ai/size-limit) sur [`.size-limit.json`](./.size-limit.json) (budgets structurels gzip déterministes). Voir [`size-limit.README.md`](./size-limit.README.md) pour la philosophie complète.

## Pourquoi ne pas migrer ce job vers size-limit aussi ?

Contexte différent :

| Aspect | PR gate (size-limit) | PREPROD post-deploy (Lighthouse ici) |
|--|--|--|
| Quand | Sur chaque PR | Sur push main (1×/merge) |
| Quoi | Bundle artefact statique | Serveur réel deployed |
| Où | GitHub runner partagé | Runner self-hosted, conteneur PREPROD (port 3200) |
| Mesure | Octets gzip sur disque | TTFB + render + parse + paint sur HTTP réel |
| Bloque | Oui (`exit 1` sur dépassement) | Assertions natives en erreur ou collecte inexploitable |
| Catch | Bundle bloat | CDN / gzip serveur / cold start / SSL / Nest boot |
| Valeur | Anti-régression structurelle | Sanity check post-deploy |

Un size-limit en PREPROD donnerait les mêmes octets que sur PR (artefact identique). Pas de valeur ajoutée. Lighthouse PREPROD mesure des choses qu'un static scan ne peut pas voir.

## Pourquoi seulement les timings (et pas `resourceSizes`/`resourceCounts`) ?

Avant 2026-05-14 ce fichier portait aussi `resourceSizes` (script/stylesheet/total KB) et `resourceCounts` (script/stylesheet). Ces dimensions sont maintenant exprimées en gzip dans `frontend/.size-limit.json` (**source de vérité unique**). Les conserver ici dupliquait sans valeur (artefact identique sur PR et PREPROD).

## Calibration courante des timings

Mesures de référence prises sur CI run [`25178882039`](https://github.com/ak125/nestjs-remix-monorepo/actions/runs/25178882039) (2026-04-30, après merge des 3 couches du plan TTI home — PR #227 warm cache, PR #229 manualChunks + v3 flags, PR #230 DI direct loader) :

| Métrique | Pic mesuré | Budget | Headroom |
|--|--:|--:|--:|
| First Contentful Paint | 9 195 ms (pieces) | 10 200 ms | +11 % |
| Largest Contentful Paint | 10 005 ms (pieces) | 11 100 ms | +11 % |
| Time to Interactive | 10 922 ms (pieces) | 12 100 ms | +11 % |
| Total Blocking Time | 125 ms (home) | 500 ms | enveloppe variance |
| Cumulative Layout Shift | n/a | 0.25 | défaut Lighthouse |

URLs auditées (liste unique `LIGHTHOUSE_URLS` dans `ci.yml`) : `/`, `/search?q=plaquette`, `/pieces/plaquette-de-frein-402.html`. Cette dernière est une page R1 déjà utilisée par le smoke PREPROD. `/pieces/catalogue` est une redirection legacy vers `/`, toujours testée comme telle par le smoke HTTP ; aucune route applicative n’est modifiée. Le budget `path: "/*"` et ses seuils restent inchangés.

## Qualité de la collecte

Le collecteur et le validateur utilisent la même liste d’URL et le même nombre de passages (`LIGHTHOUSE_RUNS=3`). [lighthouse-report-quality.mjs](../scripts/ci/lighthouse-report-quality.mjs) exige les rapports attendus, des dates distinctes, la bonne URL finale, les cinq métriques numériques et les assertions natives correspondantes. Une erreur runtime, un avertissement de collecte, une mesure absente ou une redirection rendent la collecte inexploitable et font échouer ce contrôle. Aucun timeout n’est allongé et aucun avertissement n’est masqué pour obtenir un résultat vert.

`includePassedAssertions=true` conserve aussi les assertions réussies. Sans cette option, un `assertion-results.json` vide peut simplement signifier que tous les budgets ont été respectés : ce n’est pas une preuve de désactivation des budgets. LHCI 0.15.1 remplace ses options lors de la conversion de `budgetsFile` et perd cette option. La configuration transmet donc les seuils du JSON aux assertions natives, au même niveau `error`, sans les recopier ni les recalculer. Un changement du périmètre global `/*` exige une mise à jour explicite de cette configuration. Voir la [documentation LHCI](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md#includepassedassertions).

Les rapports natifs et `collection-quality.json` sont archivés. Un score calculé sur une collecte signalée incomplète ne suffit pas à valider une performance. Le validateur ne recalcule pas les budgets : leur verdict et leur sévérité restent ceux de LHCI.

Tests du validateur et de son mode CLI : `node --test scripts/ci/lighthouse-report-quality.test.mjs`, exécutés dans le contrôle CI Core Build.

### Trajectoire vs baseline pré-plan

Pour mémoire, la baseline pré-plan (CI run [`25175348869`](https://github.com/ak125/nestjs-remix-monorepo/actions/runs/25175348869)) :

| Métrique | Avant plan | Après plan | Delta home |
|--|--:|--:|--:|
| FCP home | 10 766 ms | **2 712 ms** | **−75 %** |
| LCP home | 11 527 ms | 3 312 ms | −71 % |
| TTI home | 11 656 ms | 8 776 ms | −25 % |

## Comment évoluer

1. **Tighten** dès qu'une PR ship une amélioration mesurable post-deploy (lazy-hydration, SSR streaming, critical CSS inline). Mettre à jour ce README + le JSON dans le même commit.
2. **Loosen jamais** sans justification écrite ici. Si une métrique monte, optimiser, pas relâcher.
3. **Rebaseliner** annuellement après campagnes de perf majeures.

**Ne pas réintroduire** `resourceSizes` / `resourceCounts` ici — ces dimensions vivent dans `.size-limit.json` (source de vérité unique post-cascade 2026-05-14, cf. PR #508).

## Hors-scope du budget

Le travail d'optimisation perf réel (réduction structurelle, critical CSS, lazy hydration, audit deps lourdes) est tracké comme projet engineering séparé. Ce lot fiabilise la preuve post-deploy ; il ne corrige pas le chargement de la recherche.

**Vraie surveillance CWV utilisateurs réels** : à venir via ADR CrUX API + cron + alerting (chantier séparé).

## Historique

- **2026-05-14 (rev 3, ce PR)** : retrait des `resourceSizes` / `resourceCounts` (dupliqués avec `.size-limit.json` post PR #506/#508 cascade). Scope clarifié : observe-only, PREPROD post-deploy uniquement. Plus utilisé par `perf-gates.yml` (PR gate) qui consomme `.size-limit.json` via [size-limit](https://github.com/ai/size-limit).
- **2026-04-30 (rev 2)** : recalibration après merge des 3 couches du plan TTI home (PR #227 warm cache, PR #229 manualChunks + v3 flags, PR #230 DI direct loader). FCP home mesuré : 10 766 → 2 712 ms (−75 %). Script count peak : 44 → 22 (−50 %).
- **2026-04-30 (rev 1)** : calibration initiale empirique post-fix exit-124 (PR #224). Budgets précédents étaient aspirationnels et n'avaient jamais réellement tourné en CI à cause du flake. Premier baseline mesuré.
