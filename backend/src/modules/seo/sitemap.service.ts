import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { SitemapVehiclePiecesValidator } from './services/sitemap-vehicle-pieces-validator.service';

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  priority?: number;
}

/**
 * 🎯 STRATÉGIE SEO - Priorités hiérarchiques alignées avec l'ancien système PHP
 * Homepage = 1.0 (priorité maximale)
 * Marques/Constructeurs = 0.9
 * Gammes produits = 0.8
 * Modèles = 0.8
 * Types/Motorisations = 0.7
 * Blog = 0.6
 */
const SEO_PRIORITIES = {
  homepage: 1.0,
  marque: 0.9,
  gamme: 0.8,
  modele: 0.8,
  type: 0.7,
  blog: 0.6,
  default: 0.5,
} as const;

/**
 * 🔄 Fréquences de mise à jour par type de page
 */
const SEO_CHANGEFREQ = {
  homepage: 'daily' as const,
  marque: 'weekly' as const,
  gamme: 'weekly' as const,
  modele: 'monthly' as const,
  type: 'monthly' as const,
  blog: 'monthly' as const,
  default: 'monthly' as const,
};

@Injectable()
export class SitemapService extends SupabaseBaseService {
  protected readonly logger = new Logger(SitemapService.name);

  constructor(
    private readonly vehiclePiecesValidator?: SitemapVehiclePiecesValidator,
  ) {
    super(); // ✅ Appel super() sans ConfigService - utilise getAppConfig()
  }

  /**
   * Génère le sitemap principal - Utilise les tables sitemap existantes
   */
  async generateMainSitemap(): Promise<string> {
    try {
      const entries: SitemapEntry[] = [];

      // Pages statiques
      entries.push(
        { loc: '/', changefreq: 'daily', priority: 1.0 },
        { loc: '/products', changefreq: 'daily', priority: 0.9 },
        { loc: '/constructeurs', changefreq: 'weekly', priority: 0.8 },
        { loc: '/support', changefreq: 'monthly', priority: 0.5 },
      );

      // ✅ Utiliser la table __sitemap_p_link existante (714K enregistrements)
      // Colonnes réelles: map_id, map_pg_alias, map_pg_id, map_marque_alias, map_marque_id,
      // map_modele_alias, map_modele_id, map_type_alias, map_type_id, map_has_item
      const { data: existingLinks } = await this.client
        .from(TABLES.sitemap_p_link)
        .select(
          'map_pg_alias, map_pg_id, map_marque_alias, map_marque_id, map_has_item',
        )
        .eq('map_has_item', 1) // Filtrer les liens avec items disponibles
        .limit(1000)
        .order('map_pg_id', { ascending: true });

      if (existingLinks) {
        existingLinks.forEach((link) => {
          // Format nginx: /pieces/{pg_alias}-{pg_id}/{marque_alias}-{marque_id}.html
          const url = `/pieces/${link.map_pg_alias}-${link.map_pg_id}/${link.map_marque_alias}-${link.map_marque_id}.html`;
          entries.push({
            loc: url,
            lastmod: new Date().toISOString(), // Pas de colonne date dans cette table
            changefreq: 'weekly',
            priority: 0.7,
          });
        });
      }

      this.logger.log(
        `Sitemap principal généré avec ${entries.length} entrées`,
      );
      return this.buildSitemapXml(entries);
    } catch (error) {
      this.logger.error('Erreur génération sitemap principal:', error);
      return this.buildSitemapXml([
        { loc: '/', changefreq: 'daily', priority: 1.0 },
      ]);
    }
  }

  /**
   * 🚗 Génère le sitemap constructeurs - UNIQUEMENT les marques avec relfollow=1
   * Aligné avec l'ancien système PHP: WHERE MARQUE_DISPLAY = 1
   * Format URL: /constructeurs/{marque_alias}-{marque_id}.html
   */
  async generateConstructeursSitemap(): Promise<string> {
    try {
      const entries: SitemapEntry[] = [];

      // ✅ Récupérer toutes les marques avec filtres SEO (comme PHP)
      // PHP: WHERE MARQUE_DISPLAY = 1
      const { data: brands, error } = await this.client
        .from(TABLES.auto_marque)
        .select(
          'marque_id, marque_alias, marque_name, marque_relfollow, marque_sitemap, marque_display',
        )
        .eq('marque_display', '1') // Marque active
        .order('marque_name');

      if (error) {
        this.logger.error('Erreur récupération marques:', error);
      }

      if (brands && brands.length > 0) {
        // Filtrer par marque_relfollow si défini (comme TYPE_RELFOLLOW en PHP)
        const filteredBrands = brands.filter(
          (brand) =>
            brand.marque_relfollow === '1' || brand.marque_relfollow === null,
        );

        this.logger.log(
          `Génération sitemap pour ${filteredBrands.length}/${brands.length} marques (filtre relfollow)`,
        );

        for (const brand of filteredBrands) {
          // ✅ Format PHP: /constructeurs/{alias}-{id}.html
          entries.push({
            loc: `/constructeurs/${brand.marque_alias}-${brand.marque_id}.html`,
            lastmod: new Date().toISOString().split('T')[0], // Format YYYY-MM-DD comme PHP
            changefreq: SEO_CHANGEFREQ.marque,
            priority: SEO_PRIORITIES.marque,
          });
        }
      } else {
        this.logger.warn('Aucune marque trouvée');
      }

      this.logger.log(
        `✅ Sitemap constructeurs généré avec ${entries.length} entrées`,
      );
      return this.buildSitemapXml(entries);
    } catch (error) {
      this.logger.error('Erreur génération sitemap constructeurs:', error);
      return this.buildSitemapXml([
        {
          loc: '/constructeurs',
          changefreq: SEO_CHANGEFREQ.marque,
          priority: SEO_PRIORITIES.marque,
          lastmod: new Date().toISOString().split('T')[0],
        },
      ]);
    }
  }

  /**
   * 🚙 Génère le sitemap modèles - Avec filtre modele_relfollow et modele_display
   * Aligné avec PHP: WHERE MODELE_DISPLAY = 1
   * Format URL: /constructeurs/{marque}-{id}/{modele}-{id}.html
   */
  async generateModelesSitemap(): Promise<string> {
    try {
      const entries: SitemapEntry[] = [];

      // ✅ Récupérer toutes les marques actives
      const { data: marques } = await this.client
        .from(TABLES.auto_marque)
        .select('marque_id, marque_alias')
        .eq('marque_display', '1');

      if (!marques || marques.length === 0) {
        this.logger.warn('Aucune marque trouvée');
        return this.buildSitemapXml([]);
      }

      const marqueMap = new Map(
        marques.map((m) => [m.marque_id, m.marque_alias]),
      );

      // ✅ Charger TOUS les modèles par lots de 1000 avec filtres SEO
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;
      let totalFiltered = 0;

      while (hasMore) {
        // ⭐ Filtres alignés PHP: MODELE_DISPLAY = 1
        const { data: modelesBatch } = await this.client
          .from(TABLES.auto_modele)
          .select(
            'modele_id, modele_alias, modele_name, modele_name_url, modele_marque_id, modele_relfollow, modele_display',
          )
          .eq('modele_display', '1') // Modèle actif
          .range(offset, offset + batchSize - 1)
          .order('modele_name');

        if (!modelesBatch || modelesBatch.length === 0) {
          hasMore = false;
          break;
        }

        this.logger.log(
          `Chargement de ${modelesBatch.length} modèles (offset: ${offset})`,
        );

        modelesBatch.forEach((modele: any) => {
          const marqueAlias = marqueMap.get(modele.modele_marque_id);

          // ⭐ Filtre relfollow: inclure si relfollow=1 ou null
          const hasRelfollow =
            modele.modele_relfollow === '1' || modele.modele_relfollow === null;

          if (marqueAlias && hasRelfollow) {
            const modeleAlias =
              modele.modele_alias ||
              modele.modele_name_url ||
              modele.modele_name?.toLowerCase().replace(/\s+/g, '-') ||
              'modele';

            entries.push({
              loc: `/constructeurs/${marqueAlias}-${modele.modele_marque_id}/${modeleAlias}-${modele.modele_id}.html`,
              lastmod: new Date().toISOString().split('T')[0],
              changefreq: SEO_CHANGEFREQ.modele,
              priority: SEO_PRIORITIES.modele,
            });
          } else if (!hasRelfollow) {
            totalFiltered++;
          }
        });

        // Si on a reçu moins que batchSize, c'est la dernière page
        if (modelesBatch.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
      }

      this.logger.log(
        `✅ Sitemap modèles généré avec ${entries.length} entrées (${totalFiltered} exclus par relfollow)`,
      );
      return this.buildSitemapXml(entries);
    } catch (error) {
      this.logger.error('Erreur génération sitemap modèles:', error);
      return this.buildSitemapXml([]);
    }
  }

  /**
   * Génère le sitemap modèles partie 2 - DEPRECATED (tout dans modeles.xml maintenant)
   */
  async generateModeles2Sitemap(): Promise<string> {
    this.logger.warn('modeles-2.xml est déprécié, redirigé vers modeles.xml');
    return this.generateModelesSitemap();
  }

  /**
   * Génère le sitemap types partie 1 - Premiers 35 000 types
   */
  async generateTypes1Sitemap(): Promise<string> {
    return this.generateTypesPaginated(0, 35000);
  }

  /**
   * Génère le sitemap types partie 2 - Types 35 001 à 70 000
   */
  async generateTypes2Sitemap(): Promise<string> {
    return this.generateTypesPaginated(35000, 35000);
  }

  /**
   * 🏎️ Génère un sitemap de types/motorisations avec filtre TYPE_RELFOLLOW
   * Aligné avec PHP: WHERE TYPE_DISPLAY = 1 AND MODELE_DISPLAY = 1 AND TYPE_RELFOLLOW = 1
   * Format URL: /constructeurs/{marque}-{id}/{modele}-{id}/{type}-{id}.html
   */
  private async generateTypesPaginated(
    startOffset: number,
    maxEntries: number,
  ): Promise<string> {
    try {
      const entries: SitemapEntry[] = [];
      const part = startOffset === 0 ? 1 : 2;

      this.logger.log(
        `🏎️ Génération sitemap types partie ${part} (offset: ${startOffset}, max: ${maxEntries})`,
      );

      // ✅ Charger toutes les marques actives
      const { data: marques, error: marqueError } = await this.client
        .from(TABLES.auto_marque)
        .select('marque_id, marque_alias')
        .eq('marque_display', '1');

      if (marqueError) {
        this.logger.error('Erreur chargement marques:', marqueError);
        return this.buildSitemapXml([]);
      }

      if (!marques) {
        this.logger.warn('Aucune marque trouvée');
        return this.buildSitemapXml([]);
      }

      this.logger.log(`${marques.length} marques chargées`);

      const marqueMap = new Map(
        marques.map((m) => [m.marque_id, m.marque_alias]),
      );

      // ✅ Charger tous les modèles actifs par lots
      const allModeles = [];
      let modeleOffset = 0;
      const modeleBatchSize = 1000;
      let hasMoreModeles = true;

      while (hasMoreModeles) {
        const { data: modelesBatch, error: modeleError } = await this.client
          .from(TABLES.auto_modele)
          .select('modele_id, modele_alias, modele_name_url, modele_marque_id')
          .eq('modele_display', '1') // ⭐ Filtre PHP: MODELE_DISPLAY = 1
          .range(modeleOffset, modeleOffset + modeleBatchSize - 1)
          .order('modele_id');

        if (modeleError) {
          this.logger.error(
            `Erreur chargement modèles offset ${modeleOffset}:`,
            modeleError,
          );
          hasMoreModeles = false;
        } else if (modelesBatch && modelesBatch.length > 0) {
          allModeles.push(...modelesBatch);
          modeleOffset += modeleBatchSize;
          hasMoreModeles = modelesBatch.length === modeleBatchSize;
        } else {
          hasMoreModeles = false;
        }
      }

      this.logger.log(`${allModeles.length} modèles chargés`);

      if (allModeles.length === 0) {
        this.logger.warn('Aucun modèle trouvé');
        return this.buildSitemapXml([]);
      }

      const modeleMap = new Map(
        allModeles.map((m) => [
          m.modele_id,
          {
            alias: m.modele_alias || m.modele_name_url || 'modele',
            marque_id: m.modele_marque_id,
          },
        ]),
      );

      // ✅ Charger les types par lots de 1000 avec filtres SEO
      let offset = startOffset;
      const batchSize = 1000;
      let hasMore = true;
      let totalTypes = 0;
      let matchedTypes = 0;
      let filteredByRelfollow = 0;

      while (hasMore && entries.length < maxEntries) {
        // ⭐ Filtres PHP: TYPE_DISPLAY = 1 AND TYPE_RELFOLLOW = 1
        const { data: typesBatch, error: typeError } = await this.client
          .from(TABLES.auto_type)
          .select(
            'type_id, type_name, type_alias, type_modele_id, type_relfollow, type_display',
          )
          .eq('type_display', '1') // Type actif
          .range(offset, offset + batchSize - 1)
          .order('type_id');

        if (typeError) {
          this.logger.error(
            `Erreur chargement types offset ${offset}:`,
            typeError,
          );
          hasMore = false;
          break;
        }

        if (!typesBatch || typesBatch.length === 0) {
          hasMore = false;
          break;
        }

        totalTypes += typesBatch.length;

        this.logger.log(
          `Lot de ${typesBatch.length} types chargé (offset: ${offset}, total traité: ${totalTypes})`,
        );

        typesBatch.forEach((type: any) => {
          if (entries.length >= maxEntries) return;

          // ⭐⭐ FILTRE CRITIQUE PHP: TYPE_RELFOLLOW = 1 ⭐⭐
          // C'est ce qui évite le duplicate content dans le sitemap
          if (type.type_relfollow !== '1') {
            filteredByRelfollow++;
            return;
          }

          // ⚠️ type_modele_id est une string, il faut la convertir en number
          const modeleId = parseInt(type.type_modele_id, 10);
          const modeleInfo = modeleMap.get(modeleId);

          if (modeleInfo) {
            const marqueAlias = marqueMap.get(modeleInfo.marque_id);

            if (marqueAlias) {
              matchedTypes++;
              // Utiliser type_alias si disponible, sinon construire depuis type_name
              const typeSlug =
                type.type_alias ||
                type.type_name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') ||
                'type';

              entries.push({
                loc: `/constructeurs/${marqueAlias}-${modeleInfo.marque_id}/${modeleInfo.alias}-${type.type_modele_id}/${typeSlug}-${type.type_id}.html`,
                lastmod: new Date().toISOString().split('T')[0],
                changefreq: SEO_CHANGEFREQ.type,
                priority: SEO_PRIORITIES.type,
              });
            }
          }
        });

        if (typesBatch.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
      }

      this.logger.log(
        `✅ Sitemap types partie ${part}: ${totalTypes} types traités, ${matchedTypes} matchés, ${filteredByRelfollow} exclus par type_relfollow, ${entries.length} URLs générées`,
      );
      return this.buildSitemapXml(entries);
    } catch (error) {
      this.logger.error(`Erreur génération sitemap types:`, error);
      return this.buildSitemapXml([]);
    }
  }

  /**
   * 🔧 Génère le sitemap gammes produits (105 pages dans l'ancien système)
   * Aligné avec PHP: pg_display = 1, pg_level IN [1, 2]
   * Format URL: /pieces/{pg_alias}-{pg_id}.html
   */
  async generateProductsSitemap(): Promise<string> {
    try {
      const allGammes = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;
      let filteredByRelfollow = 0;

      this.logger.log('🔧 Chargement des gammes de pièces avec pagination...');

      // Pagination récursive pour contourner la limite PostgREST
      while (hasMore) {
        // ⭐ Filtres PHP: pg_display = 1, pg_level IN [1, 2]
        const { data, error } = await this.client
          .from(TABLES.pieces_gamme)
          .select(
            'pg_id, pg_alias, pg_name, pg_relfollow, pg_display, pg_level',
          )
          .eq('pg_display', '1')
          .in('pg_level', ['1', '2'])
          .range(offset, offset + batchSize - 1)
          .order('pg_id');

        if (error) {
          this.logger.error(
            `Erreur chargement gammes offset ${offset}:`,
            error,
          );
          hasMore = false;
        } else if (data && data.length > 0) {
          // ⭐ Filtre pg_relfollow (si défini)
          data.forEach((gamme) => {
            if (gamme.pg_relfollow === '1' || gamme.pg_relfollow === null) {
              allGammes.push(gamme);
            } else {
              filteredByRelfollow++;
            }
          });
          this.logger.log(
            `Chargé ${data.length} gammes (total: ${allGammes.length})`,
          );
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      if (allGammes.length === 0) {
        this.logger.warn('Aucune gamme trouvée dans pieces_gamme');
        // Fallback minimal
        return this.buildSitemapXml([
          {
            loc: '/pieces',
            changefreq: SEO_CHANGEFREQ.gamme,
            priority: SEO_PRIORITIES.gamme,
            lastmod: new Date().toISOString().split('T')[0],
          },
        ]);
      }

      const entries: SitemapEntry[] = allGammes.map((gamme) => ({
        loc: `/pieces/${gamme.pg_alias}-${gamme.pg_id}.html`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: SEO_CHANGEFREQ.gamme,
        priority: SEO_PRIORITIES.gamme,
      }));

      this.logger.log(
        `✅ Sitemap gammes produits généré avec ${entries.length} entrées (${filteredByRelfollow} exclus par relfollow)`,
      );
      return this.buildSitemapXml(entries);
    } catch (error) {
      this.logger.error('Erreur génération sitemap produits:', error);
      return this.buildSitemapXml([
        {
          loc: '/pieces',
          changefreq: SEO_CHANGEFREQ.gamme,
          priority: SEO_PRIORITIES.gamme,
          lastmod: new Date().toISOString().split('T')[0],
        },
      ]);
    }
  }

  /**
   * 📝 Génère le sitemap blog (88 articles dans l'ancien système)
   * Aligné avec PHP: /blog-pieces-auto/conseils/{alias}
   * Priority: 0.6 (contenu informatif, pas commercial)
   */
  async generateBlogSitemap(): Promise<string> {
    try {
      const entries: SitemapEntry[] = [];

      // ✅ Récupérer les articles conseils depuis __blog_advice
      const { data: adviceArticles, error: adviceError } = await this.client
        .from(TABLES.blog_advice)
        .select('ba_id, ba_alias, ba_create, ba_update')
        .order('ba_create', { ascending: false });

      if (adviceError) {
        this.logger.error(
          'Erreur récupération articles conseils:',
          adviceError,
        );
      }

      if (adviceArticles && adviceArticles.length > 0) {
        this.logger.log(
          `📝 ${adviceArticles.length} articles conseils trouvés`,
        );
        adviceArticles.forEach((article) => {
          // Formater la date au format YYYY-MM-DD comme PHP
          const lastmod = article.ba_update || article.ba_create;
          const formattedDate = lastmod
            ? new Date(lastmod).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

          entries.push({
            loc: `/blog-pieces-auto/conseils/${article.ba_alias}`,
            lastmod: formattedDate,
            changefreq: SEO_CHANGEFREQ.blog,
            priority: SEO_PRIORITIES.blog, // 0.6 comme défini dans la stratégie
          });
        });
      } else {
        this.logger.warn('Aucun article conseil trouvé');
      }

      // ✅ Récupérer les guides depuis __blog_guide
      const { data: guideArticles, error: guideError } = await this.client
        .from(TABLES.blog_guide)
        .select('bg_id, bg_alias, bg_create, bg_update')
        .order('bg_create', { ascending: false });

      if (guideError) {
        this.logger.error('Erreur récupération guides:', guideError);
      }

      if (guideArticles && guideArticles.length > 0) {
        this.logger.log(`📚 ${guideArticles.length} guides trouvés`);
        guideArticles.forEach((guide) => {
          const lastmod = guide.bg_update || guide.bg_create;
          const formattedDate = lastmod
            ? new Date(lastmod).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

          entries.push({
            loc: `/blog-pieces-auto/guide/${guide.bg_alias}`,
            lastmod: formattedDate,
            changefreq: SEO_CHANGEFREQ.blog,
            priority: SEO_PRIORITIES.blog,
          });
        });
      } else {
        this.logger.warn('Aucun guide trouvé');
      }

      this.logger.log(`✅ Sitemap blog généré avec ${entries.length} entrées`);
      return this.buildSitemapXml(entries);
    } catch (error) {
      this.logger.error('Erreur génération sitemap blog:', error);
      return this.buildSitemapXml([
        {
          loc: '/blog',
          changefreq: SEO_CHANGEFREQ.blog,
          priority: SEO_PRIORITIES.blog,
        },
      ]);
    }
  }

  /**
   * 📋 Génère l'index des sitemaps - Aligné avec structure PHP
   * Structure PHP:
   * - https-sitemap-racine.xml (homepage)
   * - https-sitemap-gamme-produits.xml (105 gammes)
   * - https-sitemap-constructeurs.xml (marques + modèles + types - 2.26 MB)
   * - https-sitemap-blog.xml (88 articles)
   */
  async generateSitemapIndex(): Promise<string> {
    const today = new Date().toISOString().split('T')[0];
    const baseUrl = process.env.BASE_URL || 'https://www.automecanik.com';

    // Structure alignée sur PHP mais avec URLs dynamiques NestJS
    const sitemaps = [
      {
        loc: '/sitemap-racine.xml', // Homepage
        lastmod: today,
        comment: '1 URL : Homepage',
      },
      {
        loc: '/sitemap-gamme-produits.xml', // 105 gammes
        lastmod: today,
        comment: '~105 URLs : Gammes pièces auto',
      },
      {
        loc: '/sitemap-constructeurs.xml', // Marques
        lastmod: today,
        comment: '~117 URLs : Marques/Constructeurs',
      },
      {
        loc: '/sitemap-modeles.xml', // Modèles
        lastmod: today,
        comment: 'Modèles automobiles',
      },
      {
        loc: '/sitemap-types-1.xml', // Types 1-35000
        lastmod: today,
        comment: 'Motorisations partie 1',
      },
      {
        loc: '/sitemap-types-2.xml', // Types 35001+
        lastmod: today,
        comment: 'Motorisations partie 2',
      },
      {
        loc: '/sitemap-blog.xml', // Blog
        lastmod: today,
        comment: '~88 URLs : Articles conseils et guides',
      },
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    (sitemap) => `  <!-- ${sitemap.comment} -->
  <sitemap>
    <loc>${baseUrl}${sitemap.loc}</loc>
    <lastmod>${sitemap.lastmod}</lastmod>
  </sitemap>`,
  )
  .join('\n')}
</sitemapindex>`;

    this.logger.log(`📋 Index sitemap généré avec ${sitemaps.length} sitemaps`);
    return xml;
  }

  /**
   * 🏠 Génère le sitemap racine (homepage uniquement)
   * Aligné avec PHP: https-sitemap-racine.xml
   */
  async generateRacineSitemap(): Promise<string> {
    const entries: SitemapEntry[] = [
      {
        loc: '/',
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: SEO_CHANGEFREQ.homepage,
        priority: SEO_PRIORITIES.homepage, // 1.0
      },
    ];

    this.logger.log('🏠 Sitemap racine généré (homepage)');
    return this.buildSitemapXml(entries);
  }

  /**
   * Génère le robots.txt
   */
  async generateRobotsTxt(): Promise<string> {
    const robotsTxt = `User-agent: *
Allow: /

# Sitemaps
Sitemap: https://automecanik.com/sitemap.xml
Sitemap: https://automecanik.com/sitemap-constructeurs.xml
Sitemap: https://automecanik.com/sitemap-products.xml
Sitemap: https://automecanik.com/sitemap-blog.xml

# Restrictions
Disallow: /admin/
Disallow: /api/
Disallow: /private/
Disallow: *.pdf$

# Crawl-delay
Crawl-delay: 1`;

    this.logger.log('Robots.txt généré');
    return robotsTxt;
  }

  /**
   * Debug pour comprendre pourquoi les types ne matchent pas
   */
  async debugTypesMatching() {
    try {
      // Charger quelques types
      const { data: types } = await this.client
        .from(TABLES.auto_type)
        .select('type_id, type_name, type_modele_id')
        .limit(10);

      // Charger quelques modèles
      const { data: modeles } = await this.client
        .from(TABLES.auto_modele)
        .select('modele_id, modele_name, modele_marque_id')
        .limit(10);

      // Vérifier les IDs qui matchent
      const typeModeleIds = types?.map((t) => t.type_modele_id) || [];
      const modeleIds = modeles?.map((m) => m.modele_id) || [];

      const matchingIds = typeModeleIds.filter((id) => modeleIds.includes(id));

      return {
        typesCount: types?.length || 0,
        modelesCount: modeles?.length || 0,
        sampleTypes: types?.slice(0, 5),
        sampleModeles: modeles?.slice(0, 5),
        typeModeleIds: typeModeleIds.slice(0, 10),
        modeleIds: modeleIds.slice(0, 10),
        matchingIdsCount: matchingIds.length,
        matchingIds,
      };
    } catch (error) {
      this.logger.error('Erreur debug types:', error);
      return { error: error.message };
    }
  }

  /**
   * Debug pour comprendre les filtres des gammes
   */
  async debugGammes() {
    try {
      // Total sans filtre
      const { count: totalCount } = await this.client
        .from(TABLES.pieces_gamme)
        .select('*', { count: 'exact', head: true });

      // Avec pg_display = 1
      const { count: displayCount } = await this.client
        .from(TABLES.pieces_gamme)
        .select('*', { count: 'exact', head: true })
        .eq('pg_display', 1);

      // Avec pg_level IN [1, 2]
      const { count: levelCount } = await this.client
        .from(TABLES.pieces_gamme)
        .select('*', { count: 'exact', head: true })
        .in('pg_level', [1, 2]);

      // Avec les deux filtres
      const { count: bothCount } = await this.client
        .from(TABLES.pieces_gamme)
        .select('*', { count: 'exact', head: true })
        .eq('pg_display', 1)
        .in('pg_level', [1, 2]);

      // Échantillon avec les filtres
      const { data: samples } = await this.client
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_alias, pg_name, pg_display, pg_level')
        .eq('pg_display', 1)
        .in('pg_level', [1, 2])
        .limit(10);

      return {
        totalGammes: totalCount,
        withDisplay1: displayCount,
        withLevel12: levelCount,
        withBothFilters: bothCount,
        samples,
      };
    } catch (error) {
      this.logger.error('Erreur debug gammes:', error);
      return { error: error.message };
    }
  }

  /**
   * Construit le XML du sitemap
   */
  private buildSitemapXml(entries: SitemapEntry[]): string {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((entry) => {
    // Gérer lastmod undefined
    const lastmod = entry.lastmod || new Date().toISOString();

    let urlXml = `  <url>
    <loc>https://automecanik.com${entry.loc}</loc>
    <lastmod>${lastmod}</lastmod>`;

    // Ajouter changefreq si présent
    if (entry.changefreq) {
      urlXml += `\n    <changefreq>${entry.changefreq}</changefreq>`;
    }

    // Ajouter priority si définie
    if (entry.priority !== undefined) {
      urlXml += `\n    <priority>${entry.priority}</priority>`;
    }

    urlXml += '\n  </url>';
    return urlXml;
  })
  .join('\n')}
</urlset>`;

    return xml;
  }

  /**
   * Met à jour les statistiques des sitemaps
   */
  async updateSitemapStats(type: string, entriesCount: number) {
    try {
      const { data, error } = await this.client.from('___config').upsert({
        config_key: `sitemap_${type}_count`,
        config_value: entriesCount.toString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      return data;
    } catch (error) {
      this.logger.error(`Erreur mise à jour stats sitemap ${type}:`, error);
    }
  }

  /**
   * Récupère les statistiques des sitemaps
   */
  async getSitemapStats() {
    try {
      const { count: sitemapLinksCount } = await this.client
        .from(TABLES.sitemap_p_link)
        .select('*', { count: 'exact', head: true });

      const { count: blogEntriesCount } = await this.client
        .from(TABLES.blog_advice)
        .select('*', { count: 'exact', head: true });

      const { count: guidesCount } = await this.client
        .from(TABLES.blog_guide)
        .select('*', { count: 'exact', head: true });

      const { count: constructeursCount } = await this.client
        .from(TABLES.auto_marque)
        .select('*', { count: 'exact', head: true });

      const { count: modelesCount } = await this.client
        .from(TABLES.auto_modele)
        .select('*', { count: 'exact', head: true });

      const { count: gammesCount } = await this.client
        .from(TABLES.pieces_gamme)
        .select('*', { count: 'exact', head: true });

      return {
        sitemapLinks: sitemapLinksCount || 0,
        blogAdvice: blogEntriesCount || 0,
        blogGuides: guidesCount || 0,
        blogTotal: (blogEntriesCount || 0) + (guidesCount || 0),
        constructeurs: constructeursCount || 0,
        modeles: modelesCount || 0,
        gammes: gammesCount || 0,
        lastUpdate: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur récupération stats sitemap:', error);
      return {
        sitemapLinks: 0,
        blogAdvice: 0,
        blogGuides: 0,
        blogTotal: 0,
        constructeurs: 0,
        modeles: 0,
        gammes: 0,
        lastUpdate: new Date().toISOString(),
      };
    }
  }

  /**
   * Génère le sitemap d'un constructeur spécifique
   * ✅ Colonnes réelles de auto_modele: modele_id, modele_parent, modele_marque_id,
   * modele_alias, modele_name, modele_name_url, etc. (21 colonnes)
   */
  async generateConstructeurSitemap(marqueId: number): Promise<string> {
    try {
      const { data: modeles } = await this.client
        .from(TABLES.auto_modele)
        .select('modele_id, modele_alias, modele_name, modele_name_url')
        .eq('modele_marque_id', marqueId)
        .eq('modele_display', 1)
        .order('modele_name');

      const entries: SitemapEntry[] = [];

      if (modeles) {
        modeles.forEach((modele) => {
          // Format nginx: /constructeurs/{marque}/{modele}-{id}.html
          const alias =
            modele.modele_alias ||
            modele.modele_name_url ||
            modele.modele_name.toLowerCase();
          entries.push({
            loc: `/constructeurs/marque-${marqueId}/${alias}-${modele.modele_id}.html`,
            lastmod: new Date().toISOString(), // Pas de colonne date fiable
            changefreq: 'weekly',
            priority: 0.8,
          });
        });
      }

      const xml = this.buildSitemapXml(entries);

      this.logger.log(
        `Sitemap constructeur ${marqueId} généré avec ${entries.length} entrées`,
      );

      return xml;
    } catch (error) {
      this.logger.error(
        `Erreur génération sitemap constructeur ${marqueId}:`,
        error,
      );
      return this.buildSitemapXml([]);
    }
  }

  /**
   * 🛡️ NOUVEAU: Génère le sitemap des URLs véhicule-pièces VALIDÉES
   *
   * Format: /pieces/{gamme}/{marque}/{modele}/{type}.html
   * Exemple: /pieces/amortisseur-1/mercedes-107/classe-c-107003/220-cdi-14820.html
   *
   * ✅ Filtre les URLs invalides:
   * - type_id inexistant dans auto_type
   * - 0 pièces disponibles
   * - < 50% des pièces avec marque (qualité insuffisante)
   *
   * @param limit - Limite d'URLs à générer (défaut: 10000 en production)
   *                En test/dev, utiliser limit=100 pour éviter surcharge
   * @returns XML du sitemap avec URLs validées uniquement
   */
  async generateVehiclePiecesSitemap(limit = 10000): Promise<string> {
    try {
      if (!this.vehiclePiecesValidator) {
        this.logger.warn(
          '⚠️ SitemapVehiclePiecesValidator non injecté - génération sitemap simple',
        );
        return this.generateProductsSitemap(); // Fallback sur sitemap simple
      }

      this.logger.log(
        '🔍 Début génération sitemap véhicule-pièces avec validation...',
      );

      // 1. Récupérer des lignes avec diversification (x5 pour avoir des combinaisons uniques)
      // Limité à 50k max pour éviter timeout/crash
      const fetchLimit = Math.min(limit * 5, 50000);

      const { data: rawCombinations, error } = await this.client
        .from(TABLES.pieces_relation_type)
        .select('rtp_type_id, rtp_pg_id')
        .limit(fetchLimit);

      if (error) {
        this.logger.error(
          'Erreur récupération combinaisons type+gamme:',
          error,
        );
        return this.buildSitemapXml([]);
      }

      if (!rawCombinations || rawCombinations.length === 0) {
        this.logger.warn('Aucune combinaison trouvée');
        return this.buildSitemapXml([]);
      }

      this.logger.log(
        `📊 ${rawCombinations.length} lignes brutes récupérées, dédoublonnage...`,
      );

      // 2. Dédoublonner pour avoir les combinaisons UNIQUES
      const uniqueCombinations = new Map<string, any>();
      for (const combo of rawCombinations) {
        const key = `${combo.rtp_type_id}-${combo.rtp_pg_id}`;
        if (!uniqueCombinations.has(key)) {
          uniqueCombinations.set(key, combo);
        }
        // Arrêter dès qu'on a assez de combinaisons uniques
        if (uniqueCombinations.size >= limit) break;
      }

      this.logger.log(
        `📊 ${uniqueCombinations.size} combinaisons uniques trouvées (${((uniqueCombinations.size / rawCombinations.length) * 100).toFixed(1)}% de taux d'unicité)`,
      );

      const combinations = Array.from(uniqueCombinations.values());

      // 3. Construire les URLs candidates (sans alias pour l'instant - VERSION SIMPLIFIÉE)
      const candidateUrls = [];
      for (const combo of combinations) {
        const typeId = Number(combo.rtp_type_id);
        const gammeId = Number(combo.rtp_pg_id);

        // URL simplifiée temporaire pour test
        const url = `/pieces/gamme-${gammeId}/type-${typeId}.html`;

        candidateUrls.push({
          typeId,
          gammeId,
          url,
        });
      }

      this.logger.log(
        `🔍 ${candidateUrls.length} URLs candidates construites, début validation...`,
      );

      // 3. ⭐ FILTRER avec validation d'intégrité
      const validatedUrls =
        await this.vehiclePiecesValidator.filterUrlsForSitemap(candidateUrls);

      this.logger.log(
        `✅ Validation terminée: ${validatedUrls.length}/${candidateUrls.length} URLs valides (${((validatedUrls.length / candidateUrls.length) * 100).toFixed(1)}% taux d'acceptation)`,
      );

      // 4. Générer le XML
      const sitemapEntries: SitemapEntry[] = validatedUrls.map((item) => ({
        loc: item.url,
        lastmod: item.lastmod,
        changefreq: item.changefreq as SitemapEntry['changefreq'],
        priority: item.priority,
      }));

      return this.buildSitemapXml(sitemapEntries);
    } catch (error) {
      this.logger.error('Erreur génération sitemap véhicule-pièces:', error);
      return this.buildSitemapXml([]);
    }
  }

  /**
   * 📊 Génère un rapport de qualité du sitemap véhicule-pièces
   * Utile pour analyser les raisons d'exclusion
   */
  async generateVehiclePiecesQualityReport(sampleSize = 1000): Promise<{
    total: number;
    valid: number;
    invalid: number;
    invalidReasons: Array<{
      reason: string;
      count: number;
      examples: string[];
    }>;
  }> {
    if (!this.vehiclePiecesValidator) {
      throw new Error('SitemapVehiclePiecesValidator non injecté');
    }

    // Récupérer un échantillon
    const { data: combinations } = await this.client
      .from(TABLES.pieces_relation_type)
      .select(
        `
        rtp_type_id,
        rtp_pg_id,
        auto_type!inner (type_id, type_alias),
        pieces_gamme!inner (pg_id, pg_alias)
      `,
      )
      .limit(sampleSize);

    if (!combinations || combinations.length === 0) {
      return { total: 0, valid: 0, invalid: 0, invalidReasons: [] };
    }

    const urls = combinations.map((combo: any) => ({
      typeId: Number(combo.rtp_type_id),
      gammeId: Number(combo.rtp_pg_id),
      url: `/pieces/${combo.pieces_gamme.pg_alias}/.../type-${combo.rtp_type_id}.html`,
    }));

    return this.vehiclePiecesValidator.generateQualityReport(urls);
  }

  /**
   * 🚀 Génère le sitemap à partir de la table pré-calculée __sitemap_p_link
   * Cette table contient 714k URLs déjà formatées
   */
  async generateVehiclePiecesSitemapFromCache(limit = 50000): Promise<string> {
    try {
      this.logger.log(
        `🔍 Génération sitemap depuis __sitemap_p_link (limit=${limit})...`,
      );

      // Récupérer les URLs depuis la table pré-calculée avec pagination
      // Supabase limite à 1000 lignes, donc on utilise range()
      const { data: sitemapUrls, error } = await this.client
        .from(TABLES.sitemap_p_link)
        .select('*')
        .range(0, Math.min(limit, 1000) - 1); // Max 1000 lignes par requête

      if (error) {
        this.logger.error('Erreur récupération __sitemap_p_link:', error);
        return this.buildSitemapXml([]);
      }

      if (!sitemapUrls || sitemapUrls.length === 0) {
        this.logger.warn('Aucune URL dans __sitemap_p_link');
        return this.buildSitemapXml([]);
      }

      this.logger.log(
        `📊 ${sitemapUrls.length} URLs récupérées depuis __sitemap_p_link`,
      );

      // Construire les entrées sitemap avec le format URL correct
      // Format: /pieces/{pg_alias}-{pg_id}/{marque_alias}-{marque_id}/{modele_alias}-{modele_id}/{type_alias}-{type_id}.html
      const sitemapEntries = sitemapUrls
        .filter((item) => item.map_has_item && item.map_has_item > 0) // Seulement si pièces disponibles
        .map((item) => ({
          loc: `/pieces/${item.map_pg_alias}-${item.map_pg_id}/${item.map_marque_alias}-${item.map_marque_id}/${item.map_modele_alias}-${item.map_modele_id}/${item.map_type_alias}-${item.map_type_id}.html`,
          lastmod: new Date().toISOString(),
          changefreq: 'weekly' as const,
          priority: 0.7,
        }));

      this.logger.log(
        `✅ ${sitemapEntries.length} URLs ajoutées au sitemap (${sitemapUrls.length - sitemapEntries.length} filtrées car map_has_item=0)`,
      );

      return this.buildSitemapXml(sitemapEntries);
    } catch (error) {
      this.logger.error(
        'Erreur génération sitemap depuis __sitemap_p_link:',
        error,
      );
      return this.buildSitemapXml([]);
    }
  }

  /**
   * 🗂️ Génère un sitemap paginé depuis __sitemap_p_link
   * @param page Numéro de page (1-based)
   * @param pageSize Taille de page (max 1000 à cause de Supabase)
   */
  async generatePaginatedSitemap(
    page: number,
    pageSize = 1000,
  ): Promise<string> {
    try {
      const offset = (page - 1) * pageSize;
      const limit = Math.min(pageSize, 1000); // Supabase hard limit

      this.logger.log(
        `🔍 Génération sitemap paginé page=${page}, offset=${offset}, limit=${limit}`,
      );

      const { data: sitemapUrls, error } = await this.client
        .from(TABLES.sitemap_p_link)
        .select('*')
        .range(offset, offset + limit - 1);

      if (error) {
        this.logger.error('Erreur récupération page:', error);
        return this.buildSitemapXml([]);
      }

      if (!sitemapUrls || sitemapUrls.length === 0) {
        this.logger.warn(`Aucune URL pour page ${page}`);
        return this.buildSitemapXml([]);
      }

      const sitemapEntries = sitemapUrls
        .filter((item) => item.map_has_item && item.map_has_item > 0)
        .map((item) => ({
          loc: `/pieces/${item.map_pg_alias}-${item.map_pg_id}/${item.map_marque_alias}-${item.map_marque_id}/${item.map_modele_alias}-${item.map_modele_id}/${item.map_type_alias}-${item.map_type_id}.html`,
          lastmod: new Date().toISOString(),
          changefreq: 'weekly' as const,
          priority: 0.7,
        }));

      this.logger.log(`✅ Page ${page}: ${sitemapEntries.length} URLs valides`);

      return this.buildSitemapXml(sitemapEntries);
    } catch (error) {
      this.logger.error(`Erreur page ${page}:`, error);
      return this.buildSitemapXml([]);
    }
  }

  /**
   * 📋 Génère un sitemap index pièces listant tous les sitemaps paginés
   */
  async generatePiecesSitemapIndex(): Promise<string> {
    try {
      // Compter le nombre total d'URLs dans __sitemap_p_link
      const { count, error } = await this.client
        .from(TABLES.sitemap_p_link)
        .select('*', { count: 'exact', head: true });

      if (error || !count) {
        this.logger.error('Erreur comptage URLs:', error);
        return this.buildSitemapIndexXml([]);
      }

      const pageSize = 1000; // Supabase limite
      const totalPages = Math.ceil(count / pageSize);

      this.logger.log(
        `📊 Génération index: ${count} URLs totales, ${totalPages} pages`,
      );

      // Générer la liste des sitemaps
      const sitemaps = [];
      const baseUrl = process.env.BASE_URL || 'https://automecanik.com';

      // Ajouter les autres sitemaps statiques
      sitemaps.push({
        loc: `${baseUrl}/sitemap-blog.xml`,
        lastmod: new Date().toISOString(),
      });

      sitemaps.push({
        loc: `${baseUrl}/sitemap-motorisations.xml`,
        lastmod: new Date().toISOString(),
      });

      sitemaps.push({
        loc: `${baseUrl}/sitemap-marques.xml`,
        lastmod: new Date().toISOString(),
      });

      // Ajouter tous les sitemaps de pièces paginés
      for (let page = 1; page <= totalPages; page++) {
        sitemaps.push({
          loc: `${baseUrl}/api/sitemap/pieces-page-${page}.xml`,
          lastmod: new Date().toISOString(),
        });
      }

      this.logger.log(`✅ Index généré avec ${sitemaps.length} sitemaps`);

      return this.buildSitemapIndexXml(sitemaps);
    } catch (error) {
      this.logger.error('Erreur génération index:', error);
      return this.buildSitemapIndexXml([]);
    }
  }

  /**
   * 🏗️ Construit le XML d'un sitemap index
   */
  private buildSitemapIndexXml(
    sitemaps: Array<{ loc: string; lastmod: string }>,
  ): string {
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
    const sitemapIndexOpen =
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    const sitemapIndexClose = '</sitemapindex>';

    const sitemapEntries = sitemaps
      .map(
        (sitemap) => `
  <sitemap>
    <loc>${sitemap.loc}</loc>
    <lastmod>${sitemap.lastmod}</lastmod>
  </sitemap>`,
      )
      .join('');

    return `${xmlHeader}\n${sitemapIndexOpen}${sitemapEntries}\n${sitemapIndexClose}`;
  }
}
