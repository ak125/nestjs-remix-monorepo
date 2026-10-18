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

`SymptomeTroisCauses.tsx` (1080×1920, 30fps, 33 s fixes : `durationInFrames={990}`, `compositions/index.tsx:87-105`)

Props lues par la composition (`services/remotion-renderer/src/compositions/SymptomeTroisCauses.tsx:27-43`), passées dans
`compositionProps` ; en cas d'écart avec cette page, la composition fait foi. `briefId`, `videoType` et `vertical` viennent de
la requête `/render`.
```typescript
interface SymptomeTroisCausesProps {
  symptom?: string;              // observable concret <80 chars
  causes?: Array<{               // EXACTEMENT 3, ordonnées par probabilité décroissante
    cause: string;
    sign?: string;
    check?: string;
  }>;
  cta?: string;
  disclaimer?: string;
  audioUrl?: string;             // piste voix
  brandName?: string;
}
```

Constaté dans le code, sans rendu lancé :

- Toute prop absente affiche une valeur de démonstration (perte de puissance, filtre à air, débitmètre, vanne EGR), tirée de
  `defaultProps` dans `index.tsx` ou des valeurs par défaut du composant (l.45-56). Le moteur ne signale pas l'oubli :
  renseigner chaque champ.
- Le code n'impose pas « exactement 3 » : il garde les 3 premières causes (l.65) et donne à chacune une fenêtre fixe (l.61).
  Avec 2 causes, la fenêtre 21-29 s reste vide. Aucune durée par cause ne se règle.
- Découpage rendu (l.60-62) : symptôme 0-4 s, cause 1 4-13 s, cause 2 13-21 s, cause 3 21-29 s, CTA 29-33 s. Le tableau
  ci-dessus reste l'intention éditoriale ; la voix se cale sur ce découpage.
- Sans `audioUrl`, le rendu est muet, sans erreur (l.75).
- Aucune prop b-roll : l'ancien champ `brollAssets` de cette page n'est lu par aucune composition V1. G6 s'applique aux visuels
  de la composition elle-même.

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
