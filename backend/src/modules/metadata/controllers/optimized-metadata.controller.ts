/**
 * 📄 OPTIMIZED METADATA CONTROLLER - Contrôleur API Métadonnées
 *
 * ✅ API REST pour gestion des métadonnées
 *
 * Endpoints disponibles :
 * ✅ GET  /api/metadata/:path    → Récupérer métadonnées
 * ✅ PUT  /api/metadata/:path    → Mettre à jour métadonnées
 * ✅ DELETE /api/metadata/:path  → Supprimer métadonnées
 */

import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Logger,
} from '@nestjs/common';
import {
  OptimizedMetadataService,
  PageMetadata,
  MetadataUpdateData,
} from '../services/optimized-metadata.service';
import { OperationFailedException } from '../../../common/exceptions';

@Controller('api/metadata')
export class OptimizedMetadataController {
  private readonly logger = new Logger(OptimizedMetadataController.name);

  constructor(private readonly metadataService: OptimizedMetadataService) {
    this.logger.log('📄 OptimizedMetadataController initialisé');
  }

  /**
   * Récupérer les métadonnées d'une page
   * GET /api/metadata/:path
   */
  @Get(':path(.*)')
  async getMetadata(
    @Param('path') path: string,
  ): Promise<{ success: boolean; data: PageMetadata }> {
    try {
      const decodedPath = path ? '/' + decodeURIComponent(path) : '/';

      this.logger.debug(`📄 Récupération métadonnées pour: ${decodedPath}`);

      const metadata = await this.metadataService.getPageMetadata(decodedPath);

      return {
        success: true,
        data: metadata,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération métadonnées pour ${path}:`,
        error,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des métadonnées',
      });
    }
  }

  /**
   * Mettre à jour les métadonnées d'une page
   * PUT /api/metadata/:path
   */
  @Put(':path(.*)')
  async updateMetadata(
    @Param('path') path: string,
    @Body() updateData: MetadataUpdateData,
  ): Promise<{ success: boolean; data: PageMetadata }> {
    try {
      const decodedPath = path ? '/' + decodeURIComponent(path) : '/';

      this.logger.log(`💾 Mise à jour métadonnées pour: ${decodedPath}`);

      const metadata = await this.metadataService.updatePageMetadata(
        decodedPath,
        updateData,
      );

      return {
        success: true,
        data: metadata,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur mise à jour métadonnées pour ${path}:`,
        error,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la mise à jour des métadonnées',
      });
    }
  }

  /**
   * Supprimer les métadonnées d'une page
   * DELETE /api/metadata/:path
   */
  @Delete(':path(.*)')
  async deleteMetadata(
    @Param('path') path: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const decodedPath = path ? '/' + decodeURIComponent(path) : '/';

      this.logger.log(`🗑️ Suppression métadonnées pour: ${decodedPath}`);

      await this.metadataService.deletePageMetadata(decodedPath);

      return {
        success: true,
        message: 'Métadonnées supprimées avec succès',
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur suppression métadonnées pour ${path}:`,
        error,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la suppression des métadonnées',
      });
    }
  }
}
