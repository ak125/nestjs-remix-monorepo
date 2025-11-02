/**
 * 🖼️ SERVICE DE GESTION DES IMAGES PRODUITS
 * Génération d'URLs publiques stables pour les sitemaps d'images
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ProductImageMetadata,
  ProductImageType,
  SitemapImage,
} from '../interfaces/sitemap-image.interface';

@Injectable()
export class ProductImageService {
  private readonly logger = new Logger(ProductImageService.name);
  private readonly supabaseUrl: string;
  private readonly cdnBaseUrl: string;

  constructor(private configService: ConfigService) {
    this.supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      'https://vxjbdsmpdwqzfvbddvvc.supabase.co';
    this.cdnBaseUrl = `${this.supabaseUrl}/storage/v1/object/public/uploads`;

    this.logger.log('🖼️ ProductImageService initialized');
    this.logger.log(`📦 CDN Base URL: ${this.cdnBaseUrl}`);
  }

  /**
   * Construire l'URL publique stable d'une image
   * (pas d'URL signée temporaire, préférer URLs publiques CDN)
   */
  buildPublicImageUrl(path: string): string {
    // Si déjà une URL complète, retourner telle quelle
    if (path.startsWith('http')) {
      return path;
    }

    // Nettoyer le path (supprimer / initial si présent)
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;

    // Construire URL CDN publique
    return `${this.cdnBaseUrl}/${cleanPath}`;
  }

  /**
   * Générer les images pour un produit
   * Format: 1 image principale + 2-4 vues utiles
   */
  async getProductImages(
    productId: number,
    productName: string,
    productRef: string,
  ): Promise<ProductImageMetadata[]> {
    const images: ProductImageMetadata[] = [];

    // 1. Image principale (packshot clair, fond propre)
    const mainImagePath = this.getMainImagePath(productRef);
    if (mainImagePath) {
      images.push({
        id: `${productId}-main`,
        url: this.buildPublicImageUrl(mainImagePath),
        type: ProductImageType.MAIN,
        productName,
        productRef,
        description: `${productName} - Image principale`,
        isPrimary: true,
        displayOrder: 1,
      });
    }

    // 2. Vues supplémentaires (2-4 images utiles)
    const additionalImages = this.getAdditionalImagePaths(productRef);
    additionalImages.forEach((imagePath, index) => {
      images.push({
        id: `${productId}-${index + 2}`,
        url: this.buildPublicImageUrl(imagePath.path),
        type: imagePath.type,
        productName,
        productRef,
        description: `${productName} - ${this.getImageTypeLabel(imagePath.type)}`,
        isPrimary: false,
        displayOrder: index + 2,
      });
    });

    return images;
  }

  /**
   * Convertir ProductImageMetadata en SitemapImage (format Google)
   */
  convertToSitemapImage(metadata: ProductImageMetadata): SitemapImage {
    const title = this.generateImageTitle(metadata);
    const caption = this.generateImageCaption(metadata);

    return {
      loc: metadata.url,
      title,
      caption,
    };
  }

  /**
   * Obtenir toutes les images d'un produit pour le sitemap
   */
  async getProductSitemapImages(
    productId: number,
    productName: string,
    productRef: string,
    maxImages: number = 5,
  ): Promise<SitemapImage[]> {
    const metadata = await this.getProductImages(
      productId,
      productName,
      productRef,
    );

    // Limiter à maxImages (Google recommande 1-10, on fait 5 par défaut)
    const limitedMetadata = metadata.slice(0, maxImages);

    // Convertir en format sitemap
    return limitedMetadata.map((m) => this.convertToSitemapImage(m));
  }

  /**
   * Générer le titre optimisé SEO pour l'image
   */
  private generateImageTitle(metadata: ProductImageMetadata): string {
    const typeLabel =
      metadata.type === ProductImageType.MAIN
        ? ''
        : ` - ${this.getImageTypeLabel(metadata.type)}`;

    return `${metadata.productName}${typeLabel} | Pièce Auto ${metadata.productRef || ''}`.trim();
  }

  /**
   * Générer la caption avec copyright/watermark
   */
  private generateImageCaption(metadata: ProductImageMetadata): string {
    let caption = metadata.description || metadata.productName;

    // Ajouter watermark/copyright
    caption += ' - © AutoMecanik.com - Tous droits réservés';

    return caption;
  }

  /**
   * Obtenir le label français d'un type d'image
   */
  private getImageTypeLabel(type: ProductImageType): string {
    const labels: Record<ProductImageType, string> = {
      [ProductImageType.MAIN]: 'Image principale',
      [ProductImageType.FRONT]: 'Vue de face',
      [ProductImageType.SIDE]: 'Vue de côté',
      [ProductImageType.BACK]: 'Vue arrière',
      [ProductImageType.TOP]: 'Vue de dessus',
      [ProductImageType.DETAIL]: 'Détail',
      [ProductImageType.PACKAGING]: 'Emballage',
      [ProductImageType.INSTALLATION]: 'Installation',
      [ProductImageType.TECHNICAL]: 'Schéma technique',
      [ProductImageType.COMPARISON]: 'Comparaison',
    };

    return labels[type] || 'Image';
  }

  /**
   * Obtenir le chemin de l'image principale
   * TODO: Adapter selon votre structure de stockage réelle
   */
  private getMainImagePath(productRef: string): string | null {
    // Exemple de structure (à adapter selon vos conventions)
    // /articles/pieces-auto/packshots/{ref}.webp
    if (!productRef) return null;

    const sanitizedRef = this.sanitizeFilename(productRef);
    return `articles/pieces-auto/packshots/${sanitizedRef}.webp`;
  }

  /**
   * Obtenir les chemins des images supplémentaires
   * TODO: Adapter selon votre structure de stockage réelle
   */
  private getAdditionalImagePaths(
    productRef: string,
  ): Array<{ path: string; type: ProductImageType }> {
    if (!productRef) return [];

    const sanitizedRef = this.sanitizeFilename(productRef);
    const images: Array<{ path: string; type: ProductImageType }> = [];

    // Vue de face
    images.push({
      path: `articles/pieces-auto/views/${sanitizedRef}-front.webp`,
      type: ProductImageType.FRONT,
    });

    // Vue de côté
    images.push({
      path: `articles/pieces-auto/views/${sanitizedRef}-side.webp`,
      type: ProductImageType.SIDE,
    });

    // Détail
    images.push({
      path: `articles/pieces-auto/details/${sanitizedRef}-detail.webp`,
      type: ProductImageType.DETAIL,
    });

    // Installation (si disponible)
    images.push({
      path: `articles/pieces-auto/installation/${sanitizedRef}-install.webp`,
      type: ProductImageType.INSTALLATION,
    });

    return images;
  }

  /**
   * Sanitizer un nom de fichier
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Vérifier si une image existe (à implémenter avec Supabase Storage)
   * Pour l'instant retourne true (optimiste)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async imageExists(_url: string): Promise<boolean> {
    // TODO: Implémenter vérification réelle avec Supabase Storage API
    // Pour l'instant, on assume que les images existent
    return true;
  }

  /**
   * Obtenir les statistiques des images
   */
  async getImageStats(): Promise<{
    totalImages: number;
    byType: Record<ProductImageType, number>;
  }> {
    // TODO: Implémenter avec vraie base de données
    return {
      totalImages: 0,
      byType: {} as Record<ProductImageType, number>,
    };
  }
}
