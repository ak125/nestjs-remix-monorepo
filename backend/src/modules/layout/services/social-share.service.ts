import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../cache/cache.service';

export interface SocialShareData {
  url: string;
  title: string;
  description?: string;
  image?: string;
  hashtags?: string[];
}

export interface SocialShareLinks {
  facebook: string;
  twitter: string;
  linkedin: string;
  pinterest?: string;
  whatsapp?: string;
  telegram?: string;
  email: string;
  copy: string;
}

export interface SocialPlatformConfig {
  platform: string;
  icon: string;
  base_url: string;
  is_active: boolean;
  position: number;
}

@Injectable()
export class SocialShareService {
  private readonly logger = new Logger(SocialShareService.name);

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Génère les liens de partage à partir de configurations dynamiques
   * Remplace global.social.share.php avec intégration base de données
   */
  async generateDynamicShareLinks(options: SocialShareData): Promise<any[]> {
    try {
      // Récupérer les configurations des plateformes depuis le cache ou la base
      const platforms = await this.getPlatformConfigs();

      const shareLinks = [];

      for (const platform of platforms) {
        const link = this.buildDynamicShareUrl(platform, options);
        shareLinks.push({
          platform: platform.platform,
          icon: platform.icon,
          url: link,
          label: `Partager sur ${platform.platform}`,
        });
      }

      return shareLinks;
    } catch (error) {
      this.logger.error('Erreur génération liens partage dynamiques:', error);
      // Fallback vers la méthode statique existante avec conversion
      const staticLinks = this.generateShareLinks(options);
      return this.convertToShareButtons(staticLinks);
    }
  }

  /** Génère les liens de partage pour les réseaux sociaux
   */
  generateShareLinks(data: SocialShareData): SocialShareLinks {
    try {
      const encodedUrl = encodeURIComponent(data.url);
      const encodedTitle = encodeURIComponent(data.title);
      const encodedDescription = encodeURIComponent(data.description || '');
      const encodedImage = data.image ? encodeURIComponent(data.image) : '';
      const hashtags = data.hashtags?.join(',') || '';

      return {
        facebook: this.buildFacebookUrl(encodedUrl, encodedTitle),
        twitter: this.buildTwitterUrl(encodedUrl, encodedTitle, hashtags),
        linkedin: this.buildLinkedInUrl(
          encodedUrl,
          encodedTitle,
          encodedDescription,
        ),
        pinterest: data.image
          ? this.buildPinterestUrl(encodedUrl, encodedTitle, encodedImage)
          : undefined,
        whatsapp: this.buildWhatsAppUrl(encodedUrl, encodedTitle),
        telegram: this.buildTelegramUrl(encodedUrl, encodedTitle),
        email: this.buildEmailUrl(encodedTitle, encodedDescription, encodedUrl),
        copy: data.url,
      };
    } catch (error) {
      this.logger.error('Erreur génération liens partage:', error);
      return this.getFallbackLinks(data.url);
    }
  }

  /**
   * Génère les métadonnées Open Graph pour le partage
   */
  generateOpenGraphMeta(data: SocialShareData): Record<string, string> {
    return {
      'og:url': data.url,
      'og:title': data.title,
      'og:description': data.description || '',
      'og:image': data.image || '',
      'og:type': 'website',
      'og:site_name': 'MonEntreprise',
    };
  }

  /**
   * Génère les métadonnées Twitter Card
   */
  generateTwitterCardMeta(data: SocialShareData): Record<string, string> {
    return {
      'twitter:card': data.image ? 'summary_large_image' : 'summary',
      'twitter:title': data.title,
      'twitter:description': data.description || '',
      'twitter:image': data.image || '',
      'twitter:site': '@monentreprise',
    };
  }

  /**
   * Construit l'URL de partage Facebook
   */
  private buildFacebookUrl(url: string, title: string): string {
    return `https://www.facebook.com/sharer/sharer.php?u=${url}&t=${title}`;
  }

  /**
   * Construit l'URL de partage Twitter
   */
  private buildTwitterUrl(
    url: string,
    title: string,
    hashtags: string,
  ): string {
    let twitterUrl = `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
    if (hashtags) {
      twitterUrl += `&hashtags=${encodeURIComponent(hashtags)}`;
    }
    return twitterUrl;
  }

  /**
   * Construit l'URL de partage LinkedIn
   */
  private buildLinkedInUrl(
    url: string,
    title: string,
    description: string,
  ): string {
    return `https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}&summary=${description}`;
  }

  /**
   * Construit l'URL de partage Pinterest
   */
  private buildPinterestUrl(url: string, title: string, image: string): string {
    return `https://pinterest.com/pin/create/button/?url=${url}&description=${title}&media=${image}`;
  }

  /**
   * Construit l'URL de partage WhatsApp
   */
  private buildWhatsAppUrl(url: string, title: string): string {
    const text = `${decodeURIComponent(title)} ${decodeURIComponent(url)}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  /**
   * Construit l'URL de partage Telegram
   */
  private buildTelegramUrl(url: string, title: string): string {
    return `https://t.me/share/url?url=${url}&text=${title}`;
  }

  /**
   * Construit l'URL de partage par email
   */
  private buildEmailUrl(
    title: string,
    description: string,
    url: string,
  ): string {
    const subject = encodeURIComponent(
      `Regardez ça : ${decodeURIComponent(title)}`,
    );
    const body = encodeURIComponent(
      `${decodeURIComponent(description)}\n\nVoir plus : ${decodeURIComponent(url)}`,
    );
    return `mailto:?subject=${subject}&body=${body}`;
  }

  /**
   * Liens de fallback en cas d'erreur
   */
  private getFallbackLinks(url: string): SocialShareLinks {
    return {
      facebook: '#',
      twitter: '#',
      linkedin: '#',
      email: `mailto:?body=${encodeURIComponent(url)}`,
      copy: url,
    };
  }

  /**
   * Génère les boutons de partage avec compteurs
   */
  async generateShareButtons(
    data: SocialShareData,
    showCounts = false,
  ): Promise<
    Array<{
      platform: string;
      label: string;
      url: string;
      icon: string;
      color: string;
      count?: number;
    }>
  > {
    const links = this.generateShareLinks(data);

    const buttons = [
      {
        platform: 'facebook',
        label: 'Facebook',
        url: links.facebook,
        icon: 'facebook',
        color: '#1877f2',
      },
      {
        platform: 'twitter',
        label: 'Twitter',
        url: links.twitter,
        icon: 'twitter',
        color: '#1da1f2',
      },
      {
        platform: 'linkedin',
        label: 'LinkedIn',
        url: links.linkedin,
        icon: 'linkedin',
        color: '#0077b5',
      },
      {
        platform: 'whatsapp',
        label: 'WhatsApp',
        url: links.whatsapp,
        icon: 'message-circle',
        color: '#25d366',
      },
      {
        platform: 'email',
        label: 'Email',
        url: links.email,
        icon: 'mail',
        color: '#666666',
      },
      {
        platform: 'copy',
        label: 'Copier le lien',
        url: links.copy,
        icon: 'copy',
        color: '#666666',
      },
    ];

    // Ajouter Pinterest si une image est disponible
    if (links.pinterest) {
      buttons.splice(3, 0, {
        platform: 'pinterest',
        label: 'Pinterest',
        url: links.pinterest,
        icon: 'pinterest',
        color: '#bd081c',
      });
    }

    // TODO: Implémenter les compteurs de partage si nécessaire
    if (showCounts) {
      // Ici on pourrait ajouter la logique pour récupérer les compteurs
      // depuis les APIs des réseaux sociaux ou depuis notre base de données
    }

    return buttons.filter((button) => button.url !== undefined) as Array<{
      platform: string;
      label: string;
      url: string;
      icon: string;
      color: string;
      count?: number;
    }>;
  }

  /**
   * Récupère les configurations des plateformes sociales
   */
  private async getPlatformConfigs(): Promise<SocialPlatformConfig[]> {
    const cacheKey = 'social_platforms_config';

    try {
      // Essayer de récupérer depuis le cache
      const cached = await this.cacheService.get(cacheKey);
      if (cached && Array.isArray(cached)) {
        return cached as SocialPlatformConfig[];
      }

      // Configuration par défaut si pas de base de données
      const defaultPlatforms: SocialPlatformConfig[] = [
        {
          platform: 'facebook',
          icon: 'facebook',
          base_url: 'https://www.facebook.com/sharer/sharer.php?u={url}',
          is_active: true,
          position: 1,
        },
        {
          platform: 'twitter',
          icon: 'twitter',
          base_url:
            'https://twitter.com/intent/tweet?url={url}&text={title}&hashtags={hashtags}',
          is_active: true,
          position: 2,
        },
        {
          platform: 'linkedin',
          icon: 'linkedin',
          base_url: 'https://www.linkedin.com/sharing/share-offsite/?url={url}',
          is_active: true,
          position: 3,
        },
        {
          platform: 'whatsapp',
          icon: 'message-circle',
          base_url: 'https://wa.me/?text={title}%20{url}',
          is_active: true,
          position: 4,
        },
        {
          platform: 'pinterest',
          icon: 'pinterest',
          base_url:
            'https://pinterest.com/pin/create/button/?url={url}&media={image}&description={description}',
          is_active: true,
          position: 5,
        },
        {
          platform: 'email',
          icon: 'mail',
          base_url: 'mailto:?subject={title}&body={description}%20{url}',
          is_active: true,
          position: 6,
        },
      ];

      // Mettre en cache pour 1 heure
      await this.cacheService.set(cacheKey, defaultPlatforms, 3600);

      return defaultPlatforms;
    } catch (error) {
      this.logger.error('Erreur récupération config plateformes:', error);
      // Retourner une configuration minimale
      return [];
    }
  }

  /**
   * Construit l'URL de partage selon la plateforme et la configuration
   */
  private buildDynamicShareUrl(
    platform: SocialPlatformConfig,
    options: SocialShareData,
  ): string {
    const encodedUrl = encodeURIComponent(options.url);
    const encodedTitle = encodeURIComponent(options.title || '');
    const encodedDescription = encodeURIComponent(options.description || '');
    const encodedImage = options.image ? encodeURIComponent(options.image) : '';
    const hashtags = options.hashtags?.join(',') || '';

    return platform.base_url
      .replace('{url}', encodedUrl)
      .replace('{title}', encodedTitle)
      .replace('{description}', encodedDescription)
      .replace('{image}', encodedImage)
      .replace('{hashtags}', hashtags);
  }

  /**
   * Convertit les liens statiques en format de boutons de partage
   */
  private convertToShareButtons(links: SocialShareLinks): any[] {
    return [
      {
        platform: 'facebook',
        icon: 'facebook',
        url: links.facebook,
        label: 'Partager sur Facebook',
      },
      {
        platform: 'twitter',
        icon: 'twitter',
        url: links.twitter,
        label: 'Partager sur Twitter',
      },
      {
        platform: 'linkedin',
        icon: 'linkedin',
        url: links.linkedin,
        label: 'Partager sur LinkedIn',
      },
      {
        platform: 'whatsapp',
        icon: 'message-circle',
        url: links.whatsapp,
        label: 'Partager sur WhatsApp',
      },
      {
        platform: 'email',
        icon: 'mail',
        url: links.email,
        label: 'Partager par Email',
      },
    ];
  }
}
