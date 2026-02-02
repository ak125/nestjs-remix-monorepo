/**
 * Brand Bestsellers Service
 * @description Gère la récupération des véhicules et pièces bestsellers par marque
 * @extracted-from VehiclesService (310 lignes)
 * @version 1.0.0
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import { TABLES } from '@repo/database-types';
import {
  buildModelImageUrl,
  buildGammeImageUrl,
} from '../../catalog/utils/image-urls.utils';
import { CACHE_STRATEGIES } from '../../../config/cache-ttl.config';

/**
 * Interface pour le résultat des bestsellers
 */
export interface BrandBestsellersResult {
  success: boolean;
  data: {
    vehicles: BestsellerVehicle[];
    parts: BestsellerPart[];
  };
  meta?: {
    brand_id: number;
    brand_name: string;
    brand_alias: string;
    total_vehicles: number;
    total_parts: number;
    generated_at: string;
  };
  error?: string;
}

export interface BestsellerVehicle {
  cgc_type_id: number;
  marque_id: number;
  marque_name: string;
  marque_alias: string;
  modele_id: number;
  modele_name: string;
  modele_alias: string;
  modele_pic?: string;
  type_id: number;
  type_name: string;
  type_alias: string;
  type_power_ps?: number;
  type_year_from?: number;
  type_year_to?: number;
  vehicle_url: string;
  image_url: string;
  // SEO enrichments
  seo_title?: string;
  seo_description?: string;
  seo_subtitle?: string;
  seo_benefit?: string;
  seo_year_range?: string;
}

export interface BestsellerPart {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  marque_id: number;
  marque_name: string;
  marque_alias: string;
  modele_id: number;
  modele_name: string;
  modele_alias: string;
  cgc_type_id?: number;
  cgc_type_alias?: string;
  type_name?: string;
  type_power_ps?: number;
  part_url: string;
  image_url: string | null;
  // SEO enrichments
  seo_switch_content?: string;
  seo_switch_short?: string;
  seo_switch_benefit?: string;
  seo_switch_detail?: string;
  seo_switch_gamme?: string;
  seo_title?: string;
  seo_description_formatted?: string;
  seo_commercial?: string;
}

@Injectable()
export class BrandBestsellersService extends SupabaseBaseService {
  protected override readonly logger = new Logger(BrandBestsellersService.name);

  private readonly CACHE_TTL = CACHE_STRATEGIES.VEHICLES.BRANDS.ttl;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    rpcGate: RpcGateService,
  ) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * Récupère les véhicules et pièces bestsellers d'une marque
   * Optimisé avec RPC Supabase et cache Redis
   */
  async getBrandBestsellers(
    brandAlias: string,
    limitVehicles = 0,
    limitParts = 0,
  ): Promise<BrandBestsellersResult> {
    try {
      const cacheKey = `brand_bestsellers_${brandAlias}_${limitVehicles}_${limitParts}`;
      const cached =
        await this.cacheManager.get<BrandBestsellersResult>(cacheKey);

      if (cached) {
        this.logger.log(`✅ Cache hit: ${cacheKey}`);
        return cached;
      }

      this.logger.log(`🔍 Récupération bestsellers pour marque: ${brandAlias}`);

      // 1️⃣ Récupérer l'ID de la marque depuis l'alias
      const { data: brand, error: brandError } = await this.client
        .from(TABLES.auto_marque)
        .select('marque_id, marque_name, marque_alias')
        .eq('marque_alias', brandAlias)
        .single();

      if (brandError || !brand) {
        this.logger.warn(`⚠️ Marque non trouvée: ${brandAlias}`);
        return {
          success: false,
          data: { vehicles: [], parts: [] },
          error: `Marque "${brandAlias}" non trouvée`,
        };
      }

      // 2️⃣ Appeler la fonction RPC optimisée
      // 🛡️ Utilisation du wrapper callRpc avec RPC Safety Gate
      const { data: bestsellers, error: rpcError } = await this.callRpc<any>(
        'get_brand_bestsellers_optimized',
        {
          p_marque_id: brand.marque_id,
          p_limit_vehicles: limitVehicles,
          p_limit_parts: limitParts,
        },
        { source: 'api' },
      );

      if (rpcError) {
        this.logger.error(
          `❌ Erreur RPC get_brand_bestsellers_optimized: ${rpcError.message}`,
        );
        return {
          success: false,
          data: { vehicles: [], parts: [] },
          error: rpcError.message,
        };
      }

      // 3️⃣ Transformer et enrichir les données véhicules
      const vehicles = await this.enrichVehicles(
        bestsellers?.vehicles || [],
        brand.marque_id,
      );

      // 4️⃣ Transformer et enrichir les données pièces
      const parts = await this.enrichParts(bestsellers?.parts || []);

      const result: BrandBestsellersResult = {
        success: true,
        data: {
          vehicles,
          parts,
        },
        meta: {
          brand_id: brand.marque_id,
          brand_name: brand.marque_name,
          brand_alias: brand.marque_alias,
          total_vehicles: vehicles.length,
          total_parts: parts.length,
          generated_at: new Date().toISOString(),
        },
      };

      // 5️⃣ Mettre en cache
      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
      this.logger.log(
        `✅ Bestsellers récupérés: ${result.meta.total_vehicles} véhicules, ${result.meta.total_parts} pièces`,
      );

      return result;
    } catch (error) {
      this.logger.error('❌ Erreur getBrandBestsellers:', error.message);
      return {
        success: false,
        data: { vehicles: [], parts: [] },
        error: error.message,
      };
    }
  }

  /**
   * Enrichit les véhicules avec URLs et SEO
   */
  private async enrichVehicles(
    rawVehicles: any[],
    brandId: number,
  ): Promise<BestsellerVehicle[]> {
    if (rawVehicles.length === 0) return [];

    // Transformer les données de base (avec fallback marques-concepts)
    let vehicles = rawVehicles.map((vehicle: any) => ({
      ...vehicle,
      vehicle_url: `/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}/${vehicle.type_alias}-${vehicle.cgc_type_id}.html`,
      image_url: buildModelImageUrl(
        vehicle.marque_alias,
        vehicle.modele_pic,
        vehicle.modele_alias,
      ),
    }));

    // 🚗 ENRICHISSEMENT SEO VÉHICULES avec __seo_type_switch
    const { data: typeSwitches } = await this.client
      .from('__seo_type_switch')
      .select('sts_id, sts_alias, sts_content')
      .eq('sts_alias', '1');

    if (typeSwitches && typeSwitches.length > 0) {
      // 🎯 Mélanger les switches pour plus de variété (Fisher-Yates shuffle basé sur marque_id)
      const shuffledSwitches = [...typeSwitches];
      const seed = brandId || 1;
      for (let i = shuffledSwitches.length - 1; i > 0; i--) {
        const j = (seed * (i + 1) * 7) % (i + 1);
        [shuffledSwitches[i], shuffledSwitches[j]] = [
          shuffledSwitches[j],
          shuffledSwitches[i],
        ];
      }

      vehicles = vehicles.map((vehicle: any, index: number) => {
        const marque = vehicle.marque_name || '';
        const modele = vehicle.modele_name || '';
        const type = vehicle.type_name || '';
        const puissance = vehicle.type_power_ps || '';
        const yearFrom = vehicle.type_year_from || '';
        const yearTo = vehicle.type_year_to || '';
        const yearRange = yearTo
          ? `${yearFrom}-${yearTo}`
          : `depuis ${yearFrom}`;

        // 🔄 Sélection variée basée sur index + hash du type_id
        const typeIdNum =
          parseInt(vehicle.cgc_type_id) || parseInt(vehicle.type_id) || index;
        const hashBase =
          (typeIdNum * 31 + index * 17) % shuffledSwitches.length;
        const switchIdx = Math.abs(hashBase);
        const seoSwitch = shuffledSwitches[switchIdx]?.sts_content || '';

        // Construire les contenus SEO
        const seoTitle = `Pièces ${marque} ${modele} ${type} ${puissance} ch`;
        const seoDescription = `Trouvez vos pièces auto ${marque} ${modele} ${type} ${seoSwitch}. Moteur ${puissance} ch, ${yearRange}.`;
        const seoSubtitle = `${type} • ${puissance} ch • ${yearRange}`;
        const seoBenefit = seoSwitch;

        return {
          ...vehicle,
          seo_title: seoTitle,
          seo_description: seoDescription,
          seo_subtitle: seoSubtitle,
          seo_benefit: seoBenefit,
          seo_year_range: yearRange,
        };
      });

      this.logger.debug(
        `✅ ${vehicles.length} véhicules enrichis avec SEO type switches (${shuffledSwitches.length} switches disponibles)`,
      );
    }

    return vehicles;
  }

  /**
   * Enrichit les pièces avec URLs et SEO switches
   */
  private async enrichParts(rawParts: any[]): Promise<BestsellerPart[]> {
    if (rawParts.length === 0) return [];

    // Transformer les données de base
    let parts = rawParts.map((part: any) => ({
      ...part,
      part_url: `/pieces/${part.pg_alias}-${part.pg_id}/${part.marque_alias}-${part.marque_id}/${part.modele_alias}-${part.modele_id}/${part.cgc_type_alias || 'type'}-${part.cgc_type_id || 0}.html`,
      image_url: part.pg_alias
        ? buildGammeImageUrl(`${part.pg_alias}.webp`)
        : null,
    }));

    const pgIds = parts.map((p) => p.pg_id || p.cgc_pg_id);

    // Récupérer TOUS les switches courts (alias 1, 2, 3)
    const { data: itemSwitches } = await this.client
      .from(TABLES.seo_item_switch)
      .select('sis_pg_id, sis_alias, sis_content')
      .in('sis_pg_id', pgIds.map(String))
      .in('sis_alias', ['1', '2', '3']);

    // Récupérer les switches détaillés (alias 11, 12)
    const { data: familySwitches } = await this.client
      .from(TABLES.seo_family_gamme_car_switch)
      .select('sfgcs_pg_id, sfgcs_alias, sfgcs_content')
      .in('sfgcs_pg_id', pgIds.map(String))
      .in('sfgcs_alias', ['11', '12']);

    // Récupérer les switches gamme car (alias 1, 2, 3)
    const { data: gammeSwitches } = await this.client
      .from(TABLES.seo_gamme_car_switch)
      .select('sgcs_pg_id, sgcs_alias, sgcs_content')
      .in('sgcs_pg_id', pgIds.map(String))
      .in('sgcs_alias', ['1', '2', '3']);

    const totalSwitches =
      (itemSwitches?.length || 0) +
      (familySwitches?.length || 0) +
      (gammeSwitches?.length || 0);

    if (totalSwitches > 0) {
      this.logger.debug(
        `🔄 Switches SEO: ${itemSwitches?.length || 0} items + ${familySwitches?.length || 0} family + ${gammeSwitches?.length || 0} gamme`,
      );

      // Enrichir chaque pièce avec tous ses switches
      parts = parts.map((part) => {
        const partPgId = part.pg_id || part.cgc_pg_id;
        const partTypeId = parseInt(part.cgc_type_id) || 0;

        // === Switches courts alias 1 (verbes d'action) ===
        const itemList1 =
          itemSwitches?.filter(
            (s) => s.sis_pg_id === String(partPgId) && s.sis_alias === '1',
          ) || [];
        let shortDesc = '';
        if (itemList1.length > 0) {
          const idx = (partTypeId + 1) % itemList1.length;
          shortDesc = itemList1[idx]?.sis_content || '';
        }

        // === Switches alias 2 (fonctions/bénéfices) ===
        const itemList2 =
          itemSwitches?.filter(
            (s) => s.sis_pg_id === String(partPgId) && s.sis_alias === '2',
          ) || [];
        let benefitDesc = '';
        if (itemList2.length > 0) {
          const idx = (partTypeId + 2) % itemList2.length;
          benefitDesc = itemList2[idx]?.sis_content || '';
        }

        // === Switches gamme car (descriptions complètes) ===
        const gammeList =
          gammeSwitches?.filter((s) => s.sgcs_pg_id === String(partPgId)) || [];
        let gammeDesc = '';
        if (gammeList.length > 0) {
          const idx = (partTypeId + partPgId) % gammeList.length;
          gammeDesc = gammeList[idx]?.sgcs_content || '';
        }

        // === Switches détaillés alias 11 ===
        const familyList =
          familySwitches?.filter(
            (s) => s.sfgcs_pg_id === String(partPgId) && s.sfgcs_alias === '11',
          ) || [];
        let detailDesc = '';
        if (familyList.length > 0) {
          const idx = (partTypeId + partPgId + 2) % familyList.length;
          detailDesc = familyList[idx]?.sfgcs_content || '';
        }

        // Infos véhicule
        const marque = (part.marque_name || '').toUpperCase();
        const modele = part.modele_name || '';
        const type = part.type_name || '';
        const puissance = part.type_power_ps || '';
        const gamme = part.pg_name || '';

        // Titre enrichi
        const enrichedTitle = `${gamme} pour ${marque} ${modele} ${type}`;

        // Description enrichie (format prioritaire)
        let enrichedDesc = '';
        if (shortDesc && detailDesc) {
          enrichedDesc = `${shortDesc} les ${gamme} ${marque} ${modele} ${type} ${puissance} ch, ${detailDesc}`;
        } else if (shortDesc && benefitDesc) {
          enrichedDesc = `${shortDesc} les ${gamme} ${marque} ${modele} ${type} ${puissance} ch, ${benefitDesc}`;
        } else if (gammeDesc) {
          enrichedDesc = gammeDesc;
        } else if (shortDesc) {
          enrichedDesc = `${shortDesc} les ${gamme} ${marque} ${modele} ${type} ${puissance} ch`;
        } else {
          enrichedDesc = `${gamme} pour ${marque} ${modele} ${type} ${puissance} ch`;
        }

        // Sous-description commerciale
        let commercialDesc = '';
        if (benefitDesc) {
          commercialDesc = `${gamme} ${marque} ${modele} ${type} ${benefitDesc}`;
        } else {
          const priceTerms = [
            'prix bas',
            'mini coût',
            'bas coût',
            'meilleur prix',
            'tarif réduit',
          ];
          commercialDesc = `${gamme} ${marque} ${modele} ${type} ${priceTerms[(partPgId + partTypeId) % priceTerms.length]}.`;
        }

        return {
          ...part,
          // Contenus SEO principaux
          seo_switch_content: enrichedDesc,
          seo_switch_short: shortDesc,
          seo_switch_benefit: benefitDesc,
          seo_switch_detail: detailDesc,
          seo_switch_gamme: gammeDesc,
          // Contenus formatés
          seo_title: enrichedTitle,
          seo_description_formatted: enrichedDesc,
          seo_commercial: commercialDesc,
        };
      });

      this.logger.debug(
        `✅ ${parts.filter((p) => p.seo_switch_content).length} pièces enrichies avec multi-alias`,
      );
    } else {
      this.logger.warn(`⚠️ Aucun switch SEO trouvé`);
    }

    return parts;
  }
}
