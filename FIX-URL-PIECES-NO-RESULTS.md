# 🔧 Fix: URL Pièces ne retourne aucun article

**Date:** 2025-10-27  
**URL problématique:** `/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-19052.html`  
**Symptôme:** Affiche "0 pièce trouvée" alors que l'API retourne 21 pièces

---

## 🔍 Diagnostic

### Test API Backend
```bash
curl "http://localhost:3000/api/catalog/pieces/php-logic/19052/7"
# ✅ Retourne bien 21 pièces
```

### Problème identifié
Les IDs extraits de l'URL n'étaient pas correctement passés à `resolveVehicleIds()`.

---

## ❌ Code Problématique

### Fichier: `pieces.$gamme.$marque.$modele.$type[.]html.tsx`

```typescript
// ❌ AVANT: Passait uniquement les ALIAS (sans IDs)
const gammeData = parseUrlParam(rawGamme);    // { alias: "filtre-a-huile", id: 7 }
const marqueData = parseUrlParam(rawMarque);  // { alias: "renault", id: 140 }
const modeleData = parseUrlParam(rawModele);  // { alias: "clio-iii", id: 140004 }
const typeData = parseUrlParam(rawType);      // { alias: "1-5-dci", id: 19052 }

// ❌ Passait les ALIAS sans IDs
const vehicleIds = await resolveVehicleIds(
  marqueData.alias,  // "renault" → ID 140 perdu!
  modeleData.alias,  // "clio-iii" → ID 140004 perdu!
  typeData.alias     // "1-5-dci" → ID 19052 perdu!
);
```

**Conséquence:**  
`resolveVehicleIds()` appelait `parseUrlParam()` sur des alias sans IDs (`"renault"`, `"clio-iii"`, `"1-5-dci"`), donc retournait `{ id: 0 }` et utilisait des fallbacks incorrects.

---

## ✅ Solution Appliquée

### 1. Passer les paramètres RAW complets

```typescript
// ✅ APRÈS: Passe les paramètres RAW avec IDs
const vehicleIds = await resolveVehicleIds(
  rawMarque, // "renault-140" → parseUrlParam() extrait ID 140 ✅
  rawModele, // "clio-iii-140004" → parseUrlParam() extrait ID 140004 ✅
  rawType    // "1-5-dci-19052" → parseUrlParam() extrait ID 19052 ✅
);
```

### 2. Amélioration de `resolveVehicleIds()`

**Fichier:** `frontend/app/utils/pieces-route.utils.ts`

```typescript
export async function resolveVehicleIds(marqueParam: string, modeleParam: string, typeParam: string) {
  const marque = parseUrlParam(marqueParam);
  const modele = parseUrlParam(modeleParam);
  const type = parseUrlParam(typeParam);
  
  console.log(`🔍 [RESOLVE-VEHICLE] Parsing:`, {
    marque: `${marqueParam} → alias="${marque.alias}", id=${marque.id}`,
    modele: `${modeleParam} → alias="${modele.alias}", id=${modele.id}`,
    type: `${typeParam} → alias="${type.alias}", id=${type.id}`
  });
  
  // ✅ PRIORITÉ 1: Si IDs présents dans l'URL, les utiliser directement
  if (marque.id > 0 && modele.id > 0 && type.id > 0) {
    console.log(`✅ [RESOLVE-VEHICLE] IDs extraits:`, {
      marqueId: marque.id,
      modeleId: modele.id,
      typeId: type.id
    });
    return { marqueId: marque.id, modeleId: modele.id, typeId: type.id };
  }
  
  // Sinon: résolution via API ou fallback...
}
```

### 3. Ajout de logs de debug

**Fichiers modifiés:**
- `pieces.$gamme.$marque.$modele.$type[.]html.tsx` (loader)
- `use-pieces-filters.ts` (hook)

**Logs ajoutés:**
```typescript
// Loader
console.log('🔍 [LOADER DEBUG] Params parsés:', { gamme, marque, modele, type });
console.log('🔍 [LOADER DEBUG] IDs résolus:', { vehicleIds, gammeId });
console.log('🔍 [LOADER DEBUG] Appel API:', apiUrl);
console.log('🔍 [LOADER DEBUG] Pièces reçues:', { count, sample });
console.log('🔍 [LOADER DEBUG] Données finales:', { piecesCount, minPrice, maxPrice });

// Composant
console.log('🔍 [COMPONENT DEBUG] Données reçues:', { piecesCount, pieces });

// Hook
console.log('🔍 [HOOK] usePiecesFilters appelé:', { piecesCount, firstPiece });
console.log('🔍 [HOOK-FILTER] Début filtrage:', { piecesInput, activeFilters });
console.log('🔍 [HOOK-FILTER] Résultat filtrage:', { resultCount, inputCount });
```

---

## 🧪 Validation

### Test de parsing
```javascript
parseUrlParam('filtre-a-huile-7')  // { alias: 'filtre-a-huile', id: 7 } ✅
parseUrlParam('renault-140')       // { alias: 'renault', id: 140 } ✅
parseUrlParam('clio-iii-140004')   // { alias: 'clio-iii', id: 140004 } ✅
parseUrlParam('1-5-dci-19052')     // { alias: '1-5-dci', id: 19052 } ✅
```

### Appel API attendu
```
GET /api/catalog/pieces/php-logic/19052/7
→ Retourne 21 pièces ✅
```

---

## 📊 Flux de Données

```
1. URL reçue
   /pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-19052.html

2. Loader: parseUrlParam()
   gammeData = { alias: "filtre-a-huile", id: 7 }
   marqueData = { alias: "renault", id: 140 }
   modeleData = { alias: "clio-iii", id: 140004 }
   typeData = { alias: "1-5-dci", id: 19052 }

3. Loader: resolveVehicleIds(rawMarque, rawModele, rawType)
   ✅ Reçoit: "renault-140", "clio-iii-140004", "1-5-dci-19052"
   ✅ Parse et extrait: marqueId=140, modeleId=140004, typeId=19052

4. Loader: resolveGammeId(rawGamme)
   ✅ Reçoit: "filtre-a-huile-7"
   ✅ Extrait: gammeId=7

5. Loader: Appel API
   GET /api/catalog/pieces/php-logic/19052/7
   ✅ Retourne: 21 pièces

6. Loader: Construction data
   {
     pieces: [21 pièces],
     count: 21,
     vehicle: { typeId: 19052, ... },
     gamme: { id: 7, ... }
   }

7. Composant: useLoaderData()
   data.pieces.length = 21 ✅

8. Hook: usePiecesFilters(data.pieces)
   filteredProducts.length = 21 ✅

9. UI: Affichage
   "21 pièces trouvées" ✅
```

---

## 🎯 Résultat Attendu

Après les corrections, la page devrait afficher:

```
21 pièces trouvées
À partir de XX.XX€
```

Au lieu de:

```
0 pièce trouvée ❌
```

---

## 📝 Checklist

- [x] Correction du passage des paramètres à `resolveVehicleIds()`
- [x] Amélioration des logs de debug
- [x] Test de parsing validé
- [x] Flux de données documenté
- [x] Logs ajoutés dans loader, composant et hook
- [ ] Vérification en navigation réelle (requiert accès navigateur)

---

## 🔗 Fichiers Modifiés

1. `frontend/app/routes/pieces.$gamme.$marque.$modele.$type[.]html.tsx`
   - Ligne 75-82: Correction `resolveVehicleIds()` avec params RAW
   - Logs de debug ajoutés

2. `frontend/app/utils/pieces-route.utils.ts`
   - Ligne 183-250: Amélioration `resolveVehicleIds()` avec logs détaillés

3. `frontend/app/hooks/use-pieces-filters.ts`
   - Logs de debug ajoutés pour tracer le filtrage

---

## 🚀 Prochaine Étape

Recharger la page `/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-19052.html` et vérifier les logs dans la console navigateur et terminal Vite pour confirmer que les 21 pièces sont bien affichées.
