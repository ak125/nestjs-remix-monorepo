/**
 * Vehicle Motor Codes Service
 * @description Gestion des codes moteur et types mines pour les véhicules
 * @extracted-from VehiclesService (~250 lignes)
 * @version 1.0.0
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { TABLES } from '@repo/database-types';
import { CACHE_STRATEGIES } from '../../../config/cache-ttl.config';

/**
 * Résultat des codes moteur
 */
export interface MotorCodesResult {
  data: string[];
  formatted: string;
  count: number;
}

/**
 * Résultat des types mines et CNIT
 */
export interface MineCodesResult {
  mines: string[];
  mines_formatted: string;
  cnits: string[];
  cnits_formatted: string;
  count: number;
}

/**
 * Résultat de recherche par code moteur
 */
export interface MotorCodeSearchResult {
  data: Array<{
    type_id: number;
    type_name: string;
    type_alias: string;
    type_power_ps: number | null;
    type_power_kw: number | null;
    type_fuel: string | null;
    type_body: string | null;
    type_year_from: number | null;
    type_year_to: number | null;
    motor_codes: string[];
    auto_modele: {
      modele_id: number;
      modele_name: string;
      modele_alias: string;
    } | null;
    auto_marque: {
      marque_id: number;
      marque_name: string;
      marque_alias: string;
      marque_logo: string | null;
    } | null;
  }>;
  total: number;
  page: number;
  limit: number;
  meta: {
    motorCode: string;
    exact?: boolean;
    message?: string;
  };
}

@Injectable()
export class VehicleMotorCodesService extends SupabaseBaseService {
  protected readonly logger = new Logger(VehicleMotorCodesService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {
    super();
  }

  /**
   * Récupère tous les codes moteur pour un type de véhicule
   * @param typeId - ID du type véhicule
   */
  async getMotorCodesByTypeId(typeId: number): Promise<MotorCodesResult> {
    const cacheKey = `motor_codes_${typeId}`;

    // Vérifier le cache
    const cached = await this.cacheManager.get<MotorCodesResult>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    try {
      const { data, error } = await this.client
        .from(TABLES.auto_type_motor_code)
        .select('tmc_code')
        .eq('tmc_type_id', typeId);

      if (error) {
        this.logger.error(`Erreur getMotorCodesByTypeId(${typeId}):`, error);
        return { data: [], formatted: '', count: 0 };
      }

      const codes = (data || [])
        .map((item) => item.tmc_code)
        .filter(Boolean) as string[];

      const result: MotorCodesResult = {
        data: codes,
        formatted: codes.join(', '),
        count: codes.length,
      };

      // Mettre en cache (TTL 2h pour données quasi-statiques)
      await this.cacheManager.set(
        cacheKey,
        result,
        CACHE_STRATEGIES.VEHICLES.ENGINE_DATA.ttl * 1000,
      );

      this.logger.debug(
        `${codes.length} codes moteur trouvés pour type ${typeId}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Exception getMotorCodesByTypeId(${typeId}):`, error);
      return { data: [], formatted: '', count: 0 };
    }
  }

  /**
   * Récupère tous les types mines et CNIT pour un type de véhicule
   * @param typeId - ID du type véhicule
   */
  async getMineCodesByTypeId(typeId: number): Promise<MineCodesResult> {
    const cacheKey = `mine_codes_${typeId}`;

    // Vérifier le cache
    const cached = await this.cacheManager.get<MineCodesResult>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    try {
      const { data, error } = await this.client
        .from(TABLES.auto_type_number_code)
        .select('tnc_code, tnc_cnit')
        .eq('tnc_type_id', typeId);

      if (error) {
        this.logger.error(`Erreur getMineCodesByTypeId(${typeId}):`, error);
        return {
          mines: [],
          mines_formatted: '',
          cnits: [],
          cnits_formatted: '',
          count: 0,
        };
      }

      const mines = (data || [])
        .map((item) => item.tnc_code)
        .filter(Boolean) as string[];

      const cnits = (data || [])
        .map((item) => item.tnc_cnit)
        .filter(Boolean) as string[];

      const result: MineCodesResult = {
        mines,
        mines_formatted: mines.join(', '),
        cnits,
        cnits_formatted: cnits.join(', '),
        count: data?.length || 0,
      };

      // Mettre en cache
      await this.cacheManager.set(
        cacheKey,
        result,
        CACHE_STRATEGIES.VEHICLES.ENGINE_DATA.ttl * 1000,
      );

      this.logger.debug(
        `${mines.length} types mines, ${cnits.length} CNIT pour type ${typeId}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Exception getMineCodesByTypeId(${typeId}):`, error);
      return {
        mines: [],
        mines_formatted: '',
        cnits: [],
        cnits_formatted: '',
        count: 0,
      };
    }
  }

  /**
   * Recherche de véhicules par code moteur
   * @param motorCode - Code moteur à rechercher
   * @param exact - Recherche exacte ou partielle
   */
  async searchByMotorCode(
    motorCode: string,
    exact: boolean = false,
  ): Promise<MotorCodeSearchResult> {
    try {
      this.logger.debug(
        `Recherche par code moteur: ${motorCode} (exact: ${exact})`,
      );

      // 1. Trouver les type_ids correspondants au code moteur
      let query = this.client
        .from(TABLES.auto_type_motor_code)
        .select('tmc_type_id, tmc_code');

      if (exact) {
        query = query.eq('tmc_code', motorCode);
      } else {
        query = query.ilike('tmc_code', `%${motorCode}%`);
      }

      const { data: codeData, error: codeError } = await query.limit(50);

      if (codeError) {
        this.logger.error('Erreur searchByMotorCode (codes):', codeError);
        throw codeError;
      }

      if (!codeData || codeData.length === 0) {
        return {
          data: [],
          total: 0,
          page: 0,
          limit: 50,
          meta: { motorCode, message: 'Code moteur non trouvé' },
        };
      }

      // 2. Récupérer les type_ids uniques
      const typeIds = [
        ...new Set(codeData.map((item) => item.tmc_type_id)),
      ].filter(Boolean);

      if (typeIds.length === 0) {
        return {
          data: [],
          total: 0,
          page: 0,
          limit: 50,
          meta: { motorCode, message: 'Aucun véhicule associé' },
        };
      }

      // 3. Récupérer les détails des types avec marque et modèle
      const { data: typeData, error: typeError } = await this.client
        .from(TABLES.auto_type)
        .select(
          `
          type_id,
          type_name,
          type_alias,
          type_power_ps,
          type_power_kw,
          type_fuel,
          type_body,
          type_year_from,
          type_year_to,
          type_modele_id,
          type_marque_id
        `,
        )
        .in('type_id', typeIds)
        .eq('type_display', 1)
        .limit(50);

      if (typeError) {
        this.logger.error('Erreur searchByMotorCode (types):', typeError);
        throw typeError;
      }

      // 4. Enrichir avec modèle et marque
      const modeleIds = [
        ...new Set((typeData || []).map((t) => t.type_modele_id)),
      ].filter(Boolean);
      const marqueIds = [
        ...new Set((typeData || []).map((t) => t.type_marque_id)),
      ].filter(Boolean);

      const [modelesResult, marquesResult] = await Promise.all([
        this.client
          .from(TABLES.auto_modele)
          .select('modele_id, modele_name, modele_alias')
          .in('modele_id', modeleIds),
        this.client
          .from(TABLES.auto_marque)
          .select('marque_id, marque_name, marque_alias, marque_logo')
          .in('marque_id', marqueIds),
      ]);

      const modelesMap = new Map(
        (modelesResult.data || []).map((m) => [m.modele_id, m]),
      );
      const marquesMap = new Map(
        (marquesResult.data || []).map((m) => [m.marque_id, m]),
      );

      // 5. Combiner les données
      const enrichedData = (typeData || []).map((type) => {
        const modele = modelesMap.get(type.type_modele_id);
        const marque = marquesMap.get(type.type_marque_id);
        const matchingCodes = codeData.filter(
          (c) => c.tmc_type_id === type.type_id,
        );

        return {
          ...type,
          motor_codes: matchingCodes.map((c) => c.tmc_code),
          auto_modele: modele || null,
          auto_marque: marque || null,
        };
      });

      this.logger.debug(
        `${enrichedData.length} véhicules trouvés pour code moteur ${motorCode}`,
      );

      return {
        data: enrichedData,
        total: enrichedData.length,
        page: 0,
        limit: 50,
        meta: { motorCode, exact },
      };
    } catch (error) {
      this.logger.error('Exception searchByMotorCode:', error);
      throw error;
    }
  }
}
