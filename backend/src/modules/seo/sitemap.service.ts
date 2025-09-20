import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { ConfigService } from '@nestjs/config';

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

@Injectable()
export class SitemapService extends SupabaseBaseService {
  protected readonly logger = new Logger(SitemapService.name);

  constructor(configService: ConfigService) {
    super(configService);
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

      // Utiliser la table __sitemap_p_link existante (714K enregistrements)
      const { data: existingLinks } = await this.client
        .from('__sitemap_p_link')
        .select('url, lastmod, priority')
        .eq('is_active', true)
        .limit(1000)
        .order('priority', { ascending: false });

      if (existingLinks) {
        existingLinks.forEach((link) => {
          entries.push({
            loc: link.url,
            lastmod: link.lastmod,
            changefreq: 'weekly',
            priority: link.priority || 0.6,
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
   * Génère le sitemap constructeurs - Utilise les tables automobiles existantes
   */
  async generateConstructeursSitemap(): Promise<string> {
    try {
      const entries: SitemapEntry[] = [];

      // Utiliser la table auto_marque existante (117 constructeurs)
      const { data: brands } = await this.client
        .from('auto_marque')
        .select('marque_id, marque_alias, marque_name, updated_at')
        .eq('marque_display', 1)
        .order('marque_name');

      if (brands) {
        for (const brand of brands) {
          // Page marque
          entries.push({
            loc: `/constructeurs/${brand.marque_alias}`,
            lastmod: brand.updated_at,
            changefreq: 'monthly',
            priority: 0.8,
          });

          // Utiliser la table auto_modele existante
          const { data: models } = await this.client
            .from('auto_modele')
            .select('modele_id, modele_alias, updated_at')
            .eq('modele_marque_id', brand.marque_id)
            .eq('modele_display', 1)
            .limit(50); // Limiter pour éviter trop d'entrées

          if (models) {
            models.forEach((model) => {
              entries.push({
                loc: `/constructeurs/${brand.marque_alias}/${model.modele_alias}`,
                lastmod: model.updated_at,
                changefreq: 'monthly',
                priority: 0.6,
              });
            });
          }
        }
      }

      this.logger.log(
        `Sitemap constructeurs généré avec ${entries.length} entrées`,
      );
      return this.buildSitemapXml(entries);
    } catch (error) {
      this.logger.error('Erreur génération sitemap constructeurs:', error);
      return this.buildSitemapXml([
        { loc: '/constructeurs', changefreq: 'weekly', priority: 0.8 },
      ]);
    }
  }

  /**
   * Génère le sitemap produits - Utilise la table __sitemap_gamme existante
   */
  async generateProductsSitemap(): Promise<string> {
    try {
      const entries: SitemapEntry[] = [];

      // Utiliser la table __sitemap_gamme existante
      const { data: gammes } = await this.client
        .from('__sitemap_gamme')
        .select('*')
        .order('created_at', { ascending: false });

      if (gammes && gammes.length > 0) {
        gammes.forEach((gamme) => {
          entries.push({
            loc: `/products/gamme/${gamme.slug || gamme.id}`,
            lastmod: gamme.updated_at || gamme.created_at,
            changefreq: 'weekly',
            priority: 0.7,
          });
        });
      } else {
        // Fallback: pages produits génériques
        entries.push(
          { loc: '/products', changefreq: 'daily', priority: 0.9 },
          {
            loc: '/products/pieces-moteur',
            changefreq: 'weekly',
            priority: 0.7,
          },
          {
            loc: '/products/pieces-carrosserie',
            changefreq: 'weekly',
            priority: 0.7,
          },
          {
            loc: '/products/pieces-freinage',
            changefreq: 'weekly',
            priority: 0.7,
          },
        );
      }

      this.logger.log(`Sitemap produits généré avec ${entries.length} entrées`);
      return this.buildSitemapXml(entries);
    } catch (error) {
      this.logger.error('Erreur génération sitemap produits:', error);
      return this.buildSitemapXml([
        { loc: '/products', changefreq: 'weekly', priority: 0.7 },
      ]);
    }
  }

  /**
   * Génère le sitemap blog - Utilise la table __sitemap_blog existante
   */
  async generateBlogSitemap(): Promise<string> {
    try {
      const entries: SitemapEntry[] = [];

      // Utiliser la table __sitemap_blog existante (109 entrées)
      const { data: blogPosts } = await this.client
        .from('__sitemap_blog')
        .select('*')
        .order('created_at', { ascending: false });

      if (blogPosts) {
        blogPosts.forEach((post) => {
          entries.push({
            loc: `/blog/${post.slug || post.id}`,
            lastmod: post.updated_at || post.created_at,
            changefreq: 'monthly',
            priority: 0.6,
          });
        });
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
      { loc: '/sitemap-main.xml', lastmod: new Date().toISOString() },
      { loc: '/sitemap-constructeurs.xml', lastmod: new Date().toISOString() },
      { loc: '/sitemap-products.xml', lastmod: new Date().toISOString() },
      { loc: '/sitemap-blog.xml', lastmod: new Date().toISOString() },
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
   * Construit le XML du sitemap
   */
  private buildSitemapXml(entries: SitemapEntry[]): string {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>https://automecanik.com${entry.loc}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <priority>${entry.priority}</priority>
  </url>`,
  )
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
      const { data: sitemapLinks } = await this.client
        .from('__sitemap_p_link')
        .select('*', { count: 'exact', head: true });

      const { data: blogEntries } = await this.client
        .from('__sitemap_blog')
        .select('*', { count: 'exact', head: true });

      const { data: constructeurs } = await this.client
        .from('auto_marque')
        .select('*', { count: 'exact', head: true });

      const { data: modeles } = await this.client
        .from('auto_modele')
        .select('*', { count: 'exact', head: true });

      return {
        sitemapLinks: sitemapLinks || 0,
        blogEntries: blogEntries || 0,
        constructeurs: constructeurs || 0,
        modeles: modeles || 0,
        lastUpdate: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur récupération stats sitemap:', error);
      return {
        sitemapLinks: 0,
        blogEntries: 0,
        constructeurs: 0,
        modeles: 0,
        lastUpdate: new Date().toISOString(),
      };
    }
  }

  /**
   * Génère le sitemap d'un constructeur spécifique
   */
  async generateConstructeurSitemap(marque: string): Promise<string> {
    try {
      const { data: modeles } = await this.client
        .from('auto_modele')
        .select('modele_nom, modele_slug, updated_at')
        .eq('marque_nom', marque)
        .order('modele_nom');

      const entries: SitemapEntry[] = [];

      if (modeles) {
        modeles.forEach((modele) => {
          entries.push({
            loc: `/constructeur/${marque}/${modele.modele_slug}`,
            lastmod: modele.updated_at || new Date().toISOString(),
            changefreq: 'weekly',
            priority: 0.8,
          });
        });
      }

      const xml = this.buildSitemapXml(entries);

      this.logger.log(
        `Sitemap constructeur ${marque} généré avec ${entries.length} entrées`,
      );

      return xml;
    } catch (error) {
      this.logger.error(
        `Erreur génération sitemap constructeur ${marque}:`,
        error,
      );
      return this.buildSitemapXml([]);
    }
  }
}
