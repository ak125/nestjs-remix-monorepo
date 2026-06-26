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
├── reference-v3/{desktop,mobile}/<page>.png  # ARCHIVE IMMUABLE pré-migration (9 pages × 2 vues,
│                                             #   PNG libres hors testMatch — preuve historique v3)
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
| `desktop` | 1920×1080 | 9 pages capturées sous v3, image 1.61.0, **contre PREPROD:3200** ✅ |
| `mobile` | 390×844 (UA mobile + touch) | 9 pages capturées sous v3, image 1.61.0, **contre PREPROD:3200** ✅ |

> **L'env de capture DOIT == l'env de gate.** Constat empirique (1er dispatch, run 28257536920) :
> des baselines capturées sur **DEV:3000** (build Vite **dev**) rougissaient le gate contre
> **PREPROD:3200** (build Docker **prod**) — non par diff CSS mais par **mismatch de HAUTEUR** sur les
> pages dynamiques (`home` −164px, `r1` −726px…, largeur identique au pixel) : le contenu rendu diffère
> entre les deux builds. Les pages **statiques** (`cart-empty`, `forgot-password`, `404`, `login`
> desktop) matchaient au pixel → le mécanisme du gate est sain ; seul l'env de capture était faux.
> **Résolution** : les baselines sont (re)capturées **dans l'env du gate** via le mode
> `capture_baselines` du workflow (`workflow_dispatch` → `--update-snapshots` contre PREPROD:3200,
> même image noble). Toute (re)capture future passe par ce mode (jamais `--update-snapshots` en local
> contre DEV:3000). Vert sous tolérance 0.02 ⇒ baselines valides ⇒ activer `workflow_run`.

Pages publiques (`pages.visual.spec.ts`, data-driven masqué) — choisies pour **filtrer le périmètre
visuel de DT-1** (recolor CTA `bg-cta` blanc→noir, 23 fichiers) : `home`, `r1-gamme`, `r2-vehicule`
(⇒ chrome global Navbar/Footer/BottomNav/Section/root + Hero/Catalogue/Diagnostic/GammeHero/
PiecesHeroPriceCard/VehicleSelector), `cart-empty` (cart.tsx **état vide** — voir gap CartSummaryBlock),
`login`/`register`/`forgot-password` (CTA auth), `diagnostic-auto`, `not-found-404`.
⇒ **18/23** fichiers CTA nettoyés de façon **déterministe** (capture stateless `goto`).

**Gaps bornés DÉCLARÉS (pas de cap silencieux) — 5/23 non nettoyés** :
- **`/checkout`** (`CheckoutLivraisonSection`/`CheckoutPaiementSection`/`checkout.tsx`, 7 CTA) :
  redirige (302) tant que le panier est vide — son loader fait `getOptionalUser` (pas d'auth gate)
  puis `redirect("/cart")` si `items.length === 0`. Une capture exigerait un **cart-drive interactif**
  (ajout panier session/Redis → `/checkout`). DÉLIBÉRÉMENT **hors de l'oracle comparé** : un drive
  interactif (clic carte→modal→ajout, dépendant du stock) rendrait le gate **flaky** — un gate qui
  crie au loup est pire que pas de couverture (« safe », « pas de bricolage »). Couvert en DT-1 par :
  (1) test de contraste **WCAG** bloquant (prouve que le nouveau foreground passe), (2) argument
  d'**uniformité du token** (même mécanisme CSS `bg-cta`/`text-*` que les 18 surfaces nettoyées →
  propre sur 18 ⇒ propre sur les autres), (3) **before/after manuel** capturé au moment de DT-1 depuis
  `main` (qui reste v3 jusqu'au merge DT-1).
- **`CartSummaryBlock.tsx`** : son CTA `bg-cta text-white` ne s'affiche **qu'avec un panier non vide** ;
  `/cart` vide retourne tôt `<EmptyCart>` (cart.tsx:380), donc `cart-empty` ne le nettoie PAS (les
  `bg-cta` du HTML `/cart` vide = chrome global déjà nettoyé par `home`). Même couverture DT-1 que
  `/checkout` (WCAG + uniformité + before/after cart-drive).
- **`DashboardDesignTab.tsx`** : route **admin** (`/admin/...`), aperçu design-tokens — **hors périmètre**
  du gate visuel public (pas une surface SEO/conversion). Couvert par les tests unitaires design-tokens.
- **États interactifs** (focus clavier, accordéon/dialog ouverts, erreur form) et **specs composant
  seuil strict** : DIFFÉRÉS. Le CTA est un gros bouton plein-largeur, déjà visible en capture
  full-page → un spec composant n'est pas requis pour filtrer ce diff. À ajouter si une phase
  ultérieure exige un seuil composant plus serré.

## Commandes

```bash
# Itération locale uniquement (NON déterministe, pas une preuve, pas une baseline de gate).
npm run -w @fafa/frontend test:visual:docker   # comparer aux baselines (Docker) — le GATE, en local
```

> **Baselines de gate = capturées par le workflow, jamais en local.** L'env de capture doit ==
> l'env de gate (PREPROD:3200). On NE génère PAS les baselines de gate avec `test:visual:update`
> contre DEV:3000 (build dev ⇒ contenu de hauteur différente, cf. encadré « env de capture »).
> Capture canonique : `gh workflow run visual-gate.yml -f capture_baselines=true` → télécharger
> l'artefact `visual-baselines-preprod` → committer les PNG dans une PR `visual-change`.

`test:visual` (sans `:docker`) = raccourci local **non déterministe** (itération), pas une preuve.

## Gate CI

`.github/workflows/visual-gate.yml` exécute la comparaison sur le runner self-hosted contre
**PREPROD :3200** dans l'image Docker noble pinnée (modèle `e2e-smoke` : validation post-merge ;
PROD reste protégé par le tag `v*`). Déclencheur actuel : **`workflow_dispatch` (manuel)** — choix
**merge-safe** : merger #1160 ajoute l'infra + les baselines **sans** auto-rougir `main`. L'auto
post-Deploy (`workflow_run`) est activé **séparément**, après un run `workflow_dispatch` vert contre
PREPROD (vérifier que le gate tourne en CI avant de le rendre auto-bloquant — activation par étapes).

> **GATE-0 — baselines closes** : les **18** baselines `snapshots/` (9 pages × desktop+mobile) sont
> capturées **sous l'état Tailwind v3** dans l'image pinnée **1.61.0**, **contre PREPROD:3200** (= l'env
> du gate ; invariant respecté : aucune mutation DT-*/TW-* appliquée — DT-0 prouvé byte-identique
> visuellement). Baseline absente = échec, jamais skip ("no silent fallback"). **Reste à l'activation** :
> (1) un `workflow_dispatch` `compare` vert contre PREPROD:3200, (2) flip `workflow_run` pour rendre le
> gate auto-bloquant post-Deploy.

## Workflow d'usage (mutation à fort blast-radius)

1. **Sous v3** (baseline) : `test:visual:update` → committer les `*.png` de `snapshots/`.
2. **Après mutation** : `test:visual:docker` → tout vert = pas de régression de cascade/rendu.
   Un diff = inspecter le rapport HTML (`test-results/visual-report/`, uploadé en artefact CI sur
   échec) — images attendu/reçu/diff — pour localiser la régression. Si le diff est **intentionnel**
   (ex. CTA blanc→noir en DT-1), c'est une PR `visual-change` : MAJ `snapshots/` + manifest + owner.
