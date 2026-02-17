# Page Roles — Vocabulaire Exclusif (Anti-Cannibalisation)

> Source : `backend/src/modules/seo/services/page-role-validator.service.ts`

Chaque page a un rôle SEO précis. **Le vocabulaire est exclusif à chaque rôle** pour éviter la cannibalisation.

---

## R1 — Router (Navigation)

**Fonction** : Orienter l'utilisateur vers la sélection véhicule → page produit R2
**Brief complet** : `references/r1-router-role.md`
**Max mots** : 150
**Question core** : "Où trouver la bonne pièce pour MON véhicule ?"

**Répartition** : 70% aide sélection véhicule, 20% compréhension gamme, 10% réassurance

**INTERDIT sur R1** :
- `bruit`, `usé`, `cassé`, `problème`, `symptôme`, `panne`, `défaillance`, `vibration`, `claquement`
- `quand`, `pourquoi`, `comment diagnostiquer`, `comment savoir`
- `causes`, `risques`, `danger`, `conséquences`, `si vous ne changez pas`
- `définition`, `qu'est-ce que`, `composé de`, `glossaire` (= R4)
- `démontage`, `remontage`, `étapes de remplacement`, `outils nécessaires` (= R3/conseils)
- `guide d'achat`, `référence OEM`, `checklist avant de payer` (= R3/guide-achat)
- `prix`, `€`, `en stock`, `livraison`, `ajouter au panier` (= R2)

**EXCLUSIF R1** (réservé uniquement aux pages R1) :
- `sélectionnez votre véhicule`, `sélectionner mon véhicule`
- `véhicules compatibles`, `pièces 100% compatibles`
- `montages différents selon`, `plusieurs variantes selon`
- `filtrer par véhicule`, `afficher les références compatibles`

---

## R2 — Product (Transaction)

**Fonction** : Vendre un produit spécifique

**REQUIS sur R2** (au moins un) :
- `prix`, `€`, `euro`, `ajouter`, `panier`, `acheter`, `commander`, `en stock`, `livraison`

**INTERDIT sur R2** :
- `choisir son véhicule`, `choisissez votre véhicule`, `sélectionnez votre marque`
- `toutes les marques`, `tous les modèles`

**EXCLUSIF R2** (réservé uniquement aux pages R2) :
- `€`, `prix`, `ajouter au panier`, `commander`, `livraison gratuite`
- `en stock`, `rupture de stock`, `garantie constructeur`, `réf. constructeur`, `frais de port`

---

## R3 — Blog (Information)

**Fonction** : Contenu éditorial, guides
**Sous-types** :
- **R3/guide-achat** : parcours d'achat (brief : `references/guide-achat-role.md`)
- **R3/conseils** : guide de remplacement how-to (brief : `references/conseils-role.md`)

**INTERDIT sur R3** :
- `sélectionnez votre véhicule`, `choisir votre véhicule`, `filtrer par`
- `trier par`, `affiner la recherche`, `filtres`, `tous les véhicules compatibles`

### R3/conseils — Vocabulaire exclusif

**EXCLUSIF R3/conseils** (réservé uniquement aux pages conseils) :
- `démontage` / `démonter` / `dépose`
- `remontage` / `remonter` / `repose`
- `étapes de remplacement` / `pas à pas`
- `outils nécessaires` / `outils indispensables`
- `couple de serrage` (contexte procédural)
- `ordre de démontage` / `ordre de remontage`
- `temps d'intervention` / `temps estimé`
- `niveau de difficulté` (facile / moyen / avancé)
- `contrôler en même temps`
- `vérifier après remontage` / `vérification finale`
- `essai routier` / `essai progressif`
- `avant de commencer` (contexte procédural)

**INTERDIT sur R3/conseils** (en plus des interdictions R3 générales) :
- R4 : `définition`, `qu'est-ce que`, `composé de`, `au sens strict`, `glossaire`
- R5 : `diagnostiquer` (focus principal), `bruit anormal`, `code DTC`, `code OBD`
- R3/guide-achat : `guide d'achat`, `commander`, `ajouter au panier`
- R2 : `prix`, `€`, `en stock`, `livraison`, `promotion`

---

## R4 — Reference (Définition)

**Fonction** : Définir un terme technique (intemporel, générique)
**Brief complet** : `references/r4-reference-role.md`

**REQUIS sur R4** (au moins un) :
- `définition`, `se compose de`, `rôle mécanique`, `fonction`, `composé de`

**INTERDIT sur R4** :
- **Commercial** : `prix`, `€`, `euro`, `acheter`, `commander`, `ajouter au panier`, `livraison`, `en stock`, `promotion`, `promo`, `solde`
- **Véhicules** : `peugeot`, `renault`, `citroen`, `volkswagen`, `audi`, `bmw`, `mercedes`, `ford`, `opel`, `fiat`, `toyota`, `nissan`, `206`, `208`, `308`, `3008`, `clio`, `megane`, `golf`, `polo`, `a3`, `a4`
- **Sélection** : `sélectionnez votre véhicule`, `filtrer par`, `tous les véhicules compatibles`
- **Générique AI** : `joue un rôle essentiel`, `assure le bon fonctionnement`, `il est important de noter`

**EXCLUSIF R4** (réservé uniquement aux pages R4) :
- `définition`, `qu'est-ce que`, `qu'est-ce qu'`, `désigne`
- `se compose de`, `composé de`, `terme technique`, `vocabulaire auto`
- `glossaire`, `par définition`, `au sens strict`, `ne pas confondre avec`
- `rôle mécanique`, `rôle négatif`, `scope et limites`, `règles métier`

**Vocabulaire normalisé R4** (cohérence inter-fiches) :

| Concept | Terme à utiliser | NE PAS utiliser |
|---------|------------------|-----------------|
| Référence constructeur | Référence OEM | Ref d'origine, code constructeur |
| Référence équipementier | Référence OES | Ref première monte |
| Pièce aftermarket | Pièce IAM | Pièce compatible, pièce adaptable |
| Table d'équivalence | Cross-reference | Correspondance, matching |
| Remplacement de ref | Supersession | Succession, évolution |
| Sélecteur véhicule | Sélecteur véhicule | Configurateur, chercheur de pièce |
| Compatible | Compatible (véhicule) | Adaptable, montable, universel |
| Équivalent | Équivalent (= même pièce) | Compatible (≠ même véhicule) |

**6 pièges à documenter dans chaque fiche R4** :

1. Ref ressemblante ±1 digit — refs qui ne diffèrent que d'1 caractère
2. Position gauche/droite ou avant/arrière — version miroir non interchangeable
3. Kit vs composant — pièce vendue aussi en kit
4. Universel vs spécifique — pièce véhicule-spécifique ou quasi-universelle
5. Supersession connue — ancienne ref couramment recherchée
6. Code PR discriminant — VW/Audi : code PR change la pièce

---

## R5 — Diagnostic (Symptômes)

**Fonction** : Aider à identifier un problème

**REQUIS sur R5** (au moins un) :
- `symptôme`, `symptômes`, `diagnostic`, `diagnostiquer`, `bruit`, `vibration`
- `panne`, `problème`, `signe`, `code dtc`, `code obd`

**INTERDIT sur R5** :
- `prix`, `€`, `euro`, `acheter`, `commander`, `ajouter au panier`, `livraison`, `en stock`, `promotion`

**EXCLUSIF R5** (réservé uniquement aux pages R5) :
- `symptôme`, `symptômes`, `bruit anormal`, `vibration anormale`
- `comment savoir si`
- `signe de`, `signes de`, `diagnostic`, `diagnostiquer`
- `panne potentielle`, `usure prématurée`
- `code dtc`, `code obd`

**PARTAGÉ R5/R3** (autorisé sur conseils mais contexte différent) :
- `quand changer`, `quand remplacer` — R5 = conclusion diagnostic réactif, R3/conseils = intervalles proactifs

---

## R6 — Support (Aide)

**Fonction** : Contenu informatif (FAQ, politiques)

---

## Maillage interne inter-rôles

Les pages doivent s'inter-lier selon des règles strictes pour éviter la cannibalisation :

| Depuis | Vers | Autorisé | Exemple |
|--------|------|----------|---------|
| R4 Référence | R5 Diagnostic | ✅ Oui | « Consulter les symptômes du disque de frein usé » |
| R4 Référence | R1 Router | ✅ Oui | « Voir toutes les pièces de freinage » |
| R4 Référence | R3 Blog | ✅ Oui | « Lire le guide : comment choisir son disque de frein » |
| R4 Référence | R2 Product | ❌ Non | Pas de lien commercial depuis une page référence |
| R5 Diagnostic | R4 Référence | ✅ Oui | « Comprendre le fonctionnement du disque de frein » |
| R5 Diagnostic | R2 Product | ❌ Non | Pas de lien commercial depuis une page diagnostic |
| R1 Router | R4 Référence | ✅ Oui | Lien définition dans la navigation |
| R2 Product | R4 Référence | ✅ Oui | « En savoir plus sur le disque de frein » |

### Maillage R3/conseils (how-to)

| Depuis | Vers | Autorisé | Exemple |
|--------|------|----------|---------|
| R3/conseils | R4 Référence | ✅ Oui | « En savoir plus : disque de frein — définition et rôle » |
| R3/conseils | R5 Diagnostic | ✅ Oui | « Diagnostic complet : identifier une panne de disque » |
| R3/conseils | R1/R2 Gamme | ✅ Oui | CTA « Voir les pièces compatibles » |
| R3/conseils | R3/guide-achat | ✅ Oui | « Consulter notre guide d'achat disques de frein » |
| R4 Référence | R3/conseils | ✅ Oui | « Guide de remplacement du disque de frein » |
| R5 Diagnostic | R3/conseils | ✅ Oui | « Comment remplacer le disque de frein » |
| R3/guide-achat | R3/conseils | ✅ Oui | « Nos conseils de montage disque de frein » |
| R2 Product | R3/conseils | ✅ Oui | « Conseils de montage pour ce disque » |

**Minimum liens par page conseils** : 8 (dont 1→R4, 1→R5, 1→gamme CTA, 3→pièces associées)

**Maillage systématique** : How-to ↔ Diagnostic ↔ Guide d'achat ↔ FAQ ↔ Page gamme

### Maillage R3/guide-achat (purchase journey)

| Depuis | Vers | Autorisé | Ancre type |
|--------|------|----------|------------|
| R3/guide-achat | R1 Router (gamme) | ✅ CTA conversion | « Voir les {pièces} compatibles avec votre véhicule » |
| R3/guide-achat | R3/conseils | ✅ Lien informatif | « Comment remplacer votre {pièce} » |
| R3/guide-achat | R4 Référence | ✅ Lien informatif | « Fiche technique {pièce} » |
| R3/guide-achat | R3/guide-achat (sibling) | ✅ Cross-link famille | « Notre guide {pièce associée} » |
| R3/guide-achat | R2 Product | ❌ Non | Pas de lien commercial direct — passer par R1 |
| R1 Router | R3/guide-achat | ✅ Bandeau conseils | « Guide d'achat {pièce} » |
| R3/conseils | R3/guide-achat | ✅ Oui | « Consulter notre guide d'achat {pièce} » |
| R4 Référence | R3/guide-achat | ✅ Oui | « Comment bien choisir son {pièce} » |

**Minimum liens par guide-achat** : 6 (dont 1→R1 CTA, 1→R3/conseils, 1→R4, 1→sibling, 2→ancres internes)

**Règle** : Ne jamais lier vers R2 (Product) depuis R4 ou R5. Le contenu informationnel reste non-commercial.
**Format** : Utiliser des ancres descriptives, jamais « cliquez ici » ou « en savoir plus » seul.
