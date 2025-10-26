import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

@Injectable()
export class SitemapService extends SupabaseBaseService {
  protected readonly logger = new Logger(SitemapService.name);

  constructor() {
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
        .from('__sitemap_p_link')
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
   * Génère le sitemap constructeurs - UNIQUEMENT les marques (117 URLs)
   */
  async generateConstructeursSitemap(): Promise<string> {
    try {
      const entries: SitemapEntry[] = [];

      // ✅ Récupérer toutes les marques
      const { data: brands, error } = await this.client
        .from('auto_marque')
        .select('marque_id, marque_alias, marque_name')
        .order('marque_name');

      if (error) {
        this.logger.error('Erreur récupération marques:', error);
      }

      if (brands && brands.length > 0) {
        this.logger.log(`Génération sitemap pour ${brands.length} marques`);

        for (const brand of brands) {
          // ✅ Format nginx: /constructeurs/{alias}-{id}.html
          entries.push({
            loc: `/constructeurs/${brand.marque_alias}-${brand.marque_id}.html`,
            lastmod: new Date().toISOString(),
            changefreq: 'weekly',
            priority: 0.8,
          });
        }
      } else {
        this.logger.warn('Aucune marque trouvée');
      }

      this.logger.log(
        `Sitemap constructeurs généré avec ${entries.length} entrées`,
      );
      return this.buildSitemapXml(entries);
    } catch (error) {
      this.logger.error('Erreur génération sitemap constructeurs:', error);
      return this.buildSitemapXml([
        {
          loc: '/constructeurs',
          changefreq: 'weekly',
          priority: 0.8,
          lastmod: new Date().toISOString(),
        },
      ]);
    }
  }

  /**
   * Génère le sitemap modèles - TOUTES les pages via pagination récursive
   */
  async generateModelesSitemap(): Promise<string> {
    try {
      const entries: SitemapEntry[] = [];

      // ✅ Récupérer toutes les marques
      const { data: marques } = await this.client
        .from('auto_marque')
        .select('marque_id, marque_alias');

      if (!marques || marques.length === 0) {
        this.logger.warn('Aucune marque trouvée');
        return this.buildSitemapXml([]);
      }

      const marqueMap = new Map(
        marques.map((m) => [m.marque_id, m.marque_alias]),
      );

      // ✅ Charger TOUS les modèles par lots de 1000
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: modelesBatch } = await this.client
          .from('auto_modele')
          .select(
            'modele_id, modele_alias, modele_name, modele_name_url, modele_marque_id',
          )
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

          if (marqueAlias) {
            const modeleAlias =
              modele.modele_alias ||
              modele.modele_name_url ||
              modele.modele_name?.toLowerCase().replace(/\s+/g, '-') ||
              'modele';

            entries.push({
              loc: `/constructeurs/${marqueAlias}-${modele.modele_marque_id}/${modeleAlias}-${modele.modele_id}.html`,
              lastmod: new Date().toISOString(),
              changefreq: 'monthly',
              priority: 0.6,
            });
          }
        });

        // Si on a reçu moins que batchSize, c'est la dernière page
        if (modelesBatch.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
      }

      this.logger.log(`Sitemap modèles généré avec ${entries.length} entrées`);
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
   * Génère un sitemap de types avec chargement récursif par lots
   */
  private async generateTypesPaginated(
    startOffset: number,
    maxEntries: number,
  ): Promise<string> {
    try {
      const entries: SitemapEntry[] = [];
      const part = startOffset === 0 ? 1 : 2;

      this.logger.log(
        `Génération sitemap types partie ${part} (offset: ${startOffset}, max: ${maxEntries})`,
      );

      // ✅ Charger toutes les marques
      const { data: marques, error: marqueError } = await this.client
        .from('auto_marque')
        .select('marque_id, marque_alias');

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

      // ✅ Charger tous les modèles par lots
      const allModeles = [];
      let modeleOffset = 0;
      const modeleBatchSize = 1000;
      let hasMoreModeles = true;

      while (hasMoreModeles) {
        const { data: modelesBatch, error: modeleError } = await this.client
          .from('auto_modele')
          .select('modele_id, modele_alias, modele_name_url, modele_marque_id')
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

      // ✅ Charger les types par lots de 1000
      let offset = startOffset;
      const batchSize = 1000;
      let hasMore = true;
      let totalTypes = 0;
      let matchedTypes = 0;

      while (hasMore && entries.length < maxEntries) {
        const { data: typesBatch, error: typeError } = await this.client
          .from('auto_type')
          .select('type_id, type_name, type_modele_id')
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

          // ⚠️ type_modele_id est une string, il faut la convertir en number
          const modeleId = parseInt(type.type_modele_id, 10);
          const modeleInfo = modeleMap.get(modeleId);

          if (modeleInfo) {
            const marqueAlias = marqueMap.get(modeleInfo.marque_id);

            if (marqueAlias) {
              matchedTypes++;
              const typeSlug =
                type.type_name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') ||
                'type';

              entries.push({
                loc: `/constructeurs/${marqueAlias}-${modeleInfo.marque_id}/${modeleInfo.alias}-${type.type_modele_id}/${typeSlug}-${type.type_id}.html`,
                lastmod: new Date().toISOString(),
                changefreq: 'monthly',
                priority: 0.5,
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
        `Sitemap types partie ${part}: ${totalTypes} types traités, ${matchedTypes} matchés avec marque+modèle, ${entries.length} URLs générées`,
      );
      return this.buildSitemapXml(entries);
    } catch (error) {
      this.logger.error(`Erreur génération sitemap types:`, error);
      return this.buildSitemapXml([]);
    }
  }

  /**
   * Génère le sitemap produits - URLs conformes nginx: /pieces/{alias}-{id}.html
   * Utilise pagination récursive pour récupérer toutes les gammes
   */
  async generateProductsSitemap(): Promise<string> {
    try {
      const allGammes = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      this.logger.log('Chargement des gammes de pièces avec pagination...');

      // Pagination récursive pour contourner la limite PostgREST
      while (hasMore) {
        const { data, error } = await this.client
          .from('pieces_gamme')
          .select('pg_id, pg_alias, pg_name')
          .eq('pg_display', 1)
          .in('pg_level', [1, 2])
          .range(offset, offset + batchSize - 1)
          .order('pg_id');

        if (error) {
          this.logger.error(
            `Erreur chargement gammes offset ${offset}:`,
            error,
          );
          hasMore = false;
        } else if (data && data.length > 0) {
          allGammes.push(...data);
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
            changefreq: 'daily',
            priority: 0.9,
            lastmod: new Date().toISOString(),
          },
        ]);
      }

      const entries: SitemapEntry[] = allGammes.map((gamme) => ({
        loc: `/pieces/${gamme.pg_alias}-${gamme.pg_id}.html`,
        lastmod: new Date().toISOString(),
        changefreq: 'weekly',
        priority: 0.8,
      }));

      this.logger.log(`Sitemap produits généré avec ${entries.length} entrées`);
      return this.buildSitemapXml(entries);
    } catch (error) {
      this.logger.error('Erreur génération sitemap produits:', error);
      return this.buildSitemapXml([
        {
          loc: '/pieces',
          changefreq: 'weekly',
          priority: 0.7,
          lastmod: new Date().toISOString(),
        },
      ]);
    }
  }

  /**
   * Génère le sitemap blog - Utilise les vraies tables blog
   */
  async generateBlogSitemap(): Promise<string> {
    try {
      const entries: SitemapEntry[] = [];

      // ✅ Récupérer les articles conseils depuis __blog_advice
      const { data: adviceArticles, error: adviceError } = await this.client
        .from('__blog_advice')
        .select('ba_id, ba_alias, ba_create, ba_update')
        .order('ba_create', { ascending: false });

      if (adviceError) {
        this.logger.error(
          'Erreur récupération articles conseils:',
          adviceError,
        );
      }

      if (adviceArticles && adviceArticles.length > 0) {
        this.logger.log(`${adviceArticles.length} articles conseils trouvés`);
        adviceArticles.forEach((article) => {
          entries.push({
            loc: `/blog-pieces-auto/conseils/${article.ba_alias}`,
            lastmod:
              article.ba_update ||
              article.ba_create ||
              new Date().toISOString(),
            changefreq: 'monthly',
            priority: 0.7,
          });
        });
      } else {
        this.logger.warn('Aucun article conseil trouvé');
      }

      // ✅ Récupérer les guides depuis __blog_guide (pas de colonne statut)
      const { data: guideArticles, error: guideError } = await this.client
        .from('__blog_guide')
        .select('bg_id, bg_alias, bg_create, bg_update')
        .order('bg_create', { ascending: false });

      if (guideError) {
        this.logger.error('Erreur récupération guides:', guideError);
      }

      if (guideArticles && guideArticles.length > 0) {
        this.logger.log(`${guideArticles.length} guides trouvés`);
        guideArticles.forEach((guide) => {
          entries.push({
            loc: `/blog-pieces-auto/guide/${guide.bg_alias}`,
            lastmod:
              guide.bg_update || guide.bg_create || new Date().toISOString(),
            changefreq: 'monthly',
            priority: 0.7,
          });
        });
      } else {
        this.logger.warn('Aucun guide trouvé');
      }

      this.logger.log(`Sitemap blog généré avec ${entries.length} entrées`);
      return this.buildSitemapXml(entries);
    } catch (error) {
      this.logger.error('Erreur génération sitemap blog:', error);
      return this.buildSitemapXml([
        { loc: '/blog', changefreq: 'weekly', priority: 0.6 },
      ]);
    }
  }

  /**
   * Génère l'index des sitemaps
   */
  async generateSitemapIndex(): Promise<string> {
    const sitemaps = [
      {
        loc: '/api/sitemap/main.xml',
        lastmod: new Date().toISOString(),
      },
      {
        loc: '/api/sitemap/constructeurs.xml',
        lastmod: new Date().toISOString(),
      },
      {
        loc: '/api/sitemap/modeles.xml',
        lastmod: new Date().toISOString(),
      },
      {
        loc: '/api/sitemap/modeles-2.xml',
        lastmod: new Date().toISOString(),
      },
      {
        loc: '/api/sitemap/types-1.xml',
        lastmod: new Date().toISOString(),
      },
      {
        loc: '/api/sitemap/types-2.xml',
        lastmod: new Date().toISOString(),
      },
      {
        loc: '/api/sitemap/products.xml',
        lastmod: new Date().toISOString(),
      },
      {
        loc: '/api/sitemap/blog.xml',
        lastmod: new Date().toISOString(),
      },
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    (sitemap) => `  <sitemap>
    <loc>https://automecanik.com${sitemap.loc}</loc>
    <lastmod>${sitemap.lastmod}</lastmod>
  </sitemap>`,
  )
  .join('\n')}
</sitemapindex>`;

    this.logger.log('Index sitemap généré avec', sitemaps.length, 'sitemaps');
    return xml;
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
        .from('auto_type')
        .select('type_id, type_name, type_modele_id')
        .limit(10);

      // Charger quelques modèles
      const { data: modeles } = await this.client
        .from('auto_modele')
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
        .from('pieces_gamme')
        .select('*', { count: 'exact', head: true });

      // Avec pg_display = 1
      const { count: displayCount } = await this.client
        .from('pieces_gamme')
        .select('*', { count: 'exact', head: true })
        .eq('pg_display', 1);

      // Avec pg_level IN [1, 2]
      const { count: levelCount } = await this.client
        .from('pieces_gamme')
        .select('*', { count: 'exact', head: true })
        .in('pg_level', [1, 2]);

      // Avec les deux filtres
      const { count: bothCount } = await this.client
        .from('pieces_gamme')
        .select('*', { count: 'exact', head: true })
        .eq('pg_display', 1)
        .in('pg_level', [1, 2]);

      // Échantillon avec les filtres
      const { data: samples } = await this.client
        .from('pieces_gamme')
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
        .from('__sitemap_p_link')
        .select('*', { count: 'exact', head: true });

      const { count: blogEntriesCount } = await this.client
        .from('__blog_advice')
        .select('*', { count: 'exact', head: true });

      const { count: guidesCount } = await this.client
        .from('__blog_guide')
        .select('*', { count: 'exact', head: true });

      const { count: constructeursCount } = await this.client
        .from('auto_marque')
        .select('*', { count: 'exact', head: true });

      const { count: modelesCount } = await this.client
        .from('auto_modele')
        .select('*', { count: 'exact', head: true });

      const { count: gammesCount } = await this.client
        .from('pieces_gamme')
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
        .from('auto_modele')
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
}
