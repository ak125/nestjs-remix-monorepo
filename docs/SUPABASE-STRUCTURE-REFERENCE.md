# 📋 Référence Structure Supabase - Tables auto_*

**Date:** 2025-10-03  
**Source:** Inspection API REST Supabase  
**Script:** `backend/check-supabase-structure.js`

---

## 🎯 Points Critiques

### ⚠️ ATTENTION: Type des Colonnes

**IMPORTANT:** Dans la table `auto_type`, **TOUS les champs sont STRING** (pas NUMBER) !

```typescript
// ❌ MAUVAIS
.eq('type_display', 1)

// ✅ CORRECT
.eq('type_display', '1')
```

### ⚠️ Foreign Keys PostgREST

**Les FK ne sont PAS configurées dans Supabase PostgREST.**

```typescript
// ❌ NE FONCTIONNE PAS
.select(`
  type_id,
  auto_modele!inner(modele_id, modele_name)
`)
// Erreur: "Could not find a relationship between 'auto_type' and 'auto_modele'"

// ✅ SOLUTION: Requêtes séparées + jointure manuelle
const types = await client.from('auto_type').select('*');
const modeles = await client.from('auto_modele').select('*').in('modele_id', modeleIds);
// Puis faire la jointure en JavaScript
```

---

## 📊 Structure des Tables

### `auto_marque` (Marques)

**13 colonnes:**

| Colonne | Type | Exemple | Note |
|---------|------|---------|------|
| `marque_id` | number | 10 | PK |
| `marque_alias` | string | "ac" | Slug URL |
| `marque_name` | string | "AC" | **Nom complet** |
| `marque_name_url` | string | "AC" | URL-friendly |
| `marque_name_meta` | string | "AC" | SEO |
| `marque_name_meta_title` | string | "AC" | Title tag |
| `marque_logo` | string/null | "abarth.webp" | **Image logo** |
| `marque_wall` | object/null | null | Background |
| `marque_relfollow` | number | 0 | SEO |
| `marque_sitemap` | number | 0 | Sitemap |
| `marque_display` | number | 1/3 | **Visibilité** |
| `marque_sort` | number | 2 | Ordre |
| `marque_top` | number | 0 | Featured |

**Requête exemple:**
```typescript
const { data } = await client
  .from('auto_marque')
  .select('marque_id, marque_name, marque_alias, marque_logo')
  .gte('marque_display', 1)
  .order('marque_name', { ascending: true });
```

---

### `auto_modele_group` (Groupes de modèles)

**6 colonnes:**

| Colonne | Type | Exemple | Note |
|---------|------|---------|------|
| `mdg_id` | number | 1 | PK |
| `mdg_marque_id` | number | 22 | **FK → marque_id** |
| `mdg_name` | string | "80" | Nom groupe |
| `mdg_pic` | object/null | null | Image |
| `mdg_display` | number | 0 | Visibilité |
| `mdg_sort` | number | 0 | Ordre |

**Relation:**  
`mdg_marque_id` → `auto_marque.marque_id`

---

### `auto_modele` (Modèles)

**21 colonnes:**

| Colonne | Type | Exemple | Note |
|---------|------|---------|------|
| `modele_id` | number | 88117 | PK |
| `modele_parent` | number | 0 | Parent |
| `modele_marque_id` | number | 88 | FK marque |
| `modele_mdg_id` | number | 1354 | **FK → mdg_id** |
| `modele_alias` | string | "" | Slug |
| `modele_name` | string | "OPTIMA III" | **Nom** |
| `modele_name_url` | string | "" | URL |
| `modele_name_meta` | object/null | null | SEO |
| `modele_ful_name` | string | "KIA OPTIMA III" | Nom complet |
| `modele_month_from` | number | 12 | Début |
| `modele_year_from` | number | 2019 | **Année début** |
| `modele_month_to` | object/null | null | Fin |
| `modele_year_to` | object/null | null | Année fin |
| `modele_body` | object/null | null | Carrosserie |
| `modele_pic` | string | "no.webp" | **🖼️ IMAGE** |
| `modele_relfollow` | number | 0 | SEO |
| `modele_sitemap` | number | 0 | Sitemap |
| `modele_display` | number | 0 | **Visibilité** |
| `modele_display_v1` | object/null | null | Legacy |
| `modele_sort` | number | 142 | Ordre |
| `modele_is_new` | number | 0 | Nouveau |

**⚠️ Image Placeholder:**  
Beaucoup de modèles ont `modele_pic = "no.webp"` → **il faut filtrer !**

```typescript
.not('modele_pic', 'is', null)
.not('modele_pic', 'eq', 'no.webp')
```

**Relations:**  
- `modele_mdg_id` → `auto_modele_group.mdg_id`
- `modele_marque_id` → `auto_marque.marque_id`

---

### `auto_type` (Types/Motorisations)

**21 colonnes - ⚠️ TOUS STRING:**

| Colonne | Type | Exemple | Note |
|---------|------|---------|------|
| `type_id` | **string** | "1" | PK (STRING!) |
| `type_tmf_id` | string | "2" | TecDoc |
| `type_alias` | string | "1-4" | Slug |
| `type_modele_id` | **string** | "123048" | **FK → modele_id (STRING!)** |
| `type_marque_id` | string | "123" | FK marque |
| `type_name` | string | "1.4 16V" | **Nom** |
| `type_name_url` | string | "1.4" | URL |
| `type_name_meta` | string | "1.4" | SEO |
| `type_engine` | string | "Essence" | Moteur |
| `type_fuel` | string | "Essence" | Carburant |
| `type_power_ps` | string | "90" | Puissance |
| `type_power_kw` | string | "66" | kW |
| `type_liter` | string | "140" | Cylindrée |
| `type_month_from` | string | "7" | Mois début |
| `type_year_from` | **string** | "2006" | **Année début** |
| `type_month_to` | string | "8" | Mois fin |
| `type_year_to` | **string** | "2014" | **Année fin** |
| `type_body` | string | "3/5 portes" | Carrosserie |
| `type_relfollow` | string | "1" | SEO |
| `type_display` | **string** | "1" | **Visibilité** |
| `type_sort` | string | "10" | Ordre |

**🚨 AUCUNE COLONNE IMAGE dans auto_type !**  
Les images viennent de `auto_modele.modele_pic`

**Requête exemple:**
```typescript
// ⚠️ Noter les STRING partout
const { data } = await client
  .from('auto_type')
  .select('type_id, type_name, type_year_from, type_year_to, type_modele_id')
  .eq('type_display', '1') // STRING pas NUMBER
  .order('type_id', { ascending: false });
```

**Relations:**  
- `type_modele_id` → `auto_modele.modele_id` (conversion `parseInt()` nécessaire)

---

## 🔗 Pattern de Jointure Manuelle

**Exemple complet avec les 4 tables:**

```typescript
// 1️⃣ Récupérer les types
const { data: types } = await client
  .from('auto_type')
  .select('type_id, type_name, type_modele_id, type_year_from, type_year_to')
  .eq('type_display', '1')
  .limit(10);

// 2️⃣ Récupérer les modèles (avec images valides)
const modeleIds = [...new Set(types.map(t => t.type_modele_id))];
const { data: modeles } = await client
  .from('auto_modele')
  .select('modele_id, modele_name, modele_alias, modele_mdg_id, modele_pic')
  .in('modele_id', modeleIds)
  .gte('modele_display', 1)
  .not('modele_pic', 'eq', 'no.webp');

// 3️⃣ Récupérer les groupes
const mdgIds = [...new Set(modeles.map(m => m.modele_mdg_id))];
const { data: groups } = await client
  .from('auto_modele_group')
  .select('mdg_id, mdg_name, mdg_marque_id')
  .in('mdg_id', mdgIds);

// 4️⃣ Récupérer les marques
const marqueIds = [...new Set(groups.map(g => g.mdg_marque_id))];
const { data: marques } = await client
  .from('auto_marque')
  .select('marque_id, marque_name, marque_alias')
  .in('marque_id', marqueIds);

// 5️⃣ Jointure manuelle
const result = types.map(type => {
  const modele = modeles.find(m => m.modele_id === parseInt(type.type_modele_id));
  if (!modele) return null;

  const group = groups.find(g => g.mdg_id === modele.modele_mdg_id);
  if (!group) return null;

  const marque = marques.find(m => m.marque_id === group.mdg_marque_id);
  if (!marque) return null;

  return {
    type_id: parseInt(type.type_id),
    name: `${marque.marque_name} ${modele.modele_name} ${type.type_name}`,
    brandName: marque.marque_name,
    modelName: modele.modele_name,
    typeName: type.type_name,
    imageUrl: `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-modeles/${marque.marque_alias}/${modele.modele_pic.replace('.webp', '.jpg')}`,
    dateRange: `${type.type_year_from}-${type.type_year_to}`,
  };
}).filter(Boolean);
```

---

## 🖼️ Gestion des Images

### Logos de Marques

**Chemin Supabase Storage:**
```
https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/logos/{marque_logo}
```

**Exemples valides:**
- ABARTH: `abarth.webp`
- ALFA ROMEO: `alfa-romeo.webp`
- AUDI: `audi.webp`

### Images de Modèles

**Chemin Supabase Storage:**
```
https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-modeles/{marque_alias}/{modele_pic}
```

**⚠️ Conversion format:**
```typescript
const imageName = modele.modele_pic.replace('.webp', '.jpg');
```

**Filtrage placeholder:**
```typescript
.not('modele_pic', 'is', null)
.not('modele_pic', 'eq', 'no.webp')
```

---

## 🎯 Checklist d'Implémentation

Lors de l'implémentation de requêtes Supabase sur les tables `auto_*` :

- [ ] **Type STRING** : Utiliser `'1'` pas `1` pour `auto_type`
- [ ] **Pas de FK** : Requêtes séparées + jointure manuelle
- [ ] **Noms colonnes** : `_name` pas `_nom` (sauf anciennes migrations)
- [ ] **Filtrer images** : Exclure `"no.webp"` placeholder
- [ ] **Conversion parseInt()** : Pour jointures `type_modele_id` → `modele_id`
- [ ] **Cache Redis** : TTL 300-3600s pour éviter surcharge
- [ ] **Limit x2/x3** : Compenser filtrage images manquantes

---

## 🧪 Script de Test

Pour vérifier la structure actuelle :

```bash
cd /workspaces/nestjs-remix-monorepo/backend
SUPABASE_KEY="YOUR_KEY" node check-supabase-structure.js
```

Le script affiche :
- Structure complète des 4 tables
- Test des relations FK (échouera)
- Comptage des images disponibles
- Colonnes images par table

---

**Maintenu par:** Copilot AI  
**Dernière vérification:** 2025-10-03 20:15 UTC
