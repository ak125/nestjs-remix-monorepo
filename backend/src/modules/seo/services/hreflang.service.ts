import { Injectable, Logger } from '@nestjs/common';
import { HreflangLink } from '../interfaces/sitemap-config.interface';
import {
  SUPPORTED_LANGUAGES,
  X_DEFAULT_LANGUAGE,
  generateLocalizedUrl,
  shouldHaveHreflang,
  MultilingualContentType,
  MULTILINGUAL_SUPPORT,
} from '../config/hreflang.config';

@Injectable()
export class HreflangService {
  private readonly logger = new Logger(HreflangService.name);

  /**
   * Génère tous les liens hreflang pour une URL donnée
   */
  generateHreflangLinks(
    url: string,
    contentType: MultilingualContentType = MultilingualContentType.STATIC_PAGE,
  ): HreflangLink[] {
    // Vérifier si l'URL doit avoir des hreflang
    if (!shouldHaveHreflang(url)) {
      this.logger.debug(`URL excluded from hreflang: ${url}`);
      return [];
    }

    // Vérifier si le type de contenu supporte le multilingue
    const multilingualConfig = MULTILINGUAL_SUPPORT[contentType];
    if (!multilingualConfig.enabled) {
      this.logger.debug(
        `Content type ${contentType} does not support multilingual`,
      );
      return [];
    }

    const hreflangLinks: HreflangLink[] = [];

    // Extraire le path de l'URL
    const urlPath = this.extractPath(url);

    // Ajouter toutes les variantes linguistiques supportées
    const supportedLanguages = SUPPORTED_LANGUAGES.filter((lang) =>
      multilingualConfig.languages.includes(lang.hreflang),
    );

    supportedLanguages.forEach((lang) => {
      const localizedUrl = generateLocalizedUrl(urlPath, lang);
      hreflangLinks.push({
        hreflang: lang.hreflang,
        href: localizedUrl,
      });
    });

    // Ajouter x-default (langue de repli)
    const xDefaultUrl = generateLocalizedUrl(urlPath, X_DEFAULT_LANGUAGE);
    hreflangLinks.push({
      hreflang: 'x-default',
      href: xDefaultUrl,
    });

    this.logger.debug(
      `Generated ${hreflangLinks.length} hreflang links for ${url}`,
    );

    return hreflangLinks;
  }

  /**
   * Extrait le path d'une URL complète
   */
  private extractPath(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search + urlObj.hash;
    } catch {
      // Si l'URL n'est pas valide, retourner telle quelle
      return url;
    }
  }

  /**
   * Valide la symétrie des hreflang
   * (chaque variante doit pointer vers toutes les autres)
   */
  validateHreflangSymmetry(
    entries: Array<{ loc: string; alternates?: HreflangLink[] }>,
  ): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Grouper les URLs par path (sans domaine)
    const urlsByPath = new Map<
      string,
      Array<{ loc: string; alternates?: HreflangLink[] }>
    >();

    entries.forEach((entry) => {
      const path = this.extractPath(entry.loc);
      if (!urlsByPath.has(path)) {
        urlsByPath.set(path, []);
      }
      urlsByPath.get(path)!.push(entry);
    });

    // Vérifier la symétrie pour chaque groupe
    urlsByPath.forEach((group, path) => {
      if (group.length < 2) return; // Pas besoin de vérifier si une seule variante

      const allHreflangs = new Set<string>();
      group.forEach((entry) => {
        entry.alternates?.forEach((alt) => allHreflangs.add(alt.hreflang));
      });

      // Vérifier que chaque entrée a tous les hreflangs
      group.forEach((entry) => {
        const entryHreflangs = new Set(
          entry.alternates?.map((alt) => alt.hreflang) || [],
        );

        allHreflangs.forEach((hreflang) => {
          if (!entryHreflangs.has(hreflang)) {
            errors.push(
              `Missing hreflang ${hreflang} in ${entry.loc} for path ${path}`,
            );
          }
        });
      });
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Génère les hreflang pour un type de contenu spécifique
   */
  generateForContentType(
    url: string,
    contentType: MultilingualContentType,
  ): HreflangLink[] {
    return this.generateHreflangLinks(url, contentType);
  }

  /**
   * Vérifie si un type de contenu supporte le multilingue
   */
  isMultilingualSupported(contentType: MultilingualContentType): boolean {
    return MULTILINGUAL_SUPPORT[contentType].enabled;
  }

  /**
   * Obtient les langues supportées pour un type de contenu
   */
  getSupportedLanguages(contentType: MultilingualContentType): string[] {
    return MULTILINGUAL_SUPPORT[contentType].languages;
  }
}
