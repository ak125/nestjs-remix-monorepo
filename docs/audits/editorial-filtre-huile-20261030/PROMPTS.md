# Prompts — images et scènes manquantes, filtre à huile

Révision 4, 31/10/2026. Chaque entrée est un **manque du lot** tant que le fichier n'existe pas : un prompt n'est pas
une image livrée. Les visuels déjà produits et vérifiés sont dans [integration/assets.json](integration/assets.json).

## Moyens réellement disponibles

| Moyen | État dans cette session | Ce qu'il permet | Ce qu'il empêche |
|---|---|---|---|
| `tools/build-assets.cjs` (SVG → WebP, sharp) | disponible | schémas de principe, pictogrammes, recadrage de photo, panneau OG | aucune photo nouvelle |
| Banque Unsplash (MCP) | disponible | photos sous licence Unsplash, sans attribution obligatoire | aucune photo admissible pour P-01, P-02 ni P-06 (recherche ci-dessous) |
| Génération d'image | **indisponible** : le connecteur média de la session n'expose que `balance`, `models_list`, `models_get`, `show_generations`, `list_workspaces`, `workspace_select`, `import-claude-motion-from-url` ; aucun appel de génération | — | toute image de produit générée (P-01 à P-03) |
| Prise de vue réelle | hors session (atelier ou fournisseur) | photos de procédure et d'emplacement | — |

Recherche en banque du 31/10 (05:07-05:09 UTC), quatre requêtes : « new oil filter » (893 résultats), « oil filter
cartridge » (181), « car oil filter » (968), « oil change engine bay » (194). La première page de chacune (15, 15,
20 et 20 résultats), soit 52 photos distinctes, a été triée sur sa description ; deux vignettes ont été vues.

| Photo | Motif |
|---|---|
| uhuTo7u8VXk (vue) | déjà retenue pour les recadrages (`integration/assets.json`, `photo_source`) ; filtre usagé, notice lisible : ne remplace pas P-01 |
| 0_TINhcZOK0 (vue) | cartouche courte détourée sur un damier incrusté dans l'image, compte à une seule photo : provenance douteuse, droits non établis |
| 50 autres | hors sujet : filtres à carburant ou à air, compartiments moteur sans filtre visible, bidons d'huile, objets sans rapport. Aucune ne montre une cartouche dans son boîtier (P-02) ni un emplacement sur un véhicule identifié (P-06) |

Règle de choix : une **photo de procédure** ou d'**emplacement** montre un geste ou un véhicule réels ; elle se fait en
prise de vue, jamais en génération, car une image générée ne prouve pas un élément vérifié. La génération reste
admissible pour une pièce isolée sans marque ni texte, après contrôle à l'œil. Un schéma est dessiné en SVG à partir
des faits admis et porte la mention « schéma de principe ».

## Contrôle commun à toute image avant intégration

1. Aucune marque, logo, référence ou texte lisible (sauf texte voulu et relu).
2. Aucun prix, délai, stock, badge promotionnel ni promesse.
3. Pièce conforme au fait admis qu'elle illustre ; portée écrite dans la légende.
4. Formats : WebP ; hero R1 720×720 (cadre carré), R3 1280×720, TYPES/PRICE 1200×900, OG 1200×630, vidéo 1080×1920.
5. Alt descriptif en français, sans mot-clé ajouté ; consigné dans `integration/assets.json`.

## Images de page

### P-01 Filtre vissé neuf, fond neutre — remplace la photo d'usage

- **Usage** : R1 HERO (rip 31), R3 HERO (rip 12), V1 0-4 s, vignettes. La photo actuelle montre un filtre usagé dont la
  notice japonaise imprimée est lisible (« 3/4 » visible).
- **Moyen** : génération (indisponible) ou photo produit.
- **Prompt** : « Photographie produit d'un filtre à huile automobile vissé neuf, boîtier métallique cylindrique gris
  anthracite sans aucune inscription, vu de trois quarts haut pour montrer la plaque de base : joint torique noir, trous
  d'entrée en couronne et taraudage central. Fond gris clair uni, lumière douce de studio, ombre portée légère, netteté
  sur le joint. Format carré 1:1, sujet centré occupant 70 % du cadre. »
- **Négatif** : marque, logo, texte, référence, étiquette, prix, mains, moteur, huile qui coule, reflets saturés.
- **Accepté si** : joint, trous d'entrée et taraudage reconnaissables ; aucun texte ; recadrage 16:9 possible pour R3.

### P-02 Cartouche neuve et boîtier ouvert

- **Usage** : complément du schéma TYPES (R1), V1 4-14 s, vignette V1.
- **Moyen** : photo produit (de préférence) ou génération (indisponible).
- **Prompt** : « Photographie produit d'une cartouche filtrante à huile neuve : élément en papier plissé beige entre
  deux flasques, posée debout à côté d'un couvercle de boîtier de filtre en plastique noir dévissé, avec son joint
  torique. Fond gris clair uni, lumière douce, vue de trois quarts. Format 4:3. »
- **Négatif** : marque, texte, moteur, prix, huile, mains.
- **Accepté si** : on distingue l'élément filtrant seul et le couvercle réutilisé ; aucune marque.

### P-03 Vissé et cartouche côte à côte

- **Usage** : vignette V1 (« Vissé ou cartouche ? »), OG future.
- **Moyen** : montage de P-01 et P-02 avec `build-assets.cjs` dès qu'ils existent.
- **Accepté si** : les deux formes à la même échelle apparente, fond `#0F1E38` pour la vignette vidéo.

### P-04 Deux filtres vissés d'aspect proche

- **Usage** : C2, R3 S3 (illustration de « l'apparence ne suffit pas »).
- **Moyen** : prise de vue de **deux références réelles** du catalogue, de même diamètre, dont la fiche montre un critère
  différent (anti-retour, filetage ou pression d'ouverture). Références consignées en interne, marques masquées.
- **Consigne de prise de vue** : deux filtres debout côte à côte, fond neutre, même éclairage ; puis vue de chaque
  plaque de base. Aucun texte lisible à l'image.
- **Accepté si** : la différence montrée est documentée par la fiche des deux références ; sinon l'image ne sert pas.

### P-05 Coupe réelle d'un filtre vissé

- **Usage** : C3, R3 S3 (complète la coupe de principe déjà livrée).
- **Moyen** : prise de vue d'un filtre identifié scié en deux (atelier).
- **Accepté si** : membrane anti-retour et média visibles ; légende qui nomme la portée (« ce filtre », pas « les
  filtres »).

### P-06 Emplacement du filtre — par véhicule seulement

- **Usage** : R1 LOCATION (rip 34, désélectionnée en attendant). Aucun emplacement universel.
- **Moyen** : prise de vue sur un véhicule identifié (`type_id`), légende « Exemple : <modèle, motorisation> ».
  Les `type_id` 19052 et 19053 restent distincts : une photo ne vaut que pour le sien.
- **Accepté si** : véhicule, motorisation et accès décrits dans la légende ; jamais réutilisée pour une autre motorisation.

### P-07 Joint neuf huilé au doigt (après admission de F-C3)

- **Usage** : R3 S4_REPOSE (bloc candidat), C4.
- **Moyen** : prise de vue réelle.
- **Consigne** : gros plan, doigt ganté qui dépose un film d'huile moteur propre sur le joint d'un filtre neuf tenu
  joint vers le haut. Fond d'atelier flou, sans marque.
- **Accepté si** : F-C3 admis ; aucune consigne de serrage montrée.

### P-08 Ancien joint resté sur la portée (après admission de F-C3)

- **Usage** : R3 S4_DEPOSE (bloc candidat), S5.
- **Moyen** : prise de vue réelle, sur un véhicule identifié (portée de filtre visible).
- **Accepté si** : on voit le joint resté collé, puis la portée nettoyée (deux images).

### P-09 Huile et filtre usagés : récipient fermé (après admission de F-C10, F-C11)

- **Usage** : R3 S6 (bloc candidat).
- **Moyen** : photo (banque ou prise de vue) ou pictogramme SVG.
- **Prompt photo** : « Bidon en plastique fermé contenant de l'huile moteur usagée, à côté d'un filtre à huile usagé
  posé dans un sac fermé, sur un sol de garage propre. Lumière naturelle. Format 16:9. »
- **Négatif** : déversement, flaque, logo d'éco-organisme, texte.

## Scènes vidéo

Format 9:16, 1080×1920. Les fenêtres et la composition `PieceExpliquee` sont décrites dans [MEDIA.md](MEDIA.md) § 2-3. Dans #1936 (`e3d644a04`, non fusionnée), `PieceExpliquee` n'affiche que du texte ; `SequencesCourtes` affiche
une image par séquence (`imageUrl`, en `contain`, 900 × 640 au plus, fond `#0F1E38`).

| Vidéo · fenêtre | Scène | Disponible | Manque | Moyen |
|---|---|---|---|---|
| V1 · 0-4 s | filtre vissé seul | photo d'usage (`assets/r1-hero-filtre-visse-usage.webp`) | emplacement d'image dans `PieceExpliquee` ; P-01 préférable | code (Claude CLI) ; recadrage 9:16 non produit, sans consommateur |
| V1 · 4-14 s | vissé puis cartouche | schéma `assets/r1-types-visse-cartouche.webp` | emplacement d'image dans `PieceExpliquee` ; P-02 | code (Claude CLI) |
| V1 · 14-24 s | pictogramme du témoin de pression d'huile | `assets/picto-temoin-pression-huile.webp` | emplacement d'image dans `PieceExpliquee` | code (Claude CLI) |
| V1 · 24-32 s | colmatage puis by-pass | schéma `assets/r3-s2-filtre-colmate-by-pass.webp` | emplacement d'image dans `PieceExpliquee` ; animation | code (Claude CLI) |
| V1 · 32-40 s | sélecteur de véhicule | capture du sélecteur R1 en DEV | capture | Claude CLI, après intégration |
| C1 · 0-29 s | pictogrammes : témoin, arrêt, contact coupé, niveau | les quatre : `assets/picto-temoin-pression-huile.webp`, `picto-arret-imperatif`, `picto-contact-coupe`, `picto-niveau-huile` (31/10) | — | `tools/build-pictos.cjs` ; affichage par `SequencesCourtes` (`imageUrl`) |
| C2 · 0-20 s | deux filtres proches, puis coupe | coupe de principe | P-04 | prise de vue |
| C3 · 0-31 s | coupe, puis chaque clapet | coupe `assets/r3-s3-coupe-filtre-visse.webp` | animation par clapet | composition |
| C4 | joint, serrage selon l'instruction du filtre | — | P-07, P-08 ; admission F-C2 reformulé, F-C3, F-C4 | prise de vue |

### Prompts de scènes à tourner

- **S-01 (V1 4-14 s, 3 s)** : « Plan fixe vertical. Une main gantée pose un filtre vissé neuf sur un plan de travail
  gris, puis un couvercle de boîtier ouvert avec sa cartouche à côté. Aucun texte, aucune marque. »
- **S-02 (C2 0-8 s, 5 s)** : « Deux filtres vissés de même taille tournent lentement sur un plateau, fond neutre,
  marques masquées. Fin du plan : les deux plaques de base face caméra. » Références réelles consignées (P-04).
- **S-03 (C4 8-15 s, 4 s, après admission)** : « Gros plan, doigt ganté qui huile le joint neuf d'un filtre tenu joint
  vers le haut. »
