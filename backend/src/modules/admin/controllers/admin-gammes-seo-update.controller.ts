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
  Logger,
} from '@nestjs/common';
import {
  OperationFailedException,
  DomainValidationException,
} from '@common/exceptions';
import { Request } from 'express';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
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
    @Param('id') idOrSlug: string,
    @Body() updateData: GammeSeoUpdateData,
  ) {
    try {
      const id = await this.gammesSeoService.resolveIdOrSlug(idOrSlug);
      this.logger.log(`🔧 PATCH /api/admin/gammes-seo/${id}`);

      const result = await this.gammesSeoService.updateGamme(id, updateData);

      return {
        success: result.success,
        message: result.message,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Error updating gamme ${idOrSlug}:`, error);
      throw new OperationFailedException({
        message: `Erreur lors de la mise à jour de la gamme ${idOrSlug}`,
      });
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
        throw new DomainValidationException({
          message: 'pgIds requis (tableau non vide)',
        });
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
      if (error instanceof DomainValidationException) throw error;
      throw new OperationFailedException({
        message: 'Erreur lors de la mise à jour en masse',
      });
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
        throw new DomainValidationException({
          message: 'pgIds requis (tableau non vide)',
        });
      }

      if (!body.actionId) {
        throw new DomainValidationException({
          message: 'actionId requis',
        });
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
      if (error instanceof DomainValidationException) throw error;
      throw new OperationFailedException({
        message: "Erreur lors de l'application de l'action",
      });
    }
  }
}
