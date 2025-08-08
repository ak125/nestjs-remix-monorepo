/**
 * SERVICE FOURNISSEURS ADMIN - Version Moderne et Simplifiée
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseServiceFacade } from '../../../database/supabase-service-facade';
import { RedisCacheService } from '../../../database/services/redis-cache.service';

@Injectable()
export class AdminSuppliersService {
  private readonly logger = new Logger(AdminSuppliersService.name);
  private readonly cachePrefix = 'suppliers';
  private readonly cacheExpiration = 300;

  constructor(
    private readonly supabaseService: SupabaseServiceFacade,
    private readonly cacheService: RedisCacheService,
  ) {}

  async getAllSuppliers(query: any = {}, _currentUserId: string): Promise<any> {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        country = '',
        isActive = undefined,
        sortBy = 'name',
        sortOrder = 'asc',
      } = query;

      this.logger.log(
        'Récupération fournisseurs - Page ' + page + ', Limite ' + limit,
      );

      const cacheKey = this.cachePrefix + ':list:' + JSON.stringify(query);

      const cachedResult = await this.cacheService.get(cacheKey);
      if (cachedResult) {
        this.logger.log('Fournisseurs récupérés depuis le cache Redis');
        return cachedResult;
      }

      const result = await this.supabaseService.getAllSuppliers({
        page,
        limit,
        search,
        country,
        isActive,
        sortBy,
        sortOrder,
      });

      if (!result) {
        throw new Error('Aucune réponse de la base de données');
      }

      await this.cacheService.set(cacheKey, result, this.cacheExpiration);

      this.logger.log('Fournisseurs récupérés: ' + (result.data?.length || 0));
      return result;
    } catch (error: any) {
      this.logger.error(
        'Erreur lors de la récupération des fournisseurs:',
        error,
      );
      throw new BadRequestException('Erreur de récupération: ' + error.message);
    }
  }

  async getSupplierById(id: string): Promise<any> {
    try {
      if (!id) {
        throw new BadRequestException('ID fournisseur requis');
      }

      this.logger.log('Récupération fournisseur ID: ' + id);

      const cacheKey = this.cachePrefix + ':' + id;
      const cached = await this.cacheService.get(cacheKey);

      if (cached) {
        this.logger.log('Fournisseur récupéré depuis le cache Redis');
        return cached;
      }

      const supplier = await this.supabaseService.getSupplierById(id);

      if (!supplier) {
        throw new NotFoundException(
          "Fournisseur avec l'ID " + id + ' introuvable',
        );
      }

      await this.cacheService.set(cacheKey, supplier, this.cacheExpiration);

      this.logger.log('Fournisseur récupéré avec succès');
      return supplier;
    } catch (error: any) {
      this.logger.error('Erreur récupération fournisseur ' + id + ':', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Erreur de récupération: ' + error.message);
    }
  }

  async createSupplier(
    supplierData: any,
    _currentUserId: string,
  ): Promise<any> {
    try {
      if (!supplierData || !supplierData.name) {
        throw new BadRequestException('Nom du fournisseur requis');
      }

      this.logger.log('Création fournisseur: ' + supplierData.name);

      const newSupplier =
        await this.supabaseService.createSupplier(supplierData);

      if (!newSupplier) {
        throw new Error('Échec de la création du fournisseur');
      }

      await this.cacheService.delPattern(this.cachePrefix + ':list:*');

      this.logger.log('Fournisseur créé avec succès');
      return newSupplier;
    } catch (error: any) {
      this.logger.error('Erreur création fournisseur:', error);
      throw new BadRequestException('Erreur de création: ' + error.message);
    }
  }

  async updateSupplier(
    id: string,
    supplierData: any,
    _currentUserId: string,
  ): Promise<any> {
    try {
      if (!id) {
        throw new BadRequestException('ID fournisseur requis');
      }

      this.logger.log('Mise à jour fournisseur ID: ' + id);

      await this.getSupplierById(id);

      const updatedSupplier = await this.supabaseService.updateSupplier(
        id,
        supplierData,
      );

      if (!updatedSupplier) {
        throw new Error('Échec de la mise à jour du fournisseur');
      }

      await this.cacheService.del(this.cachePrefix + ':' + id);
      await this.cacheService.delPattern(this.cachePrefix + ':list:*');

      this.logger.log('Fournisseur mis à jour avec succès');
      return updatedSupplier;
    } catch (error: any) {
      this.logger.error('Erreur mise à jour fournisseur ' + id + ':', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Erreur de mise à jour: ' + error.message);
    }
  }

  async deleteSupplier(id: string, _currentUserId: string): Promise<any> {
    try {
      if (!id) {
        throw new BadRequestException('ID fournisseur requis');
      }

      this.logger.log('Suppression fournisseur ID: ' + id);

      await this.getSupplierById(id);

      const result = await this.supabaseService.deleteSupplier(id);

      await this.cacheService.del(this.cachePrefix + ':' + id);
      await this.cacheService.delPattern(this.cachePrefix + ':list:*');

      this.logger.log('Fournisseur supprimé avec succès');
      return result;
    } catch (error: any) {
      this.logger.error('Erreur suppression fournisseur ' + id + ':', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Erreur de suppression: ' + error.message);
    }
  }

  async getSuppliersCount(filters: any = {}): Promise<number> {
    try {
      this.logger.log('Récupération du nombre de fournisseurs');

      const cacheKey = this.cachePrefix + ':count:' + JSON.stringify(filters);
      const cached = await this.cacheService.get(cacheKey);

      if (cached !== null) {
        return cached;
      }

      const result = await this.supabaseService.getAllSuppliers({
        page: 1,
        limit: 1,
        ...filters,
      });

      const count = result?.total || 0;

      await this.cacheService.set(cacheKey, count, 60);

      return count;
    } catch (error: any) {
      this.logger.error('Erreur récupération nombre fournisseurs:', error);
      return 0;
    }
  }

  async searchSuppliers(searchTerm: string, filters: any = {}): Promise<any> {
    try {
      if (!searchTerm || searchTerm.trim().length < 2) {
        throw new BadRequestException(
          'Terme de recherche trop court (minimum 2 caractères)',
        );
      }

      this.logger.log('Recherche fournisseurs: "' + searchTerm + '"');

      return this.getAllSuppliers(
        {
          search: searchTerm.trim(),
          ...filters,
        },
        '',
      );
    } catch (error: any) {
      this.logger.error('Erreur recherche fournisseurs:', error);
      throw error;
    }
  }

  async invalidateCache(): Promise<void> {
    try {
      await this.cacheService.delPattern(this.cachePrefix + ':*');
      this.logger.log('Cache fournisseurs invalidé');
    } catch (error: any) {
      this.logger.error('Erreur invalidation cache:', error);
    }
  }

  async getSupplierStats(): Promise<any> {
    try {
      this.logger.log('Récupération des statistiques fournisseurs');

      // Pour l'instant, retourner des stats basiques
      const totalSuppliers = await this.getSuppliersCount();
      const activeSuppliers = await this.getSuppliersCount({ isActive: true });

      return {
        totalSuppliers,
        activeSuppliers,
        inactiveSuppliers: totalSuppliers - activeSuppliers,
      };
    } catch (error: any) {
      this.logger.error('Erreur récupération stats fournisseurs:', error);
      return {
        totalSuppliers: 0,
        activeSuppliers: 0,
        inactiveSuppliers: 0,
      };
    }
  }

  async toggleSupplierStatus(id: string, _currentUserId: string): Promise<any> {
    try {
      if (!id) {
        throw new BadRequestException('ID fournisseur requis');
      }

      this.logger.log('Basculement statut fournisseur ID: ' + id);

      const supplier = await this.getSupplierById(id);

      const updatedData = {
        isActive: !supplier.isActive,
      };

      return this.updateSupplier(id, updatedData, _currentUserId);
    } catch (error: any) {
      this.logger.error(
        'Erreur basculement statut fournisseur ' + id + ':',
        error,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Erreur de basculement: ' + error.message);
    }
  }
}
