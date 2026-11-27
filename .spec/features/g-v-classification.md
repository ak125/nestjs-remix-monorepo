---
title: "G-V Classification — V-Level (décision 192)"
status: draft
version: 6.0.0
---

# Classification V-Level — définition des V1 à V6 (décision 192)

> **Règle en vigueur :** décision 192 (Marwane, 25 novembre 2026). Elle précise la décision 46.
> La décision 159 reste au-dessus : la base se vérifie face au constructeur avant correction, elle
> n'est pas une source de vérité.
> **État :** décidé, non implémenté. Les fonctions pures existent et sont testées ; aucun
> calculateur n'est raccordé, faute des données d'entrée (voir « Données d'entrée » et
> « Calculateurs »).
> **Remplace :** v5.0 du 10 février 2026 (voir « Ce que la décision 192 remplace »).

## But

Le V-Level classe les versions de véhicule (fiches catalogue, `type_id`) pour chaque gamme de
pièces. Ce document porte la définition des six niveaux et des deux états. Il ne dit rien de
l'usage des niveaux par les pages (affichage, indexation) : la décision 192 n'en traite pas.

## Double système de classification

| Système | Cible | Niveaux | Description |
|---------|-------|---------|-------------|
| **Système G** | Gammes (familles de pièces) | G1, G2, G3, G4 | Classification des produits |
| **Système V** | Véhicules | V1, V2, V3, V4, V5, V6 | Classification des motorisations |

> Ce document couvre uniquement le **Système V**. Ne pas confondre le V-Level avec `cgc_level`
> (maillage public) ni avec les niveaux L1 à L5 du générateur de contenu.

---

## La définition — huit lignes, mot pour mot

Les numéros sont ceux des lignes du classeur de la décision. Le texte est cité sans reformulation ;
`packages/seo-roles/src/vlevel-invariants.ts` porte les mêmes huit lignes et un test vérifie que
les deux textes sont identiques.

| Ligne | Niveau ou état | Périmètre | Règle |
|-------|----------------|-----------|-------|
| 16 | V3 · premier choix | Une gamme × un modèle × une génération × une énergie | « Retenir une seule fiche vérifiée. Priorité à une version identifiée avec la gamme. À précision égale avec la gamme, préférer la version vue dans les deux sources, puis Ads seul, puis Google.fr seul. » |
| 17 | V4 · autres demandes | Même groupe et même gamme que le V3 | « Classer chaque autre version recherchée et identifiée par son moteur, sa puissance, son année ou sa période, et son type_id. Plusieurs graphies de la même version renvoient à une seule fiche. » |
| 18 | V5 · variantes restantes | Une gamme × un modèle × une génération | « Dès le premier V3 vérifié, prendre toutes les fiches catalogue affichables et compatibles de cette génération. Retirer les V3 et V4 de la gamme. Le reste reçoit V5, toutes énergies et carrosseries comprises. » |
| 19 | V2 · choix entre gammes | Un modèle × une génération × une énergie | « Chaque gamme ayant validé un V3 donne une voix à son type_id. Le seul type_id en tête devient V2. À égalité, garder le V2 validé s’il est parmi les premiers. Sinon consigner un arbitrage humain. » |
| 20 | V6 · véhicule sans demande observée | Une fiche catalogue exacte, toutes gammes contrôlées | « Attribuer V6 après vérification de toutes les gammes, si aucune demande ni aucun V3, V4 ou V5 ne concerne la fiche. Un V5 dans une seule gamme suffit à l’exclure du V6. » |
| 21 | V1 · choix marketing | Un modèle et sa génération | « L’agent étudie l’intérêt du modèle pour le public et la campagne, documente les indices et remet son avis. Marwane décide du V1. » |
| 22 | À vérifier | Formulation ambiguë ou recherche incomplète | « Garder la formulation, son origine, les fiches possibles et la précision manquante. Reprendre la recherche avant toute élection. » |
| 26 | Périmètre · voitures sans permis | Toutes les gammes · agents, simulation et recalcul | « Conserver la formulation Ads exacte et sa ligne source. Dès que la version est identifiée comme voiture sans permis, la marquer « Hors V-Level • voiture sans permis », y compris avec une fiche catalogue compatible. » |

Deux de ces lignes ne sont pas des niveaux mais des **états** :

- **« À vérifier »** (ligne 22) : la formulation attend une précision ; elle ne reçoit aucun niveau.
- **« Hors V-Level • voiture sans permis »** (ligne 26) : la version sort du V-Level, dans toutes
  les gammes.

**V1 n'est jamais attribué par le code** (ligne 21) : l'agent remet un avis, Marwane décide.

---

## Fonctions pures

Chaque ligne a sa fonction dans `packages/seo-roles/src/vlevel-invariants.ts`. Les fonctions ne
lisent aucune base : toutes les données d'entrée sont des paramètres fournis par l'appelant.

| Ligne | Fonction | Ce que l'appelant fournit | Résultat |
|-------|----------|---------------------------|----------|
| 17, 22, 26 | `sortDemandObservations` | Les formulations relevées : texte exact, source, ligne source, fiche identifiée ou fiches possibles, précision manquante, marqueur voiture sans permis | Versions identifiées (une fiche par version, toutes ses graphies), formulations « À vérifier », formulations « Hors V-Level • voiture sans permis » |
| 16 | `electV3` | Les fiches d'un groupe gamme × modèle × génération × énergie : vérifiée ou non, identifiée avec la gamme ou non, sources ; recherche complète ou non | Une seule fiche retenue, ou élection suspendue, ou aucune fiche vérifiée, ou égalité non départagée |
| 16, 17 | `classifyDemandGroup` | Les mêmes fiches, avec moteur, puissance, année ou période | Le V3, les V4, les fiches en attente d'un V3, les fiches « À vérifier », les fiches hors V-Level |
| 18 | `selectV5` | Les fiches catalogue de la génération (affichable, compatible avec la gamme), les V3 vérifiés et les V4 de la gamme | Les V5, les fiches retirées comme V3 ou V4, les fiches non retenues et pourquoi |
| 19 | `electV2` | Une voix par gamme ayant validé un V3 ; le V2 déjà validé, s'il existe | Le V2, ou le V2 validé gardé, ou un arbitrage humain à consigner, ou aucune voix |
| 20 | `decideV6` | Pour une fiche : toutes les gammes vérifiées ou non, demande observée ou non, ses niveaux V3, V4 ou V5 dans chaque gamme | V6, ou la raison de l'exclusion |
| 21 | `carryV1` | Les décisions de Marwane | Le V1 porté par une décision ; aucune fonction ne le calcule |

Le V2 se choisit **entre gammes** (ligne 19) : il ne fait plus partie du recalcul d'une seule gamme.

---

## Données d'entrée

Relevé en lecture seule du 26 novembre 2026. Une donnée absente n'est remplacée par aucun
substitut (volume, rang dans un fichier, longueur du texte, chiffre romain du nom du modèle).

| Donnée d'entrée | Lignes | Aujourd'hui | Écart déclaré |
|-----------------|--------|-------------|---------------|
| Fiche « vérifiée » (face au constructeur, décision 159) | 16, 18 | N'existe pas : aucune colonne ni table | `d192-fiche-verifiee` |
| Version « identifiée avec la gamme » | 16 | N'existe pas. `GAMME_PART_TERMS` est un motif de texte pour trois gammes, pas cette donnée | `d192-identifiee-avec-la-gamme` |
| Source de la demande (Ads, Google.fr, les deux) | 16 | Existe en partie : `__seo_keywords.source`, sans aucune valeur Google.fr ; une de ses valeurs ne se range ni dans Ads ni dans Google.fr ; une ligne n'a qu'une source | `d192-source-de-la-demande` |
| Génération du modèle | 16, 18, 19, 21 | N'existe pas : `__seo_keywords.generation` est vide et le catalogue n'a pas d'attribut génération | `d192-generation` |
| Fiche catalogue « affichable » | 18 | Existe : `auto_type.type_display` ; seul `'1'` est lu par le code, le sens des autres valeurs n'est pas documenté | `d192-affichable-et-compatible` |
| Fiche catalogue « compatible » avec la gamme | 18 | Plusieurs tables candidates, aucune désignée comme faisant foi | `d192-affichable-et-compatible` |
| « V2 validé » et arbitrage humain consigné | 19 | N'existe pas. Les `v_level = 'V2'` en base viennent de l'ancienne promotion par gamme | `d192-v2-valide` |
| « Voiture sans permis » | 26 | N'existe pas : aucun marqueur sur la marque, le modèle, la fiche ou la formulation | `d192-voiture-sans-permis` |
| État « À vérifier » (origine, fiches possibles, précision manquante) et état « Hors V-Level • voiture sans permis » | 22, 26 | Non stockables : `__seo_keywords.v_level` n'admet que des niveaux, et l'une de ses deux contraintes rejette V6 | `d192-etats-non-stockables` |
| Décision V1 par modèle et génération | 21 | N'existe pas (`gamme_seo_metrics.is_v1` est par gamme) | `d192-decision-v1` |

Ce qu'il faudrait pour chaque donnée (colonne, table, source) est décrit dans
`V_LEVEL_KNOWN_GAPS`, champ `proposedOnly` : **proposé seulement**. Toute nouvelle donnée,
colonne ou migration est une décision de Marwane.

---

## Calculateurs

Aucun des trois calculateurs n'est raccordé aux fonctions de la décision 192 : il leur manque des
données d'entrée. Ils sont laissés tels quels et appliquent encore la règle remplacée.

| Calculateur | Rôle | Écart déclaré |
|-------------|------|---------------|
| `backend/src/modules/admin/services/gamme-vlevel.service.ts` | Recalcul d'une gamme (API admin), écrit en base | `d192-calculateur-recalcul-admin` |
| `scripts/insert-missing-keywords.ts` | Import de mots-clés (CLI), écrit en base | `d192-calculateur-import-csv` |
| `scripts/seo/vlevel-v3-pipeline.ts` | Packs de décision, lecture seule | `d192-calculateur-packs-de-decision` |

Des objets en base sont antérieurs à la décision 192 et n'ont pas été modifiés (fonction
`propagate_vlevel_per_typeid`, déclencheurs `v2_repetitions`, fonctions `get_vlevel_*`) : écart
`d192-objets-en-base`. Les niveaux stockés aujourd'hui dans `__seo_keywords.v_level` viennent de
la règle remplacée : ils ne sont pas des niveaux au sens de la décision 192.

---

## Points que la décision ne tranche pas

Le code ne choisit pas à la place de la décision. Sur chaque point ci-dessous, il rend un résultat
explicite ou demande la donnée à l'appelant.

| Point | Ce que fait le code |
|-------|---------------------|
| « Identifiée avec la gamme » : oui ou non, ou degré de précision ? | Entrée oui/non fournie par l'appelant ; « à précision égale » compare deux fiches de même valeur |
| Deux fiches vérifiées à égalité après l'ordre de la ligne 16 | Aucun choix : résultat « égalité non départagée », les fiches sont nommées |
| V4 sans V3 retenu dans le groupe | Aucun V4 : les fiches restent « en attente d'un V3 » |
| V4 : la fiche doit-elle être « vérifiée » ? | La ligne 17 ne le demande pas : non exigé |
| V4 : moteur, puissance, année ou période absents | Pas de V4 : état « À vérifier », précision manquante nommée |
| « Reprendre la recherche avant toute élection » : portée (la formulation, le groupe, la gamme) | « Recherche complète » est fournie par l'appelant pour le groupe ; si non, l'élection du V3 est suspendue |
| « Gamme ayant validé un V3 » (ligne 19) : validé ou vérifié ? | Les voix sont fournies par l'appelant ; le code ne déduit pas la validation |
| Aucune voix alors qu'un V2 est validé | Rien n'est élu ni retiré |
| V6 : une formulation « À vérifier » est-elle une demande observée ? | « Demande observée » est fournie par l'appelant |
| Voiture sans permis et V5, V6 | Lue depuis « Hors V-Level » : ni V5 ni V6 |
| Mots-clés sans véhicule | Hors de la définition : aucun niveau, aucune règle écrite ici |

---

## Ce que la décision 192 remplace

La v5.0 de ce document n'est plus en vigueur. Ses règles, que les calculateurs non raccordés
appliquent encore :

- groupe `[gamme + modèle + énergie]`, sans génération ;
- V3 = champion du groupe par volume, puis ordre du fichier ou longueur du mot-clé ;
- V4 = le reste du groupe ;
- V2 = les dix premiers V3 d'une gamme ;
- V5 = véhicules frères par `modele_parent` ;
- V1 et V6 reportés.

Dans `packages/seo-roles/src/vlevel-invariants.ts`, ce qui en reste est regroupé sous
« Remplacé par la décision 192 » et n'est conservé que parce qu'un calculateur non raccordé
l'appelle encore. Le texte de la v5.0 reste lisible dans l'historique du fichier.

---

## Fichiers

| Fichier | Rôle |
|---------|------|
| `packages/seo-roles/src/vlevel-invariants.ts` | Les huit lignes, les fonctions pures, les écarts connus |
| `packages/seo-roles/src/__tests__/vlevel-invariants.test.ts` | Un cas synthétique par ligne ; identité du texte avec ce document |
| `backend/src/modules/admin/services/gamme-vlevel.service.ts` | Calculateur non raccordé |
| `scripts/insert-missing-keywords.ts` | Calculateur non raccordé |
| `scripts/seo/vlevel-v3-pipeline.ts` | Calculateur non raccordé |

---

## Historique des versions

| Version | Date | Changements |
|---------|------|-------------|
| v6.0 | 2026-11-26 | Alignement sur la décision 192 : huit lignes mot pour mot, deux états, fonctions pures, données d'entrée et calculateurs non raccordés. |
| v5.0 | 2026-02-10 | Réécriture complète. Remplacée par la décision 192. |
| v4.1 | 2026-02-10 | Fix V5 siblings via modele_parent. V3/V4 redéfinies. |
| v4.0 | 2026-02-09 | Première version formalisée. |
