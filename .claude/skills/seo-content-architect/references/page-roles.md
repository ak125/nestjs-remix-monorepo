# Page Roles — Vocabulaire Exclusif (Anti-Cannibalisation)

> Source : `backend/src/modules/seo/services/page-role-validator.service.ts`

Chaque page a un rôle SEO précis. **Le vocabulaire est exclusif à chaque rôle** pour éviter la cannibalisation.

---

## R1 — Router (Navigation)

**Fonction** : Orienter vers les sous-pages
**Max mots** : 150

**INTERDIT sur R1** :
- `bruit`, `usé`, `cassé`, `problème`, `symptôme`, `panne`, `défaillance`, `vibration`, `claquement`
- `quand`, `pourquoi`, `comment diagnostiquer`, `comment savoir`
- `causes`, `risques`, `danger`, `conséquences`, `si vous ne changez pas`

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

**INTERDIT sur R3** :
- `sélectionnez votre véhicule`, `choisir votre véhicule`, `filtrer par`
- `trier par`, `affiner la recherche`, `filtres`, `tous les véhicules compatibles`

---

## R4 — Reference (Définition)

**Fonction** : Définir un terme technique (intemporel, générique)

**INTERDIT sur R4** :
- **Commercial** : `prix`, `€`, `euro`, `acheter`, `commander`, `ajouter au panier`, `livraison`, `en stock`, `promotion`, `promo`, `solde`
- **Véhicules** : `peugeot`, `renault`, `citroen`, `volkswagen`, `audi`, `bmw`, `mercedes`, `ford`, `opel`, `fiat`, `toyota`, `nissan`, `206`, `208`, `308`, `3008`, `clio`, `megane`, `golf`, `polo`, `a3`, `a4`
- **Sélection** : `sélectionnez votre véhicule`, `filtrer par`, `tous les véhicules compatibles`

**EXCLUSIF R4** (réservé uniquement aux pages R4) :
- `définition`, `qu'est-ce que`, `qu'est-ce qu'`, `désigne`
- `se compose de`, `composé de`, `terme technique`, `vocabulaire auto`
- `glossaire`, `par définition`, `au sens strict`, `ne pas confondre avec`

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
- `quand changer`, `quand remplacer`, `comment savoir si`
- `signe de`, `signes de`, `diagnostic`, `diagnostiquer`
- `panne potentielle`, `usure prématurée`

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

**Règle** : Ne jamais lier vers R2 (Product) depuis R4 ou R5. Le contenu informationnel reste non-commercial.
**Format** : Utiliser des ancres descriptives, jamais « cliquez ici » ou « en savoir plus » seul.
