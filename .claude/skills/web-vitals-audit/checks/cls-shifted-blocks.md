---
check: cls-shifted-blocks
severity: high
confidence: medium
expected_false_positive_rate: 0.20
autofixable: false
sources:
  - frontend/app/components/**
  - frontend/app/routes/**/*.tsx
risk_documented:
  - project_inp_pieces_root_cause_20260522.md
---

# Check : CLS — Shifted Blocks Without Fixed Dimensions

## Pattern audité

Blocs DOM susceptibles de provoquer Cumulative Layout Shift :

1. `<img>` sans `width` + `height` ou `aspect-ratio` (image-driven shift)
2. Composants dont le contenu varie après hydration (skeleton → real)
   sans réserve d'espace équivalente (`min-height` ou skeleton iso-taille)
3. Ads / iframes embeds sans dimension fixe (rare ici, mais à vérifier)
4. Fonts (`font-display: swap`) sans `size-adjust` ni fallback métrique
   compatible → FOUT shift

**Impact** : CLS > 0.10 = `needs improvement`, > 0.25 = poor.

## Origine

Préventif — pas d'incident PROD CLS documenté à ce jour. `responsive-audit`
couvre les touch targets et la mobile-first, mais pas le CLS spécifiquement.
Ce check comble le gap CWV.

## Méthode

1. Grep `<img` dans `frontend/app/**/*.{tsx,ts}` sans `width=` ni
   `aspect-ratio:` ni `className.*aspect-` à proximité → findings
   `unsized_img`.
2. Grep skeleton patterns (`<Skeleton`, `animate-pulse`) → vérifier le
   composant remplaçant a un `min-height` matching (heuristique : même
   composant parent défini avec h-X).
3. Lire `app/styles/fonts.css` ou root.tsx — vérifier que les @font-face
   ont `size-adjust` ou que le `font-family fallback` minimise le FOUT.

## Sortie attendue (JSON)

```json
{
  "check": "cls-shifted-blocks",
  "pass": false,
  "findings": [
    {
      "file": "frontend/app/components/product/Card.tsx",
      "line": 42,
      "issue": "<img src={product.image} alt=...> without width/height or aspect-ratio",
      "category": "unsized_img",
      "severity": "high",
      "fix_hint": "Add width={300} height={200} or className='aspect-[3/2]'"
    }
  ],
  "summary": { "scanned": 1280, "unsized_imgs": 1, "skeleton_mismatch": 0 }
}
```

## Faux positifs connus

- `<img>` dans des SVG decoratifs où le shift n'est pas perçu (background).
  Mitigation : exclure ceux avec `aria-hidden="true"` ou parents
  `position: absolute`.
- Skeletons intentionnellement plus petits que le réel (cas rare,
  acceptable). Mitigation : marker commentaire `// cls-ok` à formaliser.

## Limites

- Pas de mesure réelle CLS — recoupe `__seo_cwv_daily.cls` pour priorisation.
- Ne couvre pas les shifts causés par JS dynamique post-hydration
  (animations, infinite scroll). À ajouter en V2 si pattern observé.
