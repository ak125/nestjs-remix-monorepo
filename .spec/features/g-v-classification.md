# Cahier des Charges : Système de Classement par Niveaux (G + V)

## Résumé Exécutif

Système de classification automatique des gammes et véhicules par niveau SEO, basé sur les données de recherche Google, pour optimiser le catalogue de pièces automobiles.

**Stack technique :** n8n (no-code) + Google Sheets + API Google (Autosuggest + Keyword Planner)

### DOUBLE SYSTÈME DE CLASSIFICATION

| Système | Cible | Niveaux | Description |
|---------|-------|---------|-------------|
| **Système G** | GAMMES (familles de pièces) | G1, G2, G3, G4 | Classification des produits |
| **Système V** | VÉHICULES | V1, V2, V3, V4, V5 | Classification des motorisations |

```
┌─────────────────────────────────────────────────────────────┐
│  SYSTÈME G (Gammes)          │  SYSTÈME V (Véhicules)       │
│  ─────────────────          │  ─────────────────────       │
│  G1 = Gammes prioritaires   │  V1 = Variante dominante     │
│  G2 = Gammes secondaires    │  V2 = Champion #1 gamme      │
│  G3 = Gammes enfants        │  V3 = Challengers            │
│  G4 = Gammes catalogue-only │  V4 = Variantes non rech.    │
│                             │  V5 = Bloc B (véh→pièces)    │
└─────────────────────────────────────────────────────────────┘
```

### BONUS : Combinaison V4 + G

Pour les véhicules **V4** (non recherchés pour une gamme), on ajoute le niveau G pour affiner :

| Combinaison | Signification | Exemple |
|-------------|---------------|---------|
| **V4 + G1** | Véhicule non recherché, mais gamme importante | Clio 1.4 i → bougie/bobine |
| **V4 + G2** | Véhicule non recherché, gamme secondaire | Clio 1.4 i → accessoires rares |

---

## 1. Principes Fondamentaux

### Deux Axes de Recherche Distincts

```
┌──────────────────────────────────────────────────────────────┐
│  BLOC A : Axe "GAMME → VÉHICULES"                           │
│                                                              │
│  Recherche Google : "filtre huile clio 3 1.5 dci"           │
│                      ──────────── ──────────────            │
│                         gamme        véhicule               │
│                                                              │
│  → Produit : V2 (puis V1/V3 si groupe moteur)               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  BLOC B : Axe "VÉHICULE → PIÈCES"                           │
│                                                              │
│  Recherche Google : "clio 3 1.4 i bougie"                   │
│                      ────────────  ──────                   │
│                        véhicule    pièce                    │
│                                                              │
│  → Produit : V5 (recherche inverse véhicule → pièce)        │
└──────────────────────────────────────────────────────────────┘
```

### Règle Critique

**V2 ≠ Tout le catalogue**

- Un véhicule est V2 **uniquement** s'il est recherché sur Google avec la gamme
- Si le couple [gamme + véhicule] n'est jamais tapé → ce véhicule **n'est PAS V2** pour cette gamme
- V4 ne passe **JAMAIS** par V2 — c'est une catégorie parallèle

---

## 2. Architecture des Niveaux

### Vue d'Ensemble (Système V - Véhicules)

```
                    UNIVERS DE DÉPART
                    (tous véhicules DB)
                           │
        ┌──────────────────┴──────────────────┐
        │                                      │
   BLOC A                                 BLOC B
   (gamme → véhicule)                     (véhicule → pièce)
        │                                      │
        ▼                                      ▼
┌───────────────────┐                 ┌───────────────────┐
│       V2          │                 │       V5          │
│ (trouvé via       │                 │ (recherche        │
│  "gamme+véhicule")│                 │  "véhicule+pièce")│
└─────────┬─────────┘                 │  → G1 par défaut  │
          │                           └───────────────────┘
    Analyse groupes
    moteur
          │
    ┌─────┴─────┐
    │           │
Groupe 2+    Groupe 1
    │           │
┌───┴───┐       │
│       │       │
V1      V3    reste V2
(champion) (variantes) (seul)
```

### Définition des Niveaux Véhicules (Système V)

> **Note :** Cette section décrit le **Système V** (véhicules). Voir Section 3 pour le **Système N** (gammes).

| Niveau V | Source | Définition | Exemple |
|----------|--------|------------|---------|
| **V1** | Bloc A | Variante dominante du modèle (inter-gammes) | Clio 3 1.5 dCi 90cv |
| **V2** | Bloc A | Champion #1 de la gamme (UNIQUE) | Clio 3 1.5 dCi 105cv (filtre) |
| **V3** | Bloc A | Challengers (recherchés mais pas #1) | Clio 3 1.5 dCi 86cv |
| **V4** | Bloc A | Sous-ensemble de V3 (challengers faibles) | Break, BVA, 65cv |
| **V5** | Bloc B | Recherche "véhicule + pièce" → G1 par défaut | Clio 3 1.4 i |

### Points Critiques

- **V1, V2, V3, V4** = Bloc A (gamme → véhicule)
- **V5** = Bloc B (véhicule → pièces) — recherche inverse, G1 par défaut
- Le niveau V est **PAR GAMME + ÉNERGIE** (un véhicule peut être V1 pour "filtre huile diesel" et V3 pour "embrayage diesel")
- **Essence et Diesel ne se mélangent JAMAIS** dans les calculs V1/V2

---

## 3. Système G (Classification des Gammes)

### Définition des Niveaux G

| Code | Signification | Exemple |
|------|---------------|---------|
| **G1** | Gamme prioritaire (top entretien / SEO) | Filtre, Plaquettes, Disques |
| **G2** | Gamme secondaire (recherches moyennes) | Sonde, Débitmètre, Silent bloc |
| **G3** | Gamme enfant (complément) | Accessoires frein, visserie, kits montage |
| **G4** | Gamme catalogue-only | Clips injection, bagues rares |

### Critères Objectifs de Classification G

#### G1 = Gamme MAJEURE (valider 2 critères minimum)

| Critère | Seuil | Source |
|---------|-------|--------|
| **Volume Google** | ≥ 5 000 recherches/mois (FR) | Google Keyword Planner |
| **Couverture véhicules** | ≥ 90% des véhicules | Base catalogue |
| **Taux de conversion** | ≥ 2.5% | Analytics |
| **Fréquence d'achat** | < 50 000 km | Données métier |

**Règle :** Si une gamme valide **2 critères minimum** → **G1**

**Exemples G1 :** Filtre à huile, Plaquettes de frein, Disques, Kit distribution, Amortisseurs, Kit embrayage, Bougies, Bobines

#### G2 = Gamme SECONDAIRE

| Critère | Seuil |
|---------|-------|
| **Volume Google** | 200 – 5 000 recherches/mois |
| **Couverture véhicules** | Large mais peu achetée |
| **Entretien** | Occasionnel |
| **Conversion** | Correcte mais pas dominante |

**Définition :** Tout ce qui est utile et recherché, mais pas universel.

**Exemples G2 :** Sonde lambda, Silent bloc, Débitmètre, Relais, Capteur ABS, Rotule de direction

#### G3 = Gamme ENFANT (dépendante)

| Critère | Règle |
|---------|-------|
| **Dépendance** | Toujours rattachée à une G1 ou G2 |
| **Recherche seule** | JAMAIS |
| **Recherche associée** | TOUJOURS avec gamme parent |
| **SQL** | `parent_gamme_id` obligatoire |

**Règle directe :** Si la gamme n'est JAMAIS recherchée seule, mais TOUJOURS avec une autre → **G3**

**Exemples G3 avec parent :**

| G3 (Enfant) | Parent |
|-------------|--------|
| Kits accessoires de frein | Plaquettes (G1) |
| Visserie amortisseur | Amortisseurs (G1) |
| Joints vidange | Filtre à huile (G1) |
| Kit montage plaquettes | Plaquettes (G1) |
| Visserie embrayage | Embrayage (G1) |

#### G4 = Gamme CATALOGUE-ONLY (OEM)

| Critère | Règle |
|---------|-------|
| **Volume Google** | 0 (aucune recherche) |
| **Source** | Éclatés véhicule uniquement |
| **Spécificité** | Ultra-spécifique |
| **Compatibilité** | 1 à 5 modèles maximum |

**Définition :** 100% catalogue constructeur.

**Exemples G4 :** Bague EPC, Clip support injecteur, Pièces éclatés spécifiques, Références rares

### Algorithme de Classification G

```
POUR chaque gamme:

    # Étape 1 : Vérifier G3 (enfant)
    SI recherche_seule = FALSE AND recherche_avec_parent = TRUE:
        → G3 (définir parent_gamme_id)
        FIN

    # Étape 2 : Vérifier G4 (catalogue-only)
    SI google_volume = 0 AND source = 'eclate_oem':
        → G4
        FIN

    # Étape 3 : Vérifier G1 (majeure)
    criteres_valides = 0
    SI google_volume >= 5000: criteres_valides++
    SI couverture_vehicules >= 90%: criteres_valides++
    SI taux_conversion >= 2.5%: criteres_valides++
    SI frequence_achat < 50000km: criteres_valides++

    SI criteres_valides >= 2:
        → G1
    SINON:
        → G2 (par défaut)
```

### Hiérarchie G Complète

```
┌─────────────────────────────────────────────────────────────┐
│  G1 = Gamme prioritaire (stable, structurante)              │
│  Ex: Filtre à huile, Plaquettes, Kit distribution           │
│                                                             │
│       ↓ Gammes complémentaires :                           │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  G2 = Gamme secondaire                               │  │
│  │  Ex: Sonde lambda, Débitmètre, Silent bloc          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│       ↓ Gammes enfants :                                   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  G3 = Gamme enfant (rattachée à G1/G2)              │  │
│  │  Ex: Kit montage plaquettes, Visserie embrayage     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│       ↓ Gammes catalogue uniquement :                      │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  G4 = Gamme catalogue-only (aucune recherche)        │  │
│  │  Ex: Clips, bagues rares, pièces éclatés            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### DOUBLE SYSTÈME : Gammes (G) + Véhicules (V)

**IMPORTANT :** Deux systèmes indépendants mais compatibles !

```
┌─────────────────────────────────────────────────────────────┐
│  SYSTÈME G (Gammes)          SYSTÈME V (Véhicules)          │
│  ─────────────────          ─────────────────────          │
│  G1 = Gammes prioritaires   V1 = Véhicule leader Google    │
│  G2 = Gammes secondaires    V2 = Véhicules recherchés      │
│  G3 = Gammes enfants        V3 = Variantes moteur          │
│  G4 = Gammes catalogue-only V4 = Véhicules non recherchés  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3bis. Système V (Niveaux Véhicules)

### Règle Fondamentale : Structure en 2 Blocs (V1-V4 + V5)

**IMPORTANT :** Les niveaux V sont organisés en **2 BLOCS** distincts.

```
BLOC A (gamme → véhicule) :
─────────────────────────
V1 = variante dominante du modèle (inter-gammes)
V2 = champion #1 de la gamme (UNIQUE)
V3 = challengers (recherchés mais pas #1)
V4 = sous-ensemble de V3 (challengers faibles)

BLOC B (véhicule → pièces) :
───────────────────────────
V5 = recherche "véhicule + pièce" → G1 par défaut
```

**V1 et V2** — Deux niveaux complémentaires avec scopes différents.

| Niveau | Définition | Bloc | Usage |
|--------|------------|------|-------|
| **V1** | Variante dominante du modèle (inter-gammes) | Bloc A | Canonical constructeur |
| **V2** | Champion #1 de la gamme (UNIQUE) | Bloc A | Canonical gamme |
| **V3** | Challengers (recherchés mais pas #1) | Bloc A | Page enrichie |
| **V4** | Sous-ensemble de V3 (challengers faibles) | Bloc A | SEO G2/G3/G4 |
| **V5** | Recherche véhicule → pièces | Bloc B | SEO G1 (défaut) |

### Règle : V2 PAR GAMME, V1 GLOBAL

**IMPORTANT :** V1 et V2 ont des scopes DIFFÉRENTS.

| Niveau | Scope | Explication |
|--------|-------|-------------|
| **V1** | GLOBAL (modèle + énergie) | FIXE pour toutes les gammes |
| **V2** | LOCAL (gamme + énergie) | Varie selon la gamme |
| **Clé primaire** | `(gamme_id, vehicle_id)` | Pour V2/V3/V4 |

**Exemple Clio 3 1.5 dCi (K9K) — V1 Diesel = 90cv (FIXE) :**

| Gamme | V2 (champion gamme) | V3 (challengers) |
|-------|---------------------|------------------|
| Plaquettes | 90cv ⭐ | 105cv, 86cv |
| Filtre à huile | 105cv ⭐ | 90cv, 86cv |
| Amortisseur | 86cv ⭐ | 90cv, 105cv |

**Pourquoi ?** Les internautes recherchent :
- "plaquettes clio 3 1.5 dci **90cv**" → V2 Plaquettes = 90cv
- "filtre huile clio 3 1.5 dci **105cv**" → V2 Filtre = 105cv

→ Le **V2** reflète la réalité des recherches Google **par gamme**.
→ Le **V1** est la variante la plus souvent V2 (90cv = V1 car plus fréquent).

---

### Règle de Calcul V2/V3/V4 puis V1

**Principe :** V2 est déterminé EN PREMIER par gamme, puis V1 émerge des répétitions inter-gammes.

| Étape | Action |
|-------|--------|
| **1** | Pour chaque gamme : Collecter volumes [pièce + véhicule] |
| **2** | Position #1 = **V2** (champion unique de la gamme) |
| **3** | Positions #2, #3, #4... = **V3** (challengers) |
| **4** | Variantes à 0 recherches = **V4** |
| **5** | V1 = variante la plus souvent V2 inter-gammes |

**Exemple : PLAQUETTES DE FREIN (K9K)**

**Étape 1-4 : Classification par volume Google [pièce + véhicule]**

| Variante | Recherches/mois | Position | Niveau |
|----------|-----------------|----------|--------|
| 90cv | 1200 | #1 | **V2** ⭐ |
| 86cv | 480 | #2 | V3 |
| 105cv | 200 | #3 | V3 |
| 80cv | 0 | - | V4 |
| 65cv | 0 | - | V4 |
| 95cv | 0 | - | V4 |

**Étape 5 : Calcul V1 (inter-gammes)**

| Gamme | V2 pour cette gamme |
|-------|---------------------|
| Plaquettes | 90cv |
| Disques | 90cv |
| Amortisseurs | 86cv |
| Filtre huile | 105cv |
| Embrayage | 90cv |

**Comptage V2 :**
- 90cv = 3× V2 (Plaquettes, Disques, Embrayage)
- 105cv = 1× V2
- 86cv = 1× V2

→ **V1 Clio 3 Diesel = 90cv** (variante la plus souvent V2)

---

### Règle de Classement par Position (SANS décalage)

**Principe :** Les niveaux V2/V3/V4 sont des POSITIONS dans un classement, pas un système de "promotion/dégradation".

| Position | Niveau | Définition |
|----------|--------|------------|
| #1 | **V2** | Champion unique de la gamme |
| #2, #3, #4... | **V3** | Challengers (recherchés mais pas #1) |
| 0 recherches | **V4** | Variantes non recherchées |

**Logique de calcul :**

```
POUR chaque gamme + modèle + énergie:
    - Trier variantes par volume Google DESC
    - Position #1 = V2 (UNIQUE)
    - Positions #2+ = V3 (peuvent être plusieurs)
    - Variantes à 0 recherches = V4

ENSUITE (niveau GLOBAL):
    - V1 = variante la plus souvent V2 inter-gammes
```

**Exemple : PLAQUETTES DE FREIN Clio 3 Diesel**

| Variante | Volume Google | Position | Niveau |
|----------|---------------|----------|--------|
| 90cv | 1200 | #1 | **V2** ⭐ |
| 105cv | 480 | #2 | V3 |
| 86cv | 320 | #3 | V3 |
| 80cv | 0 | - | V4 |

**Important :** Il n'y a PAS de "décalage" ou de "promotion". Chaque recalcul repart de zéro avec les nouveaux volumes Google.

---

## ⭐ RÈGLES OFFICIELLES V1 / V2 / V3 / V4 (VERSION FINALE)

### Tableau Officiel des Niveaux V

| Niveau | Définition | Portée | Méthode de calcul | Exemple |
|--------|------------|--------|-------------------|---------|
| **V1** | Variante maîtresse du modèle | Global (model-level) | Variante qui apparaît le plus souvent comme V2 dans plusieurs gammes pour ce modèle | Clio 3 V1 = 1.5 dCi 90cv Diesel |
| **V2** | Variante dominante de la gamme (**UNIQUE**) | Local (gamme-level) | Variante #1 la plus recherchée Google (séparée Ess/Diesel) | Plaquettes Clio 3 V2 Diesel = 90cv |
| **V3** | Variantes recherchées mais pas #1 (challengers) | Local | Variantes #2, #3, #4... triées par volume Google | Clio 3 1.5 dCi 105cv (300 recherches) |
| **V4** | Variantes non recherchées OU déclinaisons (Break, BVA, 4x4) | Local | Tout ce qui n'est pas V2/V3 mais existe au catalogue — séparé Ess/Diesel | Break, utilitaire, 65cv, BVA, GPL... |
| **V5** | Variantes cataloguées hors V1-V4 (SEO G1) | Local | DANS catalogue, HORS V1/V2/V3/V4 | 1.4 LPG, 1.6 RS (variantes orphelines) |
| **Séparation Ess/Diesel** | Obligatoire | **TOUS les niveaux (V1→V5)** | Calcul séparé pour chaque énergie | V5 Diesel ≠ V5 Essence |

### Tableau Officiel par Gammes (Exemple Clio 3)

| Gamme | V2 Diesel | V2 Essence | V1 du modèle | Notes |
|-------|-----------|------------|--------------|-------|
| Plaquettes | 90cv | 1.2 16v | 90cv | Ok |
| Filtre à huile | 105cv | 1.4 16v | 90cv | Normal si V2 ≠ V1 |
| Amortisseurs | 86cv | 1.6 16v | 90cv | Ok |
| FAP | 105cv | N/A | 90cv | Seulement Diesel |
| Bougies | N/A | 1.2 16v | 1.2 16v Essence | Seulement Essence |

### 12 Règles Officielles Finales

```
1) La sélection du V2 (meilleure variante pour une gamme) doit toujours être faite
   séparément pour Essence et Diesel.

2) Le V2 = la variante la plus recherchée Google pour la gamme dans son énergie.
   → Une gamme ne peut JAMAIS avoir deux V2 pour un même modèle/énergie.
   → V2 est UNIQUE par gamme + modèle + énergie.

3) Le V1 n'est pas lié aux gammes mais au modèle :
       V1 = la variante qui apparaît le plus souvent comme V2
            dans différentes gammes du même modèle.

4) Un modèle peut avoir :
       V1 Clio 3 Diesel
       V1 Clio 3 Essence
       V1 Clio 4 Diesel
       V1 Clio 4 Essence
       etc.

5) Les niveaux secondaires sont :
       V3 = challengers (recherchés mais pas #1)
       V4 = challengers faibles de V3 (recherche faible)
       V5 = variantes DANS catalogue mais HORS hiérarchie V1-V4 (SEO G1)

6) Le V2 peut changer par gamme.
   Le V1 ne change que si la variante dominante change sur plusieurs gammes.

7) Le V1 ne dépend PAS des gammes,
   le V2 dépend TOUJOURS des gammes.

8) ⭐ RÈGLE V3 : Le V3 PEUT être recherché !
       → Toutes les variantes sont triées par volume de recherche
       → Variante #1 = V2 (unique champion)
       → Variantes #2, #3, #4... = V3 (même si recherchées)
       → Variantes à 0 recherches = V4

   🥇 V2 = champion (unique)
   🥈 V3 = challengers (recherchés mais pas gagnants)
   ❌ V4 = pas dans la course (0 recherches)

9) ⭐ RÈGLE V4 : V4 = SOUS-ENSEMBLE de V3 (Bloc A)
       V4 = challengers FAIBLES de V3 (recherche faible)
       → Fait partie de la hiérarchie Bloc A (gamme → véhicule)
       → Séparé Diesel / Essence comme V1, V2, V3
       → SEO : G2, G3, G4

   V4 Diesel = challengers faibles Diesel (sous-ensemble de V3)
   V4 Essence = challengers faibles Essence (sous-ensemble de V3)

10) ⭐ RÈGLE V5 : V5 = BLOC B (véhicule → pièces)
        V5 ≠ Bloc A (V1/V2/V3/V4)
        V5 = véhicules trouvés via recherche "véhicule + pièce"
        → Bloc B = axe inverse de Bloc A
        → Utilise G1 par défaut pour SEO
        → Séparé Diesel / Essence comme V1-V4

    STRUCTURE EN 2 BLOCS :
    ─────────────────────
    BLOC A (gamme → véhicule) : "bougie clio 3 1.4 i"
        → V1, V2, V3, V4

    BLOC B (véhicule → pièces) : "clio 3 1.4 i bougie"
        → V5 → G1 par défaut

    🥇 V2 = champion (unique) [Bloc A]
    🥈 V3 = challengers [Bloc A]
    ❌ V4 = sous-ensemble de V3 [Bloc A]
    📝 V5 = Bloc B (véhicule → pièces) → G1

11) ⭐ RÈGLE V1 SEUIL : V1 requiert une dominance significative
        V1 = variante V2 dans ≥ 30% des gammes principales (G1)
        OU variante V2 avec le plus de répétitions si aucune ≥ 30%

        Exemple : Clio 3 Diesel avec 10 gammes G1
        → 90cv est V2 dans 4 gammes (40%) → ✅ V1 = 90cv
        → Si aucune variante ≥ 30%, prendre celle avec le plus de répétitions V2

12) ⭐ RÈGLE V1 ÉGALITÉ : Départage en cas d'ex-aequo
        SI deux variantes ont le même nombre de répétitions V2 :
        → V1 = variante avec le volume Google TOTAL le plus élevé

        Exemple :
        - 90cv = V2 dans 3 gammes, volume total = 3500
        - 105cv = V2 dans 3 gammes, volume total = 2800
        → V1 = 90cv (volume total supérieur)
```

### Exemple : Classement par Volume de Recherche

**Gamme : Plaquettes — Clio 3 1.5 dCi**

| Variante | Recherches | Niveau | Explication |
|----------|------------|--------|-------------|
| 90cv | 1200 | **V2** | Champion unique |
| 105cv | 300 | V3 | Recherché mais pas #1 |
| 86cv | 150 | V3 | Recherché mais pas #1 |
| 80cv | 0 | V4 | Pas recherché |
| 65cv | 0 | V4 | Pas recherché |

**Gamme : Filtre à air — Clio 3 1.5 dCi**

| Variante | Recherches | Niveau | Explication |
|----------|------------|--------|-------------|
| 105cv | 500 | **V2** | Champion unique |
| 90cv | 300 | V3 | Recherché mais pas #1 |
| 86cv | 50 | V3 | Recherché mais pas #1 |

→ **JAMAIS deux V2** même si plusieurs variantes sont recherchées.

---

### Clarification V4 — TOUT LE RESTE

**V4 = variantes qui existent dans le catalogue mais ne sont pas recherchées**

Le V4 inclut pour chaque énergie :

| Type | Exemples V4 Diesel | Exemples V4 Essence |
|------|-------------------|---------------------|
| **Puissances rares** | 65cv, 80cv | 1.2 8v, 1.4 8v |
| **Carrosseries** | Break, utilitaire, 3 portes | Break, utilitaire |
| **Phases** | Phase 1, Phase 2 | Phase 1, Phase 2 |
| **Normes** | Euro 3, Euro 4, Euro 5 | Euro 3, Euro 4 |
| **Transmissions** | BVA automatique | BVA automatique |
| **Finitions** | GT, Dynamique, Authentique | RS (si non recherché) |
| **Variantes spéciales** | DCi références internes | GPL, Turbo rare |

**Schéma Final :**

```
🔵 DIESEL (ex : Clio 3 1.5 dCi)
V1 Diesel → variante dominante (90cv)
V2 Diesel → meilleure pour la gamme (105cv pour filtre)
V3 Diesel → recherchées mais non leaders (86cv)
V4 Diesel → TOUT le reste Diesel :
             - 65cv, 80cv
             - Break, utilitaire
             - BVA, Euro 3/4/5
             - Phase 1/2, finitions

🔴 ESSENCE (ex : Clio 3)
V1 Essence → variante dominante (1.2 16v)
V2 Essence → meilleure pour la gamme
V3 Essence → recherchées mais non leaders
V4 Essence → TOUT le reste Essence :
             - 1.2 8v, 1.4 8v, 1.6 8v
             - GPL, RS (si non recherché)
             - Break, 3 portes
             - BVA, finitions
```

**Pourquoi V4 existe :**
- ✔ Catalogue complet (compatibilité)
- ✔ SEO parfait (ne pas polluer les pages)
- ✔ Structure propre
- ✔ UX cohérente
- ✔ Logique algorithmique stable

---

### Clarification V5 — BLOC B (Véhicule → Pièces)

**V5 = véhicules trouvés via recherche "véhicule + pièce" (Bloc B)**

**STRUCTURE EN 2 BLOCS :**
```
┌─────────────────────────────────────────────────────────────┐
│  BLOC A : "gamme + véhicule"                                │
│  Exemple : "bougie clio 3 1.4 i"                            │
│  → V1, V2, V3, V4                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  BLOC B : "véhicule + pièce"                                │
│  Exemple : "clio 3 1.4 i bougie"                            │
│  → V5 → G1 par défaut                                       │
└─────────────────────────────────────────────────────────────┘
```

| Niveau | Bloc | Recherche | SEO |
|--------|------|-----------|-----|
| V3 | Bloc A | Gamme → Véhicule | Selon G |
| V4 | Bloc A | Gamme → Véhicule (sous-ensemble V3) | G2/G3/G4 |
| V5 | **Bloc B** | **Véhicule → Pièces** | **G1 défaut** |

**Pourquoi V5 existe :**
- ✔ Capturer les recherches Bloc B (véhicule → pièce)
- ✔ Créer du contenu SEO G1 automatiquement
- ✔ Couvrir les véhicules non trouvés via Bloc A
- ✔ Enrichir le silo technique G1

**Exemples V5 (Bloc B) :**
- "clio 3 1.4 i bougie" → V5 → G1
- "megane 2 1.5 dci filtre" → V5 → G1
- Recherches où véhicule est tapé AVANT la pièce

**Exemple — Clio 3 Essence :**

| Recherche | Bloc | Niveau |
|-----------|------|--------|
| "bougie clio 3 1.2 16v" | Bloc A | V3 |
| "bougie clio 3 1.4 16v" | Bloc A | V4 |
| "clio 3 1.4 LPG bougie" | **Bloc B** | **V5** → G1 |
| "clio 3 1.6 RS bougie" | **Bloc B** | **V5** → G1 |

**Schéma Final avec V5 :**

```
Modèle (ex : Clio 3)
│
├── BLOC A (gamme → véhicule)
│   ├── V1 : variante dominante
│   ├── V2 : champion #1 (unique)
│   ├── V3 : challengers
│   └── V4 : sous-ensemble de V3
│
└── BLOC B (véhicule → pièces)
    └── V5 : recherche inverse → G1 par défaut
```

---

### Règle Finale : 2 Types de Niveaux V (Global vs Local)

**IMPORTANT :** Il existe **2 types de niveaux V** avec des scopes différents :

| Type | Niveau | Scope | Définition |
|------|--------|-------|------------|
| **GLOBAL** | **V1** | MODÈLE + ÉNERGIE | Variante dominante du modèle, séparée Diesel/Essence |
| **LOCAL** | **V2** | GAMME + ÉNERGIE | Meilleure variante pour cette gamme, séparée Diesel/Essence |
| LOCAL | V3 | Moteur | Variantes recherchées mais pas #1 (challengers) |
| LOCAL | V4 | Catalogue | **TOUT LE RESTE** — séparé Diesel/Essence |
| LOCAL | V5 | Dans catalogue | Variantes cataloguées hors V1-V4 pour SEO G1 |

**IMPORTANT :** V1 et V2 sont TOUJOURS séparés par énergie (Essence / Diesel). Pas de mélange.

**Note :** Chaque modèle a **2 V1 : un pour Diesel, un pour Essence**.

---

### V1 = Niveau MODÈLE + ÉNERGIE (Global par modèle)

**Principe :** Le V1 est la variante la plus représentative d'un **MODÈLE pour une ÉNERGIE donnée** (Diesel OU Essence), déterminée par la fréquence de répétition comme V2 dans plusieurs gammes.

| Caractéristique | Description |
|-----------------|-------------|
| **Scope** | Par modèle + énergie (Clio 3 Diesel, Clio 3 Essence, Megane 3 Diesel...) |
| **Stabilité** | FIXE pour toutes les gammes du modèle (par énergie) |
| **Calcul** | Variante qui revient le plus souvent comme V2 (séparé Diesel/Essence) |
| **Usage** | Marketing, SEO modèle, pages piliers |

**RÈGLE FONDAMENTALE : Séparation Essence / Diesel**

| Raison | Explication |
|--------|-------------|
| **Recherches différentes** | "plaquettes clio 3 1.5 dci" ≠ "plaquettes clio 3 1.2 16v" |
| **Volumes différents** | Diesel domine en France, mais pas sur toutes les gammes |
| **Gammes spécifiques** | FAP = diesel seul, Bougies = essence seul |
| **Pièces différentes** | Injecteurs essence ≠ injecteurs diesel |

**Formule de détermination V1 :**

```
POUR chaque modèle M:
    POUR chaque énergie E (Diesel, Essence):
        1. Pour chaque gamme G applicable à E : Identifier V2_G_E (variante la plus recherchée)
        2. Compter les occurrences de chaque variante dans tous les V2_G_E
        3. La variante la plus fréquente (max occurrences) → V1_M_E
        4. Ce V1 est FIXE pour TOUTES les gammes du modèle pour cette énergie

IMPORTANT : Les variantes Essence et Diesel ne doivent JAMAIS se mélanger.
```

**Exemples de V1 par modèle + énergie (Renault) :**

| Modèle | V1 DIESEL | V1 ESSENCE |
|--------|-----------|------------|
| **Clio 3** | 1.5 dCi 90cv | 1.2 16v |
| **Clio 4** | 1.5 dCi 90cv | 0.9 TCe 90cv |
| **Megane 2** | 1.5 dCi 105cv | 1.6 16v |
| **Megane 3** | 1.5 dCi 110cv | 1.6 16v |
| **Scenic 2** | 1.5 dCi 105cv | 1.6 16v |
| **Laguna** | 2.0 dCi 150cv | 2.0 16v |

**Calcul du V1 pour Clio 3 (séparé par énergie) :**

**DIESEL (K9K) — Étape 1 : Collecter les V2 de chaque gamme diesel**

| Gamme | V2 Diesel (meilleure variante diesel) |
|-------|--------------------------------------|
| Plaquettes | 1.5 dCi 90cv |
| Filtre à huile | 1.5 dCi 105cv |
| Amortisseurs | 1.5 dCi 86cv |
| Disques | 1.5 dCi 90cv |
| Embrayage | 1.5 dCi 90cv |
| Courroie | 1.5 dCi 90cv |
| **FAP** | 1.5 dCi 105cv ⚠️ Diesel seul |
| **EGR** | 1.5 dCi 90cv ⚠️ Diesel seul |

**DIESEL — Étape 2 : Compter les occurrences**

| Variante Diesel | Occurrences comme V2 |
|-----------------|---------------------|
| **1.5 dCi 90cv** | 5× (Plaquettes, Disques, Embrayage, Courroie, EGR) |
| 1.5 dCi 105cv | 2× (Filtre huile, FAP) |
| 1.5 dCi 86cv | 1× (Amortisseurs) |

→ **V1 Clio 3 DIESEL = 1.5 dCi 90cv**

---

**ESSENCE (D4F, K4M) — Étape 1 : Collecter les V2 de chaque gamme essence**

| Gamme | V2 Essence (meilleure variante essence) |
|-------|----------------------------------------|
| Plaquettes | 1.2 16v |
| Filtre à huile | 1.4 16v |
| Amortisseurs | 1.2 16v |
| Disques | 1.2 16v |
| **Bougies** | 1.4 16v ⚠️ Essence seul |
| **Bobines** | 1.2 16v ⚠️ Essence seul |

**ESSENCE — Étape 2 : Compter les occurrences**

| Variante Essence | Occurrences comme V2 |
|------------------|---------------------|
| **1.2 16v** | 4× (Plaquettes, Amortisseurs, Disques, Bobines) |
| 1.4 16v | 2× (Filtre huile, Bougies) |

→ **V1 Clio 3 ESSENCE = 1.2 16v**

---

**Gammes spécifiques à une énergie :**

| Gamme | Énergie | Explication |
|-------|---------|-------------|
| **FAP** | Diesel seul | Filtre à particules n'existe pas en essence |
| **EGR** | Diesel seul | Vanne EGR principalement diesel |
| **Injecteur Common Rail** | Diesel seul | Technologie diesel |
| **Bougies d'allumage** | Essence seul | Le diesel n'a pas de bougies d'allumage |
| **Bobine d'allumage** | Essence seul | Le diesel n'a pas de bobines |
| Plaquettes, Filtres, Amortisseurs | Les deux | V2 calculé séparément par énergie |

---

### V2 = Niveau GAMME + ÉNERGIE (Local)

**Principe :** Le V2 est la variante la plus recherchée dans **UNE GAMME pour UNE ÉNERGIE donnée**. C'est dynamique et change selon le type de pièce, SÉPARÉMENT pour Diesel et Essence.

| Caractéristique | Description |
|-----------------|-------------|
| **Scope** | Par gamme + énergie (Plaquettes Diesel, Plaquettes Essence...) |
| **Stabilité** | DYNAMIQUE selon la gamme |
| **Calcul** | Variante avec le plus de recherches Google pour cette gamme (par énergie) |
| **Usage** | Canonical, pages gamme, SEO local |

**Règle de calcul V2 :**

```
Pour déterminer le V2 d'une gamme :
  1. Séparer d'abord les moteurs Essence et Diesel
  2. Calculer la variante dominante pour la gamme dans chaque énergie
  3. Si la gamme n'existe que pour une énergie (ex : FAP, bougies),
     ne calculer le V2 que pour cette énergie
  4. Les V2 Essence et V2 Diesel ne doivent JAMAIS se mélanger
```

**Exemple : Modèle Clio 3 par gamme + énergie**

| Gamme | V1 Diesel | V2 Diesel | V1 Essence | V2 Essence | Note |
|-------|-----------|-----------|------------|------------|------|
| **Plaquettes** | 90cv | 90cv | 1.2 16v | 1.2 16v | V1 = V2 ✅ |
| **Filtre huile** | 90cv | 105cv | 1.2 16v | 1.4 16v | V2 différent |
| **Amortisseurs** | 90cv | 86cv | 1.2 16v | 1.2 16v | V2 diesel différent |
| **Disques** | 90cv | 90cv | 1.2 16v | 1.2 16v | V1 = V2 ✅ |
| **FAP** | 90cv | 105cv | — | — | Diesel seul |
| **Bougies** | — | — | 1.2 16v | 1.4 16v | Essence seul |

**Observation :** Le V1 reste FIXE par modèle + énergie, mais le V2 change selon la gamme. Essence et Diesel sont TOUJOURS séparés.

---

### Règles Officielles V1 / V2

#### RÈGLE 1 — Définition V1

> Le V1 est la variante la plus représentative d'un **MODÈLE pour une ÉNERGIE donnée**, déterminée par la fréquence de répétition comme V2 dans plusieurs gammes.

#### RÈGLE 2 — Définition V2

> Le V2 est la variante la plus recherchée dans **UNE GAMME pour UNE ÉNERGIE donnée**.

#### RÈGLE 3 — Séparation des Scopes

> **V1 est GLOBAL (par modèle + énergie).**
> **V2 est LOCAL (par gamme + énergie).**

#### RÈGLE 4 — Séparation Essence / Diesel (FONDAMENTALE)

> **Essence et Diesel ne doivent JAMAIS se mélanger dans les calculs V1/V2.**
> - V1 Diesel et V1 Essence sont calculés SÉPARÉMENT
> - V2 Diesel et V2 Essence sont calculés SÉPARÉMENT
> - Les gammes spécifiques (FAP=diesel, Bougies=essence) n'ont qu'un seul V2

#### RÈGLE 5 — Transition V1

> Le V1 ne change QUE si une autre variante devient dominante dans la majorité des gammes du modèle (pour la même énergie).

---

### Avantages de ce Système

| Avantage | Explication |
|----------|-------------|
| **Marketing stable** | V1 = référence stable pour toutes les campagnes du modèle |
| **SEO modèle** | Pages piliers avec V1 fixe par modèle |
| **Pertinence locale** | V2 suit les recherches réelles par gamme |
| **Catalogue structuré** | V1 (modèle) → V2 (gamme) → V3 (variantes) → V4 (rares) |
| **UX cohérente** | La variante V1 revient partout pour un modèle = confiance client |

**Pseudocode algorithmique (avec séparation Essence/Diesel) :**

```
# ÉTAPE 1 : Déterminer V1 par MODÈLE + ÉNERGIE
POUR chaque modèle M:
    POUR chaque énergie E (Diesel, Essence):
        v2_counts = {}
        POUR chaque gamme G applicable à E:
            v2_local = get_most_searched_variant(M, G, E)
            v2_counts[v2_local] += 1
        V1_M_E = MAX(v2_counts, by=occurrences)

# ÉTAPE 2 : Appliquer V1 et V2 par gamme + énergie
POUR chaque modèle M:
    POUR chaque énergie E (Diesel, Essence):
        POUR chaque gamme G applicable à E:
            SET v_level(M, G, E, V1_M_E) = V1  # Global fixe par modèle+énergie
            v2_local = get_most_searched_variant(M, G, E)
            SI v2_local != V1_M_E:
                SET v_level(M, G, E, v2_local) = V2  # Local dynamique
            POUR chaque autre_variante de même énergie E:
                SI même moteur que V1 ou V2:
                    SET v_level = V3
                SINON:
                    SET v_level = V4

# NOTE : Essence et Diesel ne se mélangent JAMAIS
# FAP, EGR → Diesel seul (pas de V2 Essence)
# Bougies, Bobines → Essence seul (pas de V2 Diesel)
```

---

### Tableau Récapitulatif V1/V2/V3/V4

| Niveau | Scope | Définition | Stabilité | Usage |
|--------|-------|------------|-----------|-------|
| **V1** | **MODÈLE + ÉNERGIE** | Variante dominante (séparée Diesel/Essence) | FIXE | Marketing, SEO modèle |
| **V2** | **GAMME + ÉNERGIE** | Meilleure variante locale (séparée Diesel/Essence) | DYNAMIQUE | Pages gamme, canonical |
| **V3** | Moteur | Variantes techniques (même énergie) | Variable | Compatibilité, cross-sell |
| **V4** | - | Non recherchés | - | Catalogue interne |

**IMPORTANT :** V1 et V2 sont TOUJOURS séparés par énergie (Essence / Diesel). Pas de mélange.

**Visuel (avec séparation Essence/Diesel) :**

```
Constructeur : Renault
│
├── Modèle : Clio 3
│     │
│     ├── DIESEL (K9K)
│     │     ├── V1 Diesel = 1.5 dCi 90cv (dominant sur gammes diesel)
│     │     ├── V2(Plaquettes) = 90cv
│     │     ├── V2(Filtre huile) = 105cv
│     │     ├── V2(FAP) = 105cv ⚠️ diesel seul
│     │     ├── V3 = 65cv, 80cv, 86cv
│     │     └── V4 = variantes non recherchées
│     │
│     └── ESSENCE (D4F, K4M)
│           ├── V1 Essence = 1.2 16v (dominant sur gammes essence)
│           ├── V2(Plaquettes) = 1.2 16v
│           ├── V2(Bougies) = 1.4 16v ⚠️ essence seul
│           ├── V3 = 1.4 16v, 1.6 16v
│           └── V4 = variantes non recherchées
│
├── Modèle : Clio 4
│     ├── DIESEL → V1 Diesel = 1.5 dCi 90cv
│     └── ESSENCE → V1 Essence = 0.9 TCe 90cv
│
└── Modèle : Megane 3
      ├── DIESEL → V1 Diesel = 1.5 dCi 110cv
      └── ESSENCE → V1 Essence = 1.6 16v
```

→ Le système garantit **cohérence par modèle + énergie (V1)** + **pertinence locale par gamme + énergie (V2)**.
→ **Essence et Diesel ne se mélangent JAMAIS.**

---

### V1 — Véhicule Leader (Niveau MODÈLE + ÉNERGIE)

**Définition :**
- Variante dominante d'un **MODÈLE pour une ÉNERGIE donnée** (pas par gamme)
- Celle qui revient le plus souvent comme V2 dans plusieurs gammes (pour cette énergie)
- **DEUX V1 par modèle : un pour Diesel, un pour Essence**
- FIXE pour toutes les gammes du modèle (par énergie)
- **Essence et Diesel ne se mélangent JAMAIS**

**Exemples V1 par modèle + énergie (Renault) :**

| Modèle | V1 DIESEL | V1 ESSENCE |
|--------|-----------|------------|
| **Clio 3** | 1.5 dCi 90cv | 1.2 16v |
| **Clio 4** | 1.5 dCi 90cv | 0.9 TCe 90cv |
| **Megane 3** | 1.5 dCi 110cv | 1.6 16v |
| **Scenic 2** | 1.5 dCi 105cv | 1.6 16v |

**Rôle :**
- Pages SEO modèle (piliers) — séparées par énergie
- Référence marketing par modèle + énergie
- Base pour les exemples et compatibilités
- Pivot métier pour le modèle
- Stable dans le temps

### V2 — Variante Locale (Niveau GAMME + ÉNERGIE)

**Définition :**
- Variante la plus recherchée pour **UNE GAMME + UNE ÉNERGIE spécifique**
- Dynamique selon le type de pièce
- Peut être différente du V1
- **UN V2 par gamme par modèle PAR ÉNERGIE (Diesel/Essence séparés)**

**Exemple pour Clio 3 (séparé par énergie) :**

| Gamme | V1 Diesel | V2 Diesel | V1 Essence | V2 Essence |
|-------|-----------|-----------|------------|------------|
| Plaquettes | 90cv | 90cv | 1.2 16v | 1.2 16v |
| Filtre huile | 90cv | 105cv | 1.2 16v | 1.4 16v |
| Amortisseurs | 90cv | 86cv | 1.2 16v | 1.2 16v |
| FAP | 90cv | 105cv | — | — |
| Bougies | — | — | 1.2 16v | 1.4 16v |

**Rôle :**
- Canonical par gamme + énergie
- SEO pages gamme (local)
- Pertinence selon le type de pièce
- Suit les recherches Google réelles
- **Essence et Diesel ne se mélangent JAMAIS**

### V3 — Variantes Moteur/Techniques (Même Énergie)

**Définition :**
- Versions différentes du même moteur **de la même énergie**
- Mêmes références techniques
- Compatible métier
- Proches du V1 ou V2
- **Ne contient QUE des variantes de la même énergie** (Diesel OU Essence)

**Exemple pour V1 Diesel = Clio 3 1.5 dCi 90cv :**

| Véhicule | Niveau | Énergie |
|----------|--------|---------|
| Clio 3 1.5 dCi 86cv | **V3** | Diesel |
| Clio 3 1.5 dCi 105cv | **V3** | Diesel |
| Clio 3 1.5 dCi 65cv | **V3** | Diesel |

**Exemple pour V1 Essence = Clio 3 1.2 16v :**

| Véhicule | Niveau | Énergie |
|----------|--------|---------|
| Clio 3 1.4 16v | **V3** | Essence |
| Clio 3 1.6 16v | **V3** | Essence |

**Rôle :**
- Enrichir la compatibilité
- Convertir les variantes
- Structurer par moteur (par énergie)

### V4 — Véhicules Non Recherchés (pour cette gamme)

**Définition :**
- N'apparaît pas dans "Gamme + Véhicule"
- Peut apparaître dans "Véhicule + Pièce"
- Important pour profil entretien

**Exemple :**
| Véhicule | Non recherché pour | Recherché pour |
|----------|-------------------|----------------|
| Clio 3 1.4 i | filtre huile | bobine, bougie, capteur |

**Rôle :**
- Catalogue "entretien par véhicule"
- Blog, guides, entretien
- Long tail SEO

### V4 + G : Combinaison pour les fiches entretien

Pour les véhicules **V4** (non recherchés pour une gamme), on ajoute le niveau **G** pour affiner l'importance de la gamme dans la fiche entretien :

| Combinaison | Signification | Utilisation |
|-------------|---------------|-------------|
| **V4 + G1** | Véhicule non recherché, gamme importante | Mettre en avant dans fiche entretien |
| **V4 + G2** | Véhicule non recherché, gamme secondaire | Affichage minimal |

**Exemple concret :**
| Véhicule | Gamme | Combinaison | Action |
|----------|-------|-------------|--------|
| Clio 3 1.4 i | Bougies | V4 + G1 | Afficher en priorité dans fiche entretien |
| Clio 3 1.4 i | Bobine | V4 + G1 | Afficher en priorité dans fiche entretien |
| Clio 3 1.4 i | Clips injection | V4 + G2 | Affichage minimal |
| Nissan Note 1.2 | Filtre huile | V4 + G2 | Affichage minimal |

---

### Critères Objectifs de Classification V

#### V1 = Variante Dominante GLOBALE (modèle + énergie)

| Critère | Règle | Source |
|---------|-------|--------|
| **Définition** | Variante qui apparaît le plus souvent comme V2 inter-gammes | Calcul agrégé |
| **Scope** | GLOBAL — modèle + énergie (pas par gamme) | Inter-gammes |
| **Granularité** | Modèle + Énergie (Diesel/Essence) | Répétitions V2 |
| **Fixité** | **FIXE pour TOUTES les gammes** du modèle | Invariant |

**Règle :** V1 = la variante qui apparaît le plus souvent comme V2 (champion) dans plusieurs gammes.

**⚠️ IMPORTANT : V1 est GLOBAL et NE VARIE PAS selon la gamme !**

**Exemple V1 Clio 3 Diesel = 90cv (FIXE) :**

| Gamme | V2 (champion) | V1 du modèle |
|-------|---------------|--------------|
| Plaquettes de frein | 90cv ⭐ | 90cv |
| Filtre à huile | 105cv ⭐ | 90cv |
| Amortisseur | 86cv ⭐ | 90cv |
| Courroie accessoire | 90cv ⭐ | 90cv |

→ Le 90cv est V2 dans 2 gammes sur 4 → **V1 Clio 3 Diesel = 90cv** (fixe partout)

#### V2 = Champion #1 de la Gamme (UNIQUE)

| Critère | Règle |
|---------|-------|
| **Position** | #1 du classement Google pour la gamme |
| **Volume Google** | Le plus élevé pour cette gamme |
| **Unicité** | 1 seul V2 par gamme + modèle + énergie |

**Définition :** V2 = la variante la plus recherchée Google pour une gamme donnée. UNIQUE par gamme + modèle + énergie.

**Exemple pour moteur K9K (1.5 dCi) + Gamme "Plaquettes de frein" :**

| Position | Variante | Recherches/mois | Niveau |
|----------|----------|-----------------|--------|
| #1 | Clio 3 1.5 dCi **90cv** | 1200 | **V2** ⭐ (champion gamme) |
| #2 | Clio 3 1.5 dCi **86cv** | 480 | **V3** (challenger) |
| #3+ | 105cv, 80cv, 65cv | < 50 | V4 (challengers faibles) |

#### V3 = Positions #2, #3, #4... (recherchés mais pas #1)

| Critère | Règle |
|---------|-------|
| **Position** | #2, #3, #4... dans le classement Google |
| **Volume Google** | > 0 recherches/mois (recherché) |
| **Relation** | Motorisations recherchées mais pas champion |
| **Raison** | Car il ne peut y avoir qu'1 seul V2 par gamme |

**Règle directe :** Si la variante est en position #2, #3, #4... et a des recherches > 0 → **V3**

**Exemples V3 pour V2 = Clio 3 1.5 dCi 90cv (champion) :**
| Variante | Position | Recherches | Niveau |
|----------|----------|------------|--------|
| Clio 3 1.5 dCi 86cv | #2 | 480/mois | **V3** |
| Clio 3 1.5 dCi 105cv | #3 | 200/mois | **V3** |
| Clio 3 1.5 dCi 80cv | #4 | 100/mois | **V3** |

#### V4 = Variantes/déclinaisons de V3

| Critère | Règle |
|---------|-------|
| **Relation** | Déclinaison d'un moteur V3 |
| **Configuration** | Break, BVA, 4x4, etc. |
| **Moteur** | Même moteur que le V3 parent |

**Définition :** V4 = différentes configurations/déclinaisons d'un moteur V3 (Break, BVA, 4x4, utilitaire...)

**Exemples V4 (variantes du V3 = 1.5 dCi 110cv) :**
| Variante V4 | V3 parent | Configuration |
|-------------|-----------|---------------|
| 1.5 dCi 110cv **Break** | 1.5 dCi 110cv | Break |
| 1.5 dCi 110cv **BVA** | 1.5 dCi 110cv | Boîte auto |
| 1.5 dCi 110cv **4x4** | 1.5 dCi 110cv | 4 roues motrices |

### Algorithme de Classification V (Structure 2 Blocs)

```
# BLOC A : Pipeline "Gamme → Véhicules"
POUR chaque gamme G:
    POUR chaque énergie E (Diesel, Essence):

        # Étape 1 : Collecter toutes les variantes
        variantes = get_all_variants(gamme, energie)

        # Étape 2 : Trier par volume Google DESC
        variantes_triees = SORT(variantes, by=google_volume, DESC)

        # Étape 3 : Assigner les niveaux Bloc A
        SI position = 1:
            → V2 (champion #1 de la gamme)
        SINON SI volume > 0:
            → V3 (positions #2, #3, #4...)
        SINON:
            → V4 (variantes de V3)

# V1 = variante la plus souvent V2 (calculé inter-gammes par modèle)

# BLOC B : Pipeline "Véhicule → Pièces"
POUR chaque véhicule NON présent dans V1/V2/V3/V4:
    SI trouvé via "véhicule + pièce":
        → V5 (→ G1 par défaut)
```

**Formule officielle :**

```
BLOC A (gamme → véhicule) :
1) Trier les variantes par popularité Google (DESC)
2) Position #1 = V2 (champion unique, pas de seuil)
3) Positions #2+ recherchées = V3 (positions #2, #3, #4...)
4) Variantes de V3 = V4 (Break, BVA, 4x4...)
5) V1 = variante la plus souvent V2 inter-gammes

BLOC B (véhicule → pièces) :
6) Variantes hors V1-V4 via recherche inverse = V5 (→ G1)
```

### Tableau Récapitulatif Critères V (2 Blocs)

| Niveau | Définition | Bloc | Usage |
|--------|------------|------|-------|
| **V1** | Variante dominante du modèle (inter-gammes) | Bloc A | Canonical constructeur |
| **V2** | Champion #1 de la gamme (UNIQUE, pas de seuil) | Bloc A | Canonical gamme |
| **V3** | Positions #2, #3, #4... (recherchés mais pas #1) | Bloc A | Page enrichie |
| **V4** | Variantes/déclinaisons de V3 (Break, BVA, 4x4) | Bloc A | SEO G2/G3/G4 |
| **V5** | Recherche véhicule → pièces | Bloc B | SEO G1 (défaut) |

**Règle clé :** V1-V4 = Bloc A (gamme → véhicule), V5 = Bloc B (véhicule → pièces).

### Tableau Récapitulatif Double Système

| Gammes (G) | Description | Véhicules (V) | Description |
|------------|-------------|---------------|-------------|
| **G1** | Gammes prioritaires | **V1** | Variante dominante modèle |
| **G2** | Gammes secondaires | **V2** | Champion #1 gamme |
| **G3** | Gammes enfants | **V3** | Positions #2, #3, #4... |
| **G4** | Gammes catalogue-only | **V4** | Variantes de V3 |
|        |                       | **V5** | Bloc B → G1 défaut |

### Exemple Complet

**Gamme G1 : Filtre à huile**

| Véhicule | Niveau V | Explication |
|----------|----------|-------------|
| Clio 3 1.5 dCi 90cv | **V1** | Leader K9K |
| 208 1.6 HDi | **V1** | Leader DV6 |
| Golf 6 2.0 TDI | **V1** | Leader CFFB |
| Clio 4 1.5 dCi | **V2** | Recherché mais pas leader |
| Megane 3 1.5 dCi | **V2** | Recherché mais pas leader |
| Clio 3 1.5 dCi 86cv | **V3** | Variante K9K |
| Clio 3 1.4 i essence | **V4 + G1** | Non recherché, mais gamme importante |
| Nissan Note 1.2 | **V4 + G2** | Non recherché, gamme secondaire |

---

## 4. Règles de Classification Complètes (Système V)

### Algorithme

```
POUR chaque gamme:

    # BLOC A : Pipeline "Gamme → Véhicules"

    1. Collecter mots-clés Google "gamme + véhicule"
    2. Véhicules trouvés → V2
    3. Grouper V2 par famille moteur
    4. POUR chaque groupe:
         SI count > 1:
             champion (max volume, version exacte) → V1 + V2
             autres → V3
         SINON:
             reste V2 simple

    # BLOC B : Pipeline "Véhicule → Pièces"

    5. Véhicules catalogue NON présents dans V1/V2/V3/V4
    6. Collecter mots-clés Google "véhicule + pièce"
    7. Si trouvé → V5 (→ G1 par défaut)
    8. Pour chaque V5 → identifier pièces les plus demandées
```

### Tableau Récapitulatif (Véhicules)

| Situation | Niveau V | Action |
|-----------|----------|--------|
| Champion #1 de la gamme | **V2** | Canonical gamme (Bloc A) |
| Variante dominante du modèle | **V1** | Canonical constructeur (Bloc A) |
| Challengers (recherchés mais pas #1) | **V3** | Page enrichie (Bloc A) |
| Challengers faibles | **V4** | Sous-ensemble V3 (Bloc A) |
| Recherche "véhicule + pièce" | **V5** | Bloc B → G1 défaut |

---

## 5. Architecture Technique

### Stack

| Composant | Outil | Rôle |
|-----------|-------|------|
| Orchestration | **n8n** | Workflows automatisés (no-code) |
| Stockage | **Google Sheets** | Base de données légère |
| Données SEO | **Google Autosuggest API** | Suggestions de recherche |
| Volumes | **Google Keyword Planner** | Volumes de recherche |
| Mapping moteurs | **Google Sheets** | Table de correspondance |

### Avantages

- Aucun code requis
- Mise à jour automatique
- Scalable (100+ gammes, 10 000+ véhicules)
- Basé 100% sur données Google réelles
- Simple à maintenir

---

## 6. Modules d'Implémentation

### BLOC A — Pipeline "Gamme → Véhicules" (N2/N1/N3)

#### Workflow 1 : Gamme → Mots-clés Google

```
Google Sheets (READ)     → Liste des gammes
        │
        ▼
HTTP Request             → API Autosuggest (a-z loop)
        │                   "filtre huile a", "filtre huile b"...
        ▼
Filter                   → Garder suggestions avec véhicule
        │
        ▼
Google Ads API           → Volumes de recherche
        │
        ▼
Google Sheets (WRITE)    → Sheet "Keywords_gamme"
```

#### Workflow 2 : Keywords → Véhicules N2

```
Sheet "Keywords_gamme"   → Mots-clés avec véhicules
        │
        ▼
Sheet "Véhicules"        → Correspondance texte
        │
        ▼
Match Found              → Ce véhicule est N2 pour cette gamme
        │
        ▼
Google Sheets (WRITE)    → Sheet "N2"
```

#### Workflow 3 : N2 → N1/N3 (par moteur)

```
Sheet "N2"               → Véhicules N2 à analyser
        │
        ▼
Sheet "Familles_moteur"  → Mapping moteur → famille
        │
        ▼
Group By                 → Grouper par (gamme, famille_moteur)
        │
        ▼
IF count > 1             → Continuer (sinon reste N2)
        │
        ▼
Sort by Volume DESC      → Champion = index[0]
        │
        ▼
Assign Levels            → [0]=N1+N2, [1+]=N3
        │
        ▼
Google Sheets (WRITE)    → Sheet "Niveaux_gamme"
```

### BLOC B — Pipeline "Véhicule → Pièces" (V5)

#### Workflow 4 : Détection Candidats V5

```
Sheet "Véhicules_catalogue"  → Tous les véhicules DB
        │
        ▼
Sheet "Niveaux_gamme"        → Exclure V1/V2/V3/V4
        │
        ▼
Candidats V5                 → Véhicules non présents
```

#### Workflow 5 : Véhicule → Pièces Google

```
Candidats V5             → Liste véhicules
        │
        ▼
Generate Keywords        → "[véhicule] filtre air"
        │                   "[véhicule] bougie"
        ▼                   "[véhicule] bobine"...
HTTP Request             → API Autosuggest (volumes)
        │
        ▼
Sort + Filter            → Top 3-5 pièces par volume
        │
        ▼
Google Sheets (WRITE)    → Sheet "V5_pieces"
```

---

## 7. Structure des Données (Google Sheets)

### Sheet 1 : Gammes

| gamme_id | gamme_nom |
|----------|-----------|
| 1 | Filtre huile |
| 2 | Plaquettes frein |
| 3 | Kit embrayage |

### Sheet 2 : Keywords_gamme (Bloc A - étape 1)

| id | gamme | mot_cle | volume | vehicule_detecte | date_maj |
|----|-------|---------|--------|------------------|----------|
| 1 | Filtre huile | filtre huile clio 3 1.5 dci 2012 90cv | 3200 | Clio 3 1.5 dCi 2012 90cv | 2025-01-15 |

### Sheet 3 : Véhicules_catalogue

| type_id | marque | modele | generation | motorisation | moteur | carburant |
|---------|--------|--------|------------|--------------|--------|-----------|
| 16789 | Renault | Clio | III | 1.5 dCi 90cv | K9K | Diesel |

### Sheet 4 : Familles_moteur

| moteur_pattern | famille_code | carburant |
|----------------|--------------|-----------|
| 1.5 dCi | K9K | Diesel |
| 1.6 HDi | DV6 | Diesel |
| 2.0 TDI | CFFB | Diesel |
| 1.4 i | K4J | Essence |

### Sheet 5 : Niveaux_gamme (Output principal)

| id | gamme | vehicule_exact | vehicule_generique | niveau | volume | famille_moteur | source | date_maj |
|----|-------|----------------|-------------------|--------|--------|----------------|--------|----------|
| 1 | Filtre huile | Clio 3 1.5 dCi 2012 90cv | Clio 3 1.5 dCi | N1 | 3200 | K9K | gamme+vehicule | 2025-01-15 |
| 2 | Filtre huile | Clio 3 1.5 dCi | Clio 3 1.5 dCi | N2 | 5200 | K9K | gamme+vehicule | 2025-01-15 |
| 3 | Filtre huile | Clio 4 1.5 dCi | Clio 4 1.5 dCi | N3 | 1400 | K9K | gamme+vehicule | 2025-01-15 |

### Sheet 6 : V5_pieces (Bloc B output)

| vehicule | niveau | piece | volume | rang | source |
|----------|--------|-------|--------|------|--------|
| Clio 3 1.4 i | V5 | bougies | 2600 | 1 | vehicule+piece |
| Clio 3 1.4 i | V5 | bobine allumage | 2100 | 2 | vehicule+piece |
| Clio 3 1.4 i | V5 | filtre air | 1800 | 3 | vehicule+piece |

**Colonne `source` importante :**
- `gamme+vehicule` = V1/V2/V3/V4 (Bloc A)
- `vehicule+piece` = V5 (Bloc B)

---

## 8. Mapping avec le Système Existant (CGC_LEVEL)

### Système Existant : CGC_LEVEL

Table : `__cross_gamme_car_new` (colonne: `cgc_level`)

| cgc_level | Nom | Description |
|-----------|-----|-------------|
| **1** | GAMME_PAGE | Véhicules vedettes, affichés en grille sur page gamme |
| **2** | BRAND_PAGE | Véhicules secondaires, affichés sur page marque |
| **3** | VEHICLE_PAGE | Toutes gammes compatibles sur page motorisation |
| **5** | BLOG | Véhicules cités dans les articles blog/guides |

### Mapping CGC_LEVEL → V1/V2/V3/V4

```
┌─────────────────────────────────────────────────────────────┐
│  SYSTÈME EXISTANT (cgc_level)                               │
│                                                             │
│  Level 1 (GAMME_PAGE) ─────────┐                           │
│  Level 5 (BLOG)        ────────┼──→  V1 (Champions SEO)    │
│                                │     Les + importants      │
│                                │                           │
│  Level 2 (BRAND_PAGE)  ────────┼──→  V2 (Secondaires)      │
│                                │     Validés mais - rech.  │
│                                │                           │
│  Level 3 (VEHICLE_PAGE) ───────┼──→  V3 potentiels         │
│                                │     (si même moteur que   │
│                                │      un V1)               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  NOUVEAUX NIVEAUX (à ajouter)                               │
│                                                             │
│  V3 = variantes du même moteur que V1                      │
│       (n'existait pas dans cgc_level)                       │
│                                                             │
│  V4 = véhicules hors "Gamme + Véhicule"                    │
│       (n'existait pas dans cgc_level)                       │
└─────────────────────────────────────────────────────────────┘
```

### Tableau de Mapping Complet

| Niveau V | Source cgc_level | Description |
|----------|------------------|-------------|
| **V1** | cgc_level 1 + 5 | Champions SEO (véhicules héros) |
| **V2** | cgc_level 2 | Secondaires mais pertinents |
| **V3** | cgc_level 3 (filtré) | Variantes même moteur que V1 |
| **V4** | **NOUVEAU** | Véhicules hors "gamme+véhicule" |

### Migration des Données

```sql
-- Étape 1 : Ajouter colonne niveau V au système existant
ALTER TABLE __cross_gamme_car_new
ADD COLUMN IF NOT EXISTS v_level INTEGER;

-- Étape 2 : Mapper les cgc_level existants vers niveaux V
UPDATE __cross_gamme_car_new SET v_level = 1 WHERE cgc_level IN ('1', '5');  -- V1
UPDATE __cross_gamme_car_new SET v_level = 2 WHERE cgc_level = '2';           -- V2
UPDATE __cross_gamme_car_new SET v_level = 3 WHERE cgc_level = '3';           -- V3

-- Étape 3 : Les V3 seront affinés par groupe moteur (workflow n8n)
-- Étape 4 : Les V4 seront ajoutés depuis les données Google (workflow n8n)
```

### Approche : ENRICHIR cgc_level (pas remplacer)

**GARDER cgc_level** = structure interne du catalogue
**AJOUTER v_level** = structure basée sur Google

```
┌─────────────────────────────────────────────────────────────┐
│  ANCIEN SYSTÈME (cgc_level)                                 │
│  ✅ Gardé : structure catalogue interne                     │
│                                                             │
│  NOUVEAU SYSTÈME (v_level)                                  │
│  ✅ Ajouté : structure basée Google + moteurs               │
│                                                             │
│  → Les deux coexistent et se complètent                     │
└─────────────────────────────────────────────────────────────┘
```

### Pourquoi ne pas remplacer cgc_level ?

| Problème cgc_level seul | Solution v_level |
|-------------------------|------------------|
| Pas basé sur volumes Google | **Basé 100% Google** |
| Pas de variantes moteurs | **V3 = variantes moteur** |
| Pas de véhicules isolés | **V4 = orphelins intéressants** |
| Pas de champion par moteur | **V1 = champion exact** |

### Structure RPC Combinée

La RPC retourne les deux systèmes :

```sql
SELECT
    gamme,
    vehicule,
    moteur,
    cgc_level,      -- ancien système (interne)
    v_level,        -- nouveau système V (Google)
    google_volume,
    famille_moteur
FROM vehicle_gamme_combined
ORDER BY
    CASE v_level
        WHEN 1 THEN 1  -- V1 en premier
        WHEN 3 THEN 2  -- V3 ensuite (variantes)
        WHEN 2 THEN 3  -- V2 ensuite
        WHEN 4 THEN 4  -- V4 en dernier
    END,
    google_volume DESC;
```

### Ordre d'Affichage sur Page Gamme

```
┌─────────────────────────────────────────────────────────────┐
│  PAGE GAMME : Filtre à huile                                │
├─────────────────────────────────────────────────────────────┤
│  1. V1 — Véhicule Champion                                  │
│     Clio 3 1.5 dCi 2012 90cv                               │
│     [Description complète, contenu premium]                 │
├─────────────────────────────────────────────────────────────┤
│  2. V3 — Variantes du même moteur                          │
│     Clio 4 1.5 dCi 95cv                                    │
│     Clio 3 1.5 dCi 86cv                                    │
│     [Liens vers V1, description courte]                     │
├─────────────────────────────────────────────────────────────┤
│  3. V2 — Autres véhicules Google                           │
│     208 1.6 HDi                                            │
│     Golf 6 2.0 TDI                                         │
│     [Affichés, description courte]                          │
├─────────────────────────────────────────────────────────────┤
│  4. V4 — Section "Autres véhicules intéressants"           │
│     Clio 3 1.4 i                                           │
│     [Pièces les plus demandées pour ce véhicule]            │
├─────────────────────────────────────────────────────────────┤
│  ❌ cgc_level 3 — JAMAIS affiché (trop nombreux)            │
└─────────────────────────────────────────────────────────────┘
```

### Verdict : Système Hybride Supérieur

| Critère | cgc_level seul | v_level seul | **Hybride** |
|---------|----------------|--------------|-------------|
| Structure interne | ✅ | ❌ | ✅ |
| Basé Google | ❌ | ✅ | ✅ |
| Variantes moteur | ❌ | ✅ | ✅ |
| Véhicules isolés | ❌ | ✅ | ✅ |
| Champion SEO | ❌ | ✅ | ✅ |

> **Architecture stratégique de niveau supérieur.**

---

## 9. Structure SQL Complète

### 9.1 Table `vehicles` (Référentiel de base)

```sql
CREATE TABLE vehicles (
    vehicle_id SERIAL PRIMARY KEY,
    brand VARCHAR(100),           -- Renault, Peugeot
    model VARCHAR(100),           -- Clio, 208
    generation VARCHAR(50),       -- Clio 3, Clio 4
    engine_code VARCHAR(20),      -- K9K, DV6 (clé pour grouper N1/N2/N3)
    fuel VARCHAR(20),             -- diesel, essence
    engine_size DECIMAL(3,1),     -- 1.5, 1.6
    power_hp INTEGER,             -- 90, 110
    year_from INTEGER,
    year_to INTEGER
);
```

**Clé importante :** `engine_code` sert à regrouper les véhicules par même moteur.

### 9.2 Table `gammes` (Familles de pièces)

```sql
CREATE TABLE gammes (
    gamme_id SERIAL PRIMARY KEY,
    slug VARCHAR(100),            -- filtre-a-huile
    label VARCHAR(200),           -- Filtre à huile
    category VARCHAR(100),        -- filtration, freinage, moteur
    g_level INTEGER,              -- 1=G1, 2=G2, 3=G3, 4=G4
    parent_gamme_id INTEGER REFERENCES gammes(gamme_id)  -- pour G3 enfants
);

CREATE INDEX idx_gammes_g_level ON gammes(g_level);
CREATE INDEX idx_gammes_parent ON gammes(parent_gamme_id);
```

**Niveaux G :**
- G1 = Gamme prioritaire (top entretien/SEO)
- G2 = Gamme secondaire
- G3 = Gamme enfant (rattachée via `parent_gamme_id`)
- G4 = Gamme catalogue-only

### 9.3 Table `cgc_legacy` (Ancien système cgc_level)

```sql
CREATE TABLE cgc_legacy (
    gamme_id INTEGER REFERENCES gammes(gamme_id),
    vehicle_id INTEGER REFERENCES vehicles(vehicle_id),
    cgc_level VARCHAR(2),         -- 1, 2, 3, 5
    legacy_source VARCHAR(50),    -- Automecanik vX
    PRIMARY KEY (gamme_id, vehicle_id)
);
```

**Rôle :** Garder la logique ancienne pour comparaison et fusion.

### 9.4 Table `google_keywords` (Log des mots-clés SEO)

```sql
CREATE TABLE google_keywords (
    keyword_id SERIAL PRIMARY KEY,
    keyword_text TEXT,            -- "filtre a huile clio 3 1.5 dci 2012 90cv"
    source_type VARCHAR(20),      -- "gamme_vehicle" ou "vehicle_piece"
    gamme_id INTEGER REFERENCES gammes(gamme_id),
    vehicle_id INTEGER REFERENCES vehicles(vehicle_id),
    part_family VARCHAR(100),     -- pour V5 : bougie, bobine
    search_volume INTEGER,
    country VARCHAR(5),           -- FR, BE
    last_checked_at TIMESTAMP
);
```

**source_type :**
- `gamme_vehicle` = mots-clés "gamme + véhicule" (Bloc A)
- `vehicle_piece` = mots-clés "véhicule + pièce" (Bloc B / V5)

### 9.5 Table `vehicle_gamme_profile` (Profil V1/V2/V3/V4 par gamme)

```sql
CREATE TABLE vehicle_gamme_profile (
    gamme_id INTEGER REFERENCES gammes(gamme_id),
    vehicle_id INTEGER REFERENCES vehicles(vehicle_id),
    engine_code VARCHAR(20),      -- copié pour éviter joins lourds
    google_volume_gamme_vehicle INTEGER,
    v_level INTEGER,              -- 1=V1, 2=V2, 3=V3, 4=V4
    g_level INTEGER,              -- 1=G1, 2=G2 (utilisé pour V4 + G)
    is_champion BOOLEAN DEFAULT FALSE,
    cgc_level VARCHAR(2),         -- copie pour comparaison
    notes TEXT,
    PRIMARY KEY (gamme_id, vehicle_id)
);

CREATE INDEX idx_vgp_gamme_level ON vehicle_gamme_profile(gamme_id, v_level);
CREATE INDEX idx_vgp_engine ON vehicle_gamme_profile(gamme_id, engine_code);
CREATE INDEX idx_vgp_v4_g ON vehicle_gamme_profile(v_level, g_level) WHERE v_level = 4;
```

**Table clé** pour construire les listes de motorisations compatibles.
**Note :** `g_level` est utilisé principalement pour les V4 afin de déterminer l'importance de la gamme dans la fiche entretien.

### 9.6 Table `vehicle_piece_interest` (Profil V4 détaillé)

```sql
CREATE TABLE vehicle_piece_interest (
    vehicle_id INTEGER REFERENCES vehicles(vehicle_id),
    part_family VARCHAR(100),     -- filtre huile, bougies, bobine
    g_level INTEGER,              -- 1=G1, 2=G2 (importance gamme pour ce véhicule)
    google_volume_vehicle_part INTEGER,
    interest_rank INTEGER,        -- 1, 2, 3
    PRIMARY KEY (vehicle_id, part_family)
);

CREATE INDEX idx_vpi_vehicle ON vehicle_piece_interest(vehicle_id, interest_rank);
CREATE INDEX idx_vpi_g_level ON vehicle_piece_interest(vehicle_id, g_level);
```

**Rôle :** Identifier quelles pièces sont les plus recherchées pour les véhicules V4 et leur importance (G1/G2).

### 9.7 Vue Combinée pour RPC

```sql
CREATE VIEW vehicle_gamme_combined AS
SELECT
    vgp.gamme_id,
    g.label AS gamme_label,
    g.g_level AS gamme_g_level,   -- G1, G2, G3, G4 (niveau de la gamme)
    vgp.vehicle_id,
    v.brand,
    v.model,
    v.generation,
    v.engine_code,
    v.fuel,
    v.power_hp,
    vgp.v_level,                  -- V1, V2, V3, V4
    vgp.g_level AS vehicle_g_level, -- G1, G2 (pour V4 uniquement)
    vgp.is_champion,
    vgp.google_volume_gamme_vehicle,
    vgp.cgc_level,
    -- Combinaison V4+G lisible
    CASE
        WHEN vgp.v_level = 4 AND vgp.g_level = 1 THEN 'V4+G1'
        WHEN vgp.v_level = 4 AND vgp.g_level = 2 THEN 'V4+G2'
        ELSE 'V' || vgp.v_level
    END AS level_display
FROM vehicle_gamme_profile vgp
JOIN vehicles v ON v.vehicle_id = vgp.vehicle_id
JOIN gammes g ON g.gamme_id = vgp.gamme_id;
```

---

## 10. Intégration dans les Pages

### 10.1 Page Gamme : `/pieces/[gamme_slug]-[pg_id].html`

Exemple : `/pieces/filtre-a-huile-123.html`

```
┌─────────────────────────────────────────────────────────────┐
│  BLOC 1 : HÉROS (V1)                                        │
├─────────────────────────────────────────────────────────────┤
│  H1 : Filtre à huile pour Clio 3 1.5 dCi 2012 90cv         │
│                                                             │
│  • Description longue                                       │
│  • Texte SEO complet                                        │
│  • Liste de pièces principales                              │
│  • Blocs "pourquoi ce modèle est important"                │
│                                                             │
│  Source : vehicle_gamme_profile WHERE v_level = 1           │
├─────────────────────────────────────────────────────────────┤
│  BLOC 2 : MOTORISATIONS PRINCIPALES (V3)                    │
├─────────────────────────────────────────────────────────────┤
│  "Même moteur que [V1] – pièces compatibles identiques"     │
│                                                             │
│  • Clio 3 1.5 dCi 86cv                                     │
│  • Clio 4 1.5 dCi 90cv                                     │
│  • Clio 4 1.5 dCi 95cv                                     │
│                                                             │
│  Source : WHERE engine_code = engine_code(V1) AND v_level=3│
├─────────────────────────────────────────────────────────────┤
│  BLOC 3 : AUTRES VÉHICULES COMPATIBLES (V2)                 │
├─────────────────────────────────────────────────────────────┤
│  • 208 1.6 HDi                                             │
│  • Golf 6 2.0 TDI                                          │
│                                                             │
│  Source : WHERE v_level = 2 AND engine_code != V1.engine   │
│  Ordre : cgc_level 1/5 d'abord, puis cgc_level 2           │
├─────────────────────────────────────────────────────────────┤
│  BLOC 4 : LIEN CATALOGUE COMPLET                            │
├─────────────────────────────────────────────────────────────┤
│  [Voir toutes les motorisations compatibles]                │
│                                                             │
│  → Page secondaire pour cgc_level=3 (trop nombreux)        │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Page Véhicule : `/vehicule/[slug].html`

Exemple : `/vehicule/renault-clio-3-1-4-i-2009-75cv.html`

```
┌─────────────────────────────────────────────────────────────┐
│  BLOC 1 : PROFIL VÉHICULE                                   │
├─────────────────────────────────────────────────────────────┤
│  H1 : Renault Clio 3 1.4 i 75cv – Entretien & pièces auto  │
│                                                             │
│  • Moteur : K4J                                            │
│  • Années : 2005-2014                                      │
│  • Carburant : Essence                                     │
├─────────────────────────────────────────────────────────────┤
│  BLOC 2 : GAMMES PRIORITAIRES                               │
├─────────────────────────────────────────────────────────────┤
│  Si V1/V2/V3 → lister les gammes où ce véhicule apparaît   │
│  Si V4 → lister pièces les plus recherchées                │
├─────────────────────────────────────────────────────────────┤
│  BLOC 3 : PIÈCES LES PLUS DEMANDÉES (V4)                    │
├─────────────────────────────────────────────────────────────┤
│  Source : vehicle_piece_interest                            │
│                                                             │
│  1. Bougies           (2600 recherches)                    │
│  2. Bobine allumage   (2100 recherches)                    │
│  3. Filtre à air      (1800 recherches)                    │
│  4. Kit distribution  (1500 recherches)                    │
│                                                             │
│  [Liens vers les pages gammes correspondantes]              │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Impact Frontend Détaillé

### Impact par Niveau (Véhicules)

| Niveau V | Page Gamme | Page Véhicule | SEO |
|----------|------------|---------------|-----|
| **V1** | Bloc héros, description complète | Lien prioritaire | Meta optimisées, schema.org |
| **V2** | Bloc "Autres véhicules" | Liste gammes | Meta standards |
| **V3** | Bloc "Même moteur" | Cross-sell | Canonical vers V1 |
| **V4** | Non affiché | Bloc principal | Contenu ciblé pièces |

### Tables Supabase à Créer

```sql
-- Table pour les niveaux G des gammes
ALTER TABLE pieces_gamme ADD COLUMN IF NOT EXISTS g_level INTEGER;
-- G1=prioritaire, G2=secondaire, G3=enfant, G4=catalogue-only

-- Table pour les niveaux V par gamme/véhicule
CREATE TABLE vehicle_gamme_levels (
    id SERIAL PRIMARY KEY,
    type_id INTEGER REFERENCES auto_type(type_id),
    pg_id INTEGER REFERENCES pieces_gamme(pg_id),
    v_level INTEGER CHECK (v_level IN (1, 2, 3, 4)),  -- V1, V2, V3, V4
    g_level INTEGER CHECK (g_level IN (1, 2)),        -- G1, G2 (pour V4 uniquement)
    vehicule_exact TEXT,
    vehicule_generique TEXT,
    google_volume INTEGER,
    famille_moteur VARCHAR(20),
    source VARCHAR(20) CHECK (source IN ('gamme+vehicule', 'vehicule+piece')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(type_id, pg_id)
);

-- Table pour les pièces prioritaires V4
CREATE TABLE vehicle_v4_pieces (
    id SERIAL PRIMARY KEY,
    type_id INTEGER REFERENCES auto_type(type_id),
    piece_gamme TEXT,
    g_level INTEGER CHECK (g_level IN (1, 2)),  -- G1 ou G2
    google_volume INTEGER,
    rang INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX idx_vehicle_gamme_levels_lookup
ON vehicle_gamme_levels(type_id, pg_id, v_level);

CREATE INDEX idx_vehicle_gamme_levels_by_level
ON vehicle_gamme_levels(pg_id, v_level);

CREATE INDEX idx_vehicle_gamme_levels_v4_g
ON vehicle_gamme_levels(v_level, g_level) WHERE v_level = 4;
```

### Synchronisation n8n → Supabase

```
Google Sheets (READ)     → Niveaux finaux
        │
        ▼
HTTP Request             → API Supabase (upsert)
        │
        ▼
Webhook                  → Invalider cache Redis
```

---

## 9. Fichiers du Projet Existant Concernés

### Backend (NestJS)

| Fichier | Impact |
|---------|--------|
| `backend/src/modules/catalog/services/vehicle-filtered-catalog-v4-hybrid.service.ts` | Filtrer par niveau |
| `backend/src/modules/seo/dynamic-seo-v4-ultimate.service.ts` | Meta selon niveau |
| `backend/src/modules/vehicles/services/data/vehicle-types.service.ts` | Requête niveaux |

### Frontend (Remix)

| Fichier | Impact |
|---------|--------|
| `frontend/app/routes/pieces.$gamme.$marque.$modele.$type[.]html.tsx` | Affichage selon niveau |
| `frontend/app/routes/constructeurs.$brand.$model.$type.tsx` | Affichage selon niveau |
| `frontend/app/components/pieces/PiecesCompatibilityInfo.tsx` | Badge niveau |

### SQL à Créer

| Fichier | Contenu |
|---------|---------|
| `backend/sql/013-create-vehicle-gamme-levels.sql` | Tables + index |

---

## 10. Planning d'Implémentation

### Phase 1 : Infrastructure (Semaine 1)

- [ ] Configurer n8n (self-hosted ou cloud)
- [ ] Créer les Google Sheets (6 sheets)
- [ ] Configurer accès API (SerpAPI, Google Ads)
- [ ] Créer table familles moteur initiale

### Phase 2 : Bloc A - N2/N1/N3 (Semaine 2)

- [ ] Workflow 1 : Gamme → Keywords
- [ ] Workflow 2 : Keywords → N2
- [ ] Workflow 3 : N2 → N1/N3
- [ ] Tester sur 1 gamme pilote (filtre à huile)

### Phase 3 : Bloc B - V5 (Semaine 3)

- [ ] Workflow 4 : Détection candidats V5
- [ ] Workflow 5 : Véhicule → Pièces
- [ ] Enrichir table familles moteur

### Phase 4 : Intégration Site (Semaine 4+)

- [ ] Créer tables Supabase
- [ ] Workflow sync Sheets → Supabase
- [ ] Adapter frontend selon niveaux
- [ ] Adapter SEO selon niveaux

---

## 11. Questions Ouvertes

1. **Fréquence de mise à jour ?** (quotidien, hebdomadaire, mensuel)
2. **Seuil volume minimum ?** (ignorer mots-clés < X recherches/mois)
3. **Redirections N3 → N1 ?** (301 permanent ou canonical)
4. **APIs à utiliser ?** (SerpAPI, RapidAPI, autre)

---

## 12. Stratégie Marketing N1 (Véhicule Héros)

### Concept : Hero Model Strategy

Le N1 devient la **locomotive** de tout le marketing pour chaque gamme :

| Rôle | Description |
|------|-------------|
| Modèle star | Véhicule phare de la gamme |
| Pivot SEO | Page principale qui capte 80% du trafic |
| Pivot publicité | Cible des campagnes Google/Meta Ads |
| Pivot contenu | Base pour tutoriels, articles, vidéos |
| Référence métier | Standard pour les pièces, stocks, prix |
| Porte d'entrée | Point d'accès vers toute la gamme |

### Applications Concrètes du N1

#### 12.1 SEO (Page Principale)

```
H1 : Filtre à huile pour Clio 3 1.5 dCi 2012 90cv
├── Meta-title optimisé
├── Meta-description
├── Rich snippets (schema.org)
├── Compatibilité moteur K9K
├── Variantes N3 en bas de page
└── Liens internes vers autres gammes
```

**Cluster de contenu autour du N1 :**
- Tutoriels : "Comment changer le filtre sur Clio 3 1.5 dCi"
- Problèmes fréquents du moteur K9K
- Couples de serrage officiels
- Entretien officiel Renault

#### 12.2 Google Ads

**Mots-clés ciblés :**
- "filtre à huile clio 3 1.5 dci 2012"
- "meilleur filtre clio 3 1.5 dci 90cv"

**Avantages :**
- CPC bas (requête précise)
- Conversion haute (intention claire)
- Concurrence faible (longue traîne)

#### 12.3 Meta Ads (Facebook/Instagram)

| Format | Exemple |
|--------|---------|
| Carrousel | "Vidange facile Clio 3 1.5 dCi" |
| Reels | "Quel filtre pour Clio 3 1.5 dCi ?" |
| Post | "Les 3 erreurs à éviter sur la Clio 3 1.5 dCi" |

#### 12.4 Email Marketing

**Exemple de série :**

> **Sujet :** Entretien Clio 3 1.5 dCi : les pièces à changer absolument
>
> **Contenu :**
> - Filtre à huile (gamme principale)
> - Filtre à air
> - Plaquettes
> - Courroie accessoire
> - Batteries compatibles

### Merchandising & Produits

#### Mise en avant produits

```
┌─────────────────────────────────────┐
│  Page Filtre à huile                │
│                                     │
│  [N1] Clio 3 1.5 dCi 2012 90cv     │ ← En haut, mis en avant
│       Pack vidange spécial N1       │
│       Référence OEM exacte          │
│       Référence équipementier       │
│                                     │
│  [N3] Variantes                     │ ← En bas
│       Clio 4 1.5 dCi               │
│       Clio 3 1.5 dCi 85cv          │
└─────────────────────────────────────┘
```

#### Priorité des stocks

| Priorité | Niveau | Logique |
|----------|--------|---------|
| 1 | V1 | Stock prioritaire (véhicule héros) |
| 2 | V3 | Stock secondaire (variantes) |
| 3 | V5 | Stock ciblé (pièces demandées) |

#### Promotions ciblées

```
"Promo -10% : Filtre à huile Clio 3 1.5 dCi"
→ Chirurgical, simple, efficace
```

### Conversion (CRO)

#### Landing page N1

- Simple et rapide
- Ciblée sur le véhicule exact
- CTA très clair

#### Configurateur pré-rempli

```
┌─────────────────────────────────────┐
│  Votre véhicule :                   │
│  [Clio 3 1.5 dCi 2012 90cv] ✓      │ ← Pré-sélectionné
│                                     │
│  [Voir les pièces compatibles]      │
└─────────────────────────────────────┘

Conversion : +40%
```

#### Recommandations intelligentes

- Pièces complémentaires
- Pack d'entretien complet
- Pièces les plus vendues pour moteur K9K

### Effet Domino : Hiérarchie Marketing

```
N1 (champion)
 │
 ├── SEO → Page principale, cluster contenu
 ├── Ads → Google Ads, Meta Ads ciblés
 ├── Email → Séries spécifiques
 ├── Produits → Mise en avant, packs
 ├── Stocks → Priorité approvisionnement
 └── Promotions → Offres ciblées

V2 (champion) → Pages catalogue standard
V3 (challengers) → Pages secondaires, liens internes
V5 (Bloc B) → Pages par pièces prioritaires
```

### Avantage Concurrentiel

> **Aucun concurrent n'a une structure aussi logique.**
>
> Tu sais exactement :
> - Sur quoi créer du contenu
> - Sur quoi lancer une campagne
> - Sur quoi produire des vidéos
> - Sur quoi investir en SEO
> - Quels produits stocker en priorité
> - Quelles gammes pousser

---

## 14. Règles Marketing par Niveau G

### G1 — Gammes Maîtresses (Marketing Fort)

| Canal | Actions |
|-------|---------|
| **Homepage** | Mise en avant principale |
| **Google Ads** | Campagnes ciblées |
| **Meta Ads** | Facebook/Instagram |
| **Bannières** | Site + partenaires |
| **Promotions** | Saisonnières |
| **Newsletter** | Campagnes dédiées |
| **Réseaux sociaux** | Posts récurrents |
| **TikTok / Reels** | Vidéos tutoriels |
| **YouTube** | Tutoriels complets |
| **Pages marques** | Bosch, Brembo, Valeo... |

### G2 — Gammes Secondaires (Marketing Moyen)

| Canal | Actions |
|-------|---------|
| **Catégories** | Mise en avant dans les catégories |
| **Campagnes** | 1 campagne par trimestre |
| **Posts** | Thématiques "symptômes d'une panne" |
| **Emails** | Automatisés (maintenance préventive) |

### G3 — Gammes Enfants (Pas de Marketing Direct)

| Canal | Actions |
|-------|---------|
| **Panier** | Cross-selling automatique |
| **Pages produits** | Upsell "Vos pièces complémentaires" |
| **Marketing direct** | JAMAIS |
| **Impact** | Influence sur le panier moyen |

### G4 — Gammes Catalogue-Only (Aucun Marketing)

| Canal | Actions |
|-------|---------|
| **Marketing** | JAMAIS |
| **Promotions** | JAMAIS |
| **Visibilité** | Page véhicule uniquement |
| **Recherche** | Interne uniquement |
| **Cible** | Réparateurs professionnels |

---

## 15. Règles Contenu Pages Gammes

### Contenu G1 (Niveau Premium)

> Pages piliers SEO

| Élément | Spécification |
|---------|---------------|
| **H1** | Optimisé SEO |
| **Texte** | 400–600 mots |
| **FAQ** | Oui |
| **Marques** | Premium (Bosch, Brembo...) |
| **Compatibilités** | Principales affichées |
| **Vidéos** | Oui |
| **Illustrations** | Schémas explicatifs |
| **Filtrage** | Intelligent |

### Contenu G2 (Niveau Standard)

| Élément | Spécification |
|---------|---------------|
| **H1** | Optimisé |
| **Texte** | ~200 mots |
| **Bloc symptômes** | 1 bloc |
| **Bloc solutions** | 1 bloc |
| **Bloc marques** | 1 bloc |
| **CTA** | Clair |

### Contenu G3 (Gamme Enfant)

| Élément | Spécification |
|---------|---------------|
| **Texte SEO** | Aucun |
| **Texte explicatif** | Court |
| **Lien parent** | Fort ("Fait partie de la gamme XXXX") |
| **Redirection** | Vers page parent |

### Contenu G4 (Catalogue-Only)

| Élément | Spécification |
|---------|---------------|
| **Texte** | Zéro |
| **Contenu** | Tableau références OEM |
| **Message** | "Cette pièce est spécifique à votre véhicule" |

---

## 16. Règles Blog Automecanik

### Articles G1 (Tutoriels + Gros Trafic)

**Fréquence :** 3 articles/mois

**Exemples :**
- "Comment choisir vos plaquettes de frein ?"
- "5 signes que vos amortisseurs sont HS"
- "Quand changer filtre à huile ?"

### Articles G2 (Pannes + Diagnostic)

**Fréquence :** 1-2 articles/mois

**Exemples :**
- "Pourquoi ma voiture cale à chaud ? (capteur PMH)"
- "Symptômes d'une sonde lambda défectueuse"

### Articles G3 (Conseils / Maintenance)

**Fréquence :** 1 article/mois

**Exemples :**
- "À quoi servent les clips de plaquettes ?"
- "Pourquoi le kit montage est indispensable ?"

### Articles G4

**Fréquence :** AUCUN

**Raisons :**
- Inutile
- Pas de trafic
- Risque de duplication

---

## 17. Règles Réseaux Sociaux (Facebook / Instagram / TikTok)

### Posts G1 (Fort)

| Type | Description |
|------|-------------|
| **Vidéos tutoriels** | "Comment changer ses plaquettes" |
| **Comparatifs marques** | "Bosch vs Brembo" |
| **Avant / Après** | Photos remplacement |
| **Sécurité routière** | Messages préventifs |
| **Réductions flash** | Promos limitées |
| **Carrousels éducatifs** | Étapes maintenance |

### Posts G2 (Moyen)

| Type | Description |
|------|-------------|
| **Posts symptômes** | "Votre voyant moteur s'allume ?" |
| **"Saviez-vous que…"** | Facts éducatifs |
| **Posts éducatifs** | Explications simples |

### Posts G3 (Enfant)

| Type | Description |
|------|-------------|
| **Seul** | JAMAIS |
| **Intégré** | TOUJOURS dans un post G1 |
| **Exemple** | "N'oubliez pas les kits montage" |

### Posts G4

**Règle :** JAMAIS

Cela n'intéresse aucun utilisateur.

---

## 18. Règles Avis Facebook

### Stratégie : Combiner G1 + V1

Les avis doivent pousser les gammes G1 et véhicules V1 :

| Règle | Application |
|-------|-------------|
| **Véhicules** | Mettre en avant les V1 (populaires) |
| **Gammes** | Mentionner G1 (amortisseurs, freins, filtres) |
| **Ton** | Confiance / mécanique simple |
| **G4** | JAMAIS mentionner |

### Modèle de Réponse

```
« Merci Karim ! Vos plaquettes Brembo pour Clio 3 (1.5 dCi) sont
un excellent choix, c'est un modèle très fiable. »
```

**Analyse :**
- ✅ G1 (Plaquettes)
- ✅ Marque premium (Brembo)
- ✅ V1 (Clio 3 1.5 dCi)
- ✅ Message de confiance

> **Résultat :** G1 + V1 = Maximum crédibilité

---

## 19. Résumé

### Double Système G + V en Une Image

```
┌─────────────────────────────────────────────────────────────┐
│  SYSTÈME G (Gammes)                                         │
│  ─────────────────                                         │
│  G1 = Gammes prioritaires (Filtre, Plaquettes, Disques)    │
│  G2 = Gammes secondaires (Sonde, Débitmètre, Silent bloc)  │
│  G3 = Gammes enfants (Accessoires, kits montage)           │
│  G4 = Gammes catalogue-only (clips, bagues rares)          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  SYSTÈME V (Véhicules) - BLOC A                            │
│                                                             │
│   Google: "filtre huile clio 3"                            │
│                    │                                        │
│                    ▼                                        │
│               ┌────────┐                                    │
│               │   V2   │ ← tous véhicules trouvés           │
│               └────┬───┘                                    │
│                    │                                        │
│            groupe moteur?                                   │
│           /              \                                  │
│         oui              non                                │
│          │                │                                 │
│    ┌─────┴─────┐          │                                 │
│    │           │          │                                 │
│   V1          V3      reste V2                              │
│ (champion)  (autres)   (seul)                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  SYSTÈME V (Véhicules) - BLOC B                            │
│                                                             │
│   Google: "clio 3 1.4 i bougie"                            │
│                    │                                        │
│                    ▼                                        │
│               ┌────────┐                                    │
│               │   V5   │ ← recherche inverse (véhicule → pièce) │
│               └────┬───┘                                    │
│                    │                                        │
│           → G1 par défaut (SEO)                            │
│                                                             │
│   V5 = véhicules trouvés via Bloc B                        │
│        utilisés pour enrichir le contenu SEO G1            │
└─────────────────────────────────────────────────────────────┘
```

### Tableau Récapitulatif Final

| Gammes (G) | Description | Véhicules (V) | Bloc | Description |
|------------|-------------|---------------|------|-------------|
| **G1** | Gammes prioritaires | **V1** | A | Variante dominante du modèle (inter-gammes) |
| **G2** | Gammes secondaires | **V2** | A | Champion #1 de la gamme (UNIQUE) |
| **G3** | Gammes enfants | **V3** | A | Challengers (recherchés mais pas #1) |
| **G4** | Gammes catalogue-only | **V4** | A | Variantes/déclinaisons de V3 |
|          |                       | **V5** | B | Recherche véhicule → pièce (G1 défaut) |

**Structure en 2 Blocs :**
- **Bloc A** (gamme → véhicule) : V1, V2, V3, V4
- **Bloc B** (véhicule → pièce) : V5 → G1 par défaut

**Bonus V4 + G :**
- **V4 + G1** = Variante V4 dans gamme importante → prioritaire fiche entretien
- **V4 + G2** = Variante V4 dans gamme secondaire → affichage minimal

### Avantages Clés

- **100% automatisé** (n8n + Sheets)
- **Aucun code** requis
- **Basé sur Google** (données réelles du marché)
- **Scalable** (100+ gammes, 10 000+ véhicules)
- **Aligné métier** (pièces auto B2B/e-commerce)
- **Terminologie claire** (G pour Gammes, V pour Véhicules)

**Prochaine étape :** Validation du cahier des charges puis implémentation Phase 1.

---

## 20. Phase 2 : Contenu V1 (Pages Modèles)

### Concept : Contenu Encyclopédique V1

Le **Contenu V1** est un bloc de texte encyclopédique (800-1200 mots) affiché sur les pages modèles pour enrichir le SEO et répondre aux AI Overviews de Google.

```
V1 = LE CONTENU PRINCIPAL MODÈLE (LE "MAÎTRE")

Rôle :
→ Page la plus importante pour un modèle (Clio 3, 208, Golf 6…)
→ Support des canonicals
→ Texte le plus riche, complet, neutre

Contenu obligatoire :
• Overview du modèle (histoire, fiabilité, moteurs)
• Présentation diesel + essence séparée
• Tableau des motorisations (avec V1 en avant)
• Liens vers toutes les gammes principales

Longueur : 800–1200 mots
Ton : neutre, encyclopédique
Supporte AI Overviews = réponses factuelles

Objectif SEO :
→ Devenir LA page citée par Google pour le modèle
→ Absorber le trafic global du modèle (non-gamme)
```

### ⚠️ CONTRAINTE UX CRITIQUE

**Le contenu V1 DOIT être placé APRÈS le catalogue pièces, pas AVANT.**

```
Structure page modèle (ordre UX correct) :
─────────────────────────────────────────
1. Header + Breadcrumb
2. Titre H1 + Sélecteur motorisation
3. Specs véhicule (fiche technique)
4. ⭐ CATALOGUE PIÈCES (prioritaire - l'utilisateur vient pour ça)
5. FAQ / Questions fréquentes
6. ✅ CONTENU V1 (encyclopédique - en bas de page)
7. Footer
```

**Raison UX :** L'utilisateur vient chercher des pièces, pas lire un article. Le contenu encyclopédique est utile pour le SEO mais ne doit pas bloquer l'accès au catalogue.

### Structure du Contenu V1

| Section | Contenu | Longueur |
|---------|---------|----------|
| **Intro/Overview** | Présentation générale du modèle | 150-200 mots |
| **Histoire** | Historique du modèle, générations | 200-300 mots |
| **Motorisations Diesel** | Présentation des moteurs diesel | 150-200 mots |
| **Motorisations Essence** | Présentation des moteurs essence | 150-200 mots |
| **Tableau Motorisations** | Liste des motorisations avec niveaux V | JSONB |
| **Conseils Entretien** | Recommandations d'entretien | 100-150 mots |
| **Conclusion** | Résumé | 100 mots |

### Table Supabase : `__model_content_v1`

```sql
CREATE TABLE __model_content_v1 (
  mc_id SERIAL PRIMARY KEY,

  -- Identifiants
  mc_marque_id INT,                    -- auto_marque.marque_id
  mc_modele_id INT,                    -- auto_modele.modele_id
  mc_generation VARCHAR(50),           -- ex: "Phase 2"
  mc_marque_alias VARCHAR(50),
  mc_modele_alias VARCHAR(100),

  -- SEO
  mc_title VARCHAR(200),
  mc_meta_description VARCHAR(320),
  mc_h1 VARCHAR(200),

  -- Sections Structurées (800-1200 mots total)
  mc_intro TEXT,                       -- 150-200 mots (overview)
  mc_histoire TEXT,                    -- 200-300 mots (historique)
  mc_diesel_section TEXT,              -- 150-200 mots
  mc_essence_section TEXT,             -- 150-200 mots
  mc_motorisations JSONB,              -- Tableau motorisations
  mc_entretien TEXT,                   -- 100-150 mots conseils
  mc_conclusion TEXT,                  -- 100 mots

  -- Sections Optionnelles
  mc_fiabilite TEXT,                   -- Section fiabilité
  mc_points_forts TEXT,                -- Points positifs
  mc_points_faibles TEXT,              -- Points négatifs
  mc_conseils_achat TEXT,              -- Guide d'achat

  -- Meta
  mc_keywords TEXT[],
  mc_image_url VARCHAR(500),
  mc_canonical_url VARCHAR(500),

  -- Stats
  mc_published_at TIMESTAMP DEFAULT NOW(),
  mc_updated_at TIMESTAMP DEFAULT NOW(),
  mc_views INT DEFAULT 0,

  UNIQUE(mc_marque_id, mc_modele_id, mc_generation)
);

CREATE INDEX idx_model_content_v1_alias ON __model_content_v1(mc_marque_alias, mc_modele_alias);
```

### Format JSONB `mc_motorisations`

```json
[
  {
    "variante": "1.5 dCi 90cv",
    "puissance": "90cv",
    "niveau_v": "V1",
    "energie": "Diesel",
    "cylindree": "1461cc",
    "annees": "2005-2014",
    "code_moteur": "K9K"
  },
  {
    "variante": "1.5 dCi 105cv",
    "puissance": "105cv",
    "niveau_v": "V2",
    "energie": "Diesel",
    "code_moteur": "K9K"
  }
]
```

### Interface TypeScript

```typescript
interface ModelContentV1 {
  id: number;
  marque: { id: number; name: string; alias: string };
  modele: { id: number; name: string; alias: string; generation: string };

  // SEO
  title: string;
  metaDescription: string;
  h1: string;

  // Sections (800-1200 mots total)
  intro: string;           // Overview 150-200 mots
  histoire: string;        // Historique 200-300 mots
  dieselSection: string;   // Diesel 150-200 mots
  essenceSection: string;  // Essence 150-200 mots
  motorisations: MotorisationEntry[];
  entretien: string;       // Conseils 100-150 mots
  conclusion: string;      // 100 mots

  // Optionnels
  fiabilite?: string;
  pointsForts?: string;
  pointsFaibles?: string;
  conseilsAchat?: string;

  // Meta
  keywords: string[];
  imageUrl: string;
  canonicalUrl: string;
  views: number;
  publishedAt: Date;
  updatedAt: Date;
}

interface MotorisationEntry {
  variante: string;
  puissance: string;
  niveau_v: 'V1' | 'V2' | 'V3' | 'V4' | 'V5';
  energie: 'Diesel' | 'Essence' | 'Hybride' | 'Electrique';
  cylindree?: string;
  annees?: string;
  code_moteur?: string;
}
```

### Intégration avec Système V1-V5

Le contenu V1 est directement lié au système de classification :

| Niveau V | Affichage dans Tableau | Badge |
|----------|------------------------|-------|
| **V1** | ⭐ Mis en avant (variante dominante) | Bleu foncé |
| **V2** | Champion de la gamme | Vert |
| **V3** | Challenger | Jaune |
| **V4** | Variante standard | Orange |
| **V5** | Bloc B (SEO G1) | Gris |

### Composants Frontend

| Composant | Fichier | Rôle |
|-----------|---------|------|
| `ModelContentV1Display` | `frontend/app/components/model/ModelContentV1Display.tsx` | Affichage principal |
| `MotorisationsTable` | `frontend/app/components/model/MotorisationsTable.tsx` | Tableau motorisations |

### API Backend

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/blog/model-content-v1/:marque/:modele` | GET | Récupérer contenu V1 |
| `/api/blog/model-content-v1/:id/views` | POST | Incrémenter vues |
| `/api/blog/model-content-v1/stats` | GET | Statistiques globales |

### Position dans la Page Remix

```typescript
// Dans constructeurs.$brand.$model.$type.tsx
return (
  <main>
    {/* 1-3. Header, titre, specs */}
    <VehicleHeader />
    <VehicleSpecs />

    {/* 4. CATALOGUE PIÈCES - PRIORITAIRE */}
    <PiecesCatalog />

    {/* 5. FAQ */}
    <FAQ />

    {/* 6. CONTENU V1 - EN BAS (après catalogue) */}
    {modelContentV1 && <ModelContentV1Display content={modelContentV1} />}

    {/* 7. Footer */}
    <Footer />
  </main>
);
```

### Fichiers Implémentés

| Fichier | Statut | Description |
|---------|--------|-------------|
| `backend/sql/013-create-table-model-content-v1.sql` | ✅ Créé | Migration SQL |
| `backend/src/modules/blog/services/model-content-v1.service.ts` | ✅ Créé | Service NestJS |
| `backend/src/modules/blog/controllers/model-content-v1.controller.ts` | ✅ Créé | Controller API |
| `frontend/app/components/model/ModelContentV1Display.tsx` | ✅ Créé | Composant affichage |
| `frontend/app/components/model/MotorisationsTable.tsx` | ✅ Créé | Tableau motorisations |
| `frontend/app/routes/constructeurs.$brand.$model.$type.tsx` | ✅ Modifié | Intégration loader |

### Prochaines Étapes Phase 2

1. **Exécuter migration SQL** : Créer la table `__model_content_v1`
2. **Tester API** : Vérifier les endpoints `/api/blog/model-content-v1/*`
3. **Peupler données** : Créer le contenu V1 pour les modèles populaires
4. **Valider UX** : Vérifier placement après catalogue
5. **Optimiser SEO** : Ajouter Schema.org pour contenu encyclopédique

---

## 21. Récapitulatif des 10 Règles V1-V5 (VERSION FINALE)

```
1) V2 séparé Essence/Diesel
   → Calcul V2 TOUJOURS séparé par énergie

2) V2 = Champion #1 (UNIQUE par gamme + modèle + énergie)
   → PAS de seuil, simplement le #1 Google

3) V1 = variante la plus souvent V2 (inter-gammes)
   → Calculé par modèle + énergie

4) Un modèle peut avoir V1 Diesel + V1 Essence
   → Deux V1 séparés par énergie

5) V3 = positions #2, #3, #4... (recherchés mais pas #1)
   → Car il ne peut y avoir qu'1 seul V2 par gamme

6) V2 peut changer par gamme, V1 stable
   → V1 = référence modèle, V2 = champion local

7) V1 ne dépend pas des gammes
   → V1 est inter-gammes, V2 est par gamme

8) V4 = variantes/déclinaisons de V3
   → Break, BVA, 4x4... du même moteur que V3

9) V4 hérite du moteur V3
   → Différentes configurations, même base

10) V5 = Bloc B (véhicule → pièces) → G1 par défaut
    → Recherche inverse, SEO G1 automatique
```

### Schéma Final Complet

```
┌─────────────────────────────────────────────────────────────┐
│  BLOC A : "gamme + véhicule"                                │
│                                                              │
│  V1 ← V2 ← V3 ← V4                                          │
│  │      │      │     │                                      │
│  │      │      │     └── V4 = variantes de V3 (Break, BVA)  │
│  │      │      └── V3 = positions #2, #3... (recherchés)    │
│  │      └── V2 = champion #1 (unique)                       │
│  └── V1 = variante dominante (inter-gammes)                 │
└─────────────────────────────────────────────────────────────┘
                          ↕ (séparé)
┌─────────────────────────────────────────────────────────────┐
│  BLOC B : "véhicule + pièce"                                │
│                                                              │
│  V5 = véhicules trouvés via recherche inverse               │
│       → G1 par défaut                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 22. PHASE 3 : Implémentation Contenu V2 (Page Gamme Champion)

### Spécification Contenu V2

```
V2 = LE CONTENU GAMME DOMINANTE (CHAMPION)

Exemple : "Plaquettes Clio 3 1.5 dCi 90cv"

Rôle :
→ Page GAMME + VARIANTE la plus recherchée
→ Page la plus importante pour la vente et les conversions
→ Canonical principal de la gamme
→ 1 seul V2 par gamme + modèle + énergie

Contenu obligatoire :
• Explication de la pièce pour CE moteur précis
• Symptômes d'usure
• Compatibilités et variantes possibles
• Conseils d'entretien
• Comparatif équipementiers

Longueur : 700–1000 mots
Ton : technique, orienté achat
Apparaît dans les sitemaps
Canonical principal de la gamme

Objectif SEO :
→ Capter la requête modèle + moteur + pièce
→ Devenir la page "answer box" pour SearchGPT / AI Overviews
```

### Différence V1 vs V2

| Critère | Contenu V1 (Page Modèle) | Contenu V2 (Page Gamme) |
|---------|--------------------------|-------------------------|
| **Page cible** | constructeurs.$brand.$model.$type | pieces.$gamme.$marque.$modele.$type |
| **Focus** | Modèle véhicule (Clio 3) | Gamme + Variante (Plaquettes Clio 3 1.5 dCi) |
| **Longueur** | 800-1200 mots | 700-1000 mots |
| **Ton** | Encyclopédique, neutre | Technique, orienté achat |
| **Objectif** | Référence modèle | Conversion vente |
| **Unicité** | 1 par modèle + énergie | 1 par gamme + modèle + énergie |
| **Canonical** | Page modèle | Page gamme champion |

### ⚠️ CONTRAINTE UX CRITIQUE

**Le contenu V2 DOIT être placé APRÈS le catalogue pièces, pas AVANT.**

```
Structure page gamme (ordre UX correct) :
─────────────────────────────────────────
1. Header + Breadcrumb + Image véhicule
2. Titre H1 (gamme + marque + modèle + type)
3. Filtres + Grille/Liste des pièces
4. ⭐ CATALOGUE PIÈCES (prioritaire - l'utilisateur vient pour ça)
5. SEO Content existant (PiecesSEOSection, BuyingGuide, FAQ)
6. ✅ CONTENU V2 (technique champion - en bas de page)
7. Cross-selling + Footer
```

**Raison UX :** L'utilisateur vient acheter des pièces. Le contenu champion enrichit le SEO mais ne doit pas bloquer l'accès au catalogue.

### Structure du Contenu V2

| Section | Contenu | Longueur |
|---------|---------|----------|
| **Intro** | Présentation de la pièce pour ce moteur | 100-150 mots |
| **Symptômes** | Signes d'usure / quand changer | 150-200 mots |
| **Compatibilités** | Moteurs compatibles, variantes | 100-150 mots |
| **Entretien** | Intervalles, conseils maintenance | 100-150 mots |
| **Équipementiers** | Comparatif marques (OEM, premium, budget) | 150-200 mots |
| **Conclusion** | Résumé + CTA | 50-100 mots |

### Table Supabase : `__gamme_content_v2`

```sql
CREATE TABLE __gamme_content_v2 (
  gc_id SERIAL PRIMARY KEY,

  -- Identifiants
  gc_pg_id INT,                      -- pieces_gamme.pg_id
  gc_marque_id INT,                  -- auto_marque.marque_id
  gc_modele_id INT,                  -- auto_modele.modele_id
  gc_type_id INT,                    -- auto_type.type_id (variante V2)
  gc_energie VARCHAR(20),            -- 'Diesel' | 'Essence'

  -- Aliases pour URL
  gc_gamme_alias VARCHAR(100),
  gc_marque_alias VARCHAR(50),
  gc_modele_alias VARCHAR(100),
  gc_type_alias VARCHAR(100),

  -- SEO Meta
  gc_title VARCHAR(200),
  gc_meta_description VARCHAR(320),
  gc_h1 VARCHAR(200),

  -- Sections Structurées (700-1000 mots total)
  gc_intro TEXT,                     -- 100-150 mots
  gc_symptomes TEXT,                 -- 150-200 mots (signes d'usure)
  gc_compatibilites TEXT,            -- 100-150 mots (variantes)
  gc_entretien TEXT,                 -- 100-150 mots (maintenance)
  gc_equipementiers TEXT,            -- 150-200 mots (comparatif marques)
  gc_conclusion TEXT,                -- 50-100 mots

  -- Données structurées JSONB
  gc_marques_comparees JSONB,        -- [{"nom": "Brembo", "type": "premium", "note": 5}]
  gc_variantes_compatibles JSONB,    -- [{"variante": "1.5 dCi 86cv", "niveau_v": "V3"}]
  gc_symptomes_liste JSONB,          -- ["Bruit au freinage", "Vibrations", ...]
  gc_intervalles_km INT,             -- Intervalle remplacement en km

  -- Meta
  gc_keywords TEXT[],
  gc_image_url VARCHAR(500),
  gc_canonical_url VARCHAR(500),

  -- Stats
  gc_published_at TIMESTAMP DEFAULT NOW(),
  gc_updated_at TIMESTAMP DEFAULT NOW(),
  gc_views INT DEFAULT 0,
  gc_is_active BOOLEAN DEFAULT TRUE,

  -- Contrainte : 1 seul V2 par gamme + modele + energie
  UNIQUE(gc_pg_id, gc_modele_id, gc_energie)
);
```

### Format JSONB `gc_marques_comparees`

```json
[
  {
    "nom": "Brembo",
    "type": "premium",
    "note": 5,
    "prix_relatif": "+++",
    "avantages": ["Performance", "Durabilité"],
    "inconvenients": ["Prix élevé"]
  },
  {
    "nom": "Bosch",
    "type": "oem",
    "note": 4,
    "prix_relatif": "++",
    "avantages": ["Qualité OEM", "Fiabilité"],
    "inconvenients": []
  },
  {
    "nom": "Ferodo",
    "type": "budget",
    "note": 3,
    "prix_relatif": "+",
    "avantages": ["Prix accessible"],
    "inconvenients": ["Usure plus rapide"]
  }
]
```

### Format JSONB `gc_variantes_compatibles`

```json
[
  {"variante": "1.5 dCi 70cv", "niveau_v": "V3", "code_moteur": "K9K"},
  {"variante": "1.5 dCi 105cv", "niveau_v": "V3", "code_moteur": "K9K"},
  {"variante": "1.5 dCi 86cv", "niveau_v": "V4", "code_moteur": "K9K"}
]
```

### Interface TypeScript

```typescript
interface GammeContentV2 {
  id: number;

  // Identifiants
  gamme: { id: number; name: string; alias: string };
  marque: { id: number; name: string; alias: string };
  modele: { id: number; name: string; alias: string };
  type: { id: number; name: string; alias: string };
  energie: 'Diesel' | 'Essence';

  // SEO
  title: string;
  metaDescription: string;
  h1: string;

  // Sections (700-1000 mots total)
  intro: string;           // 100-150 mots
  symptomes: string;       // 150-200 mots
  compatibilites: string;  // 100-150 mots
  entretien: string;       // 100-150 mots
  equipementiers: string;  // 150-200 mots
  conclusion: string;      // 50-100 mots

  // Données structurées
  marquesComparees: MarqueComparee[];
  variantesCompatibles: VarianteCompatible[];
  symptomesListe: string[];
  intervallesKm: number;

  // Meta
  keywords: string[];
  imageUrl: string;
  canonicalUrl: string;
  views: number;
  publishedAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

interface MarqueComparee {
  nom: string;
  type: 'premium' | 'oem' | 'budget';
  note: number;             // 1-5
  prixRelatif: string;      // '+', '++', '+++'
  avantages: string[];
  inconvenients: string[];
}

interface VarianteCompatible {
  variante: string;         // "1.5 dCi 86cv"
  niveauV: 'V1' | 'V2' | 'V3' | 'V4' | 'V5';
  codeMoteur?: string;      // "K9K"
}
```

### Intégration avec Système V1-V5

Le contenu V2 est directement lié au champion de la gamme :

| Niveau V | Rôle dans Contenu V2 |
|----------|----------------------|
| **V2** | ⭐ Variante CHAMPION - Page avec contenu V2 complet |
| **V3** | Listées dans `variantesCompatibles` (challengers) |
| **V4** | Listées dans `variantesCompatibles` (variantes) |
| **V1** | Référence dans l'intro (variante dominante modèle) |
| **V5** | Non applicable (Bloc B) |

### Fichiers à Créer (Phase 3)

| Fichier | Action | Description |
|---------|--------|-------------|
| `backend/sql/014-create-table-gamme-content-v2.sql` | CRÉER | Migration table |
| `backend/src/modules/blog/services/gamme-content-v2.service.ts` | CRÉER | Service NestJS |
| `backend/src/modules/blog/controllers/gamme-content-v2.controller.ts` | CRÉER | Controller API |
| `frontend/app/components/gamme/GammeContentV2Display.tsx` | CRÉER | Composant affichage |
| `frontend/app/components/gamme/EquipementiersComparison.tsx` | CRÉER | Tableau comparatif marques |
| `frontend/app/components/gamme/SymptomesSection.tsx` | CRÉER | Liste symptômes usure |
| `frontend/app/components/gamme/index.ts` | CRÉER | Barrel exports |

### Fichier à Modifier (Phase 3)

| Fichier | Action | Description |
|---------|--------|-------------|
| `frontend/app/routes/pieces.$gamme.$marque.$modele.$type[.]html.tsx` | MODIFIER | Ajouter loader + composant |

### API Backend

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/blog/gamme-content-v2/:gamme/:marque/:modele/:type` | GET | Récupérer contenu V2 |
| `/api/blog/gamme-content-v2/:id/views` | POST | Incrémenter vues |
| `/api/blog/gamme-content-v2/stats` | GET | Statistiques globales |
| `/api/blog/gamme-content-v2/champions` | GET | Liste des champions V2 |

### Position dans la Page Remix Gamme

```typescript
// Dans pieces.$gamme.$marque.$modele.$type[.]html.tsx
return (
  <main>
    {/* 1-2. Header, titre */}
    <PiecesHeader />
    <VehicleSelectorV2 />

    {/* 3-4. Filtres + CATALOGUE PIÈCES - PRIORITAIRE */}
    <PiecesFilterSidebar />
    <PiecesGridView /> ou <PiecesListView />

    {/* 5. SEO Content existant */}
    <PiecesSEOSection />
    <PiecesBuyingGuide />
    <PiecesFAQSection />
    <PiecesCompatibilityInfo />

    {/* 6. CONTENU V2 - EN BAS (après SEO existant) */}
    {gammeContentV2 && <GammeContentV2Display content={gammeContentV2} />}

    {/* 7. Cross-selling + Footer */}
    <PiecesCrossSelling />
  </main>
);
```

### Relation avec SEO Existant

**IMPORTANT :** Le contenu V2 est **complémentaire**, pas un remplacement.

```
SEO Existant (garder) :
─────────────────────
• __seo_gamme_car → Titres, descriptions, H1 dynamiques
• PiecesSEOSection → Contenu SEO généré
• PiecesBuyingGuide → Guide d'achat contextuel
• PiecesFAQSection → FAQ générée

Contenu V2 (ajouter) :
─────────────────────
• __gamme_content_v2 → Contenu encyclopédique champion
• GammeContentV2Display → Affichage structuré
• EquipementiersComparison → Comparatif marques
• SymptomesSection → Symptômes d'usure
```

Le V2 enrichit le SEO existant avec du contenu premium pour le champion de chaque gamme.

### Prochaines Étapes Phase 3

1. **Créer migration SQL** : Table `__gamme_content_v2` avec RPC functions
2. **Créer service backend** : `GammeContentV2Service` avec cache Redis
3. **Créer controller** : Endpoints API `/api/blog/gamme-content-v2/*`
4. **Créer composants frontend** :
   - `GammeContentV2Display` (affichage principal)
   - `EquipementiersComparison` (tableau comparatif)
   - `SymptomesSection` (liste symptômes)
5. **Intégrer dans loader** : Ajouter fetch dans `pieces.$gamme.$marque.$modele.$type[.]html.tsx`
6. **Peupler données** : Créer contenu V2 pour gammes G1 prioritaires

---

## 23. PHASE 4 : Stratégie d'Héritage Contenu V2/V3/V4 (Option 3)

### Principe : Héritage avec Personnalisation Dynamique

```
┌─────────────────────────────────────────────────────────────┐
│  V2 = CONTENU MAÎTRE (700-1000 mots)                        │
│  Champion #1, contenu complet, self-canonical               │
│                                                              │
│  Template avec variables dynamiques :                        │
│  - #VType#, #VMarque#, #VModele#                            │
│  - #CodeMoteur#, #Puissance#                                │
│  - #CompSwitch_X#, #CompSwitch_X_Y#                         │
└───────────────────────┬─────────────────────────────────────┘
                        │ héritage
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  V3 = CONTENU HÉRITÉ + PERSONNALISATION (500-700 mots)      │
│  Challengers #2, #3, template V2 + sections spécifiques     │
│  Variables remplacées par données V3 (code moteur, puiss.)  │
│  Self-canonical                                              │
└───────────────────────┬─────────────────────────────────────┘
                        │ héritage + canonical
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  V4 = CONTENU MINIMAL + CANONICAL → V2 (400-500 mots)       │
│  Variantes de V3, template allégé                           │
│  Canonical pointe vers V2 (concentration link juice)        │
└─────────────────────────────────────────────────────────────┘
```

### Intégration avec Système Switches SEO Existant

Le système `DynamicSeoV4UltimateService` sera étendu :

| Type Switch Existant | Utilisation V2/V3/V4 |
|----------------------|----------------------|
| `#CompSwitch#` | Texte générique (rotation globale) |
| `#CompSwitch_1#` | Variations par gamme courante |
| `#CompSwitch_3#` | Variations avec offset pgId |
| `#CompSwitch_X_Y#` | Références cross-gamme |
| `#PrixPasCher#` | 17 variantes prix |
| **NOUVEAU** `#NiveauV#` | "V2" / "V3" / "V4" |
| **NOUVEAU** `#IntervalleKm#` | Intervalle remplacement spécifique |
| **NOUVEAU** `#MarquesTop3#` | "Brembo, Bosch, Ferodo" |

### Architecture de Tables (Héritage)

```sql
-- Table template maître (héritée par V2/V3/V4)
CREATE TABLE __gamme_content_template (
  gct_id SERIAL PRIMARY KEY,
  gct_pg_id INT NOT NULL,              -- pieces_gamme.pg_id
  gct_energie VARCHAR(20),             -- 'Diesel' | 'Essence' | NULL (tous)

  -- Templates avec variables dynamiques (système switches existant)
  gct_intro_template TEXT,             -- "Les #Gamme# pour votre #VMarque# #VModele# #VType#..."
  gct_symptomes_template TEXT,         -- "Quand changer #CompSwitch_1# #Gamme#..."
  gct_compatibilites_template TEXT,    -- "Compatible avec #CompSwitch_2# variantes..."
  gct_entretien_template TEXT,         -- "Intervalle : #IntervalleKm# km..."
  gct_equipementiers_template TEXT,    -- "#VousPropose# : #MarquesTop3#..."
  gct_conclusion_template TEXT,        -- "Trouvez #PrixPasCher# #Gamme#..."

  -- Données structurées partagées
  gct_marques_top JSONB,               -- Marques premium pour cette gamme
  gct_symptomes_communs JSONB,         -- Symptômes génériques
  gct_intervalle_km_defaut INT,        -- Intervalle par défaut

  UNIQUE(gct_pg_id, gct_energie)
);

-- Table contenu par niveau V (spécifique V2/V3/V4)
CREATE TABLE __gamme_content_niveau (
  gcn_id SERIAL PRIMARY KEY,
  gcn_gct_id INT REFERENCES __gamme_content_template(gct_id),
  gcn_type_id INT NOT NULL,            -- auto_type.type_id
  gcn_niveau_v VARCHAR(2) NOT NULL,    -- 'V2' | 'V3' | 'V4'

  -- Surcharges spécifiques (NULL = hérite du template)
  gcn_intro_override TEXT,
  gcn_symptomes_override TEXT,
  gcn_sections_specifiques JSONB,

  -- Données spécifiques moteur
  gcn_code_moteur VARCHAR(50),
  gcn_puissance VARCHAR(20),
  gcn_intervalle_km INT,               -- NULL = hérite défaut
  gcn_marques_specifiques JSONB,

  -- Canonical (stratégie link juice)
  gcn_canonical_type_id INT,           -- NULL = self, sinon → V2

  -- Stats
  gcn_views INT DEFAULT 0,
  gcn_is_active BOOLEAN DEFAULT TRUE,

  UNIQUE(gcn_gct_id, gcn_type_id)
);
```

### Stratégie de Canonical

| Niveau | Longueur | Canonical | Raison |
|--------|----------|-----------|--------|
| **V2** | 700-1000 mots | Self-canonical | Page principale, concentre link juice |
| **V3** | 500-700 mots | Self-canonical | Contenu suffisamment unique |
| **V4** | 400-500 mots | → V2 | Évite duplicate content, renforce V2 |

```html
<!-- V2 : Self-canonical -->
<link rel="canonical" href="/pieces/plaquettes/renault/clio-3/1-5-dci-90cv.html" />

<!-- V3 : Self-canonical -->
<link rel="canonical" href="/pieces/plaquettes/renault/clio-3/1-5-dci-105cv.html" />

<!-- V4 : Pointe vers V2 -->
<link rel="canonical" href="/pieces/plaquettes/renault/clio-3/1-5-dci-90cv.html" />
```

### Variables Dynamiques Étendues

```typescript
// Variables existantes (DynamicSeoV4UltimateService)
#Gamme#, #VMarque#, #VModele#, #VType#
#VNbCh#, #VAnnee#, #VCodeMoteur#
#MinPrice#, #PrixPasCher#, #VousPropose#
#CompSwitch#, #CompSwitch_1#, #CompSwitch_X_Y#

// NOUVELLES variables pour V2/V3/V4
#NiveauV#              // "V2" | "V3" | "V4"
#NiveauVLabel#         // "Champion" | "Challenger" | "Variante"
#IntervalleKm#         // Spécifique moteur ou défaut template
#MarquesTop3#          // "Brembo, Bosch, Ferodo"
#SymptomesListe#       // Liste symptômes formatée
#VariantesCompatibles# // "1.5 dCi 70cv, 1.5 dCi 105cv"
```

### Avantages de l'Architecture

1. **Pas de duplicate content** : Variables dynamiques = contenu unique par page
2. **Réutilisation système existant** : Étend DynamicSeoV4UltimateService
3. **Maintenance simplifiée** : Un template maître par gamme + énergie
4. **Scalabilité** : Génération automatique V3/V4 depuis template V2
5. **SEO optimisé** : Canonical V4→V2 concentre le link juice
6. **Performance** : Cache multi-niveaux (template 1h + niveau 15min)

### Fichiers à Créer/Modifier (Phase 4)

| Fichier | Action | Description |
|---------|--------|-------------|
| `backend/sql/015-create-gamme-content-template.sql` | CRÉER | Tables template + niveau |
| `backend/src/modules/seo/gamme-content-dynamic.service.ts` | CRÉER | Service génération dynamique |
| `backend/src/modules/seo/dynamic-seo-v4-ultimate.service.ts` | MODIFIER | Ajouter variables |
| `frontend/app/components/gamme/GammeContentDisplay.tsx` | CRÉER | Composant unifié V2/V3/V4 |

### Prochaines Étapes Phase 4

1. **Créer migration SQL** : Tables `__gamme_content_template` + `__gamme_content_niveau`
2. **Étendre service SEO** : Ajouter nouvelles variables dans `DynamicSeoV4UltimateService`
3. **Créer service contenu** : `GammeContentDynamicService` avec logique héritage
4. **Créer composant unifié** : `GammeContentDisplay` (affiche V2/V3/V4 selon niveau)
5. **Intégrer canonical** : Logique V4→V2 dans loader gamme
6. **Peupler templates** : Créer templates maîtres pour gammes G1

---

## 24. Phase 5 : Contenu V5 (Bloc B - Enrichissement Silo)

### Spécification Contenu V5

```
V5 = CONTENU BLOC B (MÊME STRUCTURE QUE V3/V4)

Objectifs stratégiques :
→ Enrichissement du silo technique
→ Capture ultra-long-tail
→ Renforcement de l'autorité technique d'Automecanik
→ Éviter toute concurrence directe avec V1–V4

Rôle :
→ Pages "véhicule → pièces" (Bloc B)
→ Contenu hérité du template V2 (comme V3/V4)
→ Canonical vers V2 (concentration link juice)
→ Variables dynamiques personnalisées pour long-tail
```

### Différence V5 vs V3/V4

| Critère | V3/V4 (Bloc A) | V5 (Bloc B) |
|---------|----------------|-------------|
| **Type de recherche** | "gamme + véhicule" | "véhicule + pièce" |
| **Exemple** | "plaquettes clio 3 1.5 dci" | "clio 3 1.4 i bougies" |
| **SEO Target** | Gamme spécifique | Ultra-long-tail |
| **Contenu** | Hérité template V2 | Hérité template V2 |
| **Canonical** | V3=self, V4→V2 | **V5 → V2** |
| **Compétition** | Directe avec V2 | **Aucune** (Bloc B) |

### Stratégie V5 : Enrichissement Sans Concurrence

```
┌─────────────────────────────────────────────────────────────┐
│  BLOC A : V2/V3/V4 (gamme → véhicule)                       │
│  Compétition directe pour les mêmes requêtes                │
│                                                              │
│  V2 = Champion #1 (canonical maître)                        │
│  V3 = Challengers (self-canonical)                          │
│  V4 = Variantes (canonical → V2)                            │
└─────────────────────────────────────────────────────────────┘
                          ↕ (séparé - pas de compétition)
┌─────────────────────────────────────────────────────────────┐
│  BLOC B : V5 (véhicule → pièce)                             │
│  Requêtes DIFFÉRENTES (pas de compétition V1-V4)            │
│                                                              │
│  V5 = Enrichissement silo (canonical → V2 G1)               │
│       → Renforce autorité V2 sans compétition               │
│       → Capture ultra-long-tail                             │
└─────────────────────────────────────────────────────────────┘
```

### Structure de Contenu V5 (Identique V3/V4)

| Section | Contenu | Longueur |
|---------|---------|----------|
| **Intro** | Pièce pour ce moteur spécifique | 100-150 mots |
| **Symptômes** | Signes d'usure spécifiques | 100-150 mots |
| **Compatibilités** | Variantes compatibles | 80-100 mots |
| **Entretien** | Conseils maintenance | 80-100 mots |
| **Conclusion** | CTA vers catalogue | 50 mots |
| **TOTAL** | | **400-550 mots** |

### Table SQL : Extension pour V5

```sql
-- V5 utilise la MÊME table que V3/V4 (__gamme_content_niveau)
-- Colonne gcn_niveau_v = 'V5'
-- Canonical TOUJOURS vers V2

-- Ajouter 'V5' aux valeurs possibles
ALTER TABLE __gamme_content_niveau
  DROP CONSTRAINT IF EXISTS gcn_niveau_v_check;

ALTER TABLE __gamme_content_niveau
  ADD CONSTRAINT gcn_niveau_v_check
  CHECK (gcn_niveau_v IN ('V2', 'V3', 'V4', 'V5'));

-- Contrainte : V5 DOIT avoir un canonical vers V2
-- (pas self-canonical comme V3)

-- Index pour requêtes V5 (Bloc B)
CREATE INDEX IF NOT EXISTS idx_gamme_content_niveau_v5
  ON __gamme_content_niveau(gcn_niveau_v)
  WHERE gcn_niveau_v = 'V5';
```

### Variables Spécifiques V5

```typescript
// Variables V5 = identiques V3/V4 + spécifiques Bloc B
#NiveauV#              // "V5"
#NiveauVLabel#         // "Enrichissement"
#BlocType#             // "B" (vs "A" pour V2/V3/V4)
#RequeteType#          // "véhicule → pièce"

// Variables Bloc B spécifiques
#VehiculeFirst#        // "Clio 3 1.4 i"
#PiecesDemandees#      // "bougies, bobine allumage, filtre air"
#TopGammeVehicule#     // Liste gammes G1 pour ce véhicule
```

### Stratégie de Canonical V5

```
┌─────────────────────────────────────────────────────────────┐
│  RÈGLE ABSOLUE : V5 → V2 (toujours)                         │
│                                                              │
│  Raison :                                                    │
│  - V5 enrichit le silo SANS compétition                     │
│  - Link juice concentré sur V2 (champion)                   │
│  - Pas de duplicate content                                  │
│  - Ultra-long-tail capté sans cannibalisation               │
└─────────────────────────────────────────────────────────────┘
```

```html
<!-- V5 : TOUJOURS canonical vers V2 -->
<link rel="canonical" href="/pieces/bougies/renault/clio-3/1-4-i.html" />
<!-- Pointe vers V2 même si recherche était "clio 3 1.4 i bougies" -->
```

### Avantages Contenu V5

1. **Pas de compétition V1-V4** : Bloc B = requêtes différentes
2. **Enrichissement silo** : Plus de pages = plus d'autorité
3. **Ultra-long-tail** : Capture requêtes véhicule-first
4. **Link juice concentré** : Canonical → V2 renforce champion
5. **Réutilisation template** : Même structure que V3/V4
6. **Autorité technique** : Plus de contenu technique = confiance

### Tableau Récapitulatif V1 → V5 (FINAL)

| Niveau | Bloc | Longueur | Canonical | Usage SEO |
|--------|------|----------|-----------|-----------|
| **V1** | - | 800-1200 | Self | Page modèle (encyclopédique) |
| **V2** | A | 700-1000 | Self | Champion gamme (conversion) |
| **V3** | A | 500-700 | Self | Challengers (enrichissement) |
| **V4** | A | 400-500 | → V2 | Variantes (link juice → V2) |
| **V5** | **B** | 400-550 | → V2 | Ultra-long-tail (silo enrichi) |

### Hiérarchie de Contenu Complète

```
┌─────────────────────────────────────────────────────────────┐
│  V1 = CONTENU MODÈLE (800-1200 mots)                        │
│  Page encyclopédique, référence constructeur                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  V2 = CONTENU CHAMPION GAMME (700-1000 mots)                │
│  Template maître, self-canonical                             │
│  Concentre tout le link juice de V4 et V5                   │
└───────────────────────┬─────────────────────────────────────┘
                        │ héritage
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  V3 (Bloc A)│ │  V4 (Bloc A)│ │  V5 (Bloc B)│
│  500-700    │ │  400-500    │ │  400-550    │
│  Self-canon │ │  → V2       │ │  → V2       │
│  Challengers│ │  Variantes  │ │  Long-tail  │
└─────────────┘ └─────────────┘ └─────────────┘
                        │             │
                        └─────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  V2 = CANONICAL │
                    │  MAÎTRE         │
                    │  (link juice)   │
                    └─────────────────┘
```

### Fichiers à Modifier (Phase 5)

| Fichier | Action | Description |
|---------|--------|-------------|
| `backend/sql/015-create-gamme-content-template.sql` | MODIFIER | Ajouter V5 à la contrainte |
| `backend/src/modules/seo/gamme-content-dynamic.service.ts` | MODIFIER | Gérer V5 comme V3/V4 |
| `frontend/app/components/gamme/GammeContentDisplay.tsx` | MODIFIER | Afficher V5 |

### Prochaines Étapes Phase 5

1. **Modifier contrainte SQL** : Ajouter 'V5' aux valeurs possibles de `gcn_niveau_v`
2. **Étendre service** : Traiter V5 comme V4 (canonical → V2)
3. **Ajouter variables Bloc B** : `#BlocType#`, `#RequeteType#`, etc.
4. **Créer index V5** : Optimiser requêtes Bloc B
5. **Peupler données V5** : Générer contenu pour véhicules Bloc B
6. **Valider silo** : Vérifier que V5 enrichit sans compétition

---

## 25. RÉSUMÉ FINAL : Architecture Contenu V1 → V5

### Tableau de Synthèse

| Phase | Niveau | Type Page | Longueur | Canonical | Objectif |
|-------|--------|-----------|----------|-----------|----------|
| 2 | **V1** | Modèle | 800-1200 | Self | Encyclopédique |
| 3 | **V2** | Gamme Champion | 700-1000 | Self | Conversion |
| 4 | **V3** | Gamme Challenger | 500-700 | Self | Enrichissement |
| 4 | **V4** | Gamme Variante | 400-500 | → V2 | Link juice |
| 5 | **V5** | Bloc B Long-tail | 400-550 | → V2 | Silo + Autorité |

### Principes Clés

1. **V1 = Indépendant** : Page modèle, pas de relation gamme
2. **V2 = Maître** : Template source, canonical final
3. **V3/V4 = Bloc A** : Héritage V2, compétition directe
4. **V5 = Bloc B** : Héritage V2, **PAS de compétition** (requêtes différentes)
5. **Canonical V4/V5 → V2** : Concentration link juice sur champion

### Workflow de Génération

```
1. Créer template V2 (maître)
   ↓
2. Générer V3/V4 (Bloc A - gamme → véhicule)
   ↓
3. Générer V5 (Bloc B - véhicule → pièce)
   ↓
4. Tous pointent vers V2 (canonical)
   ↓
5. V2 concentre autorité SEO
```

### 11 Règles Officielles V1-V5 (MISE À JOUR)

```
1) V2 séparé Essence/Diesel
   → Calcul V2 TOUJOURS séparé par énergie

2) V2 = Champion #1 (UNIQUE par gamme + modèle + énergie)
   → PAS de seuil, simplement le #1 Google

3) V1 = variante la plus souvent V2 (inter-gammes)
   → Calculé par modèle + énergie

4) Un modèle peut avoir V1 Diesel + V1 Essence
   → Deux V1 séparés par énergie

5) V3 = positions #2, #3, #4... (recherchés mais pas #1)
   → Car il ne peut y avoir qu'1 seul V2 par gamme

6) V2 peut changer par gamme, V1 stable
   → V1 = référence modèle, V2 = champion local

7) V1 ne dépend pas des gammes
   → V1 est inter-gammes, V2 est par gamme

8) V4 = variantes/déclinaisons de V3
   → Break, BVA, 4x4... du même moteur que V3

9) V4 hérite du moteur V3
   → Différentes configurations, même base

10) V5 = Bloc B (véhicule → pièces) → G1 par défaut
    → Recherche inverse, SEO G1 automatique

11) V5 = même contenu que V3/V4 (hérité du template V2)
    → Enrichissement silo, ultra-long-tail
    → Renforce autorité technique Automecanik
    → PAS de compétition avec V1-V4 (Bloc B séparé)
```

---

## 26. Règle V2 — Méthodologie Officielle de Sélection par Volume Google

### Principe Fondamental

```
┌─────────────────────────────────────────────────────────────┐
│  ✅ ON DÉTERMINE TOUJOURS LE V2 EN PREMIER                  │
│  ✅ La recherche "sans gamme" = SECOURS uniquement          │
└─────────────────────────────────────────────────────────────┘
```

### Ordre de Priorité

```
1️⃣ V2 d'abord (avec gamme)
2️⃣ Si blocage → recherche véhicule "pur" pour aider à décider
```

### Étape 1 : Sélection V2 par Volume [Pièce + Véhicule] (PRIORITAIRE)

Pour une gamme donnée (ex : plaquettes) et un modèle (Clio 3 diesel) :

1. Lister toutes les variantes
2. Collecter les volumes Google pour : `[pièce] + [modèle] + [motorisation]`
3. **V2 = variante avec le volume le plus élevé** (UNIQUE par gamme)

**Exemple concret :**

| Variante | Requête Google | Volume |
|----------|----------------|--------|
| 1.5 dCi 65 | "plaquette frein clio 3 1.5 dci 65" | 150 |
| 1.5 dCi 80 | "plaquette frein clio 3 1.5 dci 80" | 320 |
| 1.5 dCi 86 | "plaquette frein clio 3 1.5 dci 86" | 450 |
| 1.5 dCi 90 | "plaquette frein clio 3 1.5 dci 90" | **900** |
| 1.5 dCi 105 | "plaquette frein clio 3 1.5 dci 105" | 420 |

**Résultat** : V2 = 1.5 dCi 90cv (volume le plus élevé)

**Cas normal (80% du temps)** : Une variante domine clairement → V2 déterminé directement.

### Cas de Blocage (quand activer le Plan B)

On considère qu'on n'arrive pas à choisir le V2 quand :

| Situation | Exemple | Action |
|-----------|---------|--------|
| **Aucun volume clair** | Tous à 0 ou quasi identiques (10/20/15/5) | → Plan B |
| **Égalité trop forte** | 900 vs 880 (trop proche pour trancher) | → Plan B |
| **Données instables** | Résultats génériques/mélangés | → Plan B |

### Étape 2 : Plan B — Départage par Volume [Véhicule Seul]

Si blocage à l'étape 1, utiliser les volumes de recherche SANS gamme :

| Variante | Requête Google | Volume |
|----------|----------------|--------|
| 1.5 dCi 90 | "clio 3 1.5 dci 90" | **12 000** |
| 1.5 dCi 105 | "clio 3 1.5 dci 105" | 2 500 |

**Résultat** : 90cv = modèle dominant globalement → **V2 = 90cv**

La recherche véhicule "pur" sert de "juge de paix" pour départager.

### Schéma Décisionnel

```
┌─────────────────────────────────────────────────────────────┐
│  ÉTAPE 1 : Volume [pièce + véhicule]                        │
│  Ex: "plaquette frein clio 3 1.5 dci 90"                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
    ┌─────────────────┐   ┌─────────────────┐
    │  Leader clair   │   │  Pas de leader  │
    │  (80% des cas)  │   │  ou égalité     │
    └────────┬────────┘   └────────┬────────┘
             │                     │
             ▼                     ▼
    ┌─────────────────┐   ┌─────────────────┐
    │  V2 = variante  │   │  ÉTAPE 2 :      │
    │  avec + de vol. │   │  Plan B         │
    └─────────────────┘   └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  Volume         │
                          │  [véhicule seul]│
                          │  pour trancher  │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  V2 = variante  │
                          │  globalement    │
                          │  dominante      │
                          └─────────────────┘
```

### Règle Officielle Résumée

```
Règle V2 — Sélection par volume Google

1. On détermine TOUJOURS le V2 en premier, à partir des volumes de recherche
   Google sur la combinaison [pièce + modèle + motorisation], séparée Essence/Diesel.

2. Une seule variante peut être V2 pour une gamme donnée.

3. Si les données sont insuffisantes ou trop proches (aucun leader clair),
   on utilise alors les volumes de recherche sans gamme ([modèle + motorisation])
   comme critère de départage pour choisir le V2.
```

### Important : Ce que cette règle précise

| Aspect | Clarification |
|--------|---------------|
| **Priorité** | V2 TOUJOURS déterminé EN PREMIER |
| **Méthode principale** | Volumes [pièce + véhicule] |
| **Méthode secours** | Volumes [véhicule seul] = juge de paix |
| **Condition secours** | Uniquement si pas de leader clair |
| **Unicité** | 1 seul V2 par gamme + modèle + énergie |
