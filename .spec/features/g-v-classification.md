# Systeme de Classification V-Level v5.0

> **Version :** v5.0 (2026-02-10)
> **Auteur :** Claude Code + Utilisateur
> **Remplace :** v4.0 / v4.1

## But

Le V-Level decide, pour chaque gamme de pieces auto :
1. **Quels vehicules afficher en priorite** sur les pages publiques
2. **Quels vehicules meritent une page SEO dediee** (meta tags, sitemap, structured data)

## Sources de donnees

| Source | Ce qu'elle apporte |
|--------|-------------------|
| **CSV Google Ads** | Mots-cles recherches par les internautes + volume mensuel |
| **Base vehicules** (`auto_type`, `auto_modele`) | Catalogue complet des vehicules compatibles |

---

## DOUBLE SYSTEME DE CLASSIFICATION

| Systeme | Cible | Niveaux | Description |
|---------|-------|---------|-------------|
| **Systeme G** | GAMMES (familles de pieces) | G1, G2, G3, G4 | Classification des produits |
| **Systeme V** | VEHICULES | V1, V2, V3, V4, V5, V6 | Classification des motorisations |

> Ce document couvre uniquement le **Systeme V**.

---

## Phase T — Triage des mots-cles CSV

Le CSV Google Ads contient des milliers de mots-cles. La Phase T filtre et classe :

| Etape | Role | Exemple |
|-------|------|---------|
| **T1** Pertinence | Le keyword contient le nom de la gamme | "disque frein clio" OK / "plaquette clio" NON |
| **T2** Exclusion | Le keyword n'appartient pas a une AUTRE gamme | "kit embrayage clio" NON (c'est embrayage, pas disque frein) |
| **T3** Categorisation | Vehicule, marque, ou generique ? | "disque frein clio 1.5 dci" = vehicule / "disque frein bosch" = marque |
| **T4** Vehicules only | Seuls les keywords vehicule passent a la Phase V | Les marques et generiques restent en base mais sans V-level |

**Apres T4 :** On a une liste de keywords vehicule avec leur volume Google.

> **Note :** T1/T2/T3 ne changent pas en v5.0. Le code actuel fonctionne.

### T5 — Filtre motorisation (v5.0)

**Regle : Seuls les keywords avec motorisation recoivent un V-level.**

Un keyword vehicule est "specifique" (eligible V-level) s'il mentionne un pattern moteur :
- Cylindree : `\d+\.\d+` (ex: 1.5, 1.6, 2.0)
- Fuel patterns : hdi, dci, tdi, cdi, tce, tsi, vti, puretech, tfsi, gti, vtec, mpi, d4d, jtd, cdti, crdi, dtec
- Chevaux : `\d+ ch`, `\d+ cv`

**Exemples :**
- "filtre a huile 207 1.6 hdi" → specifique → V3/V4/V2
- "filtre a huile 207" → generique → **PAS de V-level** (reste en base, v_level = NULL)
- "filtre a huile clio 3 1.5 dci 90" → specifique → V3/V4/V2

---

## Phase MATCH — Attribution du type_id

Chaque keyword vehicule est matche a un vehicule reel dans `auto_type` via le RPC `backfill_seo_keywords_type_ids`.

Exemple : "disque frein clio 3 1.5 dci" -> `type_id = 12345` (Clio III 1.5 dCi 68ch)

**Regle : Tout keyword qui entre en Phase V a un type_id.**

---

## Phase V — Classification en 6 niveaux

### Groupement

Les keywords vehicule sont groupes par **[gamme + modele + energie]**.

**Energies reconnues :** diesel, essence, hybride, electrique, GPL

**Patterns de detection :**

| Energie | Patterns |
|---------|----------|
| Diesel | diesel, dci, hdi, tdi, cdi, d4d, jtd, cdti, crdi, dtec |
| Essence | essence, tce, vti, puretech, tfsi, tsi, gti, vtec, mpi |
| Hybride | hybrid, phev, e-hybrid, plug-in, hybride |
| Electrique | ev, electrique, electric, e-208, e-c4 (e-prefix) |
| GPL | gpl, lpg, bifuel |

**Gammes universelles :** Certaines gammes n'ont pas de distinction par energie (essuie-glaces, ampoules, tapis...). Elles sont marquees avec `gamme_universelle = true` dans `pieces_gamme`. Pour ces gammes, le groupement est **[gamme + modele]** seulement.

**Exemple (gamme "disque de frein", PAS universelle) :**
```
Groupe 1 : disque frein | clio | diesel    -> 8 keywords
Groupe 2 : disque frein | clio | essence   -> 5 keywords
Groupe 3 : disque frein | 308 | diesel     -> 12 keywords
Groupe 4 : disque frein | 308 | essence    -> 3 keywords
```

---

### V3 — Champion du groupe

Dans chaque groupe, **1 seul keyword est elu V3 = le champion**.

**Election du V3 :**
1. Trier les keywords du groupe par **volume DESC**
2. Si egalite de volume : **le premier dans l'ordre du CSV** gagne
3. Le 1er du tri = V3

**Cas particuliers :**
- **Seul dans le groupe** -> V3 automatique (meme si volume = 0)
- **Tous les keywords a volume 0** -> le premier du CSV = V3
- **1 seul V3 par groupe**, jamais plus

**Modele :** Le modele est parse du keyword (ex: "clio" dans "disque frein clio 1.5 dci") **puis confirme** par le type_id matche (auto_type -> auto_modele -> modele_name).

**Affichage public :** V3 = affiche en haut de la page gamme, trie par volume DESC entre les V3.

**Exemple :**
```
Groupe "disque frein | clio | diesel" :
  "disque frein clio 3 1.5 dci"     volume=500  -> V3 (champion, plus gros volume)
  "disque frein clio 3 1.5 dci 90"  volume=200  -> V4
  "disque frein clio 3 dci"         volume=50   -> V4
  "disque frein clio 3 1.5 dci 68"  volume=0    -> V4

Groupe "disque frein | lada | diesel" (1 seul keyword) :
  "disque frein lada niva 1.7 d"    volume=0    -> V3 (seul dans le groupe)

Groupe "disque frein | dacia | essence" (tous a 0) :
  "disque frein dacia sandero 1.0"  volume=0    -> V3 (premier du CSV)
  "disque frein sandero stepway"    volume=0    -> V4
```

---

### V4 — Reste du groupe (CSV)

Tous les keywords vehicule du meme groupe qui ne sont pas V3.

**Regles :**
- V4 = dans le CSV, pas le champion
- **Inclut les volume = 0** (tout non-champion est V4)
- Au reimport CSV : un V4 peut devenir V3 si son nouveau volume est plus eleve que l'ancien champion

**Affichage public :** V4 = affiche plus bas sur la page gamme, trie par volume DESC entre les V4.

**Utilite SEO :** V4 represente les variantes moteur d'un meme modele. Meme affiche plus bas, ils ajoutent du contenu et de la couverture longue traine.

---

### V2 — Top 10 des V3 dans la gamme

Parmi tous les V3 d'une gamme, on prend les 10 meilleurs par volume.

**Regles :**
- Trier tous les V3 par volume DESC
- Dedup par **[modele + energie]** (un meme modele PEUT avoir 2 V2 : un diesel + un essence)
- Les 10 premiers = V2
- V2 remplace V3 (un keyword est V2 OU V3, jamais les deux)
- **10 au total** par gamme, toutes energies confondues
- Un V3 avec volume=0 peut etre V2 (s'il y a moins de 10 V3 avec volume)

**Exemple (gamme "disque de frein") :**
```
V3 champions tries par volume :
  1. "disque frein 308 1.6 hdi"    vol=800  -> V2 (308 diesel)
  2. "disque frein clio 1.5 dci"   vol=500  -> V2 (clio diesel)
  3. "disque frein clio 1.2 tce"   vol=450  -> V2 (clio essence — meme modele, autre energie)
  4. "disque frein megane 1.5 dci"  vol=400  -> V2 (megane diesel)
  ...
  10. "disque frein c4 1.6 hdi"    vol=80   -> V2 (c4 diesel)
  11. "disque frein polo 1.4 tdi"  vol=60   -> reste V3 (plus de place)
```

---

### V5 — Vehicules en base, pas dans le CSV

Vehicules qui existent dans la base (`auto_type`) mais ne sont PAS dans le CSV Google.

**Regles :**
- Leur **modele** (via `modele_parent` dans `auto_modele`) a des V3/V4 dans cette gamme
- **Meme generation seulement** : les freres ayant le meme `modele_parent` (pas toute la branche)
- Si `modele_parent = 0` : le modele est un root, pas de siblings
- Seulement les types avec `type_display = '1'` (vehicules affichables)
- **Toutes energies** : si un V3 diesel declenche un V5, les siblings essence du meme parent sont aussi V5
- Crees automatiquement avec volume = 0
- **Recalcules** a chaque import/recalcul (supprimes puis recrees)

**Exemple avec la hierarchie auto_modele :**
```
auto_modele :
  Clio       (modele_id=1, modele_parent=0)   <- root (PAS de siblings car parent=0)
  Clio II    (modele_id=4, modele_parent=1)   <- generation 1 (enfant de Clio)
  Clio III   (modele_id=5, modele_parent=1)   <- generation 1 (enfant de Clio)
  Clio IV    (modele_id=7, modele_parent=1)   <- generation 1 (enfant de Clio)
  Clio III Estate (modele_id=6, modele_parent=5) <- generation 2 (enfant de Clio III)
```

**Scenario :** Le CSV a "disque frein clio 3 1.5 dci" (V3, type_id=12345, modele=Clio III, modele_id=5)

```
1. Clio III a modele_parent=1 (pas 0, donc on peut chercher des siblings)
2. Siblings = SELECT * FROM auto_modele WHERE modele_parent=1 AND modele_id != 5
   -> Clio II (id=4) et Clio IV (id=7)
   -> PAS Clio III Estate (id=6) car son parent est 5, pas 1
3. Tous les auto_type de Clio II et Clio IV avec type_display='1'
4. Exclure ceux deja dans le CSV
5. Les restants = V5 (volume=0)
```

**Resultat :** Les vehicules Clio II et Clio IV de la meme generation sont V5, mais pas Clio III Estate (qui est un sous-modele).

---

### V1 — Stars inter-gammes (DEFERRED)

> **Reporte** — sera implemente quand plus de gammes seront importees.

Un vehicule qui est V2 dans **beaucoup de gammes differentes**. C'est un vehicule populaire toutes categories confondues.

**Regles futures :**
- V1 = vehicule qui est V2 dans >= 30% des gammes G1 (gammes principales)
- Calcul global, apres import de plusieurs gammes

---

### V6 — Orphelins (DEFERRED)

> **Reporte** — sera implemente quand plus de gammes seront importees.

Vehicules dans la base qui n'apparaissent dans **aucune gamme** (ni via CSV, ni via V5).

**Regle future :** Calcul global. Vehicules oublies du catalogue.

---

## Pipeline complet

```
CSV Google Ads
    |
    v
Phase T : T1 pertinence -> T2 exclusion -> T3 categorisation -> T4 vehicules only
    |
    v
Phase MATCH : attribution type_id (RPC backfill_seo_keywords_type_ids)
    |
    v
Phase V :
    V3/V4  (par groupe [gamme+modele+energie])
    -> V2   (top 10 des V3, dedup par [modele+energie])
    -> V5   (siblings en base via modele_parent, meme generation)
    -> V1   (DEFERRED — inter-gammes, >= 30% des G1)
    -> V6   (DEFERRED — orphelins globaux)
```

---

## Reimport CSV

| Sujet | Comportement |
|-------|-------------|
| Mode | **Fusion** — merge avec l'existant |
| Volume | **Le plus recent** du CSV remplace l'ancien |
| V3/V4 | **Recalcules** — un V4 peut devenir V3 si son nouveau volume est plus eleve |
| V2 | **Recalcules** — top 10 recalcule avec les nouveaux volumes |
| V5 | **Supprimes et recrees** — recalcules a partir des nouveaux V3/V4 |

---

## Affichage public

| V-Level | Position | Tri |
|---------|----------|-----|
| V2 | Tout en haut | Volume DESC |
| V3 | Haut de page | Volume DESC |
| V4 | Plus bas | Volume DESC |
| V5 | En bas | Alphabetique ou par modele |

---

## Decisions v5.0

| Sujet | Decision |
|-------|----------|
| **Energies** | diesel, essence, hybride, electrique, GPL |
| **Gammes universelles** | Flag `gamme_universelle` dans `pieces_gamme` pour ignorer l'energie |
| **V4 volume=0** | **Autorise** — tout non-champion CSV = V4 |
| **Tri V2** | **Volume Google seul** (pas de formule coefficient) |
| **V2 comptage** | **10 au total** par gamme, toutes energies confondues |
| **V2 dedup** | Par **[modele + energie]** (un modele peut avoir 2 V2 : diesel + essence) |
| **V-level par** | **Par keyword** (chaque keyword a son type_id, son V-level) |
| **V1** | **Reporte** |
| **V6** | **Reporte** |
| **type_id** | **Garanti par le pipeline** (MATCH avant V) |
| **Reimport CSV** | **Fusion** — merge avec l'existant, volume = le plus recent |
| **V5 au reimport** | **Recalcules** — supprimes et recrees |
| **Tri public** | **Volume Google DESC** a l'interieur d'un meme V-level |
| **Gammes universelles** | **Liste fixe** : essuie-glaces, ampoules, tapis (+ ajout futur) |
| **Limite V2** | **Toujours 10** (pas configurable) |
| **V5 profondeur** | **Meme generation** (meme parent), PAS toute la branche |
| **V5 toutes energies** | Oui — un V3 essence declenche des V5 diesel du meme modele |
| **V5 type_display** | Seulement `type_display = '1'` (vehicules affichables) |
| **V3 solo** | Seul dans le groupe = V3 automatique (meme volume=0) |
| **V3 tous a zero** | Groupe tout a volume=0 = premier du CSV = V3 |
| **score_seo** | **Supprime** — on utilise directement le champ volume |
| **Multi-gamme** | **Non** — T2 garantit 1 keyword = 1 seule gamme |
| **Recalcul admin** | **Tout** : V2/V3/V4 recalcules + V5 supprimes et recrees |
| **T2 exclusion** | **Inchange** |
| **T3 categorisation** | **Inchange** |

---

## Fichiers d'implementation

| Fichier | Role |
|---------|------|
| `scripts/insert-missing-keywords.ts` | Pipeline complet (CLI) : T -> MATCH -> V3/V4 -> V2 -> V5 |
| `backend/src/modules/admin/services/gamme-vlevel.service.ts` | Recalcul V-Level par gamme (API admin) |
| `frontend/app/components/admin/gamme-seo/VLevelTab.tsx` | UI admin V-Level |

---

## Historique des versions

| Version | Date | Changements |
|---------|------|-------------|
| v5.0 | 2026-02-10 | Reecriture complete. 25 decisions. Ajout hybride/electrique/GPL. Gammes universelles. V5 = meme generation. Score_seo supprime. Section K supprimee. V1/V6 reportes. |
| v4.1 | 2026-02-10 | Fix V5 siblings via modele_parent. V3/V4 redefinies. |
| v4.0 | 2026-02-09 | Premiere version formalisee. |
