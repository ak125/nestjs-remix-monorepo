# Instructions pour corriger la recherche

## Problème identifié
"KH22" est une **référence équipementier** (`pieces.piece_ref`), **PAS** une référence OEM (`pieces_ref_search.prs_search`) !

## Changements nécessaires dans `search-simple.service.ts`

### Ligne ~196-230 : Remplacer la logique de recherche

**SUPPRIMER** l'ancien code qui cherche dans `pieces_ref_search`:
```typescript
// ANCIEN (INCORRECT) - lines 196-230
const searchRefsResult = await this.client
  .from('pieces_ref_search')  // ❌ MAUVAIS
  .select('prs_piece_id, prs_ref, prs_search')
  .eq('prs_search', cleanedForSearch)
  .limit(500);

const searchRefs = searchRefsResult.data || [];
// ... etc
```

**REMPLACER PAR** :
```typescript
// NOUVEAU (CORRECT)
// ÉTAPE 1: Chercher dans pieces.piece_ref (ref équipementier)
const exactPiecesResult = await this.client
  .from('pieces')  // ✅ CORRECT
  .select('piece_id, piece_ref, piece_pg_id, piece_pm_id')
  .ilike('piece_ref', `%${cleanedForSearch}%`)
  .limit(100);

const exactPieces = exactPiecesResult.data || [];
this.logger.log(`📋 ${exactPieces.length} pièces trouvées avec piece_ref`);

if (exactPieces.length === 0) {
  return this.processResults([], refQuery, filters, page, limit, offset, startTime, categoryFilter, cacheKey);
}

// ÉTAPE 2: Récupérer les OEM de ces pièces
const exactPieceIds = exactPieces.map((p) => p.piece_id);
const oemRefsResult = await this.client
  .from('pieces_ref_search')
  .select('prs_piece_id, prs_ref, prs_search')
  .in('prs_piece_id', exactPieceIds)
  .limit(500);

const oemRefs = oemRefsResult.data || [];
this.logger.log(`🔗 ${oemRefs.length} OEM trouvés`);

// ÉTAPE 3: Trouver TOUTES pièces avec ces OEM (équivalents)
let allPieces = [...exactPieces];

if (oemRefs.length > 0) {
  const oemSearchTerms = [...new Set(oemRefs.map((r: any) => r.prs_search))];
  
  const allRefsResult = await this.client
    .from('pieces_ref_search')
    .select('prs_piece_id, prs_ref')
    .in('prs_search', oemSearchTerms)
    .limit(1000);

  const allRefs = allRefsResult.data || [];
  const allPieceIds = [...new Set(allRefs.map((r: any) => r.prs_piece_id))];

  const allPiecesResult = await this.client
    .from('pieces')
    .select('piece_id, piece_ref, piece_pg_id, piece_pm_id')
    .in('piece_id', allPieceIds)
    .limit(500);

  const equivalentPieces = allPiecesResult.data || [];
  const exactIds = new Set(exactPieces.map((p) => p.piece_id));
  const newEquivalents = equivalentPieces.filter((p) => !exactIds.has(p.piece_id));
  
  allPieces = [...exactPieces, ...newEquivalents];
  this.logger.log(`🔄 ${newEquivalents.length} équivalents ajoutés`);
}

this.logger.log(`📦 ${allPieces.length} pièces au total`);

// ÉTAPE 4: Marquer les pièces avec scores (exact=100, équivalent=90)
const oemRefMap = new Map<string, string>();
oemRefs.forEach((ref: any) => {
  oemRefMap.set(ref.prs_piece_id.toString(), ref.prs_ref);
});

const exactIds = new Set(exactPieces.map((p) => p.piece_id));
const markedPieces = allPieces.map((p) => {
  const isExact = exactIds.has(p.piece_id);
  const oemRef = oemRefMap.get(p.piece_id.toString());
  return {
    ...p,
    _isVariantMatch: false,
    _isOEM: !isExact,
    _oemRef: oemRef,
    _score: isExact ? 100 : 90,
  };
});

// ÉTAPE 5: Trier par score
const sortedPieces = markedPieces.sort((a, b) => b._score - a._score);

// Retourner les résultats
return this.processResults(
  sortedPieces,  // ✅ Pas markedPieces, mais sortedPieces
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

## Résultat attendu

Recherche "kh22" doit retourner :
1. **KH 22** (HUTCHINSON) - score 100 - EN PREMIER
2. K015212 (GATES) - score 90
3. 1754018 (SASIC) - score 90
4. X2971 (MGA) - score 90
5. etc. (toutes les pièces partageant les mêmes OEM)

Total : ~29 résultats (pas 200)
