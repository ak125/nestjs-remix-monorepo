import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../database/supabase.service';
import { VehicleFilters, ModelWithEngines } from '../types/vehicle.types';

interface GetModelsOptions {
  page?: number;
  limit?: number;
  search?: string;
}

interface GetModelsResponse {
  success: boolean;
  data: any[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class EnhancedVehicleServiceNew {
  private readonly logger = new Logger(EnhancedVehicleServiceNew.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 🎯 SOLUTION GÉNÉRALE - Récupération des modèles avec pagination complète
   * Cette méthode résout le problème de limite de 1000 résultats pour TOUTES les marques
   */
  async getModels(
    brandId: number,
    options: GetModelsOptions = {},
    year?: number,
  ): Promise<GetModelsResponse> {
    try {
      // Base query
      let query = this.supabase
        .from('auto_modele')
        .select('*')
        .eq('modele_marque_id', brandId)
        .eq('modele_display', 1);

      // 🎯 FILTRAGE INTELLIGENT PAR ANNÉE avec PAGINATION COMPLÈTE
      if (year) {
        const allModelIds = await this.getAllValidModelIdsForYear(year);
        
        if (allModelIds.length === 0) {
          this.logger.log(
            `🚙 0 modèles récupérés pour marque ${brandId} année ${year}`,
          );
          return {
            success: true,
            data: [],
            total: 0,
            page: options.page || 0,
            limit: options.limit || 50,
          };
        }

        query = query.in('modele_id', allModelIds);
      }

      if (options.search) {
        query = query.or(`
          modele_name.ilike.%${options.search}%,
          modele_ful_name.ilike.%${options.search}%,
          modele_alias.ilike.%${options.search}%
        `);
      }

      // Pagination
      const page = options.page || 0;
      const limit = options.limit || 50;
      const offset = page * limit;

      const { data, error } = await query
        .order('modele_name', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      // Count total avec même filtrage
      const totalCount = await this.getModelsCount(brandId, year, options.search);

      this.logger.log(
        `🚙 ${data?.length || 0} modèles récupérés pour marque ${brandId} (total: ${totalCount})`,
      );

      return {
        success: true,
        data: data || [],
        total: totalCount,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération modèles marque ${brandId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 🔧 MÉTHODE GÉNÉRALE - Récupération de TOUS les model IDs valides pour une année
   * Utilise la pagination pour contourner la limite de 1000 résultats
   */
  private async getAllValidModelIdsForYear(year: number): Promise<string[]> {
    const allModelIds = [];
    let hasMore = true;
    let offset = 0;
    const batchSize = 1000;

    this.logger.log(
      `🔍 PAGINATION: Début récupération modèles pour année ${year}`,
    );

    while (hasMore) {
      const { data: modelIdsBatch, error: modelIdsError } = await this.supabase
        .from('auto_type')
        .select('type_modele_id')
        .eq('type_display', 1)
        .lte('type_year_from', year.toString())
        .gte('type_year_to', year.toString())
        .range(offset, offset + batchSize - 1);

      if (modelIdsError) {
        throw modelIdsError;
      }

      if (modelIdsBatch && modelIdsBatch.length > 0) {
        allModelIds.push(...modelIdsBatch.map((item) => item.type_modele_id));
        offset += batchSize;
        hasMore = modelIdsBatch.length === batchSize;
        
        this.logger.log(
          `🔍 PAGINATION: Batch ${Math.floor(offset / batchSize)} - ${modelIdsBatch.length} résultats (total: ${allModelIds.length})`,
        );
      } else {
        hasMore = false;
      }
    }

    // Extraire les IDs uniques
    const uniqueModelIds = [...new Set(allModelIds)];

    this.logger.log(
      `🔍 PAGINATION: Récupéré ${allModelIds.length} types (${uniqueModelIds.length} modèles uniques) pour année ${year}`,
    );

    return uniqueModelIds;
  }

  /**
   * Récupération du count total avec même logique de filtrage
   */
  private async getModelsCount(brandId: number, year?: number, search?: string): Promise<number> {
    let countQuery = this.supabase
      .from('auto_modele')
      .select('*', { count: 'exact', head: true })
      .eq('modele_marque_id', brandId)
      .eq('modele_display', 1);

    if (year) {
      const allModelIds = await this.getAllValidModelIdsForYear(year);
      if (allModelIds.length === 0) {
        return 0;
      }
      countQuery = countQuery.in('modele_id', allModelIds);
    }

    if (search) {
      countQuery = countQuery.or(`
        modele_name.ilike.%${search}%,
        modele_ful_name.ilike.%${search}%,
        modele_alias.ilike.%${search}%
      `);
    }

    const { count, error } = await countQuery;

    if (error) {
      throw error;
    }

    return count || 0;
  }
}