# 🔍 Diagnostic Recherche "kh22"

## Problème constaté

Lors de la recherche "kh22", toutes les pièces retournées ont un **score de 90** (OEM/équivalent) alors que **"KH 22" HUTCHINSON devrait avoir un score de 100** (référence directe équipementier).

## Analyse du code PHP

### Fonction de nettoyage
```php
function ClearSearchQuest($quest) {
    return strtolower(trim($quest));
}
```
- Query "kh22" → "kh22"
- Query "KH 22" → "kh 22"

### Recherche
```sql
SELECT DISTINCT PIECE_ID
FROM PIECES_REF_SEARCH
INNER JOIN PIECES ON PIECE_ID = PRS_PIECE_ID
WHERE PRS_SEARCH = 'kh22' AND PIECE_DISPLAY = 1
```

### Tri
```sql
ORDER BY PRS_KIND, PIECE_QTY_SALE*PRI_VENTE_TTC
```
- `PRS_KIND = 0` : Référence équipementier directe (priorité 1)
- `PRS_KIND = 1` : Référence OEM constructeur (priorité 2)

## Hypothèses

### Hypothèse 1 : Espace dans prs_search
`pieces_ref_search.prs_search` contient peut-être **"kh 22"** (avec espace) et non "kh22" (sans espace).

**Solution** : Ajouter des variantes de recherche : "kh22", "kh 22", "kh-22"

### Hypothèse 2 : piece_ref_clean vs piece_ref
La table `pieces` a deux champs :
- `piece_ref` : "KH 22" (référence avec espace)
- `piece_ref_clean` : "kh22" (référence nettoyée, lowercase, sans espace)

`prs_search` contient probablement la valeur de `piece_ref_clean`.

### Hypothèse 3 : Toutes les pièces sont indexées comme OEM
Il est possible que dans `pieces_ref_search`, **toutes les pièces pour "kh22" ont prs_kind=1** (OEM) et qu'il n'existe **aucune entrée avec prs_kind=0** (référence directe).

Cela signifierait que :
- "KH 22" HUTCHINSON est stocké dans `pieces` mais...
- Dans `pieces_ref_search`, il n'y a pas d'entrée avec `prs_search='kh22'` et `prs_kind=0`
- Toutes les entrées sont des références OEM croisées

## Actions à prendre

### ✅ 1. Vérifier le contenu de pieces_ref_search
```sql
SELECT prs_piece_id, prs_ref, prs_search, prs_kind, prs_prb_id
FROM pieces_ref_search
WHERE prs_search IN ('kh22', 'kh 22', 'kh-22')
ORDER BY prs_kind, prs_piece_id
LIMIT 20;
```

### ✅ 2. Vérifier piece_ref_clean
```sql
SELECT piece_id, piece_ref, piece_ref_clean, piece_pm_id
FROM pieces
INNER JOIN pieces_marque ON pm_id = piece_pm_id
WHERE piece_ref_clean = 'kh22'
   OR piece_ref ILIKE '%kh 22%'
   OR piece_ref ILIKE '%kh22%'
LIMIT 10;
```

### ✅ 3. Comparer avec le endpoint existant
Vérifier si `/api/search-existing/search?query=kh22` retourne aussi tous les scores à 90.

## Solution temporaire

En attendant de comprendre la structure exacte, on peut :
1. Ajouter les variantes de recherche (✅ déjà fait)
2. Si aucune entrée prs_kind=0 n'existe, considérer la première pièce comme référence directe
3. Utiliser `piece_ref_clean` au lieu de `piece_ref` pour le matching

## Code TypeScript actuel

```typescript
// Nettoyer la recherche : LOWERCASE + trim (comme PHP ClearSearchQuest)
const cleanedForSearch = refQuery.trim().toLowerCase();

// Chercher dans pieces_ref_search.prs_search
const searchRefsResult = await this.client
  .from('pieces_ref_search')
  .select('prs_piece_id, prs_ref, prs_search, prs_kind, prs_prb_id')
  .eq('prs_search', cleanedForSearch)
  .limit(1000);
```

✅ **Correct** : lowercase + trim comme PHP

❓ **À vérifier** : Est-ce que `prs_search` contient des espaces ?
