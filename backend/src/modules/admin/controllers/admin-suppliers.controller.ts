/**
 * 📋 CONTRÔLEUR FOURNISSEURS ADMIN
 *
 * API REST pour la gestion des fournisseurs AutoParts
 * Migration des fonctionnalités PHP legacy
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  Request,
} from '@nestjs/common';
import { AdminSuppliersService } from '../services/admin-suppliers.service';
import { LocalAuthGuard } from '../../../auth/local-auth.guard';
import {
  CreateSupplier,
  UpdateSupplier,
  SupplierQuery,
} from '../schemas/suppliers.schemas';

@Controller('admin/suppliers')
@UseGuards(LocalAuthGuard)
export class AdminSuppliersController {
  private readonly logger = new Logger(AdminSuppliersController.name);

  constructor(private readonly suppliersService: AdminSuppliersService) {}

  /**
   * GET /admin/suppliers
   * Récupérer tous les fournisseurs avec pagination et filtres
   */
  @Get()
  async getAllSuppliers(@Query() query: SupplierQuery, @Request() req: any) {
    try {
      this.logger.log('Requête liste fournisseurs');
      const currentUserId = req.user?.id || 'system';

      const result = await this.suppliersService.getAllSuppliers(
        query,
        currentUserId,
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des fournisseurs:',
        error,
      );
      return {
        success: false,
        error: 'Erreur lors de la récupération des fournisseurs',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /admin/suppliers/stats
   * Récupérer les statistiques des fournisseurs
   */
  @Get('stats')
  async getSupplierStats() {
    try {
      this.logger.log('Requête statistiques fournisseurs');
      const stats = await this.suppliersService.getSupplierStats();

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des stats fournisseurs:',
        error,
      );
      return {
        success: false,
        error: 'Erreur lors de la récupération des statistiques',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /admin/suppliers/:id
   * Récupérer un fournisseur par ID
   */
  @Get(':id')
  async getSupplierById(@Param('id') id: string) {
    try {
      this.logger.log(`Requête fournisseur ID: ${id}`);
      const supplier = await this.suppliersService.getSupplierById(id);

      return {
        success: true,
        data: supplier,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération du fournisseur ${id}:`,
        error,
      );
      return {
        success: false,
        error: 'Fournisseur non trouvé',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * POST /admin/suppliers
   * Créer un nouveau fournisseur
   */
  @Post()
  async createSupplier(@Body() data: CreateSupplier, @Request() req: any) {
    try {
      this.logger.log(`Création fournisseur: ${data.name}`);
      const currentUserId = req.user?.id || 'system';

      const supplier = await this.suppliersService.createSupplier(
        data,
        currentUserId,
      );

      return {
        success: true,
        data: supplier,
        message: 'Fournisseur créé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur lors de la création du fournisseur:', error);
      return {
        success: false,
        error: 'Erreur lors de la création du fournisseur',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * PATCH /admin/suppliers/:id
   * Mettre à jour un fournisseur
   */
  @Patch(':id')
  async updateSupplier(
    @Param('id') id: string,
    @Body() data: Partial<UpdateSupplier>,
    @Request() req: any,
  ) {
    try {
      this.logger.log(`Mise à jour fournisseur: ${id}`);
      const currentUserId = req.user?.id || 'system';

      const updateData: UpdateSupplier = { ...data, id };
      const supplier = await this.suppliersService.updateSupplier(
        updateData,
        currentUserId,
      );

      return {
        success: true,
        data: supplier,
        message: 'Fournisseur mis à jour avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise à jour du fournisseur ${id}:`,
        error,
      );
      return {
        success: false,
        error: 'Erreur lors de la mise à jour du fournisseur',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * PATCH /admin/suppliers/:id/toggle-status
   * Activer/Désactiver un fournisseur
   */
  @Patch(':id/toggle-status')
  async toggleSupplierStatus(
    @Param('id') id: string,
    @Body() { isActive }: { isActive: boolean },
    @Request() req: any,
  ) {
    try {
      this.logger.log(`Changement statut fournisseur ${id}: ${isActive}`);
      const currentUserId = req.user?.id || 'system';

      const supplier = await this.suppliersService.toggleSupplierStatus(
        id,
        isActive,
        currentUserId,
      );

      return {
        success: true,
        data: supplier,
        message: `Fournisseur ${isActive ? 'activé' : 'désactivé'} avec succès`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors du changement de statut du fournisseur ${id}:`,
        error,
      );
      return {
        success: false,
        error: 'Erreur lors du changement de statut',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
