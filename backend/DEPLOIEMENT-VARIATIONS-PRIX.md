# 🚀 Déploiement des Variations de Prix Dynamiques

## ✅ Modifications Code Terminées

### 1. Fichiers SQL Modifiés (3 fichiers)
- ✅ `prisma/supabase-functions/get_gamme_page_data_optimized.sql`
- ✅ `prisma/supabase-functions/DROP_AND_CREATE_get_gamme_page_data_optimized.sql`
- ✅ `prisma/supabase-functions/CLEANUP_AND_DEPLOY.sql`

**Ajout:** Section `seo_fragments_3` qui récupère 45 variations de prix depuis `__seo_item_switch` (alias='3', pg_id='0')

### 2. Services TypeScript Modifiés (2 fichiers)

**Fichier:** `src/modules/gamme-rest/services/gamme-rpc.service.ts`
```typescript
// ✅ NOUVELLE MÉTHODE AJOUTÉE
getPriceVariationByTypeId(typeId: number, seoFragments3: any[]): string {
  if (seoFragments3.length === 0) {
    return 'meilleur prix'; // Fallback
  }
  return seoFragments3[typeId % seoFragments3.length]?.sis_content || 'meilleur prix';
}
```

**Fichier:** `src/modules/gamme-rest/services/gamme-response-builder.service.ts`
```typescript
// ✅ ANCIEN CODE SUPPRIMÉ (hardcodé)
// const variationsPrix = ['mini prix', 'juste prix', 'meilleur prix', ...];

// ✅ NOUVEAU CODE DYNAMIQUE
const seoFragments3 = aggregatedData?.seo_fragments_3 || [];
const variationPrix = this.rpcService.getPriceVariationByTypeId(item.type_id, seoFragments3);
```

---

## 📋 ÉTAPE MANQUANTE: Déploiement SQL

### Option 1: Supabase Dashboard (RECOMMANDÉ)

1. **Ouvrir le Dashboard:**
   ```
   https://supabase.com/dashboard/project/cxpojprgwgubzjyqzmoq
   ```

2. **Aller dans SQL Editor:**
   - Menu latéral gauche → "SQL Editor"
   - Cliquer sur "New query"

3. **Copier-coller le SQL:**
   - Ouvrir le fichier: `backend/prisma/supabase-functions/DROP_AND_CREATE_get_gamme_page_data_optimized.sql`
   - Copier TOUT le contenu (lignes 1-236)
   - Coller dans l'éditeur SQL de Supabase

4. **Exécuter:**
   - Cliquer sur "Run" ou `Ctrl+Enter`
   - Vérifier le message de succès

### Option 2: Supabase CLI (si installée)

```bash
cd /workspaces/nestjs-remix-monorepo/backend
supabase db execute -f prisma/supabase-functions/DROP_AND_CREATE_get_gamme_page_data_optimized.sql
```

---

## 🧪 Vérification Post-Déploiement

### 1. Tester l'API NestJS

```bash
# Test rapide
curl -s 'http://localhost:3000/api/gamme-rest/10/page-data-rpc-v2' | jq '.data.seo_fragments_3 | length'

# Devrait retourner: 45
```

### 2. Vérifier les variations dans la réponse

```bash
# Afficher 3 exemples de variations
curl -s 'http://localhost:3000/api/gamme-rest/10/page-data-rpc-v2' | jq '.data.seo_fragments_3[:3]'

# Exemple de sortie attendue:
# [
#   {
#     "sis_id": 1234,
#     "sis_content": "neuve et à prix pas cher"
#   },
#   {
#     "sis_id": 1235,
#     "sis_content": "moins cher et à remplacer si usé"
#   },
#   {
#     "sis_id": 1236,
#     "sis_content": "à prix bas à remplacer si défaillant"
#   }
# ]
```

### 3. Tester les Cards Motorisations

```bash
# Vérifier qu'une motorisation a bien une variation dynamique
curl -s 'http://localhost:3000/api/gamme-rest/10/page-data-rpc-v2' | \
  jq '.motorisationCards[0].card.title'

# Devrait contenir une variation de prix de la base de données
# Exemple: "Disque de frein moins cher et à remplacer si usé PEUGEOT 208..."
```

---

## 📊 Données de la Base

### Table: `__seo_item_switch`

**Alias '3' (Variations Prix Globales):**
- **Nombre d'entrées:** 45 variations
- **pg_id:** '0' (global, pour toutes les gammes)
- **Exemples:**
  - "neuve et à prix pas cher"
  - "moins cher et à remplacer si usé"
  - "à prix bas à remplacer si défaillant"
  - "meilleur prix et à remplacer si cassé"
  - ...

### Rotation des Variations

La variation utilisée est déterminée par:
```typescript
typeId % 45  // Rotation basée sur l'ID de motorisation
```

Cela garantit:
- ✅ Une variation différente par motorisation
- ✅ Consistance (même variation pour même type_id)
- ✅ Distribution équitable des 45 variations

---

## ⚠️ État Actuel

- ✅ **Code TypeScript:** Prêt et déployé (serveur localhost:3000 actif)
- ✅ **Fichiers SQL:** Modifiés et prêts
- ❌ **Base de données Supabase:** SQL pas encore exécuté

**Action requise:** Déployer le SQL via Supabase Dashboard ou CLI (voir Options 1 ou 2 ci-dessus)

---

## 🎯 Résultat Attendu

Avant (hardcodé):
```typescript
const variationsPrix = ['mini prix', 'juste prix', 'meilleur prix', ...];
```

Après (dynamique):
```typescript
// Variations proviennent de __seo_item_switch
// 45 variations différentes depuis la base de données
// Rotation automatique par type_id
```

**Impact SEO:**
- 🔄 Contenu plus varié et naturel
- 📈 Meilleure couverture sémantique
- ✏️ Éditable depuis la base de données sans redéploiement code
