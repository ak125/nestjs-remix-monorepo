import { Injectable, Logger } from '@nestjs/common';
import {
  BlogArticle,
  BlogSection,
  BaRow,
  BaH2Row,
  BaH3Row,
  BgRow,
} from '../interfaces/blog.interfaces';
import { BlogCacheService } from './blog-cache.service';
import {
  buildProxyImageUrl,
  IMAGE_CONFIG,
} from '../../catalog/utils/image-urls.utils';
import { normalizeAlias } from '../../../common/utils/url-builder.utils';

/**
 * 🔄 BlogArticleTransformService - Transformations et mappings d'articles
 *
 * Responsabilité unique : Transformer les données brutes de la DB en BlogArticle
 * - Fonctions pures sans effets de bord
 * - Décodage HTML des entités
 * - Construction d'URLs d'images
 * - Génération d'ancres et slugs
 * - Calcul du temps de lecture
 *
 * Extrait de BlogService pour réduire la complexité (SRP)
 */
@Injectable()
export class BlogArticleTransformService {
  private readonly logger = new Logger(BlogArticleTransformService.name);

  /**
   * 🔄 Transformation advice → BlogArticle (version simple sans sections)
   * Utilisé pour les listes d'articles où les sections ne sont pas nécessaires
   */
  transformAdviceToArticle(advice: BaRow): BlogArticle {
    const article: BlogArticle = {
      id: `advice_${advice.ba_id}`,
      type: 'advice',
      title: BlogCacheService.decodeHtmlEntities(advice.ba_title || ''),
      slug: advice.ba_alias,
      pg_alias: null, // Sera enrichi par enrichWithPgAlias()
      excerpt: BlogCacheService.decodeHtmlEntities(
        advice.ba_preview || advice.ba_descrip || '',
      ),
      content: BlogCacheService.decodeHtmlEntities(advice.ba_content || ''),
      h1: BlogCacheService.decodeHtmlEntities(advice.ba_h1 || ''),
      h2: BlogCacheService.decodeHtmlEntities(advice.ba_h2 || ''),
      keywords: advice.ba_keywords ? advice.ba_keywords.split(', ') : [],
      tags: advice.ba_keywords ? advice.ba_keywords.split(', ') : [],
      publishedAt: advice.ba_create,
      updatedAt: advice.ba_update,
      viewsCount: parseInt(advice.ba_visit) || 0,
      featuredImage: null, // pg_alias pas disponible ici, sera enrichi après
      sections: [], // Pas de sections pour les listes
      legacy_id: advice.ba_id,
      legacy_table: '__blog_advice',
      seo_data: {
        meta_title: BlogCacheService.decodeHtmlEntities(advice.ba_title || ''),
        meta_description: BlogCacheService.decodeHtmlEntities(
          advice.ba_descrip || '',
        ),
      },
      ba_pg_id: advice.ba_pg_id, // Garder temporairement pour enrichWithPgAlias()
    };

    return article;
  }

  /**
   * 🔄 Transformation advice → BlogArticle AVEC sections H2/H3
   * Les sections sont passées en paramètre (déjà chargées par BlogArticleDataService)
   */
  transformAdviceToArticleWithSections(
    advice: BaRow,
    h2Sections: BaH2Row[],
    h3Sections: BaH3Row[],
  ): BlogArticle {
    // Construire les sections avec structure hiérarchique
    const sections: BlogSection[] = [];

    // Traiter chaque H2
    h2Sections?.forEach((h2) => {
      sections.push({
        level: 2,
        title: BlogCacheService.decodeHtmlEntities(h2.ba2_h2 || ''),
        content: BlogCacheService.decodeHtmlEntities(h2.ba2_content || ''),
        anchor: this.generateAnchor(h2.ba2_h2),
        cta_anchor: h2.ba2_cta_anchor || null,
        cta_link: h2.ba2_cta_link || null,
        wall: h2.ba2_wall || null,
      });

      // Ajouter les H3 qui appartiennent à ce H2
      h3Sections?.forEach((h3) => {
        if (h3.ba3_ba2_id === h2.ba2_id) {
          sections.push({
            level: 3,
            title: BlogCacheService.decodeHtmlEntities(h3.ba3_h3 || ''),
            content: BlogCacheService.decodeHtmlEntities(h3.ba3_content || ''),
            anchor: this.generateAnchor(h3.ba3_h3),
            cta_anchor: h3.ba3_cta_anchor || null,
            cta_link: h3.ba3_cta_link || null,
            wall: h3.ba3_wall || null,
          });
        }
      });
    });

    return {
      id: `advice_${advice.ba_id}`,
      type: 'advice',
      title: BlogCacheService.decodeHtmlEntities(advice.ba_title || ''),
      slug: advice.ba_alias,
      pg_alias: null, // Sera enrichi par enrichWithPgAlias() si besoin
      excerpt: BlogCacheService.decodeHtmlEntities(
        advice.ba_preview || advice.ba_descrip || '',
      ),
      content: BlogCacheService.decodeHtmlEntities(advice.ba_content || ''),
      h1: BlogCacheService.decodeHtmlEntities(advice.ba_h1 || ''),
      h2: BlogCacheService.decodeHtmlEntities(advice.ba_h2 || ''),
      keywords: advice.ba_keywords ? advice.ba_keywords.split(', ') : [],
      tags: advice.ba_keywords ? advice.ba_keywords.split(', ') : [],
      publishedAt: advice.ba_create,
      updatedAt: advice.ba_update,
      viewsCount: parseInt(advice.ba_visit) || 0,
      featuredImage: advice.pg_alias
        ? this.buildImageUrl(
            `${advice.pg_alias}.webp`,
            'articles/gammes-produits/catalogue',
          )
        : null,
      sections,
      legacy_id: advice.ba_id,
      legacy_table: '__blog_advice',
      cta_anchor: advice.ba_cta_anchor || null,
      cta_link: advice.ba_cta_link || null,
      seo_data: {
        meta_title: BlogCacheService.decodeHtmlEntities(advice.ba_title || ''),
        meta_description: BlogCacheService.decodeHtmlEntities(
          advice.ba_descrip || '',
        ),
      },
    };
  }

  /**
   * 🔄 Transformation guide → BlogArticle
   */
  transformGuideToArticle(guide: BgRow): BlogArticle {
    return {
      id: `guide_${guide.bg_id}`,
      type: 'guide',
      title: BlogCacheService.decodeHtmlEntities(guide.bg_title || ''),
      slug: guide.bg_alias,
      excerpt: BlogCacheService.decodeHtmlEntities(
        guide.bg_preview || guide.bg_descrip || '',
      ),
      content: BlogCacheService.decodeHtmlEntities(guide.bg_content || ''),
      h1: BlogCacheService.decodeHtmlEntities(guide.bg_h1 || ''),
      h2: BlogCacheService.decodeHtmlEntities(guide.bg_h2 || ''),
      keywords: guide.bg_keywords ? guide.bg_keywords.split(', ') : [],
      tags: guide.bg_keywords ? guide.bg_keywords.split(', ') : [],
      publishedAt: guide.bg_create,
      featuredImage: null, // Les guides n'ont pas de gamme, pas d'image featured
      updatedAt: guide.bg_update,
      viewsCount: parseInt(guide.bg_visit) || 0,
      sections: [],
      legacy_id: guide.bg_id,
      legacy_table: '__blog_guide',
      seo_data: {
        meta_title: BlogCacheService.decodeHtmlEntities(
          guide.bg_meta_title || '',
        ),
        meta_description: BlogCacheService.decodeHtmlEntities(
          guide.bg_meta_description || '',
        ),
        keywords: guide.bg_keywords ? guide.bg_keywords.split(', ') : [],
      },
    };
  }

  /**
   * 📝 Extraction des sections depuis le contenu brut
   */
  extractSectionsFromContent(data: BaH2Row | BaH3Row): BlogSection[] {
    const sections: BlogSection[] = [];

    // Section H2
    const h2 = data as BaH2Row;
    if (h2.ba2_h2 && h2.ba2_content) {
      sections.push({
        level: 2,
        title: BlogCacheService.decodeHtmlEntities(h2.ba2_h2),
        content: BlogCacheService.decodeHtmlEntities(h2.ba2_content),
        anchor: this.generateAnchor(h2.ba2_h2),
      });
    }

    // Section H3
    const h3 = data as BaH3Row;
    if (h3.ba3_h3 && h3.ba3_content) {
      sections.push({
        level: 3,
        title: BlogCacheService.decodeHtmlEntities(h3.ba3_h3),
        content: BlogCacheService.decodeHtmlEntities(h3.ba3_content),
        anchor: this.generateAnchor(h3.ba3_h3),
      });
    }

    return sections;
  }

  /**
   * 🖼️ Construire l'URL CDN complète pour une image
   * Utilise les fonctions centralisées de image-urls.utils.ts
   */
  buildImageUrl(
    filename: string | null,
    folder: string,
    marqueAlias?: string,
  ): string | null {
    if (!filename) {
      return null;
    }

    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename;
    }

    // Utiliser les fonctions centralisées pour construire l'URL
    // Si marqueAlias fourni, utiliser structure marques-modeles/{marque}/{modele}.webp
    const path = marqueAlias
      ? `constructeurs-automobiles/marques-modeles/${marqueAlias}/${filename}`
      : `${folder}/${filename}`;

    return buildProxyImageUrl(IMAGE_CONFIG.BUCKETS.UPLOADS, path);
  }

  /**
   * ⏱️ Calculer le temps de lecture d'un contenu
   * @param content - Contenu HTML ou texte
   * @returns Temps de lecture en minutes (minimum 1)
   */
  calculateReadingTime(content: unknown): number {
    if (!content) return 1;

    const text =
      typeof content === 'string' ? content : JSON.stringify(content);
    const cleanText = BlogCacheService.decodeHtmlEntities(text).replace(
      /<[^>]*>/g,
      '',
    );
    const wordsPerMinute = 200;
    const words = cleanText
      .split(/\s+/)
      .filter((word: string) => word.length > 0).length;
    return Math.max(1, Math.ceil(words / wordsPerMinute));
  }

  /**
   * 🧹 Nettoyer et décoder le contenu HTML
   */
  cleanAndDecodeContent(content: unknown): string {
    if (!content) return '';

    const text =
      typeof content === 'string' ? content : JSON.stringify(content);
    return BlogCacheService.decodeHtmlEntities(text);
  }

  /**
   * 🔗 Génération d'ancre pour navigation
   * Transforme un titre en identifiant URL-safe
   */
  generateAnchor(title: string): string {
    if (!title) return '';

    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * 🔄 Génère les variantes de slug à essayer
   * Pour la compatibilité avec les URLs legacy
   * - Slug original
   * - Slug normalisé (espaces → tirets)
   * - Slug dé-normalisé (tirets → espaces) pour compatibilité BDD legacy
   */
  generateSlugVariants(slug: string): string[] {
    const variants = new Set<string>();

    // 1. Slug original (décodé de l'URL)
    const decodedSlug = decodeURIComponent(slug);
    variants.add(decodedSlug);

    // 2. Slug normalisé (espaces → tirets, minuscules, sans accents)
    const normalized = normalizeAlias(decodedSlug);
    if (normalized && normalized !== decodedSlug) {
      variants.add(normalized);
    }

    // 3. Slug avec espaces restaurés (tirets → espaces) pour BDD legacy
    const withSpaces = decodedSlug.replace(/-/g, ' ');
    if (withSpaces !== decodedSlug) {
      variants.add(withSpaces);
    }

    // 4. Version lowercase simple
    const lowercase = decodedSlug.toLowerCase();
    if (lowercase !== decodedSlug) {
      variants.add(lowercase);
    }

    return Array.from(variants);
  }

  /**
   * 🔗 Génère un slug à partir d'un titre
   * Utilisé pour la création de nouveaux articles
   */
  generateSlugFromTitle(title: string): string {
    return BlogCacheService.decodeHtmlEntities(title)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
