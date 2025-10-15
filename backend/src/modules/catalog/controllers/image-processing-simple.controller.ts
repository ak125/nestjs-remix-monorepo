// 📁 backend/src/modules/catalog/controllers/image-processing.controller.ts
// 🖼️ Contrôleur simplifié pour le traitement d'images

import { Controller, Get, Param, Logger } from '@nestjs/common';

@Controller('catalog/images')
export class ImageProcessingController {
  private readonly logger = new Logger(ImageProcessingController.name);

  /**
   * 🔍 GET /api/catalog/images/test - Test de base
   */
  @Get('test')
  async test() {
    this.logger.log('🔍 [GET] /api/catalog/images/test');
    return {
      success: true,
      message: "Service de traitement d'images opérationnel",
      endpoints: [
        'GET /api/catalog/images/test',
        'GET /api/catalog/images/info/:imageName',
      ],
    };
  }

  /**
   * 📊 GET /api/catalog/images/info/:imageName - Infos image
   */
  @Get('info/:imageName')
  async getImageInfo(@Param('imageName') imageName: string) {
    this.logger.log(`📊 [GET] /api/catalog/images/info/${imageName}`);

    try {
      const imageUrl = `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/familles-produits/${imageName}.webp`;

      return {
        success: true,
        data: {
          name: imageName,
          url: imageUrl,
          format: 'webp',
          path: `articles/familles-produits/${imageName}.webp`,
        },
        message: `Informations pour ${imageName}`,
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur info ${imageName}:`, error);
      return {
        success: false,
        error: error?.message || 'Erreur inconnue',
      };
    }
  }
}
