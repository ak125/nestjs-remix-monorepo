# Régression visuelle (`tests/visual`)

Gate de **régression visuelle CSS** : fige la structure / l'ordre de cascade CSS du build courant
(Vite 7) pour le comparer après la migration **Vite 8 / Rolldown** (V8-1). Le changement de bundler
peut altérer l'émission et l'ordre des CSS (FOUC, cascade) **sans** casser `typecheck` / `build` /
`size-limit` (qui ne comptent que les octets). Ce gate capture ce que les autres ne voient pas.

## Déterminisme (obligatoire)

Les snapshots Playwright sont **sensibles à l'environnement** (rendu de police, anti-aliasing).
Le poste DEV est **Ubuntu 22.04 (jammy)** alors que le runner CI est **ubuntu-24.04 (noble)** → générer
les baselines sur DEV et les comparer en CI produirait de faux positifs.

→ On génère **et** on compare **toujours** dans l'image Docker Playwright pinnée
`mcr.microsoft.com/playwright:v1.61.0-noble` (noble = CI), via `scripts/visual/run-visual-docker.sh`.

## Commandes

```bash
# Pré-requis : l'app tourne sur http://localhost:3000 (ou PLAYWRIGHT_BASE_URL).
npm run -w @fafa/frontend test:visual:update   # (re)générer les baselines (Docker)
npm run -w @fafa/frontend test:visual:docker   # comparer aux baselines (Docker) — le GATE
```

`test:visual` (sans `:docker`) reste un raccourci local **non déterministe** (itération rapide),
à ne PAS utiliser comme preuve.

## Couverture

| Nom | Route | URL |
|---|---|---|
| `home` | accueil | `/` |
| `r1-gamme` | R1 (gamme) | `/pieces/plaquette-de-frein-402.html` |
| `r2-vehicule` | R2 (pièce × véhicule) | `/pieces/plaquette-de-frein-402/renault-140/megane-iii-140049/1-5-dci-77310.html` |

Régions data-driven (prix, stock, dispo, dates, images) **masquées** dans le spec : on fige la mise
en page, pas le contenu qui évolue avec la base. Tolérance `maxDiffPixelRatio: 0.02`.

## Workflow migration

1. **Sous Vite 7** (baseline) : `test:visual:update` → committer les `*.png` (`-snapshots/`).
2. **Sous Vite 8 / Rolldown** (V8-1) : `test:visual:docker` → tout vert = pas de régression de cascade.
   Un diff = inspecter le rapport HTML Playwright (`test-results/visual-report/`) — images attendu /
   reçu / diff — pour localiser la régression d'émission/ordre CSS Rolldown.

Artefacts du gate (diffs, rapport HTML, traces) écrits sous `test-results/` (déjà gitignoré) : le gate
ne mute jamais de fichier suivi par git.
