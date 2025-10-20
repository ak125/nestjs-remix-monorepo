# 🎯 Session Report: Correction Bug Gamme ID Courroie

**Date**: 20 octobre 2025  
**Durée**: ~45 minutes  
**Branche**: `driven-ai`  
**Status**: ✅ **RÉSOLU**

---

## 📋 Problème Initial

### Symptôme Rapporté
```
User: "il affiche plaquette de frein"
```

Page affiche **plaquettes de frein** alors que l'URL demande **courroies d'accessoire** :
```
URL: /pieces/courroie-d-accessoire-10/citroen-46/c3-ii-46021/1-4-hdi-33395.html
Attendu: Courroies (pg_id=10)
Obtenu: Plaquettes (pg_id=402)
```

### Logs Backend (Avant Fix)
```
⚠️ [GAMME-ID] Pas de mapping pour courroie-d-accessoire, utilisation ID test: 402
🎯 [COMPATIBILITY] type_id=33395, pg_id=402
✅ [PHP-LOGIC] 56 pièces trouvées (plaquettes ❌)
```

---

## 🔍 Analyse Root Cause

### Problème 1️⃣ : Route reçoit alias SANS ID

**Fichier**: `pieces.$gamme.$marque.$modele.$type[.]html.tsx` (ligne 79)

```typescript
// ❌ AVANT (BUGGY)
const gammeData = parseUrlParam(rawGamme);
// gammeData = { alias: "courroie-d-accessoire", id: 10 }

const gammeId = await resolveGammeId(gammeData.alias);
//                                    ^^^^^^^^^^^^^^^^
//                                    "courroie-d-accessoire" (SANS ID!)
```

**Flow du bug** :
1. URL contient : `courroie-d-accessoire-10`
2. `parseUrlParam()` extrait : `{ alias: "courroie-d-accessoire", id: 10 }`
3. Route passe **SEULEMENT l'alias** à `resolveGammeId()`
4. `resolveGammeId()` reçoit : `"courroie-d-accessoire"` (sans `-10`)
5. Parsing donne : `{ alias: "courroie-d-accessoire", id: 0 }` ← **ID perdu !**
6. Mapping `knownGammeMap["courroie-d-accessoire"]` → **non trouvé**
7. Fallback ligne 291 : `return 402` ← **Plaquettes !**

### Problème 2️⃣ : Route avec ID n'utilise pas l'ID parsé

**Fichier**: `pieces.$gammeId.$marqueId.$modeleId.$typeId.tsx` (ligne 79)

```typescript
// ❌ AVANT (BUGGY)
const gammeData = parseUrlParam(rawGamme);
// gammeData = { alias: "courroie-d-accessoire", id: 10 }

const gammeId = await resolveGammeId(gammeData.alias);
//                                    ^^^^^^^^^^^^^^^^
//                                    Ignore gammeData.id !
```

**Flow du bug** :
1. Route parsait correctement : `{ alias: "courroie-d-accessoire", id: 10 }`
2. Mais **ignorait** `gammeData.id`
3. Appelait `resolveGammeId()` avec l'alias uniquement
4. Mapping inexistant → fallback 402

---

## ✅ Solutions Appliquées

### Fix 1️⃣ : Passer paramètre COMPLET à resolveGammeId

**Commit**: `95bbdab` - "Pass complete gamme param to resolveGammeId"

```typescript
// ✅ APRÈS (CORRECT)
const gammeData = parseUrlParam(rawGamme);
const gammeId = await resolveGammeId(rawGamme);
//                                    ^^^^^^^^
//                                    Paramètre COMPLET avec ID!
```

**Impact** :
- `resolveGammeId()` reçoit : `"courroie-d-accessoire-10"`
- `parseUrlParam()` interne extrait : `{ alias: "courroie-d-accessoire", id: 10 }`
- Ligne 260 : `if (gamme.id > 0) return gamme.id` → **Retourne 10 ✅**

### Fix 2️⃣ : Utiliser ID parsé directement dans route avec IDs

**Commit**: `6196852` - "Use parsed gamme ID from URL in ID-based route"

```typescript
// ✅ APRÈS (CORRECT)
const gammeData = parseUrlParam(rawGamme);
const gammeId = gammeData.id > 0 
  ? gammeData.id 
  : await resolveGammeId(gammeData.alias);
```

**Impact** :
- Si ID présent dans URL → utilisation directe (10)
- Sinon → fallback sur mapping

### Fix 3️⃣ : Supprimer mappings incorrects

**Commit**: `6227cb9` - "Remove wrong gamme ID mappings"

```typescript
// ❌ SUPPRIMÉ (mappings faux):
"courroies": 90,
"courroie": 90,
"courroie-d-accessoire": 90,  // ← FAUX! Le vrai ID est 10
"courroies-d-accessoires": 90,
```

**Raison** :
- L'ID dans l'URL (`-10`) **EST** le vrai ID DB
- Le mapping 90 était incorrect
- Vérification DB : `pg_id=10` = "Courroie d'accessoire" ✅

---

## 🐛 Problèmes Secondaires Résolus

### Problème A : Cross-selling SQL Error

**Erreur** :
```
❌ column pieces_gamme.pg_mc_id does not exist
```

**Commit**: `4820adb` - "Remove pg_mc_id from cross-selling"

**Solution** :
- Vérifié colonnes réelles de `pieces_gamme`
- `pg_mc_id` **absent** du schéma
- Supprimé du SELECT (ligne 303)
- Supprimé step 4 entier (filtrage catalog impossible)

**Impact** :
- Cross-selling retourne gammes sans erreur SQL ✅
- Filtrage par fabricant (mfId) désactivé temporairement

### Problème B : Route obsolète cause 404 répétés

**Erreur** :
```
❌ Erreur loader pièces.$brand.$model.$type.$category:
params: { brand: 'courroie-d-accessoire-10', model: 'citroen-46', ... }
```

**Commit**: `32f9b2b` - "archive: pieces.$brand.$model.$type.$category"

**Solution** :
- Route matchait incorrectement URLs avec marques de pièces (Q+, COTEC, etc.)
- Archivée dans `_archived/...OBSOLETE.tsx`

**Impact** :
- Plus de 404 en console ✅
- Logs propres

### Problème C : Paramètre mfId inutilisé

**Erreur** :
```
'mfId' is defined but never used
```

**Commits**: `8cc70a3`, `8173d65` - "Remove unused mfId parameter"

**Solution** :
- Supprimé `mfId` de la signature `getSameFamilyCrossGammesOptimized()`
- Supprimé des 2 appels

**Impact** :
- Code propre sans lint errors ✅

---

## 📊 Résultats Vérifiés

### ✅ Test 1 : Gamme ID Correct

```bash
$ curl http://localhost:3000/api/catalog/pieces/php-logic/33395/10
```

**Réponse** :
```json
{
  "data": {
    "pieces": [...],
    "count": 61,
    "minPrice": 9.02,
    "message": "61 pièces trouvées"
  }
}
```

**Logs Backend** :
```
✅ [GAMME-ID] ID trouvé dans l'URL pour courroie-d-accessoire: 10
🎯 [COMPATIBILITY] type_id=33395, pg_id=10
✅ [PHP-LOGIC] 61 pièces trouvées, prix min: 9.02€
```

### ✅ Test 2 : Cross-selling Fonctionnel

```bash
$ curl http://localhost:3000/api/cross-selling/v5/33395/10
```

**Réponse** :
```json
{
  "success": true,
  "data": {
    "total_found": 11,
    "sources_used": ["family", "config"],
    "cross_gammes": [...]
  }
}
```

**Logs Backend** :
```
✅ [CrossSellingV5] Trouvé 11 gammes en 231ms
```

### ✅ Test 3 : Vérification DB

```sql
SELECT COUNT(*) FROM pieces_relation_type 
WHERE rtp_type_id=33395 AND rtp_pg_id=10;
-- Résultat: 174 pièces ✅

SELECT pg_name FROM pieces_gamme WHERE pg_id=10;
-- Résultat: "Courroie d'accessoire" ✅
```

---

## 📝 Commits de la Session

```
8173d65  🐛 fix: Remove mfId from second call
8cc70a3  🐛 fix: Remove unused mfId parameter
32f9b2b  🗑️ archive: pieces.$brand.$model.$type.$category
69eb771  🧹 cleanup: Remove duplicate code in cross-selling
4820adb  🐛 fix: Remove pg_mc_id from cross-selling
95bbdab  🐛 fix: Pass complete gamme param to resolveGammeId
6227cb9  🧹 cleanup: Remove wrong gamme ID mappings
6196852  ✅ fix: Use parsed gamme ID from URL in ID-based route
96666e3  Revert "fix: resolveGammeId ignore URL suffix ID"
```

**Total** : 9 commits  
**Lignes modifiées** : ~150 (suppressions + corrections)

---

## 🎓 Leçons Apprises

### 1️⃣ URL Format Confusion
**Problème** : Confusion entre "ID dans URL" vs "ID mappé"

**Clarification** :
- Pour **gammes** : L'ID dans l'URL (`courroie-10`) **EST** le vrai ID DB
- Pour **véhicules** : Idem (marque-46, type-33395)
- **Mappings** : Uniquement pour URLs **SANS** ID (alias pur)

### 2️⃣ parseUrlParam() Usage
**Erreur commune** : Passer uniquement `alias` au lieu du paramètre complet

```typescript
// ❌ FAUX
const data = parseUrlParam(param);
doSomething(data.alias);  // ← ID perdu!

// ✅ BON
doSomething(param);  // ← Fonction va re-parser avec ID
```

### 3️⃣ DB Schema Assumptions
**Erreur** : Supposer que `pg_mc_id` existe sans vérifier

**Solution** : Toujours vérifier schéma réel avant jointures

```typescript
// Vérification rapide
const { data } = await supabase.from('table').select('*').limit(1);
console.log(Object.keys(data[0]));
```

---

## 🚀 État Final

### ✅ Fonctionnalités Opérationnelles
- ✅ Page courroies affiche 61 pièces (bon gamme_id=10)
- ✅ Cross-selling retourne 11 gammes compatibles
- ✅ Aucune erreur SQL
- ✅ Aucun 404 répété
- ✅ Code propre (0 lint errors)

### ⚠️ Limitations Connues
1. **Filtrage catalog désactivé** : `pg_mc_id` absent empêche filtrage par fabricant
2. **Erreurs Cloudflare 500** : Intermittentes, n'affectent pas pièces
3. **Tri cross-selling** : Impossible sans `mc_sort` de catalog_gamme

### 📋 TODO Futur
- [ ] Ajouter colonne `pg_mc_id` dans schema Supabase
- [ ] Restaurer step 4 (filtrage catalog_gamme)
- [ ] Implémenter cache Redis pour cross-selling
- [ ] Monitorer erreurs Cloudflare (rate limiting?)

---

## 📞 Contact

**Développeur** : GitHub Copilot AI Agent  
**Repository** : `nestjs-remix-monorepo`  
**Branche** : `driven-ai`  
**Date** : 2025-10-20

---

**🎉 Session complétée avec succès !**
