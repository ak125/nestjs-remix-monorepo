import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { 
  VehicleFilterDto, 
  AdvancedVehicleSearchDto,
  BrandQueryDto,
  ModelQueryDto,
  TypeQueryDto
} from './dto/vehicles-zod.dto';

/**
 * Service pour la gestion des véhicules automobiles avec validation Zod
 * Utilise les vraies tables de la base de données :
 * - auto_marque (marques automobiles)
 * - auto_modele (modèles de véhicules) 
 * - auto_type (types/motorisations)
 */
@Injectable()
export class VehiclesZodService extends SupabaseBaseService {
  
  /**
   * Récupérer toutes les marques avec validation Zod
   */
  async findAll(filters: BrandQueryDto) {
    try {
      let query = this.client
        .from('auto_marque')
        .select(`*`)
        .eq('marque_display', filters.display)
        .limit(filters.limit);

      if (filters.search) {
        query = query.ilike('marque_name', `%${filters.search}%`);
      }

      const offset = filters.page * filters.limit;
      const { data, error } = await query
        .order('marque_name', { ascending: true })
        .range(offset, offset + filters.limit - 1);

      if (error) {
        this.logger.error('Erreur findAll:', error);
        throw error;
      }

      return {
        data: data || [],
        total: data?.length || 0,
        page: filters.page,
        limit: filters.limit,
      };
    } catch (error) {
      this.logger.error('Erreur dans findAll:', error);
      throw error;
    }
  }

  /**
   * Récupérer les modèles d'une marque avec validation Zod
   */
  async findModelsByBrand(brandId: string, filters: ModelQueryDto) {
    try {
      let query = this.client
        .from('auto_modele')
        .select(`*`)
        .eq('modele_marque_id', brandId)
        .limit(filters.limit);

      if (filters.search) {
        query = query.ilike('modele_name', `%${filters.search}%`);
      }

      if (filters.yearFrom) {
        query = query.gte('modele_year_from', filters.yearFrom);
      }

      if (filters.yearTo) {
        query = query.lte('modele_year_to', filters.yearTo);
      }

      if (filters.onlyActive) {
        query = query.is('modele_year_to', null);
      }

      const offset = filters.page * filters.limit;
      const { data, error } = await query
        .order('modele_name', { ascending: true })
        .range(offset, offset + filters.limit - 1);

      if (error) {
        this.logger.error('Erreur findModelsByBrand:', error);
        throw error;
      }

      return {
        data: data || [],
        total: data?.length || 0,
        page: filters.page,
        limit: filters.limit,
      };
    } catch (error) {
      this.logger.error('Erreur dans findModelsByBrand:', error);
      throw error;
    }
  }

  /**
   * Récupérer les types d'un modèle avec validation Zod
   */
  async findTypesByModel(modelId: string, filters: TypeQueryDto) {
    try {
      let query = this.client
        .from('auto_type')
        .select(`*`)
        .eq('type_modele_id', modelId)
        .limit(filters.limit);

      if (filters.search) {
        query = query.ilike('type_name', `%${filters.search}%`);
      }

      if (filters.fuelType) {
        query = query.eq('type_fuel', filters.fuelType);
      }

      if (filters.minPower) {
        query = query.gte('type_power_ps', filters.minPower);
      }

      if (filters.maxPower) {
        query = query.lte('type_power_ps', filters.maxPower);
      }

      const offset = filters.page * filters.limit;
      const { data, error } = await query
        .order('type_name', { ascending: true })
        .range(offset, offset + filters.limit - 1);

      if (error) {
        this.logger.error('Erreur findTypesByModel:', error);
        throw error;
      }

      return {
        data: data || [],
        total: data?.length || 0,
        page: filters.page,
        limit: filters.limit,
      };
    } catch (error) {
      this.logger.error('Erreur dans findTypesByModel:', error);
      throw error;
    }
  }

  /**
   * Recherche avancée de véhicules avec tous les filtres Zod
   */
  async searchAdvanced(filters: AdvancedVehicleSearchDto) {
    try {
      // Construction de la requête avec jointures
      let query = this.client
        .from('auto_type')
        .select(`
          type_id,
          type_name,
          type_fuel,
          type_power_ps,
          type_power_kw,
          type_year_from,
          type_year_to,
          type_engine,
          auto_modele!inner(
            modele_id,
            modele_name,
            modele_year_from,
            modele_year_to,
            auto_marque!inner(
              marque_id,
              marque_name,
              marque_logo
            )
          )
        `)
        .range(filters.offset, filters.offset + filters.limit - 1);

      // Filtres de recherche textuelle
      if (filters.search) {
        query = query.or(
          `type_name.ilike.%${filters.search}%,auto_modele.modele_name.ilike.%${filters.search}%,auto_modele.auto_marque.marque_name.ilike.%${filters.search}%`
        );
      }

      // Filtres hiérarchiques
      if (filters.brandId) {
        query = query.eq('auto_modele.auto_marque.marque_id', filters.brandId);
      }

      if (filters.modelId) {
        query = query.eq('auto_modele.modele_id', filters.modelId);
      }

      if (filters.typeId) {
        query = query.eq('type_id', filters.typeId);
      }

      // Filtres techniques
      if (filters.fuelType) {
        query = query.eq('type_fuel', filters.fuelType);
      }

      if (filters.engineCode) {
        query = query.ilike('type_engine', `%${filters.engineCode}%`);
      }

      if (filters.minPowerPs) {
        query = query.gte('type_power_ps', filters.minPowerPs);
      }

      if (filters.maxPowerPs) {
        query = query.lte('type_power_ps', filters.maxPowerPs);
      }

      if (filters.minPowerKw) {
        query = query.gte('type_power_kw', filters.minPowerKw);
      }

      if (filters.maxPowerKw) {
        query = query.lte('type_power_kw', filters.maxPowerKw);
      }

      // Filtres temporels
      if (filters.yearFrom) {
        query = query.gte('type_year_from', filters.yearFrom);
      }

      if (filters.yearTo) {
        query = query.lte('type_year_to', filters.yearTo);
      }

      if (filters.onlyActive) {
        query = query.is('type_year_to', null);
      }

      // Tri
      const sortColumn = this.getSortColumn(filters.sortBy);
      query = query.order(sortColumn, { ascending: filters.sortOrder === 'asc' });

      const { data, error, count } = await query;

      if (error) {
        this.logger.error('❌ Erreur searchAdvanced:', error);
        throw error;
      }

      this.logger.log(`✅ ${data?.length || 0} véhicules trouvés (recherche avancée)`);
      
      return {
        data: data || [],
        count: data?.length || 0,
        total: count || 0,
        pagination: { 
          limit: filters.limit, 
          offset: filters.offset, 
          page: Math.floor(filters.offset / filters.limit),
        },
        filters,
        stats: this.generateSearchStats(data || [])
      };
    } catch (error) {
      this.logger.error('Erreur searchAdvanced:', error);
      throw error;
    }
  }

  /**
   * Statistiques des véhicules
   */
  async getStats() {
    try {
      const { count: brandCount } = await this.client
        .from('auto_marque')
        .select('*', { count: 'exact' })
        .eq('marque_display', 1);

      const { count: modelCount } = await this.client
        .from('auto_modele')
        .select('*', { count: 'exact' });

      const { count: typeCount } = await this.client
        .from('auto_type')
        .select('*', { count: 'exact' });

      return {
        brands: brandCount || 0,
        models: modelCount || 0,
        types: typeCount || 0,
      };
    } catch (error) {
      this.logger.error('Erreur dans getStats:', error);
      throw error;
    }
  }

  /**
   * Utilitaire pour convertir les champs de tri
   */
  private getSortColumn(sortBy: string): string {
    switch (sortBy) {
      case 'name': return 'type_name';
      case 'year': return 'type_year_from';
      case 'power': return 'type_power_ps';
      case 'fuel': return 'type_fuel';
      case 'brand': return 'auto_modele.auto_marque.marque_name';
      default: return 'type_name';
    }
  }

  /**
   * Générer des statistiques sur les résultats de recherche
   */
  private generateSearchStats(results: any[]) {
    if (!results.length) return null;

    const fuelTypes = results.reduce((acc, item) => {
      const fuel = item.type_fuel || 'Inconnu';
      acc[fuel] = (acc[fuel] || 0) + 1;
      return acc;
    }, {});

    const avgPower = results.reduce((sum, item) => {
      return sum + (parseInt(item.type_power_ps) || 0);
    }, 0) / results.length;

    return {
      totalResults: results.length,
      fuelTypes,
      avgPowerPs: Math.round(avgPower),
      yearRange: {
        min: Math.min(...results.map(r => parseInt(r.type_year_from) || 9999)),
        max: Math.max(...results.map(r => parseInt(r.type_year_to) || new Date().getFullYear()))
      }
    };
  }
}
