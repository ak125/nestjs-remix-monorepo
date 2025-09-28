import { Controller, Get, Logger, Param, HttpException, HttpStatus, Query } from '@nestjs/common';
import { CrossSellingServiceV5Ultimate } from './cross-selling-v5-ultimate.service';

/**
 * 🎯 CONTRÔLEUR CROSS-SELLING V5 - ROUTES PUBLIQUES
 * 
 * Ce contrôleur expose les endpoints cross-selling attendus par le frontend :
 * - GET /api/cross-selling/v5/:typeId/:pgId
 * - GET /api/cross-selling/v5/by-alias (avec query params)
 * 
 * Il utilise le service CrossSellingServiceV5Ultimate existant
 */
@Controller('api/cross-selling')
export class CrossSellingController {
  private readonly logger = new Logger(CrossSellingController.name);

  constructor(
    private readonly crossSellingV5Service: CrossSellingServiceV5Ultimate,
  ) {}

  /**
   * Cross-selling V5 par IDs
   * Route attendue par le frontend: /api/cross-selling/v5/${typeId}/${pgId}
   */
  @Get('v5/:typeId/:pgId')
  async getCrossSellingV5ByIds(
    @Param('typeId') typeId: string,
    @Param('pgId') pgId: string,
  ) {
    try {
      this.logger.log(
        `Cross-selling V5 demandé pour typeId=${typeId}, pgId=${pgId}`,
      );

      // Valeurs par défaut pour mfId si non spécifié
      const defaultMfId = 1;

      return await this.crossSellingV5Service.getAdvancedCrossGammes(
        parseInt(pgId),
        parseInt(typeId),
        defaultMfId,
        {
          includeFamily: true,
          includeConfig: true,
          includeSeo: true,
          maxResults: 20,
        },
      );
    } catch (error) {
      this.logger.error(
        `Erreur cross-selling V5 pour typeId=${typeId}, pgId=${pgId}:`,
        error,
      );
      throw new HttpException(
        'Erreur lors du calcul du cross-selling V5',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Cross-selling V5 par alias/params
   * Route: /api/cross-selling/v5/by-alias?gamme=freins&marque=bmw&modele=serie-3&type=berline
   */
  @Get('v5/by-alias')
  async getCrossSellingV5ByAlias(
    @Query('gamme') gamme: string,
    @Query('marque') marque: string,
    @Query('modele') modele: string,
    @Query('type') type: string,
  ) {
    try {
      this.logger.log(
        `Cross-selling V5 alias demandé: gamme=${gamme}, marque=${marque}, modele=${modele}, type=${type}`,
      );

      // TODO: Ici on devrait résoudre les alias vers les IDs
      // Pour l'instant, on utilise des valeurs par défaut
      const defaultPgId = 1;
      const defaultTypeId = 1;
      const defaultMfId = 1;

      return await this.crossSellingV5Service.getAdvancedCrossGammes(
        defaultPgId,
        defaultTypeId,
        defaultMfId,
        {
          includeFamily: true,
          includeConfig: true,
          includeSeo: true,
          maxResults: 20,
        },
      );
    } catch (error) {
      this.logger.error(
        `Erreur cross-selling V5 alias pour gamme=${gamme}:`,
        error,
      );
      throw new HttpException(
        'Erreur lors du calcul du cross-selling V5 par alias',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}