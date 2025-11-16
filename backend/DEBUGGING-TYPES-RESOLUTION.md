# 🐛 Résolution Bug Types de Données - Catalogue Véhicule V4

## 📋 Contexte

**Date:** 16 novembre 2025  
**Branche:** `feat/catalog-page-v2`  
**Objectif:** Filtrer catalogue par compatibilité véhicule  
**Problème initial:** 0 familles retournées malgré 23 gammes trouvées

## 🔍 Symptômes

```json
// ❌ Avant correction
{
  "queryType": "V4_INDEXED_TABLE",
  "totalFamilies": 0,
  "totalGammes": 0,
  "source": "DATABASE"
}

// ✅ Après correction
{
  "queryType": "V4_INDEXED_TABLE",
  "totalFamilies": 10,
  "totalGammes": 17,
  "source": "DATABASE",
  "firstFamily": {
    "id": "1",
    "name": "Système de filtration",
    "gammes_count": 3
  }
}
```

**Véhicule test:** Porsche Cayenne TDI (type_id=30764)

## 🔬 Diagnostic SQL

### Étape 1: Vérification types colonnes

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('pieces_gamme', 'catalog_gamme', 'catalog_family')
AND column_name IN ('pg_id', 'pg_display', 'pg_level', 'mc_pg_id', 'mc_mf_id', 'mf_id', 'mf_display');
```

**Résultat:**

| Table | Colonne | Type Attendu | Type Réel |
|-------|---------|--------------|-----------|
| `pieces_gamme` | `pg_id` | integer | **integer** ✅ |
| `pieces_gamme` | `pg_display` | integer | **text** ❌ |
| `pieces_gamme` | `pg_level` | integer | **text** ❌ |
| `catalog_gamme` | `mc_pg_id` | integer | **text** ❌ |
| `catalog_gamme` | `mc_mf_id` | integer | **text** ❌ |
| `catalog_family` | `mf_id` | integer | **text** ❌ |
| `catalog_family` | `mf_display` | integer | **text** ❌ |

### Étape 2: Test requêtes avec types corrects

```sql
-- ❌ Échec avec integer
SELECT * FROM pieces_gamme WHERE pg_display = 1;
-- ERROR: operator does not exist: text = integer

-- ✅ Succès avec string
SELECT * FROM pieces_gamme WHERE pg_display = '1';
-- 23 lignes retournées
```

### Étape 3: Validation données complètes

```sql
-- 1. Gammes compatibles (via index 65ms)
SELECT DISTINCT rtp_pg_id FROM pieces_relation_type WHERE rtp_type_id = 30764;
-- Résultat: 30 gammes

-- 2. Gammes valides après filtres
SELECT pg_id FROM pieces_gamme 
WHERE pg_id IN (...) 
AND pg_display = '1' 
AND pg_level IN ('1', '2');
-- Résultat: 23 gammes

-- 3. Liens catalog_gamme
SELECT mc_pg_id, mc_mf_id FROM catalog_gamme WHERE mc_pg_id IN ('2','4','6',...);
-- Résultat: 23 lignes → 10 familles distinctes

-- 4. Familles finales
SELECT mf_id, mf_name FROM catalog_family 
WHERE mf_id IN ('1','2','3','5','10','11','14','15','18','19') 
AND mf_display = '1';
-- Résultat: 10 familles
```

## 🛠️ Corrections Appliquées

### 1. Filtres Supabase avec Strings

**Fichier:** `backend/src/modules/catalog/services/vehicle-filtered-catalog-v4-hybrid.service.ts`

```typescript
// ❌ AVANT - Ligne 240-244
.eq('pg_display', 1)
.in('pg_level', [1, 2])

// ✅ APRÈS
.eq('pg_display', '1')
.in('pg_level', ['1', '2'])
```

```typescript
// ❌ AVANT - Ligne 264
.eq('mf_display', 1)

// ✅ APRÈS
.eq('mf_display', '1')
```

### 2. Conversion IDs en Strings

**Fichier:** `backend/src/modules/catalog/services/vehicle-filtered-catalog-v4-hybrid.service.ts`

```typescript
// ❌ AVANT - Ligne 248
.in('mc_pg_id', pgIds)  // pgIds est number[]

// ✅ APRÈS - Ligne 235 + 248
const pgIdsAsStrings = pgIds.map(id => id.toString());
.in('mc_pg_id', pgIdsAsStrings)
```

### 3. Maps JavaScript avec Clés String (CORRECTION CRITIQUE)

**Fichier:** `backend/src/modules/catalog/services/vehicle-filtered-catalog-v4-hybrid.service.ts`

```typescript
// ❌ AVANT - Ligne 291-292
const gammeMap = new Map(gammesData.map((g) => [g.pg_id, g]));
const familyMap = new Map(familiesData.map((f) => [f.mf_id, f]));
// Problème: pg_id est number, mais mc_pg_id est string
// gammeMap.get(cg.mc_pg_id) retourne undefined car "123" !== 123

// ✅ APRÈS - Ligne 291-292
const gammeMap = new Map(gammesData.map((g) => [String(g.pg_id), g]));
const familyMap = new Map(familiesData.map((f) => [String(f.mf_id), f]));
// Maintenant gammeMap.get(cg.mc_pg_id) fonctionne car "123" === "123"
```

```typescript
// ❌ AVANT - Ligne 293
const familyGammesMap = new Map<number, any[]>();

// ✅ APRÈS
const familyGammesMap = new Map<string, any[]>();
```

```typescript
// ❌ AVANT - Ligne 297-298
const gamme = gammeMap.get(parseInt(cg.mc_pg_id));
const family = familyMap.get(parseInt(cg.mc_mf_id));

// ✅ APRÈS
const gamme = gammeMap.get(cg.mc_pg_id);  // mc_pg_id déjà string
const family = familyMap.get(cg.mc_mf_id);  // mc_mf_id déjà string
```

```typescript
// ❌ AVANT - Ligne 321
const gammes = (familyGammesMap.get(family.mf_id) || [])

// ✅ APRÈS
const gammes = (familyGammesMap.get(String(family.mf_id)) || [])
```

## 🎯 Résultats Validés

### Performance

- **Index composite:** 65ms (amélioration 920x vs 30-60s)
- **Niveau utilisé:** V4_INDEXED_TABLE (Niveau 2)
- **Source:** DATABASE (pas de cache)

### Données Retournées

```bash
curl http://localhost:3000/api/catalog/families/vehicle-v4/30764 | jq
```

**10 familles compatibles:**

1. **Système de filtration** (3 gammes)
   - Filtre à huile
   - Filtre à air
   - Filtre à carburant

2. **Système de freinage** (4 gammes)
   - Plaquettes de frein
   - Disques de frein
   - Étriers de frein
   - Liquide de frein

3. **Courroie, galet, poulie et chaîne** (1 gamme)
4. **Direction et liaison au sol** (1 gamme)
5. **Transmission** (1 gamme)
6. **Système électrique** (2 gammes)
7. **Moteur** (1 gamme)
8. **Refroidissement** (1 gamme)
9. **Eclairage** (1 gamme)
10. **Accessoires** (2 gammes)

**Total: 17 gammes diesel** filtrées correctement pour Porsche Cayenne TDI

## 📚 Leçons Apprises

### 1. Types PostgreSQL vs JavaScript

- **PostgreSQL `text`** ≠ **JavaScript `number`**
- Supabase retourne toujours des **strings** pour colonnes `text`
- Les conversions implicites n'existent pas côté JavaScript

### 2. Maps JavaScript

```typescript
// ❌ Erreur silencieuse (undefined)
const map = new Map([[123, "value"]]);
map.get("123");  // undefined car "123" !== 123

// ✅ Solution: Clés string partout
const map = new Map([["123", "value"]]);
map.get("123");  // "value"
```

### 3. Supabase Filtres

```typescript
// ❌ Erreur SQL: operator does not exist: text = integer
.eq('pg_display', 1)

// ✅ Toujours utiliser strings pour colonnes text
.eq('pg_display', '1')
```

### 4. Debugging Méthodologie

1. **Vérifier types colonnes** dans `information_schema.columns`
2. **Tester requêtes SQL** directement dans Supabase SQL Editor
3. **Logger données retournées** pour voir types réels (string vs number)
4. **Comparer clés Maps** avec `console.log(Array.from(map.keys()))`

## 🔄 Migration Recommandée (Optionnelle)

Pour éviter ces problèmes à l'avenir:

```sql
-- Normaliser les types en integer où approprié
ALTER TABLE pieces_gamme 
  ALTER COLUMN pg_display TYPE INTEGER USING pg_display::integer,
  ALTER COLUMN pg_level TYPE INTEGER USING pg_level::integer;

ALTER TABLE catalog_gamme
  ALTER COLUMN mc_pg_id TYPE INTEGER USING mc_pg_id::integer,
  ALTER COLUMN mc_mf_id TYPE INTEGER USING mc_mf_id::integer;

ALTER TABLE catalog_family
  ALTER COLUMN mf_id TYPE INTEGER USING mf_id::integer,
  ALTER COLUMN mf_display TYPE INTEGER USING mf_display::integer;

-- Recréer les foreign keys si nécessaires
-- ALTER TABLE catalog_gamme ADD CONSTRAINT fk_mc_pg_id 
--   FOREIGN KEY (mc_pg_id) REFERENCES pieces_gamme(pg_id);
```

**⚠️ Attention:** Nécessite validation complète et peut impacter d'autres parties de l'application.

## ✅ Validation Finale

```bash
# Test API
curl http://localhost:3000/api/catalog/families/vehicle-v4/30764

# Vérifier familles
curl -s http://localhost:3000/api/catalog/families/vehicle-v4/30764 | \
  jq '.catalog.families | map({id: .mf_id, name: .mf_name, gammes_count: .gammes_count})'

# Performance
curl -s http://localhost:3000/api/catalog/families/vehicle-v4/30764 | \
  jq '{queryType, totalFamilies, totalGammes, source}'
```

**Résultat attendu:**
- `queryType`: "V4_INDEXED_TABLE"
- `totalFamilies`: 10
- `totalGammes`: 17
- `source`: "DATABASE"

## 📁 Fichiers Modifiés

1. ✅ `backend/src/modules/catalog/services/vehicle-filtered-catalog-v4-hybrid.service.ts`
   - Lignes 235, 240-244, 248, 264, 291-293, 297-298, 321

2. ✅ `backend/sql/001-create-index-vehicle-compatibility.sql`
   - Documentation mise à jour avec types découverts
   - Résultats production validés

3. ✅ `backend/sql/002-create-materialized-view-cron.sql`
   - Prêt pour Phase 2 (optionnelle)

## 🚀 Prochaines Étapes

- [x] Phase 1: Index composite ✅ DÉPLOYÉ (65ms)
- [ ] Phase 2: Vue matérialisée 📝 OPTIONNELLE (5-10ms)
- [x] Corrections types ✅ COMPLÉTÉ
- [ ] Migration types DB 📝 OPTIONNELLE
- [ ] Monitoring production 📋 À PLANIFIER

---

**Résolution complète:** 16 novembre 2025  
**Temps debugging:** ~4 heures  
**Impact:** Bug critique SEO résolu, performance optimisée 920x
