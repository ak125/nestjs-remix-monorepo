# 🔍 Recherche avec Tables d'Indexation PHP

## 📊 Architecture de Recherche Découverte

### **Tables d'indexation utilisées par PHP**

Le système PHP utilise **deux tables d'indexation** pour optimiser la recherche de références :

#### 1️⃣ `pieces_ref_search` - Références Équipementiers
```sql
CREATE TABLE pieces_ref_search (
  prs_piece_id VARCHAR,      -- ID de la pièce
  prs_search VARCHAR,        -- Terme de recherche normalisé (ex: "325")
  prs_kind TEXT,             -- Type de recherche
  prs_ref VARCHAR,           -- Référence originale
  prs_prb_id TEXT,           -- ID de la marque
  prs_year TEXT,             -- Année
  prs_piece_prime TEXT       -- Pièce primaire
);
```

**Exemple de recherche PHP :**
```sql
SELECT DISTINCT PIECE_ID
FROM PIECES_REF_SEARCH
INNER JOIN PIECES ON PIECE_ID = PRS_PIECE_ID
WHERE PRS_SEARCH = '325' AND PIECE_DISPLAY = 1
```

#### 2️⃣ `pieces_ref_oem` - Références Constructeurs (OEM)
```sql
CREATE TABLE pieces_ref_oem (
  pro_piece_id TEXT,         -- ID de la pièce
  pro_prb_id TEXT,           -- ID de la marque
  pro_oem TEXT,              -- Référence OEM complète
  pro_oem_serach TEXT,       -- Référence OEM normalisée (typo: "serach")
  pro_year TEXT              -- Année
);
```

**Ces tables sont pré-calculées** et contiennent toutes les variantes de recherche possibles.

---

## 🎯 Logique de Recherche PHP Complète

### **Étape 1 : Nettoyage de la requête**
```php
function ClearSearchQuest($quest) {
    return strtolower(trim($quest));
}
```

### **Étape 2 : Recherche dans les tables d'indexation**
```php
// Compter les résultats totaux
$query_item_count = "SELECT DISTINCT PIECE_ID
    FROM PIECES_REF_SEARCH
    INNER JOIN PIECES ON PIECE_ID = PRS_PIECE_ID
    WHERE PRS_SEARCH = '$questCleaned' AND PIECE_DISPLAY = 1";
```

### **Étape 3 : Génération des facets (filtres)**

#### Facet **GAMME** (Catégorie de produit)
```sql
SELECT DISTINCT PG_ID, PG_NAME, PG_ALIAS, COUNT(PIECE_ID) AS NBP 
FROM PIECES_REF_SEARCH
INNER JOIN PIECES ON PIECE_ID = PRS_PIECE_ID  
INNER JOIN PIECES_GAMME ON PG_ID = PIECE_PG_ID
WHERE PRS_SEARCH = '325' AND PIECE_DISPLAY = 1 AND PG_DISPLAY = 1
GROUP BY PIECE_PG_ID
ORDER BY PIECE_PG_ID, PIECE_SORT
```

Résultat attendu pour "325" :
- Disque de frein (42)
- Plaquette de frein (21)
- Tambour de frein (5)
- Accessoires mâchoire de frein (1)
- Accessoires plaquette de frein (1)

#### Facet **QUALITÉ**
```sql
SELECT DISTINCT PM_OES
FROM PIECES_REF_SEARCH
INNER JOIN PIECES_REF_BRAND ON PRB_ID = PRS_PRB_ID
INNER JOIN PIECES ON PIECE_ID = PRS_PIECE_ID 
INNER JOIN PIECES_PRICE ON PRI_PIECE_ID = PIECE_ID 		
INNER JOIN PIECES_MARQUE ON PM_ID = PRI_PM_ID
WHERE PRS_SEARCH = '325' 
  AND PIECE_DISPLAY = 1 
  AND PM_DISPLAY = 1 
  AND PRI_DISPO = 1 
  AND PM_OES IS NOT NULL
ORDER BY PM_OES
```

Valeurs possibles :
- `PM_OES = 'A'` → **AFTERMARKET**
- `PM_OES <> 'A'` → **OES** (Original Equipment Supplier)
- `PRI_CONSIGNE_TTC > 0` → **Echange Standard**

#### Facet **ÉTOILES** (Qualité marque)
```sql
SELECT DISTINCT PM_NB_STARS 
FROM PIECES_REF_SEARCH
INNER JOIN PIECES_REF_BRAND ON PRB_ID = PRS_PRB_ID
INNER JOIN PIECES ON PIECE_ID = PRS_PIECE_ID 
INNER JOIN PIECES_PRICE ON PRI_PIECE_ID = PIECE_ID 		
INNER JOIN PIECES_MARQUE ON PM_ID = PRI_PM_ID
WHERE PRS_SEARCH = '325' 
  AND PIECE_DISPLAY = 1 
  AND PM_DISPLAY = 1 
  AND PRI_DISPO = 1 
  AND PM_NB_STARS > 0
ORDER BY PM_NB_STARS DESC
```

#### Facet **ÉQUIPEMENTIERS** (Marques)
```sql
SELECT DISTINCT PM_ID, PM_NAME, PM_ALIAS  
FROM PIECES_REF_SEARCH
INNER JOIN PIECES ON PIECE_ID = PRS_PIECE_ID
INNER JOIN PIECES_MARQUE ON PM_ID = PIECE_PM_ID
WHERE PRS_SEARCH = '325' 
  AND PIECE_DISPLAY = 1 
  AND PM_DISPLAY = 1
ORDER BY PM_SORT
```

### **Étape 4 : Listing des pièces par gamme**
```sql
SELECT DISTINCT 
  PIECE_ID, PIECE_REF, PIECE_NAME, PIECE_NAME_COMP, PIECE_NAME_SIDE,
  PRS_REF, PIECE_HAS_IMG, PIECE_HAS_OEM, PIECE_QTY_SALE, 
  PM_ID, PM_NAME, PM_LOGO, PM_OES, PM_NB_STARS, PRB_NAME 
FROM PIECES_REF_SEARCH
INNER JOIN PIECES_REF_BRAND ON PRB_ID = PRS_PRB_ID
INNER JOIN PIECES ON PIECE_ID = PRS_PIECE_ID 
INNER JOIN PIECES_PRICE ON PRI_PIECE_ID = PIECE_ID 		
INNER JOIN PIECES_MARQUE ON PM_ID = PRI_PM_ID
WHERE PRS_SEARCH = '325' 
  AND PIECE_PG_ID = $filter_pg_id 
  AND PIECE_DISPLAY = 1 
  AND PM_DISPLAY = 1 
  AND PRI_DISPO = 1 
ORDER BY PRS_KIND, PIECE_QTY_SALE * PRI_VENTE_TTC
```

**Tri important :**
- `PRS_KIND` : Type de correspondance (exacte, partielle, etc.)
- `PIECE_QTY_SALE * PRI_VENTE_TTC` : Prix total (quantité × prix unitaire)

---

## 🆕 Implémentation NestJS

### **Service Enhanced avec tables d'indexation**

```typescript
// backend/src/modules/search/services/search-enhanced-existing.service.ts

async searchPieces(params: { query: string; ... }) {
  const cleanQuery = this.cleanSearchQuery(query);
  
  // 1️⃣ Recherche COMBINÉE dans les deux tables d'indexation
  const [refSearchResult, refOemResult] = await Promise.all([
    this.client
      .from('pieces_ref_search')
      .select('prs_piece_id, prs_kind, prs_ref')
      .eq('prs_search', cleanQuery),
    this.client
      .from('pieces_ref_oem')
      .select('pro_piece_id, pro_oem')
      .eq('pro_oem_serach', cleanQuery),
  ]);
  
  // 2️⃣ Combiner les piece_ids des deux sources
  const allPieceIds = new Set<number>();
  refSearchResult.data?.forEach(r => allPieceIds.add(parseInt(r.prs_piece_id)));
  refOemResult.data?.forEach(r => allPieceIds.add(parseInt(r.pro_piece_id)));
  
  // 3️⃣ Récupérer les pièces complètes avec jointures
  const pieces = await this.client
    .from('pieces')
    .select('...')
    .in('piece_id', Array.from(allPieceIds))
    .eq('piece_display', 1);
    
  // 4️⃣ Enrichir avec prix, images, marques, gammes
  // 5️⃣ Générer les facets dynamiques
  // 6️⃣ Retourner les résultats groupés
}
```

### **Avantages de cette approche**

✅ **Performance** : Les tables d'indexation sont pré-calculées
✅ **Exhaustivité** : Combine références équipementiers ET OEM
✅ **Compatibilité PHP** : Reproduit exactement la logique existante
✅ **Facets dynamiques** : Génère les filtres à partir des résultats réels
✅ **Groupement** : Organise par gamme (catégorie)

---

## 📈 Résultats Attendus pour "325"

### **Avant (recherche directe sur pieces)**
- 6 résultats seulement
- Facets vides
- Pas de groupement par catégorie

### **Après (avec tables d'indexation)**
- **~70 résultats** (ref_search + ref_oem)
- Facets avec comptages réels :
  - Gamme : Disque de frein (42), Plaquette (21), Tambour (5), etc.
  - Marques : BLUE PRINT, ATE, BREMBO, BOSCH, etc.
  - Qualité : OES, AFTERMARKET, Echange Standard
  - Étoiles : ★★★★★★, ★★★★★, etc.
- Groupement par catégorie comme PHP
- Tri par pertinence (PRS_KIND + prix)

---

## 🔧 Tables Impliquées

### **Tables principales**
1. `pieces` - Table des pièces (4M+ enregistrements)
2. `pieces_gamme` - Catégories (9K+)
3. `pieces_marque` - Marques/équipementiers (981)
4. `pieces_price` - Prix (442K+)
5. `pieces_media_img` - Images (4.6M+)

### **Tables d'indexation (nouvellement utilisées)**
6. `pieces_ref_search` - Index références équipementiers
7. `pieces_ref_oem` - Index références OEM constructeurs

### **Tables de liaison (PHP utilise)**
8. `pieces_ref_brand` - Liaison référence → marque (PRB_ID)

---

## 📝 Notes Importantes

### **Typo dans la base de données**
⚠️ La colonne est nommée `pro_oem_serach` (avec typo "serach" au lieu de "search")

### **Champs TEXT au lieu de INT**
Plusieurs colonnes sont en TEXT alors qu'elles contiennent des IDs :
- `prs_piece_id`, `prs_prb_id` → Conversion parseInt() nécessaire
- `pro_piece_id`, `pro_prb_id` → Conversion parseInt() nécessaire

### **Jointure pieces_ref_brand**
Le PHP utilise aussi `pieces_ref_brand` (non encore implémentée dans NestJS)
```sql
INNER JOIN PIECES_REF_BRAND ON PRB_ID = PRS_PRB_ID
```

Cette table fait le lien entre :
- Référence de recherche (`PRS_PRB_ID`)
- Marque de la référence (`PRB_ID`)
- Nom de la marque (`PRB_NAME`)

---

## 🎯 Prochaines Étapes

1. ✅ **Utiliser pieces_ref_search + pieces_ref_oem** (fait)
2. ⏳ **Implémenter pieces_ref_brand** pour le tri PRS_KIND
3. ⏳ **Générer facets avec comptages réels** (en cours)
4. ⏳ **Grouper résultats par gamme** comme PHP
5. ⏳ **Implémenter tri par PRS_KIND + prix**
6. ⏳ **Tester avec "325" et comparer avec PHP** (objectif: 70+ résultats)

---

## 🔗 Références

- Fichier PHP original : `/recherche.php` (v7 et v8)
- Service NestJS : `backend/src/modules/search/services/search-enhanced-existing.service.ts`
- Controller : `backend/src/modules/search/controllers/search-enhanced-existing.controller.ts`
- Endpoints : `/api/search-existing/*`

---

**Créé le :** 30 septembre 2025  
**Status :** 🔄 En cours d'implémentation  
**Objectif :** Reproduire exactement la recherche PHP avec 70+ résultats pour "325"
