# 📝 Système Universel de Métadonnées SEO pour le Blog

## 🎯 Vue d'ensemble

Système générique pour gérer les métadonnées SEO de **toutes les pages du blog** depuis la table Supabase `__blog_meta_tags_ariane`.

### Avantages
- ✅ **Centralisé** : Une seule table pour toutes les métadonnées
- ✅ **Cache intelligent** : Redis (TTL 1h) pour les performances
- ✅ **Fallbacks robustes** : Métadonnées par défaut si table vide
- ✅ **Type-safe** : Interfaces TypeScript complètes
- ✅ **Réutilisable** : Hooks et helpers pour toutes les pages
- ✅ **API REST** : Endpoints pour frontend et outils externes

---

## 📊 Table Supabase : `__blog_meta_tags_ariane`

| Colonne | Type | Description | Exemple |
|---------|------|-------------|---------|
| `mta_id` | text | Identifiant unique | "1", "2", "3" |
| `mta_alias` | text | **Clé de recherche** (unique) | "constructeurs", "advice", "home" |
| `mta_title` | text | Titre SEO `<title>` | "Pièces détachées automobiles" |
| `mta_h1` | text | Titre H1 de la page | "Catalogue des constructeurs" |
| `mta_descrip` | text | Meta description | "Découvrez notre catalogue..." |
| `mta_keywords` | text | Mots-clés SEO | "pièces auto, OEM, catalogue" |
| `mta_ariane` | text | Fil d'Ariane (breadcrumb) | "Accueil > Blog > Constructeurs" |
| `mta_content` | text | Contenu additionnel (nullable) | Texte d'intro optionnel |
| `mta_relfollow` | text | Indexation robots | "1" ou "index, follow" |

### Alias actuels dans la table
```
- home          → Page d'accueil
- constructeurs → Catalogue des marques
- advice        → Page conseils
- article       → Template article individuel
- guide         → Page guides techniques
```

---

## 🏗️ Architecture Backend (NestJS)

### 1. Service : `BlogMetadataService`

**Fichier:** `backend/src/modules/blog-metadata/blog-metadata.service.ts`

#### Méthodes principales

```typescript
// Récupérer métadonnées d'une page
async getMetadata(alias: string): Promise<BlogMetadata>

// Récupérer toutes les métadonnées
async getAllMetadata(): Promise<BlogMetadata[]>

// Lister tous les alias disponibles
async getAvailableAliases(): Promise<string[]>

// Invalider le cache d'un alias
async invalidateCache(alias: string): Promise<void>

// Invalider tout le cache
async invalidateAllCache(): Promise<void>
```

#### Fonctionnalités

- ✅ **Cache Redis** (clé: `blog-meta:{alias}`, TTL: 1h)
- ✅ **Normalisation `relfollow`** : "1" → "index, follow"
- ✅ **Fallbacks intelligents** par alias
- ✅ **Logs détaillés** pour debugging

### 2. Controller : `BlogMetadataController`

**Fichier:** `backend/src/modules/blog-metadata/blog-metadata.controller.ts`

#### Endpoints REST

```typescript
// Récupérer métadonnées d'une page
GET /api/blog/metadata/:alias

// Récupérer toutes les métadonnées
GET /api/blog/metadata

// Lister les alias disponibles  
GET /api/blog/metadata/aliases/list

// Invalider cache d'un alias
DELETE /api/blog/metadata/cache/:alias

// Invalider tout le cache
DELETE /api/blog/metadata/cache
```

### 3. Module : `BlogMetadataModule`

**Fichier:** `backend/src/modules/blog-metadata/blog-metadata.module.ts`

```typescript
@Module({
  controllers: [BlogMetadataController],
  providers: [BlogMetadataService],
  exports: [BlogMetadataService], // ← Exporté pour autres modules
})
export class BlogMetadataModule {}
```

---

## 🎨 Frontend - Helpers Remix

### Fichier : `frontend/app/utils/blog-metadata.tsx`

### 1. Charger métadonnées dans le Loader

```typescript
import { loadBlogMetadata } from '~/utils/blog-metadata';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Charger métadonnées pour cette page
  const metadata = await loadBlogMetadata('constructeurs');
  
  return json({ metadata, /* autres données */ });
};
```

### 2. Générer Meta Tags

```typescript
import { generateBlogMeta } from '~/utils/blog-metadata';
import type { MetaFunction } from '@remix-run/node';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return generateBlogMeta(data?.metadata, {
    titleSuffix: ' | Automecanik',
    defaultTitle: 'Page Blog',
    ogImage: 'https://example.com/og-image.jpg',
  });
};
```

### 3. Utiliser H1 dynamique

```typescript
import { useBlogMetadata } from '~/utils/blog-metadata';

export default function MaPage() {
  const data = useLoaderData<typeof loader>();
  const { h1, breadcrumb } = useBlogMetadata(data);
  
  return (
    <div>
      <h1>{h1 || 'Titre par défaut'}</h1>
      {/* Contenu */}
    </div>
  );
}
```

### 4. Afficher le Breadcrumb

```typescript
import { Breadcrumb } from '~/utils/blog-metadata';

export default function MaPage() {
  const { metadata } = useLoaderData<typeof loader>();
  
  return (
    <div>
      <Breadcrumb 
        ariane={metadata?.ariane} 
        separator="/"
        className="text-sm text-gray-600"
      />
      {/* Contenu */}
    </div>
  );
}
```

---

## 🚀 Guide d'utilisation par page

### Page 1 : Catalogue Constructeurs (`/blog-pieces-auto/auto`)

**Alias:** `constructeurs`

```typescript
// frontend/app/routes/blog-pieces-auto.auto._index.tsx
import { loadBlogMetadata, generateBlogMeta, Breadcrumb } from '~/utils/blog-metadata';

export const loader = async () => {
  const metadata = await loadBlogMetadata('constructeurs');
  const brands = await fetchBrands();
  
  return json({ metadata, brands });
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return generateBlogMeta(data?.metadata);
};

export default function ConstructeursPage() {
  const { metadata, brands } = useLoaderData<typeof loader>();
  
  return (
    <div>
      <Breadcrumb ariane={metadata?.ariane} />
      <h1>{metadata?.h1 || 'Catalogue des Constructeurs'}</h1>
      {/* Grille des marques */}
    </div>
  );
}
```

### Page 2 : Liste des Conseils (`/blog-pieces-auto/conseils`)

**Alias:** `advice`

```typescript
// frontend/app/routes/blog-pieces-auto.conseils._index.tsx
import { loadBlogMetadata, generateBlogMeta } from '~/utils/blog-metadata';

export const loader = async () => {
  const metadata = await loadBlogMetadata('advice');
  const articles = await fetchArticles();
  
  return json({ metadata, articles });
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return generateBlogMeta(data?.metadata);
};

export default function AdvicePage() {
  const { metadata } = useLoaderData<typeof loader>();
  
  return (
    <div>
      <Breadcrumb ariane={metadata?.ariane} />
      <h1>{metadata?.h1 || 'Conseils & Guides'}</h1>
      {/* Liste des articles */}
    </div>
  );
}
```

### Page 3 : Article individuel (`/blog-pieces-auto/conseils/:slug`)

**Alias:** `article` (template) + métadonnées dynamiques

```typescript
// frontend/app/routes/blog-pieces-auto.conseils.$slug.tsx
import { loadBlogMetadata, generateBlogMeta } from '~/utils/blog-metadata';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const article = await fetchArticle(params.slug);
  
  // Utiliser métadonnées de l'article SI disponibles
  // Sinon, fallback sur template "article"
  const metadata = await loadBlogMetadata('article');
  
  // Override avec données article
  const customMetadata = {
    ...metadata,
    title: article.title,
    description: article.excerpt,
    h1: article.title,
    ariane: `Accueil > Conseils > ${article.title}`,
  };
  
  return json({ metadata: customMetadata, article });
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return generateBlogMeta(data?.metadata);
};
```

### Page 4 : Homepage (`/`)

**Alias:** `home`

```typescript
// frontend/app/routes/_index.tsx
import { loadBlogMetadata, generateBlogMeta } from '~/utils/blog-metadata';

export const loader = async () => {
  const metadata = await loadBlogMetadata('home');
  
  return json({ metadata });
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return generateBlogMeta(data?.metadata, {
    ogImage: 'https://automecanik.com/og-home.jpg',
  });
};
```

---

## 🔧 Enregistrer le module dans AppModule

**Fichier:** `backend/src/app.module.ts`

```typescript
import { BlogMetadataModule } from './modules/blog-metadata/blog-metadata.module';

@Module({
  imports: [
    // ... autres modules
    BlogMetadataModule, // ← Ajouter ici
  ],
})
export class AppModule {}
```

---

## 🧪 Tests

### Test 1: API Backend - Récupérer métadonnées

```bash
# Métadonnées constructeurs
curl http://localhost:3000/api/blog/metadata/constructeurs

# Métadonnées conseils
curl http://localhost:3000/api/blog/metadata/advice

# Toutes les métadonnées
curl http://localhost:3000/api/blog/metadata

# Liste des alias
curl http://localhost:3000/api/blog/metadata/aliases/list
```

### Test 2: Invalider le cache

```bash
# Invalider cache d'un alias
curl -X DELETE http://localhost:3000/api/blog/metadata/cache/constructeurs

# Invalider tout le cache
curl -X DELETE http://localhost:3000/api/blog/metadata/cache
```

### Test 3: Frontend - Vérifier métadonnées

```bash
# Vérifier <title>
curl -s http://localhost:5173/blog-pieces-auto/auto | grep "<title>"

# Vérifier <meta name="description">
curl -s http://localhost:5173/blog-pieces-auto/auto | grep 'meta name="description"'

# Vérifier H1
curl -s http://localhost:5173/blog-pieces-auto/auto | grep -A 2 "<h1"
```

---

## 📦 Ajouter nouvelles métadonnées dans Supabase

### Méthode 1: SQL Direct

```sql
INSERT INTO __blog_meta_tags_ariane (
  mta_id,
  mta_alias,
  mta_title,
  mta_descrip,
  mta_keywords,
  mta_h1,
  mta_ariane,
  mta_content,
  mta_relfollow
) VALUES (
  '6', -- Nouvel ID
  'nouvelle-page', -- Alias unique
  'Titre SEO de la nouvelle page',
  'Description méta pour SEO',
  'mot-clé1, mot-clé2, mot-clé3',
  'Titre H1 affiché sur la page',
  'Accueil > Section > Nouvelle Page',
  'Contenu additionnel optionnel',
  '1' -- ou "index, follow"
);
```

### Méthode 2: Script Node.js

```javascript
const { createClient } = require('@supabase/supabase-js');

const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

await client
  .from('__blog_meta_tags_ariane')
  .insert({
    mta_id: '6',
    mta_alias: 'nouvelle-page',
    mta_title: 'Titre SEO',
    mta_descrip: 'Description',
    mta_keywords: 'mots, clés',
    mta_h1: 'Titre H1',
    mta_ariane: 'Accueil > Section > Page',
    mta_relfollow: '1',
  });
```

### Après ajout: Invalider le cache

```bash
curl -X DELETE http://localhost:3000/api/blog/metadata/cache
```

---

## 🎨 Personnalisation du Breadcrumb

### Parser custom avec URLs

```typescript
import { parseBreadcrumb } from '~/utils/blog-metadata';

const breadcrumb = parseBreadcrumb(metadata?.ariane, {
  'Ma Section': '/ma-section',
  'Sous-section': '/ma-section/sous-section',
});

// Rendu manuel
breadcrumb.map((item, index) => (
  <span key={index}>
    {item.url ? (
      <Link to={item.url}>{item.label}</Link>
    ) : (
      <span>{item.label}</span>
    )}
  </span>
));
```

---

## 📊 Format `mta_relfollow`

| Valeur DB | Interprétation | Robots |
|-----------|----------------|--------|
| `"1"` | Indexable | `index, follow` |
| `"0"` | Non indexable | `noindex, nofollow` |
| `"index, follow"` | Indexable | `index, follow` |
| `"noindex, nofollow"` | Non indexable | `noindex, nofollow` |
| `null` ou vide | Défaut | `index, follow` |

**Normalisation automatique** dans `BlogMetadataService.normalizeRelFollow()`.

---

## 🔄 Workflow complet

```
1. Créer/modifier métadonnées dans Supabase
       ↓
2. (Optionnel) Invalider cache:
   DELETE /api/blog/metadata/cache
       ↓
3. Page Remix charge métadonnées dans loader:
   const metadata = await loadBlogMetadata('alias')
       ↓
4. Backend vérifie cache Redis
       ↓
5a. Cache HIT → Retourne métadonnées
5b. Cache MISS → Requête Supabase → Cache
       ↓
6. Frontend génère meta tags + H1 + breadcrumb
       ↓
7. Page affichée avec SEO optimisé
```

---

## ✅ Checklist d'intégration pour nouvelle page

- [ ] Créer entrée dans `__blog_meta_tags_ariane` avec alias unique
- [ ] Tester API: `GET /api/blog/metadata/{alias}`
- [ ] Importer helpers dans route Remix
- [ ] Ajouter `loadBlogMetadata(alias)` dans loader
- [ ] Utiliser `generateBlogMeta()` dans meta export
- [ ] Utiliser `metadata.h1` pour le titre principal
- [ ] Ajouter `<Breadcrumb ariane={metadata?.ariane} />`
- [ ] Tester en local (title, description, H1, breadcrumb)
- [ ] Invalider cache après modifications DB
- [ ] Déployer et vérifier en production

---

## 📁 Structure des fichiers

```
backend/
  src/
    modules/
      blog-metadata/
        ├── blog-metadata.module.ts       ← Module NestJS
        ├── blog-metadata.service.ts      ← Logique métier
        └── blog-metadata.controller.ts   ← API REST

frontend/
  app/
    utils/
      └── blog-metadata.tsx               ← Helpers Remix
    routes/
      ├── _index.tsx                      ← Utilise alias 'home'
      ├── blog-pieces-auto.auto._index.tsx ← Utilise alias 'constructeurs'
      ├── blog-pieces-auto.conseils._index.tsx ← Utilise alias 'advice'
      └── blog-pieces-auto.conseils.$slug.tsx  ← Utilise alias 'article'
```

---

## 🚀 Avantages du système

### Pour les développeurs
- ✅ **DRY** : Pas de duplication de code SEO
- ✅ **Type-safe** : TypeScript end-to-end
- ✅ **Testable** : Endpoints API dédiés
- ✅ **Maintenable** : Logique centralisée

### Pour les éditeurs
- ✅ **Flexible** : Modifier SEO sans redéploiement
- ✅ **Centralisé** : Une seule table Supabase
- ✅ **Prévisualisation** : Tester avec l'API
- ✅ **Versionnable** : Historique Supabase

### Pour le SEO
- ✅ **Cohérent** : Structure uniforme
- ✅ **Performant** : Cache Redis
- ✅ **Rich snippets** : Schema.org ready
- ✅ **Social media** : OpenGraph/Twitter ready

---

## 🎉 Résultat

✅ **Système universel de métadonnées SEO opérationnel pour toutes les pages du blog !**

**Features:**
- 🔌 API REST complète
- 📦 Service réutilisable
- 🎨 Hooks React/Remix
- 💾 Cache intelligent
- 🛡️ Fallbacks robustes
- 🔍 SEO optimisé

---

**Date:** 03 Octobre 2025  
**Auteur:** GitHub Copilot  
**Status:** ✅ Prêt pour production
