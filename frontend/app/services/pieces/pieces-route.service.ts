/**
 * 🔄 Services API complémentaires pour la route pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 * 
 * ⚠️ IMPORTANT: Ce fichier complète pieces.service.ts existant
 * ⚠️ URLs API strictement préservées - NE PAS MODIFIER
 */

import { type CrossSellingGamme, type BlogArticle, type GammeData, type VehicleData } from '../../types/pieces-route.types';
import { slugify } from '../../utils/pieces-route.utils';

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
    
    // Transformation des données API vers le format attendu
    if (data && Array.isArray(data.gammes)) {
      return data.gammes.map((gamme: any) => ({
        PG_ID: gamme.PG_ID || gamme.id,
        PG_NAME: gamme.PG_NAME || gamme.name,
        PG_ALIAS: gamme.PG_ALIAS || gamme.alias || slugify(gamme.PG_NAME || gamme.name || ''),
        PG_IMAGE: gamme.PG_IMAGE || `pieces-${gamme.PG_ID || gamme.id}.webp`
      }));
    }
    
    // Si structure différente, essayer d'adapter
    if (data && typeof data === 'object' && !Array.isArray(data.gammes)) {
      console.log(`🔄 Adaptation structure cross-selling`);
      return Object.values(data).filter((item: any) => item && item.PG_ID).map((gamme: any) => ({
        PG_ID: gamme.PG_ID || gamme.id,
        PG_NAME: gamme.PG_NAME || gamme.name,
        PG_ALIAS: gamme.PG_ALIAS || gamme.alias || slugify(gamme.PG_NAME || gamme.name || ''),
        PG_IMAGE: gamme.PG_IMAGE || `pieces-${gamme.PG_ID || gamme.id}.webp`
      }));
    }
    
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
    // ⚠️ Essai 1: Recherche par gamme spécifique - URL EXACTE
    let response = await fetch(`http://localhost:3000/api/blog/search?q=${encodeURIComponent(gamme.name)}&limit=1`);
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
              image: article.image || article.thumbnail || article.featured_image || undefined,
              date: article.created_at || article.date || article.published_at || new Date().toISOString(),
              readTime: article.reading_time || article.read_time || 5
            };
          }
        }
      }
    }

    // ⚠️ Essai 2: Article populaire général auto - URL EXACTE
    response = await fetch(`http://localhost:3000/api/blog/popular?limit=1&category=entretien`);
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
              image: article.image || article.thumbnail || article.featured_image || undefined,
              date: article.created_at || article.date || article.published_at || new Date().toISOString(),
              readTime: article.reading_time || article.read_time || 5
            };
          }
        }
      }
    }
    
    // ⚠️ Essai 3: Endpoint blog homepage - URL EXACTE
    response = await fetch(`http://localhost:3000/api/blog/homepage`);
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
              image: article.image || article.thumbnail || article.featured_image || undefined,
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
 * 🔄 Ré-export du service principal pour cohérence
 */
export { PiecesService } from './pieces.service';
