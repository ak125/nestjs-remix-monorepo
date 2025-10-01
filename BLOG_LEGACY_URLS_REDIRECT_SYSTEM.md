# 🔄 Blog Legacy URLs - Système de Redirection

**Date**: 1er octobre 2025  
**Branche**: `blogv2`  
**Feature**: Support des anciennes URLs PHP avec redirections 301 SEO-friendly

---

## 🎯 Objectif

Rediriger les anciennes URLs du blog PHP vers les nouvelles URLs Remix, tout en préservant le SEO.

### Ancien Format (PHP)
```
/blog-pieces-auto/conseils/{pg_alias}
```

**Exemple** :
```
/blog-pieces-auto/conseils/alternateur
```

### Nouveau Format (Remix)
```
/blog/article/{ba_alias}
```

**Exemple** :
```
/blog/article/comment-changer-votre-alternateur
```

---

## 🏗️ Architecture de la Solution

### 1. Route Frontend - Redirection 301

**Fichier**: `frontend/app/routes/blog-pieces-auto.conseils.$pg_alias.tsx`

```typescript
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { pg_alias } = params;
  
  // Appel API pour trouver l'article
  const response = await fetch(
    `${baseUrl}/api/blog/article/by-gamme/${pg_alias}`
  );
  
  const { data: article } = await response.json();
  
  // Redirection 301 permanente
  return redirect(`/blog/article/${article.slug}`, 301);
}
```

**Flow** :
1. User demande `/blog-pieces-auto/conseils/alternateur`
2. Remix loader intercepte
3. Appel API `GET /api/blog/article/by-gamme/alternateur`
4. Redirection 301 vers `/blog/article/comment-changer-votre-alternateur`
5. Google update le lien dans son index

### 2. Endpoint Backend - Recherche par Gamme

**Fichier**: `backend/src/modules/blog/controllers/blog.controller.ts`

```typescript
@Get('article/by-gamme/:pg_alias')
@UseGuards(OptionalAuthGuard)
async getArticleByGamme(@Param('pg_alias') pg_alias: string) {
  const article = await this.blogService.getArticleByGamme(pg_alias);
  return { success: true, data: article };
}
```

### 3. Service - Logique de Recherche

**Fichier**: `backend/src/modules/blog/services/blog.service.ts`

```typescript
async getArticleByGamme(pg_alias: string): Promise<BlogArticle | null> {
  // 1. Trouver pg_id depuis pieces_gamme
  const { data: gammeData } = await this.supabaseService.client
    .from('pieces_gamme')
    .select('pg_id, pg_name')
    .eq('pg_alias', pg_alias)
    .single();
  
  if (!gammeData) return null;
  
  // 2. Trouver article le plus récent pour cette gamme
  const { data } = await this.supabaseService.client
    .from('__blog_advice')
    .select('*')
    .eq('ba_pg_id', gammeData.pg_id)
    .order('ba_update', { ascending: false })
    .limit(1)
    .single();
  
  // 3. Charger sections H2/H3 et retourner
  return await this.transformAdviceToArticleWithSections(data);
}
```

---

## 🔍 Mapping des URLs

### Exemples de Redirections

| Ancienne URL PHP | Nouvelle URL Remix | Statut |
|------------------|-------------------|---------|
| `/blog-pieces-auto/conseils/alternateur` | `/blog/article/comment-changer-votre-alternateur` | 301 |
| `/blog-pieces-auto/conseils/amortisseur` | `/blog/article/quand-changer-amortisseurs` | 301 |
| `/blog-pieces-auto/conseils/freins` | `/blog/article/entretien-systeme-freinage` | 301 |
| `/blog-pieces-auto/conseils/filtre-a-huile` | `/blog/article/choisir-filtre-huile` | 301 |

### Stratégie de Sélection d'Article

Quand plusieurs articles existent pour une gamme :
- ✅ **Prend le plus récent** (`ORDER BY ba_update DESC`)
- ✅ Garantit toujours un article pertinent
- ✅ Favorise le contenu à jour

---

## 🧪 Tests

### Test 1 : API Endpoint

```bash
curl http://localhost:3000/api/blog/article/by-gamme/alternateur
```

**Résultat attendu** :
```json
{
  "success": true,
  "data": {
    "slug": "comment-changer-votre-alternateur",
    "title": "Changer l'alternateur...",
    "sections": [...]
  }
}
```

### Test 2 : Redirection Frontend

```bash
curl -I http://localhost:3000/blog-pieces-auto/conseils/alternateur
```

**Résultat attendu** :
```
HTTP/1.1 301 Moved Permanently
Location: /blog/article/comment-changer-votre-alternateur
```

### Test 3 : Gammes Communes

| pg_alias | Article attendu |
|----------|----------------|
| `alternateur` | Changer l'alternateur |
| `amortisseur` | Quand changer les amortisseurs |
| `filtre-a-air` | Entretien filtre à air |
| `bougies` | Changer les bougies d'allumage |
| `courroie-distribution` | Quand changer la courroie |

---

## 🚀 Avantages SEO

### 1. Redirections 301 Permanentes
- ✅ Google transfère le PageRank
- ✅ Préserve l'autorité de domaine
- ✅ Pas de contenu dupliqué

### 2. URLs Plus Lisibles
**Avant** : `/blog-pieces-auto/conseils/alternateur`  
**Après** : `/blog/article/comment-changer-votre-alternateur`

- ✅ Mots-clés dans l'URL
- ✅ Plus descriptif
- ✅ Meilleure CTR dans SERP

### 3. Structure de Site Simplifiée
- ❌ Ancien: `/blog-pieces-auto/conseils/{gamme}`
- ✅ Nouveau: `/blog/article/{slug}`
- Moins de niveaux de profondeur
- URLs canoniques claires

---

## 📊 Monitoring et Analytics

### Logs Backend

```typescript
// Dans getArticleByGamme()
this.logger.log(`🔄 Recherche article par gamme: ${pg_alias}`);
this.logger.log(`✅ Gamme trouvée: ${gammeData.pg_name} (ID: ${gammeData.pg_id})`);
this.logger.log(`✅ Article trouvé: ${data.ba_h1} (slug: ${data.ba_alias})`);
```

**Exemple de log** :
```
[BlogService] 🔄 Recherche article par gamme: alternateur
[BlogService] ✅ Gamme trouvée: Alternateur (ID: 42)
[BlogService] ✅ Article trouvé: Changer l'alternateur (slug: comment-changer-votre-alternateur)
```

### Métriques à Tracker

1. **Redirections par gamme**
   - Quelles gammes génèrent le plus de redirections
   - Identifier les URLs legacy encore utilisées

2. **Taux de succès**
   - % de redirections réussies vs 404
   - Gammes sans article trouvé

3. **Performance**
   - Temps de réponse endpoint by-gamme
   - Cache hit rate

---

## 🔧 Améliorations Futures

### 1. Table de Mapping Explicite

Pour les cas complexes, créer une table :

```sql
CREATE TABLE blog_legacy_redirects (
  id SERIAL PRIMARY KEY,
  old_path VARCHAR(255) UNIQUE NOT NULL,
  new_slug VARCHAR(255) NOT NULL,
  status_code INT DEFAULT 301,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Exemple
INSERT INTO blog_legacy_redirects (old_path, new_slug)
VALUES 
  ('/blog-pieces-auto/conseils/alternateur', 'comment-changer-votre-alternateur'),
  ('/blog-pieces-auto/conseils/amortisseur', 'quand-changer-amortisseurs');
```

**Avantages** :
- Contrôle manuel des redirections
- Support des URLs personnalisées
- Historique des redirections

### 2. Fallback Intelligent

Si aucun article trouvé pour une gamme :
1. Rediriger vers la page de recherche avec le nom de la gamme
2. Ou vers la page de catégorie
3. Ou vers la homepage blog avec un message

```typescript
if (!article) {
  // Rediriger vers recherche
  return redirect(`/blog?q=${gammeData.pg_name}`, 301);
}
```

### 3. Analytics Avancés

```typescript
// Track redirections dans Google Analytics
analytics.track('legacy_url_redirect', {
  from: `/blog-pieces-auto/conseils/${pg_alias}`,
  to: `/blog/article/${article.slug}`,
  gamme_id: gammeData.pg_id,
  gamme_name: gammeData.pg_name,
});
```

---

## ✅ Checklist d'Implémentation

### Backend
- [x] Endpoint `GET /api/blog/article/by-gamme/:pg_alias`
- [x] Méthode `BlogService.getArticleByGamme()`
- [x] Logs informatifs
- [ ] Tests unitaires
- [ ] Tests d'intégration

### Frontend
- [x] Route `blog-pieces-auto.conseils.$pg_alias.tsx`
- [x] Redirection 301
- [x] Gestion erreurs (fallback vers /blog)
- [ ] Tests E2E

### Qualité
- [ ] Documentation API (Swagger)
- [ ] Logs monitoring (Sentry, Datadog)
- [ ] Performance tests
- [ ] SEO validation (redirections 301)

---

## 📝 Exemples de Requêtes

### API Directe
```bash
# Chercher article par gamme
curl http://localhost:3000/api/blog/article/by-gamme/alternateur

# Response
{
  "success": true,
  "data": {
    "id": "advice_20",
    "slug": "comment-changer-votre-alternateur",
    "title": "Changer l'alternateur pour le bon fonctionnement...",
    "sections": [...],
    "viewsCount": 982
  }
}
```

### Redirection Navigateur
```bash
# Ancienne URL
curl -L http://localhost:3000/blog-pieces-auto/conseils/alternateur

# Suit la redirection 301 automatiquement
# Arrive sur /blog/article/comment-changer-votre-alternateur
```

---

## 🎯 Impact Business

### SEO
- **Préserve** : PageRank, autorité, backlinks
- **Améliore** : Structure URLs, mots-clés, CTR
- **Évite** : Contenu dupliqué, 404 errors

### UX
- **Transparente** : Redirection automatique
- **Rapide** : 1-2 requêtes max
- **Fiable** : Fallback vers /blog si erreur

### Technique
- **Maintenable** : Logique centralisée
- **Scalable** : Support de milliers de redirections
- **Performant** : Cache possible

---

**Status** : ✅ Implémenté, en attente de tests  
**Prochaine étape** : Redémarrer backend et tester  
**Auteur** : GitHub Copilot  
**Date** : 1er octobre 2025
