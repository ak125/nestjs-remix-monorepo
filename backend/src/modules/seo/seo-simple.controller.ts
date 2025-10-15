/**
 * 🎯 SEO Simple Controller - Version Consolidée
 *
 * Contrôleur simplifié pour le SEO sans les erreurs complexes
 * Focus sur la stabilité et les fonctionnalités essentielles
 */

import { Controller, Get, Query, Logger } from '@nestjs/common';

import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('🎯 SEO Simple V5')
@Controller('seo-simple-v5')
export class SeoSimpleController {
  private readonly logger = new Logger(SeoSimpleController.name);

  @Get('generate')
  @ApiOperation({
    summary: 'Génère SEO simple et stable',
    description: 'Version consolidée du SEO V5 sans complexités',
  })
  @ApiQuery({
    name: 'gamme',
    required: true,
    type: 'string',
    example: 'courroie-d-accessoire',
  })
  @ApiQuery({
    name: 'marque',
    required: true,
    type: 'string',
    example: 'bmw',
  })
  @ApiQuery({
    name: 'modele',
    required: true,
    type: 'string',
    example: 'serie-3',
  })
  @ApiQuery({
    name: 'type',
    required: true,
    type: 'string',
    example: '320i',
  })
  async generateSimpleSeo(
    @Query('gamme') gamme: string,
    @Query('marque') marque: string,
    @Query('modele') modele: string,
    @Query('type') type: string,
  ) {
    try {
      this.logger.log(
        `🎯 Génération SEO simple pour ${gamme}/${marque}/${modele}/${type}`,
      );

      return {
        success: true,
        seo: {
          title: `${gamme} pour ${marque} ${modele} ${type}`,
          h1: `${gamme} pour ${marque} ${modele} ${type} - Guide Complet 2024`,
          description: `Pièces ${gamme} compatibles avec ${marque} ${modele} ${type}. Qualité OE et aftermarket.`,
          longDescription: `Découvrez notre sélection exclusive de ${gamme} spécialement conçus pour ${marque} ${modele} ${type}.
      
      Profitez de tarifs jusqu'à 40% moins chers qu'en concession, sans aucun compromis sur la qualité.`,
          technicalSpecs: [
            `Compatibilité vérifiée avec ${marque} ${modele} ${type}`,
            'Pièces certifiées aux normes européennes CE',
            'Garantie constructeur 2 ans minimum',
            'Livraison express 24-48h partout en France',
            'Support technique spécialisé 6j/7',
          ],
        },
        metadata: {
          source: 'seo-simple-v5',
          responseTime: 50,
          version: '5.0-simple',
        },
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Erreur SEO simple: ${err.message}`);

      return {
        success: false,
        error: err.message,
        metadata: {
          source: 'seo-simple-v5-error',
          responseTime: 0,
        },
      };
    }
  }

  @Get('health')
  @ApiOperation({
    summary: 'Status de santé SEO Simple',
    description: 'Vérifie que le service SEO simple fonctionne',
  })
  async getHealth() {
    return {
      status: 'healthy',
      service: 'seo-simple-v5',
      version: '5.0-simple',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
