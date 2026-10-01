/**
 * Contrôleur pour les expéditions utilisateur
 * Permet aux utilisateurs de suivre leurs commandes expédiées
 */

import { Controller, Get, Param, Logger, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { DomainNotFoundException } from '@common/exceptions';
import { User } from '../../../common/decorators/user.decorator';
import { UserShipmentService } from '../services/user-shipment.service';

/**
 * « Mes expéditions » : session obligatoire, et `:userId` doit être le compte
 * de la session. Sinon 404, comme les contrôles de propriétaire de `api/orders`.
 */
@UseGuards(AuthenticatedGuard)
@Controller('api/users')
export class UserShipmentController {
  private readonly logger = new Logger(UserShipmentController.name);

  constructor(private readonly userShipmentService: UserShipmentService) {}

  /**
   * GET /api/users/:userId/shipments
   * Récupérer les expéditions d'un utilisateur
   */
  @Get(':userId/shipments')
  async getUserShipments(
    @Param('userId') userId: string,
    @User('id') sessionUserId: unknown,
  ) {
    this.assertOwnAccount(userId, sessionUserId);
    try {
      this.logger.log(
        `[UserShipmentController] GET /api/users/${userId}/shipments`,
      );

      const result = await this.userShipmentService.getUserShipments(userId);

      return {
        success: result.success,
        data: result.shipments,
        count: result.count,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error fetching user shipments:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: [],
        count: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /api/users/:userId/shipments/stats
   * Récupérer les statistiques d'expédition d'un utilisateur
   */
  @Get(':userId/shipments/stats')
  async getUserShipmentStats(
    @Param('userId') userId: string,
    @User('id') sessionUserId: unknown,
  ) {
    this.assertOwnAccount(userId, sessionUserId);
    try {
      this.logger.log(
        `[UserShipmentController] GET /api/users/${userId}/shipments/stats`,
      );

      const stats = await this.userShipmentService.getUserShipmentStats(userId);

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error fetching user shipment stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: {
          total: 0,
          inTransit: 0,
          outForDelivery: 0,
          delivered: 0,
          shipped: 0,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /** Hors du `try` : le refus ne doit pas devenir une réponse 200 `success: false`. */
  private assertOwnAccount(userId: string, sessionUserId: unknown): void {
    const ownId =
      typeof sessionUserId === 'string' || typeof sessionUserId === 'number'
        ? String(sessionUserId)
        : '';
    if (!ownId || ownId !== userId) {
      this.logger.warn(
        `Access denied: user ${String(sessionUserId)} requested shipments of user ${userId}`,
      );
      throw new DomainNotFoundException({
        message: 'Expéditions non trouvées',
      });
    }
  }
}
