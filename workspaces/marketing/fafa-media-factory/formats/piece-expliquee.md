# Format — PIÈCE-EXPLIQUÉE

> **Mode** : SHORT | **Plateformes** : TikTok / Reels / Shorts / FB Reels | **Durée cible** : 30-50 s | **Aspect** : 9:16

## Promesse éditoriale

« À quoi sert la pièce X, comment elle s'use, quand la changer. »

Fafa éduque le client sur le rôle d'une pièce avant qu'il commande — réduit les erreurs de commande, augmente la qualification du panier.

## Structure narrative (5 séquences)

| # | Séquence | Durée | Contenu |
|---|---|---|---|
| 1 | **Intro pièce** | 4 s | « Tu cherches une [pièce] ? Voici ce qu'elle fait vraiment. » |
| 2 | **Fonction** | 10 s | Rôle mécanique précis + emplacement véhicule + interaction avec autres pièces |
| 3 | **Signes d'usure** | 10 s | 2-3 signes observables (bruit, fuite, voyant, perf) |
| 4 | **Quand changer** | 8 s | Critère objectif (km / années / signe critique) — pas de promesse absolue |
| 5 | **CTA** | 6 s | « Sur AutoMecanik, sélectionne ton véhicule pour voir les compatibilités. Avant d'acheter, vérifie. » |

**Disclaimer overlay** : « Conseil informatif. Diagnostic à confirmer selon véhicule. »

## Composition Remotion (V2)

`PieceExpliquee.tsx` (1080×1920, 30fps, 30-50s)

Props attendues :
```typescript
interface PieceExpliqueeProps {
  piece: string;                 // nom usuel <40 chars
  function: string;              // rôle mécanique <200 chars
  location: string;              // emplacement véhicule <80 chars
  wearSigns: Array<{             // 2-3 signes observables
    sign: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  whenToChange: {
    objectiveCriterion: string;  // km / années / signe critique
    safetyImplication?: string;  // optionnel — si claim safety, evidence humaine obligatoire
  };
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

## Exemples Fafa V2+ (formats sibling pour batchs ultérieurs)

- À quoi sert le filtre à air
- À quoi sert l'alternateur
- À quoi sert le thermostat
- À quoi sert la vanne EGR
- À quoi servent les silentblocs

## Gates critiques

- **G1 Truth** : `function`, `wearSigns`, `whenToChange.objectiveCriterion` DOIVENT avoir evidence (wiki diagnostic, OEM, catalogue TecDoc). Sans evidence → ratio FAIL.
- **G2 Safety** : si `safetyImplication` présent (ex: « plaquettes usées = freinage compromis »), claim de type `safety` → validation humaine obligatoire (G2 STRICT, 1 seul claim sans validation = FAIL).
- **G3 Brand** : aucun prix, aucune promo. CTA pédagogique uniquement.
- **G4 Platform** : durée 30-50s ±10% (27-55s acceptable).
- **G6 Visual Honesty** : photos pièces neuves OK (truth_dependency=`reference`), photos pièces usées en macro OK pour illustration. JAMAIS « voici l'usure de votre pièce » si pas photo client.

## Voir aussi

- Skill `[[fafa-script-generator]]`
- Skill `[[fafa-remotion-template-planner]]`
- `formats/ne-change-pas-trop-vite.md` (sibling)
- `formats/symptome-3-causes.md` (sibling)
