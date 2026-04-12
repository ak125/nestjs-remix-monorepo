# Keyword Research Batches — Google Ads KP

> Cree : 2026-04-12
> Couvre : 178 gammes sans import Google Ads KP (1 deja fait : filtre-a-huile)
> Stratégie : 18 batches de 10 gammes, groupes par thematique (SEO similarity)

## Procedure par batch

1. **Chrome** → Google Ads Keyword Planner → "Trouver de nouveaux mots-cles"
2. **Coller les 10 noms de gammes** du batch (1 par ligne ou separes par virgule)
3. **Config** : Langue = Francais, Zone = France
4. **"Obtenir des resultats"** → attendre le chargement
5. **"Telecharger"** → CSV → le fichier sort en UTF-16 LE tab-separated
6. **Nommer** : `{gamme-slug}_{YYYY-MM-DD}.csv` (une gamme = 1 fichier, ou `batch{N}_{date}.csv` si export groupe)
7. **`scp`** vers VPS : `scp *.csv deploy@46.224.118.55:/opt/automecanik/app/data/keywords/raw/`
8. **Import** : `python3 scripts/seo/import-gads-kp.py data/keywords/raw/{fichier}.csv --pg-id {id}`
9. **Classify** : `/kw-classify {gamme}`
10. **Generate** : `/content-gen {gamme} --all`

---

## Phase 1 — Top 50 prioritaires (batches 1-5)

### Batch 1 — Freinage principal (~760K produits cumules)
```
Silencieux
Plaquette de frein
Disque de frein
Etrier de frein
Flexible de frein
Cable de frein a main
Machoires de frein
Tambour de frein
Maitre cylindre de frein
Servo frein
```
IDs : `26, 402, 82, 78, 83, 124, 70, 123, 258, 74`

### Batch 2 — Suspension + Direction (~450K)
```
Bras de suspension
Amortisseur
Ressort de suspension
Rotule de direction
Rotule de suspension
Biellette de barre stabilisatrice
Barre stabilisatrice
Cremaillere de direction
Barre de direction
Kit de butee de suspension
```
IDs : `273, 854, 188, 2066, 2462, 3230, 274, 286, 285, 1632`

### Batch 3 — Moteur / Transmission (~385K)
```
Alternateur
Demarreur
Cardan
Kit d'embrayage
Turbo
Pompe a eau
Capteur ABS
Compresseur de climatisation
Soufflet de cardan
Injecteur
```
IDs : `4, 2, 13, 479, 2234, 1260, 412, 447, 193, 3902`

### Batch 4 — Distribution / Courroies (~200K)
```
Kit de distribution
Courroie d'accessoire
Courroie de distribution
Galet tendeur de courroie d'accessoire
Galet tendeur de courroie de distribution
Galet enrouleur de courroie d'accessoire
Galet enrouleur de courroie de distribution
Kit de chaine de distribution
Chaine de distribution
Pochette joints moteur
```
IDs : `307, 10, 306, 310, 308, 312, 313, 1389, 1123, 560`

### Batch 5 — Eclairage + Carrosserie (~180K)
```
Retroviseur exterieur
Feu avant
Feu arriere
Feu clignotant
Phares antibrouillard
Feu antibrouillard arriere
Feu stop
Feu de position
Balais d'essuie-glace
Leve-vitre
```
IDs : `50, 259, 290, 62, 289, 291, 76, 294, 298, 1561`

---

## Phase 2 — 50-100 prioritaires (batches 6-10)

### Batch 6 — Refroidissement + Climatisation (~180K)
```
Radiateur de refroidissement
Durite de refroidissement
Thermostat
Ventilateur de refroidissement
Condenseur de climatisation
Radiateur de chauffage
Vase d'expansion
Bouteille deshydratante
Sonde de refroidissement
Bride de liquide de refroidissement
```
IDs : `470, 475, 316, 508, 448, 467, 397, 851, 830, 3219`

### Batch 7 — Injection / Carburant (~120K)
```
Filtre a carburant
Pompe a carburant
Pompe a injection
Sonde lambda
Vanne EGR
Debitmetre d'air
Corps papillon
Capteur pression de carburant
Pompe a haute pression
Regulateur de pression carburant
```
IDs : `9, 458, 3904, 3922, 1145, 3927, 158, 817, 3918, 168`

### Batch 8 — Joints / Etancheite (~100K)
```
Joint de culasse
Joint de collecteur
Joint de cache culbuteurs
Joint d'echappement
Joint de turbo
Joint de carter d'huile
Joint chemise de cylindre
Joint tige de soupape
Joint arbre longitudinal
Bagues d'etancheite moteur
```
IDs : `318, 40, 321, 138, 141, 455, 128, 322, 1427, 3874`

### Batch 9 — Allumage + Batterie (~85K)
```
Bobine d'allumage
Bougie d'allumage
Bougie de prechauffage
Faisceau d'allumage
Distributeur d'allumage
Module d'allumage
Contacteur demarreur
Batterie
Pressostat d'huile
Contacteur feu de recul
```
IDs : `689, 686, 243, 685, 683, 1218, 682, 1, 805, 807`

### Batch 10 — Capteurs moteur (~80K)
```
Capteur impulsion
Capteur temperature d'air admission
Capteur de cognement
Capteur de pedale d'accelerateur
Capteur pression du tuyau d'admission
Capteur pression de gaz d'echappement
Capteur de pression Common Rail
Capteur pression et temperature d'huile
Capteur niveau d'huile moteur
Capteur de pression turbo
```
IDs : `4813, 3939, 3921, 3908, 3947, 4272, 3996, 4175, 1289, 3553`

---

## Phase 3 — 100-150 prioritaires (batches 11-15)

### Batch 11 — Echappement + FAP (~55K)
```
Tube d'echappement
Catalyseur
FAP
Intercooler
Gaine de turbo
Soupape reaspiration des gaz d'echappement
Soupape d'aspiration d'air secondaire
Joint d'injecteur
Valve de reglage du ralenti
Conduite a haute pression d'injection
```
IDs : `17, 429, 1256, 468, 3314, 1137, 1136, 3894, 1298, 3916`

### Batch 12 — Roulement / Transmission (~90K)
```
Roulement de roue
Moyeu de roue
Cylindre de roue
Soufflet de direction
Cable d'embrayage
Emetteur d'embrayage
Recepteur d'embrayage
Butee d'embrayage
Volant moteur
Palier d'arbre de transmission
```
IDs : `655, 653, 277, 191, 478, 234, 620, 48, 577, 2109`

### Batch 13 — Essuie-glace + Lave-glace (~25K)
```
Bras d'essuie-glace
Tringlerie d'essuie-glace
Moteur d'essuie-glace
Pompe nettoyage des vitres
Pompe nettoyage des phares
Correcteur de portee
Commande d'eclairage
Commande de ventilation
Relais de clignotant
Avertisseur sonore
```
IDs : `301, 300, 295, 794, 795, 700, 809, 1385, 61, 297`

### Batch 14 — Huile moteur (~35K)
```
Radiateur d'huile
Pompe a huile
Carter d'huile
Jauge de niveau d'huile
Bouchon de vidange
Filtre de boite auto
Joint carter de distribution
Poulie d'alternateur
Poulie vilebrequin
Poulie d'arbre a came
```
IDs : `469, 596, 592, 599, 593, 416, 568, 1108, 3213, 1067`

### Batch 15 — Interieur / Serrurerie (~30K)
```
Poignee de porte
Serrure de porte
Serrure de hayon
Serrure de capot-moteur
Verin capot moteur
Verin de coffre
Verin vitre arriere
Cable de capot moteur
Cable de boite vitesse
Cable d'accelerateur
```
IDs : `1373, 1361, 1362, 1365, 514, 5032, 2454, 1238, 1787, 618`

---

## Phase 4 — 150-178 restants (batches 16-18)

### Batch 16 — Support / Silent-bloc (~55K)
```
Support moteur
Support de boite vitesse
Butee elastique d'amortisseur
Pulseur d'air d'habitacle
Filtre d'habitacle
Filtre a air
Temoin d'usure
Agregat de freinage
Repartiteur de frein
Sphere de suspension
```
IDs : `247, 249, 1182, 2669, 424, 8, 407, 415, 73, 1718`

### Batch 17 — Moteur interne (~20K)
```
Soupape d'admission
Soupape d'echappement
Poussoir de soupape
Arbre a came
Culbuteur
Vis de culasse
Valve magnetique
Pompe a vide de freinage
Transmetteur de pression
Pressostat de climatisation
```
IDs : `1269, 1270, 1216, 566, 432, 1533, 2073, 387, 170, 1360`

### Batch 18 — Divers (~25K)
```
Attelage
Ampoule feu avant
Ampoule feu clignotant
Bouchon vase d'expansion
Bouchon de radiateur
Boulon de roue
Detendeur de climatisation
Evaporateur de climatisation
Colonne de direction
Faisceau d'attelage
```
IDs : `39, 107, 105, 56, 548, 657, 183, 471, 1211, 179`

---

## Gammes hors batches (< 1000 produits, priorite basse — 28 gammes)

A traiter en fin ou individuellement. Liste courte :
```
Neiman, Capteur parctronic, Bouton de retroviseur, Poulie d'arbre a came,
Moteur electrique de ventilateur, Tuyau carburant de fuite, Boitier de prechauffage,
Capteur de pression Common Rail, Capteur temperature de climatisation,
Parctronic, Soupape d'aspiration d'air secondaire, Ballast a lampe xenon,
Feu eclaireur de plaque, Tringlerie d'essuie-glace, Capteur controle de pression des pneus,
Conduite de climatisation, Bague d'etancheite cardan, Interrupteur des feux de freins,
Tube de distributeur carburant, Joint de boite vitesse, Joint carter de distribution,
Kit de freins arriere, Bagues d'etancheite moteur, Palpeur de regime gestion moteur,
Capteur de pedale d'accelerateur, Capteur temperature d'huile,
Ampoule eclairage interieur, Ampoule feu arriere
```

---

## Suivi

### Etat global (2026-04-12)
- **1/179** gammes importees (filtre-a-huile)
- **178 restantes** reparties sur 18 batches (~10 gammes/batch)
- Cout estime : ~18 sessions Chrome × 5 min = 90 min de travail manuel
- Temps par gamme : ~5 min (export) + ~2 min (import + classify) + ~5 min (content-gen) = ~12 min

### Progression
| Phase | Batches | Gammes | Statut |
|-------|---------|--------|--------|
| Pilote | — | filtre-a-huile | Fait |
| Phase 1 | 1-5 | 50 top | A faire |
| Phase 2 | 6-10 | 50-100 | A faire |
| Phase 3 | 11-15 | 100-150 | A faire |
| Phase 4 | 16-18 | 150-178 | A faire |
| Hors batches | — | 28 niche | A faire |

### Par batch — a cocher

- [ ] Batch 1 — Freinage principal
- [ ] Batch 2 — Suspension + Direction
- [ ] Batch 3 — Moteur / Transmission
- [ ] Batch 4 — Distribution / Courroies
- [ ] Batch 5 — Eclairage + Carrosserie
- [ ] Batch 6 — Refroidissement + Climatisation
- [ ] Batch 7 — Injection / Carburant
- [ ] Batch 8 — Joints / Etancheite
- [ ] Batch 9 — Allumage + Batterie
- [ ] Batch 10 — Capteurs moteur
- [ ] Batch 11 — Echappement + FAP
- [ ] Batch 12 — Roulement / Transmission
- [ ] Batch 13 — Essuie-glace + Lave-glace
- [ ] Batch 14 — Huile moteur
- [ ] Batch 15 — Interieur / Serrurerie
- [ ] Batch 16 — Support / Silent-bloc
- [ ] Batch 17 — Moteur interne
- [ ] Batch 18 — Divers

---

## Notes operationnelles

**Seeds Google Ads KP :** Coller les 10 noms en une fois maximise l'efficacite des suggestions connexes. Google elargit l'univers semantique autour des seeds groupes thematiquement.

**Filtrage post-import :** Le script `import-gads-kp.py` applique le filtre RAG (`must_not_contain`, `confusion_with`, core words). Typiquement 20% des KW sont rejetes automatiquement. Les cas sémantiques restants sont gérés par `/kw-classify`.

**Rate limit :** Google Ads KP n'a pas de rate limit strict, mais 1 export/minute max est raisonnable pour éviter les CAPTCHA.

**Mapping slug → pg_id :** Le script détecte automatiquement depuis le nom du fichier OU utilise `--pg-id`. Les IDs sont listés ci-dessus pour chaque batch.
