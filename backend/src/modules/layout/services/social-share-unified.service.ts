import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../cache/cache.service';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface ShareOptions {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  hashtags?: string[];
}

export interface SocialPlatform {
  platform: string;
  icon: string;
  label: string;
  url: string;
  position: number;
  isActive: boolean;
}

export interface SocialShareData {
  platforms: SocialPlatform[];
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
  structuredData: any;
}

@Injectable()
export class SocialShareUnifiedService extends SupabaseBaseService {
  private readonly logger = new Logger(SocialShareUnifiedService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    super();
  }

  /**
   * Service Social Share unifié - Configuration Supabase + Fallback
   */
  async generateShareData(options: ShareOptions): Promise<SocialShareData> {
    try {
      const cacheKey = `social_share_${this.hashOptions(options)}`;
      const cached = await this.cacheService.get<SocialShareData>(cacheKey);

      if (cached) {
        this.logger.debug('Social share cache hit');
        return cached;
      }

      const [platforms, openGraph, twitterCard] = await Promise.all([
        this.generateShareLinks(options),
        this.generateOpenGraphMeta(options),
        this.generateTwitterCardMeta(options),
      ]);

      const shareData: SocialShareData = {
        platforms,
        openGraph,
        twitterCard,
        structuredData: this.generateStructuredData(options),
      };

      await this.cacheService.set(cacheKey, shareData, 1800); // 30 minutes
      return shareData;
    } catch (error) {
      this.logger.error(
        `Error in unified social share: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return this.getFallbackShareData(options);
    }
  }

  /**
   * Génère les liens de partage avec configuration Supabase + Fallback
   */
  private async generateShareLinks(
    options: ShareOptions,
  ): Promise<SocialPlatform[]> {
    try {
      // Essayer d'abord la configuration Supabase
      const supabasePlatforms = await this.getSupabasePlatforms();

      if (supabasePlatforms.length > 0) {
        return this.buildSupabaseShareLinks(supabasePlatforms, options);
      }

      // Fallback sur configuration statique
      return this.buildStaticShareLinks(options);
    } catch (error) {
      this.logger.error(
        `Error generating share links: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return this.buildStaticShareLinks(options);
    }
  }

  /**
   * Récupère la configuration depuis Supabase
   */
  private async getSupabasePlatforms(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('social_share_configs')
        .select('*')
        .eq('is_active', true)
        .order('position');

      if (error) {
        this.logger.error('Error fetching social platforms:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error(
        `Supabase social platforms error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  /**
   * Construit les liens avec configuration Supabase
   */
  private buildSupabaseShareLinks(
    platforms: any[],
    options: ShareOptions,
  ): SocialPlatform[] {
    return platforms.map((platform) => ({
      platform: platform.platform,
      icon: platform.icon,
      label: `Partager sur ${platform.platform}`,
      url: this.buildPlatformUrl(platform, options),
      position: platform.position,
      isActive: platform.is_active,
    }));
  }

  /**
   * Construit les liens avec configuration statique (fallback)
   */
  private buildStaticShareLinks(options: ShareOptions): SocialPlatform[] {
    const encodedUrl = encodeURIComponent(options.url);
    const encodedTitle = encodeURIComponent(options.title || '');
    const encodedDescription = encodeURIComponent(options.description || '');
    const hashtags = options.hashtags?.join(',') || '';

    return [
      {
        platform: 'facebook',
        icon: 'facebook',
        label: 'Partager sur Facebook',
        url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&t=${encodedTitle}`,
        position: 1,
        isActive: true,
      },
      {
        platform: 'twitter',
        icon: 'twitter',
        label: 'Partager sur Twitter',
        url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}&hashtags=${hashtags}`,
        position: 2,
        isActive: true,
      },
      {
        platform: 'linkedin',
        icon: 'linkedin',
        label: 'Partager sur LinkedIn',
        url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&title=${encodedTitle}&summary=${encodedDescription}`,
        position: 3,
        isActive: true,
      },
      {
        platform: 'whatsapp',
        icon: 'whatsapp',
        label: 'Partager sur WhatsApp',
        url: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
        position: 4,
        isActive: true,
      },
      {
        platform: 'email',
        icon: 'email',
        label: 'Partager par Email',
        url: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%20${encodedUrl}`,
        position: 5,
        isActive: true,
      },
    ];
  }

  /**
   * Construit l'URL pour une plateforme Supabase
   */
  private buildPlatformUrl(platform: any, options: ShareOptions): string {
    const encodedUrl = encodeURIComponent(options.url);
    const encodedTitle = encodeURIComponent(options.title || '');
    const encodedDescription = encodeURIComponent(options.description || '');

    // Si base_url a des placeholders, les remplacer
    if (platform.base_url && platform.base_url.includes('{')) {
      return platform.base_url
        .replace('{url}', encodedUrl)
        .replace('{title}', encodedTitle)
        .replace('{description}', encodedDescription);
    }

    // Sinon utiliser la logique par défaut
    return this.buildDefaultPlatformUrl(platform.platform, options);
  }

  /**
   * URLs par défaut par plateforme
   */
  private buildDefaultPlatformUrl(
    platformName: string,
    options: ShareOptions,
  ): string {
    const encodedUrl = encodeURIComponent(options.url);
    const encodedTitle = encodeURIComponent(options.title || '');
    const encodedDescription = encodeURIComponent(options.description || '');
    const hashtags = options.hashtags?.join(',') || '';

    switch (platformName.toLowerCase()) {
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
      case 'twitter':
        return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}&hashtags=${hashtags}`;
      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
      case 'whatsapp':
        return `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;
      case 'pinterest':
        const media = encodeURIComponent(options.image || '');
        return `https://pinterest.com/pin/create/button/?url=${encodedUrl}&media=${media}&description=${encodedDescription}`;
      case 'email':
        return `mailto:?subject=${encodedTitle}&body=${encodedDescription}%20${encodedUrl}`;
      default:
        return options.url;
    }
  }

  /**
   * Génère les métadonnées Open Graph
   */
  private async generateOpenGraphMeta(
    options: ShareOptions,
  ): Promise<Record<string, string>> {
    return {
      'og:url': options.url,
      'og:title': options.title || 'Pièces Auto',
      'og:description':
        options.description || 'Spécialiste en pièces automobiles',
      'og:image': options.image || '/images/default-share.jpg',
      'og:type': 'website',
      'og:site_name': 'Pièces Auto',
    };
  }

  /**
   * Génère les métadonnées Twitter Card
   */
  private async generateTwitterCardMeta(
    options: ShareOptions,
  ): Promise<Record<string, string>> {
    return {
      'twitter:card': options.image ? 'summary_large_image' : 'summary',
      'twitter:title': options.title || 'Pièces Auto',
      'twitter:description':
        options.description || 'Spécialiste en pièces automobiles',
      'twitter:image': options.image || '/images/default-share.jpg',
      'twitter:site': '@pieces_auto',
    };
  }

  /**
   * Génère les données structurées JSON-LD
   */
  private generateStructuredData(options: ShareOptions): any {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: options.title,
      description: options.description,
      url: options.url,
      image: options.image,
      publisher: {
        '@type': 'Organization',
        name: 'Pièces Auto',
        url: 'https://pieces-auto.com',
      },
    };
  }

  /**
   * Données de fallback en cas d'erreur
   */
  private getFallbackShareData(options: ShareOptions): SocialShareData {
    return {
      platforms: this.buildStaticShareLinks(options),
      openGraph: {
        'og:url': options.url,
        'og:title': options.title || 'Partager',
      },
      twitterCard: {
        'twitter:card': 'summary',
        'twitter:title': options.title || 'Partager',
      },
      structuredData: {},
    };
  }

  /**
   * Hash des options pour le cache
   */
  private hashOptions(options: ShareOptions): string {
    return Buffer.from(JSON.stringify(options)).toString('base64').slice(0, 16);
  }
}
