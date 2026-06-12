---
check: lcp-route-hydration
severity: high
confidence: medium
expected_false_positive_rate: 0.25
autofixable: false
sources:
  - frontend/app/routes/**/*.tsx
risk_documented:
  - project_inp_pieces_root_cause_20260522.md
---

# Check : LCP — Route Hydration Cost

## Pattern audité

Routes Remix dont l'hydration initiale paie un coût élevé qui retarde le
LCP (Largest Contentful Paint), typiquement à cause de :

1. `useState` initialisé avec un appel coûteux (`computeLargeArray()`,
   `parse(huge JSON)`) sans `useMemo` ou lazy initialiser
2. `useEffect` synchrone avec dépendance lourde au mount
3. Props de loader sérialisées massives (>50 KB JSON) traversant
   l'hydration
4. Composant principal LCP entouré de wrappers non-essentiels (theme
   provider, framer-motion) ajoutant un délai paint

**Impact** : LCP > 2.5 s mobile = seuil `needs improvement`, > 4 s = poor.

## Origine

Préventif — pattern recurrent dans les apps Remix mais pas d'incident
PROD documenté pour cette codebase encore. Risque pondéré modéré.

## Méthode

1. Pour chaque route Remix avec `loader` :
   - Estimer la taille du JSON retourné (parser le type TS du loader si
     typé, sinon heuristique sur `serializable` shapes).
   - Si > 50 KB sérialisé estimé → finding `large_loader_payload`.
2. Grep `useState\(\s*[a-z][a-zA-Z]+\(` dans le composant `default export`
   de la route — si init non-trivial sans `() => ...` lazy → finding
   `eager_state_init`.
3. Identifier le composant LCP candidat (premier `<img>`, `<h1>`, ou bloc
   de texte large > 100 chars dans le viewport) — vérifier qu'il n'est pas
   wrapped dans 3+ niveaux de Context providers spécifiques à la route.

## Sortie attendue (JSON)

```json
{
  "check": "lcp-route-hydration",
  "pass": false,
  "findings": [
    {
      "route": "frontend/app/routes/blog.$slug.tsx",
      "issue": "useState init: parsing 80KB markdown without lazy initializer",
      "category": "eager_state_init",
      "severity": "high",
      "fix_hint": "useState(() => parseMarkdown(data)) → lazy initializer"
    }
  ],
  "summary": { "routes_scanned": 242, "at_risk": 1 }
}
```

## Faux positifs connus

- Routes admin / dashboard où le LCP n'est pas critique (pas indexé,
  audience interne). Mitigation : pondérer par route public/admin.
- Lazy initializer absent mais avec valeur constante simple
  (`useState({})`) — pas un problème réel. Mitigation : regex affinée.

## Limites

- Pas de mesure réelle LCP — corroboration `__seo_cwv_daily` ou CrUX
  recommandée avant action.
- Ne couvre pas la cause LCP serveur (TTFB, render-blocking CSS).
  Hors scope par convention CWV root-cause client-side.
