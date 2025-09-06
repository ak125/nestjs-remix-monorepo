import { Injectable, Logger } from '@nestjs/common';

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

@Injectable()
export class SocialShareService {
  private readonly logger = new Logger(SocialShareService.name);

  /**
   * Génère les liens de partage pour les réseaux sociaux
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
}
