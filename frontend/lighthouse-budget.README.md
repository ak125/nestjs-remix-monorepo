# `lighthouse-budget.json` — budgets timing post-deploy (observe-only)

## Rôle actuel (post-cascade size-limit 2026-05-14)

Ce fichier est consommé **uniquement** par le job `lighthouse:` post-deploy de [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (ligne ~969). Il définit les seuils de timing (FCP/LCP/TTI/TBT/CLS) mesurés par Lighthouse-CI sur le **serveur PREPROD réel** (`localhost:3200` du runner self-hosted), **après deploy sur main**, en mode **observe-only / non-bloquant**.

> *"Non-blocking: violations signalees mais ne bloquent pas le pipeline."* — extrait du step summary du job.

**Ce n'est pas un PR gate.** Le gate PR vit dans [`.github/workflows/perf-gates.yml`](../.github/workflows/perf-gates.yml) qui appelle [size-limit](https://github.com/ai/size-limit) sur [`.size-limit.json`](./.size-limit.json) (budgets structurels gzip déterministes). Voir [`size-limit.README.md`](./size-limit.README.md) pour la philosophie complète.

## Pourquoi ne pas migrer ce job vers size-limit aussi ?

Contexte différent :

| Aspect | PR gate (size-limit) | PREPROD post-deploy (Lighthouse ici) |
|--|--|--|
| Quand | Sur chaque PR | Sur push main (1×/merge) |
| Quoi | Bundle artefact statique | Serveur réel deployed |
| Où | GitHub runner partagé | Self-hosted DEV VPS (port 3200) |
| Mesure | Octets gzip sur disque | TTFB + render + parse + paint sur HTTP réel |
| Bloque | Oui (`exit 1` sur dépassement) | Non (`> Non-blocking`) |
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

URLs auditées (cf. `ci.yml` job `lighthouse:`) : `/`, `/search?q=plaquette`, `/pieces/catalogue`. Le budget `path: "/*"` couvre les trois — calibré sur la **pire** valeur observée.

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

Le travail d'optimisation perf réel (réduction structurelle, critical CSS, lazy hydration, audit deps lourdes) est tracké comme projet engineering séparé. Ce check sert uniquement à surfacer des régressions de timing post-deploy en mode observe.

**Vraie surveillance CWV utilisateurs réels** : à venir via ADR CrUX API + cron + alerting (chantier séparé).

## Historique

- **2026-05-14 (rev 3, ce PR)** : retrait des `resourceSizes` / `resourceCounts` (dupliqués avec `.size-limit.json` post PR #506/#508 cascade). Scope clarifié : observe-only, PREPROD post-deploy uniquement. Plus utilisé par `perf-gates.yml` (PR gate) qui consomme `.size-limit.json` via [size-limit](https://github.com/ai/size-limit).
- **2026-04-30 (rev 2)** : recalibration après merge des 3 couches du plan TTI home (PR #227 warm cache, PR #229 manualChunks + v3 flags, PR #230 DI direct loader). FCP home mesuré : 10 766 → 2 712 ms (−75 %). Script count peak : 44 → 22 (−50 %).
- **2026-04-30 (rev 1)** : calibration initiale empirique post-fix exit-124 (PR #224). Budgets précédents étaient aspirationnels et n'avaient jamais réellement tourné en CI à cause du flake. Premier baseline mesuré.
