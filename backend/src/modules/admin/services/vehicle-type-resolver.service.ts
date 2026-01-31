import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { TABLES } from '@repo/database-types';
import {
  EnrichedVehicleType,
  ResolveVehicleTypesResponse,
} from '../dto/vehicle-resolve.dto';

/**
 * Service de résolution batch des type_ids en informations véhicule enrichies
 *
 * Responsabilités:
 * - Résoudre un batch de type_ids vers les informations auto_type enrichies
 * - Inclure make, model, generation, engine, power, years, fuel
 * - Mettre en cache les résultats pour éviter les appels répétés
 */
@Injectable()
export class VehicleTypeResolverService extends SupabaseBaseService {
  protected readonly logger = new Logger(VehicleTypeResolverService.name);

  private readonly CACHE_TTL = 3600; // 1 heure
  private readonly CACHE_PREFIX = 'vehicle:types:batch:';

  constructor(@Optional() @Inject(CACHE_MANAGER) private cacheManager?: Cache) {
    super();
    this.logger.log('VehicleTypeResolverService initialized');
  }

  /**
   * Résoudre un batch de type_ids en informations véhicule enrichies
   */
  async resolveTypeIds(
    typeIds: number[],
  ): Promise<ResolveVehicleTypesResponse> {
    // 1. Dédupliquer et filtrer les IDs valides
    const uniqueIds = [...new Set(typeIds)].filter(
      (id) => id != null && id > 0 && !isNaN(id),
    );

    if (uniqueIds.length === 0) {
      this.logger.debug('No valid type_ids to resolve');
      return {};
    }

    this.logger.debug(`Resolving ${uniqueIds.length} type_ids`);

    // 2. Vérifier le cache pour chaque ID
    const result: ResolveVehicleTypesResponse = {};
    const uncachedIds: number[] = [];

    if (this.cacheManager) {
      for (const id of uniqueIds) {
        const cacheKey = `${this.CACHE_PREFIX}${id}`;
        const cached =
          await this.cacheManager.get<EnrichedVehicleType>(cacheKey);
        if (cached) {
          result[id] = cached;
        } else {
          uncachedIds.push(id);
        }
      }

      if (uncachedIds.length === 0) {
        this.logger.debug(
          `All ${uniqueIds.length} type_ids resolved from cache`,
        );
        return result;
      }

      this.logger.debug(
        `${uniqueIds.length - uncachedIds.length} from cache, ${uncachedIds.length} to fetch`,
      );
    } else {
      uncachedIds.push(...uniqueIds);
    }

    // 3. Fetch les IDs non-cachés depuis Supabase
    try {
      const freshResults = await this.fetchTypesFromSupabase(uncachedIds);

      // 4. Mettre en cache les nouveaux résultats
      if (this.cacheManager) {
        for (const [typeId, enriched] of Object.entries(freshResults)) {
          const cacheKey = `${this.CACHE_PREFIX}${typeId}`;
          await this.cacheManager.set(
            cacheKey,
            enriched,
            this.CACHE_TTL * 1000,
          );
        }
      }

      // 5. Combiner cache + nouveaux résultats
      return { ...result, ...freshResults };
    } catch (error) {
      this.logger.error(`Failed to resolve type_ids: ${error.message}`);
      return result; // Retourner au moins les résultats cachés
    }
  }

  /**
   * Fetch les informations véhicule depuis Supabase avec joins
   */
  private async fetchTypesFromSupabase(
    typeIds: number[],
  ): Promise<ResolveVehicleTypesResponse> {
    if (typeIds.length === 0) return {};

    const result: ResolveVehicleTypesResponse = {};

    // Query avec joins pour récupérer toutes les infos en une seule requête
    const { data, error } = await this.executeWithRetry(
      async () =>
        this.supabase
          .from(TABLES.auto_type)
          .select(
            `
            type_id,
            type_name,
            type_engine,
            type_power_ps,
            type_year_from,
            type_year_to,
            type_fuel,
            type_liter,
            type_body,
            auto_modele!inner (
              modele_id,
              modele_name,
              modele_ful_name,
              auto_marque!inner (
                marque_id,
                marque_name
              )
            )
          `,
          )
          .in('type_id', typeIds)
          .eq('type_display', '1'),
      'resolveTypeIds',
    );

    if (error) {
      this.logger.error(`Supabase query error: ${error.message}`);
      throw error;
    }

    if (!data || data.length === 0) {
      this.logger.debug(`No types found for IDs: ${typeIds.join(', ')}`);
      return {};
    }

    // Transformer les résultats
    for (const row of data) {
      const typeId = Number(row.type_id);
      const modele = row.auto_modele as any;
      const marque = modele?.auto_marque as any;

      result[typeId] = {
        type_id: typeId,
        make: marque?.marque_name || 'N/A',
        model: modele?.modele_name || 'N/A',
        generation: modele?.modele_ful_name || modele?.modele_name || 'N/A',
        engine: this.extractEngine(row.type_engine, row.type_name),
        power_hp: row.type_power_ps ? Number(row.type_power_ps) : null,
        year_from: row.type_year_from || null,
        year_to: row.type_year_to || null,
        fuel: this.normalizeFuel(row.type_fuel),
        type_name: row.type_name || 'N/A',
        type_liter: row.type_liter || null,
        type_body: row.type_body || null,
      };
    }

    this.logger.debug(
      `Resolved ${Object.keys(result).length}/${typeIds.length} type_ids from Supabase`,
    );

    return result;
  }

  /**
   * Extraire le moteur depuis type_engine ou type_name
   */
  private extractEngine(
    typeEngine: string | null,
    typeName: string | null,
  ): string {
    if (typeEngine && typeEngine.trim()) {
      return typeEngine.trim();
    }

    if (typeName) {
      // Extraire le moteur depuis type_name (ex: "1.5 DCI 90" -> "1.5 DCI")
      const match = typeName.match(/^(\d+\.\d+\s*[A-Za-z]*)/);
      if (match) {
        return match[1].trim();
      }
      return typeName;
    }

    return 'N/A';
  }

  /**
   * Normaliser le type de carburant en français
   */
  private normalizeFuel(fuel: string | null): string {
    if (!fuel) return 'N/A';

    const fuelLower = fuel.toLowerCase();

    if (fuelLower.includes('diesel')) return 'Diesel';
    if (
      fuelLower.includes('essence') ||
      fuelLower.includes('gasoline') ||
      fuelLower.includes('petrol')
    )
      return 'Essence';
    if (fuelLower.includes('hybrid')) return 'Hybride';
    if (fuelLower.includes('electr')) return 'Électrique';
    if (fuelLower.includes('gpl') || fuelLower.includes('lpg')) return 'GPL';
    if (fuelLower.includes('gnv') || fuelLower.includes('cng')) return 'GNV';

    return fuel;
  }
}
