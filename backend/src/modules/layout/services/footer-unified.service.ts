import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../cache/cache.service';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface FooterData {
  version: 'v2' | 'v7' | 'v8';
  company: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  columns: Array<{
    title: string;
    links: Array<{
      label: string;
      url: string;
      external?: boolean;
    }>;
  }>;
  social?: Array<{
    platform: string;
    url: string;
    icon: string;
  }>;
  newsletter?: {
    enabled: boolean;
    title: string;
    placeholder: string;
    buttonText: string;
  };
  payment?: {
    title: string;
    methods: string[];
  };
  copyright: {
    text: string;
    links?: Array<{
      label: string;
      link: string;
    }>;
  };
  sections?: Array<{
    key: string;
    content: any;
    styles?: any;
  }>;
}

@Injectable()
export class FooterService extends SupabaseBaseService {
  private readonly logger = new Logger(FooterService.name);

  constructor(private readonly cacheService: CacheService) {
    super();
  }

  /**
   * Service unifié : Contextes + Versions + Vraies données
   */
  async getFooter(
    context: 'admin' | 'commercial' | 'public' = 'public',
    version: 'v2' | 'v7' | 'v8' = 'v8',
    type?: string,
  ): Promise<FooterData> {
    try {
      const cacheKey = `footer:${context}:${version}:${type || 'default'}`;

      // Vérifier le cache
      const cached = await this.cacheService.get<FooterData>(cacheKey);
      if (cached) {
        this.logger.debug(`Footer cache hit: ${cacheKey}`);
        return cached;
      }

      // Récupérer les sections depuis Supabase
      const sections = await this.getFooterSections(version);

      // Construire le footer selon la version et le contexte
      const footerData = await this.buildFooter(
        context,
        version,
        type,
        sections,
      );

      // Cache pour 1 heure
      await this.cacheService.set(cacheKey, footerData, 3600);

      return footerData;
    } catch (error) {
      this.logger.error(
        `Error getting footer: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return this.getFallbackFooter(version);
    }
  }

  /**
   * Récupère les sections depuis Supabase
   */
  private async getFooterSections(version: string): Promise<any[]> {
    try {
      const { data: sections, error } = await this.supabase
        .from('layout_sections')
        .select('*')
        .eq('section_type', 'footer')
        .eq('version', version)
        .eq('is_visible', true)
        .order('position');

      if (error) {
        this.logger.warn(`No footer sections found for version ${version}`);
        return [];
      }

      return sections || [];
    } catch (error) {
      this.logger.error(
        `Error fetching footer sections: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  /**
   * Construit le footer selon version et contexte
   */
  private async buildFooter(
    context: string,
    version: 'v2' | 'v7' | 'v8',
    type?: string,
    sections: any[] = [],
  ): Promise<FooterData> {
    switch (version) {
      case 'v8':
        return this.buildV8Footer(context, type, sections);
      case 'v7':
        return this.buildV7Footer(context, sections);
      case 'v2':
        return this.buildV2Footer(context, sections);
      default:
        return this.buildV8Footer(context, type, sections);
    }
  }

  /**
   * Footer V8 moderne avec vraies données
   */
  private async buildV8Footer(
    context: string,
    type?: string,
    sections: any[] = [],
  ): Promise<FooterData> {
    const [company, columns, social, payment] = await Promise.all([
      this.getCompanyInfo(),
      this.getFooterColumns(context),
      this.getSocialLinks(),
      this.getPaymentMethods(),
    ]);

    return {
      version: 'v8',
      company,
      columns,
      social,
      newsletter: {
        enabled: context === 'public',
        title: 'Newsletter',
        placeholder: 'Votre email',
        buttonText: "S'inscrire",
      },
      payment,
      copyright: {
        text: `© ${new Date().getFullYear()} - Tous droits réservés`,
        links: [
          { label: 'CGV', link: '/support/cgv' },
          { label: 'Mentions légales', link: '/support/ml' },
          { label: 'Cookies', link: '/support/cookies' },
        ],
      },
      sections: sections.map((s) => ({
        key: s.section_key,
        content: s.content,
        styles: s.styles,
      })),
    };
  }

  /**
   * Footer V7 avec support legacy
   */
  private async buildV7Footer(
    context: string,
    sections: any[] = [],
  ): Promise<FooterData> {
    const company = await this.getCompanyInfo();

    return {
      version: 'v7',
      company,
      columns: [
        {
          title: 'Navigation',
          links: [
            { label: 'Accueil', url: '/v7' },
            { label: 'Catalogue', url: '/v7/products' },
            { label: 'Blog', url: '/v7/blog' },
            { label: 'Contact', url: '/v7/contact' },
          ],
        },
        {
          title: 'Support',
          links: [
            { label: 'CGV', url: '/v7/support/cgv' },
            { label: 'FAQ', url: '/v7/support/faq' },
            { label: 'Aide', url: '/v7/support/help' },
          ],
        },
      ],
      social: await this.getSocialLinks(),
      copyright: {
        text: `© ${new Date().getFullYear()} - Version 7`,
      },
      sections: sections.map((s) => ({
        key: s.section_key,
        content: s.content,
        styles: s.styles,
      })),
    };
  }

  /**
   * Footer V2 simple
   */
  private async buildV2Footer(
    context: string,
    sections: any[] = [],
  ): Promise<FooterData> {
    return {
      version: 'v2',
      company: {
        name: 'Pièces Auto V2',
      },
      columns: [
        {
          title: 'Liens',
          links: [
            { label: 'Accueil', url: '/v2' },
            { label: 'Recherche', url: '/v2/search' },
            { label: 'Contact', url: '/v2/contact' },
          ],
        },
      ],
      copyright: {
        text: `© ${new Date().getFullYear()} - Version 2`,
      },
      sections: sections.map((s) => ({
        key: s.section_key,
        content: s.content,
        styles: s.styles,
      })),
    };
  }

  /**
   * Récupère les infos de l'entreprise depuis Supabase
   */
  private async getCompanyInfo(): Promise<FooterData['company']> {
    try {
      const { data, error } = await this.supabase
        .from('company_settings')
        .select('name, address, phone, email')
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return {
          name: 'Pièces Auto',
          address: '123 Rue de la Paix, 75001 Paris',
          phone: '+33 1 23 45 67 89',
          email: 'contact@pieces-auto.com',
        };
      }

      return data;
    } catch (error) {
      this.logger.error(
        `Error fetching company info: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        name: 'Pièces Auto',
        address: '123 Rue de la Paix, 75001 Paris',
        phone: '+33 1 23 45 67 89',
        email: 'contact@pieces-auto.com',
      };
    }
  }

  /**
   * Récupère les colonnes du footer par contexte
   */
  private async getFooterColumns(
    context: string,
  ): Promise<FooterData['columns']> {
    try {
      const { data, error } = await this.supabase
        .from('___FOOTER_MENU')
        .select('category, label, url')
        .eq('is_active', true)
        .order('position');

      if (error || !data) {
        return this.getDefaultColumns(context);
      }

      // Grouper par catégorie
      const groupedLinks = data.reduce(
        (acc, item) => {
          if (!acc[item.category]) {
            acc[item.category] = [];
          }
          acc[item.category].push({
            label: item.label,
            url: item.url,
          });
          return acc;
        },
        {} as Record<string, any[]>,
      );

      return Object.entries(groupedLinks).map(([title, links]) => ({
        title: title.charAt(0).toUpperCase() + title.slice(1),
        links,
      }));
    } catch (error) {
      this.logger.error(
        `Error fetching footer columns: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return this.getDefaultColumns(context);
    }
  }

  /**
   * Colonnes par défaut selon le contexte
   */
  private getDefaultColumns(context: string): FooterData['columns'] {
    const baseColumns = {
      admin: [
        {
          title: 'Administration',
          links: [
            { label: 'Dashboard', url: '/admin' },
            { label: 'Utilisateurs', url: '/admin/users' },
            { label: 'Paramètres', url: '/admin/settings' },
          ],
        },
        {
          title: 'Support',
          links: [
            { label: 'Documentation', url: '/admin/docs' },
            { label: 'Support technique', url: '/admin/support' },
          ],
        },
      ],
      commercial: [
        {
          title: 'Commercial',
          links: [
            { label: 'Tableau de bord', url: '/commercial' },
            { label: 'Commandes', url: '/commercial/orders' },
            { label: 'Clients', url: '/commercial/customers' },
          ],
        },
        {
          title: 'Outils',
          links: [
            { label: 'Devis', url: '/commercial/quotes' },
            { label: 'Rapports', url: '/commercial/reports' },
          ],
        },
      ],
      public: [
        {
          title: 'Boutique',
          links: [
            { label: 'Nos produits', url: '/products' },
            { label: 'Nouveautés', url: '/new-arrivals' },
            { label: 'Promotions', url: '/sales' },
            { label: 'Marques', url: '/brands' },
          ],
        },
        {
          title: 'Services',
          links: [
            { label: 'Livraison', url: '/shipping' },
            { label: 'Retours', url: '/returns' },
            { label: 'Garantie', url: '/warranty' },
            { label: 'Support', url: '/support' },
          ],
        },
        {
          title: 'À propos',
          links: [
            { label: 'Notre histoire', url: '/about' },
            { label: 'Notre équipe', url: '/team' },
            { label: 'Nos valeurs', url: '/values' },
            { label: 'Carrières', url: '/careers' },
          ],
        },
        {
          title: 'Contact',
          links: [
            { label: 'Nous contacter', url: '/contact' },
            { label: 'FAQ', url: '/faq' },
            { label: 'Blog', url: '/blog' },
          ],
        },
      ],
    };

    return (
      baseColumns[context as keyof typeof baseColumns] || baseColumns.public
    );
  }

  /**
   * Récupère les liens sociaux depuis Supabase
   */
  private async getSocialLinks(): Promise<FooterData['social']> {
    try {
      const { data, error } = await this.supabase
        .from('social_share_configs')
        .select('platform, base_url, icon')
        .eq('is_active', true)
        .order('position');

      if (error || !data) {
        return [
          {
            platform: 'Facebook',
            url: 'https://facebook.com',
            icon: 'facebook',
          },
          { platform: 'Twitter', url: 'https://twitter.com', icon: 'twitter' },
          {
            platform: 'Instagram',
            url: 'https://instagram.com',
            icon: 'instagram',
          },
        ];
      }

      return data.map((item) => ({
        platform: item.platform,
        url: item.base_url,
        icon: item.icon,
      }));
    } catch (error) {
      this.logger.error(
        `Error fetching social links: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [
        { platform: 'Facebook', url: 'https://facebook.com', icon: 'facebook' },
        { platform: 'Twitter', url: 'https://twitter.com', icon: 'twitter' },
      ];
    }
  }

  /**
   * Récupère les moyens de paiement
   */
  private async getPaymentMethods(): Promise<FooterData['payment']> {
    return {
      title: 'Moyens de paiement',
      methods: ['visa', 'mastercard', 'paypal', 'cb', 'sepa'],
    };
  }

  /**
   * Footer de fallback en cas d'erreur
   */
  private getFallbackFooter(version: 'v2' | 'v7' | 'v8' = 'v8'): FooterData {
    return {
      version,
      company: {
        name: 'Pièces Auto',
      },
      columns: [
        {
          title: 'Navigation',
          links: [
            { label: 'Accueil', url: '/' },
            { label: 'Produits', url: '/products' },
            { label: 'Contact', url: '/contact' },
          ],
        },
      ],
      copyright: {
        text: `© ${new Date().getFullYear()} - Tous droits réservés`,
      },
    };
  }
}
