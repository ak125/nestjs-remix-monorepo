import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import { VehicleCacheService, CacheType } from '../core/vehicle-cache.service';
import { VehicleEnrichmentService } from '../core/vehicle-enrichment.service';
import { 
  PaginationOptions, 
  VehicleResponse
} from '../../types/vehicle.types';

/**
 * 🔍 VEHICLE SEARCH SERVICE - Service de recherche avancée pour véhicules
 * 
 * Responsabilités :
 * - Recherche par code (Mine, CNIT, etc.)
 * - Recherche textuelle avancée
 * - Recherche multi-critères
 * - Gestion de la pagination
 * - Cache des résultats de recherche
 */

export interface SearchCriteria {
  query?: string;
  marque?: string;
  modele?: string;
  annee?: number;
  type?: string;
  engineCode?: string;
}

export interface AdvancedSearchOptions extends PaginationOptions {
  searchIn?: string[]; // ['marque', 'modele', 'type']
  exactMatch?: boolean;
  includeEngine?: boolean;
}

@Injectable()
export class VehicleSearchService extends SupabaseBaseService {
  protected readonly logger = new Logger(VehicleSearchService.name);

  constructor(
    private cacheService: VehicleCacheService,
    private enrichmentService: VehicleEnrichmentService,
  ) {
    super();
    this.logger.log('🔍 VehicleSearchService initialisé');
  }

  /**
   * 🔍 Recherche par code (Mine, CNIT, etc.)
   */
  async searchByCode(
    code: string,
    options: PaginationOptions = {}
  ): Promise<VehicleResponse<any>> {
    if (!code?.trim()) {
      return { data: [], total: 0, page: 0, limit: options.limit || 50 };
    }

    const cacheKey = `code:${code}:${JSON.stringify(options)}`;
    
    return await this.cacheService.getOrSet(
      CacheType.SEARCH,
      cacheKey,
      async () => {
        try {
          this.logger.debug(`🔍 Recherche par code: ${code}`);

          const { page = 0, limit = 50 } = options;
          const offset = page * limit;

          // Recherche dans auto_type avec jointures
          let query = this.client
            .from('auto_type')
            .select(`
              *,
              auto_modele!inner(
                modele_id,
                modele_name,
                auto_marque!inner(
                  marque_id,
                  marque_name
                )
              )
            `)
            .eq('type_display', 1)
            .limit(limit)
            .range(offset, offset + limit - 1);

          // Recherche flexible par code
          query = query.or(
            `type_mine_code.ilike.%${code}%,` +
            `type_cnit_code.ilike.%${code}%,` +
            `type_name.ilike.%${code}%`
          );

          const { data, error, count } = await query.order('type_name');

          if (error) {
            this.logger.error('Erreur recherche par code:', error);
            throw error;
          }

          // Enrichissement des résultats
          const enrichedData = await this.enrichmentService.enrichVehicles(data || []);

          return {
            data: enrichedData,
            total: count || 0,
            page,
            limit
          };
        } catch (error) {
          this.logger.error(`Erreur searchByCode ${code}:`, error);
          throw error;
        }
      }
    );
  }

  /**
   * 🔍 Recherche textuelle avancée
   */
  async searchAdvanced(
    criteria: SearchCriteria,
    options: AdvancedSearchOptions = {}
  ): Promise<VehicleResponse<any>> {
    const { query } = criteria;
    if (!query?.trim()) {
      return { data: [], total: 0, page: 0, limit: options.limit || 50 };
    }

    const cacheKey = this.cacheService.generateSearchKey({ ...criteria, ...options });
    
    return await this.cacheService.getOrSet(
      CacheType.SEARCH,
      cacheKey,
      async () => {
        try {
          this.logger.debug(`🔍 Recherche avancée: ${query}`);

          const { page = 0, limit = 50, searchIn = ['marque', 'modele', 'type'] } = options;
          const offset = page * limit;

          // Construction de la requête avec jointures
          let dbQuery = this.client
            .from('auto_type')
            .select(`
              *,
              auto_modele!inner(
                modele_id,
                modele_name,
                auto_marque!inner(
                  marque_id,
                  marque_name
                )
              )
            `)
            .eq('type_display', 1)
            .limit(limit)
            .range(offset, offset + limit - 1);

          // Construction des conditions de recherche
          const searchConditions: string[] = [];

          if (searchIn.includes('marque')) {
            searchConditions.push(`auto_modele.auto_marque.marque_name.ilike.%${query}%`);
          }
          
          if (searchIn.includes('modele')) {
            searchConditions.push(`auto_modele.modele_name.ilike.%${query}%`);
          }
          
          if (searchIn.includes('type')) {
            searchConditions.push(`type_name.ilike.%${query}%`);
          }

          // Ajout de critères spécifiques
          if (criteria.marque) {
            dbQuery = dbQuery.eq('auto_modele.auto_marque.marque_name', criteria.marque);
          }
          
          if (criteria.modele) {
            dbQuery = dbQuery.eq('auto_modele.modele_name', criteria.modele);
          }

          if (criteria.engineCode) {
            dbQuery = dbQuery.ilike('type_engine_code', `%${criteria.engineCode}%`);
          }

          // Application des conditions de recherche
          if (searchConditions.length > 0) {
            dbQuery = dbQuery.or(searchConditions.join(','));
          }

          const { data, error, count } = await dbQuery.order('auto_modele.auto_marque.marque_name, auto_modele.modele_name, type_name');

          if (error) {
            this.logger.error('Erreur recherche avancée:', error);
            throw error;
          }

          // Enrichissement si demandé
          let enrichedData = data || [];
          if (options.includeEngine !== false) {
            enrichedData = await this.enrichmentService.enrichVehicles(enrichedData);
          }

          return {
            data: enrichedData,
            total: count || 0,
            page,
            limit
          };
        } catch (error) {
          this.logger.error('Erreur searchAdvanced:', error);
          throw error;
        }
      }
    );
  }

  /**
   * 🔍 Recherche par CNIT
   */
  async searchByCnit(
    cnitCode: string,
    options: PaginationOptions = {}
  ): Promise<VehicleResponse<any>> {
    if (!cnitCode?.trim()) {
      return { data: [], total: 0, page: 0, limit: options.limit || 50 };
    }

    const cacheKey = `cnit:${cnitCode}:${JSON.stringify(options)}`;
    
    return await this.cacheService.getOrSet(
      CacheType.SEARCH,
      cacheKey,
      async () => {
        try {
          this.logger.debug(`🔍 Recherche par CNIT: ${cnitCode}`);

          const { page = 0, limit = 50 } = options;
          const offset = page * limit;

          const { data, error, count } = await this.client
            .from('auto_type')
            .select(`
              *,
              auto_modele!inner(
                modele_id,
                modele_name,
                auto_marque!inner(
                  marque_id,
                  marque_name
                )
              )
            `)
            .eq('type_display', 1)
            .ilike('type_cnit_code', `%${cnitCode}%`)
            .limit(limit)
            .range(offset, offset + limit - 1)
            .order('type_name');

          if (error) {
            this.logger.error('Erreur recherche par CNIT:', error);
            throw error;
          }

          const enrichedData = await this.enrichmentService.enrichVehicles(data || []);

          return {
            data: enrichedData,
            total: count || 0,
            page,
            limit
          };
        } catch (error) {
          this.logger.error(`Erreur searchByCnit ${cnitCode}:`, error);
          throw error;
        }
      }
    );
  }

  /**
   * 🔍 Recherche multi-critères avec filtres
   */
  async searchWithFilters(
    filters: SearchCriteria & PaginationOptions
  ): Promise<VehicleResponse<any>> {
    const cacheKey = this.cacheService.generateSearchKey(filters);
    
    return await this.cacheService.getOrSet(
      CacheType.SEARCH,
      cacheKey,
      async () => {
        try {
          this.logger.debug('🔍 Recherche avec filtres:', filters);

          const { page = 0, limit = 50 } = filters;
          const offset = page * limit;

          let query = this.client
            .from('auto_type')
            .select(`
              *,
              auto_modele!inner(
                modele_id,
                modele_name,
                auto_marque!inner(
                  marque_id,
                  marque_name
                )
              )
            `)
            .eq('type_display', 1)
            .limit(limit)
            .range(offset, offset + limit - 1);

          // Application des filtres
          if (filters.marque) {
            query = query.eq('auto_modele.auto_marque.marque_name', filters.marque);
          }
          
          if (filters.modele) {
            query = query.eq('auto_modele.modele_name', filters.modele);
          }
          
          if (filters.type) {
            query = query.ilike('type_name', `%${filters.type}%`);
          }
          
          if (filters.engineCode) {
            query = query.ilike('type_engine_code', `%${filters.engineCode}%`);
          }

          if (filters.query) {
            query = query.or(
              `auto_modele.auto_marque.marque_name.ilike.%${filters.query}%,` +
              `auto_modele.modele_name.ilike.%${filters.query}%,` +
              `type_name.ilike.%${filters.query}%`
            );
          }

          const { data, error, count } = await query.order('auto_modele.auto_marque.marque_name, auto_modele.modele_name, type_name');

          if (error) {
            this.logger.error('Erreur recherche avec filtres:', error);
            throw error;
          }

          const enrichedData = await this.enrichmentService.enrichVehicles(data || []);

          return {
            data: enrichedData,
            total: count || 0,
            page,
            limit
          };
        } catch (error) {
          this.logger.error('Erreur searchWithFilters:', error);
          throw error;
        }
      }
    );
  }

  /**
   * 🔍 Suggestions de recherche (autocomplete)
   */
  async getSuggestions(
    query: string,
    type: 'marque' | 'modele' | 'type' = 'marque',
    limit: number = 10
  ): Promise<string[]> {
    if (!query?.trim()) return [];

    const cacheKey = `suggestions:${type}:${query}:${limit}`;
    
    return await this.cacheService.getOrSet(
      CacheType.SEARCH,
      cacheKey,
      async () => {
        try {
          let suggestions: string[] = [];

          switch (type) {
            case 'marque':
              const { data: marques } = await this.client
                .from('auto_marque')
                .select('marque_name')
                .eq('marque_display', 1)
                .ilike('marque_name', `%${query}%`)
                .limit(limit)
                .order('marque_name');
              
              suggestions = marques?.map(m => m.marque_name) || [];
              break;

            case 'modele':
              const { data: modeles } = await this.client
                .from('auto_modele')
                .select('modele_name')
                .eq('modele_display', 1)
                .ilike('modele_name', `%${query}%`)
                .limit(limit)
                .order('modele_name');
              
              suggestions = modeles?.map(m => m.modele_name) || [];
              break;

            case 'type':
              const { data: types } = await this.client
                .from('auto_type')
                .select('type_name')
                .eq('type_display', 1)
                .ilike('type_name', `%${query}%`)
                .limit(limit)
                .order('type_name');
              
              suggestions = types?.map(t => t.type_name) || [];
              break;
          }

          return suggestions;
        } catch (error) {
          this.logger.error(`Erreur suggestions ${type}:`, error);
          return [];
        }
      }
    );
  }
}