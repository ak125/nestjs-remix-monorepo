/**
 * ⚡ SERVICE D'OPTIMISATION DES UPLOADS
 *
 * Optimisation automatique des fichiers et performances
 * Compression, redimensionnement et gestion de la bande passante
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadType } from '../dto/upload.dto';
import sharp from 'sharp';

export interface OptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'auto';
  progressive?: boolean;
  stripMetadata?: boolean;
  generateThumbnails?: boolean;
  thumbnailSizes?: number[];
}

export interface OptimizationResult {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  format: string;
  dimensions: {
    width: number;
    height: number;
  };
  thumbnails?: Array<{
    size: number;
    buffer: Buffer;
    width: number;
    height: number;
  }>;
  optimizedBuffer: Buffer;
  metadata: {
    optimizationTimeMs: number;
    savings: number;
    technique: string;
  };
}

@Injectable()
export class UploadOptimizationService {
  private readonly logger = new Logger(UploadOptimizationService.name);

  // Configuration par défaut selon le type d'upload
  private readonly defaultOptimization = {
    [UploadType.AVATAR]: {
      maxWidth: 512,
      maxHeight: 512,
      quality: 85,
      format: 'webp' as const,
      progressive: true,
      stripMetadata: true,
      generateThumbnails: true,
      thumbnailSizes: [64, 128, 256],
    },
    [UploadType.MEDIA]: {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 80,
      format: 'auto' as const,
      progressive: true,
      stripMetadata: false,
      generateThumbnails: true,
      thumbnailSizes: [200, 400, 800],
    },
    [UploadType.DOCUMENT]: {
      // Pas d'optimisation pour les documents
    },
    [UploadType.ATTACHMENT]: {
      // Optimisation légère si image détectée
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 90,
      format: 'auto' as const,
      progressive: false,
      stripMetadata: true,
    },
  };

  constructor(private readonly configService: ConfigService) {
    this.logger.log('⚡ UploadOptimizationService initialized');
  }

  /**
   * Optimise un fichier selon son type et les options
   */
  async optimizeFile(
    file: Express.Multer.File,
    uploadType: UploadType,
    customOptions?: OptimizationOptions,
  ): Promise<OptimizationResult | null> {
    const startTime = Date.now();

    // Vérification si le fichier est optimisable
    if (!this.isOptimizable(file)) {
      this.logger.debug(
        `⏭️ File ${file.originalname} is not optimizable (${file.mimetype})`,
      );
      return null;
    }

    try {
      this.logger.log(
        `⚡ Optimizing ${file.originalname} (${this.formatBytes(file.size)})`,
      );

      // Configuration d'optimisation
      const options = this.getOptimizationOptions(uploadType, customOptions);

      // Optimisation selon le type de fichier
      let result: OptimizationResult;

      if (this.isImage(file)) {
        result = await this.optimizeImage(file, options);
      } else {
        // Autres types de fichiers (future extension)
        return null;
      }

      // Enrichissement du résultat
      result.metadata.optimizationTimeMs = Date.now() - startTime;
      result.metadata.savings = result.originalSize - result.optimizedSize;

      this.logger.log(
        `✅ Optimization completed: ${this.formatBytes(result.originalSize)} → ${this.formatBytes(result.optimizedSize)} (${result.compressionRatio.toFixed(1)}% reduction) in ${result.metadata.optimizationTimeMs}ms`,
      );

      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `❌ Optimization failed for ${file.originalname}:`,
        message,
      );
      return null;
    }
  }

  /**
   * Optimise une image avec Sharp
   */
  private async optimizeImage(
    file: Express.Multer.File,
    options: OptimizationOptions,
  ): Promise<OptimizationResult> {
    const originalSize = file.size;
    let pipeline = sharp(file.buffer);

    // Obtention des métadonnées originales
    const metadata = await pipeline.metadata();
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;

    // Redimensionnement si nécessaire
    if (
      options.maxWidth ||
      options.maxHeight ||
      (originalWidth > 0 &&
        originalHeight > 0 &&
        (originalWidth > 2048 || originalHeight > 2048))
    ) {
      const resizeOptions: any = {};

      if (options.maxWidth) resizeOptions.width = options.maxWidth;
      if (options.maxHeight) resizeOptions.height = options.maxHeight;

      // Par défaut, conserver le ratio
      resizeOptions.fit = 'inside';
      resizeOptions.withoutEnlargement = true;

      pipeline = pipeline.resize(resizeOptions);
    }

    // Rotation automatique basée sur EXIF
    pipeline = pipeline.rotate();

    // Suppression des métadonnées si demandée
    if (options.stripMetadata) {
      pipeline = pipeline.withMetadata({ orientation: undefined });
    }

    // Détermination du format de sortie
    const outputFormat = this.determineOutputFormat(
      file.mimetype,
      options.format,
    );

    // Application du format et de la qualité
    switch (outputFormat) {
      case 'jpeg':
        pipeline = pipeline.jpeg({
          quality: options.quality || 80,
          progressive: options.progressive || false,
          mozjpeg: true, // Utilise mozjpeg pour une meilleure compression
        });
        break;

      case 'png':
        pipeline = pipeline.png({
          progressive: options.progressive || false,
          compressionLevel: Math.floor(
            ((100 - (options.quality || 80)) / 100) * 9,
          ),
        });
        break;

      case 'webp':
        pipeline = pipeline.webp({
          quality: options.quality || 80,
          effort: 4, // Balance entre vitesse et compression
        });
        break;
    }

    // Génération du buffer optimisé
    const optimizedBuffer = await pipeline.toBuffer();
    const optimizedMetadata = await sharp(optimizedBuffer).metadata();

    // Génération des thumbnails si demandée
    let thumbnails: OptimizationResult['thumbnails'];
    if (options.generateThumbnails && options.thumbnailSizes?.length) {
      thumbnails = await this.generateThumbnails(
        file.buffer,
        options.thumbnailSizes,
        outputFormat,
        options.quality || 80,
      );
    }

    const optimizedSize = optimizedBuffer.length;
    const compressionRatio =
      ((originalSize - optimizedSize) / originalSize) * 100;

    return {
      originalSize,
      optimizedSize,
      compressionRatio,
      format: outputFormat,
      dimensions: {
        width: optimizedMetadata.width || 0,
        height: optimizedMetadata.height || 0,
      },
      thumbnails,
      optimizedBuffer,
      metadata: {
        optimizationTimeMs: 0, // Sera rempli plus tard
        savings: 0, // Sera rempli plus tard
        technique: this.determineTechnique(
          originalWidth,
          originalHeight,
          optimizedMetadata.width || 0,
          optimizedMetadata.height || 0,
          outputFormat,
        ),
      },
    };
  }

  /**
   * Génère des thumbnails de différentes tailles
   */
  private async generateThumbnails(
    originalBuffer: Buffer,
    sizes: number[],
    format: string,
    quality: number,
  ): Promise<
    Array<{
      size: number;
      buffer: Buffer;
      width: number;
      height: number;
    }>
  > {
    const thumbnails = [];

    for (const size of sizes) {
      try {
        let pipeline = sharp(originalBuffer).resize(size, size, {
          fit: 'cover',
          position: 'centre',
        });

        // Application du format
        switch (format) {
          case 'jpeg':
            pipeline = pipeline.jpeg({ quality, mozjpeg: true });
            break;
          case 'png':
            pipeline = pipeline.png();
            break;
          case 'webp':
            pipeline = pipeline.webp({ quality });
            break;
        }

        const buffer = await pipeline.toBuffer();
        const metadata = await sharp(buffer).metadata();

        thumbnails.push({
          size,
          buffer,
          width: metadata.width || size,
          height: metadata.height || size,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`⚠️ Failed to generate thumbnail ${size}px:`, message);
      }
    }

    return thumbnails;
  }

  /**
   * Optimise un batch de fichiers
   */
  async optimizeBatch(
    files: Array<{
      file: Express.Multer.File;
      uploadType: UploadType;
      options?: OptimizationOptions;
    }>,
  ): Promise<
    Array<{
      originalFile: Express.Multer.File;
      result: OptimizationResult | null;
    }>
  > {
    this.logger.log(`⚡ Optimizing batch of ${files.length} files`);

    const results = await Promise.allSettled(
      files.map(async ({ file, uploadType, options }) => {
        const result = await this.optimizeFile(file, uploadType, options);
        return { originalFile: file, result };
      }),
    );

    const successful = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    const failed = results.filter((r) => r.status === 'rejected').length;

    this.logger.log(
      `✅ Batch optimization completed: ${successful.length} successful, ${failed} failed`,
    );

    return successful;
  }

  /**
   * Analyse un fichier pour recommander des optimisations
   */
  async analyzeFile(file: Express.Multer.File): Promise<{
    isOptimizable: boolean;
    currentFormat: string;
    recommendedFormat: string;
    estimatedSavings: number;
    recommendations: string[];
  }> {
    if (!this.isImage(file)) {
      return {
        isOptimizable: false,
        currentFormat: file.mimetype,
        recommendedFormat: file.mimetype,
        estimatedSavings: 0,
        recommendations: ["Fichier non-image, pas d'optimisation possible"],
      };
    }

    try {
      const metadata = await sharp(file.buffer).metadata();
      const recommendations: string[] = [];
      let estimatedSavings = 0;

      // Analyse de la taille
      if ((metadata.width || 0) > 1920 || (metadata.height || 0) > 1080) {
        recommendations.push('Redimensionner pour réduire la taille');
        estimatedSavings += 40;
      }

      // Analyse du format
      const recommendedFormat = this.getBestFormat(file.mimetype);
      if (recommendedFormat !== this.getFormatFromMime(file.mimetype)) {
        recommendations.push(
          `Convertir en ${recommendedFormat} pour une meilleure compression`,
        );
        estimatedSavings += 25;
      }

      // Analyse de la qualité
      if (file.size > 1024 * 1024) {
        // Fichiers > 1MB
        recommendations.push('Réduire la qualité pour diminuer la taille');
        estimatedSavings += 15;
      }

      // Analyse des métadonnées
      if (metadata.exif) {
        recommendations.push('Supprimer les métadonnées EXIF');
        estimatedSavings += 5;
      }

      return {
        isOptimizable: true,
        currentFormat: file.mimetype,
        recommendedFormat,
        estimatedSavings: Math.min(estimatedSavings, 70), // Cap à 70%
        recommendations,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `❌ Analysis failed for ${file.originalname}:`,
        message,
      );

      return {
        isOptimizable: false,
        currentFormat: file.mimetype,
        recommendedFormat: file.mimetype,
        estimatedSavings: 0,
        recommendations: ["Erreur lors de l'analyse"],
      };
    }
  }

  /**
   * Vérifie si un fichier peut être optimisé
   */
  private isOptimizable(file: Express.Multer.File): boolean {
    return this.isImage(file);
    // Peut être étendu pour d'autres types de fichiers
  }

  /**
   * Vérifie si le fichier est une image
   */
  private isImage(file: Express.Multer.File): boolean {
    return file.mimetype.startsWith('image/');
  }

  /**
   * Obtient les options d'optimisation
   */
  private getOptimizationOptions(
    uploadType: UploadType,
    customOptions?: OptimizationOptions,
  ): OptimizationOptions {
    const defaultOptions = this.defaultOptimization[uploadType] || {};
    return { ...defaultOptions, ...customOptions };
  }

  /**
   * Détermine le format de sortie optimal
   */
  private determineOutputFormat(
    inputMimeType: string,
    requestedFormat?: string,
  ): string {
    if (requestedFormat && requestedFormat !== 'auto') {
      return requestedFormat;
    }

    // Logique de sélection automatique
    if (inputMimeType === 'image/png') {
      return 'webp'; // WebP est généralement meilleur que PNG
    }

    if (inputMimeType === 'image/jpeg') {
      return 'webp'; // WebP est généralement meilleur que JPEG
    }

    if (inputMimeType === 'image/gif') {
      return 'png'; // Préserver la transparence potentielle
    }

    return 'webp'; // Par défaut, WebP est le plus polyvalent
  }

  /**
   * Obtient le meilleur format pour un type MIME donné
   */
  private getBestFormat(mimeType: string): string {
    const formatMap: { [key: string]: string } = {
      'image/jpeg': 'webp',
      'image/png': 'webp',
      'image/webp': 'webp',
      'image/gif': 'png',
    };

    return formatMap[mimeType] || 'webp';
  }

  /**
   * Extrait le format du type MIME
   */
  private getFormatFromMime(mimeType: string): string {
    return mimeType.split('/')[1];
  }

  /**
   * Détermine la technique d'optimisation utilisée
   */
  private determineTechnique(
    originalWidth: number,
    originalHeight: number,
    optimizedWidth: number,
    optimizedHeight: number,
    outputFormat: string,
  ): string {
    const techniques = [];

    if (optimizedWidth < originalWidth || optimizedHeight < originalHeight) {
      techniques.push('Redimensionnement');
    }

    if (outputFormat === 'webp') {
      techniques.push('Conversion WebP');
    }

    techniques.push('Compression');

    return techniques.join(' + ');
  }

  /**
   * Formate les bytes en format lisible
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Obtient les statistiques d'optimisation globales
   */
  getOptimizationStats(): {
    supportedFormats: string[];
    defaultSettings: Record<UploadType, any>;
    capabilities: string[];
  } {
    return {
      supportedFormats: ['JPEG', 'PNG', 'WebP', 'GIF'],
      defaultSettings: this.defaultOptimization,
      capabilities: [
        'Redimensionnement intelligent',
        'Compression avec perte et sans perte',
        'Génération de thumbnails',
        'Conversion de format',
        'Suppression de métadonnées',
        'Optimisation progressive',
      ],
    };
  }
}
