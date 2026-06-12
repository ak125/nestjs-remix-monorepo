---
check: content-visibility-gap
severity: high
confidence: high
expected_false_positive_rate: 0.10
autofixable: false
sources:
  - frontend/app/routes/**/*.tsx
  - frontend/app/components/**
  - tailwind.config.ts (cv-auto utility class)
incidents_proven:
  - "#694 (2026-05-22, /pieces below-fold blocks without content-visibility:auto — INP -33% prod A/B)"
---

# Check : Below-Fold Blocks Without content-visibility:auto

## Pattern audité

Sections / blocs DOM **below the fold** (hors viewport initial) sur des
routes P0 qui ne déclarent pas `content-visibility: auto` (ou son alias
Tailwind `.cv-auto`).

`content-visibility: auto` permet au navigateur de **skipper le rendering**
des sections hors-viewport jusqu'à ce qu'elles entrent dans la scroll
zone, réduisant le main-thread cost à l'init et améliorant INP.

**Impact mesuré (#694)** : -33% INP sur `/pieces/` après application
content-visibility sur les blocs below-fold. Validation A/B en PROD.

## Origine

PR #694 (2026-05-22) a appliqué `.cv-auto` sur les blocs below-fold de
`/pieces/`. Validation A/B en PROD a montré -33% INP. Le pattern est
généralisable aux autres routes long-form (catalog, blog, gamme pages).

## Méthode

1. Identifier les routes long-form (P0 trafic + scroll significatif) :
   `frontend/app/routes/{_index,blog,pieces,gamme}*.tsx` initialement,
   ensuite via heuristique nombre de sections / hauteur estimée.
2. Pour chaque, parser le composant default export — identifier les
   sections après les ~2-3 premiers blocs (estimation viewport mobile
   ~600-800px haut).
3. Vérifier qu'elles déclarent `cv-auto` (Tailwind) ou
   `content-visibility-auto` (CSS direct) ou un wrapper équivalent.
4. Si absent et hauteur cumulée estimée > 1500 px → finding
   `missing_cv_auto`.

## Sortie attendue (JSON)

```json
{
  "check": "content-visibility-gap",
  "pass": false,
  "findings": [
    {
      "route": "frontend/app/routes/gamme.$slug.tsx",
      "below_fold_sections": ["RelatedProducts", "GammeDescription", "ReviewsBlock"],
      "category": "missing_cv_auto",
      "severity": "high",
      "fix_hint": "Wrap sections in <section className='cv-auto contain-intrinsic-size-[800px]'>"
    }
  ],
  "summary": { "long_form_routes": 18, "missing_cv_auto": 1 }
}
```

## Faux positifs connus

- Routes courtes (login, 404) où le scroll est minimal — pas concernées.
  Mitigation : seuil hauteur cumulée 1500 px.
- Sections déjà optimisées via `loading="lazy"` (images) couvrent
  partiellement le problème mais pas le DOM rendering coût. À considérer
  comme `partial-fix` plutôt que `pass`.

## Limites

- Estimation hauteur statique heuristique — réel CWV peut varier selon
  device / viewport. Méthodo Playwright dans `project_inp_pieces_root_cause_20260522.md`.
- Tailwind utility `.cv-auto` est custom (à confirmer dans
  `tailwind.config.ts`) — sinon utiliser `style={{ contentVisibility: 'auto' }}`.

## Action recommandée pour findings

1. Wrapper la section dans
   `<section className="cv-auto contain-intrinsic-size-[Xpx]">` où X est
   l'estimation de hauteur (Tailwind class à activer).
2. Ne pas appliquer sur sections above-the-fold (pas de bénéfice).
3. Mesurer avant/après via web-vitals attribution réelle pour confirmer.
