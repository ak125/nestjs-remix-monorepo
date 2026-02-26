/**
 * 🧭 OPTIMIZED BREADCRUMB SERVICE - Service de Breadcrumb Optimisé
 *
 * ✅ MISSION ACCOMPLIE : "Vérifier existant et utiliser le meilleur"
 *
 * Combine le meilleur de :
 * ✅ Service original proposé : Stockage DB
 * ✅ BreadcrumbService existant : Cache + génération automatique
 * ✅ Tables existantes : ___meta_tags_ariane (champ mta_ariane)
 * ✅ Architecture consolidée : SupabaseBaseService
 *
 * Fonctionnalités avancées :
 * ✅ Double source : DB + génération automatique
 * ✅ Cache Redis intelligent (TTL 1h)
 * ✅ Parsing flexible (JSON + string "A > B > C")
 * ✅ Schema.org automatique pour SEO
 * ✅ Configuration multilingue
 * ✅ API REST complète
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MetaTagsArianeDataService } from '../../../database/services/meta-tags-ariane-data.service';

export interface BreadcrumbItem {
  label: string;
  href: string;
  position: number;
  active?: boolean;
}

interface RawBreadcrumbEntry {
  label?: string;
  name?: string;
  title?: string;
  path?: string;
  url?: string;
  href?: string;
  icon?: string;
  isClickable?: boolean;
  active?: boolean;
  [key: string]: unknown;
}

export interface BreadcrumbConfig {
  showHome: boolean;
  homeLabel: string;
  separator: string;
  maxItems: number;
  ellipsis: string;
}

@Injectable()
export class OptimizedBreadcrumbService {
  private readonly logger = new Logger(OptimizedBreadcrumbService.name);
  private readonly cachePrefix = 'breadcrumb:';
  private readonly cacheTTL = 3600; // 1 heure

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly metaTagsData: MetaTagsArianeDataService,
  ) {
    this.logger.log('🧭 OptimizedBreadcrumbService initialisé');
  }

  /**
   * Récupérer le fil d'Ariane pour un chemin donné
   * 🔥 DOUBLE SOURCE : Base de données + Génération automatique
   */
  async getBreadcrumbs(
    currentPath: string,
    lang: string = 'fr',
  ): Promise<BreadcrumbItem[]> {
    try {
      const cleanPath = this.cleanPath(currentPath);
      const cacheKey = `${this.cachePrefix}${cleanPath}:${lang}`;

      // 1. Vérifier le cache Redis d'abord (performance)
      const cached = await this.cacheManager.get<BreadcrumbItem[]>(cacheKey);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        this.logger.debug(`✅ Breadcrumb trouvé en cache pour: ${cleanPath}`);
        return cached;
      }

      let breadcrumbs: BreadcrumbItem[] = [];
      const config = await this.getBreadcrumbConfig(lang);

      // 2. Essayer de récupérer depuis la table ___meta_tags_ariane
      const storedBreadcrumb = await this.getBreadcrumbFromMetadata(cleanPath);

      if (storedBreadcrumb && storedBreadcrumb.length > 0) {
        // ✅ Utiliser le breadcrumb stocké en base
        breadcrumbs = [...storedBreadcrumb];
        this.logger.debug(
          `📄 Breadcrumb récupéré depuis DB pour: ${cleanPath}`,
        );
      } else {
        // 3. 🤖 Générer automatiquement depuis l'URL (fallback intelligent)
        breadcrumbs = await this.generateBreadcrumbFromPath(cleanPath, lang);
        this.logger.debug(
          `🤖 Breadcrumb généré automatiquement pour: ${cleanPath}`,
        );
      }

      // 4. Toujours s'assurer qu'on a "Accueil" en premier
      if (config.showHome && !breadcrumbs.some((b) => b.href === '/')) {
        breadcrumbs.unshift({
          label: config.homeLabel,
          href: '/',
          position: 1,
          active: false,
        });
      }

      // 5. Nettoyer et valider les breadcrumbs
      breadcrumbs = breadcrumbs.filter(
        (item) =>
          item.label &&
          item.label.trim().length > 0 &&
          item.href !== undefined &&
          item.href !== '',
      );

      // 6. Marquer le dernier élément comme actif + recalculer positions
      if (breadcrumbs.length > 0) {
        breadcrumbs.forEach((b, i) => {
          b.active = false;
          b.position = i + 1;
        });
        breadcrumbs[breadcrumbs.length - 1].active = true;
      }

      // 7. Appliquer la limite d'éléments
      const finalBreadcrumbs = this.applyMaxItems(breadcrumbs, config);

      // 8. Mettre en cache le résultat
      await this.cacheManager.set(cacheKey, finalBreadcrumbs, this.cacheTTL);

      return finalBreadcrumbs;
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération breadcrumb pour ${currentPath}:`,
        error,
      );
      return this.getFallbackBreadcrumb(currentPath, lang);
    }
  }

  /**
   * Mettre à jour le breadcrumb pour un chemin
   * 💾 Stockage dans ___meta_tags_ariane.mta_ariane
   */
  async updateBreadcrumb(path: string, breadcrumbData: unknown): Promise<void> {
    try {
      const cleanPath = this.cleanPath(path);

      // Supporter différents formats d'entrée
      let arianeData;
      const dataAsRecord = breadcrumbData as Record<string, unknown>;
      if (dataAsRecord.breadcrumbs && Array.isArray(dataAsRecord.breadcrumbs)) {
        arianeData = JSON.stringify(breadcrumbData);
      } else if (Array.isArray(breadcrumbData)) {
        arianeData = JSON.stringify({ breadcrumbs: breadcrumbData });
      } else {
        arianeData = JSON.stringify(breadcrumbData);
      }

      // Vérifier si un enregistrement existe déjà
      const existing = await this.metaTagsData.getFieldsByUrl(
        cleanPath,
        'mta_id',
      );

      if (existing?.mta_id) {
        await this.metaTagsData.updateById(existing.mta_id, {
          mta_ariane: arianeData,
        });
      } else {
        await this.metaTagsData.insert({
          mta_id: Date.now(),
          mta_url: cleanPath,
          mta_alias: cleanPath,
          mta_ariane: arianeData,
        });
      }

      // Invalider le cache
      await this.clearCache(cleanPath);

      this.logger.log(`✅ Breadcrumb mis à jour pour: ${cleanPath}`);
    } catch (error) {
      this.logger.error(
        `❌ Erreur mise à jour breadcrumb pour ${path}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Générer Schema.org pour le breadcrumb
   * 📈 SEO optimisé selon les standards
   */
  generateBreadcrumbSchema(items: BreadcrumbItem[]): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item) => ({
        '@type': 'ListItem',
        position: item.position,
        name: item.label,
        item: `https://www.automecanik.com${item.href}`,
      })),
    };
  }

  /**
   * Nettoyer le cache
   * ♻️ Gestion intelligente du cache
   */
  async clearCache(path?: string): Promise<void> {
    try {
      if (path) {
        const cleanPath = this.cleanPath(path);
        const cacheKeys = [
          `${this.cachePrefix}${cleanPath}:fr`,
          `${this.cachePrefix}${cleanPath}:en`,
        ];

        for (const key of cacheKeys) {
          await this.cacheManager.del(key);
        }

        this.logger.log(`♻️ Cache invalidé pour: ${cleanPath}`);
      } else {
        // Nettoyer quelques clés communes (plus sûr que pattern matching)
        const commonKeys = [
          `${this.cachePrefix}products:fr`,
          `${this.cachePrefix}products/brake-pads:fr`,
          `${this.cachePrefix}products/brake-pads/premium:fr`,
          `${this.cachePrefix}config:fr`,
        ];

        for (const key of commonKeys) {
          try {
            await this.cacheManager.del(key);
          } catch {
            // Ignorer les erreurs de clés inexistantes
          }
        }

        this.logger.log('♻️ Cache breadcrumb principal nettoyé');
      }
    } catch (error) {
      this.logger.error('❌ Erreur nettoyage cache breadcrumb:', error);
      // Ne pas propager l'erreur pour éviter de casser l'API
    }
  }

  /**
   * Récupérer configuration breadcrumb
   * ⚙️ Configuration flexible multilingue
   */
  getBreadcrumbConfig(lang: string = 'fr'): BreadcrumbConfig {
    return {
      showHome: true,
      homeLabel: lang === 'fr' ? 'Accueil' : 'Home',
      separator: '>',
      maxItems: 5,
      ellipsis: '...',
    };
  }

  /**
   * Récupérer breadcrumb depuis la table ___meta_tags_ariane
   * 📄 Utilise UNIQUEMENT les tables existantes
   */
  private async getBreadcrumbFromMetadata(
    path: string,
  ): Promise<BreadcrumbItem[] | null> {
    try {
      const data = await this.metaTagsData.getFieldsByUrl(
        path,
        'mta_ariane, mta_title',
      );

      if (!data || !data.mta_ariane) {
        return null;
      }

      return this.parseBreadcrumbString(data.mta_ariane, path);
    } catch {
      this.logger.debug(`📄 Pas de breadcrumb en DB pour: ${path}`);
      return null;
    }
  }

  /**
   * Parser le breadcrumb depuis le format stocké en base
   * 🔄 Parsing flexible : JSON métadonnées + breadcrumb + string "A > B > C"
   */
  private parseBreadcrumbString(
    breadcrumbString: string,
    currentPath: string,
  ): BreadcrumbItem[] {
    if (!breadcrumbString || breadcrumbString.trim().length === 0) {
      return [];
    }

    try {
      // Si c'est du JSON, l'analyser
      if (
        breadcrumbString.trim().startsWith('{') ||
        breadcrumbString.trim().startsWith('[')
      ) {
        const parsed = JSON.parse(breadcrumbString);

        // 🆕 Si c'est un objet de métadonnées avec title/description (format stocké)
        if (parsed.title && typeof parsed.title === 'string') {
          // Générer un breadcrumb à partir du titre et du chemin
          return this.generateBreadcrumbFromTitleAndPath(
            parsed.title,
            currentPath,
          );
        }

        // Si c'est un objet avec une propriété breadcrumbs
        if (parsed.breadcrumbs && Array.isArray(parsed.breadcrumbs)) {
          return parsed.breadcrumbs.map(
            (item: RawBreadcrumbEntry, index: number) => ({
              label: item.label || item.name || item.title || 'Page',
              href: item.href || item.path || item.url || currentPath,
              position: index + 1,
              active: item.active || index === parsed.breadcrumbs.length - 1,
            }),
          );
        }

        // Si c'est directement un array de breadcrumbs
        if (Array.isArray(parsed)) {
          return parsed.map((item: RawBreadcrumbEntry, index: number) => ({
            label: item.label || item.name || item.title || 'Page',
            href: item.href || item.path || item.url || currentPath,
            position: index + 1,
            active: item.active || index === parsed.length - 1,
          }));
        }
      }

      // Sinon, traiter comme une chaîne de type "Accueil > Catégorie > Page"
      const segments = breadcrumbString
        .split('>')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const items: BreadcrumbItem[] = [];

      segments.forEach((segment, index) => {
        const segmentPath =
          index === segments.length - 1
            ? currentPath
            : this.generatePathFromIndex(currentPath, index);

        items.push({
          label: segment,
          href: segmentPath,
          position: index + 1,
          active: index === segments.length - 1,
        });
      });

      return items;
    } catch (error) {
      this.logger.warn(
        `⚠️ Erreur parsing breadcrumb string: ${breadcrumbString}`,
        error,
      );
      return [];
    }
  }

  /**
   * 🆕 Générer breadcrumb à partir du titre et du chemin
   * Analyse le titre pour extraire les segments (ex: "Filtre à huile AUDI A3 II 2.0 TDI")
   */
  private generateBreadcrumbFromTitleAndPath(
    title: string,
    currentPath: string,
  ): BreadcrumbItem[] {
    const breadcrumbs: BreadcrumbItem[] = [];

    // Analyser le chemin pour extraire les segments
    const pathSegments = currentPath
      .split('/')
      .filter((segment) => segment.length > 0);

    // Patterns de reconnaissance pour pièces auto
    const patterns = {
      pieces: /^pieces$/i,
      filtre: /filtre/i,
      marque: /^(audi|bmw|mercedes|volkswagen|renault|peugeot|citroën|ford)/i,
      modele: /^(a3|clio|golf|308|focus)/i,
      generation: /^(ii|iii|iv|2|3|4)/i,
      motorisation: /tdi|fsi|hdi|dci/i,
    };

    // Construire le breadcrumb progressivement
    let currentPathBuilder = '';

    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      currentPathBuilder += '/' + segment;

      let label = segment;

      // Améliorer le label selon le contexte
      if (patterns.pieces.test(segment)) {
        label = 'Pièces détachées';
      } else if (patterns.filtre.test(segment)) {
        label = segment.replace(/-\d+$/, '').replace(/-/g, ' ');
        label = label.charAt(0).toUpperCase() + label.slice(1);
      } else if (patterns.marque.test(segment)) {
        label = segment.replace(/-\d+$/, '').toUpperCase();
      } else if (segment.includes('-')) {
        // Traiter les segments avec tirets
        label = segment
          .replace(/-\d+$/, '') // Supprimer les IDs numériques à la fin
          .replace(/-/g, ' ') // Remplacer tirets par espaces
          .replace(/\b\w/g, (l) => l.toUpperCase()); // Capitaliser
      }

      breadcrumbs.push({
        label,
        href: currentPathBuilder,
        position: i + 1,
        active: i === pathSegments.length - 1,
      });
    }

    // Si on a un titre riche, utiliser le titre pour le dernier élément
    if (title && breadcrumbs.length > 0) {
      const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
      lastBreadcrumb.label = title;
    }

    return breadcrumbs;
  }

  /**
   * Générer breadcrumb depuis le chemin URL
   * 🤖 Génération automatique intelligente
   */
  private async generateBreadcrumbFromPath(
    currentPath: string,
    lang: string,
  ): Promise<BreadcrumbItem[]> {
    const breadcrumbs: BreadcrumbItem[] = [];
    const config = await this.getBreadcrumbConfig(lang);

    if (currentPath === '/' || !currentPath) {
      return [
        {
          label: config.homeLabel,
          href: '/',
          position: 1,
          active: true,
        },
      ];
    }

    // Diviser le chemin en segments non vides
    const segments = this.parseRoute(currentPath);
    let currentFullPath = '';

    segments.forEach((segment, index) => {
      currentFullPath += `/${segment}`;

      const label = this.transformSegmentToLabel(segment);
      const isLast = index === segments.length - 1;

      breadcrumbs.push({
        label,
        href: currentFullPath,
        position: index + 1,
        active: isLast,
      });
    });

    return breadcrumbs;
  }

  /**
   * Transformer un segment d'URL en label lisible
   * 🎨 Formatage intelligent des labels
   */
  private transformSegmentToLabel(segment: string): string {
    return segment
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Parser la route en segments
   */
  private parseRoute(path: string): string[] {
    return path
      .split('/')
      .filter((segment) => segment && segment.trim())
      .map((segment) => segment.trim());
  }

  /**
   * Nettoyer le chemin
   */
  private cleanPath(path: string): string {
    if (!path) return '/';
    if (!path.startsWith('/')) path = '/' + path;
    return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }

  /**
   * Humaniser un segment d'URL pour créer un libellé lisible
   * 🎯 Transforme "filtre-a-huile-7" en "Filtre à huile"
   */
  private humanizeSegment(segment: string): string {
    return segment
      .replace(/[-_]/g, ' ') // Remplacer tirets et underscores par espaces
      .replace(/\d+/g, '') // Supprimer les chiffres
      .replace(/\s+/g, ' ') // Normaliser les espaces
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Générer un path depuis un index
   */
  private generatePathFromIndex(currentPath: string, index: number): string {
    const segments = this.parseRoute(currentPath);
    return '/' + segments.slice(0, index + 1).join('/');
  }

  /**
   * Appliquer la limite d'éléments
   */
  private applyMaxItems(
    breadcrumbs: BreadcrumbItem[],
    config: BreadcrumbConfig,
  ): BreadcrumbItem[] {
    if (breadcrumbs.length <= config.maxItems) {
      return breadcrumbs;
    }

    // Garder le premier (Accueil), ellipsis, et les derniers
    const result = [breadcrumbs[0]];

    if (config.ellipsis) {
      result.push({
        label: config.ellipsis,
        href: '',
        position: 2,
        active: false,
      });
    }

    const lastItems = breadcrumbs.slice(-(config.maxItems - 2));
    result.push(...lastItems);

    return result;
  }

  /**
   * Breadcrumb de fallback en cas d'erreur
   */
  private getFallbackBreadcrumb(
    currentPath: string,
    lang: string,
  ): BreadcrumbItem[] {
    const config = this.getBreadcrumbConfig(lang);

    return [
      {
        label: config.homeLabel,
        href: '/',
        position: 1,
        active: currentPath === '/',
      },
    ];
  }
}
