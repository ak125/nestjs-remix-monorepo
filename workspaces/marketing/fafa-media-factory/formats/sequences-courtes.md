# Format — SÉQUENCES-COURTES

> **Mode** : SHORT | **Plateformes** : TikTok / Reels / Shorts / FB Reels | **Durée cible** : 25-40 s | **Aspect** : 9:16

## Promesse éditoriale

« Une question, puis sa réponse en quelques séquences minutées. »

Format générique des courts qu'aucun format fixe ne rend sans inventer de contenu : une suite d'étapes (voyant d'huile :
par où commencer), des critères comparés (deux filtres identiques), les rôles des éléments d'un schéma (les clapets d'un
filtre vissé). Le nombre de séquences et leur durée viennent du script.

## Structure narrative (séquences libres)

| # | Séquence | Durée | Contenu |
|---|---|---|---|
| 1 | **Question** | 3 s | la question du court, texte à l'écran court ; visuel facultatif |
| 2 | **Identité** | 4-6 s | « Moi c'est Fafa, le mécano IA d'AutoMecanik. » + premier élément de réponse |
| 3 à n-1 | **Réponse** | 6-13 s chacune | une étape, un critère ou un rôle par séquence ; plusieurs textes à l'écran possibles |
| n | **Destination** | 4-6 s | la page AutoMecanik qui prolonge la réponse, sans prix ni promo |

**Disclaimer overlay** : « Conseil informatif. Diagnostic à confirmer selon véhicule. Fafa est un mécano IA. »

## Composition Remotion (V2)

`SequencesCourtes.tsx` (1080×1920, 30fps ; durée = fin de la dernière séquence, `calculateMetadata`,
`compositions/index.tsx:135-144`)

Props lues par la composition (`services/remotion-renderer/src/compositions/SequencesCourtes.tsx:28-46`), passées dans
`compositionProps` ; en cas d'écart avec cette page, la composition fait foi. `briefId`, `videoType` et `vertical` viennent de
la requête `/render`.
```typescript
interface SequenceCourte {
  startSec: number;              // début de la séquence, en secondes
  endSec: number;                // fin (exclue) ; > startSec, sinon la séquence est ignorée
  title?: string;                // titre de la séquence
  items?: string[];              // textes à l'écran, apparus l'un après l'autre et conservés
  imageUrl?: string;             // pictogramme, photo ou schéma de la séquence
  warning?: string;              // avertissement limité à la séquence (disclaimer `overlay_segment`)
}

type SequencesCourtesProps = {
  sequences?: SequenceCourte[];  // au moins une
  disclaimer?: string;           // bandeau continu (disclaimer `overlay_continuous`)
  audioUrl?: string;             // piste voix
  brandName?: string;            // absent → « AutoMecanik »
};
```

Constaté dans le code de la composition ; « (test) » marque ce que vérifie le test de rendu
`services/remotion-renderer/test/sequences-courtes.render.test.ts` (`npm test` dans le service) :

- Aucune valeur de démonstration : sans séquence valide, le rendu échoue avec un message explicite (l.94-96) (test).
- Les séquences sont triées par `startSec` ; entre deux séquences, seuls la marque et le bandeau restent à l'écran (test
  pour l'ordre et la séquence affichée).
- Les textes d'une séquence apparaissent à intervalles égaux sur sa durée (l.155-156) : le premier au début, le dernier
  à `(n-1)/n` de la séquence.
- La durée est la fin de la dernière séquence (test) ; `durationSecs` de la requête ne la fixe pas. La piste voix part de
  0 s sans recalage (l.109) : les `startSec`/`endSec` du script doivent suivre le minutage de la voix.
- Sans `audioUrl`, le rendu est muet, sans erreur (l.109).

## Exemples Fafa V2+

- Voyant d'huile allumé : faut-il changer le filtre ? (étapes de la notice)
- Deux filtres identiques sont-ils interchangeables ? (critères comparés)
- À quoi servent les clapets d'un filtre vissé ? (rôles d'un schéma)

## Gates critiques

- **G1 Truth** : chaque texte à l'écran qui affirme un fait est un claim rattaché à une preuve. Sans preuve rattachée ou sans `status` `verified`, chaque claim hors `procedure` et `safety` compte (pas de ratio) : un seul suffit au FAIL.
- **G2 Safety** : une étape de notice ou un geste d'atelier est un claim `procedure` ou `safety` → validation humaine obligatoire (G2 : un seul claim sans `validatedBy` = FAIL).
- **G3 Brand** : aucun prix, aucune promo. La dernière séquence nomme une destination, pas une offre.
- **G4 Platform** : le code lit la plage de `brief.type`, `short` = 15-60 s élargie de 10 % (13,5-66 s) ; la durée cible 25-40 s est éditoriale, aucune gate ne la mesure.
- **G6 `visual_role`** : un schéma ou un pictogramme illustre un principe, jamais l'état d'une pièce du client.

## Voir aussi

- Skill `[[fafa-script-generator]]`
- Skill `[[fafa-remotion-template-planner]]`
- `formats/piece-expliquee.md` (sibling)
- `formats/symptome-3-causes.md` (sibling)
