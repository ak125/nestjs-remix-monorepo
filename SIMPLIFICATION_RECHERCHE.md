# 🎯 Plan de Simplification - Recherche de Pièces Équivalentes

## Problème Actuel
Le code est devenu trop complexe avec multiples recherches parallèles, timeout, et confusion sur piece_ref vs piece_ref_clean.

## Solution Simple

### Étape 1 : Recherche de Base
```sql
-- Chercher "KH22" ou "KH 22" (case insensitive)
SELECT * FROM pieces WHERE LOWER(piece_ref) IN ('kh22', 'kh 22') LIMIT 100
```

### Étape 2 : Récupérer les OEM de ces pièces
```sql
-- Trouver les OEM de KH 22
SELECT prs_search FROM pieces_ref_search 
WHERE prs_piece_id IN (ids_trouvés_étape1)
```

### Étape 3 : Trouver TOUTES les pièces avec ces OEM
```sql
-- Trouver toutes les pièces partageant ces OEM
SELECT prs_piece_id FROM pieces_ref_search
WHERE prs_search IN (oem_trouvés_étape2)
```

### Étape 4 : Récupérer les détails
```sql
-- Récupérer les pièces complètes
SELECT * FROM pieces WHERE piece_id IN (ids_étape3)
```

## Avantages
✅ Logique claire et linéaire
✅ Pas de timeout (requêtes simples)
✅ Facile à debugger
✅ Performance OK (4 requêtes séquentielles simples)

## À Implémenter
1. Supprimer toutes les recherches complexes avec `.or()`, `.ilike()` multiples
2. Utiliser des requêtes simples avec `.in()` et `.eq()`
3. Gérer majuscules/minuscules avec `LOWER()` côté application
4. Pas de cache Redis au début (l'ajouter après si nécessaire)

## Pseudo-code
```typescript
async searchWithEquivalents(query: string) {
  const variants = [query.toLowerCase(), query.replace(/(\w)(\d)/g, '$1 $2').toLowerCase()];
  
  // 1. Trouver pièces exactes
  const exactPieces = await this.findByRef(variants);
  
  // 2. Trouver leurs OEM
  const oemRefs = await this.findOemRefs(exactPieces.map(p => p.id));
  
  // 3. Trouver pièces équivalentes
  const equivalentPieces = await this.findByOemRefs(oemRefs);
  
  // 4. Retourner tout
  return [...exactPieces, ...equivalentPieces];
}
```

**SIMPLICITÉ = EFFICACITÉ** ✨
