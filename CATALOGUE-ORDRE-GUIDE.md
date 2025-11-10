# 📋 Guide de l'Ordre du Catalogue

## 🎯 Objectif

Ce guide explique **comment l'ordre du catalogue est maintenu** de la base de données jusqu'à l'affichage frontend, et comment **garantir qu'il ne change jamais**.

---

## 🔄 Flux Complet de l'Ordre

```
┌──────────────────────────────────────────────────────────────┐
│ 1. BASE DE DONNÉES (Supabase)                                │
│    catalog_family.mf_sort (integer)                          │
│    └─ Ordre défini manuellement dans la BDD                  │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. BACKEND API (NestJS)                                      │
│    gamme-unified.service.ts                                  │
│    └─ .order('mf_sort', { ascending: true })                 │
│    └─ sort_order: parseInt(family.mf_sort) || 0             │
│    └─ .sort((a, b) => a.sort_order - b.sort_order)          │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. RÉPONSE API                                               │
│    GET /api/catalog/gammes/hierarchy                         │
│    {                                                          │
│      families: [                                             │
│        { id: "1", name: "...", sort_order: 0, ... },        │
│        { id: "2", name: "...", sort_order: 1, ... },        │
│        ...                                                   │
│      ]                                                       │
│    }                                                         │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. FRONTEND API CLIENT (hierarchy.api.ts)                    │
│    getHomepageData()                                         │
│    └─ mf_sort: family.sort_order?.toString() || '0'         │
│    ⚠️  NE PAS RETRIER ICI                                    │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. REMIX LOADER (_index.tsx)                                 │
│    loader()                                                  │
│    └─ hierarchyApi.getHomepageData()                         │
│    ⚠️  NE PAS RETRIER ICI                                    │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. REACT HOOK (useHomeData.ts)                               │
│    const [families, setFamilies] = useState(...)             │
│    ⚠️  NE PAS RETRIER ICI                                    │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. AFFICHAGE FINAL (_index.tsx)                              │
│    {homeData.families.map((family, index) => ...)}          │
│    ⚠️  NE PAS RETRIER ICI                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## ✅ Règles à Respecter

### 🔒 Règle #1 : TRI UNIQUE AU BACKEND
**Le tri DOIT se faire UNIQUEMENT dans le backend**, jamais dans le frontend.

```typescript
// ✅ BON - Backend (gamme-unified.service.ts)
const { data: families } = await this.supabase
  .from('catalog_family')
  .select('*')
  .eq('mf_display', '1')
  .order('mf_sort', { ascending: true }); // ← TRI ICI

const familiesWithGammes = families
  .map(...)
  .filter(...)
  .sort((a, b) => a.sort_order - b.sort_order); // ← ET ICI (final)
```

```typescript
// ❌ MAUVAIS - Frontend
const families = await hierarchyApi.getHomepageData();
const sorted = families.sort(...); // ← NE JAMAIS FAIRE ÇA
```

---

### 🔒 Règle #2 : PRÉSERVER L'ORDRE PARTOUT
Chaque couche DOIT préserver l'ordre reçu, sans le modifier.

```typescript
// ✅ BON - Mapper sans retrier
const mappedFamilies = (response.families || []).map((family: any) => ({
  mf_id: family.id,
  mf_name: family.name,
  mf_sort: family.sort_order?.toString() || '0', // ← Mapper le sort_order
  // ... autres champs
}));

// ❌ MAUVAIS - Retrier
const mappedFamilies = (response.families || [])
  .map(...)
  .sort(...); // ← NE PAS RETRIER
```

---

### 🔒 Règle #3 : VALIDER L'ORDRE

Avant chaque commit qui touche au catalogue, VALIDER l'ordre :

```bash
# 1. Lancer le backend
cd backend && npm run dev

# 2. Vérifier l'ordre de l'API
curl http://localhost:3000/api/catalog/gammes/hierarchy | \
  jq '.families[] | {id, name, sort_order}' | head -20

# 3. Vérifier que sort_order est croissant (0, 1, 2, ...)
```

---

## 🐛 Causes Communes de Désordre

### ❌ Cause 1 : Hardcoding de `mf_sort`
```typescript
// ❌ MAUVAIS
mf_sort: '0', // ← Toutes les familles ont le même sort !

// ✅ BON
mf_sort: family.sort_order?.toString() || '0',
```

### ❌ Cause 2 : Retri dans le frontend
```typescript
// ❌ MAUVAIS
families.sort((a, b) => a.name.localeCompare(b.name))

// ✅ BON
families // ← Garder l'ordre reçu
```

### ❌ Cause 3 : Mapping incorrect
```typescript
// ❌ MAUVAIS - Oubli du sort_order
const mapped = families.map(f => ({
  id: f.id,
  name: f.name,
  // ← sort_order manquant !
}));

// ✅ BON
const mapped = families.map(f => ({
  id: f.id,
  name: f.name,
  sort_order: f.sort_order, // ← Inclure
}));
```

---

## 🧪 Tests à Exécuter

### Test 1 : Backend retourne l'ordre correct
```bash
curl -s http://localhost:3000/api/catalog/gammes/hierarchy | \
  jq '.families | to_entries | .[] | {index: .key, id: .value.id, sort: .value.sort_order}'
```

**Attendu** : `sort_order` doit être 0, 1, 2, 3, ... (croissant)

### Test 2 : Frontend préserve l'ordre
```bash
# 1. Ouvrir http://localhost:5173
# 2. Inspecter avec DevTools
# 3. Vérifier l'ordre des familles dans le DOM
```

**Attendu** : L'ordre visuel correspond à l'ordre de l'API

---

## 📝 Checklist Avant Commit

Avant de commiter des changements touchant au catalogue :

- [ ] Backend : Vérifier que `.order('mf_sort', { ascending: true })` est présent
- [ ] Backend : Vérifier que `sort_order` est mappé depuis `mf_sort`
- [ ] Backend : Vérifier le tri final avec `.sort((a, b) => a.sort_order - b.sort_order)`
- [ ] Frontend API : Vérifier que `mf_sort: family.sort_order?.toString()` est mappé
- [ ] Frontend : Aucun `.sort()` manuel sur les familles
- [ ] Tests : Curl de l'API pour valider l'ordre
- [ ] Tests : Vérification visuelle dans le navigateur

---

## 🚨 En Cas de Problème

Si l'ordre du catalogue est incorrect :

### Diagnostic Rapide
```bash
# 1. Vérifier la BDD
psql -c "SELECT mf_id, mf_name, mf_sort FROM catalog_family WHERE mf_display = '1' ORDER BY mf_sort;"

# 2. Vérifier l'API backend
curl http://localhost:3000/api/catalog/gammes/hierarchy | jq '.families[0:5] | .[] | {id, name, sort_order}'

# 3. Comparer avec main
git diff main..HEAD -- backend/src/modules/catalog/services/gamme-unified.service.ts
git diff main..HEAD -- frontend/app/services/api/hierarchy.api.ts
```

### Fixes Courants
```bash
# 1. Restaurer depuis main
git checkout main -- backend/src/modules/catalog/services/gamme-unified.service.ts
git checkout main -- frontend/app/services/api/hierarchy.api.ts

# 2. Réappliquer uniquement les changements de tokens (sans toucher au tri)
git diff main..feat/design-tokens-migration -- frontend/app/routes/_index.tsx | grep -E "blue-|slate-|gray-"
```

---

## 📚 Fichiers Clés

| Fichier | Rôle | À Vérifier |
|---------|------|------------|
| `backend/src/modules/catalog/services/gamme-unified.service.ts` | Tri backend | `.order('mf_sort')` + `.sort()` final |
| `frontend/app/services/api/hierarchy.api.ts` | Mapping API | `mf_sort: family.sort_order?.toString()` |
| `frontend/app/routes/_index.tsx` | Affichage | Pas de `.sort()` sur `families` |
| `frontend/app/hooks/useHomeData.ts` | State management | Pas de `.sort()` sur `families` |

---

## 🎯 Résumé

**L'ordre du catalogue est UNIQUEMENT contrôlé par :**
1. La BDD (`catalog_family.mf_sort`)
2. Le backend (tri avec `.order()` + `.sort()`)
3. Toutes les autres couches **PRÉSERVENT** cet ordre sans le modifier

**Si l'ordre change, c'est qu'une de ces règles a été violée.**
