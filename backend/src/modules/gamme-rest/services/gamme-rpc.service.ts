import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { GammeDataTransformerService } from './gamme-data-transformer.service';

/**
 * Service pour les appels RPC optimisés
 */
@Injectable()
export class GammeRpcService extends SupabaseBaseService {
  constructor(private readonly transformer: GammeDataTransformerService) {
    super();
  }

  /**
   * Récupère toutes les données via RPC V2 optimisé
   */
  async getPageDataRpcV2(pgId: string) {
    const pgIdNum = parseInt(pgId, 10);
    const startTime = performance.now();

    // Redirection spéciale
    if (pgIdNum === 3940) {
      return { redirect: '/pieces/corps-papillon-158.html' };
    }

    // Appel RPC unique
    const { data: aggregatedData, error: rpcError } = await this.client.rpc(
      'get_gamme_page_data_optimized',
      { p_pg_id: pgId },
    );

    if (rpcError) {
      throw rpcError;
    }

    const rpcTime = performance.now();
    console.log(`✅ RPC exécuté en ${(rpcTime - startTime).toFixed(1)}ms`);

    // Extraction page_info depuis le RPC
    const pageInfo = aggregatedData?.page_info;
    if (!pageInfo) {
      throw new Error('Gamme non trouvée');
    }

    return {
      aggregatedData,
      pageData: pageInfo,
      timings: {
        rpcTime: rpcTime - startTime,
        totalTime: performance.now() - startTime,
      },
    };
  }

  /**
   * Obtient des fragments SEO par type_id avec meilleure distribution
   */
  getSeoFragmentsByTypeId(
    typeId: number,
    seoFragments1: any[],
    seoFragments2: any[],
  ): { fragment1: string; fragment2: string } {
    // Hash pour meilleure distribution des fragments (évite répétitions avec typeId consécutifs)
    const hashTypeId = (id: number): number => {
      let hash = id;
      hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
      hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
      hash = (hash >> 16) ^ hash;
      return Math.abs(hash);
    };

    const hash = hashTypeId(typeId);
    const fragment1 =
      seoFragments1.length > 0
        ? seoFragments1[hash % seoFragments1.length]?.sis_content || ''
        : '';
    const fragment2 =
      seoFragments2.length > 0
        ? seoFragments2[(hash + 1) % seoFragments2.length]?.sis_content || ''
        : '';
    return { fragment1, fragment2 };
  }
}
