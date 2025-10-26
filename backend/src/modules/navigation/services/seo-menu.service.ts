import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SeoMenuService extends SupabaseBaseService {
  protected readonly logger = new Logger(SeoMenuService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  async getMenu() {
    try {
      this.logger.debug('Génération menu SEO (version technique avancée)');

      return {
        type: 'seo',
        title: 'Menu SEO & Marketing',
        sections: [
          {
            name: 'Optimisation',
            path: '/seo/optimization',
            icon: '🔍',
            description: 'Optimisation technique SEO',
            children: [
              {
                name: 'Meta Tags',
                path: '/seo/optimization/meta',
                description: 'Gestion des balises meta',
              },
              {
                name: 'Sitemap',
                path: '/seo/optimization/sitemap',
                description: 'Génération et gestion sitemap',
              },
              {
                name: 'Robots.txt',
                path: '/seo/optimization/robots',
                description: 'Configuration robots.txt',
              },
              {
                name: 'Schema.org',
                path: '/seo/optimization/schema',
                description: 'Données structurées',
              },
            ],
          },
          {
            name: 'Contenu',
            path: '/seo/content',
            icon: '📝',
            description: 'Gestion contenu SEO',
            children: [
              {
                name: 'Pages',
                path: '/seo/content/pages',
                description: 'Pages sans SEO',
                badge: await this.getPagesWithoutSEO(),
                priority: 'high',
              },
              {
                name: 'Blog',
                path: '/seo/content/blog',
                description: 'Optimisation articles blog',
              },
              {
                name: 'Produits',
                path: '/seo/content/products',
                description: 'SEO fiches produits',
              },
              {
                name: 'Redirections',
                path: '/seo/content/redirects',
                description: 'Gestion redirections 301',
              },
            ],
          },
          {
            name: 'Analyse',
            path: '/seo/analytics',
            icon: '�',
            description: 'Analytics et monitoring',
            children: [
              {
                name: 'Rankings',
                path: '/seo/analytics/rankings',
                description: 'Positions moteurs recherche',
              },
              {
                name: 'Traffic',
                path: '/seo/analytics/traffic',
                description: 'Analyse trafic organique',
              },
              {
                name: 'Core Web Vitals',
                path: '/seo/analytics/vitals',
                description: 'Performances Core Web Vitals',
              },
              {
                name: 'Erreurs 404',
                path: '/seo/analytics/404',
                description: 'Erreurs 404 détectées',
                badge: await this.get404Count(),
                priority: 'high',
              },
            ],
          },
          {
            name: 'Campagnes Marketing',
            path: '/seo/campaigns',
            icon: '🎯',
            description: 'Campagnes et promotions',
            children: [
              {
                name: 'Email marketing',
                path: '/seo/campaigns/email',
                description: 'Campagnes email',
              },
              {
                name: 'Réseaux sociaux',
                path: '/seo/campaigns/social',
                description: 'Marketing social media',
              },
              {
                name: 'A/B Testing',
                path: '/seo/campaigns/ab-testing',
                description: 'Tests de conversion checkout',
                badge: '987 tests',
                priority: 'high',
              },
              {
                name: 'Tests Produits',
                path: '/admin/checkout-ab-test',
                description: 'Interface de test des 987 commandes',
                badge: 'Actif',
                priority: 'high',
              },
            ],
          },
          {
            name: 'Outils',
            path: '/seo/tools',
            icon: '�',
            description: 'Outils SEO spécialisés',
            children: [
              {
                name: 'Générateur Meta',
                path: '/seo/tools/meta-generator',
                description: 'Générateur balises meta',
              },
              {
                name: 'Analyseur URL',
                path: '/seo/tools/url-analyzer',
                description: 'Analyse structure URLs',
              },
              {
                name: 'Test Rich Snippets',
                path: '/seo/tools/rich-snippets',
                description: 'Test données structurées',
              },
            ],
          },
        ],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur génération menu SEO:', error);
      return this.getFallbackMenu();
    }
  }

  /**
   * Configuration spécifique du menu SEO
   * Remplace _menu.section.php pour le module seo
   */
  async getSeoMenuConfig() {
    return {
      sections: [
        {
          title: 'Optimisation',
          icon: 'search',
          items: [
            {
              title: 'Meta Tags',
              url: '/seo/optimization/meta',
            },
            {
              title: 'Sitemap',
              url: '/seo/optimization/sitemap',
            },
            {
              title: 'Robots.txt',
              url: '/seo/optimization/robots',
            },
            {
              title: 'Schema.org',
              url: '/seo/optimization/schema',
            },
          ],
        },
        {
          title: 'Contenu',
          icon: 'file-text',
          items: [
            {
              title: 'Pages',
              url: '/seo/content/pages',
              badge: await this.getPagesWithoutSEO(),
            },
            {
              title: 'Blog',
              url: '/seo/content/blog',
            },
            {
              title: 'Produits',
              url: '/seo/content/products',
            },
            {
              title: 'Redirections',
              url: '/seo/content/redirects',
            },
          ],
        },
        {
          title: 'Analyse',
          icon: 'chart-line',
          items: [
            {
              title: 'Rankings',
              url: '/seo/analytics/rankings',
            },
            {
              title: 'Traffic',
              url: '/seo/analytics/traffic',
            },
            {
              title: 'Core Web Vitals',
              url: '/seo/analytics/vitals',
            },
            {
              title: 'Erreurs 404',
              url: '/seo/analytics/404',
              badge: await this.get404Count(),
            },
          ],
        },
        {
          title: 'Outils',
          icon: 'tools',
          items: [
            {
              title: 'Générateur Meta',
              url: '/seo/tools/meta-generator',
            },
            {
              title: 'Analyseur URL',
              url: '/seo/tools/url-analyzer',
            },
            {
              title: 'Test Rich Snippets',
              url: '/seo/tools/rich-snippets',
            },
          ],
        },
      ],
    };
  }

  private async getPagesWithoutSEO() {
    try {
      const { count } = await this.client
        .from('___meta_tags_ariane')
        .select('*', { count: 'exact', head: true })
        .or('meta_title.is.null,meta_description.is.null');

      return count ? count.toString() : '0';
    } catch (error) {
      this.logger.warn('Erreur récupération pages sans SEO:', error);
      return '42'; // Fallback
    }
  }

  private async get404Count() {
    try {
      // Récupérer le nombre d'erreurs 404 des dernières 24h
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { count } = await this.client
        .from('error_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status_code', 404)
        .gte('created_at', yesterday.toISOString());

      return count && count > 0
        ? { text: count.toString(), color: 'red' }
        : null;
    } catch (error) {
      this.logger.warn('Erreur récupération 404:', error);
      return { text: '8', color: 'red' }; // Fallback
    }
  }

  private getFallbackMenu() {
    return {
      type: 'seo',
      title: 'Menu SEO (Fallback)',
      sections: [
        {
          name: 'Optimisation',
          path: '/seo/optimization',
          icon: '🔍',
          description: 'Optimisation SEO de base',
          children: [
            {
              name: 'Meta Tags',
              path: '/seo/optimization/meta',
              description: 'Gestion des balises meta',
              badge: '42',
              priority: 'high',
            },
          ],
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }
}
