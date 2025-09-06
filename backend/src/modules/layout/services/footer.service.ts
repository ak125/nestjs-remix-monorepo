import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../cache/cache.service';

export interface FooterData {
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
}

@Injectable()
export class FooterService {
  private readonly logger = new Logger(FooterService.name);

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Génère les données du footer selon le contexte
   */
  async getFooter(
    context: 'admin' | 'commercial' | 'public',
  ): Promise<FooterData> {
    try {
      const cacheKey = `footer:${context}`;

      // Vérifier le cache
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return cached as FooterData;
      }

      // Générer les données selon le contexte
      const footerData = await this.buildFooterForContext(context);

      // Cache pour 1 heure
      await this.cacheService.set(cacheKey, footerData, 3600);

      return footerData;
    } catch (error) {
      this.logger.error('Erreur génération footer:', error);
      return this.getFallbackFooter();
    }
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
        name: 'MonEntreprise',
        address: '123 Rue de la Paix, 75001 Paris',
        phone: '+33 1 23 45 67 89',
        email: 'contact@monentreprise.com',
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
          url: 'https://facebook.com/monentreprise',
          icon: 'facebook',
        },
        {
          platform: 'Twitter',
          url: 'https://twitter.com/monentreprise',
          icon: 'twitter',
        },
        {
          platform: 'Instagram',
          url: 'https://instagram.com/monentreprise',
          icon: 'instagram',
        },
        {
          platform: 'LinkedIn',
          url: 'https://linkedin.com/company/monentreprise',
          icon: 'linkedin',
        },
      ],
      legal: [
        { label: 'Mentions légales', url: '/legal' },
        { label: 'Politique de confidentialité', url: '/privacy' },
        { label: 'Conditions générales', url: '/terms' },
        { label: 'Cookies', url: '/cookies' },
      ],
      copyright: `© ${new Date().getFullYear()} MonEntreprise - Tous droits réservés`,
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
