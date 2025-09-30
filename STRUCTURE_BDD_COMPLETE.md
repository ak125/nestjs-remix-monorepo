# 🗄️ Structure Base de Données - Recherche

## Tables utilisées par le PHP

### 1️⃣ `pieces_ref_search` - Table d'indexation
**Tous les champs en TEXT**
```
prs_piece_id   : ID de la pièce (TEXT) - ex: "7183478"
prs_search     : Terme de recherche normalisé (VARCHAR) - ex: "kh 22"
prs_kind       : Type ("0" = ref directe, "1" = OEM) (TEXT) ⚠️
prs_ref        : Référence originale (VARCHAR) - ex: "KH 22"
prs_prb_id     : ID de la marque (TEXT)
```

**⚠️ CRITIQUE** : `prs_kind` est une STRING "0" ou "1", pas un number !

### 2️⃣ `pieces` - Table des pièces
```
piece_id        : integer - ID unique
piece_ref       : varchar - Référence avec espaces - ex: "KH 22"
piece_ref_clean : varchar - Référence nettoyée - ex: "kh22"
piece_pm_id     : smallint - ID marque
piece_pg_id     : integer - ID gamme
piece_qty_sale  : smallint - Quantité de vente
piece_display   : boolean - Affichable (TRUE/FALSE)
```

### 3️⃣ `pieces_price` - Table des prix
**⚠️ TOUS LES CHAMPS EN TEXT !**
```
pri_piece_id     : TEXT - ID pièce (doit matcher piece_id)
pri_pm_id        : TEXT - ID marque (doit matcher piece_pm_id)
pri_dispo        : TEXT - Disponibilité ("1" = dispo, "0" = non dispo)
pri_vente_ttc    : TEXT - Prix vente TTC - ex: "74.05"
pri_consigne_ttc : TEXT - Consigne TTC - ex: "0" ou "15.50"
pri_type         : TEXT - Type de prix
```

**⚠️ Conversion nécessaire** : `parseFloat(pri_vente_ttc)` pour les calculs

### 4️⃣ `pieces_marque` - Table des marques
```
pm_id       : integer - ID unique
pm_name     : varchar - Nom marque - ex: "HUTCHINSON"
pm_oes      : varchar - Qualité ("O"/"OES" = OES, "A" = AFTERMARKET)
pm_nb_stars : integer - Nombre d'étoiles (0-6)
pm_display  : boolean - Affichable
```

### 5️⃣ `pieces_gamme` - Table des gammes/catégories
```
pg_id      : integer - ID unique
pg_name    : varchar - Nom gamme - ex: "Kit de distribution"
pg_display : boolean - Affichable
```

## Logique de recherche PHP

### Étape 1 : Nettoyage
```php
function ClearSearchQuest($quest) {
    return strtolower(trim($quest));
}
// "kh22" → "kh22"
// "KH 22" → "kh 22"
```

### Étape 2 : Recherche dans pieces_ref_search
```sql
SELECT DISTINCT PRS_PIECE_ID, PRS_REF, PRS_KIND
FROM PIECES_REF_SEARCH
WHERE PRS_SEARCH = 'kh 22'  -- ⚠️ Peut contenir des espaces !
```

### Étape 3 : Jointure complète
```sql
SELECT PIECE_ID, PIECE_REF, PM_NAME, PM_OES, PRS_KIND,
       PRI_VENTE_TTC, PRI_CONSIGNE_TTC, PIECE_QTY_SALE
FROM PIECES_REF_SEARCH
INNER JOIN PIECES ON PIECE_ID = PRS_PIECE_ID
INNER JOIN PIECES_PRICE ON PRI_PIECE_ID = PIECE_ID AND PRI_PM_ID = PIECE_PM_ID
INNER JOIN PIECES_MARQUE ON PM_ID = PIECE_PM_ID
WHERE PRS_SEARCH = 'kh 22'
  AND PIECE_DISPLAY = 1
  AND PM_DISPLAY = 1
  AND PRI_DISPO = '1'  -- ⚠️ TEXT donc '1' pas 1
ORDER BY PRS_KIND, PIECE_QTY_SALE * CAST(PRI_VENTE_TTC AS NUMERIC)
```

### Étape 4 : Calcul qualité
```php
// Priorité 1: Consigne
if(floatval($pri_consigne_ttc) > 0) {
    $quality = "Echange Standard";
}
// Priorité 2: OES
else if($pm_oes == 'O' || $pm_oes == 'OES') {
    $quality = "OES";
}
// Priorité 3: AFTERMARKET
else if($pm_oes == 'A') {
    $quality = "AFTERMARKET";
}
else {
    $quality = "Adaptable";
}
```

## Points critiques pour TypeScript

### ✅ 1. Variantes de recherche
`prs_search` peut contenir :
- "kh22" (sans espace)
- "kh 22" (avec espace)
- "kh-22" (avec tiret)

**Solution** :
```typescript
const variants = [
  cleanQuery,                                    // "kh22"
  cleanQuery.replace(/([a-z])(\d)/gi, '$1 $2'), // "kh 22"
  cleanQuery.replace(/([a-z])(\d)/gi, '$1-$2'), // "kh-22"
];
```

### ✅ 2. Conversion des types
**Tous les champs de `pieces_price` sont TEXT !**
```typescript
const price = {
  vente: parseFloat(pri_vente_ttc) || 0,
  consigne: parseFloat(pri_consigne_ttc) || 0,
  dispo: pri_dispo === '1',
};
```

### ✅ 3. Conversion prs_kind
**`prs_kind` est TEXT : "0" ou "1"**
```typescript
const kind = parseInt(prs_kind) || 999;
// kind === 0 → Référence directe (score 100)
// kind === 1 → OEM équivalent (score 90)
```

### ✅ 4. Tri exact comme PHP
```typescript
sortedPieces.sort((a, b) => {
  // 1. Par prs_kind (0 avant 1)
  if (a._prsKind !== b._prsKind) {
    return a._prsKind - b._prsKind;
  }
  
  // 2. Par prix * quantité
  const priceA = (a.piece_qty_sale || 1) * a._priceVenteTTC;
  const priceB = (b.piece_qty_sale || 1) * b._priceVenteTTC;
  return priceB - priceA; // Plus cher en premier
});
```

### ✅ 5. Filtres obligatoires
```typescript
// Dans pieces_ref_search → pieces
.eq('piece_display', true)

// Dans pieces_price
.eq('pri_dispo', '1')  // ⚠️ STRING '1' pas boolean

// Dans pieces_marque
.eq('pm_display', true)
```

## Résultat attendu pour "kh22"

Si `prs_search` contient "kh 22" (avec espace) :

```json
{
  "items": [
    {
      "id": "7183478",
      "reference": "KH 22",
      "brand": "HUTCHINSON",
      "quality": "AFTERMARKET",
      "price": 74.05,
      "consigne": 0,
      "stars": 4,
      "score": 100  // ← prs_kind = "0"
    },
    {
      "reference": "CT935K1",
      "brand": "CONTITECH", 
      "quality": "OES",
      "price": 135.98,
      "score": 90  // ← prs_kind = "1"
    }
  ]
}
```

## Hypothèse principale

Le problème actuel (tous les scores à 90) vient probablement de :

1. **`prs_search` contient "kh 22"** (avec espace) mais on cherche "kh22" (sans espace)
   → Solution : Variantes de recherche

2. **Conversion incorrecte** de `prs_kind` TEXT en number
   → Solution : `parseInt(prs_kind)`

3. **Pas de chargement des prix** depuis `pieces_price`
   → Solution : JOIN avec `pieces_price` et conversion des TEXT en float

4. **Tri incorrect** sans tenir compte de `prs_kind`
   → Solution : Tri par `_prsKind` d'abord, puis prix
