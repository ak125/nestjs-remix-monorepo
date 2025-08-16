/**
 * Contrôleur pour les expéditions utilisateur
 * Permet aux utilisateurs de suivre leurs commandes expédiées
 */

import { Controller, Get, Param, Logger } from '@nestjs/common';
import { UserShipmentService } from '../services/user-shipment.service';

@Controller('api/users')
export class UserShipmentController {
  private readonly logger = new Logger(UserShipmentController.name);

  constructor(private readonly userShipmentService: UserShipmentService) {}

  /**
   * GET /api/users/:userId/shipments
   * Récupérer les expéditions d'un utilisateur
   */
  @Get(':userId/shipments')
  async getUserShipments(@Param('userId') userId: string) {
    try {
      this.logger.log(`[UserShipmentController] GET /api/users/${userId}/shipments`);

      const shipments = await this.userShipmentService.getUserShipments(userId);
      
      return {
        success: true,
        data: shipments,
        count: shipments.length,
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
  async getUserShipmentStats(@Param('userId') userId: string) {
    try {
      this.logger.log(`[UserShipmentController] GET /api/users/${userId}/shipments/stats`);

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
}
