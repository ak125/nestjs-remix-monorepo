---
check: inp-eager-radix
severity: high
confidence: medium
expected_false_positive_rate: 0.20
autofixable: false
sources:
  - frontend/app/routes/**/*.tsx
  - frontend/app/components/**
risk_documented:
  - project_inp_pieces_root_cause_20260522.md
---

# Check : INP — Eager-Loaded Radix Components

## Pattern audité

React Router routes qui importent **statiquement** plusieurs composants Radix
lourds (`@radix-ui/react-*`) au top-level, hydratant tout au mount initial
même si le composant n'est jamais ouvert par l'utilisateur dans cette
session.

**Composants Radix considérés "lourds"** : Sheet, Dialog, Popover,
Tooltip, DropdownMenu, NavigationMenu, Combobox, Select (avec virtual list).

**Impact** : hydration CPU + main-thread blocked à l'init → INP dégradé
sur la première interaction même hors-Radix (le main thread est saturé).

## Origine

Pattern dérivé de l'audit #692 (INP 537 ms) — l'ouverture du Sheet n'était
que le déclencheur, mais l'hydration eager de plusieurs Radix dans le header
contribuait au baseline cost. Préventif tant que pas mesuré individuellement.

## Méthode

1. Pour chaque React Router route (`frontend/app/routes/**/*.tsx`) :
   - Compter les imports `from '@radix-ui/react-*'` au top-level
   - Identifier ceux importés mais conditionnellement rendus (`{open && <X/>}`)
     — candidats à `lazy()` ou `<Suspense>`
2. Seuil heuristique : **≥ 3 composants Radix lourds eager-loaded sur une
   route P0** (catalog routes, home, pieces) = finding `high`.
3. Sur routes admin / low-traffic : finding `medium` ou skip selon
   convention.

## Sortie attendue (JSON)

```json
{
  "check": "inp-eager-radix",
  "pass": false,
  "findings": [
    {
      "route": "frontend/app/routes/pieces.$gamme.$type.tsx",
      "eager_radix": ["Sheet", "Dialog", "Popover", "Tooltip", "Select"],
      "count": 5,
      "severity": "high",
      "fix_hint": "Convert Sheet + Dialog to dynamic import via React.lazy + Suspense"
    }
  ],
  "summary": { "routes_scanned": 242, "at_risk": 1 }
}
```

## Faux positifs connus

- Composants Radix dans un layout parent (root.tsx) qui sont effectivement
  utilisés dans 100% des sessions. Mitigation : compter par route feuille,
  pas par layout.
- Composants minimaux (`@radix-ui/react-label`) qui n'ajoutent pas de coût.
  Mitigation : liste whitelist "lourd" explicite ci-dessus.

## Limites

- Heuristique pure (count). Pas de profiling hydration réel. À corroborer
  avec Sentry/web-vitals attribution pour priorisation.
- Ne détecte pas les composants Radix wrapped dans un composant maison
  exporté (ex: `<MyAwesomeMenu />` qui use Radix dedans). Risque résiduel.
