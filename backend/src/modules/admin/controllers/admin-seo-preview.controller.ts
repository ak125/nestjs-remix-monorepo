/**
 * 🔍 Admin SEO Preview Controller
 *
 * API pour prévisualiser les templates SEO interpolés avant déploiement.
 * Permet de détecter les variables non-interpolées avant qu'elles n'arrivent en production.
 */

import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import {
  AdminSeoPreviewService,
  VehicleOption,
  SeoPreviewResult,
} from '../services/admin-seo-preview.service';

interface SeoPreviewResponse {
  success: boolean;
  data: SeoPreviewResult | null;
  timestamp: string;
  error?: string;
}

interface VehiclesResponse {
  success: boolean;
  data: VehicleOption[];
}

@Controller('api/admin/seo-preview')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminSeoPreviewController {
  private readonly logger = new Logger(AdminSeoPreviewController.name);

  constructor(private readonly seoPreviewService: AdminSeoPreviewService) {}

  /**
   * 🚗 Liste des véhicules de test pour une gamme
   *
   * GET /api/admin/seo-preview/:pgId/vehicles
   */
  @Get(':pgId/vehicles')
  async getTestVehicles(
    @Param('pgId', ParseIntPipe) pgId: number,
  ): Promise<VehiclesResponse> {
    try {
      const vehicles = await this.seoPreviewService.getTestVehicles(pgId);
      return { success: true, data: vehicles };
    } catch (error) {
      this.logger.error('Erreur getTestVehicles:', error);
      return { success: false, data: [] };
    }
  }

  /**
   * 🔍 Prévisualisation SEO complète
   *
   * GET /api/admin/seo-preview/:pgId/:typeId
   */
  @Get(':pgId/:typeId')
  async previewSeo(
    @Param('pgId', ParseIntPipe) pgId: number,
    @Param('typeId', ParseIntPipe) typeId: number,
  ): Promise<SeoPreviewResponse> {
    const startTime = Date.now();

    try {
      const result = await this.seoPreviewService.previewSeo(pgId, typeId);

      const duration = Date.now() - startTime;
      this.logger.log(
        `🔍 SEO Preview généré en ${duration}ms - pg=${pgId} type=${typeId} - valid=${result.isValid}`,
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur SEO Preview pg=${pgId} type=${typeId}:`,
        error,
      );
      return {
        success: false,
        data: null,
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      };
    }
  }
}
