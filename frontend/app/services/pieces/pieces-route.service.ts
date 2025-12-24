/**
 * 🔄 Services API complémentaires pour la route pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 *
 * ⚠️ IMPORTANT: Ce fichier complète pieces.service.ts existant
 * ⚠️ URLs API strictement préservées - NE PAS MODIFIER
 *
 * 📝 CHANGELOG:
 * - 2025-12-24: Refactoring avec fetchFromEndpointChain() générique
 * - 2025-12-11: Ajout fetchRelatedArticlesForGamme() pour vrais articles blog
 * - 2025-12-11: Amélioration fetchBlogArticle() avec priorité by-gamme
 */

import { type CrossSellingGamme, type BlogArticle, type GammeData, type VehicleData } from '../../types/pieces-route.types';
import { normalizeImageUrl } from '../../utils/image.utils';
import { slugify, generateRelatedArticles } from '../../utils/pieces-route.utils';

/**
 * 🔗 Utilitaire générique pour fetch en cascade avec fallback
 * Essaie chaque endpoint jusqu'à obtenir une réponse valide
 *
 * @param endpoints - Liste d'URLs à essayer dans l'ordre
 * @param parser - Fonction pour extraire/valider les données de la réponse
 * @param options - { timeout: ms, fallback: valeur par défaut }
 */
async function fetchFromEndpointChain<T>(
  endpoints: string[],
  parser: (data: unknown) => T | null,
  options?: { timeout?: number; fallback?: T }
): Promise<T | null> {
  const timeout = options?.timeout ?? 2000;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(timeout),
      });

      if (response.ok) {
        const data = await response.json();
        const result = parser(data);
        if (result !== null) {
          return result;
        }
      }
    } catch {
      // Continuer vers le prochain endpoint
    }
  }

  return options?.fallback ?? null;
}

/**
 * 🎯 Parser pour extraire un article de blog depuis diverses structures API
 */
function parseBlogArticleResponse(data: unknown): BlogArticle | null {
  if (!data || typeof data !== 'object') return null;

  const d = data as Record<string, unknown>;

  // Structure directe: { id, title, ... } ou { data: { id, title, ... } }
  const article = (d.data as Record<string, unknown>) || d.article || d;

  // Vérifier si c'est un tableau d'articles
  const articles = (d.articles || d.data || d.results || d.recentArticles) as unknown[];
  if (Array.isArray(articles) && articles.length > 0) {
    const firstArticle = articles[0] as Record<string, unknown>;
    if (firstArticle?.title) {
      return {
        id: String(firstArticle.id || firstArticle.slug || 'blog-' + Date.now()),
        title: String(firstArticle.title),
        excerpt: String(firstArticle.excerpt || firstArticle.description || (firstArticle.content as string)?.substring(0, 200) || ''),
        slug: String(firstArticle.slug || firstArticle.url || ''),
        image: normalizeImageUrl(String(firstArticle.image || firstArticle.thumbnail || firstArticle.featured_image || '')) || undefined,
        date: String(firstArticle.created_at || firstArticle.date || firstArticle.published_at || new Date().toISOString()),
        readTime: Number(firstArticle.reading_time || firstArticle.read_time || 5)
      };
    }
  }

  // Structure article unique
  const a = article as Record<string, unknown>;
  if (a && (a.h1 || a.title)) {
    return {
      id: String(a.id || 'blog-gamme-' + Date.now()),
      title: String(a.h1 || a.title),
      excerpt: String(a.excerpt || a.description || ''),
      slug: String(a.slug || ''),
      image: normalizeImageUrl(String(a.featuredImage || a.image || '')) || undefined,
      date: String(a.updatedAt || a.publishedAt || a.created_at || new Date().toISOString()),
      readTime: Number(a.readingTime || a.reading_time || 5)
    };
  }

  return null;
}

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
 * ⚠️ URLs API multiples pour fallback (ordre de priorité):
 * 1. /api/blog/article/by-gamme/{pg_alias} (vrais articles)
 * 2. /api/blog/search?q={gamme}&limit=1
 * 3. /api/blog/popular?limit=1&category=entretien
 * 4. /api/blog/homepage
 *
 * ⚠️ STRUCTURE URL PRÉSERVÉE - NE PAS MODIFIER
 */
export async function fetchBlogArticle(
  gamme: GammeData,
  _vehicle: VehicleData
): Promise<BlogArticle | null> {
  console.log(`🔄 [Blog] Recherche article par gamme: ${gamme.alias}`);

  // ⚠️ URLs API EXACTES - NE PAS MODIFIER
  const endpoints = [
    `http://localhost:3000/api/blog/article/by-gamme/${encodeURIComponent(gamme.alias)}`,
    `http://localhost:3000/api/blog/search?q=${encodeURIComponent(gamme.name)}&limit=1`,
    `http://localhost:3000/api/blog/popular?limit=1&category=entretien`,
    `http://localhost:3000/api/blog/homepage`,
  ];

  const fallback: BlogArticle = {
    id: 'blog-fallback-' + gamme.id,
    title: `Guide d'entretien pour ${gamme.name}`,
    excerpt: `Découvrez nos conseils d'experts pour l'entretien et le remplacement de vos ${gamme.name.toLowerCase()}. Qualité, compatibilité et prix : tous nos secrets pour un entretien réussi.`,
    slug: 'guide-entretien-' + gamme.alias,
    image: undefined,
    date: new Date().toISOString(),
    readTime: 5
  };

  return fetchFromEndpointChain<BlogArticle>(
    endpoints,
    parseBlogArticleResponse,
    { timeout: 2000, fallback }
  );
}

/**
 * 📚 Récupération des articles liés depuis l'API réelle par gamme
 *
 * Appelle /api/blog/article/by-gamme/:pg_alias qui retourne:
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
  console.log(`📚 [RelatedArticles] Fetching for gamme: ${gamme.alias}`);

  // Parser spécialisé pour extraire article principal + articles liés
  const parseRelatedArticles = (data: unknown): BlogArticle[] | null => {
    if (!data || typeof data !== 'object') return null;

    const d = data as Record<string, unknown>;
    const articleData = d.data as Record<string, unknown>;

    if (!articleData?.slug) return null;

    const articles: BlogArticle[] = [];

    // 1. Article principal
    articles.push({
      id: String(articleData.id || 'main-' + gamme.id),
      title: String(articleData.h1 || articleData.title || `Guide ${gamme.name}`),
      excerpt: String(articleData.excerpt || `Découvrez notre guide complet sur les ${gamme.name.toLowerCase()}.`),
      slug: String(articleData.slug),
      image: normalizeImageUrl(String(articleData.featuredImage || '')) || undefined,
      date: String(articleData.updatedAt || articleData.publishedAt || new Date().toISOString()),
      readTime: Number(articleData.readingTime || 8)
    });

    // 2. Articles liés (max 3)
    const relatedArticles = articleData.relatedArticles as Record<string, unknown>[];
    if (Array.isArray(relatedArticles)) {
      for (const related of relatedArticles.slice(0, 3)) {
        if (related?.slug) {
          articles.push({
            id: String(related.id || 'related-' + Date.now()),
            title: String(related.h1 || related.title),
            excerpt: String(related.excerpt || ''),
            slug: String(related.slug),
            image: normalizeImageUrl(String(related.featuredImage || '')) || undefined,
            date: String(related.updatedAt || related.publishedAt || new Date().toISOString()),
            readTime: Number(related.readingTime || 5)
          });
        }
      }
    }

    return articles.length > 0 ? articles : null;
  };

  const result = await fetchFromEndpointChain<BlogArticle[]>(
    [`http://localhost:3000/api/blog/article/by-gamme/${encodeURIComponent(gamme.alias)}`],
    parseRelatedArticles,
    { timeout: 2000 }
  );

  return result ?? generateRelatedArticles(vehicle, gamme);
}

/**
 * 🔄 Ré-export du service principal pour cohérence
 */
export { PiecesService } from './pieces.service';
