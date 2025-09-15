// 📁 backend/src/modules/catalog/services/image-processing.service.ts
// 🖼️ Service de traitement d'images avec Sharp

import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

export interface ImageResizeOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface ImageVariant {
  name: string;
  width: number;
  height: number;
  quality: number;
}

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);
  private readonly supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  /**
   * 🎨 Variants d'images prédéfinies pour les familles de produits
   */
  private readonly familyImageVariants: ImageVariant[] = [
    { name: 'thumbnail', width: 150, height: 150, quality: 80 },
    { name: 'card', width: 300, height: 200, quality: 85 },
    { name: 'hero', width: 600, height: 400, quality: 90 },
    { name: 'full', width: 1200, height: 800, quality: 95 },
  ];

  /**
   * 🔧 Redimensionne une image avec les options spécifiées
   */
  async resizeImage(
    inputBuffer: Buffer,
    options: ImageResizeOptions = {}
  ): Promise<Buffer> {
    const {
      width = 300,
      height = 200,
      quality = 85,
      format = 'webp',
      fit = 'cover'
    } = options;

    try {
      this.logger.log(`🔧 Redimensionnement: ${width}x${height}, qualité: ${quality}%, format: ${format}`);

      const result = await sharp(inputBuffer)
        .resize(width, height, { fit })
        .webp({ quality })
        .toBuffer();

      this.logger.log(`✅ Image redimensionnée: ${result.length} bytes`);
      return result;

    } catch (error) {
      this.logger.error('❌ Erreur redimensionnement:', error);
      throw new Error(`Erreur lors du redimensionnement: ${error.message}`);
    }
  }

  /**
   * 📥 Télécharge une image depuis Supabase Storage
   */
  async downloadImageFromSupabase(imagePath: string): Promise<Buffer> {
    try {
      this.logger.log(`📥 Téléchargement: ${imagePath}`);

      const { data, error } = await this.supabase.storage
        .from('uploads')
        .download(imagePath);

      if (error) {
        throw new Error(`Erreur téléchargement Supabase: ${error.message}`);
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      this.logger.log(`✅ Image téléchargée: ${buffer.length} bytes`);
      return buffer;

    } catch (error) {
      this.logger.error(`❌ Erreur téléchargement ${imagePath}:`, error);
      throw error;
    }
  }

  /**
   * 📤 Upload une image vers Supabase Storage
   */
  async uploadImageToSupabase(
    buffer: Buffer,
    uploadPath: string,
    contentType: string = 'image/webp'
  ): Promise<string> {
    try {
      this.logger.log(`📤 Upload: ${uploadPath}`);

      const { data, error } = await this.supabase.storage
        .from('uploads')
        .upload(uploadPath, buffer, {
          contentType,
          upsert: true
        });

      if (error) {
        throw new Error(`Erreur upload Supabase: ${error.message}`);
      }

      const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/uploads/${uploadPath}`;
      this.logger.log(`✅ Image uploadée: ${publicUrl}`);
      return publicUrl;

    } catch (error) {
      this.logger.error(`❌ Erreur upload ${uploadPath}:`, error);
      throw error;
    }
  }

  /**
   * 🎨 Génère toutes les variantes d'une image de famille
   */
  async generateFamilyImageVariants(originalImagePath: string): Promise<{
    variants: { [key: string]: string };
    stats: { originalSize: number; totalVariantsSize: number };
  }> {
    try {
      this.logger.log(`🎨 Génération variantes pour: ${originalImagePath}`);

      // Télécharger l'image originale
      const originalBuffer = await this.downloadImageFromSupabase(originalImagePath);
      const originalSize = originalBuffer.length;

      const variants: { [key: string]: string } = {};
      let totalVariantsSize = 0;

      // Générer chaque variante
      for (const variant of this.familyImageVariants) {
        const resizedBuffer = await this.resizeImage(originalBuffer, {
          width: variant.width,
          height: variant.height,
          quality: variant.quality,
          format: 'webp'
        });

        // Construire le chemin de la variante
        const basePath = originalImagePath.replace(/\.[^/.]+$/, ''); // Supprimer l'extension
        const variantPath = `${basePath}_${variant.name}.webp`;

        // Uploader la variante
        const variantUrl = await this.uploadImageToSupabase(
          resizedBuffer,
          variantPath,
          'image/webp'
        );

        variants[variant.name] = variantUrl;
        totalVariantsSize += resizedBuffer.length;

        this.logger.log(`✅ Variante ${variant.name}: ${variant.width}x${variant.height} (${resizedBuffer.length} bytes)`);
      }

      const stats = {
        originalSize,
        totalVariantsSize
      };

      this.logger.log(`🎨 Variantes générées: ${Object.keys(variants).length} variantes, économie: ${Math.round((1 - totalVariantsSize / originalSize) * 100)}%`);

      return { variants, stats };

    } catch (error) {
      this.logger.error(`❌ Erreur génération variantes ${originalImagePath}:`, error);
      throw error;
    }
  }

  /**
   * 🔄 Traite toutes les images de familles existantes
   */
  async processFamilyImages(): Promise<{
    processed: number;
    errors: string[];
    variants: { [imageName: string]: { [variant: string]: string } };
  }> {
    const familyImages = [
      'articles/familles-produits/Filtres.webp',
      'articles/familles-produits/Freinage.webp',
      'articles/familles-produits/Moteur.webp',
      // Ajoutez ici toutes vos images de familles
    ];

    const results = {
      processed: 0,
      errors: [] as string[],
      variants: {} as { [imageName: string]: { [variant: string]: string } }
    };

    for (const imagePath of familyImages) {
      try {
        const imageName = imagePath.split('/').pop()?.replace('.webp', '') || 'unknown';
        const { variants } = await this.generateFamilyImageVariants(imagePath);
        
        results.variants[imageName] = variants;
        results.processed++;

      } catch (error) {
        const errorMsg = `${imagePath}: ${error.message}`;
        results.errors.push(errorMsg);
        this.logger.error(`❌ Erreur traitement ${imagePath}:`, error);
      }
    }

    this.logger.log(`🔄 Traitement terminé: ${results.processed} réussies, ${results.errors.length} erreurs`);
    return results;
  }

  /**
   * 📊 Analyse une image (dimensions, taille, format)
   */
  async analyzeImage(imagePath: string): Promise<{
    width: number;
    height: number;
    size: number;
    format: string;
    density?: number;
  }> {
    try {
      const buffer = await this.downloadImageFromSupabase(imagePath);
      const metadata = await sharp(buffer).metadata();

      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        size: buffer.length,
        format: metadata.format || 'unknown',
        density: metadata.density
      };

    } catch (error) {
      this.logger.error(`❌ Erreur analyse ${imagePath}:`, error);
      throw error;
    }
  }
}