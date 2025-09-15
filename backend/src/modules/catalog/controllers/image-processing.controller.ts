// 📁 backend/src/modules/catalog/controllers/image-processing.controller.ts
// 🖼️ Contrôleur pour le traitement d'images

import { Controller, Get, Post, Param, Query, Logger } from '@nestjs/common';
import { ImageProcessingService } from '../services/image-processing.service';

@Controller('catalog/images')
export class ImageProcessingController {
  private readonly logger = new Logger(ImageProcessingController.name);

  constructor(private readonly imageService: ImageProcessingService) {}

  /**
   * 📊 GET /api/catalog/images/analyze/:imageName - Analyser une image
   */
  @Get('analyze/:imageName')
  async analyzeImage(@Param('imageName') imageName: string) {
    this.logger.log(`📊 [GET] /api/catalog/images/analyze/${imageName}`);
    
    try {
      const imagePath = `articles/familles-produits/${imageName}.webp`;
      const analysis = await this.imageService.analyzeImage(imagePath);
      
      this.logger.log(`✅ Image ${imageName} analysée: ${analysis.width}x${analysis.height}`);
      return {
        success: true,
        data: analysis,
        message: `Analyse de ${imageName} terminée`
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur analyse ${imageName}:`, error);
      return {
        success: false,
        data: null,
        error: error?.message || 'Erreur inconnue'
      };
    }
  }

  /**
   * 🎨 POST /api/catalog/images/variants/:imageName - Générer variantes
   */
  @Post('variants/:imageName')
  async generateVariants(@Param('imageName') imageName: string) {
    this.logger.log(`🎨 [POST] /api/catalog/images/variants/${imageName}`);
    
    try {
      const imagePath = `articles/familles-produits/${imageName}.webp`;
      const result = await this.imageService.generateFamilyImageVariants(imagePath);
      
      this.logger.log(`✅ Variantes générées pour ${imageName}: ${Object.keys(result.variants).length} variantes`);
      return {
        success: true,
        data: result,
        message: `Variantes de ${imageName} générées avec succès`
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur variantes ${imageName}:`, error);
      return {
        success: false,
        data: null,
        error: error?.message || 'Erreur inconnue'
      };
    }
  }

  /**
   * 🔄 POST /api/catalog/images/process-all - Traiter toutes les images
   */
  @Post('process-all')
  async processAllImages() {
    this.logger.log('🔄 [POST] /api/catalog/images/process-all');
    
    try {
      const result = await this.imageService.processFamilyImages();
      
      this.logger.log(`✅ Traitement global terminé: ${result.processed} images`);
      return {
        success: true,
        data: result,
        message: `${result.processed} images traitées avec succès`
      };
    } catch (error: any) {
      this.logger.error('❌ Erreur traitement global:', error);
      return {
        success: false,
        data: null,
        error: error?.message || 'Erreur inconnue'
      };
    }
  }

  /**
   * 🔧 POST /api/catalog/images/resize/:imageName - Redimensionner une image
   */
  @Post('resize/:imageName')
  async resizeImage(
    @Param('imageName') imageName: string,
    @Query('width') width?: string,
    @Query('height') height?: string,
    @Query('quality') quality?: string
  ) {
    this.logger.log(`🔧 [POST] /api/catalog/images/resize/${imageName}`);
    
    try {
      const imagePath = `articles/familles-produits/${imageName}.webp`;
      
      // Télécharger l'image originale
      const originalBuffer = await this.imageService.downloadImageFromSupabase(imagePath);
      
      // Options de redimensionnement
      const resizeOptions = {
        width: width ? parseInt(width) : 300,
        height: height ? parseInt(height) : 200,
        quality: quality ? parseInt(quality) : 85
      };

      // Redimensionner
      const resizedBuffer = await this.imageService.resizeImage(originalBuffer, resizeOptions);
      
      // Uploader la version redimensionnée
      const resizedPath = `articles/familles-produits/${imageName}_resized_${resizeOptions.width}x${resizeOptions.height}.webp`;
      const url = await this.imageService.uploadImageToSupabase(resizedBuffer, resizedPath);
      
      this.logger.log(`✅ Image ${imageName} redimensionnée: ${resizeOptions.width}x${resizeOptions.height}`);
      return {
        success: true,
        data: {
          originalPath: imagePath,
          resizedPath,
          url,
          options: resizeOptions,
          originalSize: originalBuffer.length,
          resizedSize: resizedBuffer.length,
          compressionRatio: Math.round((1 - resizedBuffer.length / originalBuffer.length) * 100)
        },
        message: `Image ${imageName} redimensionnée avec succès`
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur redimensionnement ${imageName}:`, error);
      return {
        success: false,
        data: null,
        error: error?.message || 'Erreur inconnue'
      };
    }
  }
}