/**
 * 📋 CONTRÔLEUR ADMIN ROOT - Module Admin
 *
 * Contrôleur pour la route racine /admin
 * Fournit l'index des fonctionnalités administratives
 */

import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';

@Controller('admin')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminRootController {
  private readonly logger = new Logger(AdminRootController.name);

  /**
   * GET /admin
   * Route racine admin - désactivée pour laisser Remix gérer
   */
  /*
  @Get()
  async getAdminRoot() {
    this.logger.log(
      'Accès à la route racine admin - gérée par Remix',
    );
    // Route gérée par Remix, ne pas intercepter
    return null;
  }
  */

  /**
   * GET /admin/menu
   * Retourne le menu des fonctionnalités admin disponibles
   */
  @Get('menu')
  async getAdminMenu() {
    try {
      this.logger.log('Requête menu admin');

      return {
        success: true,
        data: {
          title: 'Administration',
          sections: [
            {
              name: 'Dashboard',
              path: '/admin',
              description: 'Statistiques et métriques générales',
            },
            {
              name: 'Commandes',
              path: '/admin/orders',
              description: 'Gestion des commandes clients',
            },
            {
              name: 'Staff',
              path: '/admin/staff',
              description: 'Administration du personnel',
            },
            {
              name: 'Fournisseurs',
              path: '/admin/suppliers',
              description: 'Gestion des fournisseurs',
            },
          ],
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération du menu admin:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération du menu',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Route /admin/dashboard supprimée - maintenant gérée par Remix (admin._index.tsx)
}
