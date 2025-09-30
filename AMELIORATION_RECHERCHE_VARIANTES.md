# 🔍 Amélioration: Support des Variantes de Recherche

**Date**: 30 septembre 2025  
**Problème**: "KH22" retourne 0 résultat alors que PHP trouve 10 produits

## 📋 Analyse du Problème

### Comportement Actuel (Avant)
```bash
Recherche: "kh22"
Résultat: 0 pièce trouvée ❌

Logs:
✅ 0 résultats dans pieces_ref_search
✅ 0 résultats dans pieces_ref_oem
❌ Aucun résultat pour "kh22" dans les tables d'indexation
```

### Comportement PHP (Attendu)
```
Recherche: "kh22"
Résultat: 10 produits trouvés ✅

Equipementiers:
- HUTCHINSON KH 22 → 74.05 €
- SASIC 1754018 → 60.29 €
- MGA X2971 → 69.96 €
- DAYCO KTB280 → 81.47 €
- GATES K015212 → 88.56 €
- SNR KD455.03 → 97.15 €
- CONTITECH CT935K1 → 135.98 €
- FEBI 11149 → 141.84 €
```

## 🔎 Cause du Problème

La table `pieces_ref_search` contient probablement **différentes variantes** de la référence :
- `kh22` (sans espace)
- `kh 22` (avec espace)
- `kh-22` (avec tiret)
- `KH22` (majuscules)

**Avant**, on faisait :
```typescript
.eq('prs_search', cleanQuery)  // Recherche EXACTE sur "kh22"
```

Si la base contient "kh 22" (avec espace), aucun résultat n'est trouvé !

## ✅ Solution Implémentée

### 1. Génération de Variantes

**Fichier**: `backend/src/modules/search/services/search-enhanced-existing.service.ts` (ligne 65-73)

```typescript
// 2️⃣ RECHERCHE COMBINÉE dans pieces_ref_search ET pieces_ref_oem (comme PHP)
// Essayer plusieurs variantes: "kh22", "kh 22", "kh-22"
const queryVariants = [
  cleanQuery, // "kh22"
  cleanQuery.replace(/([a-z])(\d)/gi, '$1 $2'), // "kh 22"
  cleanQuery.replace(/([a-z])(\d)/gi, '$1-$2'), // "kh-22"
];
```

**Exemple** :
- Input: `"kh22"`
- Output: `["kh22", "kh 22", "kh-22"]`

### 2. Recherche avec OR

**Avant**:
```typescript
.eq('prs_search', cleanQuery)  // Une seule variante
```

**Maintenant**:
```typescript
.or(queryVariants.map((v) => `prs_search.eq.${v}`).join(','))
// Résultat: prs_search.eq.kh22,prs_search.eq.kh 22,prs_search.eq.kh-22
```

Cela génère une requête SQL équivalente à :
```sql
WHERE prs_search = 'kh22' 
   OR prs_search = 'kh 22' 
   OR prs_search = 'kh-22'
```

## 🎯 Cas d'Usage Supportés

| Recherche | Variantes Générées | Trouve |
|-----------|-------------------|--------|
| `325` | `["325"]` | ✅ Référence simple |
| `kh22` | `["kh22", "kh 22", "kh-22"]` | ✅ Alphanumérique |
| `gdb1332` | `["gdb1332", "gdb 1332", "gdb-1332"]` | ✅ Code mixte |
| `0 986 478 325` | `["0 986 478 325"]` | ✅ Avec espaces |
| `32585` | `["32585"]` | ✅ Numérique pur |

## 📊 Impact Attendu

### Avant
```
"kh22"     → 0 résultat ❌
"325"      → 34 résultats ✅
"gdb1332"  → ? (à tester)
```

### Maintenant
```
"kh22"     → 10 résultats (HUTCHINSON, SASIC, MGA...) ✅
"kh 22"    → 10 résultats ✅
"kh-22"    → 10 résultats ✅
"325"      → 34 résultats (inchangé) ✅
"gdb1332"  → Devrait fonctionner ✅
```

## 🔧 Code Complet

```typescript
// Ligne 65-85
const queryVariants = [
  cleanQuery, // "kh22"
  cleanQuery.replace(/([a-z])(\d)/gi, '$1 $2'), // "kh 22"
  cleanQuery.replace(/([a-z])(\d)/gi, '$1-$2'), // "kh-22"
];

// Construire une requête OR pour toutes les variantes
const [refSearchResult, refOemResult] = await Promise.all([
  // Recherche par référence équipementier (essayer toutes les variantes)
  this.client
    .from('pieces_ref_search')
    .select('prs_piece_id, prs_kind, prs_ref')
    .or(queryVariants.map((v) => `prs_search.eq.${v}`).join(',')),
  // Recherche par référence OEM constructeur
  this.client
    .from('pieces_ref_oem')
    .select('pro_piece_id, pro_oem')
    .or(queryVariants.map((v) => `pro_oem_serach.eq.${v}`).join(',')),
]);
```

## ✅ Tests de Validation

### Test 1: KH22
```bash
curl "http://localhost:3000/api/search-existing/search?query=kh22&limit=5"

Attendu:
{
  "total": 10,
  "items": [
    {"reference": "KH 22", "brand": "HUTCHINSON"},
    {"reference": "1754018", "brand": "SASIC"},
    {"reference": "X2971", "brand": "MGA"}
  ]
}
```

### Test 2: GDB1332
```bash
curl "http://localhost:3000/api/search-existing/search?query=gdb1332&limit=5"

Attendu: Résultats TRW (si "gdb 1332" existe dans la base)
```

### Test 3: 325 (Régression)
```bash
curl "http://localhost:3000/api/search-existing/search?query=325&limit=5"

Attendu: 34 résultats (inchangé) ✅
```

## 🚀 Améliorations Futures

### Option 1: Plus de Variantes
```typescript
const queryVariants = [
  cleanQuery,                                    // "kh22"
  cleanQuery.replace(/([a-z])(\d)/gi, '$1 $2'), // "kh 22"
  cleanQuery.replace(/([a-z])(\d)/gi, '$1-$2'), // "kh-22"
  cleanQuery.replace(/(\d)([a-z])/gi, '$1 $2'), // "325 abc" si applicable
  cleanQuery.toUpperCase(),                      // "KH22"
];
```

### Option 2: Recherche Floue (Fuzzy)
```typescript
// Utiliser pg_trgm pour similarité
.or(`prs_search.ilike.%${cleanQuery}%,prs_search % ${cleanQuery}`)
```

### Option 3: Index Full-Text
```sql
CREATE INDEX idx_prs_search_gin ON pieces_ref_search 
USING gin(to_tsvector('french', prs_search));

-- Puis utiliser:
WHERE to_tsvector('french', prs_search) @@ to_tsquery('french', 'kh:* & 22:*')
```

## 📝 Checklist

- [x] ✅ Génération de variantes (kh22 → kh 22, kh-22)
- [x] ✅ Requête OR pour toutes les variantes
- [x] ✅ Application à pieces_ref_search ET pieces_ref_oem
- [ ] ⏳ Test "kh22" retourne 10 résultats
- [ ] ⏳ Test "gdb1332" fonctionne
- [ ] ⏳ Test régression "325" (34 résultats)
- [ ] ⏳ Validation frontend affiche les résultats

## 🎉 Résultat Attendu

Après ce fix, la recherche devrait fonctionner **aussi bien que PHP** :

```
✅ "325"    → 34 pièces (BOSCH, TRW, DELPHI...)
✅ "kh22"   → 10 kits de distribution (HUTCHINSON, SASIC, MGA...)
✅ "gdb1332" → Plaquettes de frein TRW
✅ Toutes les variantes d'écriture sont supportées
```

**La recherche est maintenant plus intelligente et flexible !** 🚀
