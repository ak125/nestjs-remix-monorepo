import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import { VehicleCacheService, CacheType } from '../core/vehicle-cache.service';
import { VehicleEnrichmentService } from '../core/vehicle-enrichment.service';
import { PaginationOptions, VehicleResponse } from '../../types/vehicle.types';

/**
 * ⛏️ VEHICLE MINE SERVICE - Service dédié aux recherches par codes Mine
 *
 * Responsabilités :
 * - Recherche par code mine exact
 * - Recherche par type mine
 * - Obtention des codes mine par modèle
 * - Gestion des variantes mine
 * - Cache spécialisé pour les codes mine
 */

export interface MineSearchOptions extends PaginationOptions {
  exactMatch?: boolean;
  includeVariants?: boolean;
  sortBy?: 'code' | 'name' | 'date';
}

export interface MineInfo {
  mine_code: string;
  type_id: string;
  type_name: string;
  modele_name: string;
  marque_name: string;
  variants?: number;
}

@Injectable()
export class VehicleMineService extends SupabaseBaseService {
  protected readonly logger = new Logger(VehicleMineService.name);

  constructor(
    private cacheService: VehicleCacheService,
    private enrichmentService: VehicleEnrichmentService,
  ) {
    super();
    this.logger.log('⛏️ VehicleMineService initialisé');
  }

  /**
   * ⛏️ Recherche par code mine exact
   */
  async searchByMineCode(
    mineCode: string,
    options: MineSearchOptions = {},
  ): Promise<VehicleResponse<any>> {
    if (!mineCode?.trim()) {
      return {
        success: true,
        data: [],
        total: 0,
        page: 0,
        limit: options.limit || 50,
      };
    }

    const cacheKey = `mine_code:${mineCode}:${JSON.stringify(options)}`;

    return await this.cacheService.getOrSet(
      CacheType.MINE,
      cacheKey,
      async () => {
        try {
          this.logger.debug(`⛏️ Recherche par code mine: ${mineCode}`);

          const { page = 0, limit = 50, exactMatch = false } = options;
          const offset = page * limit;

          let query = this.client
            .from(TABLES.auto_type)
            .select(
              `
              *,
              auto_modele!inner(
                modele_id,
                modele_name,
                auto_marque!inner(
                  marque_id,
                  marque_name
                )
              )
            `,
            )
            .eq('type_display', 1)
            .limit(limit)
            .range(offset, offset + limit - 1);

          if (exactMatch) {
            query = query.eq('type_mine_code', mineCode);
          } else {
            query = query.ilike('type_mine_code', `%${mineCode}%`);
          }

          const { data, error, count } = await query.order('type_mine_code');

          if (error) {
            this.logger.error('Erreur recherche par code mine:', error);
            throw error;
          }

          const enrichedData = await this.enrichmentService.enrichVehicles(
            data || [],
          );

          return {
            success: true,
            data: enrichedData,
            total: count || 0,
            page,
            limit,
          };
        } catch (error) {
          this.logger.error(`Erreur searchByMineCode ${mineCode}:`, error);
          throw error;
        }
      },
    );
  }

  /**
   * ⛏️ Recherche par type mine avec patterns
   */
  async searchByMineType(
    minePattern: string,
    options: MineSearchOptions = {},
  ): Promise<VehicleResponse<any>> {
    if (!minePattern?.trim()) {
      return {
        success: true,
        data: [],
        total: 0,
        page: 0,
        limit: options.limit || 50,
      };
    }

    const cacheKey = `mine_type:${minePattern}:${JSON.stringify(options)}`;

    return await this.cacheService.getOrSet(
      CacheType.MINE,
      cacheKey,
      async () => {
        try {
          this.logger.debug(`⛏️ Recherche par type mine: ${minePattern}`);

          const { page = 0, limit = 50, sortBy = 'code' } = options;
          const offset = page * limit;

          const { data, error, count } = await this.client
            .from(TABLES.auto_type)
            .select(
              `
              *,
              auto_modele!inner(
                modele_id,
                modele_name,
                auto_marque!inner(
                  marque_id,
                  marque_name
                )
              )
            `,
            )
            .eq('type_display', 1)
            .or(
              `type_mine_code.ilike.%${minePattern}%,` +
                `type_name.ilike.%${minePattern}%`,
            )
            .limit(limit)
            .range(offset, offset + limit - 1)
            .order(this.getSortColumn(sortBy));

          if (error) {
            this.logger.error('Erreur recherche par type mine:', error);
            throw error;
          }

          const enrichedData = await this.enrichmentService.enrichVehicles(
            data || [],
          );

          return {
            success: true,
            data: enrichedData,
            total: count || 0,
            page,
            limit,
          };
        } catch (error) {
          this.logger.error(`Erreur searchByMineType ${minePattern}:`, error);
          throw error;
        }
      },
    );
  }

  /**
   * ⛏️ Obtenir tous les codes mine d'un modèle
   */
  async getMinesByModel(
    modeleId: number,
    options: PaginationOptions = {},
  ): Promise<VehicleResponse<any>> {
    const cacheKey = `mines_by_model:${modeleId}:${JSON.stringify(options)}`;

    return await this.cacheService.getOrSet(
      CacheType.MINE,
      cacheKey,
      async () => {
        try {
          this.logger.debug(
            `⛏️ Récupération des codes mine pour modèle: ${modeleId}`,
          );

          const { page = 0, limit = 50 } = options;
          const offset = page * limit;

          const { data, error, count } = await this.client
            .from(TABLES.auto_type)
            .select(
              `
              type_id,
              type_name,
              type_mine_code,
              type_cnit_code,
              type_engine_code,
              auto_modele!inner(
                modele_id,
                modele_name,
                auto_marque!inner(
                  marque_id,
                  marque_name
                )
              )
            `,
            )
            .eq('auto_modele.modele_id', modeleId)
            .eq('type_display', 1)
            .not('type_mine_code', 'is', null)
            .limit(limit)
            .range(offset, offset + limit - 1)
            .order('type_mine_code');

          if (error) {
            this.logger.error('Erreur getMinesByModel:', error);
            throw error;
          }

          const enrichedData = await this.enrichmentService.enrichVehicles(
            data || [],
          );

          return {
            success: true,
            data: enrichedData,
            total: count || 0,
            page,
            limit,
          };
        } catch (error) {
          this.logger.error(`Erreur getMinesByModel ${modeleId}:`, error);
          throw error;
        }
      },
    );
  }

  /**
   * ⛏️ Obtenir les informations d'un code mine spécifique
   */
  async getMineInfo(mineCode: string): Promise<MineInfo | null> {
    if (!mineCode?.trim()) return null;

    const cacheKey = `mine_info:${mineCode}`;

    return await this.cacheService.getOrSet(
      CacheType.MINE,
      cacheKey,
      async () => {
        try {
          const { data, error } = await this.client
            .from(TABLES.auto_type)
            .select(
              `
              type_mine_code,
              type_id,
              type_name,
              auto_modele!inner(
                modele_name,
                auto_marque!inner(
                  marque_name
                )
              )
            `,
            )
            .eq('type_mine_code', mineCode)
            .eq('type_display', 1)
            .single();

          if (error || !data) {
            this.logger.debug(`Code mine non trouvé: ${mineCode}`);
            return null;
          }

          return {
            mine_code: data.type_mine_code,
            type_id: data.type_id,
            type_name: data.type_name,
            modele_name: (data.auto_modele as any)?.modele_name || 'Unknown',
            marque_name:
              (data.auto_modele as any)?.auto_marque?.marque_name || 'Unknown',
          };
        } catch (error) {
          this.logger.error(`Erreur getMineInfo ${mineCode}:`, error);
          return null;
        }
      },
    );
  }

  /**
   * ⛏️ Obtenir les variantes d'un code mine
   */
  async getMineVariants(
    baseMineCode: string,
    options: PaginationOptions = {},
  ): Promise<VehicleResponse<any>> {
    const cacheKey = `mine_variants:${baseMineCode}:${JSON.stringify(options)}`;

    return await this.cacheService.getOrSet(
      CacheType.MINE,
      cacheKey,
      async () => {
        try {
          this.logger.debug(`⛏️ Recherche des variantes pour: ${baseMineCode}`);

          const { page = 0, limit = 20 } = options;
          const offset = page * limit;

          // Recherche des codes mine similaires (avec préfixe commun)
          const { data, error, count } = await this.client
            .from(TABLES.auto_type)
            .select(
              `
              *,
              auto_modele!inner(
                modele_id,
                modele_name,
                auto_marque!inner(
                  marque_id,
                  marque_name
                )
              )
            `,
            )
            .eq('type_display', 1)
            .ilike('type_mine_code', `${baseMineCode}%`)
            .neq('type_mine_code', baseMineCode) // Exclure le code exact
            .limit(limit)
            .range(offset, offset + limit - 1)
            .order('type_mine_code');

          if (error) {
            this.logger.error('Erreur getMineVariants:', error);
            throw error;
          }

          const enrichedData = await this.enrichmentService.enrichVehicles(
            data || [],
          );

          return {
            success: true,
            data: enrichedData,
            total: count || 0,
            page,
            limit,
          };
        } catch (error) {
          this.logger.error(`Erreur getMineVariants ${baseMineCode}:`, error);
          throw error;
        }
      },
    );
  }

  /**
   * ⛏️ Statistiques des codes mine
   */
  async getMineStats(): Promise<{
    totalMines: number;
    byMarque: Record<string, number>;
    withEngine: number;
    withoutEngine: number;
  }> {
    const cacheKey = 'mine_stats:global';

    return await this.cacheService.getOrSet(
      CacheType.MINE,
      cacheKey,
      async () => {
        try {
          // Total des codes mine
          const { count: totalMines } = await this.client
            .from(TABLES.auto_type)
            .select('type_id', { count: 'exact' })
            .eq('type_display', 1)
            .not('type_mine_code', 'is', null);

          // Par marque
          const { data: byMarqueData } = await this.client
            .from(TABLES.auto_type)
            .select(
              `
              auto_modele!inner(
                auto_marque!inner(marque_name)
              )
            `,
            )
            .eq('type_display', 1)
            .not('type_mine_code', 'is', null);

          const byMarque: Record<string, number> = {};
          byMarqueData?.forEach((item) => {
            const marque =
              (item.auto_modele as any)?.auto_marque?.marque_name || 'Unknown';
            byMarque[marque] = (byMarque[marque] || 0) + 1;
          });

          // Avec/sans moteur
          const { count: withEngine } = await this.client
            .from(TABLES.auto_type)
            .select('type_id', { count: 'exact' })
            .eq('type_display', 1)
            .not('type_mine_code', 'is', null)
            .not('type_engine_code', 'is', null);

          return {
            totalMines: totalMines || 0,
            byMarque,
            withEngine: withEngine || 0,
            withoutEngine: (totalMines || 0) - (withEngine || 0),
          };
        } catch (error) {
          this.logger.error('Erreur getMineStats:', error);
          return {
            totalMines: 0,
            byMarque: {},
            withEngine: 0,
            withoutEngine: 0,
          };
        }
      },
    );
  }

  /**
   * 🔧 Utilitaire pour le tri
   */
  private getSortColumn(sortBy: string): string {
    switch (sortBy) {
      case 'code':
        return 'type_mine_code';
      case 'name':
        return 'type_name';
      case 'date':
        return 'created_at';
      default:
        return 'type_mine_code';
    }
  }

  /**
   * ⛏️ Validation d'un code mine
   */
  async validateMineCode(mineCode: string): Promise<{
    isValid: boolean;
    exists: boolean;
    suggestions?: string[];
  }> {
    if (!mineCode?.trim()) {
      return { isValid: false, exists: false };
    }

    try {
      // Vérifier l'existence
      const mineInfo = await this.getMineInfo(mineCode);
      const exists = mineInfo !== null;

      // Format basique de validation (peut être amélioré)
      const isValid = /^[A-Z0-9]{3,10}$/.test(mineCode.toUpperCase());

      // Suggestions si pas trouvé
      let suggestions: string[] = [];
      if (!exists && mineCode.length >= 3) {
        const { data } = await this.searchByMineType(mineCode, { limit: 5 });
        suggestions = data
          .map((item) => item.type_mine_code)
          .filter((code, index, arr) => arr.indexOf(code) === index)
          .slice(0, 5);
      }

      return {
        isValid,
        exists,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      };
    } catch (error) {
      this.logger.error(`Erreur validateMineCode ${mineCode}:`, error);
      return { isValid: false, exists: false };
    }
  }
}
