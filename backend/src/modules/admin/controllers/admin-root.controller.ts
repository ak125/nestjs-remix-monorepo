/**
 * 📋 CONTRÔLEUR ADMIN ROOT - Module Admin
 *
 * Contrôleur pour la route racine /admin
 * Fournit l'index des fonctionnalités administratives
 */

import {
  Controller,
  Get,
  UseGuards,
  Logger,
  Redirect,
} from '@nestjs/common';
import { LocalAuthGuard } from '../../../auth/local-auth.guard';

@Controller('admin')
@UseGuards(LocalAuthGuard)
export class AdminRootController {
  private readonly logger = new Logger(AdminRootController.name);

  /**
   * GET /admin
   * Route racine admin - redirige vers le dashboard
   */
  @Get()
  @Redirect('/admin/dashboard', 302)
  async getAdminRoot() {
    this.logger.log('Accès à la route racine admin - redirection vers dashboard');
    return;
  }

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
          title: "Administration",
          sections: [
            {
              name: "Dashboard",
              path: "/admin/dashboard",
              description: "Statistiques et métriques générales"
            },
            {
              name: "Commandes",
              path: "/admin/orders",
              description: "Gestion des commandes clients"
            },
            {
              name: "Staff",
              path: "/admin/staff",
              description: "Administration du personnel"
            },
            {
              name: "Fournisseurs",
              path: "/admin/suppliers",
              description: "Gestion des fournisseurs"
            }
          ]
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
}
