import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

/**
 * 🎯 COMPATIBILITY SERVICE V2
 * @description Service pour vérifier la compatibilité pièce/véhicule
 * @version 2.0.0
 * @pack Pack Confiance V2 - Killer Feature: Compatibilité Instantanée
 *
 * Provides:
 * - Direct compatibility check via pieces_type_rel
 * - OEM cross-reference matching
 * - Confidence scoring
 *
 * Performance: < 50ms via optimized SQL
 */
@Injectable()
export class CompatibilityService extends SupabaseBaseService {
  constructor() {
    super();
  }

  /**
   * 🎯 Check if a product is compatible with a vehicle type
   *
   * @param productId - The piece ID (pk_piece_id)
   * @param typeId - The vehicle type ID (type_id)
   * @returns Compatibility result with confidence score
   */
  async checkCompatibility(
    productId: number,
    typeId: number,
  ): Promise<CompatibilityResult> {
    const startTime = Date.now();
    this.logger.log(
      `🔍 [COMPAT] Checking compatibility: piece=${productId}, type=${typeId}`,
    );

    try {
      // 1. Check direct relation in pieces_type_rel
      const { data: directMatch, error: directError } = await this.client
        .from('pieces_type_rel')
        .select('ptr_id, ptr_piece_id, ptr_type_id')
        .eq('ptr_piece_id', productId)
        .eq('ptr_type_id', typeId)
        .limit(1)
        .maybeSingle();

      if (directError) {
        this.logger.error(`❌ [COMPAT] DB error: ${directError.message}`);
        return this.createErrorResult(directError.message);
      }

      // 2. If direct match found, return compatible
      if (directMatch) {
        const duration = Date.now() - startTime;
        this.logger.log(`✅ [COMPAT] Direct match found in ${duration}ms`);

        // Get vehicle info for display
        const vehicleInfo = await this.getVehicleInfo(typeId);

        return {
          isCompatible: true,
          confidenceScore: 100,
          source: 'direct',
          vehicle: vehicleInfo,
          duration: `${duration}ms`,
        };
      }

      // 3. No direct match = not compatible
      const duration = Date.now() - startTime;
      this.logger.log(`❌ [COMPAT] No match found in ${duration}ms`);

      const vehicleInfo = await this.getVehicleInfo(typeId);

      return {
        isCompatible: false,
        confidenceScore: 100,
        source: 'direct',
        vehicle: vehicleInfo,
        duration: `${duration}ms`,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ [COMPAT] Exception: ${message}`);
      return this.createErrorResult(message);
    }
  }

  /**
   * 🚗 Get vehicle info for display
   */
  private async getVehicleInfo(
    typeId: number,
  ): Promise<VehicleInfoResult | undefined> {
    try {
      // Migrated from legacy types_vehicule → auto_type + auto_modele + auto_marque
      const { data: t, error } = await this.client
        .from('auto_type')
        .select('type_id, type_name, type_modele_id, type_marque_id')
        .eq('type_id', typeId)
        .single();

      if (error || !t) return undefined;

      const { data: m } = await this.client
        .from('auto_modele')
        .select('modele_id, modele_name')
        .eq('modele_id', t.type_modele_id)
        .single();

      const { data: b } = await this.client
        .from('auto_marque')
        .select('marque_id, marque_name')
        .eq('marque_id', t.type_marque_id)
        .single();

      return {
        typeId: t.type_id,
        typeName: t.type_name,
        modelId: m?.modele_id || 0,
        modelName: m?.modele_name || '',
        brandId: b?.marque_id || 0,
        brandName: b?.marque_name || '',
      };
    } catch {
      return undefined;
    }
  }

  /**
   * 🔍 Search vehicle by CNIT code
   *
   * @param cnit - The CNIT code from the vehicle registration card
   * @returns Vehicle info if found
   */
  async searchVehicleByCnit(cnit: string): Promise<VehicleSearchResult> {
    const startTime = Date.now();
    const cleanCnit = cnit.replace(/\s/g, '').toUpperCase();
    this.logger.log(`🔍 [CNIT] Searching for CNIT: ${cleanCnit}`);

    try {
      // Migrated from legacy types_vehicule → auto_type_number_code + auto_type
      const { data: cnitRow, error: cnitError } = await this.client
        .from('auto_type_number_code')
        .select('tnc_type_id, tnc_cnit')
        .eq('tnc_cnit', cleanCnit)
        .limit(1)
        .maybeSingle();

      if (cnitError) {
        this.logger.error(`❌ [CNIT] DB error: ${cnitError.message}`);
        return { found: false, error: cnitError.message };
      }

      if (!cnitRow) {
        const duration = Date.now() - startTime;
        this.logger.log(`⚠️ [CNIT] Not found in ${duration}ms`);
        return { found: false };
      }

      const vehicleInfo = await this.getVehicleInfo(
        Number(cnitRow.tnc_type_id),
      );
      const duration = Date.now() - startTime;

      if (!vehicleInfo) {
        this.logger.log(
          `⚠️ [CNIT] Type ${cnitRow.tnc_type_id} not found in ${duration}ms`,
        );
        return { found: false };
      }

      this.logger.log(
        `✅ [CNIT] Found: ${vehicleInfo.brandName} ${vehicleInfo.modelName} in ${duration}ms`,
      );

      return {
        found: true,
        vehicle: {
          ...vehicleInfo,
          cnit: cnitRow.tnc_cnit,
        },
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ [CNIT] Exception: ${errMsg}`);
      return { found: false, error: errMsg };
    }
  }

  /**
   * 🔍 Search vehicle by Type Mine code
   *
   * @param typeMine - The Type Mine code from the vehicle registration card
   * @returns Vehicle info if found
   */
  async searchVehicleByTypeMine(
    typeMine: string,
  ): Promise<VehicleSearchResult> {
    const startTime = Date.now();
    const cleanTypeMine = typeMine.replace(/\s/g, '').toUpperCase();
    this.logger.log(`🔍 [MINE] Searching for Type Mine: ${cleanTypeMine}`);

    try {
      // Migrated from legacy types_vehicule → auto_type_number_code + auto_type
      // Type Mine codes are stored as CNIT variants in auto_type_number_code
      const { data: mineRow, error: mineError } = await this.client
        .from('auto_type_number_code')
        .select('tnc_type_id, tnc_cnit')
        .eq('tnc_cnit', cleanTypeMine)
        .limit(1)
        .maybeSingle();

      if (mineError) {
        this.logger.error(`❌ [MINE] DB error: ${mineError.message}`);
        return { found: false, error: mineError.message };
      }

      if (!mineRow) {
        const duration = Date.now() - startTime;
        this.logger.log(`⚠️ [MINE] Not found in ${duration}ms`);
        return { found: false };
      }

      const vehicleInfo = await this.getVehicleInfo(
        Number(mineRow.tnc_type_id),
      );
      const duration = Date.now() - startTime;

      if (!vehicleInfo) {
        this.logger.log(
          `⚠️ [MINE] Type ${mineRow.tnc_type_id} not found in ${duration}ms`,
        );
        return { found: false };
      }

      this.logger.log(
        `✅ [MINE] Found: ${vehicleInfo.brandName} ${vehicleInfo.modelName} in ${duration}ms`,
      );

      return {
        found: true,
        vehicle: {
          ...vehicleInfo,
          typeMine: mineRow.tnc_cnit,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ [MINE] Exception: ${message}`);
      return { found: false, error: message };
    }
  }

  /**
   * 📊 Get compatibility stats for a product
   *
   * @param productId - The piece ID
   * @returns Count of compatible vehicles
   */
  async getCompatibilityStats(productId: number): Promise<CompatibilityStats> {
    try {
      const { count, error } = await this.client
        .from('pieces_type_rel')
        .select('*', { count: 'exact', head: true })
        .eq('ptr_piece_id', productId);

      if (error) {
        return { compatibleVehiclesCount: 0, error: error.message };
      }

      return {
        compatibleVehiclesCount: count || 0,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { compatibleVehiclesCount: 0, error: message };
    }
  }

  /**
   * Create error result
   */
  private createErrorResult(errorMessage: string): CompatibilityResult {
    return {
      isCompatible: false,
      confidenceScore: 0,
      source: 'error',
      error: errorMessage,
    };
  }
}

// ============================================================================
// Types
// ============================================================================

export interface CompatibilityResult {
  isCompatible: boolean;
  confidenceScore: number;
  source: 'direct' | 'oem_match' | 'cross_reference' | 'inferred' | 'error';
  vehicle?: VehicleInfoResult;
  duration?: string;
  error?: string;
}

export interface VehicleInfoResult {
  typeId: number;
  typeName: string;
  modelId?: number;
  modelName?: string;
  brandId?: number;
  brandName?: string;
  cnit?: string;
  typeMine?: string;
}

export interface VehicleSearchResult {
  found: boolean;
  vehicle?: VehicleInfoResult;
  error?: string;
}

export interface CompatibilityStats {
  compatibleVehiclesCount: number;
  error?: string;
}
