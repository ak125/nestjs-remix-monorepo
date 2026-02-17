# R4 — Concepts partagés (contexte injectable pour le générateur IA)

> **Usage :** Ce fichier est injecté comme contexte système quand le générateur IA écrit une fiche R4
> ou du contenu lié aux références pièces auto. Les définitions sont courtes et factuelles.

---

## Types de références

**OEM (Original Equipment Manufacturer)** — Code officiel du constructeur véhicule (Renault, PSA, VW). Source de vérité pour identifier une pièce exacte. Gravé sur la pièce d'origine.

**OES (Original Equipment Supplier)** — Référence du fabricant qui fournit la 1ère monte (ATE, Valeo, Bosch, Sachs). Pièce physiquement identique à l'OEM, catalogue différent. Souvent 20-40% moins cher.

**IAM (Independent Aftermarket)** — Référence catalogue d'un fabricant indépendant (TRW, Brembo, Febi). Pas forcément fournisseur 1ère monte. Lié à l'OEM via un cross-reference.

**Référence distributeur** — Code interne vendeur (SKU, ERP). Utile pour le stock, inutile pour la compatibilité technique.

**Référence TecDoc** — Identifiant dans la base européenne TecDoc. Combinaison marque + numéro article. Liens véhicule ↔ pièce pré-validés.

---

## Hiérarchie de confiance

```
VIN/immat > OEM > OES > IAM (cross vérifié) > IAM (catalogue seul) > Distributeur > Recherche client
```

Toujours remonter au niveau le plus haut possible avant de confirmer une compatibilité.

---

## Équivalences

**Cross-reference** — Lien OEM ↔ OES ↔ IAM signifiant "même pièce physique". Peut être bidirectionnel ou unidirectionnel.

**Supersession** — Ref ancienne remplacée par une nouvelle (A → B). Peut être chaînée : A → B → C. L'ancienne n'est plus fabriquée.

**Kit vs composant** — Une ref peut être un ensemble (kit embrayage = disque + mécanisme + butée) ou une pièce seule. Prix et compatibilité différents.

**Position** — Avant/arrière, gauche/droite, intérieur/extérieur. La ref change selon la position même si la pièce se ressemble.

---

## Niveaux de compatibilité

| Niveau | Source | Fiabilité |
|--------|--------|-----------|
| Vérifié constructeur | VIN + base OEM | ~99% |
| Vérifié TecDoc/cross | Cross OEM↔IAM + type mine | ~95% |
| Probable | Dimensions + période + modèle | ~80% |

---

## Codes véhicule

**Type mine (France)** — Code CNIT identifiant précisément la variante véhicule. Sur la carte grise.

**KBA (Allemagne)** — HSN/TSN, même rôle que le type mine.

**Codes PR (VW/Audi)** — Codes option sur l'étiquette du coffre. Changent la pièce (ex : `1LJ` = disques 288mm, `1ZD` = disques 312mm).

---

## Pièges à documenter dans chaque fiche R4

Quand tu écris une fiche R4 pour une pièce, vérifie si ces pièges s'appliquent :

1. **Ref ressemblante ±1 digit** — Existe-t-il des refs qui ne diffèrent que d'1 caractère pour cette gamme ? Si oui, le mentionner dans "confusions courantes".

2. **Position gauche/droite ou avant/arrière** — La pièce existe-t-elle en version miroir ? Si oui, mentionner dans "règles métier" qu'elles ne sont pas interchangeables.

3. **Kit vs composant** — La pièce se vend-elle aussi en kit avec d'autres composants ? Si oui, mentionner la différence dans "confusions courantes".

4. **Universel vs spécifique** — La pièce est-elle strictement véhicule-spécifique ou quasi-universelle ? Mentionner dans "scope et limites".

5. **Supersession connue** — Existe-t-il une ancienne ref couramment recherchée pour cette pièce ? Si oui, le noter pour le moteur de recherche.

6. **Code PR discriminant** — Pour les véhicules VW/Audi, un code PR change-t-il la pièce ? Si oui, mentionner dans "règles métier".

---

## Vocabulaire à utiliser (cohérence entre fiches)

| Concept | Terme à utiliser | Ne PAS utiliser |
|---------|-----------------|-----------------|
| Référence constructeur | Référence OEM | Ref d'origine, code constructeur |
| Référence équipementier | Référence OES | Ref première monte |
| Pièce aftermarket | Pièce IAM | Pièce compatible, pièce adaptable |
| Table d'équivalence | Cross-reference | Correspondance, matching |
| Remplacement de ref | Supersession | Succession, évolution |
| Sélecteur véhicule | Sélecteur véhicule | Configurateur, chercheur de pièce |
| Compatible | Compatible (véhicule) | Adaptable, montable, universel |
| Équivalent | Équivalent (= même pièce) | Compatible (≠ même véhicule) |

---

## Dimensions techniques courantes (par famille)

Quand tu écris la composition ou la définition, utilise les unités et dimensions propres à la famille :

| Famille | Dimensions clés | Unités |
|---------|----------------|--------|
| Freinage | Diamètre, épaisseur, entraxe, nb trous | mm |
| Embrayage | Diamètre, nb cannelures, épaisseur | mm |
| Distribution | Nb dents, largeur, pas | — , mm |
| Filtration | Longueur, largeur, hauteur | mm |
| Suspension | Longueur, diamètre tige, force | mm, N |
| Éclairage | Puissance, culot, tension | W, V |
| Refroidissement | Capacité, débit, pression ouverture | L, L/min, bars |
