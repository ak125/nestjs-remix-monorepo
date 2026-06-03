# Format — SYMPTÔME-3-CAUSES

> **Mode** : SHORT | **Plateformes** : TikTok / Reels / Shorts / FB Reels | **Durée cible** : 25-40 s | **Aspect** : 9:16

## Promesse éditoriale

« Symptôme A peut venir de 3 causes : B, C, D. »

Fafa éduque le client sur le diagnostic différentiel — un symptôme commun a souvent plusieurs causes possibles ordonnées par probabilité.

## Structure narrative (5 séquences)

| # | Séquence | Durée | Contenu |
|---|---|---|---|
| 1 | **Symptôme** | 4 s | « Ta voiture [symptôme observable]. Voici 3 causes possibles. » |
| 2 | **Cause 1** | 6 s | Cause la plus fréquente + signe de reconnaissance + check rapide |
| 3 | **Cause 2** | 6 s | Cause intermédiaire + signe + check |
| 4 | **Cause 3** | 6 s | Cause moins fréquente mais sérieuse + signe + check |
| 5 | **CTA** | 5 s | « Sur AutoMecanik, sélectionne ton véhicule. Avant d'acheter, vérifie la compatibilité. » |

**Disclaimer overlay** : « Conseil informatif. Diagnostic à confirmer selon véhicule. »

## Composition Remotion (V2)

`SymptomeTroisCauses.tsx` (1080×1920, 30fps, 25-40s)

Props attendues :
```typescript
interface SymptomeTroisCausesProps {
  symptom: string;               // observable concret <80 chars
  causes: [                      // EXACTEMENT 3, ordonnées par probabilité décroissante
    { cause: string; sign: string; check: string; duration_sec: number; },
    { cause: string; sign: string; check: string; duration_sec: number; },
    { cause: string; sign: string; check: string; duration_sec: number; }
  ];
  cta: string;
  disclaimer: string;
  voiceUrl: string;
  brollAssets: Array<{
    s3_key: string;
    visual_type: 'schema' | 'animation' | 'macro' | 'motion_text' | 'ambiance';
    timestamp_sec: number;
    truth_dependency: 'illustration' | 'reference';  // JAMAIS 'proof' (G6)
  }>;
}
```

## Exemples Fafa V1 (5 pilotes Lot 2)

6. **Perte de puissance** — filtre à air / débitmètre / vanne EGR
7. **Fumée noire** — injecteurs encrassés / capteur pression / EGR
8. **Tremblements au freinage** — disques voilés / silentblocs / étriers
9. **Bruit au démarrage** — démarreur usé / alternateur faible / accouplement
10. **Moteur qui chauffe** — thermostat / liquide bas / radiateur encrassé

## Gates critiques

- **G1 Truth** : chaque cause DOIT avoir une evidence wiki diagnostic ou OEM. Sans evidence → claim non-sourcé compte dans le ratio FAIL.
- **G2 Safety** : ordre des causes basé sur probabilité, pas affirmation absolue. Garder « peut venir », « souvent », « moins fréquente ».
- **G4 Platform** : durée 25-40s ±10% (22-44s acceptable).
- **G6 Visual Honesty** : photos pièces réelles autorisées (truth_dependency=`reference`), JAMAIS comme preuve d'un diagnostic.

## Voir aussi

- Skill `[[fafa-script-generator]]`
- Skill `[[fafa-remotion-template-planner]]`
- `formats/ne-change-pas-trop-vite.md` (sibling)
- `formats/piece-expliquee.md` (sibling)
