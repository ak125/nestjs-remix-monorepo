import { Injectable } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import {
  CreateSupplierDto,
  SupplierFilters,
  validateCreateSupplier,
  validateSupplierFilters,
} from './dto';

/**
 * SuppliersModernService - Service moderne avec validation Zod
 * ✅ Utilise le service existant SuppliersService
 * ✅ Ajoute la validation Zod
 * ✅ Suit l'architecture du projet
 */
@Injectable()
export class SuppliersModernService {
  constructor(private readonly suppliersService: SuppliersService) {}

  /**
   * Créer un fournisseur avec validation Zod
   */
  async createSupplier(data: CreateSupplierDto) {
    const validatedData = validateCreateSupplier(data);
    return await this.suppliersService.createSupplier(validatedData);
  }

  /**
   * Rechercher des fournisseurs avec validation des filtres
   */
  async getSuppliers(filters: SupplierFilters) {
    const validatedFilters = validateSupplierFilters(filters);
    
    return await this.suppliersService.getSuppliers({
      search: validatedFilters.search,
      isActive: validatedFilters.isActive,
      page: validatedFilters.page,
      limit: validatedFilters.limit,
    });
  }

  /**
   * Obtenir un fournisseur par ID
   */
  async getSupplierById(id: number) {
    return await this.suppliersService.getSupplierById(id);
  }

  /**
   * Test du service fournisseurs
   */
  async testSuppliersService() {
    return await this.suppliersService.testSuppliersService();
  }
}
