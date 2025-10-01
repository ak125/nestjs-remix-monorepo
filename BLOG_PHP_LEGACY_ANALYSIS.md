# Analyse du code PHP Legacy - Article Blog

## 📋 Fonctionnalités identifiées

### ✅ Déjà implémenté

1. **Routing par pg_alias** ✅
   - `$pg_alias=$_GET["pg_alias"]`
   - Route : `/blog-pieces-auto/conseils/{pg_alias}`

2. **Vérification PG_DISPLAY** ✅
   - `WHERE PG_ALIAS = '$pg_alias'` + `PG_DISPLAY==1`
   - Notre backend vérifie l'existence via `getArticleByGamme()`

3. **Redirection spéciale (pg_id=620)** ⚠️ À FAIRE
   ```php
   if($pg_id==620) {
       header("Location: /blog-pieces-auto/conseils/emetteur-d-embrayage");
   }
   ```

4. **Chargement article + gamme + famille** ✅
   - JOIN avec PIECES_GAMME et CATALOG_FAMILY
   - Nos données incluent déjà pg_alias

5. **Sections H2/H3** ✅
   - Chargement depuis `__BLOG_ADVICE_H2` et `__BLOG_ADVICE_H3`
   - `transformAdviceToArticleWithSections()` déjà implémenté

6. **Images avec fallback** ⚠️ À VÉRIFIER
   ```php
   if($ba_wall=="no.jpg") {
       // Utiliser image de la gamme (PG_IMG)
   } else {
       // Utiliser image de l'article
   }
   ```

7. **Sommaire (Table des matières)** ✅
   - Ancres générées avec `url_title()`
   - Notre frontend a déjà le sommaire

8. **CTA (Call-to-Action)** ❌ MANQUANT
   ```php
   BA_CTA_ANCHOR, BA_CTA_LINK
   BA2_CTA_ANCHOR, BA2_CTA_LINK (pour H2)
   BA3_CTA_ANCHOR, BA3_CTA_LINK (pour H3)
   ```

9. **Articles croisés (Cross-selling)** ❌ MANQUANT
   ```sql
   FROM __BLOG_ADVICE_CROSS
   WHERE BAC_BA_ID = $ba_id
   ```

10. **Véhicules compatibles** ❌ MANQUANT
    ```sql
    FROM __CROSS_GAMME_CAR_NEW
    WHERE CGC_PG_ID = $pg_id
    ```

11. **Canonical URLs** ⚠️ À AMÉLIORER
    - Vérifie si URL actuelle = canonical
    - Si différent → `noindex, follow`

12. **Codes erreur** ❌ MANQUANT
    - 410: Gamme non trouvée
    - 412: Gamme avec PG_DISPLAY=0

---

## 🚀 Améliorations à implémenter

### 1. ⚠️ Haute priorité

#### A. Ajouter les CTA dans les données
```typescript
// Backend: blog.interfaces.ts
export interface BlogSection {
  level: number;
  title: string;
  content: string;
  anchor: string;
  cta_anchor?: string | null;  // AJOUTER
  cta_link?: string | null;     // AJOUTER
  wall?: string | null;         // AJOUTER (images H2/H3)
}

export interface BlogArticle {
  // ... existing fields
  cta_anchor?: string | null;   // AJOUTER
  cta_link?: string | null;     // AJOUTER
}
```

#### B. Charger les articles croisés (related articles)
```sql
SELECT BA_ID, BA_H1, BA_ALIAS, PG_NAME, PG_ALIAS
FROM __BLOG_ADVICE_CROSS
JOIN __BLOG_ADVICE ON BA_ID = BAC_BA_ID_CROSS
WHERE BAC_BA_ID = {current_ba_id}
AND BA_ID != {current_ba_id}
ORDER BY MC_SORT
```

#### C. Charger les véhicules compatibles
```sql
SELECT TYPE_ALIAS, TYPE_NAME, MODELE_NAME, MARQUE_NAME
FROM __CROSS_GAMME_CAR_NEW
JOIN AUTO_TYPE ON TYPE_ID = CGC_TYPE_ID
WHERE CGC_PG_ID = {pg_id}
AND CGC_LEVEL = 1
GROUP BY TYPE_MODELE_ID
```

---

### 2. 🔧 Moyenne priorité

#### D. Gestion des images avec fallback
```typescript
// Si ba_wall === "no.jpg"
// → Utiliser pieces_gamme.pg_img
const imageUrl = article.wall === 'no.jpg' 
  ? `/upload/articles/gammes-produits/catalogue/${gamme.pg_img}`
  : `/upload/blog/conseils/large/${article.wall}`;
```

#### E. Redirection spéciale pour pg_id=620
```typescript
// Dans getArticleByGamme()
if (gammeData.pg_id === 620) {
  // Rediriger vers emetteur-d-embrayage
}
```

#### F. Codes erreur HTTP appropriés
- 410 Gone: Gamme n'existe pas
- 412 Precondition Failed: Gamme désactivée (PG_DISPLAY=0)
- 404 Not Found: Article non trouvé

---

### 3. 📊 Basse priorité

#### G. SEO dynamique avancé
- Template variables (#Gamme#, #VMarque#, etc.)
- Content switching basé sur type_id
- Prix pas cher randomisé

#### H. Carousel véhicules
- Multi-carousel responsive
- Lazy loading images

---

## 📝 Plan d'action recommandé

### Phase 1: Fonctionnalités critiques (maintenant)
1. ✅ Ajouter CTA dans interface BlogArticle
2. ✅ Charger CTA depuis DB (ba_cta_anchor, ba_cta_link)
3. ✅ Charger CTA des sections H2/H3
4. ✅ Afficher boutons CTA dans frontend

### Phase 2: Articles liés (cette semaine)
1. Créer endpoint `/api/blog/article/:id/related`
2. Requête sur `__BLOG_ADVICE_CROSS`
3. Afficher sidebar "On vous propose"

### Phase 3: Véhicules compatibles (semaine prochaine)
1. Créer endpoint `/api/blog/article/:id/compatible-vehicles`
2. Requête sur `__CROSS_GAMME_CAR_NEW`
3. Afficher carousel véhicules

### Phase 4: Polish (plus tard)
1. Gestion images fallback
2. Codes erreur HTTP
3. SEO avancé

---

## 💡 Priorité immédiate

**Commençons par les CTA** car ils sont essentiels pour la conversion :

```typescript
// 1. Backend: Modifier transformAdviceToArticleWithSections()
const article = {
  // ... existing
  cta_anchor: advice.ba_cta_anchor || null,
  cta_link: advice.ba_cta_link || null,
};

// 2. Charger CTA des sections H2
sections.push({
  level: 2,
  title: h2.ba2_h2,
  content: h2.ba2_content,
  anchor: this.generateAnchor(h2.ba2_h2),
  cta_anchor: h2.ba2_cta_anchor || null,
  cta_link: h2.ba2_cta_link || null,
  wall: h2.ba2_wall || null,
});

// 3. Frontend: Afficher boutons CTA
{article.cta_link && (
  <a href={article.cta_link} target="_blank" className="cta-button">
    <ShoppingCart /> {article.cta_anchor || 'Acheter'}
  </a>
)}
```

Voulez-vous que je commence par implémenter les CTA ?
