# Cahier des Charges : Système de Classement par Niveaux (G + V)

## Résumé Exécutif

Système de classification automatique des gammes et véhicules par niveau SEO, basé sur les données de recherche Google, pour optimiser le catalogue de pièces automobiles.

**Stack technique :** n8n (no-code) + Google Sheets + API Google (Autosuggest + Keyword Planner)

### DOUBLE SYSTÈME DE CLASSIFICATION

| Système | Cible | Niveaux | Description |
|---------|-------|---------|-------------|
| **Système G** | GAMMES (familles de pièces) | G1, G2, G3, G4 | Classification des produits |
| **Système V** | VÉHICULES | V1, V2, V3, V4, V5, V6 | Classification des motorisations |

> **MISE A JOUR v4.1 (2026-02-10)** : V-levels classent les VEHICULES (type_ids), pas les keywords. Phase T = trier keywords (CSV + volume). Phase V = classer vehicules (type_ids apres match backfill). V3/V4 redefinies.

```
┌─────────────────────────────────────────────────────────────┐
│  SYSTÈME G (Gammes)          │  SYSTÈME V (Véhicules)       │
│  ─────────────────          │  ─────────────────────       │
│  G1 = Gammes prioritaires   │  V1 = Top V2 inter-gammes    │
│  G2 = Gammes secondaires    │  V2 = Top V3 promus (gamme)  │
│  G3 = Gammes enfants        │  V3 = type_id matché backfill│
│  G4 = Gammes catalogue-only │  V4 = dans CSV, pas matché   │
│                             │  V5 = DB, pas dans le CSV    │
│                             │  V6 = DB, aucune gamme       │
└─────────────────────────────────────────────────────────────┘
```

### BONUS : Combinaison V4 + G

Pour les véhicules **V4** (dans le CSV mais pas le match principal), on ajoute le niveau G pour affiner :

| Combinaison | Signification | Exemple |
|-------------|---------------|---------|
| **V4 + G1** | Véhicule dans le CSV, gamme importante | Clio 1.5 dCi 86cv → disque de frein |
| **V4 + G2** | Véhicule dans le CSV, gamme secondaire | Clio 1.5 dCi 86cv → silent bloc |

---

## 1. Principes Fondamentaux

### Deux Phases (v4.1)

```
┌──────────────────────────────────────────────────────────────┐
│  PHASE T : Trier les KEYWORDS (CSV + volume)                 │
│                                                              │
│  Keywords : "disque frein clio 3 1.5 dci"                    │
│              ──────────── ──────────────                     │
│                 gamme        véhicule                        │
│                                                              │
│  Le volume sert à trier les keywords, pas les véhicules.     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  PHASE MATCH : Keywords → type_ids (backfill RPC)            │
│                                                              │
│  Chaque keyword est associé à un type_id via le backfill.    │
│  Le type_id matché = match principal.                         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  PHASE V : Classer les VEHICULES (type_ids uniquement)       │
│                                                              │
│  V3 = type_id matché par backfill (match principal)          │
│  V4 = type_id dans CSV, pas le match principal               │
│  V5 = type_id en DB, même modèle, hors CSV                  │
│  V6 = type_id en DB, aucune gamme                            │
│  V2 = top 10 modèles promus depuis V3                        │
│  V1 = modèle V2 dans ≥30% des gammes                        │
└──────────────────────────────────────────────────────────────┘
```

### Règle Critique (v4.1)

**Les V-levels ne regardent PAS le volume. Le volume est déjà trié par les T.**

- V3 = type_id matché par le backfill (match principal)
- V4 = type_id dans le CSV mais pas le match principal (a un type_id)
- V2 promu depuis top 10 V3
- V5/V6 = véhicules DB, jamais promus en V2/V3

---

## 2. Architecture des Niveaux

### Vue d'Ensemble (Système V - Véhicules) — v4.1

```
              Phase T                    Phase MATCH              Phase V
          (trier keywords)           (keywords → type_ids)    (classer vehicules)
                │                          │                       │
                ▼                          ▼                       ▼
       ┌─────────────────┐      ┌──────────────────┐    ┌───────────────────┐
       │ CSV Keyword      │      │ Backfill RPC     │    │ type_id matché    │
       │ Planner          │──▶   │ assigne type_id  │──▶ │ = V3              │
       │ (texte + volume) │      │ à chaque keyword │    │                   │
       └─────────────────┘      └──────────────────┘    │ type_id dans CSV  │
                                                         │ pas matché = V4   │
                                                         └─────────┬─────────┘
                                                                   │
       ┌──────────────────────────────────────────────────────────┘
       │
       ▼                    ▼                    ▼
┌────────────┐       ┌────────────┐       ┌────────────┐
│    V5      │       │    V6      │       │ Top 10 V3  │
│ (DB, même  │       │ (DB, dans  │       │ → V2       │
│  modèle,   │       │  aucune    │       │            │
│  hors CSV) │       │  gamme)    │       │ Inter-gammes│
└────────────┘       └────────────┘       │ → V1       │
                                          └────────────┘
```

### Définition des Niveaux Véhicules (Système V) — v4.1

> **Note :** Cette section décrit le **Système V** (véhicules). Voir Section 3 pour le **Système G** (gammes).
> **Mise à jour v4.1 (2026-02-10)** : V-levels classent les VEHICULES (type_ids), pas les keywords. Phase T trie les keywords, Phase V classe les véhicules.

| Niveau V | Source | Définition | Exemple |
|----------|--------|------------|---------|
| **V1** | Inter-gammes | Modèle V2 dans ≥30% des gammes | Clio 3 1.5 dCi 90cv |
| **V2** | Gamme | Top 10 modèles promus depuis V3 | Clio 3 1.5 dCi 90cv (disque frein) |
| **V3** | CSV | type_id matché par le backfill (match principal) | 207 1.6 HDI 16V 90ch |
| **V4** | CSV | type_id dans le CSV, pas le match principal | 207 1.4 HDI 68ch |
| **V5** | DB | En DB, PAS dans le CSV, mais modèle a des V3 dans cette gamme | 207 1.6 HDI 92ch |
| **V6** | DB | En DB, dans AUCUNE gamme (global) | Lada Niva 1.7 |

### Points Critiques

- **Phase T** = trier les KEYWORDS avec le CSV (texte + volume)
- **Phase V** = classer les VEHICULES avec les type_ids (après match backfill)
- **Les V-levels ne regardent PAS le volume.** Le volume est déjà trié par les T.
- **V3** = le type_id que le backfill RPC a choisi comme match principal
- **V4** = un type_id qui a des keywords CSV associés, mais qui n'est pas le match principal
- **V5** = véhicules DB dont le modèle apparaît dans la gamme via CSV, mais eux-mêmes absents du CSV
- **V6** = véhicules DB qui n'apparaissent dans aucune gamme (classification globale)
- **Classification bottom-up** : V3 identifié par backfill → V4 = dans CSV pas matché → V2 promu depuis top 10 V3 → V1 inter-gammes
- Le niveau V est **PAR GAMME** (un véhicule peut être V3 pour "disque frein" et V4 pour "embrayage")
- **Essence et Diesel ne se mélangent JAMAIS** dans les calculs

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

### DOUBLE SYSTÈME : Gammes (G) + Véhicules (V) — v4.0

**IMPORTANT :** Deux systèmes indépendants mais compatibles !

```
┌─────────────────────────────────────────────────────────────┐
│  SYSTÈME G (Gammes)          SYSTÈME V (Véhicules) v4.0    │
│  ─────────────────          ─────────────────────────────  │
│  G1 = Gammes prioritaires   V1 = Top V2 inter-gammes       │
│  G2 = Gammes secondaires    V2 = Top V3 promus (gamme)     │
│  G3 = Gammes enfants        V3 = Champion #1 par groupe    │
│  G4 = Gammes catalogue-only V4 = Reste CSV (volume > 0)    │
│                             V5 = DB hors CSV, modèle lié   │
│                             V6 = DB, aucune gamme           │
└─────────────────────────────────────────────────────────────┘
```

---

## 3bis. Système V (Niveaux Véhicules) — v4.0

### Règle Fondamentale : Classification bottom-up V3 → V2 → V1

**IMPORTANT (v4.0) :** La classification est **bottom-up**. V3 est élu en premier, puis V2 est promu, puis V1 émerge inter-gammes. Tous les V ont un **type_id** (véhicule réel en DB).

```
CLASSIFICATION v4.0 (bottom-up) :
──────────────────────────────────
V3 = champion #1 par groupe [gamme+modèle+énergie], dans le CSV
V4 = reste du groupe, dans le CSV, volume > 0
V2 = top 10 V3 promus par score_seo dans la gamme
V1 = top V2 inter-gammes (calculé après plusieurs gammes)
V5 = en DB, PAS dans le CSV, mais modèle a des V3/V4 dans cette gamme
V6 = en DB, dans AUCUNE gamme (classification globale)

score_seo = volume × (1 + nb_v4 / 5)
```

**V1 et V2** — Deux niveaux complémentaires avec scopes différents.

| Niveau | Définition | Source | Usage |
|--------|------------|--------|-------|
| **V1** | Top V2 inter-gammes (modèle + énergie) | Inter-gammes | Canonical constructeur |
| **V2** | Top 10 V3 promus par score_seo | Gamme | Canonical gamme |
| **V3** | Champion #1 par groupe [gamme+modèle+énergie] | CSV | Page enrichie |
| **V4** | Reste du CSV, volume > 0 | CSV | Pages secondaires |
| **V5** | En DB, modèle présent dans gamme, hors CSV | DB | Compatibilité étendue |
| **V6** | En DB, dans aucune gamme | DB | Catalogue interne |

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

## REGLES OFFICIELLES V-LEVEL v4.0 (VALIDEE 2026-02-10)

### Tableau Officiel des Niveaux V (v4.0)

| Niveau | Définition | Portée | Méthode de calcul | Exemple |
|--------|------------|--------|-------------------|---------|
| **V1** | Top V2 inter-gammes | Global (model-level) | Type_id qui apparaît le plus souvent comme V2 dans plusieurs gammes | Clio 3 V1 = 1.5 dCi 90cv Diesel |
| **V2** | Top V3 promus par score_seo | Local (gamme-level) | Top 10 V3 classés par score_seo DESC | Disque frein : 308 diesel = 1.6 HDi 92cv |
| **V3** | Champion #1 par groupe | Local (groupe-level) | Champion du groupe [gamme+modèle+énergie], volume DESC, keyword length ASC | 308 diesel : 1.6 HDi 92cv (volume 600) |
| **V4** | Reste du CSV | Local | Dans le CSV, dans le groupe, mais pas champion — volume > 0 | 308 diesel : 1.6 HDi 112cv (volume 150) |
| **V5** | DB hors CSV, modèle présent | Local | En DB, PAS dans le CSV, mais son modèle a des V3/V4 dans cette gamme | 308 diesel : 1.6 HDi 75cv (pas dans CSV) |
| **V6** | DB, aucune gamme | Global | En DB, n'apparaît dans AUCUNE gamme | Lada Niva 1.7 |
| **Séparation Ess/Diesel** | Obligatoire | **TOUS les niveaux (V1-V6)** | Calcul séparé pour chaque énergie | V5 Diesel ≠ V5 Essence |

### Exemple Concret — Gamme "disque de frein", 308 Diesel

| type_id | Variante | Dans CSV | Volume | V-Level | score_seo |
|---------|----------|----------|--------|---------|-----------|
| 8201 | 1.6 HDi 92cv | oui | 600 | **V3** (champion) → **V2** (promu) | 600 × (1 + 1/5) = 720 |
| 8202 | 1.6 HDi 112cv | oui | 150 | **V4** | — |
| 8205 | 1.6 HDi 75cv | non | — | **V5** | — |
| 8230 | 2.0 HDi 163cv | non | — | **V5** | — |
| 9999 | Lada Niva 1.7 | non | — | **V6** (aucune gamme) | — |

### 12 Règles Officielles v4.0

```
1) La classification est BOTTOM-UP : V3 élu en premier, puis V2 promu, puis V1 inter-gammes.
   Tous les niveaux V sont séparés Essence / Diesel.

2) V3 = champion #1 par groupe [gamme + modèle + énergie].
   → Tri : volume DESC, keyword length ASC
   → UNIQUE par groupe (1 seul V3 par modèle+énergie dans une gamme)
   → Doit être dans le CSV (keyword Google)

3) V4 = reste du groupe, dans le CSV, volume > 0.
   → Tous les keywords véhicule du CSV qui ne sont pas V3
   → Pas de V4 pour volume = 0 (ces keywords restent non classés)

4) V2 = top 10 V3 promus par score_seo dans la gamme.
   → score_seo = volume × (1 + nb_v4 / 5)
   → nb_v4 = nombre de V4 dans le même groupe que ce V3
   → Les 10 V3 avec le score_seo le plus élevé deviennent V2
   → V2 remplace V3 (un keyword est V2 OU V3, jamais les deux)

5) V1 = top V2 inter-gammes (calculé APRÈS plusieurs gammes).
   → V1 = type_id qui apparaît le plus souvent comme V2 dans ≥ 30% des gammes G1
   → V1 ne dépend PAS d'une gamme — c'est un niveau GLOBAL par modèle + énergie
   → Un modèle peut avoir V1 Diesel + V1 Essence

6) V5 = type_id en DB, PAS dans le CSV, mais son modèle a des V3/V4 dans cette gamme.
   → Trouvé via jointure auto_type → auto_modele → siblings dans la gamme
   → Permet de couvrir les véhicules DB non présents dans les keywords Google
   → V5 a TOUJOURS un type_id valide

7) V6 = type_id en DB qui n'apparaît dans AUCUNE gamme (ni via CSV ni via V5).
   → Classification globale, pas par gamme
   → Utile pour identifier les véhicules orphelins du catalogue
   → V6 a TOUJOURS un type_id valide

8) Tous les V (V1 à V6) ont un type_id = véhicule réel dans auto_type.
   → Le backfill type_id se fait via RPC `backfill_seo_keywords_type_ids`
   → Les keywords sans type_id ne participent PAS au classement V

9) score_seo détermine la promotion V3 → V2 :
   → score_seo = volume × (1 + nb_v4 / 5)
   → Un V3 avec beaucoup de V4 dans son groupe = score élevé = priorité V2
   → Cela favorise les champions de groupes riches (beaucoup de variantes)

10) Essence et Diesel ne se mélangent JAMAIS dans les calculs.
    → Chaque groupe = [gamme + modèle + énergie]
    → V2 Diesel et V2 Essence sont calculés SÉPARÉMENT
    → Gammes spécifiques (FAP=diesel, Bougies=essence) n'ont qu'une énergie

11) V1 SEUIL : V1 requiert une dominance significative.
    → V1 = type_id V2 dans ≥ 30% des gammes G1 du même modèle+énergie
    → Si aucun type_id ≥ 30%, prendre celui avec le plus de répétitions V2
    → Départage ex-aequo : volume Google TOTAL le plus élevé

12) Le pipeline d'import est : T1(pertinence) → T2(exclusion) → T3(catégorisation)
    → T4(véhicules seulement) → V3/V4 → backfill type_id → V2 → V5 → V6 → V1
    → Script CLI : `scripts/insert-missing-keywords.ts`
    → Service backend : `gamme-vlevel.service.ts` (recalcul V2/V3/V4)
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

### Clarification V5 — Véhicules DB hors CSV (v4.0)

> **MISE A JOUR v4.0 :** V5 n'est plus "Bloc B / recherche inverse". V5 = type_ids en DB dont le modèle a des V3/V4 dans cette gamme, mais PAS eux-mêmes dans le CSV.

**V5 = type_id en DB, PAS dans le CSV, modèle présent dans la gamme**

**STRUCTURE v4.0 :**
```
┌─────────────────────────────────────────────────────────────┐
│  CSV (keywords Google Ads Keyword Planner)                  │
│  → V3 = champion #1 par groupe [gamme+modèle+énergie]      │
│  → V4 = reste du groupe, volume > 0                         │
│  → V2 = top 10 V3 promus par score_seo                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  DB (auto_type → auto_modele)                               │
│  → V5 = modèle présent dans gamme (via V3/V4), hors CSV    │
│  → V6 = modèle absent de TOUTE gamme                        │
└─────────────────────────────────────────────────────────────┘
```

| Niveau | Source | Définition | Usage |
|--------|--------|-----------|-------|
| V3/V4 | CSV | Keywords trouvés dans le CSV | Pages SEO gamme |
| V5 | **DB** | **Type_id en DB, modèle lié, hors CSV** | **Compatibilité étendue** |
| V6 | **DB** | **Type_id en DB, aucune gamme** | **Catalogue interne** |

**Pourquoi V5 existe :**
- Couvrir les véhicules DB non présents dans le CSV Google
- Enrichir la compatibilité des pages gamme
- Chaque V5 a un type_id valide (véhicule réel)
- Trouvé via jointure : auto_type → auto_modele → siblings dans la gamme

**Exemple — Gamme "disque de frein", 308 Diesel :**

| type_id | Variante | Dans CSV | V-Level |
|---------|----------|----------|---------|
| 8201 | 1.6 HDi 92cv | oui | **V3** (champion) |
| 8202 | 1.6 HDi 112cv | oui | **V4** |
| 8205 | 1.6 HDi 75cv | non | **V5** (DB sibling) |
| 8230 | 2.0 HDi 163cv | non | **V5** (DB sibling) |

**Schéma Final v4.0 :**

```
Gamme (ex : disque de frein)
│
├── CSV (keywords Google)
│   ├── V3 : champion #1 par groupe
│   ├── V4 : reste du CSV
│   └── V2 : top 10 V3 promus (score_seo)
│
├── DB (véhicules liés)
│   └── V5 : type_ids DB dont modèle a V3/V4
│
├── DB (orphelins)
│   └── V6 : type_ids DB dans aucune gamme
│
└── Inter-gammes
    └── V1 : top V2 (≥ 30% des G1)
```

---

### Règle Finale : Scopes des Niveaux V (v4.0)

**IMPORTANT :** Il existe **3 scopes** de niveaux V :

| Scope | Niveaux | Source | Définition |
|-------|---------|--------|------------|
| **GLOBAL (modèle)** | **V1** | Inter-gammes | Top V2 inter-gammes (modèle + énergie) |
| **LOCAL (gamme)** | **V2** | CSV (promu) | Top 10 V3 par score_seo |
| **LOCAL (groupe)** | **V3** | CSV | Champion #1 par [gamme+modèle+énergie] |
| **LOCAL (groupe)** | **V4** | CSV | Reste du groupe, volume > 0 |
| **LOCAL (gamme)** | **V5** | DB | Modèle présent dans gamme, hors CSV |
| **GLOBAL (DB)** | **V6** | DB | Type_id dans aucune gamme |

**IMPORTANT :** Tous les niveaux sont TOUJOURS séparés par énergie (Essence / Diesel). Pas de mélange.

**Note :** Chaque modèle peut avoir **2 V1 : un pour Diesel, un pour Essence**. Tous les V ont un type_id.

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

### Algorithme de Classification V v4.0 (bottom-up)

```
# PHASE 1 : Triage CSV (T1-T4)
POUR chaque keyword du CSV:
    T1: keyword contient la gamme ? (pertinence)
    T2: exclure autres gammes (plaquette seule, vanne egr)
    T3: catégoriser (generique / marque / vehicle)
    T4: seuls keywords véhicule participent au classement V

# PHASE 2 : Classification V3/V4 (par groupe)
POUR chaque gamme G:
    POUR chaque groupe [modèle + énergie]:
        # Trier : volume DESC, keyword length ASC
        keywords_csv = SORT(groupe, by=(volume DESC, keyword_length ASC))

        # Champion = V3 (premier avec volume > 0)
        keywords_csv[0] → V3 (champion unique du groupe)

        # Reste = V4 (dans le CSV, volume > 0)
        keywords_csv[1:] → V4

        # Calculer score_seo du champion V3
        nb_v4 = COUNT(V4 dans ce groupe avec volume > 0)
        score_seo = volume_V3 × (1 + nb_v4 / 5)

# PHASE 3 : Promotion V3 → V2 (par gamme)
POUR chaque gamme G:
    champions = TOUS les V3 de cette gamme
    SORT(champions, by=score_seo DESC)
    top_10 = champions[0:10]
    POUR chaque champion dans top_10:
        champion.v_level = V2 (promu)

# PHASE 4 : Backfill type_id (RPC)
POUR chaque keyword véhicule sans type_id:
    → backfill_seo_keywords_type_ids(batch_size, pg_id)
    → Matcher keyword → auto_type via modèle + variant + énergie

# PHASE 5 : V5 (DB hors CSV)
POUR chaque modèle ayant des V3/V4 dans la gamme:
    → Trouver les type_ids DB du même modèle+énergie
    → Exclure ceux déjà dans le CSV (V2/V3/V4)
    → Restants = V5

# PHASE 6 : V6 (aucune gamme)
POUR chaque type_id en DB:
    SI n'apparaît dans AUCUNE gamme (ni CSV ni V5):
        → V6

# PHASE 7 : V1 (inter-gammes, après plusieurs gammes)
POUR chaque modèle + énergie:
    Compter les apparitions comme V2 par gamme G1
    SI ≥ 30% des G1 → V1
```

**Formule score_seo :**

```
score_seo = volume × (1 + nb_v4 / 5)

Exemple : V3 avec volume=600 et 1 V4 dans son groupe
→ score_seo = 600 × (1 + 1/5) = 720

Exemple : V3 avec volume=300 et 4 V4 dans son groupe
→ score_seo = 300 × (1 + 4/5) = 540
```

### Tableau Récapitulatif Critères V (v4.0)

| Niveau | Définition | Source | Usage |
|--------|------------|--------|-------|
| **V1** | Top V2 inter-gammes (modèle + énergie) | Inter-gammes | Canonical constructeur |
| **V2** | Top 10 V3 promus par score_seo | Gamme (CSV) | Canonical gamme |
| **V3** | Champion #1 par groupe [gamme+modèle+énergie] | CSV | Page enrichie |
| **V4** | Reste du CSV, volume > 0 | CSV | Pages secondaires |
| **V5** | DB, modèle présent dans gamme, hors CSV | DB | Compatibilité étendue |
| **V6** | DB, dans aucune gamme | DB | Catalogue interne |

**Règle clé :** V2/V3/V4 = keywords CSV, V5 = véhicules DB liés, V6 = véhicules DB orphelins, V1 = agrégation inter-gammes.

### Tableau Récapitulatif Double Système

| Gammes (G) | Description | Véhicules (V) | Description |
|------------|-------------|---------------|-------------|
| **G1** | Gammes prioritaires | **V1** | Top V2 inter-gammes |
| **G2** | Gammes secondaires | **V2** | Top V3 promus (gamme) |
| **G3** | Gammes enfants | **V3** | Champion #1 par groupe |
| **G4** | Gammes catalogue-only | **V4** | Reste CSV (volume > 0) |
|        |                       | **V5** | DB hors CSV, modèle lié |
|        |                       | **V6** | DB, aucune gamme |

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
| Top V2 inter-gammes (modèle+énergie) | **V1** | Canonical constructeur |
| Top 10 V3 promus (score_seo) | **V2** | Canonical gamme |
| Champion #1 par groupe | **V3** | Page enrichie (CSV) |
| Reste du CSV, volume > 0 | **V4** | Pages secondaires (CSV) |
| DB, modèle présent, hors CSV | **V5** | Compatibilité étendue (DB) |
| DB, aucune gamme | **V6** | Catalogue interne (DB) |

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

### Sheet 6 : V5 (DB siblings hors CSV) — v4.0

> **v4.0 :** V5 = type_ids en DB dont le modèle a des V3/V4, mais absents du CSV.

| type_id | modèle | variante | source | gamme |
|---------|--------|----------|--------|-------|
| 8205 | 308 | 1.6 HDi 75cv | db_sibling | disque de frein |
| 8230 | 308 | 2.0 HDi 163cv | db_sibling | disque de frein |

**Colonne `source` v4.0 :**
- `csv` = V2/V3/V4 (keywords Google)
- `db_sibling` = V5 (véhicule DB, modèle lié)
- `db_orphan` = V6 (véhicule DB, aucune gamme)

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

### Migration des Données (v4.0)

```sql
-- NOTE v4.0 : Le système v_level est maintenant dans __seo_keywords (VARCHAR(2))
-- Les anciens mappings cgc_level → v_level INTEGER ne sont plus utilisés.
-- La classification v4.0 est bottom-up via le script CLI et le service backend.

-- Table existante (production) :
-- __seo_keywords.v_level VARCHAR(2) CHECK (v_level IN ('V1','V2','V3','V4','V5','V6'))
-- __seo_keywords.score_seo INTEGER
-- __seo_keywords.type_id BIGINT

-- RPC de backfill type_id :
-- SELECT * FROM backfill_seo_keywords_type_ids(batch_size, pg_id)
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

### Structure RPC Combinée (v4.0)

La RPC retourne les deux systèmes :

```sql
SELECT
    gamme,
    vehicule,
    moteur,
    cgc_level,      -- ancien système (interne)
    v_level,        -- système V v4.0 (Google + DB)
    google_volume,
    score_seo,
    type_id
FROM vehicle_gamme_combined
ORDER BY
    CASE v_level
        WHEN 'V1' THEN 1  -- V1 en premier (top inter-gammes)
        WHEN 'V2' THEN 2  -- V2 ensuite (top V3 promus)
        WHEN 'V3' THEN 3  -- V3 ensuite (champions groupes)
        WHEN 'V4' THEN 4  -- V4 ensuite (reste CSV)
        WHEN 'V5' THEN 5  -- V5 (DB hors CSV)
        WHEN 'V6' THEN 6  -- V6 en dernier (aucune gamme)
    END,
    score_seo DESC NULLS LAST,
    google_volume DESC NULLS LAST;
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

**source_type (v4.0) :**
- `csv` = mots-clés du CSV (V2/V3/V4)
- `db_sibling` = véhicules DB liés (V5)
- `db_orphan` = véhicules DB orphelins (V6)

### 9.5 Table `vehicle_gamme_profile` (Profil V1-V6 par gamme) — v4.0

```sql
CREATE TABLE vehicle_gamme_profile (
    gamme_id INTEGER REFERENCES gammes(gamme_id),
    vehicle_id INTEGER REFERENCES vehicles(vehicle_id),
    type_id INTEGER,              -- auto_type.type_id (obligatoire pour tous les V)
    engine_code VARCHAR(20),      -- copié pour éviter joins lourds
    google_volume_gamme_vehicle INTEGER,
    v_level VARCHAR(2) CHECK (v_level IN ('V1','V2','V3','V4','V5','V6')),
    score_seo INTEGER,            -- volume × (1 + nb_v4/5) — pour V3/V2
    g_level INTEGER,              -- 1=G1, 2=G2 (utilisé pour V4 + G)
    is_champion BOOLEAN DEFAULT FALSE,
    cgc_level VARCHAR(2),         -- copie pour comparaison
    notes TEXT,
    PRIMARY KEY (gamme_id, vehicle_id)
);

CREATE INDEX idx_vgp_gamme_level ON vehicle_gamme_profile(gamme_id, v_level);
CREATE INDEX idx_vgp_engine ON vehicle_gamme_profile(gamme_id, engine_code);
CREATE INDEX idx_vgp_v4_g ON vehicle_gamme_profile(v_level, g_level) WHERE v_level = 'V4';
CREATE INDEX idx_vgp_type_id ON vehicle_gamme_profile(type_id);
```

**Table clé** pour construire les listes de motorisations compatibles.
**Note v4.0 :** `type_id` obligatoire pour tous les V. `score_seo` pour promotion V3 → V2.

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
│  BLOC 1 : HÉROS (V2 — top champions promus)                │
├─────────────────────────────────────────────────────────────┤
│  H1 : Disque de frein pour Clio 3 1.5 dCi 90cv             │
│                                                             │
│  • Description longue                                       │
│  • Texte SEO complet                                        │
│  • Liste de pièces principales                              │
│  • Blocs "pourquoi ce modèle est important"                │
│                                                             │
│  Source : __seo_keywords WHERE v_level = 'V2'              │
│  Ordre : score_seo DESC                                    │
├─────────────────────────────────────────────────────────────┤
│  BLOC 2 : CHAMPIONS PAR GROUPE (V3)                         │
├─────────────────────────────────────────────────────────────┤
│  Champions #1 par modèle+énergie (non promus en V2)        │
│                                                             │
│  • 308 1.6 HDi 92cv (champion 308 diesel)                  │
│  • Golf 6 2.0 TDI 140cv (champion Golf diesel)             │
│                                                             │
│  Source : WHERE v_level = 'V3' ORDER BY score_seo DESC     │
├─────────────────────────────────────────────────────────────┤
│  BLOC 3 : AUTRES VARIANTES CSV (V4)                         │
├─────────────────────────────────────────────────────────────┤
│  • 308 1.6 HDi 112cv                                       │
│  • Clio 3 1.5 dCi 86cv                                     │
│                                                             │
│  Source : WHERE v_level = 'V4' ORDER BY volume DESC        │
├─────────────────────────────────────────────────────────────┤
│  BLOC 4 : VÉHICULES COMPATIBLES DB (V5)                    │
├─────────────────────────────────────────────────────────────┤
│  Véhicules en DB dont le modèle est présent dans la gamme  │
│  • 308 1.6 HDi 75cv (pas dans CSV)                         │
│  • 308 2.0 HDi 163cv (pas dans CSV)                        │
│                                                             │
│  Source : WHERE v_level = 'V5'                              │
├─────────────────────────────────────────────────────────────┤
│  BLOC 5 : CATALOGUE COMPLET                                │
├─────────────────────────────────────────────────────────────┤
│  [Voir toutes les motorisations compatibles]                │
│  → V6 non affiché (véhicules sans lien avec cette gamme)   │
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

## 11. Impact Frontend Détaillé (v4.0)

### Impact par Niveau (Véhicules)

| Niveau V | Page Gamme | Page Véhicule | SEO |
|----------|------------|---------------|-----|
| **V1** | Badge "véhicule leader" si V1 inter-gammes | Page pilier modèle | Canonical constructeur, schema.org |
| **V2** | Bloc héros, description complète (top champions) | Lien prioritaire | Meta optimisées, score_seo élevé |
| **V3** | Bloc "Champions par modèle" | Liste gammes | Page enrichie |
| **V4** | Bloc "Autres variantes" | Cross-sell | Pages secondaires |
| **V5** | Bloc "Compatibilité étendue" (DB) | Catalogue | Liens internes |
| **V6** | Non affiché (aucun lien avec la gamme) | Catalogue interne | Pas de SEO |

### Tables Supabase — v4.0

> **Note v4.0 :** La table principale est `__seo_keywords` (déjà en production). Les tables ci-dessous sont la spec de référence pour les structures futures.

```sql
-- Table pour les niveaux G des gammes
ALTER TABLE pieces_gamme ADD COLUMN IF NOT EXISTS g_level INTEGER;
-- G1=prioritaire, G2=secondaire, G3=enfant, G4=catalogue-only

-- Table existante : __seo_keywords (utilisée par v4.0)
-- Colonnes clés : id, keyword, volume, pg_id, energy, model, variant,
--   type, v_level VARCHAR(2), score_seo INTEGER, type_id BIGINT

-- Table pour les niveaux V par gamme/véhicule (spec de référence)
CREATE TABLE vehicle_gamme_levels (
    id SERIAL PRIMARY KEY,
    type_id INTEGER REFERENCES auto_type(type_id),
    pg_id INTEGER REFERENCES pieces_gamme(pg_id),
    v_level VARCHAR(2) CHECK (v_level IN ('V1','V2','V3','V4','V5','V6')),
    score_seo INTEGER,                                 -- volume × (1 + nb_v4/5)
    g_level INTEGER CHECK (g_level IN (1, 2)),        -- G1, G2 (pour V4 uniquement)
    vehicule_exact TEXT,
    vehicule_generique TEXT,
    google_volume INTEGER,
    famille_moteur VARCHAR(20),
    source VARCHAR(20) CHECK (source IN ('csv', 'db_sibling', 'db_orphan')),
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
ON vehicle_gamme_levels(v_level, g_level) WHERE v_level = 'V4';

CREATE INDEX idx_vehicle_gamme_levels_score
ON vehicle_gamme_levels(pg_id, score_seo DESC) WHERE v_level IN ('V2','V3');
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

### Phase 3 : V5/V6 DB (Semaine 3) — v4.0

- [x] V5 : Véhicules DB siblings hors CSV (via auto_modele)
- [x] V6 : Véhicules DB orphelins (aucune gamme)
- [x] Backfill type_id via RPC V2

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
| 1 | V1/V2 | Stock prioritaire (véhicules leaders) |
| 2 | V3 | Stock secondaire (champions de groupe) |
| 3 | V4/V5 | Stock étendu (variantes + DB) |

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

### Effet Domino : Hiérarchie Marketing (v4.0)

```
V1 (top inter-gammes)
 │
 ├── SEO → Page pilier modèle, cluster contenu
 ├── Ads → Google Ads, Meta Ads ciblés
 ├── Email → Séries spécifiques
 ├── Produits → Mise en avant, packs
 ├── Stocks → Priorité approvisionnement
 └── Promotions → Offres ciblées

V2 (top champions promus) → Pages gamme, canonical
V3 (champions par groupe) → Pages enrichies, liens internes
V4 (reste CSV) → Pages secondaires
V5 (DB hors CSV) → Compatibilité étendue, catalogue
V6 (orphelins DB) → Catalogue interne uniquement
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

### Double Système G + V en Une Image (v4.0)

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
│  SYSTÈME V (Véhicules) v4.0 — Classification bottom-up     │
│                                                             │
│   CSV Keyword Planner : "disque frein clio 3 1.5 dci"      │
│                    │                                        │
│           Grouper par [gamme + modèle + énergie]           │
│                    │                                        │
│                    ▼                                        │
│   ┌──────────── PHASE 1 ──────────────┐                    │
│   │  Champion #1 du groupe → V3       │                    │
│   │  Reste du groupe → V4             │                    │
│   └────────────┬──────────────────────┘                    │
│                │                                            │
│   ┌──────────── PHASE 2 ──────────────┐                    │
│   │  Top 10 V3 par score_seo → V2     │                    │
│   │  score = vol × (1 + nb_v4/5)      │                    │
│   └────────────┬──────────────────────┘                    │
│                │                                            │
│   ┌──────────── PHASE 3 ──────────────┐                    │
│   │  Backfill type_id (RPC)           │                    │
│   │  DB siblings hors CSV → V5        │                    │
│   │  DB orphelins → V6                │                    │
│   └────────────┬──────────────────────┘                    │
│                │                                            │
│   ┌──────────── PHASE 4 ──────────────┐                    │
│   │  Inter-gammes : top V2 → V1       │                    │
│   │  (après plusieurs gammes)         │                    │
│   └───────────────────────────────────┘                    │
│                                                             │
│   Résultat : V1 > V2 > V3 > V4 > V5 > V6                 │
│   Tous les V ont un type_id (véhicule réel en DB)          │
└─────────────────────────────────────────────────────────────┘
```

### Tableau Récapitulatif Final (v4.0)

| Gammes (G) | Description | Véhicules (V) | Source | Description |
|------------|-------------|---------------|--------|-------------|
| **G1** | Gammes prioritaires | **V1** | Inter-gammes | Top V2 inter-gammes (modèle + énergie) |
| **G2** | Gammes secondaires | **V2** | Gamme (CSV) | Top 10 V3 promus par score_seo |
| **G3** | Gammes enfants | **V3** | CSV | Champion #1 par groupe [gamme+modèle+énergie] |
| **G4** | Gammes catalogue-only | **V4** | CSV | Reste du CSV, volume > 0 |
|          |                       | **V5** | DB | Modèle présent dans gamme, hors CSV |
|          |                       | **V6** | DB | Aucune gamme (orphelins DB) |

**Classification bottom-up :**
- V3 élu en premier (champion par groupe) → V4 = reste du CSV
- V2 promu depuis top 10 V3 par score_seo → V1 inter-gammes
- V5 = DB siblings hors CSV → V6 = DB orphelins

**score_seo = volume × (1 + nb_v4 / 5)**

**Tous les V ont un type_id** (véhicule réel dans auto_type).

### Avantages Clés (v4.0)

- **Pipeline CLI automatisé** (`scripts/insert-missing-keywords.ts`)
- **Service backend aligné** (`gamme-vlevel.service.ts`)
- **Basé sur Google** (CSV Keyword Planner) + **DB étendue** (V5/V6)
- **Scalable** (100+ gammes, 10 000+ véhicules)
- **Aligné métier** (pièces auto B2B/e-commerce)
- **Terminologie claire** (G pour Gammes, V1-V6 pour Véhicules)
- **Tous les V ont un type_id** (véhicule réel en DB)
- **score_seo** pour promotion objective V3 → V2

**Statut v4.0 :** Pipeline validé sur gamme "disque de frein" (pg_id=82). 84% backfill type_id. Prochaine étape : 2e gamme pour V1 inter-gammes.

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
| **V1** | ⭐ Top inter-gammes (variante dominante modèle) | Bleu foncé |
| **V2** | Top champions promus (score_seo) | Vert |
| **V3** | Champion #1 par groupe | Jaune |
| **V4** | Reste CSV (volume > 0) | Orange |
| **V5** | DB hors CSV (modèle lié) | Gris |
| **V6** | DB orphelin (aucune gamme) | Gris clair |

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
RÉSUMÉ v4.0 (bottom-up) :

1) Classification séparée Essence/Diesel (TOUS les niveaux)

2) V3 = champion #1 par groupe [gamme+modèle+énergie]
   → 1 seul V3 par groupe, tri volume DESC + keyword_length ASC

3) V4 = reste du CSV (volume > 0, pas champion)

4) V2 = top 10 V3 promus par score_seo dans la gamme
   → score_seo = volume × (1 + nb_v4 / 5)

5) V1 = top V2 inter-gammes (modèle + énergie)
   → Requis ≥ 30% des G1 ou plus de répétitions V2

6) V5 = type_ids en DB, modèle a des V3/V4, hors CSV
   → Compatibilité étendue via auto_modele

7) V6 = type_ids en DB, dans aucune gamme (orphelins)

8) Tous les V ont un type_id (véhicule réel en auto_type)

9) Pipeline : T1→T2→T3→T4 → V3/V4 → backfill → V2 → V5 → V6 → V1

10) V1 est GLOBAL (modèle), V2-V5 sont LOCAL (gamme), V6 est GLOBAL (DB)
```

### Schéma Final Complet

```
┌─────────────────────────────────────────────────────────────┐
│  CSV (keywords Google Ads Keyword Planner)                   │
│                                                              │
│  V3 ← V4            V2 (promu)          V1 (inter-gammes)   │
│  │      │             │                    │                 │
│  │      └── reste     └── top 10 V3       └── top V2 ≥30%   │
│  └── champion #1         par score_seo         des G1        │
│      par groupe          = vol×(1+nv4/5)                     │
└─────────────────────────────────────────────────────────────┘
                          ↕ (étendu)
┌─────────────────────────────────────────────────────────────┐
│  DB (auto_type → auto_modele)                               │
│                                                              │
│  V5 = type_ids DB dont modèle a V3/V4 (siblings hors CSV)  │
│  V6 = type_ids DB dans aucune gamme (orphelins)             │
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
| **V5** | Listées dans "compatibilité étendue" (DB siblings) |
| **V6** | Non affiché (orphelins DB, aucune gamme) |

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

## 24. Phase 5 : Contenu V5 (DB Siblings - Compatibilité Étendue) — v4.0

### Spécification Contenu V5 (v4.0)

```
V5 = VÉHICULES DB HORS CSV MAIS MODÈLE LIÉ

v4.0 : V5 n'est plus "Bloc B / recherche inverse".
V5 = type_ids en DB dont le modèle a des V3/V4 dans la gamme,
mais qui ne sont PAS eux-mêmes dans le CSV Google.

Objectifs stratégiques :
→ Couverture exhaustive du catalogue auto_type
→ Compatibilité étendue sur les pages gamme
→ Chaque V5 a un type_id valide
→ Pas de contenu SEO dédié (pages listing seulement)

Rôle :
→ Affichage "Véhicules compatibles supplémentaires"
→ Trouvé via jointure auto_type → auto_modele → siblings
→ Canonical vers la page gamme principale
```

### Différence V3/V4 vs V5 vs V6 (v4.0)

| Critère | V3/V4 (CSV) | V5 (DB sibling) | V6 (DB orphelin) |
|---------|-------------|-----------------|------------------|
| **Source** | CSV Keyword Planner | auto_type DB | auto_type DB |
| **Dans le CSV** | Oui | Non | Non |
| **Modèle lié** | Oui | Oui (même modèle) | Non (aucune gamme) |
| **type_id** | Backfillé (84%) | Toujours (100%) | Toujours (100%) |
| **SEO** | Pages enrichies | Listing compatibilité | Pas de SEO |
| **Canonical** | V3=self, V4→V2 | → page gamme | N/A |

### Stratégie V5 v4.0 : Compatibilité Étendue DB

```
┌─────────────────────────────────────────────────────────────┐
│  CSV (keywords Google)                                       │
│                                                              │
│  V2 = Top 10 V3 promus (canonical maître)                   │
│  V3 = Champions par groupe (self-canonical)                 │
│  V4 = Reste du CSV (canonical → V2)                         │
└─────────────────────────────────────────────────────────────┘
                          ↕ (étendu via DB)
┌─────────────────────────────────────────────────────────────┐
│  DB (auto_type → auto_modele)                                │
│                                                              │
│  V5 = Véhicules DB dont modèle a V3/V4 dans la gamme       │
│       → Listing "véhicules compatibles supplémentaires"     │
│       → Pas de contenu SEO dédié                            │
│       → type_id toujours valide (100%)                      │
│                                                              │
│  V6 = Véhicules DB dans aucune gamme (orphelins)            │
│       → Catalogue interne uniquement                         │
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

-- v4.0 : Ajouter V5/V6 aux valeurs possibles
ALTER TABLE __gamme_content_niveau
  DROP CONSTRAINT IF EXISTS gcn_niveau_v_check;

ALTER TABLE __gamme_content_niveau
  ADD CONSTRAINT gcn_niveau_v_check
  CHECK (gcn_niveau_v IN ('V1', 'V2', 'V3', 'V4', 'V5', 'V6'));

-- Contrainte : V5 DOIT avoir un canonical vers V2
-- (pas self-canonical comme V3)

-- Index pour requêtes V5 (DB siblings) et V6 (orphelins)
CREATE INDEX IF NOT EXISTS idx_gamme_content_niveau_v5_v6
  ON __gamme_content_niveau(gcn_niveau_v)
  WHERE gcn_niveau_v IN ('V5', 'V6');
```

### Variables Spécifiques V5 (v4.0)

```typescript
// Variables V5 = DB siblings hors CSV
#NiveauV#              // "V5"
#NiveauVLabel#         // "Compatibilité étendue"
#SourceType#           // "db_sibling"
#TypeId#               // type_id auto_type

// Variables V5 spécifiques
#ModeleLie#            // "308" (modèle qui a des V3/V4)
#SiblingsCount#        // Nombre de V5 pour ce modèle
#GammesPresentes#      // Gammes où le modèle a des V3/V4
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
│  Template maître, self-canonical (top V3 promus)            │
│  Concentre tout le link juice de V4 et V5                   │
└───────────────────────┬─────────────────────────────────────┘
                        │ héritage
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  V3 (CSV)   │ │  V4 (CSV)   │ │  V5 (DB)    │
│  500-700    │ │  400-500    │ │  Listing    │
│  Self-canon │ │  → V2       │ │  → gamme    │
│  Champions  │ │  Reste CSV  │ │  Siblings   │
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

### Prochaines Étapes Phase 5 (v4.0)

1. **Modifier contrainte SQL** : V1-V6 dans `gcn_niveau_v` (fait)
2. **Étendre service** : `gamme-vlevel.service.ts` aligné v4.0 (fait)
3. **Script import** : `insert-missing-keywords.ts` avec V5/V6 (fait)
4. **Backfill RPC V2** : Déployée sur massdoc (fait)
5. **Tester 2e gamme** : "plaquette de frein" pour valider V1 inter-gammes
6. **Enrichir modèles composés** : Ajouter patterns manquants au besoin

---

## 25. RÉSUMÉ FINAL : Architecture Contenu V1 → V6 (v4.0)

### Tableau de Synthèse

| Phase | Niveau | Type Page | Longueur | Canonical | Objectif |
|-------|--------|-----------|----------|-----------|----------|
| 7 | **V1** | Modèle (inter-gammes) | 800-1200 | Self | Encyclopédique |
| 4 | **V2** | Gamme (top V3 promus) | 700-1000 | Self | Conversion |
| 4 | **V3** | Gamme (champion groupe) | 500-700 | Self | Enrichissement |
| 4 | **V4** | Gamme (reste CSV) | 400-500 | → V2 | Link juice |
| 5 | **V5** | Compatibilité DB | Listing | → gamme | Couverture |
| — | **V6** | Catalogue interne | — | — | Orphelins DB |

### Principes Clés (v4.0)

1. **V1 = Inter-gammes** : Top V2 dans ≥ 30% des G1 du modèle+énergie
2. **V2 = Top champions** : Top 10 V3 promus par score_seo, canonical maître
3. **V3 = Champion groupe** : 1 par [gamme+modèle+énergie], self-canonical
4. **V4 = Reste CSV** : Volume > 0, canonical → V2
5. **V5 = DB siblings** : Pas de contenu dédié, listing compatibilité
6. **V6 = DB orphelins** : Catalogue interne uniquement

### Workflow de Génération (v4.0)

```
1. Import CSV + triage T1-T4
   ↓
2. Classification V3/V4 (par groupe) + backfill type_id
   ↓
3. Promotion V3 → V2 (top 10 par score_seo)
   ↓
4. V5 = DB siblings hors CSV, V6 = DB orphelins
   ↓
5. V1 inter-gammes (après ≥2 gammes), V2 concentre autorité SEO
```

### 12 Règles Officielles V1-V6 v4.0

```
1) Classification bottom-up, séparée Essence/Diesel sur TOUS les niveaux

2) V3 = champion #1 par groupe [gamme+modèle+énergie] — tri volume DESC, keyword_length ASC

3) V4 = reste du CSV dans le même groupe, volume > 0

4) V2 = top 10 V3 promus par score_seo = volume × (1 + nb_v4/5)

5) V1 = top V2 inter-gammes (modèle+énergie, ≥ 30% des G1)

6) Un modèle peut avoir V1 Diesel + V1 Essence

7) V5 = type_ids DB dont modèle a des V3/V4 dans la gamme, mais hors CSV

8) V6 = type_ids DB dans aucune gamme (orphelins globaux)

9) Tous les V ont un type_id (véhicule réel dans auto_type)

10) Pipeline : T1-T4 triage → V3/V4 → backfill type_id → V2 → V5 → V6 → V1

11) score_seo favorise les champions de groupes riches (beaucoup de V4)

12) V1 est GLOBAL, V2-V5 sont LOCAL (par gamme), V6 est GLOBAL
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
