import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import {
  VehiclePaginationDto,
  VehicleResponseDto,
  VehicleSearchDto,
  VehicleFilterDto,
} from './dto/vehicles.dto';

// Types enrichis inspirés de la proposition utilisateur
export interface VehicleDetailsEnhanced {
  type_id: number;
  type_name: string;
  type_name_meta?: string;
  type_alias: string;
  type_power_ps?: number;
  type_power_kw?: number;
  type_engine?: string;
  type_fuel?: string;
  type_year_from?: string;
  type_year_to?: string;
  type_month_from?: string;
  type_month_to?: string;
  type_display: boolean;
  
  // Relations enrichies
  auto_marque: {
    marque_id: number;
    marque_name: string;
    marque_name_meta?: string;
    marque_alias: string;
    marque_logo?: string;
    marque_relfollow: boolean;
  };
  
  auto_modele: {
    modele_id: number;
    modele_name: string;
    modele_name_meta?: string;
    modele_alias: string;
    modele_relfollow: boolean;
    modele_year_from?: string;
    modele_year_to?: string;
  };
  
  auto_type_motor_code?: Array<{
    tmc_code: string;
    tmc_description?: string;
  }>;
}

/**
 * 🚗 SERVICE VEHICLES OPTIMAL AMÉLIORÉ - Version finale
 *
 * Combine le meilleur du service existant avec les améliorations proposées :
 * - Architecture SupabaseBaseService validée (évite dépendances circulaires)
 * - Tables auto_* optimisées et validées en production
 * - Méthodes getVehicleDetails enrichies avec relations complètes
 * - Cache intelligent intégré avec TTL
 * - Gestion d'erreurs robuste et logging détaillé
 * - Types TypeScript stricts pour meilleure maintenance
 * 
 * Tables utilisées :
 * - auto_marque (40 marques actives avec logos et SEO)
 * - auto_modele (5745 modèles avec périodes de production)
 * - auto_type (48918 types/motorisations avec spécifications complètes)
 * - auto_type_motor_code (codes moteur détaillés)
 */
@Injectable()
export class VehiclesService extends SupabaseBaseService {
  // Pas de constructeur - utilise celui du parent sans ConfigService
  // Cela évite les dépendances circulaires
  
  // Cache en mémoire simple pour éviter les requêtes répétitives
  private cache = new Map<string, { data: any; expires: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * 🎯 Cache intelligent avec TTL
   */
  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.CACHE_TTL,
    });
  }

  /**
   * 🚗 NOUVELLE MÉTHODE - Récupérer les détails complets d'un véhicule
   * Version améliorée de la méthode proposée par l'utilisateur
   * Intègre cache intelligent et relations complètes
   */
  async getVehicleDetails(
    marqueId: number,
    modeleId: number,
    typeId: number,
  ): Promise<VehicleDetailsEnhanced> {
    const cacheKey = `vehicle_details_${marqueId}_${modeleId}_${typeId}`;
    const cached = this.getCached<VehicleDetailsEnhanced>(cacheKey);
    if (cached) {
      this.logger.debug(`🔄 Cache hit pour véhicule ${typeId}`);
      return cached;
    }

    try {
      this.logger.debug(
        `🔍 Récupération détails véhicule: marque=${marqueId}, modele=${modeleId}, type=${typeId}`,
      );

      const { data, error } = await this.client
        .from('auto_type')
        .select(`
          type_id,
          type_name,
          type_name_meta,
          type_alias,
          type_power_ps,
          type_power_kw,
          type_engine,
          type_fuel,
          type_year_from,
          type_year_to,
          type_month_from,
          type_month_to,
          type_display,
          type_marque_id,
          type_modele_id,
          auto_marque!inner (
            marque_id,
            marque_name,
            marque_name_meta,
            marque_alias,
            marque_logo,
            marque_relfollow
          ),
          auto_modele!inner (
            modele_id,
            modele_name,
            modele_name_meta,
            modele_alias,
            modele_relfollow,
            modele_year_from,
            modele_year_to
          ),
          auto_type_motor_code (
            tmc_code,
            tmc_description
          )
        `)
        .eq('type_id', typeId)
        .eq('type_marque_id', marqueId)
        .eq('type_modele_id', modeleId)
        .eq('type_display', true)
        .single();

      if (error) {
        this.logger.error(`❌ Erreur getVehicleDetails:`, error);
        throw error;
      }

      if (!data) {
        throw new Error(
          `Véhicule non trouvé: marque=${marqueId}, modele=${modeleId}, type=${typeId}`,
        );
      }

      this.logger.debug(
        `✅ Détails véhicule trouvés: ${data.auto_marque[0]?.marque_name} ${data.auto_modele[0]?.modele_name} ${data.type_name}`,
      );

      // Mise en cache
      this.setCache(cacheKey, {
        ...data,
        auto_marque: data.auto_marque[0],
        auto_modele: data.auto_modele[0],
      });

      return {
        ...data,
        auto_marque: data.auto_marque[0],
        auto_modele: data.auto_modele[0],
      };
    } catch (error) {
      this.logger.error(`💥 Exception getVehicleDetails:`, error);
      throw error;
    }
  }

  /**
   * 🏭 NOUVELLE MÉTHODE - Récupérer les véhicules d'une marque (version optimisée)
   * Amélioration de la méthode proposée avec cache et relations complètes
   */
  async getVehiclesByMarque(marqueId: number): Promise<VehicleResponseDto> {
    const cacheKey = `vehicles_by_marque_${marqueId}`;
    const cached = this.getCached<VehicleResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(`🔄 Cache hit pour marque ${marqueId}`);
      return cached;
    }

    try {
      this.logger.debug(`🔍 Récupération véhicules marque ${marqueId}`);

      const { data, error } = await this.client
        .from('auto_modele')
        .select(`
          modele_id,
          modele_name,
          modele_alias,
          modele_ful_name,
          modele_year_from,
          modele_year_to,
          modele_display,
          auto_type!inner(
            type_id,
            type_name,
            type_alias,
            type_power_ps,
            type_fuel,
            type_year_from,
            type_year_to,
            type_display
          )
        `)
        .eq('modele_marque_id', marqueId)
        .eq('modele_display', true)
        .eq('auto_type.type_display', true)
        .order('modele_name')
        .limit(100);

      if (error) {
        this.logger.error(`❌ Erreur getVehiclesByMarque:`, error);
        throw error;
      }

      const result = {
        data: data || [],
        total: data?.length || 0,
        page: 0,
        limit: 100,
        meta: { marqueId },
      };

      this.logger.debug(
        `✅ Trouvé ${result.total} véhicules pour marque ${marqueId}`,
      );

      // Mise en cache
      this.setCache(cacheKey, result);

      return result;
    } catch (error) {
      this.logger.error(`💥 Exception getVehiclesByMarque:`, error);
      return {
        data: [],
        total: 0,
        page: 0,
        limit: 100,
        meta: { 
          marqueId, 
          error: error instanceof Error ? error.message : 'Erreur inconnue' 
        },
      };
    }
  }

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
      // 🎯 FILTRAGE OPTIMISÉ : Requête unique pour modèles avec motorisations
      if (filters?.year) {
        this.logger.debug(
          `📅 Filtrage optimisé des modèles avec motorisations pour l'année ${filters.year}`,
        );
        
        // Requête optimisée : récupérer les modele_id qui ont des motorisations pour l'année
        const { data: modelIdsWithTypes, error: typeError } = await this.client
          .from('auto_type')
          .select('type_modele_id')
          .eq('type_marque_id', brandId)
          .lte('type_year_from', filters.year.toString())
          .or(`type_year_to.is.null,type_year_to.gte.${filters.year}`);

        if (typeError) {
          this.logger.error('Erreur récupération types avec années:', typeError);
          throw typeError;
        }

        if (!modelIdsWithTypes || modelIdsWithTypes.length === 0) {
          return {
            data: [],
            total: 0,
            page: filters?.page || 0,
            limit: filters?.limit || 50,
          };
        }

        // Extraire les IDs uniques des modèles ayant des motorisations
        const uniqueModelIds = [...new Set(modelIdsWithTypes.map(t => t.type_modele_id))];

        // Récupérer les modèles correspondants avec filtrage par année de production
        let query = this.client
          .from('auto_modele')
          .select(`
            modele_id,
            modele_parent,
            modele_marque_id,
            modele_mdg_id,
            modele_alias,
            modele_name,
            modele_name_url,
            modele_name_meta,
            modele_ful_name,
            modele_month_from,
            modele_year_from,
            modele_month_to,
            modele_year_to,
            modele_body,
            modele_pic,
            modele_relfollow,
            modele_sitemap,
            modele_display,
            modele_display_v1,
            modele_sort,
            modele_is_new
          `,
          )
          .eq('modele_marque_id', brandId)
          .lte('modele_year_from', filters.year)
          .or(`modele_year_to.gte.${filters.year},modele_year_to.is.null`)
          .in('modele_id', uniqueModelIds);

        if (filters?.search) {
          query = query.ilike('modele_name', `%${filters.search}%`);
        }

        const offset = (filters?.page || 0) * (filters?.limit || 50);
        const { data, error } = await query
          .order('modele_name', { ascending: true })
          .range(offset, offset + (filters?.limit || 50) - 1);

        if (error) {
          this.logger.error('Erreur findModelsByBrand optimisé:', error);
          throw error;
        }

        // Compter le total pour la pagination
        const { count } = await this.client
          .from('auto_modele')
          .select('modele_id', { count: 'exact' })
          .eq('modele_marque_id', brandId)
          .lte('modele_year_from', filters.year)
          .or(`modele_year_to.gte.${filters.year},modele_year_to.is.null`)
          .in('modele_id', uniqueModelIds);

        this.logger.debug(
          `📊 Modèles optimisés pour ${brandId} année ${filters.year}: ${data?.length || 0} (total: ${count || 0})`,
        );

        return {
          data: data || [],
          total: count || 0,
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
        .eq('type_display', 1) // 🎯 Seulement les types affichables
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
      // 🎯 Requête simple pour récupérer les détails du type
      const { data: typeData, error: typeError } = await this.client
        .from('auto_type')
        .select('*')
        .eq('type_id', typeId)
        .eq('type_display', 1)
        .single();

      if (typeError || !typeData) {
        this.logger.error('Erreur getTypeById - type:', typeError);
        return { data: null, error: typeError };
      }

      // 🔄 Récupérer les infos du modèle
      const { data: modelData, error: modelError } = await this.client
        .from('auto_modele')
        .select(`
          modele_id,
          modele_name,
          modele_ful_name,
          modele_marque_id
        `)
        .eq('modele_id', typeData.type_modele_id)
        .single();

      if (modelError || !modelData) {
        this.logger.error('Erreur getTypeById - model:', modelError);
        return { data: null, error: modelError };
      }

      // 🏷️ Récupérer les infos de la marque
      const { data: brandData, error: brandError } = await this.client
        .from('auto_marque')
        .select(`
          marque_id,
          marque_name
        `)
        .eq('marque_id', modelData.modele_marque_id)
        .single();

      if (brandError || !brandData) {
        this.logger.error('Erreur getTypeById - brand:', brandError);
        return { data: null, error: brandError };
      }

      // 📦 Assembler la réponse complète
      const enrichedData = {
        ...typeData,
        auto_modele: {
          ...modelData,
          auto_marque: brandData
        }
      };

      return { data: [enrichedData], error: null };
    } catch (error) {
      this.logger.error('Exception getTypeById:', error);
      throw error;
    }
  }

  /**
   * 📅 Récupérer les années de production par marque
   */
  async findYearsByBrand(
    brandId: string,
    filters?: VehiclePaginationDto,
  ): Promise<VehicleResponseDto> {
    try {
      // 🎯 COHÉRENCE : Utiliser auto_modele comme findModelsByBrand
      const { data, error } = await this.client
        .from('auto_modele')
        .select('modele_year_from, modele_year_to')
        .eq('modele_marque_id', parseInt(brandId))
        .eq('modele_display', 1)
        .not('modele_year_from', 'is', null)
        .limit(1000); // Plus large car on va extraire toutes les années

      if (error) {
        this.logger.error('Erreur findYearsByBrand:', error);
        throw error;
      }

      // Extraction des années uniques depuis auto_modele
      const yearsSet = new Set<number>();
      data?.forEach((item) => {
        const yearFrom = parseInt(item.modele_year_from);
        const yearTo = item.modele_year_to
          ? parseInt(item.modele_year_to)
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

  /**
   * 🧹 NOUVELLE MÉTHODE - Nettoyage du cache
   */
  clearCache(pattern?: string): number {
    if (!pattern) {
      const size = this.cache.size;
      this.cache.clear();
      this.logger.log(`🧹 Cache complet nettoyé: ${size} entrées supprimées`);
      return size;
    }

    let deleted = 0;
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    this.logger.log(`🧹 Cache partiel nettoyé: ${deleted} entrées avec pattern "${pattern}"`);
    return deleted;
  }

  /**
   * 📊 NOUVELLE MÉTHODE - État du cache
   */
  getCacheStats() {
    const now = Date.now();
    let active = 0;
    let expired = 0;

    for (const [, cached] of this.cache) {
      if (cached.expires > now) {
        active++;
      } else {
        expired++;
      }
    }

    return {
      totalEntries: this.cache.size,
      activeEntries: active,
      expiredEntries: expired,
      memoryUsage: `${Math.round(JSON.stringify([...this.cache]).length / 1024)}KB`,
      ttl: this.CACHE_TTL / 1000 + 's',
      service: 'VehiclesService Enhanced',
      version: '2.0.0-improved',
    };
  }
}
