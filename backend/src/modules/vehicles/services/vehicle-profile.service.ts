/**
 * Vehicle Profile Service
 * @description Récupération des détails complets d'un véhicule
 * @extracted-from VehiclesService (~204 lignes)
 * @version 1.0.0
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { TABLES } from '@repo/database-types';
import { CACHE_STRATEGIES } from '../../../config/cache-ttl.config';
import {
  buildModelImageUrl,
  buildBrandLogoUrl,
} from '../../catalog/utils/image-urls.utils';
import { VehicleMotorCodesService } from './vehicle-motor-codes.service';

/**
 * Données complètes d'un véhicule
 */
export interface VehicleFullDetails {
  // Marque
  marque_id: number;
  marque_name: string;
  marque_name_meta: string | null;
  marque_name_meta_title: string | null;
  marque_alias: string;
  marque_logo: string | null;
  marque_relfollow: number | null;
  marque_top: number | null;

  // Modèle
  modele_id: number;
  modele_name: string;
  modele_name_meta: string | null;
  modele_alias: string;
  modele_pic: string | null;
  modele_ful_name: string | null;
  modele_body: string | null;
  modele_relfollow: number | null;

  // Type
  type_id: number;
  type_name: string;
  type_name_meta: string | null;
  type_alias: string;
  type_power_ps: number | null;
  type_power_kw: number | null;
  type_fuel: string | null;
  type_body: string | null;
  type_engine: string | null;
  type_liter: string | null;
  type_month_from: number | null;
  type_year_from: number | null;
  type_month_to: number | null;
  type_year_to: number | null;
  type_relfollow: number | null;

  // Codes moteur
  motor_codes: string[];
  motor_codes_formatted: string;

  // Types mines
  mine_codes: string[];
  mine_codes_formatted: string;
  cnit_codes: string[];
  cnit_codes_formatted: string;

  // Données formatées
  production_date_formatted: string;
  power_formatted: string;
  cylinder_cm3: number | null;

  // URLs
  vehicle_url: string;
  image_url: string;
  logo_url: string;
}

/**
 * Résultat de la récupération des détails
 */
export interface VehicleFullDetailsResult {
  success: boolean;
  data: VehicleFullDetails | null;
  error?: string;
}

@Injectable()
export class VehicleProfileService extends SupabaseBaseService {
  protected readonly logger = new Logger(VehicleProfileService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly motorCodesService: VehicleMotorCodesService,
  ) {
    super();
  }

  /**
   * Récupère TOUTES les données d'un véhicule (marque + modèle + type + codes moteur + types mines)
   * @param typeId - ID du type véhicule
   */
  async getVehicleFullDetails(
    typeId: number,
  ): Promise<VehicleFullDetailsResult> {
    const cacheKey = `vehicle_full_${typeId}`;

    // Vérifier le cache
    const cached =
      await this.cacheManager.get<VehicleFullDetailsResult>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    try {
      this.logger.debug(
        `Récupération détails complets véhicule type_id: ${typeId}`,
      );

      // 1. Récupérer le type avec modèle et marque
      const { data: typeData, error: typeError } = await this.client
        .from(TABLES.auto_type)
        .select(
          `
          type_id,
          type_name,
          type_name_meta,
          type_alias,
          type_power_ps,
          type_power_kw,
          type_fuel,
          type_body,
          type_engine,
          type_liter,
          type_month_from,
          type_year_from,
          type_month_to,
          type_year_to,
          type_relfollow,
          type_display,
          type_modele_id,
          type_marque_id
        `,
        )
        .eq('type_id', typeId)
        .eq('type_display', 1)
        .single();

      if (typeError || !typeData) {
        return {
          success: false,
          data: null,
          error: `Véhicule non trouvé: type_id=${typeId}`,
        };
      }

      // 2. Récupérer modèle, marque et codes en parallèle
      const [modeleResult, marqueResult, motorCodesResult, mineCodesResult] =
        await Promise.all([
          this.client
            .from(TABLES.auto_modele)
            .select(
              `
              modele_id,
              modele_name,
              modele_name_meta,
              modele_alias,
              modele_pic,
              modele_ful_name,
              modele_body,
              modele_relfollow,
              modele_year_from,
              modele_year_to
            `,
            )
            .eq('modele_id', typeData.type_modele_id)
            .single(),
          this.client
            .from(TABLES.auto_marque)
            .select(
              `
              marque_id,
              marque_name,
              marque_name_meta,
              marque_name_meta_title,
              marque_alias,
              marque_logo,
              marque_relfollow,
              marque_top
            `,
            )
            .eq('marque_id', typeData.type_marque_id)
            .single(),
          this.motorCodesService.getMotorCodesByTypeId(typeId),
          this.motorCodesService.getMineCodesByTypeId(typeId),
        ]);

      const modele = modeleResult.data;
      const marque = marqueResult.data;

      if (!modele || !marque) {
        return {
          success: false,
          data: null,
          error: 'Modèle ou marque non trouvé',
        };
      }

      // 3. Construire l'objet complet avec formatage

      // Formatage des dates de production
      let productionDateFormatted = '';
      if (typeData.type_year_from) {
        if (!typeData.type_year_to) {
          productionDateFormatted = typeData.type_month_from
            ? `depuis ${typeData.type_month_from}/${typeData.type_year_from}`
            : `depuis ${typeData.type_year_from}`;
        } else {
          productionDateFormatted = `de ${typeData.type_year_from} à ${typeData.type_year_to}`;
        }
      }

      // Formatage puissance
      const powerPs = parseInt(typeData.type_power_ps) || 0;
      const powerKw =
        parseInt(typeData.type_power_kw) || Math.round(powerPs * 0.7355);
      const powerFormatted = powerPs ? `${powerPs} ch / ${powerKw} kW` : '';

      // Cylindrée en cm³
      const cylinderCm3 = typeData.type_liter
        ? Math.round(parseFloat(typeData.type_liter) * 1000)
        : null;

      const fullData: VehicleFullDetails = {
        // Marque
        marque_id: marque.marque_id,
        marque_name: marque.marque_name,
        marque_name_meta: marque.marque_name_meta,
        marque_name_meta_title: marque.marque_name_meta_title,
        marque_alias: marque.marque_alias,
        marque_logo: marque.marque_logo,
        marque_relfollow: marque.marque_relfollow,
        marque_top: marque.marque_top,

        // Modèle
        modele_id: modele.modele_id,
        modele_name: modele.modele_name,
        modele_name_meta: modele.modele_name_meta,
        modele_alias: modele.modele_alias,
        modele_pic: modele.modele_pic,
        modele_ful_name: modele.modele_ful_name,
        modele_body: modele.modele_body,
        modele_relfollow: modele.modele_relfollow,

        // Type
        type_id: typeData.type_id,
        type_name: typeData.type_name,
        type_name_meta: typeData.type_name_meta,
        type_alias: typeData.type_alias,
        type_power_ps: typeData.type_power_ps,
        type_power_kw: typeData.type_power_kw,
        type_fuel: typeData.type_fuel,
        type_body: typeData.type_body,
        type_engine: typeData.type_engine,
        type_liter: typeData.type_liter,
        type_month_from: typeData.type_month_from,
        type_year_from: typeData.type_year_from,
        type_month_to: typeData.type_month_to,
        type_year_to: typeData.type_year_to,
        type_relfollow: typeData.type_relfollow,

        // Codes moteur
        motor_codes: motorCodesResult.data,
        motor_codes_formatted: motorCodesResult.formatted,

        // Types mines
        mine_codes: mineCodesResult.mines,
        mine_codes_formatted: mineCodesResult.mines_formatted,
        cnit_codes: mineCodesResult.cnits,
        cnit_codes_formatted: mineCodesResult.cnits_formatted,

        // Données formatées
        production_date_formatted: productionDateFormatted,
        power_formatted: powerFormatted,
        cylinder_cm3: cylinderCm3,

        // URLs via fonctions centralisées
        vehicle_url: `/constructeurs/${marque.marque_alias}-${marque.marque_id}/${modele.modele_alias}-${modele.modele_id}/${typeData.type_alias}-${typeData.type_id}.html`,
        image_url: buildModelImageUrl(marque.marque_alias, modele.modele_pic),
        logo_url: buildBrandLogoUrl(marque.marque_logo),
      };

      const result: VehicleFullDetailsResult = {
        success: true,
        data: fullData,
      };

      // Mettre en cache (TTL 1h)
      await this.cacheManager.set(
        cacheKey,
        result,
        CACHE_STRATEGIES.VEHICLES.TYPES.ttl * 1000,
      );

      this.logger.debug(
        `Détails complets: ${marque.marque_name} ${modele.modele_name} ${typeData.type_name}`,
      );

      return result;
    } catch (error) {
      this.logger.error('Exception getVehicleFullDetails:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }
}
