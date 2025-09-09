import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { VehicleSearchDto, VehicleFilterDto } from './dto/vehicles.dto';

/**
 * 🚗 SERVICE VEHICLES FORMS - MEILLEURE APPROCHE
 *
 * Service optimisé pour les formulaires de recherche véhicules
 * Utilise les vraies tables auto_* qui fonctionnent
 * Inspiré des méthodes _form.get.car.*.php
 *
 * Tables : auto_marque (40), auto_modele (5745), auto_type (48918)
 */
@Injectable()
export class VehiclesFormsService extends SupabaseBaseService {
  /**
   * Récupère tous les modèles disponibles (sans filtrage par marque)
   * Équivalent à _form.get.car.modele.php
   */
  async getAllModels(filter?: VehicleFilterDto) {
    try {
      let query = this.client
        .from('auto_modele')
        .select(
          `
          modele_id,
          modele_alias,
          modele_name,
          modele_ful_name,
          modele_marque_id,
          auto_marque!inner(marque_id, marque_name, marque_alias)
        `,
        )
        .eq('modele_display', 1)
        .eq('auto_marque.marque_display', 1);

      if (filter?.search) {
        query = query.or(`
          modele_name.ilike.%${filter.search}%,
          modele_ful_name.ilike.%${filter.search}%,
          modele_alias.ilike.%${filter.search}%
        `);
      }

      if (filter?.brandId) {
        query = query.eq('modele_marque_id', filter.brandId);
      }

      const { data, error } = await query
        .order('modele_name', { ascending: true })
        .limit(filter?.limit || 100)
        .range(
          filter?.offset || 0,
          (filter?.offset || 0) + (filter?.limit || 100) - 1,
        );

      if (error) {
        this.logger.error('Error fetching models:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Exception getAllModels:', error);
      throw error;
    }
  }

  /**
   * Récupère tous les types disponibles
   * Équivalent à _form.get.car.type.php
   */
  async getAllTypes(filter?: VehicleFilterDto) {
    try {
      let query = this.client
        .from('auto_type')
        .select(
          `
          type_id,
          type_alias,
          type_name,
          type_code_moteur as type_engine_code,
          type_carburant as type_fuel,
          type_puissance_cv as type_power_ps,
          type_puissance_kw as type_power_kw,
          type_cylindree as type_liter,
          type_date_debut as type_year_from,
          type_date_fin as type_year_to,
          type_modele_id as modele_id,
          auto_modele!type_modele_id(
            modele_id,
            modele_name,
            modele_ful_name,
            auto_marque!modele_marque_id(marque_id, marque_name, marque_alias)
          )
        `,
        )
        .eq('type_display', 1);

      if (filter?.search) {
        query = query.or(`
          type_name.ilike.%${filter.search}%,
          type_code_moteur.ilike.%${filter.search}%,
          auto_modele.modele_name.ilike.%${filter.search}%
        `);
      }

      if (filter?.modelId) {
        query = query.eq('type_modele_id', filter.modelId);
      }

      if (filter?.onlyActive) {
        query = query.is('type_year_to', null);
      }

      const { data, error } = await query
        .order('auto_modele.auto_marque.marque_name')
        .order('auto_modele.modele_name')
        .order('type_name')
        .limit(filter?.limit || 200);

      if (error) {
        this.logger.error('Error fetching types:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Exception getAllTypes:', error);
      throw error;
    }
  }

  /**
   * Récupère toutes les années disponibles
   * Équivalent à _form.get.car.year.php
   */
  async getAllYears(filter?: {
    typeId?: number;
    startYear?: number;
    endYear?: number;
  }) {
    try {
      let query = this.client
        .from('auto_type')
        .select(
          `
          type_id,
          type_year_from,
          type_year_to,
          auto_modele!inner(
            modele_id,
            modele_name,
            auto_marque!inner(marque_id, marque_name)
          )
        `,
        )
        .eq('type_display', 1)
        .not('type_year_from', 'is', null);

      if (filter?.typeId) {
        query = query.eq('type_id', filter.typeId);
      }

      if (filter?.startYear) {
        query = query.gte('type_year_from', filter.startYear);
      }

      if (filter?.endYear) {
        query = query.lte('type_year_from', filter.endYear);
      }

      const { data, error } = await query.order('type_year_from', {
        descending: true,
      });

      if (error) {
        this.logger.error('Error fetching years:', error);
        throw error;
      }

      // Générer la liste des années uniques
      const years = new Set<number>();
      data?.forEach((item) => {
        const startYear = item.type_year_from;
        const endYear = item.type_year_to || new Date().getFullYear();

        for (let year = startYear; year <= endYear; year++) {
          years.add(year);
        }
      });

      const uniqueYears = Array.from(years).sort((a, b) => b - a);

      return {
        years: uniqueYears.map((year) => ({
          year,
          count:
            data?.filter(
              (item) =>
                year >= item.type_year_from &&
                year <= (item.type_year_to || new Date().getFullYear()),
            ).length || 0,
        })),
        totalYears: uniqueYears.length,
        details: data,
      };
    } catch (error) {
      this.logger.error('Exception getAllYears:', error);
      throw error;
    }
  }

  /**
   * Recherche avancée de véhicules
   */
  async searchVehicles(searchDto: VehicleSearchDto) {
    try {
      let query = this.client
        .from('auto_type')
        .select(
          `
          type_id,
          type_name,
          type_fuel,
          type_power_ps,
          type_engine_code,
          type_year_from,
          type_year_to,
          auto_modele!inner(
            modele_id,
            modele_name,
            modele_alias,
            auto_marque!inner(marque_id, marque_name, marque_alias)
          )
        `,
        )
        .eq('type_display', 1)
        .eq('auto_modele.modele_display', 1)
        .eq('auto_modele.auto_marque.marque_display', 1);

      if (searchDto.brandCode) {
        query = query.eq(
          'auto_modele.auto_marque.marque_alias',
          searchDto.brandCode,
        );
      }

      if (searchDto.modelCode) {
        query = query.eq('auto_modele.modele_alias', searchDto.modelCode);
      }

      if (searchDto.fuelType) {
        query = query.eq('type_fuel', searchDto.fuelType);
      }

      if (searchDto.engineCode) {
        query = query.ilike('type_engine_code', `%${searchDto.engineCode}%`);
      }

      if (searchDto.year) {
        query = query
          .lte('type_year_from', searchDto.year)
          .or(`type_year_to.is.null,type_year_to.gte.${searchDto.year}`);
      }

      const { data, error } = await query
        .order('auto_modele.auto_marque.marque_name')
        .order('auto_modele.modele_name')
        .order('type_name')
        .limit(100);

      if (error) {
        this.logger.error('Error searching vehicles:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Exception searchVehicles:', error);
      throw error;
    }
  }

  /**
   * Obtenir les statistiques des véhicules
   */
  async getVehicleStats() {
    try {
      const [brandsResult, modelsResult, typesResult, activeTypesResult] =
        await Promise.all([
          this.client
            .from('auto_marque')
            .select('marque_id', { count: 'exact' })
            .eq('marque_display', 1),
          this.client
            .from('auto_modele')
            .select('modele_id', { count: 'exact' })
            .eq('modele_display', 1),
          this.client
            .from('auto_type')
            .select('type_id', { count: 'exact' })
            .eq('type_display', 1),
          this.client
            .from('auto_type')
            .select('type_id', { count: 'exact' })
            .eq('type_display', 1)
            .is('type_year_to', null),
        ]);

      if (brandsResult.error) throw brandsResult.error;
      if (modelsResult.error) throw modelsResult.error;
      if (typesResult.error) throw typesResult.error;
      if (activeTypesResult.error) throw activeTypesResult.error;

      return {
        brands: brandsResult.count || 0,
        models: modelsResult.count || 0,
        types: typesResult.count || 0,
        activeTypes: activeTypesResult.count || 0,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Exception getVehicleStats:', error);
      throw error;
    }
  }
}
