# Format — NE-CHANGE-PAS-TROP-VITE

> **Mode** : SHORT | **Plateformes** : TikTok / Reels / Shorts / FB Reels | **Durée cible** : 30-45 s | **Aspect** : 9:16

## Promesse éditoriale

« Avant de changer la pièce X, vérifie d'abord Y. »

Fafa empêche le client de commander une pièce alors que la vraie cause est ailleurs.
Cas typique : symptôme commun (perte de puissance, fumée noire, batterie faible) qui peut venir de plusieurs sources.

## Structure narrative (5 séquences)

| # | Séquence | Durée | Contenu |
|---|---|---|---|
| 1 | **Hook** | 3 s | « Ta voiture [symptôme] ? Ne change pas tout de suite la [pièce]. » |
| 2 | **Problème** | 5 s | Pourquoi le réflexe « changer la pièce X » est tentant + risque (coût, complexité, inutilité si vraie cause ailleurs) |
| 3 | **3 causes possibles** | 15 s | Cause A (8s) + Cause B (4s) + Cause C (3s) — la plus probable d'abord |
| 4 | **Conseil** | 7 s | Vérifier dans l'ordre : test simple → test intermédiaire → test atelier |
| 5 | **CTA** | 5 s | « Sur AutoMecanik, sélectionne ton véhicule pour voir les pièces compatibles. Avant d'acheter, vérifie. » |

**Disclaimer overlay** : « Conseil informatif. Diagnostic à confirmer selon véhicule. »

## Composition Remotion (V2)

`NeChangePasTropVite.tsx` (1080×1920, 30fps, 30-45s)

Props attendues :
```typescript
interface NeChangePasTropViteProps {
  hook: string;                  // <80 chars
  symptom: string;               // <60 chars
  pieceWrong: string;            // pièce que le client pense changer
  causes: Array<{                // 3 causes ordonnées par probabilité
    cause: string;
    duration_sec: number;
    check_suggestion: string;
  }>;
  advice: string;                // conseil ordonné
  cta: string;                   // <120 chars
  disclaimer: string;            // overlay
  voiceUrl: string;              // S3 key vers .wav voix
  brollAssets: Array<{           // optionnel
    s3_key: string;
    visual_type: 'schema' | 'animation' | 'macro' | 'motion_text' | 'ambiance';
    timestamp_sec: number;
    truth_dependency: 'illustration' | 'reference';  // JAMAIS 'proof' (G6)
  }>;
}
```

## Exemples Fafa V1 (5 pilotes Lot 1)

1. **Vanne EGR** — perte de puissance + fumée noire → filtre à air bouché / débitmètre / durite
2. **Batterie** — démarrage difficile → tester alternateur d'abord
3. **Plaquettes** — bruit freinage → regarder usure disques
4. **Turbo** — perte puissance → vérifier durites avant
5. **Injecteurs** — démarrage difficile → filtre carburant + pression rampe

## Gates critiques

- **G2 Safety** : si conseil = « diagnostic certain », FAIL. Garder « probable », « à vérifier ».
- **G3 Brand** : aucun prix, aucune promo, aucune urgence artificielle.
- **G4 Platform** : durée 30-45s ±10% (27-49s acceptable).
- **G6 Visual Honesty** : aucun visuel IA présenté comme preuve. Schémas/animations OK pour illustrer.

## Voir aussi

- Skill `[[fafa-script-generator]]` (input format)
- Skill `[[fafa-remotion-template-planner]]` (template choice + payload)
- `formats/symptome-3-causes.md` (format sibling)
- `formats/piece-expliquee.md` (format sibling)
