# 🐛 Problème : Brand et Category Vides

## 📋 Symptômes

Lors de la recherche "325" via `/api/search-existing/search?query=325`:
- ✅ 34 résultats retournés (vs 6 avant)
- ❌ `brand` est toujours `""`
- ❌ `category` est toujours `""`
- ❌ Facets vides

## 🔍 Investigation

### Test 1 : Inspection directe d'une pièce
```bash
curl "http://localhost:3000/api/search-debug/inspect?pieceId=7766691"
```

**Résultat** :
```json
{
  "piece": {
    "piece_id": 7766691,
    "piece_pg_id": 8,      // ✅ Présent
    "piece_pm_id": 3160,    // ✅ Présent
    "piece_name": "Filtre à air"
  },
  "gamme": {
    "pg_id": "8",           // ⚠️ STRING
    "pg_name": "Filtre à air"
  },
  "marque": {
    "pm_id": "3160",        // ⚠️ STRING
    "pm_name": "MISFAT"
  }
}
```

### Test 2 : Résultat via recherche
```bash
curl "http://localhost:3000/api/search-existing/search?query=325&limit=5"
```

**Résultat** :
```json
{
  "id": 7766691,
  "title": "Filtre à air",
  "brand": "",            // ❌ Vide
  "category": "",         // ❌ Vide
  "piece_pg_id": null,    // ❌ NULL
  "piece_pm_id": null     // ❌ NULL
}
```

## 🎯 Cause Racine Identifiée

### Problème 1 : Mismatch de types dans les clés de Map

Dans `search-enhanced-existing.service.ts` :

```typescript
// ❌ PROBLÈME : Types incompatibles
const marquesById = new Map();
marques.forEach((marque) => {
  marquesById.set(marque.pm_id, marque);  // pm_id est STRING "3160"
});

// Plus tard...
const marque = marquesById.get(piece.piece_pm_id);  // piece_pm_id est NUMBER 3160
// ❌ map.get("3160") !== map.get(3160)
```

### Problème 2 : Les colonnes pg_id et pm_id sont des STRING dans Supabase

Les tables `pieces_gamme` et `pieces_marque` ont leurs IDs en **VARCHAR**, pas en INTEGER :

```sql
-- pieces_gamme
pg_id VARCHAR  -- "8", "9", "10"

-- pieces_marque  
pm_id VARCHAR  -- "3160", "730", "55"

-- pieces
piece_pg_id INTEGER  -- 8, 9, 10
piece_pm_id INTEGER  -- 3160, 730, 55
```

## 🔧 Solution

### Option 1 : Convertir les clés de Map en INTEGER
```typescript
const marquesById = new Map();
marques.forEach((marque) => {
  const id = parseInt(marque.pm_id, 10);
  if (!isNaN(id)) {
    marquesById.set(id, marque);  // Clé en NUMBER
  }
});

const gammesById = new Map();
gammes.forEach((gamme) => {
  const id = parseInt(gamme.pg_id, 10);
  if (!isNaN(id)) {
    gammesById.set(id, gamme);  // Clé en NUMBER
  }
});
```

### Option 2 : Convertir les piece_pm_id/piece_pg_id en STRING
```typescript
const marque = marquesById.get(piece.piece_pm_id?.toString());
const gamme = gammesById.get(piece.piece_pg_id?.toString());
```

**✅ Recommandation : Option 1** (convertir clés en NUMBER)
- Plus cohérent avec les types TypeScript
- Évite les conversions répétées dans la boucle
- Meilleure performance

## 📝 Code à Modifier

**Fichier** : `backend/src/modules/search/services/search-enhanced-existing.service.ts`

**Ligne ~234** :
```typescript
// AVANT
const marquesById = new Map();
marques.forEach((marque) => {
  marquesById.set(marque.pm_id, marque);
});

const gammesById = new Map();
gammes.forEach((gamme) => {
  gammesById.set(gamme.pg_id, gamme);
});

// APRÈS
const marquesById = new Map<number, any>();
marques.forEach((marque) => {
  const id = parseInt(marque.pm_id, 10);
  if (!isNaN(id)) {
    marquesById.set(id, marque);
  }
});

const gammesById = new Map<number, any>();
gammes.forEach((gamme) => {
  const id = parseInt(gamme.pg_id, 10);
  if (!isNaN(id)) {
    gammesById.set(id, gamme);
  }
});
```

## ✅ Résultat Attendu

Après correction :
```json
{
  "id": 7766691,
  "title": "Filtre à air",
  "brand": "MISFAT",      // ✅ Rempli
  "category": "Filtre à air",  // ✅ Rempli
  "qualite": "AFTERMARKET",
  "stars": 3
}
```

Et les facets seront générés :
```json
{
  "facets": [
    {
      "field": "gamme",
      "label": "Gamme",
      "values": [
        {"value": "Filtre à air", "label": "Filtre à air", "count": 1},
        {"value": "Plaquette de frein", "label": "Plaquette de frein", "count": 21},
        // ...
      ]
    },
    {
      "field": "marque",
      "label": "Marque",
      "values": [
        {"value": "MISFAT", "label": "MISFAT", "count": 1},
        {"value": "ATE", "label": "ATE", "count": 5},
        // ...
      ]
    }
  ]
}
```

---

**Status** : 🔄 En cours de correction  
**Impact** : Critique - Bloque l'affichage des filtres et des informations produit  
**Priorité** : Haute
