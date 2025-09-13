import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import {
  VehiclePaginationDto,
  VehicleResponseDto,
  VehicleSearchDto,
  VehicleFilterDto,
} from './dto/vehicles.dto';

/**
 * 🚗 SERVICE VEHICLES OPTIMAL - Meilleure approche
 *
 * Utilise les vraies tables de la base de données qui fonctionnent :
 * - auto_marque (40 marques actives)
 * - auto_modele (5745 modèles)
 * - auto_type (48918 types/motorisations)
 *
 * Amélioration : Recherche avancée + Filtrage optimisé + Gestion d'erreurs
 */
@Injectable()
export class VehiclesService extends SupabaseBaseService {
  // Pas de constructeur - utilise celui du parent sans ConfigService
  // Cela évite les dépendances circulaires

  /**
   * Récupérer toutes les marques avec pagination
   */
  async findAll(filters?: VehiclePaginationDto): Promise<VehicleResponseDto> {
    try {
      let query = this.client
        .from('auto_marque')
        .select(`*`)
        .eq('marque_display', 1)
        .limit(filters?.limit || 50);

      if (filters?.search) {
        query = query.ilike('marque_name', `%${filters.search}%`);
      }

      const offset = (filters?.page || 0) * (filters?.limit || 50);
      const { data, error } = await query
        .order('marque_name', { ascending: true })
        .range(offset, offset + (filters?.limit || 50) - 1);

      if (error) {
        this.logger.error('Erreur findAll:', error);
        throw error;
      }

      return {
        data: data || [],
        total: data?.length || 0,
        page: filters?.page || 0,
        limit: filters?.limit || 50,
      };
    } catch (error) {
      this.logger.error('Erreur dans findAll:', error);
      throw error;
    }
  }

  /**
   * Récupérer les modèles d'une marque
   */
  async findModelsByBrand(
    brandId: string,
    filters?: VehiclePaginationDto,
  ): Promise<VehicleResponseDto> {
    try {
      // 🎯 FILTRAGE INTELLIGENT : Si une année est spécifiée, ne retourner que les modèles
      // qui ont au moins une motorisation disponible pour cette année
      if (filters?.year) {
        // Récupérer les IDs des modèles qui ont des motorisations pour l'année donnée
        const { data: modelIds, error: modelIdsError } = await this.client
          .from('auto_type')
          .select('type_modele_id')
          .lte('type_year_from', filters.year.toString())
          .gte('type_year_to', filters.year.toString());

        if (modelIdsError) {
          this.logger.error('Erreur récupération modelIds:', modelIdsError);
          throw modelIdsError;
        }

        // Extraire les IDs uniques
        const validModelIds = [
          ...new Set(modelIds?.map((item) => item.type_modele_id) || []),
        ];

        // Si aucun modèle n'a de motorisations pour cette année, retourner vide
        if (validModelIds.length === 0) {
          return {
            data: [],
            total: 0,
            page: filters?.page || 0,
            limit: filters?.limit || 50,
          };
        }

        // Requête filtrée par les modèles ayant des motorisations
        let query = this.client
          .from('auto_modele')
          .select(`*`)
          .eq('modele_marque_id', brandId)
          .in('modele_id', validModelIds)
          .limit(filters?.limit || 50);

        if (filters?.search) {
          query = query.ilike('modele_name', `%${filters.search}%`);
        }

        const offset = (filters?.page || 0) * (filters?.limit || 50);
        const { data, error } = await query
          .order('modele_name', { ascending: true })
          .range(offset, offset + (filters?.limit || 50) - 1);

        if (error) {
          this.logger.error('Erreur findModelsByBrand avec année:', error);
          throw error;
        }

        return {
          data: data || [],
          total: data?.length || 0,
          page: filters?.page || 0,
          limit: filters?.limit || 50,
        };
      }

      // 📋 REQUÊTE NORMALE : Sans filtrage par année, retourner tous les modèles
      let query = this.client
        .from('auto_modele')
        .select(`*`)
        .eq('modele_marque_id', brandId)
        .limit(filters?.limit || 50);

      if (filters?.search) {
        query = query.ilike('modele_name', `%${filters.search}%`);
      }

      const offset = (filters?.page || 0) * (filters?.limit || 50);
      const { data, error } = await query
        .order('modele_name', { ascending: true })
        .range(offset, offset + (filters?.limit || 50) - 1);

      if (error) {
        this.logger.error('Erreur findModelsByBrand:', error);
        throw error;
      }

      return {
        data: data || [],
        total: data?.length || 0,
        page: filters?.page || 0,
        limit: filters?.limit || 50,
      };
    } catch (error) {
      this.logger.error('Erreur dans findModelsByBrand:', error);
      throw error;
    }
  }

  /**
   * Récupérer les types d'un modèle
   */
  async findTypesByModel(
    modelId: string,
    filters?: VehiclePaginationDto,
  ): Promise<VehicleResponseDto> {
    try {
      let query = this.client
        .from('auto_type')
        .select(`*`)
        .eq('type_modele_id', modelId)
        .limit(filters?.limit || 50);

      if (filters?.search) {
        query = query.ilike('type_name', `%${filters.search}%`);
      }

      // 🗓️ FILTRAGE PAR ANNÉE - Motorisations disponibles pour l'année sélectionnée
      if (filters?.year) {
        query = query
          .lte('type_year_from', filters.year.toString()) // Début <= année sélectionnée
          .or(`type_year_to.is.null,type_year_to.gte.${filters.year}`); // Fin NULL OU >= année sélectionnée
      }

      const offset = (filters?.page || 0) * (filters?.limit || 50);
      const { data, error } = await query
        .order('type_name', { ascending: true })
        .range(offset, offset + (filters?.limit || 50) - 1);

      if (error) {
        this.logger.error('Erreur findTypesByModel:', error);
        throw error;
      }

      return {
        data: data || [],
        total: data?.length || 0,
        page: filters?.page || 0,
        limit: filters?.limit || 50,
      };
    } catch (error) {
      this.logger.error('Erreur dans findTypesByModel:', error);
      throw error;
    }
  }

  /**
   * Recherche avancée de véhicules par codes et critères
   */
  async searchByCode(searchDto: VehicleSearchDto): Promise<VehicleResponseDto> {
    try {
      let query = this.client
        .from('auto_type')
        .select(
          `
          *,
          auto_modele!inner(
            *,
            auto_marque!inner(*)
          )
        `,
        )
        .limit(50);

      // Filtre par marque via code
      if (searchDto.brandCode) {
        query = query.eq(
          'auto_modele.auto_marque.marque_alias',
          searchDto.brandCode,
        );
      }

      // Filtre par modèle via alias
      if (searchDto.modelCode) {
        query = query.eq('auto_modele.modele_alias', searchDto.modelCode);
      }

      // Filtre par carburant
      if (searchDto.fuelType) {
        query = query.eq('type_fuel', searchDto.fuelType);
      }

      // Filtre par code moteur
      if (searchDto.engineCode) {
        query = query.ilike('type_engine', `%${searchDto.engineCode}%`);
      }

      // Filtre par année
      if (searchDto.year) {
        query = query
          .lte('type_year_from', searchDto.year.toString())
          .or(`type_year_to.is.null,type_year_to.gte.${searchDto.year}`);
      }

      const { data, error } = await query.order(
        'auto_modele.auto_marque.marque_name',
      );

      if (error) {
        this.logger.error('Erreur searchByCode:', error);
        throw error;
      }

      return {
        data: data || [],
        total: data?.length || 0,
        page: 0,
        limit: 50,
        meta: { searchCriteria: searchDto },
      };
    } catch (error) {
      this.logger.error('Erreur dans searchByCode:', error);
      throw error;
    }
  }

  /**
   * Filtrage avancé avec offset/limit
   */
  async filterVehicles(
    filterDto: VehicleFilterDto,
  ): Promise<VehicleResponseDto> {
    try {
      let query = this.client
        .from('auto_type')
        .select(
          `
          *,
          auto_modele!inner(
            *,
            auto_marque!inner(*)
          )
        `,
        )
        .limit(filterDto.limit || 50);

      if (filterDto.offset) {
        query = query.range(
          filterDto.offset,
          filterDto.offset + (filterDto.limit || 50) - 1,
        );
      }

      // Filtres
      if (filterDto.search) {
        query = query.or(
          `type_name.ilike.%${filterDto.search}%,auto_modele.modele_name.ilike.%${filterDto.search}%,auto_modele.auto_marque.marque_name.ilike.%${filterDto.search}%`,
        );
      }

      if (filterDto.brandId) {
        query = query.eq(
          'auto_modele.auto_marque.marque_id',
          filterDto.brandId,
        );
      }

      if (filterDto.modelId) {
        query = query.eq('auto_modele.modele_id', filterDto.modelId);
      }

      if (filterDto.onlyActive) {
        query = query.is('type_year_to', null);
      }

      const { data, error } = await query.order(
        'auto_modele.auto_marque.marque_name',
      );

      if (error) {
        this.logger.error('Erreur filterVehicles:', error);
        throw error;
      }

      return {
        data: data || [],
        total: data?.length || 0,
        page: Math.floor((filterDto.offset || 0) / (filterDto.limit || 50)),
        limit: filterDto.limit || 50,
        meta: { filters: filterDto },
      };
    } catch (error) {
      this.logger.error('Erreur dans filterVehicles:', error);
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
   * 🎯 Recherche avancée simplifiée - Version qui fonctionne
   */
  async searchAdvanced(searchTerm: string, limit: number = 20) {
    try {
      // Recherche dans les marques uniquement pour commencer
      const brandsResult = await this.client
        .from('auto_marque')
        .select('marque_id, marque_name, marque_alias, marque_logo')
        .eq('marque_display', 1)
        .ilike('marque_name', `%${searchTerm}%`)
        .order('marque_name')
        .limit(Math.min(limit, 10));

      if (brandsResult.error) {
        this.logger.error('Erreur recherche marques:', brandsResult.error);
        throw brandsResult.error;
      }

      // Recherche dans les modèles
      const modelsResult = await this.client
        .from('auto_modele')
        .select(
          'modele_id, modele_name, modele_alias, modele_ful_name, modele_marque_id',
        )
        .eq('modele_display', 1)
        .ilike('modele_name', `%${searchTerm}%`)
        .order('modele_name')
        .limit(Math.min(limit, 20));

      if (modelsResult.error) {
        this.logger.error('Erreur recherche modèles:', modelsResult.error);
        throw modelsResult.error;
      }

      return {
        brands: brandsResult.data || [],
        models: modelsResult.data || [],
        types: [], // Pour l'instant, on skip les types
        total:
          (brandsResult.data?.length || 0) + (modelsResult.data?.length || 0),
        searchTerm,
      };
    } catch (error) {
      this.logger.error('Exception searchAdvanced:', error);
      throw error;
    }
  }

  /**
   * Recherche de véhicules par code mine (version simplifiée)
   */
  async searchByMineCode(mineCode: string): Promise<VehicleResponseDto> {
    try {
      // Première requête : récupérer les codes mine
      const { data: codeData, error: codeError } = await this.client
        .from('auto_type_number_code')
        .select('*')
        .eq('tnc_code', mineCode)
        .limit(10);

      if (codeError) {
        this.logger.error('Erreur searchByMineCode (codes):', codeError);
        throw codeError;
      }

      if (!codeData || codeData.length === 0) {
        return {
          data: [],
          total: 0,
          page: 0,
          limit: 50,
          meta: { mineCode, message: 'Code mine non trouvé' },
        };
      }

      // Récupérer les type_ids correspondants
      const typeIds = codeData.map((item) => item.tnc_type_id).filter(Boolean);

      if (typeIds.length === 0) {
        return {
          data: [],
          total: 0,
          page: 0,
          limit: 50,
          meta: { mineCode, message: 'Aucun type de véhicule associé' },
        };
      }

      // Deuxième requête : récupérer les détails des types
      const { data: typeData, error: typeError } = await this.client
        .from('auto_type')
        .select('*')
        .in('type_id', typeIds)
        .limit(50);

      if (typeError) {
        this.logger.error('Erreur searchByMineCode (types):', typeError);
        throw typeError;
      }

      // Combiner les données
      const combinedData = codeData
        .map((code) => {
          const type = typeData?.find((t) => t.type_id === code.tnc_type_id);
          return {
            ...code,
            auto_type: type || null,
          };
        })
        .filter((item) => item.auto_type !== null);

      return {
        data: combinedData,
        total: combinedData.length,
        page: 0,
        limit: 50,
        meta: { mineCode },
      };
    } catch (error) {
      this.logger.error('Erreur dans searchByMineCode:', error);
      throw error;
    }
  }

  /**
   * Recherche de véhicules par code CNIT (version simplifiée)
   */
  async searchByCnit(cnitCode: string): Promise<VehicleResponseDto> {
    try {
      // Première requête : récupérer les codes CNIT
      const { data: codeData, error: codeError } = await this.client
        .from('auto_type_number_code')
        .select('*')
        .eq('tnc_cnit', cnitCode)
        .limit(10);

      if (codeError) {
        this.logger.error('Erreur searchByCnit (codes):', codeError);
        throw codeError;
      }

      if (!codeData || codeData.length === 0) {
        return {
          data: [],
          total: 0,
          page: 0,
          limit: 50,
          meta: { cnitCode, message: 'Code CNIT non trouvé' },
        };
      }

      // Récupérer les type_ids correspondants
      const typeIds = codeData.map((item) => item.tnc_type_id).filter(Boolean);

      if (typeIds.length === 0) {
        return {
          data: [],
          total: 0,
          page: 0,
          limit: 50,
          meta: { cnitCode, message: 'Aucun type de véhicule associé' },
        };
      }

      // Deuxième requête : récupérer les détails des types
      const { data: typeData, error: typeError } = await this.client
        .from('auto_type')
        .select('*')
        .in('type_id', typeIds)
        .limit(50);

      if (typeError) {
        this.logger.error('Erreur searchByCnit (types):', typeError);
        throw typeError;
      }

      // Combiner les données
      const combinedData = codeData
        .map((code) => {
          const type = typeData?.find((t) => t.type_id === code.tnc_type_id);
          return {
            ...code,
            auto_type: type || null,
          };
        })
        .filter((item) => item.auto_type !== null);

      return {
        data: combinedData,
        total: combinedData.length,
        page: 0,
        limit: 50,
        meta: { cnitCode },
      };
    } catch (error) {
      this.logger.error('Erreur dans searchByCnit:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les codes mine pour un modèle donné
   */
  async getMinesByModel(modelId: string): Promise<VehicleResponseDto> {
    try {
      // Récupérer d'abord tous les types du modèle (sans jointure)
      const { data: typesData, error: typesError } = await this.client
        .from('auto_type')
        .select('*')
        .eq('type_modele_id', modelId)
        .eq('type_display', '1')
        .limit(100);

      if (typesError) {
        this.logger.error('Erreur getMinesByModel (types):', typesError);
        throw typesError;
      }

      if (!typesData || typesData.length === 0) {
        return {
          data: [],
          total: 0,
          page: 0,
          limit: 100,
          meta: { modelId, message: 'Aucun type trouvé pour ce modèle' },
        };
      }

      // Récupérer les codes mine pour ces types
      const typeIds = typesData.map((t) => t.type_id);
      const { data: minesData, error: minesError } = await this.client
        .from('auto_type_number_code')
        .select('*')
        .in('tnc_type_id', typeIds)
        .limit(200);

      if (minesError) {
        this.logger.error('Erreur getMinesByModel (mines):', minesError);
        throw minesError;
      }

      // Combiner les données
      const results = typesData
        .map((type) => {
          const mine = minesData?.find((m) => m.tnc_type_id === type.type_id);
          if (mine) {
            return {
              ...mine,
              auto_type: type,
            };
          }
          return null;
        })
        .filter(Boolean);

      return {
        data: results || [],
        total: results?.length || 0,
        page: 0,
        limit: 100,
        meta: { modelId },
      };
    } catch (error) {
      this.logger.error('Erreur dans getMinesByModel:', error);
      throw error;
    }
  }

  /**
   * Statistiques générales du système véhicules
   */
  async getVehicleStats() {
    try {
      const [brandsResult, modelsResult, typesResult] = await Promise.all([
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
      ]);

      return {
        totalBrands: brandsResult.count || 0,
        totalModels: modelsResult.count || 0,
        totalTypes: typesResult.count || 0,
        totalProducts: 15000, // Mock value - replace with actual product count
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur dans getVehicleStats:', error);
      throw error;
    }
  }

  /**
   * Récupérer un type par son ID
   */
  async getTypeById(typeId: number) {
    try {
      const { data, error } = await this.client
        .from('auto_type')
        .select(
          `
          type_id,
          type_nom_moteur,
          type_code_moteur,
          type_pf_deb,
          type_pf_fin,
          type_modele_id,
          auto_modele!inner(
            modele_id,
            modele_name,
            modele_ful_name,
            auto_marque!inner(
              marque_id,
              marque_name
            )
          )
        `,
        )
        .eq('type_id', typeId)
        .eq('type_display', 1)
        .single();

      if (error) {
        this.logger.error('Erreur getTypeById:', error);
        return { data: null, error };
      }

      return { data: [data], error: null };
    } catch (error) {
      this.logger.error('Exception getTypeById:', error);
      throw error;
    }
  }

  /**
   * 📅 Récupérer les années de production par marque
   */
  async findYearsByBrand(brandId: string, filters?: VehiclePaginationDto): Promise<VehicleResponseDto> {
    try {
      // Simplifions d'abord - récupérons les années directement depuis auto_type
      const { data, error } = await this.client
        .from('auto_type')
        .select('type_year_from, type_year_to')
        .eq('type_marque_id', parseInt(brandId))
        .eq('type_display', 1)
        .not('type_year_from', 'is', null)
        .limit(100);

      if (error) {
        this.logger.error('Erreur findYearsByBrand:', error);
        throw error;
      }

      // Extraction des années uniques
      const yearsSet = new Set<number>();
      data?.forEach((item) => {
        const yearFrom = parseInt(item.type_year_from);
        const yearTo = item.type_year_to 
          ? parseInt(item.type_year_to) 
          : new Date().getFullYear();
        
        // Ajouter toutes les années de production
        for (let year = yearFrom; year <= yearTo; year++) {
          if (year >= 1950 && year <= new Date().getFullYear() + 1) {
            yearsSet.add(year);
          }
        }
      });

      // Convertir en array et trier par ordre décroissant (plus récent en premier)
      const years = Array.from(yearsSet)
        .sort((a, b) => b - a)
        .map((year) => ({ year, count: 1 })); // Format compatible avec la structure existante

      return {
        data: years,
        total: years.length,
        page: filters?.page || 0,
        limit: filters?.limit || 50,
      };
    } catch (error) {
      this.logger.error('Exception findYearsByBrand:', error);
      throw error;
    }
  }
}
