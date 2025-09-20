/**
 * 🖼️ SERVICE DE TRAITEMENT D'IMAGES
 *
 * Traitement avancé d'images avec Sharp
 * Redimensionnement, filtres, transformations et génération de variantes
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';

export interface ImageProcessingOptions {
  resize?: {
    width?: number;
    height?: number;
    fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside';
    position?: string;
    withoutEnlargement?: boolean;
  };
  format?: {
    type: 'jpeg' | 'png' | 'webp' | 'avif';
    quality?: number;
    progressive?: boolean;
  };
  filters?: {
    blur?: number;
    sharpen?: boolean;
    brightness?: number;
    contrast?: number;
    saturation?: number;
    hue?: number;
    grayscale?: boolean;
  };
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  rotate?: number;
  flip?: {
    horizontal?: boolean;
    vertical?: boolean;
  };
  watermark?: {
    text?: string;
    image?: Buffer;
    position?:
      | 'top-left'
      | 'top-right'
      | 'bottom-left'
      | 'bottom-right'
      | 'center';
    opacity?: number;
  };
  metadata?: {
    strip?: boolean;
    preserve?: string[];
  };
}

export interface ProcessingResult {
  buffer: Buffer;
  format: string;
  size: number;
  dimensions: {
    width: number;
    height: number;
  };
  originalSize: number;
  compressionRatio: number;
  processingTime: number;
  operations: string[];
}

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);

  constructor(private configService: ConfigService) {
    this.logger.log('🖼️ ImageProcessingService initialized');
  }

  /**
   * Traite une image selon les options spécifiées
   */
  async processImage(
    imageBuffer: Buffer,
    options: ImageProcessingOptions,
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const operations: string[] = [];

    try {
      let pipeline = sharp(imageBuffer);
      const originalMetadata = await pipeline.metadata();
      const originalSize = imageBuffer.length;

      this.logger.log(
        `🖼️ Processing image: ${originalMetadata.width}x${originalMetadata.height} (${this.formatBytes(originalSize)})`,
      );

      // 1. Rotation
      if (options.rotate) {
        pipeline = pipeline.rotate(options.rotate);
        operations.push(`Rotation ${options.rotate}°`);
      }

      // 2. Flip/Mirror
      if (options.flip?.horizontal) {
        pipeline = pipeline.flop();
        operations.push('Miroir horizontal');
      }
      if (options.flip?.vertical) {
        pipeline = pipeline.flip();
        operations.push('Miroir vertical');
      }

      // 3. Crop
      if (options.crop) {
        pipeline = pipeline.extract({
          left: options.crop.x,
          top: options.crop.y,
          width: options.crop.width,
          height: options.crop.height,
        });
        operations.push(
          `Recadrage ${options.crop.width}x${options.crop.height}`,
        );
      }

      // 4. Redimensionnement
      if (options.resize) {
        const resizeOptions: any = {
          width: options.resize.width,
          height: options.resize.height,
          fit: options.resize.fit || 'cover',
          withoutEnlargement: options.resize.withoutEnlargement !== false,
        };

        if (options.resize.position) {
          resizeOptions.position = options.resize.position;
        }

        pipeline = pipeline.resize(resizeOptions);
        operations.push(
          `Redimensionnement ${options.resize.width || 'auto'}x${options.resize.height || 'auto'}`,
        );
      }

      // 5. Filtres
      if (options.filters) {
        pipeline = await this.applyFilters(
          pipeline,
          options.filters,
          operations,
        );
      }

      // 6. Filigrane
      if (options.watermark) {
        pipeline = await this.applyWatermark(
          pipeline,
          options.watermark,
          operations,
        );
      }

      // 7. Métadonnées
      if (options.metadata?.strip) {
        pipeline = pipeline.removeExifMetadata();
        operations.push('Suppression métadonnées');
      }

      // 8. Format de sortie
      if (options.format) {
        pipeline = this.applyOutputFormat(pipeline, options.format, operations);
      }

      // Génération du résultat
      const processedBuffer = await pipeline.toBuffer();
      const finalMetadata = await sharp(processedBuffer).metadata();

      const processingTime = Date.now() - startTime;
      const compressionRatio =
        ((originalSize - processedBuffer.length) / originalSize) * 100;

      const result: ProcessingResult = {
        buffer: processedBuffer,
        format: finalMetadata.format || 'unknown',
        size: processedBuffer.length,
        dimensions: {
          width: finalMetadata.width || 0,
          height: finalMetadata.height || 0,
        },
        originalSize,
        compressionRatio,
        processingTime,
        operations,
      };

      this.logger.log(
        `✅ Image processing completed: ${this.formatBytes(originalSize)} → ${this.formatBytes(processedBuffer.length)} (${compressionRatio.toFixed(1)}% reduction) in ${processingTime}ms`,
      );

      return result;
    } catch (error: any) {
      this.logger.error('❌ Image processing failed:', error.message);
      throw new Error(`Échec du traitement d'image: ${error.message}`);
    }
  }

  /**
   * Génère plusieurs variantes d'une image
   */
  async generateVariants(
    imageBuffer: Buffer,
    variants: Array<{
      name: string;
      options: ImageProcessingOptions;
    }>,
  ): Promise<
    Array<{
      name: string;
      result: ProcessingResult;
    }>
  > {
    this.logger.log(`🖼️ Generating ${variants.length} image variants`);

    const results = await Promise.allSettled(
      variants.map(async (variant) => {
        const result = await this.processImage(imageBuffer, variant.options);
        return { name: variant.name, result };
      }),
    );

    const successful = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    const failed = results.filter((r) => r.status === 'rejected').length;

    this.logger.log(
      `✅ Variants generation completed: ${successful.length} successful, ${failed} failed`,
    );

    return successful;
  }

  /**
   * Crée des thumbnails de différentes tailles
   */
  async createThumbnails(
    imageBuffer: Buffer,
    sizes: number[],
    options?: {
      format?: 'jpeg' | 'png' | 'webp';
      quality?: number;
      crop?: boolean;
    },
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
        const processingOptions: ImageProcessingOptions = {
          resize: {
            width: size,
            height: size,
            fit: options?.crop ? 'cover' : 'inside',
            withoutEnlargement: true,
          },
          format: {
            type: options?.format || 'webp',
            quality: options?.quality || 85,
          },
          metadata: {
            strip: true,
          },
        };

        const result = await this.processImage(imageBuffer, processingOptions);

        thumbnails.push({
          size,
          buffer: result.buffer,
          width: result.dimensions.width,
          height: result.dimensions.height,
        });
      } catch (error: any) {
        this.logger.warn(
          `⚠️ Failed to create thumbnail ${size}px:`,
          error.message,
        );
      }
    }

    return thumbnails;
  }

  /**
   * Optimise une image pour le web
   */
  async optimizeForWeb(
    imageBuffer: Buffer,
    options?: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
      format?: 'auto' | 'jpeg' | 'webp' | 'avif';
    },
  ): Promise<ProcessingResult> {
    const maxWidth = options?.maxWidth || 1920;
    const maxHeight = options?.maxHeight || 1080;
    const quality = options?.quality || 80;

    // Détermination du format optimal
    let format: 'jpeg' | 'webp' | 'avif';
    if (options?.format === 'auto') {
      format = this.getBestWebFormat();
    } else {
      format = (options?.format as any) || 'webp';
    }

    const processingOptions: ImageProcessingOptions = {
      resize: {
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      },
      format: {
        type: format,
        quality,
        progressive: true,
      },
      metadata: {
        strip: true,
      },
    };

    return await this.processImage(imageBuffer, processingOptions);
  }

  /**
   * Analyse une image et recommande des optimisations
   */
  async analyzeImage(imageBuffer: Buffer): Promise<{
    metadata: sharp.Metadata;
    recommendations: string[];
    estimatedSavings: number;
    fileSize: number;
  }> {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      const recommendations: string[] = [];
      let estimatedSavings = 0;

      // Analyse de la taille
      const width = metadata.width || 0;
      const height = metadata.height || 0;

      if (width > 1920 || height > 1080) {
        recommendations.push('Redimensionner pour le web (1920x1080 max)');
        estimatedSavings += 40;
      }

      // Analyse du format
      if (metadata.format === 'png' && !metadata.hasAlpha) {
        recommendations.push(
          'Convertir en JPEG (pas de transparence détectée)',
        );
        estimatedSavings += 30;
      }

      if (metadata.format === 'jpeg' || metadata.format === 'png') {
        recommendations.push(
          'Convertir en WebP pour une meilleure compression',
        );
        estimatedSavings += 25;
      }

      // Analyse de la densité
      if ((metadata.density || 72) > 150) {
        recommendations.push('Réduire la densité à 72 DPI pour le web');
        estimatedSavings += 15;
      }

      // Analyse des métadonnées
      if (metadata.exif || metadata.icc || metadata.xmp) {
        recommendations.push('Supprimer les métadonnées inutiles');
        estimatedSavings += 10;
      }

      // Analyse de la qualité (estimation basée sur la taille)
      const pixelCount = width * height;
      const expectedSize = pixelCount * 3; // 3 bytes par pixel RGB
      const compressionRatio = imageBuffer.length / expectedSize;

      if (compressionRatio > 0.3) {
        recommendations.push('Réduire la qualité JPEG');
        estimatedSavings += 20;
      }

      return {
        metadata,
        recommendations,
        estimatedSavings: Math.min(estimatedSavings, 70),
        fileSize: imageBuffer.length,
      };
    } catch (error: any) {
      this.logger.error('❌ Image analysis failed:', error.message);
      throw new Error(`Échec de l'analyse d'image: ${error.message}`);
    }
  }

  /**
   * Applique des filtres à l'image
   */
  private async applyFilters(
    pipeline: sharp.Sharp,
    filters: ImageProcessingOptions['filters'],
    operations: string[],
  ): Promise<sharp.Sharp> {
    if (!filters) return pipeline;

    // Flou
    if (filters.blur && filters.blur > 0) {
      pipeline = pipeline.blur(filters.blur);
      operations.push(`Flou ${filters.blur}px`);
    }

    // Accentuation
    if (filters.sharpen) {
      pipeline = pipeline.sharpen();
      operations.push('Accentuation');
    }

    // Niveaux de gris
    if (filters.grayscale) {
      pipeline = pipeline.grayscale();
      operations.push('Niveaux de gris');
    }

    // Modulation (luminosité, contraste, saturation, teinte)
    const modulations: any = {};
    let hasModulation = false;

    if (filters.brightness !== undefined) {
      modulations.brightness = filters.brightness;
      hasModulation = true;
      operations.push(`Luminosité ${filters.brightness}`);
    }

    if (filters.contrast !== undefined) {
      modulations.contrast = filters.contrast;
      hasModulation = true;
      operations.push(`Contraste ${filters.contrast}`);
    }

    if (filters.saturation !== undefined) {
      modulations.saturation = filters.saturation;
      hasModulation = true;
      operations.push(`Saturation ${filters.saturation}`);
    }

    if (filters.hue !== undefined) {
      modulations.hue = filters.hue;
      hasModulation = true;
      operations.push(`Teinte ${filters.hue}°`);
    }

    if (hasModulation) {
      pipeline = pipeline.modulate(modulations);
    }

    return pipeline;
  }

  /**
   * Applique un filigrane à l'image
   */
  private async applyWatermark(
    pipeline: sharp.Sharp,
    watermark: ImageProcessingOptions['watermark'],
    operations: string[],
  ): Promise<sharp.Sharp> {
    if (!watermark) return pipeline;

    if (watermark.text) {
      // Filigrane texte (nécessiterait une fonte, implémentation simplifiée)
      operations.push(`Filigrane texte: ${watermark.text}`);
      // TODO: Implémenter le filigrane texte avec SVG
    }

    if (watermark.image) {
      const gravity = this.convertWatermarkPosition(watermark.position);
      pipeline = pipeline.composite([
        {
          input: watermark.image,
          gravity,
          blend: 'over',
        },
      ]);
      operations.push('Filigrane image');
    }

    return pipeline;
  }

  /**
   * Applique le format de sortie
   */
  private applyOutputFormat(
    pipeline: sharp.Sharp,
    format: ImageProcessingOptions['format'],
    operations: string[],
  ): sharp.Sharp {
    if (!format) return pipeline;

    switch (format.type) {
      case 'jpeg':
        pipeline = pipeline.jpeg({
          quality: format.quality || 80,
          progressive: format.progressive || false,
          mozjpeg: true,
        });
        break;

      case 'png':
        pipeline = pipeline.png({
          progressive: format.progressive || false,
          compressionLevel: this.qualityToCompressionLevel(
            format.quality || 80,
          ),
        });
        break;

      case 'webp':
        pipeline = pipeline.webp({
          quality: format.quality || 80,
          effort: 4,
        });
        break;

      case 'avif':
        pipeline = pipeline.avif({
          quality: format.quality || 80,
          effort: 4,
        });
        break;
    }

    operations.push(`Format ${format.type.toUpperCase()}`);
    return pipeline;
  }

  /**
   * Convertit la position du filigrane en gravity Sharp
   */
  private convertWatermarkPosition(position?: string): string {
    const positionMap: { [key: string]: string } = {
      'top-left': 'northwest',
      'top-right': 'northeast',
      'bottom-left': 'southwest',
      'bottom-right': 'southeast',
      center: 'center',
    };

    return positionMap[position || 'bottom-right'] || 'southeast';
  }

  /**
   * Convertit la qualité en niveau de compression PNG
   */
  private qualityToCompressionLevel(quality: number): number {
    // Conversion inverse: qualité élevée = compression faible
    return Math.floor(((100 - quality) / 100) * 9);
  }

  /**
   * Détermine le meilleur format pour le web
   */
  private getBestWebFormat(): 'webp' | 'avif' | 'jpeg' {
    // En pratique, on pourrait vérifier le support du navigateur
    // Pour l'instant, WebP est le plus universel
    return 'webp';
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
   * Obtient les capacités du service
   */
  getCapabilities(): {
    supportedInputFormats: string[];
    supportedOutputFormats: string[];
    maxDimensions: { width: number; height: number };
    availableFilters: string[];
    availableTransforms: string[];
  } {
    return {
      supportedInputFormats: [
        'JPEG',
        'PNG',
        'WebP',
        'GIF',
        'AVIF',
        'TIFF',
        'SVG',
      ],
      supportedOutputFormats: ['JPEG', 'PNG', 'WebP', 'AVIF'],
      maxDimensions: { width: 16383, height: 16383 }, // Limites Sharp
      availableFilters: [
        'blur',
        'sharpen',
        'brightness',
        'contrast',
        'saturation',
        'hue',
        'grayscale',
      ],
      availableTransforms: [
        'resize',
        'crop',
        'rotate',
        'flip',
        'mirror',
        'watermark',
      ],
    };
  }
}
