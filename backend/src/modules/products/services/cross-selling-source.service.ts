import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import type { CrossGamme } from './cross-selling.service';

/**
 * CrossSellingSourceService - Data source methods for cross-selling.
 *
 * Extracted from CrossSellingService to isolate:
 * - Same-family cross-gamme retrieval (catalog_gamme + pieces_relation_type)
 * - Config-based cross-gamme retrieval (pieces_gamme_cross)
 * - Article availability verification (batch + single)
 * - Products count queries
 */
@Injectable()
export class CrossSellingSourceService extends SupabaseBaseService {
  protected readonly logger = new Logger(CrossSellingSourceService.name);

  /**
   * Cross-selling same family optimized - PHP Legacy pattern.
   * Replicates PHP logic with CATALOG_GAMME and MC_MF_PRIME.
   */
  async getSameFamilyCrossGammesOptimized(
    pgId: number,
    typeId: number,
    mfId?: number,
  ): Promise<CrossGamme[]> {
    try {
      // Timeout 10s to avoid 36s blocking
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 10000);

      try {
        // Step 1: Get mc_mf_prime from catalog_gamme for the current pgId
        let currentMfId = mfId;
        if (!currentMfId) {
          this.logger.debug(`🔍 Recherche mc_mf_prime pour pg_id=${pgId}`);
          const { data: catalogData, error: catalogError } = await this.supabase
            .from(TABLES.catalog_gamme)
            .select('mc_mf_prime, mc_pg_id, mc_mf_id')
            .eq('mc_pg_id', pgId)
            .single();

          if (catalogError) {
            this.logger.warn(
              `⚠️ Erreur catalog_gamme pour pg_id=${pgId}:`,
              catalogError.message,
            );
          } else {
            this.logger.debug(`📊 Catalog data trouvé:`, catalogData);
          }

          currentMfId = catalogData?.mc_mf_prime;
        }

        if (!currentMfId) {
          this.logger.warn(
            `⚠️ Aucune famille primaire trouvée pour pg_id=${pgId} - vérifier table catalog_gamme`,
          );
          return [];
        }

        this.logger.log(
          `✅ Famille primaire trouvée: mf_id=${currentMfId} pour pg_id=${pgId}`,
        );

        // Step 2: Get compatible pieces with type_id
        const { data: relationData, error: relError } = await this.supabase
          .from(TABLES.pieces_relation_type)
          .select('rtp_piece_id, rtp_pg_id')
          .eq('rtp_type_id', typeId)
          .neq('rtp_pg_id', pgId)
          .abortSignal(abortController.signal)
          .limit(100);

        clearTimeout(timeoutId);

        if (relError || !relationData || relationData.length === 0) {
          if (relError) {
            this.logger.error(
              '❌ Erreur cross-selling famille (relations):',
              relError,
            );
          }
          return [];
        }

        // Step 3: Get unique gammes from pieces + JOIN catalog_gamme
        const gammeIds = [...new Set(relationData.map((r) => r.rtp_pg_id))];

        const { data: catalogGammesData, error: catalogError } =
          await this.supabase
            .from(TABLES.catalog_gamme)
            .select('mc_pg_id, mc_mf_prime, mc_sort')
            .in('mc_pg_id', gammeIds)
            .eq('mc_mf_prime', currentMfId)
            .order('mc_sort', { ascending: true });

        if (
          catalogError ||
          !catalogGammesData ||
          catalogGammesData.length === 0
        ) {
          this.logger.warn(
            `⚠️ Aucune gamme même famille (mf_id=${currentMfId})`,
          );
          return [];
        }

        // Step 4: Get gamme details with PHP filters
        const filteredGammeIds = catalogGammesData.map((c) => c.mc_pg_id);
        const { data: gammesData, error: gammesError } = await this.supabase
          .from(TABLES.pieces_gamme)
          .select('pg_id, pg_name, pg_alias, pg_img, pg_level, pg_display')
          .in('pg_id', filteredGammeIds)
          .in('pg_level', [1, 2]) // PHP filter line 909
          .eq('pg_display', 1); // PHP filter line 910

        if (gammesError || !gammesData || gammesData.length === 0) {
          return [];
        }

        // Step 5: Sort by MC_SORT (business order)
        const sortedGammes = gammesData
          .map((gamme) => {
            const catalogInfo = catalogGammesData.find(
              (c) => c.mc_pg_id === gamme.pg_id,
            );
            return {
              ...gamme,
              mc_sort: catalogInfo?.mc_sort || 999,
            };
          })
          .sort((a, b) => a.mc_sort - b.mc_sort);

        // PHP pattern: Return gammes directly (no article validation)
        const crossGammes: CrossGamme[] = sortedGammes.map((g) => ({
          pg_id: g.pg_id,
          pg_name: g.pg_name,
          pg_alias: g.pg_alias,
          pg_img: g.pg_img,
          cross_level: 1,
          source: 'family' as const,
        }));

        this.logger.log(
          `✅ Cross-selling famille: ${crossGammes.length} gammes (mf_id=${currentMfId}, pattern PHP - pas de validation)`,
        );
        return crossGammes;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.error('⏱️ Timeout 10s dépassé pour cross-selling famille');
      } else {
        this.logger.error(
          '❌ Erreur getSameFamilyCrossGammesOptimized:',
          error,
        );
      }
      return [];
    }
  }

  /**
   * Cross-selling by configuration optimized - PHP Legacy pattern.
   * Replicates with PG_LEVEL, PG_DISPLAY filters, ORDER BY PGC_LEVEL + MC_SORT + PG_NAME.
   */
  async getCrossGammesByConfigOptimized(
    pgId: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _typeId: number,
  ): Promise<CrossGamme[]> {
    try {
      // Timeout 10s to avoid 36s blocking
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 10000);

      try {
        // Step 1: Get cross config from pieces_gamme_cross
        this.logger.debug(`🔍 Recherche pieces_gamme_cross pour pg_id=${pgId}`);
        const { data: crossData, error } = await this.supabase
          .from(TABLES.pieces_gamme_cross)
          .select('pgc_pg_cross, pgc_level')
          .eq('pgc_pg_id', pgId)
          .neq('pgc_pg_cross', pgId)
          .order('pgc_level', { ascending: true })
          .abortSignal(abortController.signal)
          .limit(15);

        clearTimeout(timeoutId);

        if (error || !crossData || crossData.length === 0) {
          if (error) {
            this.logger.error('❌ Erreur cross-selling config:', error);
          } else {
            this.logger.log(
              `📊 pieces_gamme_cross: ${crossData?.length || 0} résultats pour pg_id=${pgId}`,
            );
          }
          return [];
        }

        this.logger.log(
          `📊 pieces_gamme_cross: ${crossData.length} gammes trouvées pour pg_id=${pgId}`,
        );

        // PHP condition line 1045: minimum 2 results (> 1)
        if (crossData.length < 2) {
          this.logger.log(
            `⚠️ Cross-selling config: seulement ${crossData.length} résultat(s) - minimum 2 requis (PHP > 1)`,
          );
          return [];
        }

        // Step 2: Get gamme details with PHP filters
        const gammeIds = crossData.map((item) => item.pgc_pg_cross);
        this.logger.log(`🔍 Gamme IDs à récupérer: ${gammeIds.join(', ')}`);

        const { data: gammesData, error: gammesError } = await this.supabase
          .from(TABLES.pieces_gamme)
          .select('pg_id, pg_name, pg_alias, pg_img, pg_level, pg_display')
          .in('pg_id', gammeIds)
          .in('pg_level', [1, 2]) // PHP filter line 1054
          .eq('pg_display', 1); // PHP filter line 1055

        if (gammesError) {
          this.logger.error(`❌ Erreur récupération gammes:`, gammesError);
        }

        this.logger.log(
          `📊 Gammes après filtres pg_level/pg_display: ${gammesData?.length || 0}/${gammeIds.length}`,
        );

        if (!gammesData || gammesData.length === 0) {
          this.logger.warn(
            `⚠️ Aucune gamme valide trouvée après filtres (pg_level IN (1,2), pg_display=1)`,
          );
          return [];
        }

        // Step 3: Get mc_sort from catalog_gamme for PHP sorting
        const { data: catalogData } = await this.supabase
          .from(TABLES.catalog_gamme)
          .select('mc_pg_id, mc_sort')
          .in('mc_pg_id', gammeIds);

        // Step 4: Map and sort per PHP ORDER BY (pgc_level, mc_sort, pg_name)
        // PHP pattern: map on gammesData (filtered gammes) instead of crossData
        const mappedData = gammesData
          .map((gamme) => {
            // Type fix: pgc_pg_cross is string, pg_id is number
            const cross = crossData.find(
              (c) => Number(c.pgc_pg_cross) === gamme.pg_id,
            );
            if (!cross) {
              this.logger.warn(
                `⚠️ Config cross NON TROUVÉE pour gamme ${gamme.pg_id} (${gamme.pg_name})`,
              );
              return null;
            }

            const catalog = catalogData?.find(
              (c) => c.mc_pg_id === gamme.pg_id,
            );
            return {
              pgc_pg_cross: gamme.pg_id,
              pgc_level: cross.pgc_level,
              mc_sort: catalog?.mc_sort || 999,
              pieces_gamme: gamme,
            };
          })
          .filter((item) => item !== null);

        this.logger.log(
          `📊 Gammes après mapping: ${mappedData.length}/${gammesData.length} (${crossData.length} configs initiales)`,
        );

        // PHP sort line 1056: ORDER BY PGC_LEVEL, MC_SORT, PG_NAME
        mappedData.sort((a, b) => {
          // 1. PGC_LEVEL (cross-selling priority)
          if (a!.pgc_level !== b!.pgc_level) {
            return a!.pgc_level - b!.pgc_level;
          }
          // 2. MC_SORT (business catalog order)
          if (a!.mc_sort !== b!.mc_sort) {
            return a!.mc_sort - b!.mc_sort;
          }
          // 3. PG_NAME (alphabetical)
          return (a!.pieces_gamme?.pg_name || '').localeCompare(
            b!.pieces_gamme?.pg_name || '',
          );
        });

        // PHP pattern: Return gammes directly from JOIN (no article validation)
        const crossGammes: CrossGamme[] = mappedData.map((item) => ({
          pg_id: item!.pieces_gamme!.pg_id,
          pg_name: item!.pieces_gamme!.pg_name,
          pg_alias: item!.pieces_gamme!.pg_alias,
          pg_img: item!.pieces_gamme!.pg_img,
          cross_level: item!.pgc_level || 1,
          source: 'config' as const,
        }));

        this.logger.log(
          `✅ Cross-selling config: ${crossGammes.length} gammes retournées (pattern PHP - pas de validation)`,
        );
        return crossGammes;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.error('⏱️ Timeout 10s dépassé pour cross-selling config');
      } else {
        this.logger.error('❌ Erreur getCrossGammesByConfigOptimized:', error);
      }
      return [];
    }
  }

  /**
   * Ultra-optimized article availability check for a gamme + type combo.
   */
  async checkArticlesForTypeOptimized(
    pgId: number,
    typeId: number,
  ): Promise<boolean> {
    try {
      // Optimized COUNT query - PHP pattern (no piece_display filter)
      const { data: pieceIds, error: pieceError } = await this.supabase
        .from(TABLES.pieces_relation_type)
        .select('rtp_piece_id')
        .eq('rtp_type_id', typeId)
        .eq('rtp_pg_id', pgId)
        .limit(10);

      if (pieceError) {
        this.logger.debug(
          `⚠️ Erreur pieces_relation_type pg_id=${pgId}, type_id=${typeId}:`,
          pieceError.message,
        );
      }

      if (!pieceIds || pieceIds.length === 0) {
        this.logger.debug(
          `📊 pg_id=${pgId}: 0 relations trouvées avec type_id=${typeId}`,
        );
        return false;
      }

      this.logger.debug(
        `📊 pg_id=${pgId}: ${pieceIds.length} relations trouvées (pattern PHP, pas de filtre piece_display)`,
      );

      const { count, error } = await this.supabase
        .from(TABLES.pieces)
        .select('piece_id', { count: 'exact', head: true })
        .in(
          'piece_id',
          pieceIds.map((p) => p.rtp_piece_id),
        )
        // No .eq('piece_display', 1) - PHP does not filter
        .limit(1);

      const hasArticles = !error && (count ?? 0) > 0;

      this.logger.debug(
        `📊 pg_id=${pgId}: ${count || 0} pièces existantes → hasArticles=${hasArticles}`,
      );

      return hasArticles;
    } catch (error) {
      this.logger.error('❌ Erreur checkArticlesForTypeOptimized:', error);
      return false;
    }
  }

  /**
   * Batch process and verify articles for multiple gammes.
   */
  async processAndVerifyArticlesBatch(
    gammes: Partial<CrossGamme>[],
    typeId: number,
  ): Promise<CrossGamme[]> {
    const validGammes: CrossGamme[] = [];

    this.logger.debug(
      `🔍 Vérification articles pour ${gammes.length} gammes (type_id=${typeId})`,
    );

    // Batch processing for performance
    const verificationPromises = gammes.map(async (gamme, index) => {
      try {
        const hasArticles = await this.checkArticlesForTypeOptimized(
          gamme.pg_id!,
          typeId,
        );

        if (index < 3) {
          this.logger.debug(
            `📊 Gamme ${gamme.pg_id} (${gamme.pg_name}): hasArticles=${hasArticles}`,
          );
        }

        if (hasArticles) {
          const productsCount = await this.getProductsCountOptimized(
            gamme.pg_id!,
            typeId,
          );
          return {
            ...gamme,
            products_count: productsCount,
            metadata: {
              ...gamme.metadata,
              last_updated: new Date().toISOString(),
            },
          } as CrossGamme;
        }
        return null;
      } catch (error) {
        this.logger.warn(`⚠️ Erreur vérification gamme ${gamme.pg_id}:`, error);
        return null;
      }
    });

    const results = await Promise.allSettled(verificationPromises);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        validGammes.push(result.value);
      }
    }

    this.logger.debug(
      `✅ ${validGammes.length}/${gammes.length} gammes validées avec articles`,
    );

    return validGammes;
  }

  /**
   * Get optimized products count for a gamme + type combo.
   */
  async getProductsCountOptimized(
    pgId: number,
    typeId: number,
  ): Promise<number> {
    try {
      const { count } = await this.supabase
        .from(TABLES.pieces_relation_type)
        .select('rtp_piece_id', { count: 'exact', head: true })
        .eq('rtp_type_id', typeId)
        .eq('rtp_pg_id', pgId);
      return count || 0;
    } catch {
      return 0;
    }
  }
}
