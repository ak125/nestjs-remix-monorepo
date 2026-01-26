/**
 * MCP Query Service - Phase 2: Real MCP Tool Implementations
 *
 * Implements the actual MCP tool calls that verify data against
 * the source of truth (Supabase tables).
 *
 * Principle: L'IA NE CREE PAS LA VERITE (AI-COS Axiome Zero)
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import {
  McpVerifyContext,
  McpQueryRegistry,
  VerifyCompatibilityInput,
  VerifyCompatibilityOutput,
  GetStockPriceInput,
  GetStockPriceOutput,
  VerifyVehicleInput,
  VerifyVehicleOutput,
  DiagnoseInput,
  DiagnoseOutput,
  ResolvePageRoleInput,
  ResolvePageRoleOutput,
  VerifyReferenceInput,
  VerifyReferenceOutput,
  CheckSafetyGateInput,
  CheckSafetyGateOutput,
} from '../types/mcp-verify.types';

@Injectable()
export class McpQueryService implements OnModuleInit {
  private readonly logger = new Logger(McpQueryService.name);
  private supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn('Supabase credentials not configured - MCP queries will return null');
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger.log('MCP Query Service initialized with Supabase connection');
  }

  /**
   * Get the registry of all MCP query functions
   */
  getQueryRegistry(): McpQueryRegistry {
    return {
      verifyPartCompatibility: this.verifyPartCompatibility.bind(this),
      getVerifiedStockAndPrice: this.getVerifiedStockAndPrice.bind(this),
      verifyVehicleIdentity: this.verifyVehicleIdentity.bind(this),
      diagnose: this.diagnose.bind(this),
      resolvePageRole: this.resolvePageRole.bind(this),
      verifyReference: this.verifyReference.bind(this),
      checkSafetyGate: this.checkSafetyGate.bind(this),
    };
  }

  /**
   * Get a specific query function by tool name
   */
  getQueryFunction<K extends keyof McpQueryRegistry>(
    toolName: K,
  ): McpQueryRegistry[K] | null {
    const registry = this.getQueryRegistry();
    return registry[toolName] || null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPATIBILITY VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Verify part-vehicle compatibility via TecDoc linkages
   */
  async verifyPartCompatibility(
    input: VerifyCompatibilityInput,
    context: McpVerifyContext,
  ): Promise<VerifyCompatibilityOutput | null> {
    if (!this.supabase) return null;

    try {
      const { pieceId, pieceRef, ktypnr, vin } = input;

      // Resolve ktypnr from VIN if needed
      let resolvedKtypnr = ktypnr;
      if (!resolvedKtypnr && vin) {
        const vehicle = await this.resolveVehicleFromVin(vin);
        resolvedKtypnr = vehicle?.ktypnr;
      }

      if (!resolvedKtypnr) {
        return {
          compatible: null,
          confidence: 0,
          source: 'manual',
          verifiedAt: new Date().toISOString(),
          warnings: ['Vehicle ktypnr could not be resolved'],
        };
      }

      // Get piece ID from reference if needed
      let resolvedPieceId = pieceId;
      if (!resolvedPieceId && pieceRef) {
        const piece = await this.resolvePieceFromRef(pieceRef);
        resolvedPieceId = piece?.id;
      }

      if (!resolvedPieceId) {
        return {
          compatible: null,
          confidence: 0,
          source: 'manual',
          verifiedAt: new Date().toISOString(),
          warnings: ['Piece could not be resolved'],
        };
      }

      // Check TecDoc linkage via RPC
      const { data, error } = await this.supabase.rpc(
        'check_piece_vehicle_compatibility',
        {
          p_piece_id: resolvedPieceId,
          p_ktypnr: resolvedKtypnr,
        },
      );

      if (error) {
        this.logger.warn(
          `Compatibility check RPC failed: ${error.message}`,
          { pieceId: resolvedPieceId, ktypnr: resolvedKtypnr },
        );
        // Fallback to direct table query
        return this.fallbackCompatibilityCheck(resolvedPieceId, resolvedKtypnr);
      }

      return {
        compatible: data?.compatible ?? null,
        linkageId: data?.linkage_id,
        confidence: data?.compatible ? 0.95 : 0.80,
        source: 'tecdoc',
        verifiedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('verifyPartCompatibility failed', error);
      return null;
    }
  }

  private async fallbackCompatibilityCheck(
    pieceId: number,
    ktypnr: number,
  ): Promise<VerifyCompatibilityOutput | null> {
    try {
      // Direct query to pieces_linkage table
      const { data } = await this.supabase
        .from('pieces_linkage')
        .select('pl_id, pl_compatible')
        .eq('pl_piece_id', pieceId)
        .eq('pl_ktypnr', ktypnr)
        .single();

      if (data) {
        return {
          compatible: data.pl_compatible,
          linkageId: String(data.pl_id),
          confidence: 0.85,
          source: 'manual',
          verifiedAt: new Date().toISOString(),
        };
      }

      return {
        compatible: null,
        confidence: 0,
        source: 'manual',
        verifiedAt: new Date().toISOString(),
        warnings: ['No linkage found in database'],
      };
    } catch {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK & PRICE VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get verified stock and price from pieces_price table
   */
  async getVerifiedStockAndPrice(
    input: GetStockPriceInput,
    context: McpVerifyContext,
  ): Promise<GetStockPriceOutput | null> {
    if (!this.supabase) return null;

    try {
      const { pieceId, quantity = 1, context: priceContext = 'browsing' } = input;

      // Query pieces_price table
      const { data, error } = await this.supabase
        .from('pieces_price')
        .select(`
          pri_id,
          pri_qte_cond,
          pri_vente_ht,
          pri_vente_ttc,
          pri_consigne_ht,
          pri_consigne_ttc,
          pri_updated_at
        `)
        .eq('pri_piece_id', pieceId)
        .eq('pri_active', true)
        .single();

      if (error || !data) {
        this.logger.warn(
          `Price lookup failed for piece ${pieceId}: ${error?.message || 'not found'}`,
        );
        return null;
      }

      const available = (data.pri_qte_cond || 0) >= quantity;

      // Price validity depends on context
      const validityMs =
        priceContext === 'checkout'
          ? 0 // No cache in checkout
          : priceContext === 'cart'
          ? 5 * 60 * 1000 // 5 minutes in cart
          : 30 * 60 * 1000; // 30 minutes in browsing

      return {
        available,
        quantity: data.pri_qte_cond || 0,
        unitPriceHT: data.pri_vente_ht,
        unitPriceTTC: data.pri_vente_ttc,
        consigneHT: data.pri_consigne_ht,
        consigneTTC: data.pri_consigne_ttc,
        priceValidUntil: new Date(Date.now() + validityMs).toISOString(),
        verifiedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('getVerifiedStockAndPrice failed', error);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VEHICLE IDENTITY VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Verify vehicle identity and resolve to ktypnr
   */
  async verifyVehicleIdentity(
    input: VerifyVehicleInput,
    context: McpVerifyContext,
  ): Promise<VerifyVehicleOutput | null> {
    if (!this.supabase) return null;

    try {
      const { brand, model, type, year, ktypnr, vin, plate } = input;

      // If ktypnr provided, verify it exists
      if (ktypnr) {
        const { data } = await this.supabase
          .from('__vehicles')
          .select('v_id, v_ktypnr, v_brand, v_model, v_type, v_engine_code')
          .eq('v_ktypnr', ktypnr)
          .single();

        if (data) {
          return {
            ktypnr: data.v_ktypnr,
            brand: data.v_brand,
            model: data.v_model,
            type: data.v_type,
            engineCode: data.v_engine_code,
            confidence: 1.0,
            ambiguous: false,
            verifiedAt: new Date().toISOString(),
          };
        }
      }

      // Resolve from VIN
      if (vin) {
        const resolved = await this.resolveVehicleFromVin(vin);
        if (resolved) {
          return {
            ...resolved,
            confidence: 0.95,
            ambiguous: false,
            verifiedAt: new Date().toISOString(),
          };
        }
      }

      // Resolve from brand/model/type
      if (brand && model) {
        return this.resolveVehicleFromDetails(brand, model, type, year);
      }

      return null;
    } catch (error) {
      this.logger.error('verifyVehicleIdentity failed', error);
      return null;
    }
  }

  private async resolveVehicleFromVin(
    vin: string,
  ): Promise<Omit<VerifyVehicleOutput, 'confidence' | 'ambiguous' | 'verifiedAt'> | null> {
    // VIN decoding would go here - simplified for now
    // In production, call external VIN decode API or internal mapping
    return null;
  }

  private async resolveVehicleFromDetails(
    brand: string,
    model: string,
    type?: string,
    year?: number,
  ): Promise<VerifyVehicleOutput | null> {
    try {
      let query = this.supabase
        .from('__vehicles')
        .select('v_id, v_ktypnr, v_brand, v_model, v_type, v_engine_code')
        .ilike('v_brand', brand)
        .ilike('v_model', `%${model}%`);

      if (type) {
        query = query.ilike('v_type', `%${type}%`);
      }

      const { data, error } = await query.limit(5);

      if (error || !data?.length) {
        return null;
      }

      // Single match = high confidence
      if (data.length === 1) {
        const v = data[0];
        return {
          ktypnr: v.v_ktypnr,
          brand: v.v_brand,
          model: v.v_model,
          type: v.v_type,
          engineCode: v.v_engine_code,
          confidence: 0.90,
          ambiguous: false,
          verifiedAt: new Date().toISOString(),
        };
      }

      // Multiple matches = ambiguous
      const v = data[0];
      return {
        ktypnr: v.v_ktypnr,
        brand: v.v_brand,
        model: v.v_model,
        type: v.v_type,
        engineCode: v.v_engine_code,
        confidence: 0.60,
        ambiguous: true,
        alternatives: data.slice(1).map((alt) => ({
          ktypnr: alt.v_ktypnr,
          label: `${alt.v_brand} ${alt.v_model} ${alt.v_type}`,
        })),
        verifiedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DIAGNOSTIC VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Run diagnostic through KG and return verified results
   */
  async diagnose(
    input: DiagnoseInput,
    context: McpVerifyContext,
  ): Promise<DiagnoseOutput | null> {
    if (!this.supabase) return null;

    try {
      const { observable_ids, vehicle_context } = input;

      // Call KG diagnostic RPC (correct name: kg_diagnose_with_explainable_score)
      const { data, error } = await this.supabase.rpc(
        'kg_diagnose_with_explainable_score',
        {
          p_observable_ids: observable_ids,
          p_vehicle_id: vehicle_context?.vehicle_id || null,
          p_engine_family_code: vehicle_context?.engine_family_code || null,
          p_current_km: vehicle_context?.mileage_km || null,
          p_last_maintenance_records: [],
          p_ctx_phase: null,
          p_ctx_temp: null,
          p_ctx_speed: null,
          p_limit: 10,
        },
      );

      if (error) {
        this.logger.warn(`KG diagnose RPC failed: ${error.message}`);
        return null;
      }

      // Data is an array of fault results
      const faults = Array.isArray(data) ? data : [];

      return {
        faults: faults.map((f: any) => ({
          fault_id: f.fault_id,
          fault_label: f.fault_label,
          probability_score: f.probability_score,
          confidence_score: f.confidence_score,
        })),
        safety_gate: 'none', // Safety gate is checked separately via kg_check_safety_gate
        verifiedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('diagnose failed', error);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE ROLE RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve page role from URL
   */
  async resolvePageRole(
    input: ResolvePageRoleInput,
    context: McpVerifyContext,
  ): Promise<ResolvePageRoleOutput | null> {
    try {
      const { url, path } = input;
      const urlPath = path || new URL(url).pathname;

      // Page role resolution based on URL patterns
      const rolePatterns: Array<{
        pattern: RegExp;
        role: ResolvePageRoleOutput['role'];
        allowedLinks: string[];
      }> = [
        {
          pattern: /^\/(pieces|constructeurs)\//,
          role: 'R1_ROUTER',
          allowedLinks: ['R2_PRODUCT', 'R3_BLOG', 'R4_REFERENCE'],
        },
        {
          pattern: /^\/pieces\/[^/]+\/[^/]+\/[^/]+\/[^/]+\.html$/,
          role: 'R2_PRODUCT',
          allowedLinks: ['R1_ROUTER', 'R3_BLOG', 'R4_REFERENCE', 'R5_DIAGNOSTIC'],
        },
        {
          pattern: /^\/blog-pieces-auto\//,
          role: 'R3_BLOG',
          allowedLinks: ['R1_ROUTER', 'R2_PRODUCT', 'R4_REFERENCE', 'R5_DIAGNOSTIC'],
        },
        {
          pattern: /^\/reference-auto\//,
          role: 'R4_REFERENCE',
          allowedLinks: ['R1_ROUTER', 'R2_PRODUCT', 'R3_BLOG', 'R5_DIAGNOSTIC'],
        },
        {
          pattern: /^\/diagnostic-auto\//,
          role: 'R5_DIAGNOSTIC',
          allowedLinks: ['R1_ROUTER', 'R2_PRODUCT', 'R4_REFERENCE', 'R6_SUPPORT'],
        },
        {
          pattern: /^\/(contact|mentions-legales|politique-)/,
          role: 'R6_SUPPORT',
          allowedLinks: ['R1_ROUTER'],
        },
      ];

      for (const { pattern, role, allowedLinks } of rolePatterns) {
        if (pattern.test(urlPath)) {
          return {
            role,
            canonical: url,
            allowedLinks,
            verifiedAt: new Date().toISOString(),
          };
        }
      }

      // Default to router for unknown paths
      return {
        role: 'R1_ROUTER',
        canonical: url,
        allowedLinks: ['R2_PRODUCT', 'R3_BLOG'],
        verifiedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('resolvePageRole failed', error);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REFERENCE VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Verify a part reference (OEM, EAN, internal)
   */
  async verifyReference(
    input: VerifyReferenceInput,
    context: McpVerifyContext,
  ): Promise<VerifyReferenceOutput | null> {
    if (!this.supabase) return null;

    try {
      const { reference, type = 'oem' } = input;

      // Search in pieces_ref_search table
      const { data, error } = await this.supabase
        .from('pieces_ref_search')
        .select('prs_piece_id, prs_ref, prs_brand_name, prs_type')
        .ilike('prs_ref', reference)
        .limit(5);

      if (error || !data?.length) {
        return {
          found: false,
          confidence: 0,
          verifiedAt: new Date().toISOString(),
        };
      }

      // Get OEM codes for the piece
      const pieceId = data[0].prs_piece_id;
      const { data: oemData } = await this.supabase
        .from('pieces_ref_search')
        .select('prs_ref')
        .eq('prs_piece_id', pieceId)
        .eq('prs_type', 'oem');

      return {
        found: true,
        pieceId,
        oemCodes: oemData?.map((d) => d.prs_ref) || [],
        brandName: data[0].prs_brand_name,
        confidence: data.length === 1 ? 0.95 : 0.80,
        verifiedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('verifyReference failed', error);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SAFETY GATE VERIFICATION (Phase 3)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check safety gate for given observables
   * Uses kg_check_safety_gate RPC to verify safety concerns
   *
   * Returns structure matching the direct endpoint response for MCP verification
   */
  async checkSafetyGate(
    input: CheckSafetyGateInput,
    context: McpVerifyContext,
  ): Promise<CheckSafetyGateOutput | null> {
    if (!this.supabase) {
      this.logger.warn('checkSafetyGate: Supabase not configured');
      return null;
    }

    try {
      const { observable_ids } = input;

      // Call the safety gate RPC
      const { data, error } = await this.supabase.rpc('kg_check_safety_gate', {
        p_observable_ids: observable_ids,
      });

      if (error) {
        this.logger.error('checkSafetyGate RPC failed', { error, context });
        return null;
      }

      // RPC returns array with single row
      if (!data || data.length === 0) {
        // No safety concern found - return safe defaults
        return {
          has_safety_concern: false,
          highest_gate: 'none',
          block_sales: false,
          can_continue_driving: true,
          safety_message: null,
          recommended_action: null,
          show_emergency_contact: false,
          emergency_contact: null,
          triggered_observables: null,
          verifiedAt: new Date().toISOString(),
        };
      }

      const row = data[0];

      return {
        has_safety_concern: row.has_safety_concern ?? false,
        highest_gate: row.highest_gate ?? 'none',
        block_sales: row.block_sales ?? false,
        can_continue_driving: row.can_continue_driving ?? true,
        safety_message: row.safety_message ?? null,
        recommended_action: row.recommended_action ?? null,
        show_emergency_contact: row.show_emergency_contact ?? false,
        emergency_contact: row.emergency_contact ?? null,
        triggered_observables: row.triggered_observables ?? null,
        verifiedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('checkSafetyGate failed', error);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async resolvePieceFromRef(
    ref: string,
  ): Promise<{ id: number } | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('pieces_ref_search')
      .select('prs_piece_id')
      .ilike('prs_ref', ref)
      .limit(1)
      .single();

    return data ? { id: data.prs_piece_id } : null;
  }
}
