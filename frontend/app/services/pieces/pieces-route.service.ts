/**
 * 🔄 Services API complémentaires pour la route pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 * 
 * ⚠️ IMPORTANT: Ce fichier complète pieces.service.ts existant
 * ⚠️ URLs API strictement préservées - NE PAS MODIFIER
 * 
 * 📝 CHANGELOG:
 * - 2025-12-11: Ajout fetchRelatedArticlesForGamme() pour vrais articles blog
 * - 2025-12-11: Amélioration fetchBlogArticle() avec priorité by-gamme
 */

import { type CrossSellingGamme, type BlogArticle, type GammeData, type VehicleData } from '../../types/pieces-route.types';
import { normalizeImageUrl } from '../../utils/image.utils';
import { slugify, generateRelatedArticles } from '../../utils/pieces-route.utils';

/**
 * 🔄 Récupération des gammes cross-selling depuis l'API réelle
 * 
 * ⚠️ URL API: http://localhost:3000/api/cross-selling/v5/{typeId}/{gammeId}
 * ⚠️ STRUCTURE URL PRÉSERVÉE - NE PAS MODIFIER
 */
export async function fetchCrossSellingGammes(
  typeId: number, 
  gammeId: number
): Promise<CrossSellingGamme[]> {
  try {
    console.log(`🔄 [CrossSelling] Fetching for type=${typeId}, gamme=${gammeId}`);
    
    // ⚠️ URL API EXACTE - NE PAS MODIFIER
    const response = await fetch(`http://localhost:3000/api/cross-selling/v5/${typeId}/${gammeId}`);
    
    if (!response.ok) {
      console.warn(`❌ Cross-selling API non disponible: ${response.status}`);
      
      // Fallback avec gammes de test pour démonstration
      return [
        { PG_ID: 403, PG_NAME: 'Disques de frein', PG_ALIAS: 'disques-de-frein', PG_IMAGE: 'pieces-403.webp' },
        { PG_ID: 402, PG_NAME: 'Plaquettes de frein', PG_ALIAS: 'plaquettes-de-frein', PG_IMAGE: 'pieces-402.webp' },
        { PG_ID: 85, PG_NAME: 'Amortisseurs', PG_ALIAS: 'amortisseurs', PG_IMAGE: 'pieces-85.webp' },
        { PG_ID: 90, PG_NAME: 'Courroies d\'accessoires', PG_ALIAS: 'courroie-d-accessoire', PG_IMAGE: 'pieces-90.webp' }
      ];
    }
    
    const data = await response.json();
    console.log(`✅ Cross-selling data:`, data);
    
    // ⚡ CORRECTION: L'API V5 retourne { data: { cross_gammes: [] } }
    const crossGammes = data?.data?.cross_gammes || data?.gammes || data?.cross_gammes || [];
    
    if (Array.isArray(crossGammes) && crossGammes.length > 0) {
      return crossGammes.map((gamme: any) => ({
        PG_ID: gamme.pg_id || gamme.PG_ID || gamme.id,
        PG_NAME: gamme.pg_name || gamme.PG_NAME || gamme.name,
        PG_ALIAS: gamme.pg_alias || gamme.PG_ALIAS || gamme.alias || slugify(gamme.pg_name || gamme.PG_NAME || gamme.name || ''),
        PG_IMAGE: gamme.pg_img || gamme.PG_IMAGE || gamme.PG_IMG || `pieces-${gamme.pg_id || gamme.PG_ID || gamme.id}.webp`
      }));
    }
    
    console.warn(`⚠️ Aucune gamme cross-selling trouvée dans la réponse API`);
    return [];
  } catch (error) {
    console.error('❌ Erreur fetchCrossSellingGammes:', error);
    return [];
  }
}

/**
 * 📝 Récupération d'un article de blog depuis l'API réelle
 * 
 * ⚠️ URLs API multiples pour fallback:
 * - /api/blog/article/by-gamme/{pg_alias} (PRIORITÉ - vrais articles)
 * - /api/blog/search?q={gamme}&limit=1
 * - /api/blog/popular?limit=1&category=entretien
 * - /api/blog/homepage
 * 
 * ⚠️ STRUCTURE URL PRÉSERVÉE - NE PAS MODIFIER
 */
export async function fetchBlogArticle(
  gamme: GammeData, 
  _vehicle: VehicleData
): Promise<BlogArticle | null> {
  try {
    // ⚠️ PRIORITÉ 1: Endpoint by-gamme (vrais articles depuis blog_advice)
    // 🚀 LCP OPTIMIZATION: Timeout 2s pour fail-fast
    console.log(`🔄 [Blog] Recherche article par gamme: ${gamme.alias}`);
    let response = await fetch(`http://localhost:3000/api/blog/article/by-gamme/${encodeURIComponent(gamme.alias)}`, {
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Blog by-gamme data:`, data);
      
      // L'endpoint retourne { success: true, data: {...} }
      const article = data.data || data.article || data;
      if (article && (article.h1 || article.title)) {
        return {
          id: article.id?.toString() || 'blog-gamme-' + Date.now(),
          title: article.h1 || article.title,
          excerpt: article.excerpt || article.description || '',
          slug: article.slug || '',
          image: normalizeImageUrl(article.featuredImage || article.image) || undefined,
          date: article.updatedAt || article.publishedAt || article.created_at || new Date().toISOString(),
          readTime: article.readingTime || article.reading_time || 5
        };
      }
    }
    
    // ⚠️ Essai 2: Recherche par gamme spécifique - URL EXACTE
    response = await fetch(`http://localhost:3000/api/blog/search?q=${encodeURIComponent(gamme.name)}&limit=1`, {
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Blog search data:`, data);
      
      // Validation robuste des données
      if (data && typeof data === 'object') {
        const articles = data.articles || data.data || data.results || [];
        if (Array.isArray(articles) && articles.length > 0) {
          const article = articles[0];
          if (article && article.title) {
            return {
              id: article.id || article.slug || 'blog-' + Date.now(),
              title: article.title,
              excerpt: article.excerpt || article.description || article.content?.substring(0, 200) || '',
              slug: article.slug || article.url || '',
              image: normalizeImageUrl(article.image || article.thumbnail || article.featured_image) || undefined,
              date: article.created_at || article.date || article.published_at || new Date().toISOString(),
              readTime: article.reading_time || article.read_time || 5
            };
          }
        }
      }
    }

    // ⚠️ Essai 2: Article populaire général auto - URL EXACTE
    response = await fetch(`http://localhost:3000/api/blog/popular?limit=1&category=entretien`, {
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Blog popular data:`, data);
      
      if (data && typeof data === 'object') {
        const articles = data.articles || data.data || data.results || [];
        if (Array.isArray(articles) && articles.length > 0) {
          const article = articles[0];
          if (article && article.title) {
            return {
              id: article.id || article.slug || 'blog-popular-' + Date.now(),
              title: article.title,
              excerpt: article.excerpt || article.description || article.content?.substring(0, 200) || '',
              slug: article.slug || article.url || '',
              image: normalizeImageUrl(article.image || article.thumbnail || article.featured_image) || undefined,
              date: article.created_at || article.date || article.published_at || new Date().toISOString(),
              readTime: article.reading_time || article.read_time || 5
            };
          }
        }
      }
    }

    // ⚠️ Essai 3: Endpoint blog homepage - URL EXACTE
    response = await fetch(`http://localhost:3000/api/blog/homepage`, {
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Blog homepage data:`, data);
      
      if (data && typeof data === 'object') {
        const articles = data.recentArticles || data.articles || data.data || [];
        if (Array.isArray(articles) && articles.length > 0) {
          const article = articles[0];
          if (article && article.title) {
            return {
              id: article.id || article.slug || 'blog-homepage-' + Date.now(),
              title: article.title,
              excerpt: article.excerpt || article.description || article.content?.substring(0, 200) || '',
              slug: article.slug || article.url || '',
              image: normalizeImageUrl(article.image || article.thumbnail || article.featured_image) || undefined,
              date: article.created_at || article.date || article.published_at || new Date().toISOString(),
              readTime: article.reading_time || article.read_time || 5
            };
          }
        }
      }
    }

    // Fallback: article générique
    console.log(`🔄 Fallback blog article générique`);
    return {
      id: 'blog-fallback-' + gamme.id,
      title: `Guide d'entretien pour ${gamme.name}`,
      excerpt: `Découvrez nos conseils d'experts pour l'entretien et le remplacement de vos ${gamme.name.toLowerCase()}. Qualité, compatibilité et prix : tous nos secrets pour un entretien réussi.`,
      slug: 'guide-entretien-' + gamme.alias,
      image: undefined,
      date: new Date().toISOString(),
      readTime: 5
    };
    
  } catch (error) {
    console.error('❌ Erreur fetchBlogArticle:', error);
    return null;
  }
}

/**
 * 📚 Récupération des articles liés depuis l'API réelle par gamme
 * 
 * Cette fonction remplace generateRelatedArticles() qui générait des slugs fictifs.
 * Elle appelle l'endpoint /api/blog/article/by-gamme/:pg_alias qui retourne:
 * - L'article principal de la gamme
 * - Les articles liés (relatedArticles) depuis la table blog_advice
 * 
 * @param gamme - Données de la gamme (id, alias, name)
 * @param vehicle - Données du véhicule pour le fallback
 * @returns BlogArticle[] - Liste d'articles réels ou fallback statique
 */
export async function fetchRelatedArticlesForGamme(
  gamme: GammeData, 
  vehicle: VehicleData
): Promise<BlogArticle[]> {
  try {
    console.log(`📚 [RelatedArticles] Fetching for gamme: ${gamme.alias}`);
    
    // Appel à l'endpoint by-gamme qui retourne { success: true, data: {...} }
    // 🚀 LCP OPTIMIZATION: Timeout 2s pour fail-fast
    const response = await fetch(`http://localhost:3000/api/blog/article/by-gamme/${encodeURIComponent(gamme.alias)}`, {
      signal: AbortSignal.timeout(2000),
    });
    
    if (!response.ok) {
      console.warn(`⚠️ [RelatedArticles] API non disponible: ${response.status}`);
      // Fallback vers articles statiques
      return generateRelatedArticles(vehicle, gamme);
    }
    
    const responseData = await response.json();
    console.log(`✅ [RelatedArticles] API response:`, {
      success: responseData.success,
      hasData: !!responseData.data
    });
    
    // Structure: { success: true, data: { id, title, slug, h1, excerpt, relatedArticles?, ... } }
    const articleData = responseData.data;
    
    if (!articleData || !articleData.slug) {
      console.log(`🔄 [RelatedArticles] No valid article data, using fallback`);
      return generateRelatedArticles(vehicle, gamme);
    }
    
    const articles: BlogArticle[] = [];
    
    // 1. Ajouter l'article principal
    articles.push({
      id: articleData.id?.toString() || 'main-' + gamme.id,
      title: articleData.h1 || articleData.title || `Guide ${gamme.name}`,
      excerpt: articleData.excerpt || `Découvrez notre guide complet sur les ${gamme.name.toLowerCase()}.`,
      slug: articleData.slug,
      image: normalizeImageUrl(articleData.featuredImage) || undefined,
      date: articleData.updatedAt || articleData.publishedAt || new Date().toISOString(),
      readTime: articleData.readingTime || 8
    });
    
    // 2. Ajouter les articles liés (related) s'ils existent
    const relatedArticles = articleData.relatedArticles || [];
    if (Array.isArray(relatedArticles)) {
      for (const related of relatedArticles.slice(0, 3)) { // Max 3 articles liés
        if (related && related.slug) {
          articles.push({
            id: related.id?.toString() || 'related-' + Date.now(),
            title: related.h1 || related.title,
            excerpt: related.excerpt || '',
            slug: related.slug,
            image: normalizeImageUrl(related.featuredImage) || undefined,
            date: related.updatedAt || related.publishedAt || new Date().toISOString(),
            readTime: related.readingTime || 5
          });
        }
      }
    }
    
    console.log(`✅ [RelatedArticles] Returning ${articles.length} real articles`);
    return articles;
    
  } catch (error) {
    console.error('❌ Erreur fetchRelatedArticlesForGamme:', error);
    // Fallback vers articles statiques en cas d'erreur
    return generateRelatedArticles(vehicle, gamme);
  }
}

/**
 * 🔄 Ré-export du service principal pour cohérence
 */
export { PiecesService } from './pieces.service';
