# R4 — Glossaire "Références Auto" : Brief Contenu

> **Objectif :** Enlever toute ambiguïté quand on parle d'une référence pièce auto.
> Ce que c'est, d'où ça vient, à quoi ça sert, et ce qui peut la rendre "fausse" ou "incompatible".
>
> **Route cible :** `/reference-auto/glossaire-references` (page hub)
> **Rôle SEO :** R4 — RÉFÉRENCE (sous-type : glossaire transversal)

---

## Bloc 1 — Types de références (le cœur)

### 1.1 Référence constructeur (OEM / OE)

- Code "officiel" attribué par le constructeur du véhicule (Renault, PSA, VW, Toyota…)
- Gravé sur la pièce d'origine ou listé dans le catalogue constructeur
- Format variable selon constructeur : PSA utilise des codes à 10 chiffres, VW des codes alphanumériques avec tirets
- C'est la **source de vérité** pour identifier une pièce exacte
- Exemple : `4249.34` (PSA) = disque de frein avant 283mm pour Peugeot 307

### 1.2 Référence équipementier (OES)

- Référence du fabricant qui fournit le constructeur en 1ère monte (ex : ATE, Valeo, Bosch, Sachs)
- Souvent différente de l'OEM car l'équipementier a son propre catalogue
- La pièce est **physiquement identique** à celle montée en usine
- Exemple : Bosch `0 986 478 868` = même disque que l'OEM PSA `4249.34`
- L'OES est souvent 20-40% moins cher que la pièce achetée "chez le constructeur" (même fabricant, pas de marge constructeur)

### 1.3 Référence aftermarket / IAM

- Référence "catalogue" d'un fabricant de pièces (TRW, Brembo, Febi Bilstein, SKF…)
- Pas forcément fournisseur de 1ère monte pour ce véhicule
- Qualité variable : certains IAM sont de qualité équivalente OE, d'autres sont des "entrées de gamme"
- Le lien avec l'OEM passe par un **cross-reference** (table d'équivalences)
- Exemple : TRW `DF4184` = équivalent du disque PSA `4249.34`

### 1.4 Référence distributeur / interne

- Code vendeur (ERP, SKU, ref boutique) propre à un revendeur
- Utile commercialement (gestion stock, commande) mais **pas technique**
- Ne permet PAS d'identifier la pièce physique sans table de correspondance
- Exemple : `AUT-DF-82-001` (ref interne AutoMecanik)
- **Ne JAMAIS utiliser comme critère de compatibilité**

### 1.5 Référence TecDoc / Article number

- Identifiant d'article dans la base de données TecDoc (standard européen)
- Combinaison : marque TecDoc + numéro article
- TecDoc fournit les liens véhicule ↔ pièce pré-validés
- Exemple : TecDoc article `478868` marque `BOSCH`
- Fiabilité élevée quand le lien type mine ↔ article est vérifié

### 1.6 Références de recherche (variantes client)

- Ce que le client tape réellement dans la barre de recherche
- Avec espaces, tirets, erreurs, anciennes refs, formats mélangés
- Exemples : `0986478868`, `0 986 478 868`, `986478868`, `bosch 478868`
- Le moteur de recherche doit normaliser et matcher malgré les variantes
- Les supersessions (anciennes refs) doivent aussi matcher

### Hiérarchie de confiance

Du plus fiable au moins fiable :

```
VIN/immatriculation → OEM constructeur → OES équipementier → IAM (cross vérifié TecDoc)
  → IAM (catalogue seul) → Distributeur/SKU → Recherche client (à normaliser)
```

**Règle d'or :** Toujours remonter au niveau le plus haut possible avant de confirmer une compatibilité. Une ref IAM seule ne suffit pas — il faut vérifier le cross avec l'OEM ou le lien TecDoc/type mine.

---

## Bloc 2 — Notions d'équivalence (ce que les gens confondent)

### 2.1 Cross-reference / Équivalence

- Lien entre références de sources différentes : OEM ↔ OES ↔ IAM
- Signifie : "ces références désignent la même pièce physique"
- Un cross peut être **bidirectionnel** (A = B) ou **unidirectionnel** (A est remplacé par B)
- Source : bases TecDoc, catalogues fabricants, tables internes
- **Attention :** un cross n'est pas toujours exact à 100% — des variantes mineures peuvent exister (coating, finition)

### 2.2 Supersession / Remplacement

- Une référence remplacée par une nouvelle : l'ancienne n'est plus fabriquée
- Format : ancienne → nouvelle
- **Supersession chaînée :** A → B → C (courant chez PSA, Renault)
  - Le client cherche la ref A (gravée sur sa vieille pièce)
  - Le catalogue ne montre que C (ref actuelle)
  - Sans la chaîne complète, il croit que la pièce n'existe plus
- La supersession peut impliquer une modification technique (nouvelle version améliorée) ou juste un changement de codification

### 2.3 Kit vs Composant

- Une référence peut désigner un kit (ensemble) ou une pièce seule
- Exemple : "kit embrayage" = disque + mécanisme + butée vs "disque embrayage" = juste le disque
- Le client qui cherche "embrayage" peut vouloir l'un ou l'autre
- Le prix et la compatibilité changent drastiquement entre kit et composant
- **Règle :** toujours préciser si la ref est un kit ou un composant dans la fiche produit

### 2.4 Position / Côté / Sens

- Une même pièce peut exister en version gauche/droite, avant/arrière, intérieur/extérieur
- La ref change selon la position même si la pièce "se ressemble"
- Exemples :
  - Disque avant ≠ Disque arrière (diamètre, épaisseur, ventilation)
  - Roulement intérieur ≠ Roulement extérieur (dimensions)
  - Feu arrière gauche ≠ Feu arrière droit (miroir)
- **Piège fréquent :** le client commande "un disque" sans préciser l'essieu

### 2.5 Version / Finition / Motorisation

- Même modèle de véhicule ≠ mêmes pièces
- Une Peugeot 308 1.6 HDI n'a pas les mêmes disques qu'une 308 2.0 HDI
- Les facteurs qui changent la pièce :
  - Motorisation (puissance, couple → dimensionnement freins)
  - Finition / pack options (pack sport = disques plus gros)
  - Phase de production (phase 1 vs phase 2 = modifications techniques)
  - Code PR / code option (VW/Audi : le code PR change le diamètre de disque)
- **C'est pourquoi le sélecteur véhicule demande la motorisation exacte, pas juste le modèle**

---

## Bloc 3 — Preuves de compatibilité

### 3 niveaux de fiabilité

| Niveau | Nom | Source | Fiabilité | Usage |
|--------|-----|--------|-----------|-------|
| 1 | **Vérifié constructeur** | VIN + base OEM constructeur | ~99% | Meilleure garantie, mais VIN pas toujours disponible |
| 2 | **Vérifié TecDoc/cross** | Cross OEM↔IAM + type mine/KBA | ~95% | Standard du marché, couvre la majorité des cas |
| 3 | **Probable** | Dimensions + période + modèle (sans type mine exact) | ~80% | Quand les données précises manquent — **signaler le risque** |

### Données de compatibilité par source

#### VIN / Immatriculation (Niveau 1)

- Méthode la plus fiable : le VIN encode constructeur, modèle, motorisation, année, options
- L'immatriculation française permet de retrouver le type mine via le SIV
- **Limite :** certaines options (pack sport) ne sont pas encodées dans le VIN

#### Type mine / KBA / PR codes (Niveau 2)

- **Type mine** (France) : code CNIT qui identifie précisément la variante
- **KBA** (Allemagne) : Kraftfahrt-Bundesamt, même rôle que le type mine
- **Codes PR** (VW/Audi) : codes option sur l'étiquette du coffre, changent la pièce
  - Exemple : PR code `1LJ` = disques 288mm, `1ZD` = disques 312mm
- Ces codes sont les **vrais discriminants** — plus fiables que le modèle seul

#### Données techniques (dimensions)

- Diamètre disque (mm), épaisseur (mm), nombre de trous, entraxe (mm)
- Type : ventilé/plein, avec/sans moyeu, avec/sans bague ABS
- Les dimensions confirment ou infirment une compatibilité supposée
- **Attention :** 2 pièces de mêmes dimensions ne sont PAS forcément interchangeables (fixation, offset)

#### Période de production (from–to)

- Un véhicule produit de 2005 à 2012 peut avoir changé de disques en 2008 (restylage)
- La date exacte de fabrication (mois/année) peut changer la pièce
- Format TecDoc : `from: 2005.01, to: 2008.06`

#### Montage d'origine vs Montage possible

- "Peut se monter" ≠ "Montage exact d'origine"
- Un disque de 288mm peut physiquement se monter sur un véhicule prévu pour 312mm... mais c'est dangereux
- **Règle :** ne recommander QUE le montage d'origine sauf demande explicite du client

---

## Bloc 4 — Pièges et erreurs classiques (anti-retours)

### 4.1 OEM "partagé" sur plusieurs véhicules

- Une même ref OEM peut équiper plusieurs véhicules de marques différentes (plateformes communes)
- Exemple : PSA/Fiat/Toyota partagent des plateformes → mêmes freins
- **Piège :** le client voit "compatible Peugeot" et assume que ça va sur TOUTE Peugeot — non, c'est limité aux modèles de cette plateforme

### 4.2 Références "marketing" ou "génériques"

- Certaines refs sont des "gammes" (ex: "plaquettes freinage sport") sans précision véhicule
- Pas assez précises pour commander → risque élevé d'incompatibilité
- **Règle :** toujours vérifier le lien ref → type mine avant de valider

### 4.3 Confusion référence ≠ spécification

- "288 mm" n'est PAS une référence, c'est une dimension
- "Ventilé" n'est PAS une référence, c'est un type
- "Bosch" n'est PAS une référence, c'est une marque
- Une référence = un code unique qui identifie UNE pièce précise chez UN fabricant
- Le client qui tape "disque 288mm ventilé" donne des specs, pas une ref

### 4.4 Confusion compatibilité ≠ équivalence

- **Compatibilité** = "cette pièce se monte sur ce véhicule"
- **Équivalence** = "cette pièce est identique à cette autre pièce"
- Deux pièces compatibles avec le même véhicule ne sont PAS forcément équivalentes entre elles (qualité, performance, homologation)

### 4.5 Référence "ressemblante" — erreur d'1 digit

- Bosch `0 986 478 868` vs `0 986 478 869` — 1 chiffre de différence = essieu différent
- Le client copie manuellement la ref et se trompe d'1 caractère
- **Impact :** pièce non montable, retour + ré-expédition
- **Solution :** validation par véhicule en plus de la ref, ou checksum sur les refs longues

### 4.6 "Universel" vs "Véhicule-spécifique"

- Certaines pièces sont quasi-universelles (ampoules H7, filtres habitacle standard, fusibles)
- D'autres sont **strictement véhicule-spécifique** (disques, plaquettes, embrayage, suspension)
- Le client qui a l'habitude de commander des ampoules "sans vérifier" projette cette logique sur des pièces spécifiques → erreur garantie
- **Règle :** sur les pièces spécifiques, toujours forcer le passage par le sélecteur véhicule

### 4.7 Données incomplètes

- Manque le code PR → mauvais diamètre de disque sur VW/Audi
- Manque le diamètre exact → confusion entre 2 variantes du même modèle
- Manque l'année/phase → pièce de phase 1 commandée pour phase 2
- **Règle :** quand une donnée critique manque, afficher un avertissement plutôt que de deviner

### 4.8 Supersession non documentée

- Le client a une vieille ref gravée sur sa pièce usée (ref de 2008)
- Cette ref a été supersédée 2 fois (A → B → C)
- Si la chaîne de supersession est incomplète dans la base, la recherche retourne "ref inconnue"
- **Impact :** le client croit que la pièce n'existe plus ou quitte le site
- **Solution :** maintenir les chaînes de supersession dans le cross-reference

---

## Structure HTML recommandée

### Option C — Hub + intégration dans les fiches R4

1. **Page hub** `/reference-auto/glossaire-references` : explique tous les concepts (cette spec)
2. **Chaque fiche R4** utilise les concepts en contexte :
   - Section "Confusions courantes" cite les types de refs concernés
   - Section "Règles métier" intègre les pièges spécifiques à la pièce
   - Lien vers le glossaire pour les détails

### Sections de la page hub

```
H1: Références pièces auto : comprendre OEM, OES, IAM et compatibilités

H2: Les types de références (§1.1 à §1.6)
  H3: Référence constructeur (OEM)
  H3: Référence équipementier (OES)
  H3: Référence aftermarket (IAM)
  H3: Référence distributeur
  H3: Référence TecDoc
  H3: Variantes de recherche
  → Tableau récapitulatif + hiérarchie de confiance

H2: Équivalences et confusions (§2.1 à §2.5)
  H3: Cross-reference
  H3: Supersession et remplacement
  H3: Kit vs composant
  H3: Position et côté
  H3: Version et motorisation

H2: Comment vérifier une compatibilité (§3)
  H3: Niveau 1 — Vérifié constructeur (VIN)
  H3: Niveau 2 — Vérifié TecDoc
  H3: Niveau 3 — Compatibilité probable
  → Tableau des 3 niveaux

H2: Erreurs classiques à éviter (§4.1 à §4.8)
  → Liste numérotée avec icônes ⚠️
```

### JSON-LD

```json
{
  "@type": "DefinedTermSet",
  "name": "Glossaire des références pièces automobiles",
  "description": "Types de références (OEM, OES, IAM), équivalences, compatibilité et erreurs courantes",
  "hasDefinedTerm": [
    { "@type": "DefinedTerm", "name": "Référence OEM", "description": "..." },
    { "@type": "DefinedTerm", "name": "Cross-reference", "description": "..." }
  ]
}
```
