/**
 * 📋 SERVICE FOURNISSEURS ADMIN
 *
 * Gestion complète des fournisseurs AutoParts
 * Tables: ___xtr_supplier, am_2022_suppliers, ___xtr_supplier_link_pm
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseRestService } from '../../../database/supabase-rest.service';
import {
  Supplier,
  CreateSupplier,
  UpdateSupplier,
  SupplierQuery,
  SupplierStats,
  SupplierQuerySchema,
  CreateSupplierSchema,
  UpdateSupplierSchema,
  SupplierStatsSchema,
} from '../schemas/suppliers.schemas';
import { PaginatedResponse } from '../schemas/admin.schemas';

@Injectable()
export class AdminSuppliersService {
  private readonly logger = new Logger(AdminSuppliersService.name);
  private readonly tableName = '___xtr_supplier';

  constructor(private readonly supabaseService: SupabaseRestService) {}

  /**
   * Récupérer tous les fournisseurs avec pagination
   */
  async getAllSuppliers(
    query: SupplierQuery,
    _currentUserId: string,
  ): Promise<PaginatedResponse<Supplier>> {
    try {
      const validatedQuery = SupplierQuerySchema.parse(query);
      const { page, limit, search, country, isActive, sortBy, sortOrder } =
        validatedQuery;

      this.logger.log(
        `Récupération fournisseurs - Page ${page}, Limite ${limit}`,
      );

      let url = `${this.supabaseService['baseUrl']}/${this.tableName}?select=*`;

      // Filtres
      if (isActive !== undefined) {
        // Assuming a column exists for active status
        url += `&is_active=eq.${isActive}`;
      }

      if (country) {
        url += `&country=ilike.%${country}%`;
      }

      if (search) {
        url += `&or=(name.ilike.%${search}%, email.ilike.%${search}%)`;
      }

      // Pagination
      const offset = (page - 1) * limit;
      url += `&offset=${offset}&limit=${limit}`;

      // Tri
      const orderColumn = sortBy === 'name' ? 'name' : 'created_at';
      url += `&order=${orderColumn}.${sortOrder}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.supabaseService['headers'],
      });

      if (!response.ok) {
        throw new Error(`Erreur API Supabase: ${response.status}`);
      }

      const suppliers = await response.json();
      const total = parseInt(
        response.headers.get('content-range')?.split('/')[1] || '0',
      );

      // Transformation des données legacy vers notre format
      const transformedSuppliers: Supplier[] = suppliers.map((s: any) => ({
        id: s.id || s.supplier_id,
        name: s.name || s.supplier_name,
        code: s.code || s.supplier_code,
        email: s.email,
        phone: s.phone,
        address: s.address,
        city: s.city,
        country: s.country || 'France',
        website: s.website,
        isActive: s.is_active || true,
        rating: s.rating || 3,
        paymentTerms: s.payment_terms,
        deliveryTime: s.delivery_time,
        createdAt: new Date(s.created_at || Date.now()),
        updatedAt: new Date(s.updated_at || Date.now()),
      }));

      return {
        data: transformedSuppliers,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des fournisseurs:',
        error,
      );
      throw error;
    }
  }

  /**
   * Récupérer un fournisseur par ID
   */
  async getSupplierById(id: string): Promise<Supplier> {
    try {
      this.logger.log(`Récupération fournisseur ID: ${id}`);

      const response = await fetch(
        `${this.supabaseService['baseUrl']}/${this.tableName}?id=eq.${id}`,
        {
          method: 'GET',
          headers: this.supabaseService['headers'],
        },
      );

      if (!response.ok) {
        throw new Error(`Erreur API Supabase: ${response.status}`);
      }

      const suppliers = await response.json();

      if (suppliers.length === 0) {
        throw new NotFoundException(`Fournisseur ${id} non trouvé`);
      }

      const s = suppliers[0];
      return {
        id: s.id,
        name: s.name,
        code: s.code,
        email: s.email,
        phone: s.phone,
        address: s.address,
        city: s.city,
        country: s.country || 'France',
        website: s.website,
        isActive: s.is_active || true,
        rating: s.rating || 3,
        paymentTerms: s.payment_terms,
        deliveryTime: s.delivery_time,
        createdAt: new Date(s.created_at),
        updatedAt: new Date(s.updated_at),
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération du fournisseur ${id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Créer un nouveau fournisseur
   */
  async createSupplier(
    data: CreateSupplier,
    _currentUserId: string,
  ): Promise<Supplier> {
    try {
      const validatedData = CreateSupplierSchema.parse(data);

      this.logger.log(
        `Création fournisseur: ${validatedData.name} par ${_currentUserId}`,
      );

      const supplierData = {
        name: validatedData.name,
        code: validatedData.code,
        email: validatedData.email,
        phone: validatedData.phone,
        address: validatedData.address,
        city: validatedData.city,
        country: validatedData.country,
        website: validatedData.website,
        payment_terms: validatedData.paymentTerms,
        delivery_time: validatedData.deliveryTime,
        rating: validatedData.rating,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const response = await fetch(
        `${this.supabaseService['baseUrl']}/${this.tableName}`,
        {
          method: 'POST',
          headers: {
            ...this.supabaseService['headers'],
            Prefer: 'return=representation',
          },
          body: JSON.stringify(supplierData),
        },
      );

      if (!response.ok) {
        throw new Error(`Erreur création fournisseur: ${response.status}`);
      }

      const [createdSupplier] = await response.json();
      return this.getSupplierById(createdSupplier.id);
    } catch (error) {
      this.logger.error('Erreur lors de la création du fournisseur:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour un fournisseur
   */
  async updateSupplier(
    data: UpdateSupplier,
    _currentUserId: string,
  ): Promise<Supplier> {
    try {
      const validatedData = UpdateSupplierSchema.parse(data);

      this.logger.log(
        `Mise à jour fournisseur ${validatedData.id} par ${_currentUserId}`,
      );

      // Vérifier que le fournisseur existe
      await this.getSupplierById(validatedData.id);

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Ajouter seulement les champs modifiés
      if (validatedData.name) updateData.name = validatedData.name;
      if (validatedData.code) updateData.code = validatedData.code;
      if (validatedData.email) updateData.email = validatedData.email;
      if (validatedData.phone) updateData.phone = validatedData.phone;
      if (validatedData.address) updateData.address = validatedData.address;
      if (validatedData.city) updateData.city = validatedData.city;
      if (validatedData.country) updateData.country = validatedData.country;
      if (validatedData.website) updateData.website = validatedData.website;
      if (validatedData.paymentTerms)
        updateData.payment_terms = validatedData.paymentTerms;
      if (validatedData.deliveryTime !== undefined)
        updateData.delivery_time = validatedData.deliveryTime;
      if (validatedData.rating) updateData.rating = validatedData.rating;

      const response = await fetch(
        `${this.supabaseService['baseUrl']}/${this.tableName}?id=eq.${validatedData.id}`,
        {
          method: 'PATCH',
          headers: {
            ...this.supabaseService['headers'],
            Prefer: 'return=representation',
          },
          body: JSON.stringify(updateData),
        },
      );

      if (!response.ok) {
        throw new Error(`Erreur mise à jour fournisseur: ${response.status}`);
      }

      return this.getSupplierById(validatedData.id);
    } catch (error) {
      this.logger.error('Erreur lors de la mise à jour du fournisseur:', error);
      throw error;
    }
  }

  /**
   * Statistiques des fournisseurs
   */
  async getSupplierStats(): Promise<SupplierStats> {
    try {
      this.logger.log('Génération des statistiques fournisseurs...');

      // Total fournisseurs
      const totalResponse = await fetch(
        `${this.supabaseService['baseUrl']}/${this.tableName}?select=count`,
        {
          method: 'GET',
          headers: {
            ...this.supabaseService['headers'],
            Prefer: 'count=exact',
          },
        },
      );

      const totalSuppliers = parseInt(
        totalResponse.headers.get('content-range')?.split('/')[1] || '0',
      );

      // Données simulées pour les autres métriques (à améliorer avec de vraies requêtes)
      const stats: SupplierStats = {
        totalSuppliers,
        activeSuppliers: Math.floor(totalSuppliers * 0.85), // 85% actifs
        totalOrders: 456,
        pendingOrders: 23,
        totalSpent: 123456.78,
        averageDeliveryTime: 7, // jours
        topSuppliers: [
          {
            id: '1',
            name: 'Fournisseur Principal Auto',
            orderCount: 89,
            totalSpent: 45678.9,
            rating: 5,
          },
          {
            id: '2',
            name: 'Pièces Express SARL',
            orderCount: 67,
            totalSpent: 34567.89,
            rating: 4,
          },
        ],
      };

      return SupplierStatsSchema.parse(stats);
    } catch (error) {
      this.logger.error(
        'Erreur lors de la génération des stats fournisseurs:',
        error,
      );
      throw error;
    }
  }

  /**
   * Activer/Désactiver un fournisseur
   */
  async toggleSupplierStatus(
    id: string,
    isActive: boolean,
    _currentUserId: string,
  ): Promise<Supplier> {
    try {
      this.logger.log(
        `${isActive ? 'Activation' : 'Désactivation'} fournisseur ${id} par ${_currentUserId}`,
      );

      const response = await fetch(
        `${this.supabaseService['baseUrl']}/${this.tableName}?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            ...this.supabaseService['headers'],
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            is_active: isActive,
            updated_at: new Date().toISOString(),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Erreur changement statut fournisseur: ${response.status}`,
        );
      }

      return this.getSupplierById(id);
    } catch (error) {
      this.logger.error(
        'Erreur lors du changement de statut du fournisseur:',
        error,
      );
      throw error;
    }
  }
}
