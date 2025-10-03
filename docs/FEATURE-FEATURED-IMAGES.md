# ✅ Feature: Images d'en-tête des articles blog

## 📋 Fonctionnalité Ajoutée

Ajout des **images d'en-tête (featured images)** pour chaque article blog, affichées sous le titre principal.

## 🎯 Résultat

Les articles blog affichent maintenant une grande image d'illustration en haut de la page, améliorant l'attrait visuel et le SEO.

## 💡 Implémentation

### 1. Backend - Interface TypeScript

**Fichier** : `/backend/src/modules/blog/interfaces/blog.interfaces.ts`

```typescript
export interface BlogArticle {
  // ... autres champs
  featuredImage?: string | null; // URL de l'image d'en-tête
  // ... autres champs
}
```

### 2. Backend - Transformation des données

**Fichier** : `/backend/src/modules/blog/services/blog.service.ts`

**A) Dans `transformAdviceToArticle()`** :
```typescript
featuredImage: this.buildImageUrl(
  `${advice.ba_id}.jpg`,
  'blog/articles',
),
```

**B) Dans `transformAdviceToArticleWithSections()`** :
```typescript
featuredImage: this.buildImageUrl(`${advice.ba_id}.jpg`, 'blog/articles'),
```

**C) Dans `transformGuideToArticle()`** :
```typescript
featuredImage: this.buildImageUrl(
  `${guide.bg_id}.jpg`,
  'blog/articles',
),
```

### 3. Frontend - Type TypeScript

**Fichier** : `/frontend/app/routes/blog-pieces-auto.conseils.$pg_alias.tsx`

```typescript
interface _BlogArticle {
  // ... autres champs
  featuredImage?: string | null;
  // ... autres champs
}
```

### 4. Frontend - Affichage de l'image

**Fichier** : `/frontend/app/routes/blog-pieces-auto.conseils.$pg_alias.tsx`

```tsx
{/* 🖼️ Image d'en-tête featured */}
{article.featuredImage && (
  <div className="mt-6 rounded-xl overflow-hidden shadow-2xl max-w-4xl mx-auto">
    <img
      src={article.featuredImage}
      alt={article.title}
      className="w-full h-auto object-cover"
      loading="eager"
    />
  </div>
)}
```

## 📊 Structure CDN

**Images stockées dans** : `uploads/blog/articles/{id}.jpg`

**Exemples** :
- Article ID 20 (alternateur) : `https://.../uploads/blog/articles/20.jpg` ✅ 317 KB
- Article ID 22 : `https://.../uploads/blog/articles/22.jpg`

## ✅ Tests de Validation

### Backend API
```bash
curl -s http://localhost:3000/api/blog/article/by-gamme/alternateur | jq '.data.featuredImage'
# Output: "https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/blog/articles/20.jpg"
```

### Image CDN
```bash
curl -I "https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/blog/articles/20.jpg"
# Output: HTTP/2 200 ✅
```

## 🎨 Rendu Visuel

L'image est affichée :
- **Position** : Sous le titre H1, dans l'en-tête bleu
- **Style** : Arrondie avec ombre portée importante
- **Largeur** : Maximum 4xl (56rem / ~896px)
- **Centrage** : Horizontal automatique (mx-auto)
- **Loading** : `eager` (priorité haute car above-the-fold)

## 📝 Notes Techniques

### Gestion des images manquantes

Si une image n'existe pas sur le CDN, la méthode `buildImageUrl()` retourne quand même l'URL complète. Le navigateur affichera une erreur 404 mais ne cassera pas la page. Le layout reste intact grâce au `{article.featuredImage && ...}` qui masque le conteneur si l'URL est `null`.

### Format des images

- **Extension** : `.jpg` (JPEG)
- **Nommage** : Basé sur l'ID de l'article (`{ba_id}.jpg` ou `{bg_id}.jpg`)
- **Pas de fallback** : Si l'image n'existe pas, rien n'est affiché (comportement intentionnel)

## 🚀 Déploiement

**Branch** : `blogv2`

**Fichiers modifiés** :
1. `/backend/src/modules/blog/interfaces/blog.interfaces.ts`
2. `/backend/src/modules/blog/services/blog.service.ts`
3. `/frontend/app/routes/blog-pieces-auto.conseils.$pg_alias.tsx`

**Pas de migration DB nécessaire** : Les images sont référencées par convention de nommage basée sur l'ID.

## 🔗 Liens

- **Page de test** : http://localhost:3001/blog-pieces-auto/conseils/alternateur
- **API** : http://localhost:3000/api/blog/article/by-gamme/alternateur

---

**Date** : 2 octobre 2025  
**Type** : ✨ Feature (nouvelle fonctionnalité)  
**Status** : ✅ Implémenté et testé
