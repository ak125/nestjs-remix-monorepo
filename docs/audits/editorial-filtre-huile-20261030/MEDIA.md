# Médias — filtre à huile

Complète [AUDIT.md](AUDIT.md). Aucun montage, aucun rendu, aucune publication dans ce lot. Aucune vue, rétention ou
conversion mesurée ni citée. Voix Fafa en « tu » ; légendes des plateformes en « vous ».

## 1. État des vidéos

Quatre états distincts : script écrit, média produit, rendu vérifié, publication.

| Vidéo | Question | Format | Script écrit | Média produit | Rendu vérifié | Publication |
|---|---|---|---|---|---|---|
| V1 `fafa-filtre-huile-001` (principal) | Vissé ou cartouche, quand le changer, comment ne pas se tromper ? | `piece-expliquee` (`PieceExpliquee`, 40 s fixes) | oui : dossier `scripts/draft/fafa-filtre-huile-001/` | non : ni voix ni visuel | non | non |
| C1 | Voyant d'huile allumé : faut-il changer le filtre ? | court 35 s | oui (§ 7.1), sans dossier | non | non | non |
| C2 | Deux filtres identiques sont-ils interchangeables ? | court 30 s | oui (§ 7.2), sans dossier | non | non | non |
| C3 | À quoi servent les clapets d'un filtre vissé ? | court 35 s | oui (§ 7.3), sans dossier | non | non | non |
| C4 | Comment serrer un filtre vissé ? | court 30 s | oui (§ 7.4), **bloqué** par F-C2 à F-C4 | non | non | non |

Plateformes du brief V1 : TikTok, Instagram Reels, YouTube Shorts, Facebook Reels, un même rendu 9:16 (1080 × 1920).
Pas de format long : aucune composition de la fabrique ne dépasse 40 s.

## 2. Ce que `PieceExpliquee` affiche réellement

Lu dans `services/remotion-renderer/src/compositions/PieceExpliquee.tsx` (base `980b2f8a7`) :

| Fenêtre | Images | Affiché | Source |
|---|---|---|---|
| 0-4 s | 0-120 | nom de la pièce | `piece` |
| 4-14 s | 120-420 | « À quoi ça sert », `pieceFunction`, « Emplacement », `location` | libellés fixes |
| 14-24 s | 420-720 | « Signes d'usure » (fixe), 3 cartes au plus, gravité `low` par défaut | `wearSigns.slice(0, 3)` |
| 24-32 s | 720-960 | « Quand la changer » (fixe, au féminin), `whenToChange` | libellé fixe |
| 32-40 s | 960-1200 | marque, `cta` | — |
| 0-40 s | — | un seul bandeau d'avertissement | `disclaimer` |

Conséquences pour V1 :

- **L'accroche n'est pas affichée** : la composition n'a pas de prop `hook`. Sans voix (`audioUrl`), l'accroche
  n'existe pas dans la vidéo.
- `screen_text` n'est lu par aucune composition : c'est une consigne de montage, pas un affichage.
- Les sous-titres ne sont pas incrustés. Le post-traitement sait produire un fichier SRT séparé à partir de segments
  (`generateSrt`, `services/remotion-renderer/src/lib/ffmpeg-postprocess.ts`) ; son dépôt sur chaque plateforme est
  manuel.
- Un seul bandeau : `disclaimer.json` en prévoit quatre, dont un avertissement de sécurité limité à 14-24 s
  (`disclaimer-3`, « Voyant d'huile allumé : suivre la notice du véhicule. »). La composition ne peut pas l'afficher
  sur sa seule fenêtre.

## 3. V1 — script et scènes

Angle : la forme du filtre (vissé ou cartouche) découle du moteur ; aucun symptôme ne le désigne à lui seul ; le choix
se fait par véhicule. Source unique : fiche WIKI `wiki/gamme/filtre-a-huile.md` (commit `a4783348`), quatre extraits
dans `evidence.json`. Trois claims (2 `procedure`, 1 `safety`), un par séquence.

Accroches préparées, choix de l'owner (pas un test) :
A « Ton filtre à huile : vissé ou cartouche ? » ·
B « Deux filtres à huile identiques peuvent être différents dedans. » ·
C « Ton filtre à huile ne se choisit pas à l'œil. »

| Fenêtre | Voix | Affiché par la composition | Consigne de montage (`screen_text`) | Démonstration |
|---|---|---|---|---|
| 0-4 s | accroche retenue (A : 7 mots) | « Filtre à huile » | — | photo d'usage `assets/r1-hero-filtre-visse-usage.webp` (disponible, à recadrer en 9:16) ; P-01 préférable (PROMPTS.md) |
| 4-14 s | « Moi c'est Fafa, le mécano IA d'AutoMecanik. Ton filtre à huile empêche les impuretés d'entrer dans le circuit de lubrification. Le vissé se change en entier ; la cartouche, juste son élément. » (31 mots) | `pieceFunction`, `location` ; claim-1 | « Vissé : on change tout » · « Cartouche : juste l'élément » | filtre vissé puis boîtier de cartouche (prises de vue à produire) |
| 14-24 s | « Des signes d'usure ? Aucun symptôme ne désigne à lui seul le filtre. Même un voyant d'huile : suis d'abord ta notice. » (20 mots) | titre fixe « Signes d'usure » ; 2 cartes : « Aucun symptôme ne le désigne à lui seul » (`low`), « Voyant d'huile : suis d'abord ta notice » (`high`) ; claim-2 | « Un voyant ne désigne pas le filtre » | `assets/picto-temoin-pression-huile.webp` (livré) |
| 24-32 s | « Change-le aux échéances de ton constructeur. Trop vieux, il peut se colmater, et l'huile passe alors sans être filtrée. » (19 mots) | `whenToChange` ; claim-3 | « Échéances du constructeur » | schéma `assets/r3-s2-filtre-colmate-by-pass.webp` (livré) |
| 32-40 s | « Deux filtres pareils dehors peuvent différer dedans. Sélectionne ton véhicule sur AutoMecanik : avant d'acheter, vérifie la compatibilité. » (17 mots) | marque, `cta` | « Choisis par véhicule, pas à l'œil » | — |

Débit : 87 mots de voix plus l'accroche (révision 1, § 3.1). La fenêtre 4-14 s porte 31 mots en 10 s, la plus dense (même niveau que la
fenêtre des signes du dossier plaquettes, 32 mots). La composition dure 40 s fixes : une voix plus longue serait
coupée. Calage à vérifier sur la voix enregistrée. Si elle déborde, retirer d'abord « dans le circuit de
lubrification » (−5 mots) : la phrase reste admise.

Contrôles faits (30/10) :

- G3 recalculée avec les 14 motifs `FORBIDDEN_PATTERNS_SHORT` du code sur les 17 lignes dites ou affichées : 0
  violation, aucun appel à l'action.
- Validateur `scripts/marketing/fafa-pilot-governance.cjs` : sortie 1, `INVALID_claim-table` (les claims `procedure`
  et `safety` exigent `human_validated: true`). G1 et G2 : UNKNOWN jusqu'à la validation humaine.
- G4, G5, G6 : UNKNOWN, rien à mesurer avant rendu. G7 : FAIL (`approvalRecord.stages` absent du schéma ; aucune étape
  `script_text` approuvée).
- Persona (`personas/fafa.md`) : identité IA dite à 4 s et dans le bandeau ; aucune promesse absolue, aucun prix,
  aucune urgence, aucun concurrent nommé.

### 3.1 Relecture éditoriale (révision 1)

Relecture de V1 et des courts selon `.claude/prompts/_shared/editorial-review.md` (v1.0.0), contre la fiche WIKI ;
original = révision 0 du même dossier.

| Avant | Après | Règle | Raison |
|---|---|---|---|
| « Trop vieux, il se colmate » (`script_voice`, `whenToChange`) | « Trop vieux, il peut se colmater » | § 3, degré de certitude | la fiche dit « peut se colmater », comme claim-3 |
| `disclaimer-3` « en roulant : s'arrêter et suivre la notice » | « allumé : suivre la notice du véhicule » | § 3, portée | l'arrêt vient de la notice Clio 5 phase 1, pas d'une règle pour tout véhicule |
| C1 « Clio 5 phase 1 : arrêt impératif… » | condition rétablie (en roulant, témoin d'arrêt impératif, signal sonore) | § 3, condition | une condition retirée est une altération critique ; C1 passe à 35 s |
| C2 « Dedans, ça change » | « Dedans, ils peuvent différer » | § 3, degré de certitude | la fiche dit « peuvent être très différents » |

Contrôle de fidélité : aucune référence, aucun nombre, aucune norme ni compatibilité dans les scripts ; conditions et
degrés de certitude alignés sur la fiche. Verdict : PROPOSITION ; la révision 1 a repassé les 7 gates (`approval.json`,
historique). Espaces insécables (RE-T1) : à poser à la projection, pas dans ces brouillons.

## 4. V1 — sous-titres et transcription

Horaires prévus, à recaler sur la voix enregistrée (accroche A). Fichier séparé, 42 caractères par ligne au plus.

```srt
1
00:00:00,000 --> 00:00:03,800
Ton filtre à huile : vissé ou cartouche ?

2
00:00:04,000 --> 00:00:06,500
Moi c'est Fafa,
le mécano IA d'AutoMecanik.

3
00:00:06,500 --> 00:00:10,000
Ton filtre à huile empêche les impuretés
d'entrer dans le circuit de lubrification.

4
00:00:10,000 --> 00:00:14,000
Le vissé se change en entier ;
la cartouche, juste son élément.

5
00:00:14,000 --> 00:00:16,000
Des signes d'usure ?

6
00:00:16,000 --> 00:00:20,000
Aucun symptôme ne désigne
à lui seul le filtre.

7
00:00:20,000 --> 00:00:24,000
Même un voyant d'huile :
suis d'abord ta notice.

8
00:00:24,000 --> 00:00:27,500
Change-le aux échéances
de ton constructeur.

9
00:00:27,500 --> 00:00:32,000
Trop vieux, il peut se colmater,
et l'huile passe alors sans être filtrée.

10
00:00:32,000 --> 00:00:35,000
Deux filtres pareils dehors
peuvent différer dedans.

11
00:00:35,000 --> 00:00:38,000
Sélectionne ton véhicule sur AutoMecanik :

12
00:00:38,000 --> 00:00:40,000
avant d'acheter, vérifie la compatibilité.
```

Transcription (description YouTube, accessibilité) :

> Ton filtre à huile : vissé ou cartouche ? Moi c'est Fafa, le mécano IA d'AutoMecanik. Ton filtre à huile empêche les
> impuretés d'entrer dans le circuit de lubrification. Le vissé se change en entier ; la cartouche, juste son élément.
> Des signes d'usure ? Aucun symptôme ne désigne à lui seul le filtre. Même un voyant d'huile : suis d'abord ta notice.
> Change-le aux échéances de ton constructeur. Trop vieux, il peut se colmater, et l'huile passe alors sans être
> filtrée. Deux filtres pareils dehors peuvent différer dedans. Sélectionne ton véhicule sur AutoMecanik : avant
> d'acheter, vérifie la compatibilité.

## 5. V1 — vignette

- Image : filtre vissé et cartouche côte à côte, fond `#0F1E38` de la composition. La photo hero ne montre qu'un
  filtre : la cartouche est à photographier.
- Texte : « Vissé ou cartouche ? » (2 lignes, 3 mots). Badge « Fafa · mécano IA ».
- Exclus : prix, marque de pièce, flèche ou cercle rouge suggérant une panne.

## 6. V1 — légendes et liens

Lien : R1 avec la convention UTM de la fabrique (`manifests/metrics/README.md`, workflow 1) :
`https://www.automecanik.com/pieces/filtre-a-huile-7.html?utm_source=<plateforme>&utm_medium=social&utm_campaign=fafa-filtre-huile-001`,
`<plateforme>` ∈ `tiktok`, `instagram`, `youtube`, `facebook`. Le site ne lit que `utm_source` et `utm_medium` ;
le détail par vidéo ne vient que de GA4. L'emplacement du lien (légende, bio, description) dépend de chaque compte :
non vérifié dans ce lot.

| Plateforme | Légende |
|---|---|
| TikTok | Filtre à huile vissé ou cartouche ? La forme dépend du moteur : elle ne se choisit pas. Sélectionnez votre véhicule sur AutoMecanik pour voir les filtres rattachés à sa motorisation. Conseil informatif ; Fafa est un mécano IA. #filtreahuile #entretienauto |
| Instagram Reels | Vissé ou cartouche, votre filtre à huile se choisit à partir du véhicule, pas de son apparence. Aucun symptôme ne le désigne à lui seul : en cas de voyant, suivez d'abord la notice. Conseil informatif ; Fafa est un mécano IA d'AutoMecanik. |
| YouTube Shorts | Titre : « Filtre à huile : vissé ou cartouche ? » Description : la transcription (§ 4), puis le lien R1 et « Conseil informatif. Fafa est un mécano IA d'AutoMecanik. » |
| Facebook Reels | Votre filtre à huile : vissé ou cartouche ? Il se remplace aux échéances du constructeur et se choisit à partir du véhicule. Pour voir les filtres rattachés à votre motorisation : lien R1. Conseil informatif ; Fafa est un mécano IA. |

## 7. Courts complémentaires

Chacun répond à une question distincte de V1. Aucune composition de la fabrique ne les rend tels quels :
`NeChangePasTropVite` exige exactement trois causes et `SymptomeTroisCauses` affiche « 3 causes possibles » en dur ; la
fiche WIKI n'en fournit pas trois pour le voyant d'huile. Leur forme visuelle reprend la grammaire de démonstration
observée chez MANN-FILTER (AUDIT § 4, n° 8) : pièce isolée sur fond neutre, un geste par plan, pictogrammes.

Débits de voix mesurés (révision 2) : C1 90 mots en 35 s, C2 61 en 30 s, C3 96 en 35 s, C4 95 en 30 s après la révision 3 (le plus dense,
à recaler sur la voix). Révision 2 : maxime du by-pass de C3 reformulée (AUDIT § 3) ; aucun nom de source dans les voix,
textes à l'écran et légendes. G3 recalculée avec les 14 motifs `FORBIDDEN_PATTERNS_SHORT` sur 54 lignes (voix, écran et légendes des
courts, légendes de V1) : 0 violation, aucun appel à l'action ; relancée en révision 3 après réécriture de C4 : 0
violation sur 54 lignes. Transcription de chaque court : concaténation de sa
colonne Voix ; sous-titres : mêmes segments, 42 caractères par ligne au plus.

### 7.1 C1 — « Voyant d'huile allumé : faut-il changer le filtre ? »

Destination : `/diagnostic-auto` (200). Sources : fiche WIKI, Symptômes & diagnostic, FAQ (admis). Claims : 1 `safety`
(validation humaine requise).

| Temps | Voix | À l'écran | Démonstration |
|---|---|---|---|
| 0-3 s | « Voyant d'huile allumé ? Le filtre n'est pas la première question. » | « Voyant d'huile ≠ filtre » | pictogramme du témoin de pression d'huile |
| 3-9 s | « Moi c'est Fafa, le mécano IA d'AutoMecanik. Ce voyant ne désigne pas à lui seul ton filtre à huile. » | « Un symptôme seul ne désigne pas le filtre » | — |
| 9-22 s | « Suis la notice de ton véhicule. Exemple, Clio 5 phase 1 : s'il s'allume en roulant avec le témoin d'arrêt impératif et un signal sonore, on s'arrête impérativement, on coupe le contact, on vérifie le niveau d'huile. » | « Exemple : Clio 5 phase 1 » · « En roulant + arrêt impératif + signal sonore » · « Arrêt · contact coupé · niveau » | pictogrammes successifs |
| 22-29 s | « Niveau normal ? Sur ce modèle, la notice demande d'appeler un représentant de la marque. » | « Niveau normal → représentant de la marque » | — |
| 29-35 s | « Pour orienter la recherche avant d'acheter une pièce : le diagnostic AutoMecanik. » | « Diagnostic avant achat » | — |

Transcription : concaténation de la colonne Voix (90 mots). Sous-titres : mêmes segments, découpés à 42 caractères.
Vignette : pictogramme du témoin, texte « Voyant d'huile : par où commencer ? » (pas de « filtre » en vignette, pour ne
pas suggérer la cause). Légende : « Un voyant de pression d'huile ne désigne pas à lui seul le filtre à huile. Suivez
d'abord la notice de votre véhicule. Exemple de la Clio 5 phase 1 : s'il s'allume en roulant avec le témoin d'arrêt
impératif et un signal sonore, arrêt impératif, contact coupé, contrôle du niveau. Pour orienter la recherche avant
d'acheter une pièce : diagnostic AutoMecanik. Conseil informatif ; Fafa est un mécano IA. » Mesure : sessions `utm_campaign` C1 sur `/diagnostic-auto` (GA4).

Dépendances : composition à une question et une séquence d'étapes ; pictogrammes ; validation humaine du claim
`safety`.

### 7.2 C2 — « Deux filtres identiques sont-ils interchangeables ? »

Destination : R1 (200). Sources : fiche WIKI, Critères de choix (admis, MAHLE).

| Temps | Voix | À l'écran | Démonstration |
|---|---|---|---|
| 0-3 s | « Deux filtres à huile identiques ? Pas forcément. » | « Identiques ? » | deux filtres vissés d'aspect proche, côte à côte, marques masquées |
| 3-8 s | « Moi c'est Fafa, le mécano IA d'AutoMecanik. Dehors, ils se ressemblent. » | — | rotation lente des deux filtres |
| 8-20 s | « Dedans, ils peuvent différer selon le moteur : clapet anti-retour ou non, filetage, pression d'ouverture du by-pass, média filtrant, finesse de filtration. » | 5 étiquettes, une par critère | filtre en coupe ou schéma, une zone par critère |
| 20-26 s | « Deux versions d'un même modèle n'ont donc pas toujours le même filtre. » | « Même modèle ≠ même filtre » | — |
| 26-30 s | « Sélectionne ton véhicule sur AutoMecanik. Avant d'acheter, vérifie la compatibilité. » | « Choisis par véhicule » | — |

Vignette : les deux filtres, texte « Identiques ? ». Légende : « Des filtres à huile qui se ressemblent peuvent
différer à l'intérieur : clapet anti-retour, filetage, pression d'ouverture du by-pass, média filtrant. Le bon filtre se
choisit à partir du véhicule. Sélectionnez votre motorisation sur AutoMecanik. Conseil informatif ; Fafa est un mécano
IA. » Mesure : sessions C2 sur R1 (GA4).

Dépendances : deux filtres d'aspect proche ; filtre en coupe ou schéma ; composition de comparaison.

### 7.3 C3 — « À quoi servent les clapets d'un filtre vissé ? »

Destination : R3 (200). Sources : fiche WIKI, Fonctionnement (admis, Filtron).

| Temps | Voix | À l'écran | Démonstration |
|---|---|---|---|
| 0-3 s | « Dans ton filtre à huile vissé, il peut y avoir trois clapets. » | « 3 clapets possibles » | filtre en coupe |
| 3-8 s | « Moi c'est Fafa, le mécano IA d'AutoMecanik. Selon sa conception, ton filtre en a certains, pas forcément tous. » | « Selon la conception du filtre » | — |
| 8-16 s | « L'anti-retour garde l'huile dans le filtre moteur arrêté, surtout s'il est monté couché ou tête en bas. » | « Anti-retour » | schéma animé, membrane |
| 16-25 s | « Le by-pass s'ouvre si le filtre est colmaté ou l'huile froide et épaisse : le moteur reste alimenté, même en huile non filtrée. » | « By-pass » | schéma animé, dérivation |
| 25-31 s | « L'anti-siphon garde le filtre plein : au démarrage, l'huile arrive vite au moteur. » | « Anti-siphon » | schéma animé |
| 31-35 s | « C'est pour ça qu'on le choisit par véhicule. Le détail est dans le guide AutoMecanik. » | « Le guide filtre à huile » | — |

Vignette : coupe du filtre, texte « 3 clapets, 3 rôles ». Légende : « Anti-retour, by-pass, anti-siphon : selon sa
conception, un filtre à huile vissé peut comporter ces trois clapets. Leur rôle en 35 secondes, et le guide complet sur
AutoMecanik. Conseil informatif ; Fafa est un mécano IA. » Mesure : sessions C3 sur R3 (GA4).

Dépendances : schéma du circuit et des clapets (WIKI `function_diagram` en DEFERRED) ; composition.

### 7.4 C4 — « Comment serrer un filtre vissé ? » (bloqué)

Destination : R3, après admission. Sources : MAHLE 09/2022 et WIX 02/2025, **non admises** (F-C2, F-C3, F-C4). Claims :
3 `procedure`. Le validateur ne retient que des preuves admissibles : ce script ne peut pas entrer dans un dossier
`scripts/draft/` avant admission.

Révision 3 : l'interdiction générale de serrer à l'outil est retirée. La notice imprimée sur le filtre de la photo
d'usage (en japonais) demande au contraire 3/4 de tour avec un outil dédié : la règle « à la main, jamais à l'outil »
vaut pour le fabricant qui l'écrit, pas pour tous les filtres (F-C2, `integration/candidats.json`). Le court porte
désormais sur l'instruction du fabricant du filtre.

| Temps | Voix | À l'écran | Démonstration |
|---|---|---|---|
| 0-3 s | « Ton filtre à huile vissé ne se serre pas au hasard. » | « Serrage : selon le filtre » | filtre neuf, joint visible (P-01) |
| 3-8 s | « Moi c'est Fafa, le mécano IA d'AutoMecanik. » | — | — |
| 8-15 s | « Avant de monter le neuf, vérifie que l'ancien joint n'est pas resté en place, et huile le joint neuf avec de l'huile moteur propre. » | « Ancien joint retiré » · « Joint neuf huilé » | P-08, puis P-07 |
| 15-23 s | « Visse jusqu'au contact du joint, puis serre comme l'indique le fabricant du filtre : le nombre de tours et la façon de serrer dépendent du filtre. » | « Serrage : instruction du filtre » | main qui visse (S-03) |
| 23-27 s | « Trop serré ou avec un outil inadapté, son revêtement peut s'abîmer, rouiller, puis fuir. » | « Revêtement abîmé → fuite » | — |
| 27-30 s | « Suis toujours les instructions de ton constructeur. Le détail est dans le guide AutoMecanik. » | « Le guide filtre à huile » | — |

Vignette, légende et mesure : à rédiger après admission. Dépendances : admission de F-C2 à F-C4 ; validation humaine
des 3 claims ; prises de vue de mains ; pictogrammes.

## 8. Correspondance pages et vidéos

| Page | Rôle | Vidéo qui y mène | Vidéo à y intégrer (proposition) |
|---|---|---|---|
| R1 `/pieces/filtre-a-huile-7.html` | sélectionner le véhicule | V1, C2 | aucune : R1 reste un routeur |
| R3 `/blog-pieces-auto/conseils/filtre-a-huile` | quand et comment remplacer | C3, C4 (après admission) | V1 en tête de S1 ; C3 en S1 ; C4 en S4_REPOSE après admission |
| `/diagnostic-auto` | orienter avant achat | C1 | — |
| R4 `/reference-auto/filtre-a-huile` | définir la pièce | — | C3 envisageable après correction de R4 (AUDIT § 8.4) |

Intégrer une vidéo à une page suppose un rendu vérifié, l'approbation de publication de l'owner et un emplacement
prévu par le gabarit de la page : aucun n'existe aujourd'hui.
