/**
 * 🔧 ADMIN GAMMES SEO - UPDATE CONTROLLER
 *
 * Write endpoints: single update, batch update, predefined actions
 * - PATCH /api/admin/gammes-seo/:id     → Mise à jour d'une gamme
 * - PATCH /api/admin/gammes-seo/batch   → Mise à jour en masse
 * - POST  /api/admin/gammes-seo/action  → Appliquer action prédéfinie
 */

import {
  Controller,
  Patch,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import {
  AdminGammesSeoService,
  GammeSeoUpdateData,
} from '../services/admin-gammes-seo.service';

@Controller('api/admin/gammes-seo')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminGammesSeoUpdateController {
  private readonly logger = new Logger(AdminGammesSeoUpdateController.name);

  constructor(private readonly gammesSeoService: AdminGammesSeoService) {}

  /**
   * 🔧 PATCH /api/admin/gammes-seo/:id
   * Mise à jour d'une gamme
   */
  @Patch(':id')
  async updateGamme(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: GammeSeoUpdateData,
  ) {
    try {
      this.logger.log(`🔧 PATCH /api/admin/gammes-seo/${id}`);

      const result = await this.gammesSeoService.updateGamme(id, updateData);

      return {
        success: result.success,
        message: result.message,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Error updating gamme ${id}:`, error);
      throw new HttpException(
        {
          success: false,
          message: `Erreur lors de la mise à jour de la gamme ${id}`,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔧 PATCH /api/admin/gammes-seo/batch
   * Mise à jour en masse
   */
  @Patch('batch')
  async batchUpdate(
    @Body() body: { pgIds: number[]; updateData: GammeSeoUpdateData },
  ) {
    try {
      this.logger.log(
        `🔧 PATCH /api/admin/gammes-seo/batch (${body.pgIds?.length} gammes)`,
      );

      if (
        !body.pgIds ||
        !Array.isArray(body.pgIds) ||
        body.pgIds.length === 0
      ) {
        throw new HttpException(
          { success: false, message: 'pgIds requis (tableau non vide)' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.gammesSeoService.batchUpdate(
        body.pgIds,
        body.updateData,
      );

      return {
        success: result.success,
        message: result.message,
        updated: result.updated,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error in batch update:', error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la mise à jour en masse',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🚀 POST /api/admin/gammes-seo/action
   * Appliquer une action prédéfinie (avec audit)
   */
  @Post('action')
  async applyPredefinedAction(
    @Req() req: Request,
    @Body() body: { pgIds: number[]; actionId: string },
  ) {
    try {
      this.logger.log(
        `🚀 POST /api/admin/gammes-seo/action (${body.actionId})`,
      );

      if (
        !body.pgIds ||
        !Array.isArray(body.pgIds) ||
        body.pgIds.length === 0
      ) {
        throw new HttpException(
          { success: false, message: 'pgIds requis (tableau non vide)' },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!body.actionId) {
        throw new HttpException(
          { success: false, message: 'actionId requis' },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Extract admin info from session for audit logging
      const user = (req as any).user;
      const adminInfo = user
        ? { id: user.cst_id || user.id, email: user.cst_email || user.email }
        : undefined;

      const result = await this.gammesSeoService.applyPredefinedAction(
        body.pgIds,
        body.actionId,
        adminInfo,
      );

      return {
        success: result.success,
        message: result.message,
        updated: result.updated,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error applying predefined action:', error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          message: "Erreur lors de l'application de l'action",
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
