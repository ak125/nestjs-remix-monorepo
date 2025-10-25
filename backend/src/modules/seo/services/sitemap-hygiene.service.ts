import { Injectable, Logger } from '@nestjs/common';
import {
  UrlValidationResult,
  UrlNormalizationConfig,
  PageModificationMetadata,
  ProductAvailability,
  EXCLUDED_PARAMETERS,
  EXCLUDED_URL_PATTERNS,
  CONTENT_THRESHOLDS,
} from '../interfaces/sitemap-hygiene.interface';

/**
 * Service de validation et d'hygiène des URLs pour les sitemaps
 * Implémente les règles strictes de sélection SEO
 */
@Injectable()
export class SitemapHygieneService {
  private readonly logger = new Logger(SitemapHygieneService.name);

  /**
   * Normalise une URL selon les règles configurées
   */
  normalizeUrl(
    url: string,
    config: UrlNormalizationConfig = this.getDefaultNormalizationConfig(),
  ): string {
    let normalized = url;

    try {
      const urlObj = new URL(url);

      // 1. Supprimer www si configuré
      if (config.removeWww) {
        urlObj.hostname = urlObj.hostname.replace(/^www\./, '');
      }

      // 2. Convertir en minuscules si configuré
      if (config.toLowerCase) {
        urlObj.pathname = urlObj.pathname.toLowerCase();
      }

      // 3. Normaliser le trailing slash
      if (config.normalizeTrailingSlash) {
        // Ajouter trailing slash sauf pour les fichiers (.html, .xml, etc.)
        if (
          !urlObj.pathname.endsWith('/') &&
          !urlObj.pathname.match(/\.[a-z0-9]+$/i)
        ) {
          urlObj.pathname += '/';
        }
      }

      // 4. Supprimer les paramètres exclus
      if (config.removeParameters.length > 0) {
        config.removeParameters.forEach((param) => {
          urlObj.searchParams.delete(param);
        });
      }

      // 5. Trier les paramètres de query string
      if (config.sortQueryParameters) {
        const params = Array.from(urlObj.searchParams.entries()).sort((a, b) =>
          a[0].localeCompare(b[0]),
        );
        urlObj.search = '';
        params.forEach(([key, value]) => {
          urlObj.searchParams.append(key, value);
        });
      }

      normalized = urlObj.toString();
    } catch (error) {
      this.logger.warn(`Failed to normalize URL: ${url}`, error);
      normalized = url;
    }

    return normalized;
  }

  /**
   * Vérifie si une URL doit être exclue
   */
  shouldExcludeUrl(url: string): { exclude: boolean; reasons: string[] } {
    const reasons: string[] = [];

    try {
      const urlObj = new URL(url);

      // 1. Vérifier les patterns d'exclusion
      for (const pattern of EXCLUDED_URL_PATTERNS) {
        if (pattern.test(url)) {
          reasons.push(`Matches excluded pattern: ${pattern.source}`);
        }
      }

      // 2. Vérifier les paramètres UTM
      const hasUtm = Array.from(urlObj.searchParams.keys()).some((key) =>
        key.startsWith('utm_'),
      );
      if (hasUtm) {
        reasons.push('Contains UTM parameters');
      }

      // 3. Vérifier les paramètres de session
      const sessionParams = ['sessionid', 'sid', 'jsessionid', 'phpsessid'];
      const hasSession = Array.from(urlObj.searchParams.keys()).some((key) =>
        sessionParams.includes(key.toLowerCase()),
      );
      if (hasSession) {
        reasons.push('Contains session parameters');
      }

      // 4. Vérifier les paramètres de filtres/facettes
      const filterParams = ['filter', 'facet', 'sort', 'order'];
      const hasFilter = Array.from(urlObj.searchParams.keys()).some((key) =>
        filterParams.includes(key.toLowerCase()),
      );
      if (hasFilter) {
        reasons.push('Contains filter/facet parameters');
      }

      // 5. Vérifier les fragments (#)
      if (urlObj.hash && urlObj.hash.length > 1) {
        reasons.push('Contains fragment identifier');
      }
    } catch {
      this.logger.warn(`Failed to parse URL for exclusion check: ${url}`);
      reasons.push('Invalid URL format');
    }

    return {
      exclude: reasons.length > 0,
      reasons,
    };
  }

  /**
   * Calcule la date de dernière modification réelle
   * Prend la plus récente parmi toutes les dates de modification
   */
  calculateRealLastModified(metadata: PageModificationMetadata): Date {
    const dates: Date[] = [];

    if (metadata.contentLastModified)
      dates.push(new Date(metadata.contentLastModified));
    if (metadata.stockLastModified)
      dates.push(new Date(metadata.stockLastModified));
    if (metadata.priceLastModified)
      dates.push(new Date(metadata.priceLastModified));
    if (metadata.technicalSheetLastModified)
      dates.push(new Date(metadata.technicalSheetLastModified));
    if (metadata.seoBlockLastModified)
      dates.push(new Date(metadata.seoBlockLastModified));
    if (metadata.createdAt) dates.push(new Date(metadata.createdAt));

    // Retourner la date la plus récente, ou la date actuelle si aucune date
    if (dates.length === 0) {
      this.logger.warn(
        'No modification dates found, using current date (NOT RECOMMENDED)',
      );
      return new Date();
    }

    return new Date(Math.max(...dates.map((d) => d.getTime())));
  }

  /**
   * Détermine si un produit hors stock doit être inclus
   */
  shouldIncludeOutOfStockProduct(
    availability: ProductAvailability,
    hasStrongInternalLinks: boolean = false,
    hasInformativeContent: boolean = false,
  ): { include: boolean; reason: string } {
    switch (availability) {
      case ProductAvailability.IN_STOCK:
        return { include: true, reason: 'Product in stock' };

      case ProductAvailability.PERENNIAL:
        // Produit pérenne : toujours inclure si contenu informatif
        if (hasInformativeContent) {
          return {
            include: true,
            reason: 'Perennial product with informative content',
          };
        }
        return {
          include: false,
          reason: 'Perennial product without sufficient content',
        };

      case ProductAvailability.OUT_OF_STOCK_TEMPORARY:
        // Rupture temporaire : inclure si liens internes forts OU contenu informatif
        if (hasStrongInternalLinks || hasInformativeContent) {
          return {
            include: true,
            reason: 'Temporary out of stock with strong signals',
          };
        }
        return {
          include: false,
          reason: 'Temporary out of stock without strong signals',
        };

      case ProductAvailability.OUT_OF_STOCK_OBSOLETE:
        // Produit obsolète : JAMAIS inclure
        // Le site doit retourner 410 Gone
        return {
          include: false,
          reason: 'Obsolete product (should return 410 Gone)',
        };

      default:
        return { include: false, reason: 'Unknown availability status' };
    }
  }

  /**
   * Valide une URL complète pour inclusion dans le sitemap
   */
  validateUrl(
    url: string,
    options: {
      statusCode?: number;
      isIndexable?: boolean;
      isCanonical?: boolean;
      hasSufficientContent?: boolean;
      productAvailability?: ProductAvailability;
      hasStrongInternalLinks?: boolean;
      hasInformativeContent?: boolean;
      modificationMetadata?: PageModificationMetadata;
    } = {},
  ): UrlValidationResult {
    const exclusionReasons: string[] = [];
    let isValid = true;

    // 1. Vérifier le status code (doit être 200)
    if (options.statusCode && options.statusCode !== 200) {
      exclusionReasons.push(`Invalid status code: ${options.statusCode}`);
      isValid = false;
    }

    // 2. Vérifier si indexable (pas de noindex)
    if (options.isIndexable === false) {
      exclusionReasons.push('Page has noindex tag');
      isValid = false;
    }

    // 3. Vérifier si URL canonique
    if (options.isCanonical === false) {
      exclusionReasons.push('Not the canonical URL');
      isValid = false;
    }

    // 4. Vérifier le contenu suffisant
    if (options.hasSufficientContent === false) {
      exclusionReasons.push('Insufficient content');
      isValid = false;
    }

    // 5. Vérifier les patterns d'exclusion
    const exclusionCheck = this.shouldExcludeUrl(url);
    if (exclusionCheck.exclude) {
      exclusionReasons.push(...exclusionCheck.reasons);
      isValid = false;
    }

    // 6. Vérifier la disponibilité du produit (si applicable)
    if (options.productAvailability) {
      const stockCheck = this.shouldIncludeOutOfStockProduct(
        options.productAvailability,
        options.hasStrongInternalLinks,
        options.hasInformativeContent,
      );
      if (!stockCheck.include) {
        exclusionReasons.push(stockCheck.reason);
        isValid = false;
      }
    }

    // 7. Normaliser l'URL
    const normalizedUrl = this.normalizeUrl(url);

    // 8. Calculer la date de dernière modification
    const lastModified = options.modificationMetadata
      ? this.calculateRealLastModified(options.modificationMetadata)
      : new Date();

    return {
      isValid,
      normalizedUrl,
      exclusionReasons,
      lastModified,
    };
  }

  /**
   * Déduplique une liste d'URLs
   * Utilise les URLs normalisées pour détecter les doublons
   */
  deduplicateUrls(urls: string[]): {
    unique: string[];
    duplicates: Map<string, string[]>;
  } {
    const seen = new Map<string, string>();
    const duplicates = new Map<string, string[]>();
    const unique: string[] = [];

    for (const url of urls) {
      const normalized = this.normalizeUrl(url);

      if (seen.has(normalized)) {
        // Doublon détecté
        const original = seen.get(normalized)!;
        if (!duplicates.has(normalized)) {
          duplicates.set(normalized, [original]);
        }
        duplicates.get(normalized)!.push(url);
      } else {
        // Première occurrence
        seen.set(normalized, url);
        unique.push(normalized);
      }
    }

    if (duplicates.size > 0) {
      this.logger.warn(
        `Found ${duplicates.size} duplicate URLs after normalization`,
      );
    }

    return { unique, duplicates };
  }

  /**
   * Configuration par défaut de normalisation
   */
  private getDefaultNormalizationConfig(): UrlNormalizationConfig {
    return {
      normalizeTrailingSlash: true,
      toLowerCase: true,
      removeWww: true,
      removeParameters: EXCLUDED_PARAMETERS,
      sortQueryParameters: true,
    };
  }

  /**
   * Valide le contenu d'une page
   */
  validateContent(content: {
    wordCount?: number;
    characterCount?: number;
    internalLinksCount?: number;
    textHtmlRatio?: number;
  }): { isValid: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (
      content.wordCount !== undefined &&
      content.wordCount < CONTENT_THRESHOLDS.MIN_WORDS
    ) {
      reasons.push(
        `Word count too low: ${content.wordCount} < ${CONTENT_THRESHOLDS.MIN_WORDS}`,
      );
    }

    if (
      content.characterCount !== undefined &&
      content.characterCount < CONTENT_THRESHOLDS.MIN_CHARACTERS
    ) {
      reasons.push(
        `Character count too low: ${content.characterCount} < ${CONTENT_THRESHOLDS.MIN_CHARACTERS}`,
      );
    }

    if (
      content.internalLinksCount !== undefined &&
      content.internalLinksCount < CONTENT_THRESHOLDS.MIN_INTERNAL_LINKS
    ) {
      reasons.push(
        `Internal links count too low: ${content.internalLinksCount} < ${CONTENT_THRESHOLDS.MIN_INTERNAL_LINKS}`,
      );
    }

    if (
      content.textHtmlRatio !== undefined &&
      content.textHtmlRatio < CONTENT_THRESHOLDS.MIN_TEXT_HTML_RATIO
    ) {
      reasons.push(
        `Text/HTML ratio too low: ${content.textHtmlRatio} < ${CONTENT_THRESHOLDS.MIN_TEXT_HTML_RATIO}`,
      );
    }

    return {
      isValid: reasons.length === 0,
      reasons,
    };
  }
}
