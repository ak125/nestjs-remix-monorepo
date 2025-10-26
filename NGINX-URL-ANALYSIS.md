# 🔍 Analyse URLs - Ancien site vs Nouveau site

**Date :** 25 octobre 2025  
**Source :** automecanik-rewrite-frontoffice.conf

---

## 📋 Patterns d'URLs identifiés

### 1. 🔧 Pages Gammes (Catégories de pièces)

#### ❌ Ancien pattern (nginx)
```nginx
rewrite ^/pieces/[^?/]*-([0-9]+).html$ /v7.products.gamme.php?pg_id=$1 last;
```

**Exemples d'URLs :**
```
/pieces/plaquette-de-frein-402.html
/pieces/disque-de-frein-403.html
/pieces/filtre-a-huile-125.html
```

**Format détecté :**
- Pattern : `/pieces/{alias}-{id}.html`
- `{alias}` : Slug texte (avec tirets)
- `{id}` : ID numérique de la gamme
- Extension : `.html` obligatoire

#### ✅ Implémentation actuelle (Remix)

**Route actuelle :** `/frontend/app/routes/pieces.$slug.tsx`

**Extraction ID :**
```typescript
const match = slug.match(/-(\d+)\.html$/);
const gammeId = match[1]; // ✅ CORRECT
```

**API breadcrumbs retourne :**
```json
{
  "breadcrumbs": {
    "items": [
      {"label": "Accueil", "href": "/"},
      {"label": "Pièces Auto", "href": "/pieces"},
      {"label": "Plaquette de frein", "href": "/pieces/plaquette-de-frein-402.html"}
    ]
  }
}
```

**✅ STATUS : PARFAIT - URLs identiques**

---

### 2. 🚗 Pages Gammes + Véhicule (Filtres marque/modèle/type)

#### ❌ Ancien pattern (nginx)
```nginx
rewrite ^/pieces/[^?/]*-([0-9]+)/[^?/]*-([0-9]+)/[^?/]*-([0-9]+)/[^?/]*-([0-9]+).html$ 
  /v7.products.car.gamme.php?pg_id=$1&marque_id=$2&modele_id=$3&type_id=$4 last;
```

**Exemples d'URLs :**
```
/pieces/plaquette-de-frein-402/renault-13/clio-iii-13044/1-5-dci-33300.html
/pieces/disque-de-frein-403/peugeot-17/208-14523/1-6-hdi-35600.html
```

**Format détecté :**
- Pattern : `/pieces/{gamme_alias}-{pg_id}/{marque_alias}-{marque_id}/{modele_alias}-{modele_id}/{type_alias}-{type_id}.html`
- 4 segments : gamme / marque / modèle / motorisation
- Chaque segment : `{alias}-{id}`

#### ⚠️ Implémentation actuelle

**Route actuelle :** Utilise query params `?marque=renault&modele=clio`

**Problème identifié :**
```typescript
// ❌ Actuel : /pieces/plaquette-de-frein-402?marque=renault&modele=clio
// ✅ Attendu : /pieces/plaquette-de-frein-402/renault-13/clio-iii-13044/1-5-dci-33300.html
```

**🔴 ACTION REQUISE : Adapter la structure des URLs véhicule**

---

### 3. 📄 Pages Fiche Produit

#### ❌ Ancien pattern (nginx)
```nginx
rewrite ^/fiche/([0-9]+)/([0-9]+)$ /v7.products.fiche.php?piece_id=$1&type_id=$2 last;
rewrite ^/fiche/([0-9]+)$ /v7.products.fiche.php?piece_id=$1 last;
```

**Exemples d'URLs :**
```
/fiche/123456
/fiche/123456/33300
```

**Format détecté :**
- Pattern : `/fiche/{piece_id}` ou `/fiche/{piece_id}/{type_id}`
- Sans extension .html
- IDs numériques uniquement

#### ✅ À implémenter (TODO)

**Route à créer :** `/frontend/app/routes/fiche.$pieceId.tsx`

---

### 4. 🏭 Pages Constructeurs (Marques)

#### ❌ Ancien pattern (nginx)
```nginx
rewrite ^/constructeurs/[^?/]*-([0-9]+).html$ /v7.constructeurs.marque.php?marque_id=$1 last;
rewrite ^/constructeurs/[^?/]*-([0-9]+)/[^?/]*-([0-9]+)/[^?/]*-([0-9]+).html$ 
  /v7.constructeurs.type.php?marque_id=$1&modele_id=$2&type_id=$3 last;
```

**Exemples d'URLs :**
```
/constructeurs/renault-13.html
/constructeurs/renault-13/clio-iii-13044/1-5-dci-33300.html
```

**Format détecté :**
- Pattern marque : `/constructeurs/{marque_alias}-{marque_id}.html`
- Pattern type : `/constructeurs/{marque_alias}-{marque_id}/{modele_alias}-{modele_id}/{type_alias}-{type_id}.html`

---

### 5. 🔍 Pages Recherche

#### ❌ Ancien pattern (nginx)
```nginx
rewrite ^/find/([-a-zA-Z0-9.]+)/([0-9]+)/([0-9]+)$ 
  /search.php?questCleaned=$1&filtre_union=$2&filtre_equip=$3 last;
```

**Exemples d'URLs :**
```
/find/plaquette-frein-renault/0/0
```

---

### 6. 📝 Pages Blog

#### ❌ Ancien pattern (nginx)
```nginx
rewrite ^/blog-pieces-auto/conseils/([a-z0-9-]+)/([a-z0-9-]+)$ 
  /blog.advice.gamme.item.php?pg_alias=$1&ba_alias=$2 last;
```

**Exemples d'URLs :**
```
/blog-pieces-auto/conseils/plaquette-de-frein/comment-choisir
/blog-pieces-auto/guide/entretien-voiture
```

---

## 🎯 Impact sur canonical.ts

### ✅ Ce qui fonctionne déjà

1. **Format gamme simple** : `/pieces/{alias}-{id}.html` ✅
2. **Suppression tracking params** : utm_*, fbclid, etc. ✅
3. **Tri alphabétique params** ✅

### 🔴 Ce qui doit être adapté

1. **URLs véhicule hiérarchiques**
   - Actuel : Query params `?marque=x&modele=y`
   - Attendu : Path segments `/marque-id/modele-id/type-id.html`

2. **Extension .html**
   - Actuel : Peut-être absente sur certaines routes
   - Attendu : **Obligatoire** sur pages gammes et constructeurs

---

## 🛠️ Plan d'action

### Priorité 1️⃣ : Valider breadcrumbs API (IMMÉDIAT)

Vérifier que l'API retourne les URLs **exactement** comme nginx :

```bash
# Test API actuelle
curl "http://localhost:3000/api/gamme-rest-optimized/402/page-data" | jq '.breadcrumbs'
```

**Attendu :**
```json
{
  "items": [
    {"label": "Accueil", "href": "/"},
    {"label": "Pièces Auto", "href": "/pieces"},
    {"label": "Plaquette de frein", "href": "/pieces/plaquette-de-frein-402.html"}
  ]
}
```

**✅ Si OK :** Breadcrumbs corrects, on continue
**❌ Si KO :** Corriger le backend pour ajouter `.html`

---

### Priorité 2️⃣ : Adapter canonical.ts pour URLs hiérarchiques

**Modification requise :**

```typescript
// Actuel
buildCanonicalUrl({
  baseUrl: '/pieces/plaquette-de-frein-402',
  params: { marque: 'renault', modele: 'clio' }
});
// Retourne : /pieces/plaquette-de-frein-402?marque=renault&modele=clio

// Nouveau comportement souhaité
buildCanonicalUrl({
  baseUrl: '/pieces/plaquette-de-frein-402',
  vehicle: {
    marque: { alias: 'renault', id: 13 },
    modele: { alias: 'clio-iii', id: 13044 },
    type: { alias: '1-5-dci', id: 33300 }
  }
});
// Retourne : /pieces/plaquette-de-frein-402/renault-13/clio-iii-13044/1-5-dci-33300.html
```

---

### Priorité 3️⃣ : Routes Remix à adapter

#### Option A : Dynamic Segments (Recommandé)

**Créer route :** `/pieces.$slug.$marque.$modele.$type.tsx`

```typescript
// URL : /pieces/plaquette-de-frein-402/renault-13/clio-iii-13044/1-5-dci-33300.html
export async function loader({ params }: LoaderFunctionArgs) {
  const slug = params.slug; // plaquette-de-frein-402
  const marque = params.marque; // renault-13
  const modele = params.modele; // clio-iii-13044
  const type = params.type; // 1-5-dci-33300.html
  
  // Extraire IDs
  const pgId = slug.match(/-(\d+)$/)?.[1];
  const marqueId = marque.match(/-(\d+)$/)?.[1];
  const modeleId = modele.match(/-(\d+)$/)?.[1];
  const typeId = type.match(/-(\d+)\.html$/)?.[1];
}
```

#### Option B : Splat Route

**Créer route :** `/pieces.$.tsx` (catch-all)

```typescript
// Gérer tous les segments
export async function loader({ params }: LoaderFunctionArgs) {
  const splat = params['*']; // Tout après /pieces/
  const segments = splat.split('/');
  
  // Parser selon le nombre de segments
  if (segments.length === 1) {
    // /pieces/plaquette-de-frein-402.html
  } else if (segments.length === 4) {
    // /pieces/plaquette-de-frein-402/renault-13/clio-iii-13044/1-5-dci-33300.html
  }
}
```

---

## 🧪 Tests à effectuer

### Test 1 : Breadcrumbs API

```bash
curl "http://localhost:3000/api/gamme-rest-optimized/402/page-data" | jq '.breadcrumbs.items[2].href'
# Attendu : "/pieces/plaquette-de-frein-402.html"
```

### Test 2 : URLs avec véhicule

```bash
# Tester si l'API retourne les infos véhicule avec IDs
curl "http://localhost:3000/api/gamme-rest-optimized/402/page-data?marque_id=13&modele_id=13044&type_id=33300"
```

### Test 3 : Canonical URLs

```typescript
// Dans test.seo-utils.tsx, ajouter test
const canonicalWithVehicle = buildCanonicalUrl({
  baseUrl: '/pieces/plaquette-de-frein-402',
  vehicle: {
    marque: { alias: 'renault', id: 13 },
    modele: { alias: 'clio-iii', id: 13044 }
  }
});
// Vérifier output
```

---

## 📊 Checklist de conformité

- [ ] ✅ Breadcrumbs API retourne URLs avec `.html`
- [ ] ⚠️ URLs véhicule utilisent path segments (pas query params)
- [ ] ⚠️ canonical.ts génère URLs hiérarchiques
- [ ] ⚠️ Routes Remix gèrent segments multiples
- [ ] ⏳ Pages fiche produit implémentées
- [ ] ⏳ Pages constructeurs implémentées
- [ ] ⏳ Pages blog implémentées

---

## 🎯 Recommandations

### Stratégie A : Migration Progressive (Recommandé)

1. **Phase actuelle** : Garder query params pour développement
2. **Phase suivante** : Implémenter redirections 301
   ```typescript
   // Rediriger ancien format vers nouveau
   /pieces/plaquette-de-frein-402?marque=renault
   → 301 → /pieces/plaquette-de-frein-402/renault-13/clio-iii-13044/1-5-dci-33300.html
   ```
3. **Phase finale** : Supprimer query params, 100% path segments

### Stratégie B : Migration Immédiate

1. **Adapter canonical.ts** pour URLs hiérarchiques
2. **Créer routes Remix** avec segments multiples
3. **Modifier API backend** pour retourner IDs véhicule
4. **Tester exhaustivement** toutes les combinaisons

---

## 💡 Questions à résoudre

1. **L'API backend a-t-elle les alias véhicule ?**
   - Besoin : `marque_alias`, `modele_alias`, `type_alias`
   - Tables DB : `marques`, `modeles`, `types`

2. **Remix supporte-t-il 4+ segments dynamiques ?**
   - ✅ OUI : `/pieces.$slug.$marque.$modele.$type.tsx`
   - Alternative : Splat route `$.tsx`

3. **Faut-il maintenir rétrocompatibilité query params ?**
   - Recommandé : Redirections 301 pendant 6 mois
   - Puis : Supprimer ancien format

---

**Prochaine action recommandée :**

🔍 **Tester l'API breadcrumbs** pour confirmer le format URLs actuel, puis décider de la stratégie de migration.
