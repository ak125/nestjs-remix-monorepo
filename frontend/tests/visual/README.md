# Régression visuelle (`tests/visual`) — GATE-0 (chantier Tailwind 4)

Gate de **régression visuelle CSS** : fige la structure / l'ordre de cascade CSS du build courant
pour le comparer après une mutation à fort blast-radius (migration **Tailwind 3 → 4**, refonte
**design-tokens**). Ces changements peuvent altérer l'émission/l'ordre des CSS (FOUC, cascade,
défauts ring/border/shadow) **sans** casser `typecheck` / `build` / `size-limit` (qui ne comptent
que les octets). Ce gate capture ce que les autres ne voient pas.

## Topologie à deux niveaux

```
frontend/tests/visual/
├── snapshots/<projet>/<spec>/<capture>.png   # ORACLE COURANT — le SEUL comparé par le gate
├── reference-v3/                             # ARCHIVE IMMUABLE pré-migration (PNG libres, jamais
│   └── desktop/{home,r1-gamme,r2-vehicule}.png#   référencés par un toHaveScreenshot — preuve)
└── test-results/                             # artefacts (diffs, rapport HTML) — gitignoré
```

- **`snapshots/`** est routé par `snapshotPathTemplate` (config) ; `{projectName}` évite la collision
  desktop/mobile. Mis à jour **uniquement** dans une PR déclarée **`visual-change`** : artefact
  before/after + manifest des diffs attendus + **approbation owner**. `--update-snapshots` est
  **interdit** hors de ce flux (sinon une régression passe en re-snapshotant la référence).
- **`reference-v3/`** = état avant toute modif, **immuable**, hors `testMatch` → jamais l'oracle CI.

## Déterminisme (obligatoire)

Les snapshots Playwright sont **sensibles à l'environnement** (rendu de police, anti-aliasing) :
poste DEV = jammy, runner CI = noble → générer/comparer hors d'une même image produit de faux
positifs. On génère **et** compare **toujours** dans l'image Docker pinnée
`mcr.microsoft.com/playwright:v1.61.0-noble` via `scripts/visual/run-visual-docker.sh`.
Playwright est **épinglé `1.61.0` exact** (`@playwright/test`, `playwright`, image) — les trois
DOIVENT matcher.

## Couverture (projets × specs)

| Projet | Viewport | Statut baseline |
|---|---|---|
| `desktop` | 1920×1080 | 3 pages migrées depuis l'ancien `-snapshots/` (v3) ✅ |
| `mobile` | 390×844 (UA mobile + touch) | **à capturer sous v3** |

Pages publiques (`pages.visual.spec.ts`) : `home`, `r1-gamme`, `r2-vehicule` (data-driven masqué).

**Coverage à étendre (capture runtime, voir ci-dessous)** : composants ciblés seuil strict
(input focus, bouton, carte, badge, accordéon, panier, modal), états interactifs (focus clavier,
accordéon/dialog/panier ouverts, erreur form), pages **checkout/paiement** (`checkout.tsx`,
`CheckoutLivraisonSection`, `CheckoutPaiementSection`, CTA désactivé `bg-cta/70`) — surface
conversion-critique que la recolor CTA de DT-1 touche et que `panier` ne couvre pas.

## Commandes

```bash
# Pré-requis : l'app tourne (DEV:3000 ou PLAYWRIGHT_BASE_URL=http://localhost:3200 pour PREPROD).
npm run -w @fafa/frontend test:visual:update   # (re)générer les baselines (Docker) — PR visual-change
npm run -w @fafa/frontend test:visual:docker   # comparer aux baselines (Docker) — le GATE
```

`test:visual` (sans `:docker`) = raccourci local **non déterministe** (itération), pas une preuve.

## Gate CI

`.github/workflows/visual-gate.yml` exécute la comparaison sur le runner self-hosted contre
**PREPROD :3200** dans l'image Docker noble pinnée (modèle `e2e-smoke` : validation post-merge ;
PROD reste protégé par le tag `v*`). Déclencheur actuel : **`workflow_dispatch` (manuel)** — choix
**merge-safe** : tant que des baselines manquent, un auto-déclencheur rougirait `main`. L'auto
post-Deploy (`workflow_run`) est ajouté **à l'activation**, une fois toutes les baselines vertes
(commentaire d'activation dans le workflow).

> **ACTIVATION (GATE-0 en cours)** : le gate n'est VERT qu'une fois **toutes** les baselines
> `snapshots/` capturées **sous l'état Tailwind v3** (build courant) — invariant : une baseline
> capturée après une mutation DT-*/TW-* est **inadmissible** (elle masquerait la régression).
> Aujourd'hui : desktop ✅ ; **mobile + specs composants/interactifs/checkout = à capturer**. Tant
> qu'une baseline manque, le job est ROUGE (baseline absente = échec, jamais skip — "no silent
> fallback"). Étapes de clôture : (1) capturer mobile + nouveaux specs via `test:visual:update`
> contre PREPROD, (2) confirmer un run vert, (3) le gate vit.

## Workflow d'usage (mutation à fort blast-radius)

1. **Sous v3** (baseline) : `test:visual:update` → committer les `*.png` de `snapshots/`.
2. **Après mutation** : `test:visual:docker` → tout vert = pas de régression de cascade/rendu.
   Un diff = inspecter le rapport HTML (`test-results/visual-report/`, uploadé en artefact CI sur
   échec) — images attendu/reçu/diff — pour localiser la régression. Si le diff est **intentionnel**
   (ex. CTA blanc→noir en DT-1), c'est une PR `visual-change` : MAJ `snapshots/` + manifest + owner.
