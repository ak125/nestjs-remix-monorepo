/**
 * 📦 SERVICE PIÈCES SITEMAP V10 - Streaming batch + génération par famille
 *
 * Responsabilités:
 * - Streaming batch processing pour 714k+ URLs (shards de 50k)
 * - Génération par famille thématique (19 familles)
 * - Déduplication inter-familles
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import { SitemapV10DataService } from './sitemap-v10-data.service';
import { SitemapV10XmlService } from './sitemap-v10-xml.service';
import { FAMILY_CLUSTERS } from './sitemap-v10-hubs.types';
import {
  type TemperatureBucket,
  type SitemapUrl,
  type GenerationResult,
  BUCKET_CONFIG,
  MAX_URLS_PER_FILE,
  type PieceV9,
} from './sitemap-v10.types';

/** Liste des clés de familles produits (19 familles) */
export const PRODUCT_FAMILY_KEYS = [
  'filtres',
  'freinage',
  'distribution',
  'allumage',
  'direction',
  'suspension',
  'support-moteur',
  'embrayage',
  'transmission',
  'electrique',
  'capteurs',
  'alimentation',
  'moteur',
  'refroidissement',
  'climatisation',
  'echappement',
  'eclairage',
  'accessoires',
  'turbo',
];

@Injectable()
export class SitemapV10PiecesService extends SupabaseBaseService {
  protected override readonly logger = new Logger(SitemapV10PiecesService.name);

  constructor(
    configService: ConfigService,
    rpcGate: RpcGateService,
    private readonly dataService: SitemapV10DataService,
    private readonly xmlService: SitemapV10XmlService,
  ) {
    super(configService);
    this.rpcGate = rpcGate;
  }

  /**
   * 📦 Génère les sitemaps pièces avec source V9 (__sitemap_p_link)
   * 🚀 P7.4 PERF: Streaming batch processing - écrit les fichiers par shard de 50k
   *    pour réduire peak memory de ~270MB à <50MB
   */
  async generatePiecesSitemapsFromV9Source(
    bucket: TemperatureBucket,
  ): Promise<{ filePaths: string[]; totalCount: number }> {
    // Seul le bucket 'stable' génère les URLs pour éviter les doublons
    if (bucket !== 'stable') {
      this.logger.log(`⏭️ Skipping ${bucket} bucket (all URLs go to stable)`);
      return { filePaths: [], totalCount: 0 };
    }

    this.logger.log(
      `📦 Streaming batch generation from V9 source (50k URLs per shard)...`,
    );

    // 1. Récupérer les gammes INDEX
    const indexPgIds = await this.dataService.getIndexGammeIds();
    if (indexPgIds.size === 0) {
      this.logger.warn('⚠️ Aucune gamme INDEX trouvée');
      return { filePaths: [], totalCount: 0 };
    }

    // 🚀 P7.4: Streaming batch - écrire les fichiers sitemap par shard
    const PAGE_SIZE = 1000;
    const SHARD_SIZE = MAX_URLS_PER_FILE;
    const config = BUCKET_CONFIG[bucket];
    const pgIdsArray = Array.from(indexPgIds);

    let currentBatch: PieceV9[] = [];
    let shardIndex = 0;
    let offset = 0;
    let hasMore = true;
    let totalCount = 0;
    const filePaths: string[] = [];

    this.logger.log(
      `  🎯 Streaming pieces for ${pgIdsArray.length} gammes INDEX...`,
    );

    while (hasMore) {
      const { data: pieces, error } = await this.supabase
        .from('__sitemap_p_link')
        .select(
          'map_pg_alias, map_pg_id, map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id',
        )
        .in('map_pg_id', pgIdsArray)
        .gt('map_has_item', 5)
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        this.logger.error(
          `❌ Error fetching pieces at offset ${offset}: ${error.message}`,
        );
        break;
      }

      if (pieces && pieces.length > 0) {
        currentBatch.push(...(pieces as PieceV9[]));
        offset += PAGE_SIZE;
        totalCount += pieces.length;
        hasMore = pieces.length === PAGE_SIZE;

        // 🚀 P7.4: Quand on atteint SHARD_SIZE, écrire le fichier et libérer la mémoire
        while (currentBatch.length >= SHARD_SIZE) {
          const shardPieces = currentBatch.slice(0, SHARD_SIZE);
          currentBatch = currentBatch.slice(SHARD_SIZE);

          const shardUrls: SitemapUrl[] = shardPieces.map((p) => ({
            url: `/pieces/${p.map_pg_alias}-${p.map_pg_id}/${p.map_marque_alias}-${p.map_marque_id}/${p.map_modele_alias}-${p.map_modele_id}/${p.map_type_alias}-${p.map_type_id}.html`,
            page_type: 'piece',
            changefreq: config.changefreq,
            priority: config.priority,
            last_modified_at: null,
          }));

          shardIndex++;
          const fileName = `sitemap-pieces-${shardIndex}.xml`;
          const filePath = await this.xmlService.writeSitemapFile(
            bucket,
            fileName,
            shardUrls,
            true,
          );
          filePaths.push(filePath);
          this.logger.log(
            `   ✅ Written ${fileName} (${shardUrls.length.toLocaleString()} URLs) - Memory freed`,
          );
        }

        // Log progress every 100k URLs
        if (totalCount % 100000 < PAGE_SIZE) {
          this.logger.log(
            `  📊 Progress: ${totalCount.toLocaleString()} URLs processed, ${filePaths.length} files written...`,
          );
        }
      } else {
        hasMore = false;
      }
    }

    // 🚀 P7.4: Écrire le dernier shard partiel
    if (currentBatch.length > 0) {
      const shardUrls: SitemapUrl[] = currentBatch.map((p) => ({
        url: `/pieces/${p.map_pg_alias}-${p.map_pg_id}/${p.map_marque_alias}-${p.map_marque_id}/${p.map_modele_alias}-${p.map_modele_id}/${p.map_type_alias}-${p.map_type_id}.html`,
        page_type: 'piece',
        changefreq: config.changefreq,
        priority: config.priority,
        last_modified_at: null,
      }));

      shardIndex++;
      const fileName =
        filePaths.length === 0
          ? `sitemap-pieces.xml`
          : `sitemap-pieces-${shardIndex}.xml`;
      const filePath = await this.xmlService.writeSitemapFile(
        bucket,
        fileName,
        shardUrls,
        true,
      );
      filePaths.push(filePath);
      this.logger.log(
        `   ✅ Written ${fileName} (${shardUrls.length.toLocaleString()} URLs) - Final shard`,
      );
    }

    if (totalCount === 0) {
      this.logger.warn('⚠️ No pieces found');
      return { filePaths: [], totalCount: 0 };
    }

    this.logger.log(
      `  ✅ ${totalCount.toLocaleString()} URLs pièces INDEX → ${filePaths.length} files (streaming batch)`,
    );

    return { filePaths, totalCount };
  }

  /**
   * 🔥 Génère le sitemap XML pour une famille thématique
   * @param familyKey Clé de la famille (ex: 'freinage', 'filtres')
   */
  async generateByFamily(familyKey: string): Promise<GenerationResult> {
    const startTime = Date.now();
    const _runId = crypto.randomUUID();

    this.logger.log(`📦 Generating sitemap for family: ${familyKey}...`);

    const familyConfig = FAMILY_CLUSTERS[familyKey];
    if (!familyConfig) {
      this.logger.error(`❌ Unknown family: ${familyKey}`);
      return {
        success: false,
        bucket: 'stable' as TemperatureBucket,
        urlCount: 0,
        filesGenerated: 0,
        durationMs: Date.now() - startTime,
        filePaths: [],
        error: `Unknown family: ${familyKey}`,
      };
    }

    try {
      // 1. Récupérer toutes les gamme names de cette famille
      const allGammeNames = familyConfig.subcategories.flatMap(
        (s) => s.gamme_names,
      );

      // 2. Récupérer les pg_id correspondants depuis pieces_gamme (INDEX uniquement)
      const { data: gammes, error: gammeError } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id')
        .in('pg_name', allGammeNames)
        .eq('pg_display', '1')
        .eq('pg_relfollow', '1');

      if (gammeError) {
        throw new Error(`Gamme lookup failed: ${gammeError.message}`);
      }

      const pgIds = (gammes || []).map((g) => String(g.pg_id));

      if (pgIds.length === 0) {
        this.logger.warn(`⚠️ No gammes found for family ${familyKey}`);
        return {
          success: true,
          bucket: 'stable' as TemperatureBucket,
          urlCount: 0,
          filesGenerated: 0,
          durationMs: Date.now() - startTime,
          filePaths: [],
        };
      }

      // 3. Récupérer TOUTES les pièces depuis __sitemap_p_link (pagination)
      const allPieces: PieceV9[] = [];
      const PAGE_SIZE = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: pieces, error: piecesError } = await this.supabase
          .from('__sitemap_p_link')
          .select(
            'map_pg_alias, map_pg_id, map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id',
          )
          .in('map_pg_id', pgIds)
          .gt('map_has_item', 5)
          .range(offset, offset + PAGE_SIZE - 1);

        if (piecesError) {
          throw new Error(`Pieces fetch failed: ${piecesError.message}`);
        }

        if (pieces && pieces.length > 0) {
          allPieces.push(...pieces);
          offset += PAGE_SIZE;
          hasMore = pieces.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      this.logger.log(
        `   📊 Found ${allPieces.length.toLocaleString()} URLs for ${familyKey}`,
      );

      // 4. Construire les SitemapUrl
      const urls: SitemapUrl[] = allPieces.map((p) => ({
        url: `/pieces/${p.map_pg_alias}-${p.map_pg_id}/${p.map_marque_alias}-${p.map_marque_id}/${p.map_modele_alias}-${p.map_modele_id}/${p.map_type_alias}-${p.map_type_id}.html`,
        page_type: 'product',
        changefreq: 'weekly',
        priority: '0.6',
        last_modified_at: null,
      }));

      // 4.5 Dédupliquer inter-familles
      const processedUrlsCache = this.dataService.getProcessedUrlsCache();
      let uniqueUrls = urls;
      if (processedUrlsCache) {
        const beforeCount = urls.length;
        uniqueUrls = urls.filter((u) => {
          if (processedUrlsCache.has(u.url)) {
            return false;
          }
          processedUrlsCache.add(u.url);
          return true;
        });
        const dedupedCount = beforeCount - uniqueUrls.length;
        if (dedupedCount > 0) {
          this.logger.log(
            `   🔄 Deduplicated ${dedupedCount} inter-family URLs`,
          );
        }
      }

      // 5. Écrire le(s) fichier(s) XML avec sharding si >50k URLs
      const filePaths: string[] = [];
      const numShards = Math.ceil(uniqueUrls.length / MAX_URLS_PER_FILE);

      for (let shard = 0; shard < numShards; shard++) {
        const shardUrls = uniqueUrls.slice(
          shard * MAX_URLS_PER_FILE,
          (shard + 1) * MAX_URLS_PER_FILE,
        );

        const fileName =
          numShards === 1
            ? `sitemap-${familyKey}.xml`
            : `sitemap-${familyKey}-${shard + 1}.xml`;

        const filePath = await this.xmlService.writeFamilySitemapFile(
          familyKey,
          fileName,
          shardUrls,
        );
        filePaths.push(filePath);

        this.logger.log(
          `   ✓ Generated ${fileName} (${shardUrls.length.toLocaleString()} URLs)`,
        );
      }

      const durationMs = Date.now() - startTime;

      return {
        success: true,
        bucket: 'stable' as TemperatureBucket,
        urlCount: uniqueUrls.length,
        filesGenerated: filePaths.length,
        durationMs,
        filePaths,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `❌ Failed to generate family ${familyKey}: ${errorMessage}`,
      );

      return {
        success: false,
        bucket: 'stable' as TemperatureBucket,
        urlCount: 0,
        filesGenerated: 0,
        durationMs: Date.now() - startTime,
        filePaths: [],
        error: errorMessage,
      };
    }
  }
}
