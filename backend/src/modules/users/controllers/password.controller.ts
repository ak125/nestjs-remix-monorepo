/**
 * 🔐 PasswordController - API REST pour la gestion des mots de passe
 * ✅ Endpoints sécurisés pour changement et réinitialisation
 * ✅ Validation Zod intégrée
 * ✅ Logging et gestion d'erreurs complète
 */

import {
  Controller,
  Post,
  Body,
  Logger,
  Request,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import {
  AuthenticationException,
  DomainValidationException,
  OperationFailedException,
} from '@common/exceptions';
import { PasswordService } from '../services/password.service';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ChangePasswordSchema } from '../dto/change-password.dto';
import {
  RequestPasswordResetSchema,
  UsePasswordResetTokenSchema,
} from '../dto/password-reset.dto';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';

@Controller('api/password')
export class PasswordController {
  private readonly logger = new Logger(PasswordController.name);

  constructor(private readonly passwordService: PasswordService) {}

  /**
   * POST /api/password/change
   * Changer le mot de passe (utilisateur connecté)
   */
  @Post('change')
  @UseGuards(AuthenticatedGuard)
  async changePassword(
    @Body(new ZodValidationPipe(ChangePasswordSchema))
    changeData: z.infer<typeof ChangePasswordSchema>,
    @Request() req: any,
  ) {
    this.logger.log('POST /api/password/change');

    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AuthenticationException({
          message: 'Utilisateur non authentifié',
        });
      }

      await this.passwordService.changePassword(
        userId,
        changeData.currentPassword,
        changeData.newPassword,
      );

      return {
        success: true,
        message: 'Mot de passe modifié avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      this.logger.error('Erreur changePassword:', error);
      if (error instanceof AuthenticationException) throw error;
      const message =
        error instanceof Error
          ? error.message
          : 'Erreur lors du changement de mot de passe';
      throw new DomainValidationException({
        message,
      });
    }
  }

  /**
   * POST /api/password/request-reset
   * Demander une réinitialisation de mot de passe
   */
  @Post('request-reset')
  async requestPasswordReset(
    @Body(new ZodValidationPipe(RequestPasswordResetSchema))
    requestData: z.infer<typeof RequestPasswordResetSchema>,
  ) {
    this.logger.log('POST /api/password/request-reset');

    try {
      await this.passwordService.requestPasswordReset(requestData.email);

      return {
        success: true,
        message:
          'Si un compte avec cet email existe, vous recevrez un lien de réinitialisation',
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      this.logger.error('Erreur requestPasswordReset:', error);
      // Ne pas révéler si l'email existe pour des raisons de sécurité
      return {
        success: true,
        message:
          'Si un compte avec cet email existe, vous recevrez un lien de réinitialisation',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * POST /api/password/reset
   * Réinitialiser le mot de passe avec un token
   */
  @Post('reset')
  async resetPassword(
    @Body(new ZodValidationPipe(UsePasswordResetTokenSchema))
    resetData: z.infer<typeof UsePasswordResetTokenSchema>,
  ) {
    this.logger.log('POST /api/password/reset');

    try {
      await this.passwordService.resetPasswordWithToken(
        resetData.token,
        resetData.newPassword,
      );

      return {
        success: true,
        message: 'Mot de passe réinitialisé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      this.logger.error('Erreur resetPassword:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Erreur lors de la réinitialisation du mot de passe';
      throw new DomainValidationException({
        message,
      });
    }
  }

  /**
   * POST /api/password/cleanup-tokens (Admin uniquement)
   * Nettoyer les tokens expirés
   */
  @Post('cleanup-tokens')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async cleanupExpiredTokens(@Request() _req: any) {
    this.logger.log('POST /api/password/cleanup-tokens');

    try {
      const deletedCount = await this.passwordService.cleanupExpiredTokens();

      return {
        success: true,
        message: `${deletedCount} tokens expirés supprimés`,
        deletedCount,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      this.logger.error('Erreur cleanupExpiredTokens:', error);
      if (error instanceof AuthenticationException) throw error;
      const message =
        error instanceof Error
          ? error.message
          : 'Erreur lors du nettoyage des tokens';
      throw new OperationFailedException({
        message,
      });
    }
  }
}
