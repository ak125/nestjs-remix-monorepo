# 🎯 Plan d'Implémentation Recherche PHP → TypeScript

## Problème actuel
- Tous les résultats ont un score de 90 (OEM)
- "KH 22" HUTCHINSON devrait avoir un score de 100 (référence directe)
- Le tri ne correspond pas au PHP

## Structure de données découverte

### Table `pieces_ref_search`
```
prs_piece_id  : ID de la pièce (TEXT)
prs_search    : Terme de recherche normalisé (VARCHAR) - ex: "kh22"
prs_kind      : Type ("0" = ref directe, "1" = OEM) (TEXT)
prs_ref       : Référence originale (VARCHAR) - ex: "KH 22"
prs_prb_id    : ID de la marque (TEXT)
```

### Table `pieces`
```
piece_id       : ID unique
piece_ref      : Référence avec espaces - ex: "KH 22"
piece_ref_clean: Référence nettoyée - ex: "kh22"
piece_pm_id    : ID marque
piece_pg_id    : ID gamme
```

### Table `pieces_price`
```
pri_piece_id     : ID pièce
pri_pm_id        : ID marque
pri_vente_ttc    : Prix de vente TTC
pri_consigne_ttc : Prix consigne TTC
pri_dispo        : Disponibilité (1 = dispo)
```

## Logique PHP exacte

### Étape 1 : Nettoyage
```php
$questCleaned = strtolower(trim($quest)); // "kh22" → "kh22"
```

### Étape 2 : Recherche
```sql
SELECT DISTINCT PRS_PIECE_ID, PRS_REF, PRS_KIND
FROM PIECES_REF_SEARCH
WHERE PRS_SEARCH = 'kh22'
```

### Étape 3 : Jointure avec pieces + prix
```sql
SELECT PIECE_ID, PIECE_REF, PM_ID, PM_NAME, PM_OES, PRS_KIND,
       PRI_VENTE_TTC, PRI_CONSIGNE_TTC
FROM PIECES_REF_SEARCH
INNER JOIN PIECES ON PIECE_ID = PRS_PIECE_ID
INNER JOIN PIECES_PRICE ON PRI_PIECE_ID = PIECE_ID
INNER JOIN PIECES_MARQUE ON PM_ID = PRI_PM_ID
WHERE PRS_SEARCH = 'kh22' 
  AND PIECE_DISPLAY = 1 
  AND PM_DISPLAY = 1 
  AND PRI_DISPO = 1
ORDER BY PRS_KIND, PIECE_QTY_SALE*PRI_VENTE_TTC
```

### Étape 4 : Calcul qualité
```php
// 1. Vérifier consigne (prioritaire)
if($price_CS_TTC > 0) {
    $qualite = "Echange Standard";
}
// 2. Sinon vérifier PM_OES
else if($pm_oes == 'A') {
    $qualite = "AFTERMARKET";
}
else if($pm_oes == 'O' || $pm_oes == 'OES') {
    $qualite = "OES";
}
else {
    $qualite = "Adaptable";
}
```

## Implémentation TypeScript

### ✅ Ce qui est déjà correct
1. Nettoyage avec `toLowerCase() + trim()`
2. Recherche dans `pieces_ref_search`
3. Chargement des marques et gammes

### ❌ Ce qui manque ou est incorrect

#### 1. Variantes de recherche
**Problème** : `prs_search` peut contenir "kh 22" (avec espace) ou "kh22" (sans espace)

**Solution** :
```typescript
const queryVariants = [
  cleanedForSearch,                                    // "kh22"
  cleanedForSearch.replace(/([a-z])(\d)/gi, '$1 $2'), // "kh 22"
  cleanedForSearch.replace(/([a-z])(\d)/gi, '$1-$2'), // "kh-22"
];
const uniqueVariants = [...new Set(queryVariants)];

// Chercher avec toutes les variantes
.in('prs_search', uniqueVariants)
```

#### 2. Chargement des PRIX (CRITIQUE)
**Problème** : Sans les prix, impossible de trier correctement

**Solution** :
```typescript
// Après avoir récupéré les piece_ids
const pricesResult = await this.client
  .from('pieces_price')
  .select('pri_piece_id, pri_pm_id, pri_vente_ttc, pri_consigne_ttc, pri_dispo')
  .in('pri_piece_id', pieceIds)
  .eq('pri_dispo', 1); // Seulement les pièces disponibles

// Créer un Map pour accès rapide
const priceMap = new Map();
prices.forEach(price => {
  const key = `${price.pri_piece_id}-${price.pri_pm_id}`;
  priceMap.set(key, price);
});
```

#### 3. Enrichissement avec prs_kind + prix
**Solution** :
```typescript
const enrichedPieces = pieces.map(piece => {
  const priceKey = `${piece.piece_id}-${piece.piece_pm_id}`;
  const price = priceMap.get(priceKey);
  
  if (!price) return null; // Filtrer sans prix
  
  const prsKind = prsKindMap.get(piece.piece_id.toString()) || 999;
  
  return {
    ...piece,
    _prsKind: parseInt(prsKind), // 0 ou 1
    _priceVenteTTC: price.pri_vente_ttc || 0,
    _priceConsigneTTC: price.pri_consigne_ttc || 0,
  };
}).filter(p => p !== null);
```

#### 4. TRI EXACT comme PHP
**Solution** :
```typescript
const sortedPieces = enrichedPieces.sort((a, b) => {
  // PRIORITÉ 1: prs_kind (0 avant 1)
  if (a._prsKind !== b._prsKind) {
    return a._prsKind - b._prsKind;
  }
  
  // PRIORITÉ 2: Prix (simuler PIECE_QTY_SALE*PRI_VENTE_TTC)
  // Note: PIECE_QTY_SALE par défaut = 1
  const priceA = (piece.piece_qty_sale || 1) * a._priceVenteTTC;
  const priceB = (piece.piece_qty_sale || 1) * b._priceVenteTTC;
  return priceB - priceA; // Plus cher en premier
});
```

#### 5. Calcul du SCORE
**Solution** :
```typescript
// Score basé sur prs_kind
const score = piece._prsKind === 0 ? 100 : 90;
```

#### 6. Calcul de la QUALITÉ
**Solution** :
```typescript
function getQuality(pmOes: string, priceConsigne: number): string {
  // Priorité 1: Échange Standard (consigne > 0)
  if (priceConsigne && priceConsigne > 0) {
    return 'Échange Standard';
  }
  
  // Priorité 2: OES / AFTERMARKET
  if (pmOes === 'O' || pmOes === 'OES') {
    return 'OES';
  }
  if (pmOes === 'A') {
    return 'AFTERMARKET';
  }
  
  return 'Adaptable';
}
```

## Résultat attendu

Pour la recherche "kh22" :

```json
{
  "items": [
    {
      "reference": "KH 22",
      "brand": "HUTCHINSON",
      "quality": "AFTERMARKET",
      "price": 74.05,
      "consigne": 0,
      "stars": 4,
      "score": 100  // ← prs_kind=0 (référence directe)
    },
    {
      "reference": "CT935K1",
      "brand": "CONTITECH",
      "quality": "OES",
      "price": 135.98,
      "score": 90  // ← prs_kind=1 (OEM équivalent)
    }
  ]
}
```

## Commandes de test

```bash
# Test recherche
curl -s "http://localhost:3000/api/search?query=kh22&limit=5&clear_cache=1" | jq '.data.items[:3] | map({reference, brand, quality, price, score: ._score})'

# Comparer avec ancien endpoint
curl -s "http://localhost:3000/api/search-existing/search?query=kh22&limit=5" | jq '.data.items[:3] | map({reference, brand})'
```

## Notes importantes

1. **`prs_kind` est une STRING** : "0" ou "1", pas un nombre
2. **Filtrer par `pri_dispo = 1`** : Seulement les pièces disponibles
3. **Filtrer par `piece_display = 1`** : Seulement les pièces affichables
4. **Le tri PHP est CRUCIAL** : `ORDER BY PRS_KIND` doit être respecté
5. **Variantes de recherche** : Nécessaires car `prs_search` peut avoir des espaces
