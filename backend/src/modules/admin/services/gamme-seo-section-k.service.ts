/**
 * 📊 GAMME SEO SECTION K SERVICE
 *
 * Extracted from AdminGammesSeoService (DEC: reduce 2,064-line file)
 * Handles Section K V-Level conformity drill-downs:
 * - Missing type_ids for a gamme
 * - Extra type_ids for a gamme
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';

@Injectable()
export class GammeSeoSectionKService extends SupabaseBaseService {
  protected readonly logger = new Logger(GammeSeoSectionKService.name);

  constructor(rpcGate: RpcGateService) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * Get missing type_ids for a specific gamme (Section K drill-down)
   */
  async getSectionKMissingDetails(pgId: number) {
    this.logger.log(`🔍 getSectionKMissingDetails(pgId=${pgId})`);

    try {
      // 🛡️ RPC Safety Gate
      const { data, error } = await this.callRpc<any[]>(
        'get_vlevel_section_k_missing',
        { p_pg_id: pgId },
        { source: 'admin' },
      );

      if (error) {
        // If RPC doesn't exist, return empty array
        this.logger.warn('⚠️ RPC get_vlevel_section_k_missing not found');
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error('❌ getSectionKMissingDetails error:', error);
      return [];
    }
  }

  /**
   * Get extra type_ids for a specific gamme (Section K drill-down)
   */
  async getSectionKExtrasDetails(pgId: number) {
    this.logger.log(`🔍 getSectionKExtrasDetails(pgId=${pgId})`);

    try {
      // 🛡️ RPC Safety Gate
      const { data, error } = await this.callRpc<any[]>(
        'get_vlevel_section_k_extras',
        { p_pg_id: pgId },
        { source: 'admin' },
      );

      if (error) {
        // If RPC doesn't exist, return empty array
        this.logger.warn('⚠️ RPC get_vlevel_section_k_extras not found');
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error('❌ getSectionKExtrasDetails error:', error);
      return [];
    }
  }
}
