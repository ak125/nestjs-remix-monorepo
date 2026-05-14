# `bundle-stats.config.json` — gate déterministe de régression structurelle

## Pourquoi pas Lighthouse-CI dans le gate PR ?

Lighthouse-CI sur runner GitHub partagé mesure les CWV via Chrome headless avec throttling simulé, sur un serveur localhost démarré avec des mocks (Supabase, RAG, payments). Trois problèmes structurels :

1. **Variance non-bornée sur TBT/LCP/FCP** : spike 14.5× observé sur code identique (1823 ms vs 160 ms median, run `25854679064`). Flake rate empirique 13 % sur les 100 dernières runs `perf-gates` (incident 2026-05-14).
2. **Mesure non-représentative** : Chrome headless + mocks Supabase + localhost ≠ navigateur utilisateur + Supabase live + CDN + latence réseau. Le signal CI ne corrèle pas avec la perf utilisateur réelle.
3. **Coût élevé** : ~9 min par PR (build + boot serveur 60-180 s + 3 runs Lighthouse). Maintenance des mocks (`SUPABASE_URL`, `READ_ONLY=true`, `RAG_SERVICE_URL`, `SYSTEMPAY_*`, `PAYBOX_*`) qui n'a pas de valeur intrinsèque.

## Quel est le bon outil pour quoi ?

| Besoin | Bon outil | Où ça vit |
|--|--|--|
| Prévenir régression structurelle bundle (taille, count) | **`scripts/perf/bundle-stats.mjs`** (ce fichier) — fichiers sur disque, déterministe | `.github/workflows/perf-gates.yml` (gate PR `error`) |
| Détecter régression CWV utilisateurs réels | **CrUX API** — données field 28 jours, ce que Google Search utilise pour le ranking | Chantier ADR séparé (cron + alerting) |
| Audit perf one-shot manuel | **Lighthouse local** ou **PageSpeed Insights** | À la demande développeur |
| Visibilité post-deploy synthétique | **Lighthouse PREPROD** (job `ci.yml` `lighthouse:`) | Post-deploy, non-bloquant |

## Métriques gatées (toutes `error`)

Toutes calculables directement sur `frontend/build/client/assets/*.{js,css}` après `npm run -w frontend build`. Pas de Chrome, pas de mocks, pas de serveur. Déterministe par construction.

| Métrique | Mesure | Budget (KB ou count) | Headroom actuel | Pourquoi |
|--|--|--:|--:|--|
| `totalJsSizeKB` | Somme de tous les `.js` du build client | 3500 | 14 % | Catch tout ajout massif (`react-pdf`, `chart.js`, etc.) |
| `totalCssSizeKB` | Somme de tous les `.css` | 410 | 14 % | Catch CSS bloat |
| `totalJsFiles` | Nombre de chunks JS | 220 | 16 % | Catch fragmentation extrême ou perte de code-splitting |
| `totalCssFiles` | Nombre de stylesheets | 10 | 70 % | Catch CSS-Modules abuse |
| `maxChunkSizeKB` | Plus gros chunk individuel | 600 | 22 % | Catch perte de code-splitting (un seul chunk géant) |
| `appCoreSizeKB` | Taille du chunk `app-core-*.js` (chargé sur toutes les pages) | 200 | 19 % | Critique : régression ici impacte 100 % des routes |

### Calibration courante (2026-05-14, post incident perf-gates flake)

Mesures sur build local commit `9797b488` :

| Métrique | Mesuré | Budget | Use % |
|--|--:|--:|--:|
| totalJsSizeKB | 2995 | 3500 | 86 % |
| totalCssSizeKB | 351 | 410 | 86 % |
| totalJsFiles | 185 | 220 | 84 % |
| totalCssFiles | 3 | 10 | 30 % |
| maxChunkSizeKB | 470 (`sentry-vendor`) | 600 | 78 % |
| appCoreSizeKB | 161 (`app-core-9vYbiOFv.js`) | 200 | 81 % |

## Comment évoluer

### Resserrer un budget (`error` plus strict)

Dès qu'une PR ship une amélioration structurelle (lazy-loading, replacement d'une dep lourde, critical CSS extraction, code-splitting amélioré). Mettre à jour ce README + le JSON dans le même commit pour que toute régression future soit détectée.

### Relâcher un budget

**Jamais sans justification écrite ici**, datée et signée par owner @ak125. Si une PR fait monter un budget, le bon réflexe est **d'optimiser**, pas de relâcher.

### Ajouter une nouvelle métrique

Toute nouvelle métrique gatée doit être :
- **Déterministe** (mêmes octets en entrée ⇒ mêmes octets en sortie, indépendant du runner)
- **Calculable** sans booter un navigateur ou un serveur
- **Calibrée** sur au moins 3 builds successifs, budget ≥ pic mesuré + 15 % headroom

## Hors-scope explicite

| Hors scope | Pourquoi | Alternative |
|--|--|--|
| Mesurer TBT / LCP / FCP / TTI / CLS en CI | Synthétique sur runner partagé = bruit > signal | CrUX field (chantier ADR séparé) |
| Per-route bundle size (chunks chargés par route X) | Nécessite parser Vite/Remix manifest — complexité ≠ valeur ajoutée vs maxChunk+appCore | Si vrai besoin un jour : étendre `bundle-stats.mjs` |
| Audits one-shot manuels | Pas le rôle d'un gate CI | Lighthouse local / PSI |

## Historique

- **2026-05-14 (création)** : remplacement complet du gate Lighthouse-CI synthétique par bundle-stats déterministe, suite à incident flake 13 % sur `perf-gates` (PR #497 rerun re-fail, mesures empiriques TBT 14.5× variance sur code identique). PR #504 (`runs: 3` mitigation) gardée mergée comme transition mais surpassée par cette restructuration. Lighthouse PREPROD `ci.yml:1097+` conservé comme visibilité post-deploy non-bloquante.
