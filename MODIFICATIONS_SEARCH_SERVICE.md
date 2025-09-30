# 🔧 Modifications à appliquer dans search-simple.service.ts

## Résumé des changements

Le service actuel utilise une logique incomplète. Voici les 7 modifications critiques à faire :

1. ✅ Utiliser `toLowerCase()` au lieu de `toUpperCase()`
2. ✅ Ajouter les variantes de recherche
3. ✅ Charger le champ `prs_kind` depuis `pieces_ref_search`
4. ✅ Charger `piece_qty_sale` et `piece_display` depuis `pieces`
5. ✅ Charger les PRIX depuis `pieces_price` avec `pri_dispo='1'`
6. ✅ Enrichir les pièces avec `_prsKind` et `_price*`
7. ✅ Trier par `prs_kind` d'abord, puis par prix

## Modification 1: Ligne ~189 - Nettoyer lowercase

**AVANT:**
```typescript
// Nettoyer la recherche : UPPERCASE + trim (comme PHP)
const cleanedForSearch = refQuery.trim().toUpperCase();

this.logger.log(
  `🔍 Recherche: "${refQuery}" → cleaned: "${cleanedForSearch}"`,
);

// ÉTAPE 1: Chercher dans pieces_ref_search avec prs_search (comme le PHP)
// WHERE PRS_SEARCH = '$questCleaned'
const searchRefsResult = await this.client
  .from('pieces_ref_search')
  .select('prs_piece_id, prs_ref, prs_search')
  .eq('prs_search', cleanedForSearch)
  .limit(500);
```

**APRÈS:**
```typescript
// Nettoyer la recherche : LOWERCASE + trim (comme PHP ClearSearchQuest)
const cleanedForSearch = refQuery.trim().toLowerCase();

// ÉTAPE 1: Générer des variantes de recherche (prs_search peut contenir des espaces)
const queryVariants = [
  cleanedForSearch, // "kh22"
  cleanedForSearch.replace(/([a-z])(\d)/gi, '$1 $2'), // "kh 22"
  cleanedForSearch.replace(/([a-z])(\d)/gi, '$1-$2'), // "kh-22"
];
const uniqueVariants = [...new Set(queryVariants)];

this.logger.log(
  `🔍 Recherche: "${refQuery}" → variantes: ${uniqueVariants.join(', ')}`,
);

// ÉTAPE 2: Chercher dans pieces_ref_search avec TOUTES les variantes
// ⚠️ prs_kind est TEXT ("0" ou "1")
const searchRefsResult = await this.client
  .from('pieces_ref_search')
  .select('prs_piece_id, prs_ref, prs_search, prs_kind')
  .in('prs_search', uniqueVariants)
  .limit(1000);
```

## Modification 2: Ligne ~200 - Ajouter logs prs_kind

**APRÈS** la ligne `const searchRefs = searchRefsResult.data || [];`

**AJOUTER:**
```typescript
this.logger.log(
  `📋 ${searchRefs.length} références trouvées dans pieces_ref_search`,
);

// Debug: Distribution des prs_kind
if (searchRefs.length > 0) {
  const kindCounts = searchRefs.reduce(
    (acc: any, ref: any) => {
      const kind = ref.prs_kind || 'null';
      acc[kind] = (acc[kind] || 0) + 1;
      return acc;
    },
    {},
  );
  this.logger.log(`📊 prs_kind distribution: ${JSON.stringify(kindCounts)}`);
}
```

## Modification 3: Ligne ~210 - Charger piece_qty_sale et piece_display

**AVANT:**
```typescript
const piecesResult = await this.client
  .from('pieces')
  .select('piece_id, piece_ref, piece_pg_id, piece_pm_id')
  .in('piece_id', pieceIds)
  .limit(1000);
```

**APRÈS:**
```typescript
const piecesResult = await this.client
  .from('pieces')
  .select(
    'piece_id, piece_ref, piece_pg_id, piece_pm_id, piece_qty_sale, piece_display',
  )
  .in('piece_id', pieceIds)
  .eq('piece_display', true)
  .limit(1000);
```

## Modification 4: NOUVELLE SECTION - Après chargement des pièces

**APRÈS** la ligne `const pieces = piecesResult.data || [];`

**AJOUTER** cette section complète:

```typescript
this.logger.log(`📦 ${pieces.length} pièces trouvées (piece_display=1)`);

if (pieces.length === 0) {
  return this.processResults(
    [],
    refQuery,
    filters,
    page,
    limit,
    offset,
    startTime,
    categoryFilter,
    cacheKey,
  );
}

// ÉTAPE 3: Charger les PRIX depuis pieces_price (CRITIQUE pour tri PHP)
// ⚠️ Tous les champs sont TEXT ! Conversion nécessaire
const pricesResult = await this.client
  .from('pieces_price')
  .select(
    'pri_piece_id, pri_pm_id, pri_vente_ttc, pri_consigne_ttc, pri_dispo',
  )
  .in('pri_piece_id', pieceIds.map(String))
  .eq('pri_dispo', '1'); // ⚠️ TEXT donc '1' pas 1 ou true

const prices = pricesResult.data || [];
this.logger.log(`💰 ${prices.length} prix disponibles (pri_dispo='1')`);

// Map pour accès rapide aux prix
const priceMap = new Map<string, any>();
prices.forEach((price: any) => {
  const key = `${price.pri_piece_id}-${price.pri_pm_id}`;
  priceMap.set(key, price);
});

// ÉTAPE 4: Map pour prs_kind (le plus bas par pièce)
const prsKindMap = new Map<string, string>();
searchRefs.forEach((ref: any) => {
  const pieceId = ref.prs_piece_id;
  const currentKind = prsKindMap.get(pieceId);
  // Garder le prs_kind le plus bas ("0" < "1")
  if (!currentKind || ref.prs_kind < currentKind) {
    prsKindMap.set(pieceId, ref.prs_kind || '999');
  }
});

// ÉTAPE 5: Enrichir les pièces avec prs_kind + prix
const enrichedPieces = pieces
  .map((piece: any) => {
    const priceKey = `${piece.piece_id}-${piece.piece_pm_id}`;
    const price = priceMap.get(priceKey);

    // Filtrer les pièces sans prix disponible
    if (!price) return null;

    const prsKind = prsKindMap.get(piece.piece_id.toString()) || '999';

    return {
      ...piece,
      _prsKind: parseInt(prsKind), // Convertir TEXT en number
      _priceVenteTTC: parseFloat(price.pri_vente_ttc) || 0, // TEXT → float
      _priceConsigneTTC: parseFloat(price.pri_consigne_ttc) || 0, // TEXT → float
    };
  })
  .filter((p) => p !== null);

this.logger.log(
  `✅ ${enrichedPieces.length} pièces enrichies avec prix et prs_kind`,
);

// ÉTAPE 6: TRI EXACT comme PHP: ORDER BY PRS_KIND, PIECE_QTY_SALE*PRI_VENTE_TTC
const sortedPieces = enrichedPieces.sort((a, b) => {
  // Priorité 1: prs_kind (0 avant 1)
  if (a._prsKind !== b._prsKind) {
    return a._prsKind - b._prsKind;
  }
  // Priorité 2: Prix * Quantité (comme PHP)
  const priceA = (a.piece_qty_sale || 1) * a._priceVenteTTC;
  const priceB = (b.piece_qty_sale || 1) * b._priceVenteTTC;
  return priceB - priceA; // Plus cher en premier
});

this.logger.log(
  `🔄 Tri: ${sortedPieces.filter((p) => p._prsKind === 0).length} refs directes (prs_kind=0), ` +
    `${sortedPieces.filter((p) => p._prsKind === 1).length} OEM (prs_kind=1)`,
);

// Retourner les résultats
return this.processResults(
  sortedPieces,
  refQuery,
  filters,
  page,
  limit,
  offset,
  startTime,
  categoryFilter,
  cacheKey,
);
```

## Modification 5: Dans processResults - Préserver les données enrichies

Dans la fonction `processResults`, ligne ~340, dans le mapping `allItems`:

**MODIFIER** pour préserver `_prsKind` et `_price*`:

```typescript
return {
  id: piece.piece_id?.toString() || '',
  reference: piece.piece_ref || '',
  brand: marqueData?.name || '',
  brandId: piece.piece_pm_id,
  category: gammeMap.get(piece.piece_pg_id) || '',
  categoryId: piece.piece_pg_id,
  // Préserver les données enrichies de search()
  _prsKind: piece._prsKind !== undefined ? piece._prsKind : 999,
  _priceVenteTTC: piece._priceVenteTTC || 0,
  _priceConsigneTTC: piece._priceConsigneTTC || 0,
  _score: piece._prsKind === 0 ? 100 : 90, // Score basé sur prs_kind
};
```

## Modification 6: Avant pagination - Exposer les données au frontend

Dans `processResults`, **AVANT** `const paginatedItems = sortedItems.slice(offset, offset + limit);`:

```typescript
// Exposer les données au frontend
sortedItems.forEach((item: any) => {
  // Qualité
  let quality = 'Adaptable';
  if (item._priceConsigneTTC > 0) {
    quality = 'Échange Standard';
  } else if (marqueMap.get(item.brandId)?.oes === 'O' || marqueMap.get(item.brandId)?.oes === 'OES') {
    quality = 'OES';
  } else if (marqueMap.get(item.brandId)?.oes === 'A') {
    quality = 'AFTERMARKET';
  }
  
  item.quality = quality;
  item.price = item._priceVenteTTC?.toFixed(2);
  item.consigne = item._priceConsigneTTC?.toFixed(2);
  item.stars = marqueMap.get(item.brandId)?.stars || 0;
  item.score = item._score;
  
  // Nettoyer les flags internes
  delete item._prsKind;
  delete item._priceVenteTTC;
  delete item._priceConsigneTTC;
  delete item._score;
});
```

## Test après modifications

```bash
curl -s "http://localhost:3000/api/search?query=kh22&limit=5&clear_cache=1" | jq '.data.items[:3] | map({reference, brand, quality, price, score})'
```

**Résultat attendu:**
```json
[
  {
    "reference": "KH 22",
    "brand": "HUTCHINSON",
    "quality": "AFTERMARKET",
    "price": "74.05",
    "score": 100  // ← prs_kind=0 !
  },
  {
    "reference": "CT935K1",
    "brand": "CONTITECH",
    "quality": "OES",
    "price": "135.98",
    "score": 90  // ← prs_kind=1
  }
]
```

## Points clés

1. **`prs_kind` est TEXT** : `"0"` ou `"1"`, utiliser `parseInt()`
2. **`pri_dispo` est TEXT** : `'1'` pas `1` ou `true`
3. **Tous les prix sont TEXT** : utiliser `parseFloat()`
4. **Variantes essentielles** : "kh22", "kh 22", "kh-22"
5. **Tri crucial** : `prs_kind` d'abord (0 avant 1), puis prix
6. **Score** : 100 pour prs_kind=0, 90 pour prs_kind=1
