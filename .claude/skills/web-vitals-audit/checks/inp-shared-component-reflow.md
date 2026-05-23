---
check: inp-shared-component-reflow
severity: critical
confidence: high
expected_false_positive_rate: 0.10
autofixable: false
sources:
  - frontend/app/components/header/**
  - frontend/app/components/ui/sheet.tsx (Radix Sheet)
  - frontend/app/routes/**/*.tsx (header import)
incidents_proven:
  - "#692 (2026-05-22, INP 537ms mobile /pieces/ — Sheet menu hamburger force reflow ~1250 nodes)"
  - "#694 (2026-05-22, content-visibility fix complementary to #692)"
---

# Check : INP — Shared Component Forces Document Reflow

## Pattern audité

Composants UI partagés (header, sheet, dialog, drawer) qui, à l'ouverture
sur mobile, **forcent un reflow du document entier** (~1000+ nœuds) à cause
de :

1. Animation `transform` ou `width` qui pousse tout le layout
2. `overflow: hidden` sur body sans `scroll-position` préservée
3. Sheet/Dialog qui injecte des wrappers ancestraux affectant le viewport
4. Hauteur calculée dynamiquement (`vh` non figé) déclenchant relayout

**Impact** : INP > 500 ms sur la première interaction → seuil **CRITICAL**
selon CrUX. Cause directe de l'incident #692 (INP 537 ms mobile `/pieces/`).

## Origine

PR #692 (instrumentation web-vitals attribution) + #694 (fix content-visibility)
ont diagnostiqué l'ouverture du Radix Sheet menu hamburger forçant un reflow
de ~1250 nœuds DOM, scalant CPU à 537 ms sur mobile bas-de-gamme.

## Méthode

1. Lister les composants `Sheet`, `Dialog`, `Drawer`, `Popover` (Radix UI) :
   `grep -r "from '@radix-ui/react-(sheet|dialog|popover)'" frontend/app/`
2. Pour chaque, vérifier la présence :
   - de `<style jsx>` ou `className` contenant `vh-100`, `h-screen`,
     `min-h-screen` sur `body` ou `html` ancestor
   - d'animation `transform: translate*` longue durée (> 200 ms)
   - de wrappers ajoutés au `body` à l'ouverture (`document.body.style.*`)
3. Cross-check : grep usage du composant dans `frontend/app/components/header/**`
   et `frontend/app/root.tsx` (composants partagés globalement = blast radius
   maximal).

## Sortie attendue (JSON)

```json
{
  "check": "inp-shared-component-reflow",
  "pass": false,
  "findings": [
    {
      "component": "frontend/app/components/header/MobileSheet.tsx",
      "issue": "Sheet ancestor sets overflow:hidden on body without preserving scrollTop",
      "blast_radius": "shared (root.tsx)",
      "severity": "critical",
      "fix_hint": "Use Radix Sheet built-in scroll lock + content-visibility:auto on hidden sections"
    }
  ],
  "summary": { "scanned": 8, "at_risk": 1 }
}
```

## Faux positifs connus

- Composants Sheet utilisés uniquement en admin (`/admin/**`) — pas un
  blast radius CWV public. Mitigation : pondérer par route public/admin.
- Animation `transform: translate3d` GPU-accelerated qui n'a pas d'impact
  CPU réel. Mitigation : whitelist explicite si profiling confirme.

## Limites

- Pas de profiling CPU réel (statique uniquement). Recoupe avec
  `__seo_cwv_daily` ou Sentry web-vitals attribution pour confirmer.
- Méthodo Playwright + CDP documentée dans
  `project_inp_pieces_root_cause_20260522.md` pour aller plus loin.
