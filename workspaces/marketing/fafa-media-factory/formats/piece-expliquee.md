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

`PieceExpliquee.tsx` (1080×1920, 30fps, 40 s fixes : `durationInFrames={1200}`, `compositions/index.tsx:111-134`)

Props lues par la composition (`services/remotion-renderer/src/compositions/PieceExpliquee.tsx:76-92`), passées dans
`compositionProps` ; en cas d'écart avec cette page, la composition fait foi. `briefId`, `videoType` et `vertical` viennent de
la requête `/render`.
```typescript
interface PieceExpliqueeProps {
  piece?: string;                // nom usuel <40 chars
  pieceFunction?: string;        // rôle mécanique <200 chars
  location?: string;             // emplacement véhicule <80 chars
  wearSigns?: Array<{            // 2-3 signes observables
    sign: string;
    severity?: 'low' | 'medium' | 'high';  // absent → 'low'
  }>;
  whenToChange?: string;         // critère objectif : km / années / signe critique
  cta?: string;
  disclaimer?: string;
  audioUrl?: string;             // piste voix
  brandName?: string;
  hook?: string;                 // accroche affichée sous le nom de la pièce (0-4 s)
  titles?: {                     // titres de section ; absent → libellé historique
    intro?: string;              // « La pièce expliquée »
    function?: string;           // « À quoi ça sert »
    location?: string;           // « Emplacement »
    wearSigns?: string;          // « Signes d’usure »
    whenToChange?: string;       // « Quand la changer » (« Quand le changer » pour un nom masculin)
  };
  windowWarnings?: {             // avertissement affiché sur sa seule fenêtre (disclaimer `overlay_segment`)
    intro?: string;              // 0-4 s
    function?: string;           // 4-14 s
    wearSigns?: string;          // 14-24 s
    whenToChange?: string;       // 24-32 s
    closer?: string;             // 32-40 s
  };
}
```

Constaté dans le code, sans rendu lancé :

- Le rôle de la pièce passe dans `pieceFunction`, pas `function`. `whenToChange` est un texte unique : une implication de
  sécurité s'y écrit, et reste un claim `safety` (G2 ci-dessous).
- Toute prop de contenu absente affiche une valeur de démonstration (vanne EGR, 120 000 km), tirée de `defaultProps` dans
  `index.tsx` ou des valeurs par défaut du composant (l.100-117). Le moteur ne signale pas l'oubli : renseigner chaque champ.
  `hook`, `titles` et `windowWarnings` n'ont pas de valeur de démonstration : absents, rien ne s'affiche ou le libellé
  historique reste.
- Seuls les 3 premiers signes s'affichent (l.344) ; une gravité absente s'affiche comme `low` (l.371).
- Découpage rendu (`PIECE_EXPLIQUEE_WINDOWS`, l.44-50) : intro 0-4 s, fonction 4-14 s, usure 14-24 s, quand changer
  24-32 s, CTA 32-40 s. Le tableau ci-dessus reste l'intention éditoriale ; la voix se cale sur ce découpage.
- Un disclaimer `overlay_continuous` va dans `disclaimer` ; un `overlay_segment` va dans `windowWarnings`, sur la fenêtre
  qui couvre son segment.
- Sans `audioUrl`, le rendu est muet, sans erreur (l.138).
- Test de rendu : `services/remotion-renderer/test/piece-expliquee.render.test.ts` (`npm test` dans le service).
- Aucune prop b-roll : l'ancien champ `brollAssets` de cette page n'est lu par aucune composition V1. G6 s'applique aux visuels
  de la composition elle-même.

## Exemples Fafa V2+ (formats sibling pour batchs ultérieurs)

- À quoi sert le filtre à air
- À quoi sert l'alternateur
- À quoi sert le thermostat
- À quoi sert la vanne EGR
- À quoi servent les silentblocs

## Gates critiques

- **G1 Truth** : `pieceFunction`, `wearSigns`, `whenToChange` DOIVENT avoir evidence (wiki diagnostic, OEM, catalogue TecDoc). Sans preuve rattachée ou sans `status` `verified`, chaque claim hors `procedure` et `safety` compte (pas de ratio) : un seul suffit au FAIL.
- **G2 Safety** : si `whenToChange` porte une implication de sécurité (ex: « plaquettes usées = freinage compromis »), claim de type `safety` → validation humaine obligatoire (G2 : un seul claim sans `validatedBy` = FAIL).
- **G3 Brand** : aucun prix, aucune promo. CTA pédagogique uniquement.
- **G4 Platform** : le code lit la plage de `brief.type`, `short` = 15-60 s élargie de 10 % (13,5-66 s) ; la durée cible 30-50 s est éditoriale, aucune gate ne la mesure.
- **G6 `visual_role`** : photos pièces neuves OK (truth_dependency=`reference`), photos pièces usées en macro OK pour illustration. JAMAIS « voici l'usure de votre pièce » si pas photo client.

## Voir aussi

- Skill `[[fafa-script-generator]]`
- Skill `[[fafa-remotion-template-planner]]`
- `formats/ne-change-pas-trop-vite.md` (sibling)
- `formats/symptome-3-causes.md` (sibling)
