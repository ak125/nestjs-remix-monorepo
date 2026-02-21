import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { CacheService } from '../../../cache/cache.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

export interface FooterData {
  version?: string;
  company: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  links: Array<{
    title: string;
    items: Array<{
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
  legal?: Array<{
    label: string;
    url: string;
  }>;
  copyright: string;
  showNewsletter?: boolean;
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
  sections?: Array<{
    key: string;
    content: any;
    styles?: any;
  }>;
}

@Injectable()
export class FooterService {
  private readonly logger = new Logger(FooterService.name);
  private supabaseClient: SupabaseClient | null = null;

  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {
    // Initialiser le client Supabase
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (supabaseUrl && supabaseKey) {
      this.supabaseClient = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Génère les données du footer selon le contexte avec support versions et Supabase
   */
  async getFooter(
    context: 'admin' | 'commercial' | 'public',
    version?: string,
  ): Promise<FooterData> {
    try {
      const finalVersion = version || 'v8';
      const cacheKey = `footer:${context}:${finalVersion}`;

      // Vérifier le cache
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.log(`Cache HIT pour footer ${context}:${finalVersion}`);
        return cached as FooterData;
      }

      this.logger.log(
        `Cache MISS - Génération footer ${context}:${finalVersion}`,
      );

      // Générer les données selon le contexte et version
      let footerData: FooterData;

      if (this.supabaseClient && finalVersion === 'v8') {
        footerData = await this.buildModernFooterWithSupabase(
          context,
          finalVersion,
        );
      } else {
        footerData = await this.buildFooterForContext(context);
      }

      // Cache pour 1 heure
      await this.cacheService.set(cacheKey, footerData, 3600);
      this.logger.log(`Footer ${context}:${finalVersion} mis en cache`);

      return footerData;
    } catch (error) {
      this.logger.error('Erreur génération footer:', error);
      return this.getFallbackFooter();
    }
  }

  /**
   * Construction moderne du footer avec Supabase (v8)
   */
  private async buildModernFooterWithSupabase(
    context: string,
    version: string,
  ): Promise<FooterData> {
    try {
      // Récupérer les sections du footer depuis Supabase
      const sectionsPromise = this.getFooterSections(version);
      const linksPromise = this.getFooterLinksFromSupabase();
      const socialPromise = this.getSocialLinksFromSupabase();

      const [sections, dynamicLinks, socialLinks] = await Promise.all([
        sectionsPromise,
        linksPromise,
        socialPromise,
      ]);

      const baseFooter = await this.buildFooterForContext(context);

      // Enrichir avec les données Supabase
      return {
        ...baseFooter,
        version,
        links: dynamicLinks.length > 0 ? dynamicLinks : baseFooter.links,
        social: socialLinks.length > 0 ? socialLinks : baseFooter.social,
        newsletter: {
          enabled: true,
          title: 'Newsletter',
          placeholder: 'Votre email',
          buttonText: "S'inscrire",
        },
        payment: {
          title: 'Moyens de paiement',
          methods: ['visa', 'mastercard', 'paypal', 'cb'],
        },
        sections: sections?.map((s) => ({
          key: s.section_key,
          content: s.content,
          styles: s.styles,
        })),
      };
    } catch (error) {
      this.logger.error('Erreur construction footer moderne:', error);
      // Fallback vers la méthode classique
      return this.buildFooterForContext(context);
    }
  }

  /**
   * Récupérer les sections footer depuis Supabase
   */
  private async getFooterSections(version: string) {
    if (!this.supabaseClient) return [];

    try {
      const { data, error } = await this.supabaseClient
        .from('layout_sections')
        .select('*')
        .eq('section_type', 'footer')
        .eq('version', version)
        .eq('is_visible', true)
        .order('position');

      if (error) {
        this.logger.warn('Erreur récupération sections footer:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error('Erreur Supabase sections footer:', error);
      return [];
    }
  }

  /**
   * Récupérer les liens footer depuis Supabase
   */
  private async getFooterLinksFromSupabase() {
    if (!this.supabaseClient) return [];

    try {
      const { data, error } = await this.supabaseClient
        .from(TABLES.footer_menu)
        .select('*')
        .eq('is_active', true)
        .order('position');

      if (error) {
        this.logger.warn('Erreur récupération liens footer:', error);
        return [];
      }

      // Grouper par catégorie
      const groupedLinks = (data || []).reduce((acc, item) => {
        const category = item.category || 'default';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push({
          label: item.label,
          url: item.url,
          external: item.external || false,
        });
        return acc;
      }, {});

      // Convertir en format attendu
      return Object.entries(groupedLinks).map(([title, items]) => ({
        title: this.formatCategoryTitle(title),
        items: items as Array<{
          label: string;
          url: string;
          external?: boolean;
        }>,
      }));
    } catch (error) {
      this.logger.error('Erreur Supabase liens footer:', error);
      return [];
    }
  }

  /**
   * Récupérer les liens sociaux depuis Supabase
   */
  private async getSocialLinksFromSupabase() {
    if (!this.supabaseClient) return [];

    try {
      const { data, error } = await this.supabaseClient
        .from('social_share_configs')
        .select('*')
        .eq('is_active', true)
        .order('position');

      if (error) {
        this.logger.warn('Erreur récupération liens sociaux:', error);
        return [];
      }

      return (data || []).map((item) => ({
        platform: item.platform,
        url: item.base_url,
        icon: item.icon || item.platform.toLowerCase(),
      }));
    } catch (error) {
      this.logger.error('Erreur Supabase liens sociaux:', error);
      return [];
    }
  }

  /**
   * Formater le titre de catégorie
   */
  private formatCategoryTitle(category: string): string {
    const titleMap: Record<string, string> = {
      about: 'À propos',
      services: 'Services',
      support: 'Support',
      legal: 'Légal',
      default: 'Liens',
    };
    return titleMap[category] || category;
  }

  /**
   * Construction du footer selon le contexte
   */
  private async buildFooterForContext(context: string): Promise<FooterData> {
    switch (context) {
      case 'admin':
        return this.buildAdminFooter();
      case 'commercial':
        return this.buildCommercialFooter();
      case 'public':
        return this.buildPublicFooter();
      default:
        return this.getFallbackFooter();
    }
  }

  /**
   * Footer pour l'administration
   */
  private buildAdminFooter(): FooterData {
    return {
      company: {
        name: 'Administration',
      },
      links: [
        {
          title: 'Administration',
          items: [
            { label: 'Dashboard', url: '/admin' },
            { label: 'Utilisateurs', url: '/admin/users' },
            { label: 'Paramètres', url: '/admin/settings' },
          ],
        },
        {
          title: 'Support',
          items: [
            { label: 'Documentation', url: '/admin/docs' },
            { label: 'Aide', url: '/admin/help' },
            { label: 'Contact', url: '/admin/contact' },
          ],
        },
      ],
      legal: [
        { label: 'Confidentialité', url: '/privacy' },
        { label: 'Conditions', url: '/terms' },
      ],
      copyright: `© ${new Date().getFullYear()} - Tous droits réservés`,
    };
  }

  /**
   * Footer pour la section commerciale
   */
  private buildCommercialFooter(): FooterData {
    return {
      company: {
        name: 'Espace Commercial',
      },
      links: [
        {
          title: 'Commercial',
          items: [
            { label: 'Commandes', url: '/commercial/orders' },
            { label: 'Clients', url: '/commercial/customers' },
            { label: 'Rapports', url: '/commercial/reports' },
          ],
        },
        {
          title: 'Outils',
          items: [
            { label: 'Calculatrice', url: '/commercial/calculator' },
            { label: 'Catalogue', url: '/commercial/catalog' },
            { label: 'Devis', url: '/commercial/quotes' },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} - Espace Commercial`,
    };
  }

  /**
   * Footer pour le site public
   */
  private buildPublicFooter(): FooterData {
    return {
      company: {
        name: 'Automecanik',
        address: '184 avenue Aristide Briand, 93320 Les Pavillons-sous-Bois',
        phone: '01 77 69 58 92',
        email: 'contact@automecanik.com',
      },
      links: [
        {
          title: 'Boutique',
          items: [
            { label: 'Nos produits', url: '/products' },
            { label: 'Nouveautés', url: '/new-arrivals' },
            { label: 'Promotions', url: '/sales' },
            { label: 'Marques', url: '/brands' },
          ],
        },
        {
          title: 'Services',
          items: [
            { label: 'Livraison', url: '/shipping' },
            { label: 'Retours', url: '/returns' },
            { label: 'Garantie', url: '/warranty' },
            { label: 'Support', url: '/support' },
          ],
        },
        {
          title: 'À propos',
          items: [
            { label: 'Notre histoire', url: '/about' },
            { label: 'Notre équipe', url: '/team' },
            { label: 'Nos valeurs', url: '/values' },
            { label: 'Carrières', url: '/careers' },
          ],
        },
        {
          title: 'Contact',
          items: [
            { label: 'Nous contacter', url: '/contact' },
            { label: 'FAQ', url: '/faq' },
            { label: 'Blog', url: '/blog' },
            { label: 'Presse', url: '/press' },
          ],
        },
      ],
      social: [
        {
          platform: 'Facebook',
          url: 'https://www.facebook.com/Automecanik63',
          icon: 'facebook',
        },
        {
          platform: 'Instagram',
          url: 'https://www.instagram.com/automecanik.co',
          icon: 'instagram',
        },
        {
          platform: 'LinkedIn',
          url: 'https://linkedin.com/company/automecanik',
          icon: 'linkedin',
        },
        {
          platform: 'YouTube',
          url: 'https://www.youtube.com/@automecanik8508',
          icon: 'youtube',
        },
      ],
      legal: [
        { label: 'Mentions légales', url: '/legal' },
        { label: 'Politique de confidentialité', url: '/privacy' },
        { label: 'Conditions générales', url: '/terms' },
        { label: 'Cookies', url: '/cookies' },
      ],
      copyright: `© ${new Date().getFullYear()} Automecanik - Tous droits réservés`,
      showNewsletter: true,
    };
  }

  /**
   * Footer de fallback
   */
  private getFallbackFooter(): FooterData {
    return {
      company: {
        name: 'Application',
      },
      links: [],
      copyright: `© ${new Date().getFullYear()} - Tous droits réservés`,
    };
  }
}
