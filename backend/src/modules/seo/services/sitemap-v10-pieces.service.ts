/**
 * SERVICE PIECES SITEMAP V10 - Streaming batch + generation par famille
 *
 * Responsabilites:
 * - Streaming batch processing (shards de 50k, seuil configurable via crawl_budget_experiments)
 * - Generation par famille thematique (19 familles)
 * - Deduplication inter-familles
 *
 * Seuil min items: configurable via DB (default 20). Ajustable sans redeploy.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { DatabaseException, ErrorCodes } from '@common/exceptions';
import { normalizeAlias } from '../../../common/utils/url-builder.utils';
import { SitemapV10DataService } from './sitemap-v10-data.service';
import { SitemapV10XmlService } from './sitemap-v10-xml.service';
import { FAMILY_CLUSTERS } from './sitemap-v10-hubs.types';
import { getValidTypeIds } from '../helpers/auto-type-valid-ids.helper';
import {
  type TemperatureBucket,
  type SitemapUrl,
  type GenerationResult,
  BUCKET_CONFIG,
  MAX_URLS_PER_FILE,
  type PieceV9,
} from './sitemap-v10.types';

/** Liste des cles de familles produits (19 familles) */
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

// ═══════════════════════════════════════════════════════════
// Helpers sitemap : priority tiering
// ═══════════════════════════════════════════════════════════

/** Default minimum items threshold when no experiment is active */
const DEFAULT_MIN_ITEMS_THRESHOLD = 20;

/** Top gammes par volume de recherche (freinage, distribution, embrayage, etc.) */
const TOP_GAMME_IDS = new Set([
  82,
  402,
  306,
  854,
  48,
  13,
  4,
  2, // freins, plaquettes, distribution, amortisseurs, embrayage, cardan, alternateur, demarreur
  78,
  273,
  285,
  286,
  447,
  448,
  412, // etrier, bras, barre direction, cremaillere, clim, capteur ABS
  124,
  234,
  243,
  158,
  10,
  1123, // cable frein, emetteur, bougie, corps papillon, courroie, chaine
]);

/** Top marques par volume (FR market) */
const TOP_MARQUE_IDS = new Set([
  140,
  128,
  173,
  33,
  22,
  108,
  46,
  123, // Renault, Peugeot, VW, BMW, Audi, Mercedes, Citroen, Opel
  60,
  147,
  150,
  58,
  47,
  88,
  119,
  76, // Ford, Seat, Skoda, Fiat, Dacia, Kia, Nissan, Hyundai
]);

/**
 * Calcule une priority intelligente basee sur la popularite gamme+marque.
 * Distribue entre 0.6 et 0.9 pour guider Google vers les pages a fort potentiel.
 */
function computePiecePriority(
  pgId: string | number,
  marqueId: string | number,
): string {
  const pg = typeof pgId === 'string' ? parseInt(pgId, 10) : pgId;
  const mq = typeof marqueId === 'string' ? parseInt(marqueId, 10) : marqueId;
  let p = 0.6;
  if (TOP_GAMME_IDS.has(pg)) p += 0.15;
  if (TOP_MARQUE_IDS.has(mq)) p += 0.05;
  return Math.min(p, 0.9).toFixed(1);
}

@Injectable()
export class SitemapV10PiecesService extends SupabaseBaseService {
  protected override readonly logger = new Logger(SitemapV10PiecesService.name);

  /** Cached threshold for the current generation run */
  private minItemsThreshold: number | null = null;

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
   * Resolve the minimum items threshold from an active crawl budget experiment.
   * Falls back to DEFAULT_MIN_ITEMS_THRESHOLD (20) if no experiment is running.
   * Cached per service instance (reset on next generation run).
   */
  private async resolveMinItemsThreshold(): Promise<number> {
    if (this.minItemsThreshold !== null) return this.minItemsThreshold;

    try {
      const { data } = await this.supabase
        .from('crawl_budget_experiments')
        .select('baseline')
        .eq('status', 'running')
        .eq('action', 'reduce')
        .limit(1)
        .maybeSingle();

      const threshold =
        data?.baseline &&
        typeof data.baseline === 'object' &&
        'min_items_threshold' in (data.baseline as Record<string, unknown>)
          ? Number(
              (data.baseline as Record<string, unknown>).min_items_threshold,
            )
          : DEFAULT_MIN_ITEMS_THRESHOLD;

      this.minItemsThreshold =
        isNaN(threshold) || threshold < 1
          ? DEFAULT_MIN_ITEMS_THRESHOLD
          : threshold;
    } catch {
      this.minItemsThreshold = DEFAULT_MIN_ITEMS_THRESHOLD;
    }

    this.logger.log(
      `  Pieces min items threshold: ${this.minItemsThreshold} (default: ${DEFAULT_MIN_ITEMS_THRESHOLD})`,
    );
    return this.minItemsThreshold;
  }

  /**
   * Genere les sitemaps pieces avec source V9 (__sitemap_p_link)
   * Streaming batch processing - ecrit les fichiers par shard de 50k
   */
  async generatePiecesSitemapsFromV9Source(
    bucket: TemperatureBucket,
  ): Promise<{ filePaths: string[]; totalCount: number }> {
    // Seul le bucket 'stable' genere les URLs pour eviter les doublons
    if (bucket !== 'stable') {
      this.logger.log(`Skipping ${bucket} bucket (all URLs go to stable)`);
      return { filePaths: [], totalCount: 0 };
    }

    // Reset cached threshold for this generation run
    this.minItemsThreshold = null;
    const minItems = await this.resolveMinItemsThreshold();

    this.logger.log(
      `Streaming batch generation from V9 source (threshold: ${minItems}, 50k URLs per shard)...`,
    );

    // 1. Recuperer les gammes INDEX
    const indexPgIds = await this.dataService.getIndexGammeIds();
    if (indexPgIds.size === 0) {
      this.logger.warn('Aucune gamme INDEX trouvee');
      return { filePaths: [], totalCount: 0 };
    }

    const PAGE_SIZE = 1000;
    const SHARD_SIZE = MAX_URLS_PER_FILE;
    const config = BUCKET_CONFIG[bucket];
    const pgIdsArray = Array.from(indexPgIds);

    // Anti-404 : charger le Set des type_ids valides dans auto_type
    // (filtre les ~3,545 orphelins TecDoc V1 = 100001-134362)
    const validTypeIds = await getValidTypeIds(this.supabase);
    this.logger.log(
      `  Loaded ${validTypeIds.size.toLocaleString()} valid type_ids (auto_type WHERE type_display='1')`,
    );

    let currentBatch: PieceV9[] = [];
    let shardIndex = 0;
    let offset = 0;
    let hasMore = true;
    let totalCount = 0;
    let skippedOrphans = 0;
    const filePaths: string[] = [];

    this.logger.log(
      `  Streaming pieces for ${pgIdsArray.length} gammes INDEX...`,
    );

    while (hasMore) {
      const { data: pieces, error } = await this.supabase
        .from('__sitemap_p_link')
        .select(
          'map_pg_alias, map_pg_id, map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id',
        )
        .in('map_pg_id', pgIdsArray)
        .gt('map_has_item', minItems)
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        this.logger.error(
          `Error fetching pieces at offset ${offset}: ${error.message}`,
        );
        break;
      }

      if (pieces && pieces.length > 0) {
        // Anti-404 : filtrer les pieces dont map_type_id n'existe plus dans auto_type
        const rawCount = pieces.length;
        const validPieces = (pieces as PieceV9[]).filter((p) =>
          validTypeIds.has(
            typeof p.map_type_id === 'string'
              ? parseInt(p.map_type_id, 10)
              : (p.map_type_id as number),
          ),
        );
        skippedOrphans += rawCount - validPieces.length;

        currentBatch.push(...validPieces);
        offset += PAGE_SIZE;
        totalCount += validPieces.length;
        hasMore = rawCount === PAGE_SIZE;

        // Quand on atteint SHARD_SIZE, ecrire le fichier et liberer la memoire
        while (currentBatch.length >= SHARD_SIZE) {
          const shardPieces = currentBatch.slice(0, SHARD_SIZE);
          currentBatch = currentBatch.slice(SHARD_SIZE);

          const shardUrls: SitemapUrl[] = shardPieces.map((p) => ({
            url: `/pieces/${normalizeAlias(p.map_pg_alias)}-${p.map_pg_id}/${normalizeAlias(p.map_marque_alias)}-${p.map_marque_id}/${normalizeAlias(p.map_modele_alias)}-${p.map_modele_id}/${normalizeAlias(p.map_type_alias)}-${p.map_type_id}.html`,
            page_type: 'piece',
            changefreq: config.changefreq,
            priority: computePiecePriority(p.map_pg_id, p.map_marque_id),
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
            `   Written ${fileName} (${shardUrls.length.toLocaleString()} URLs)`,
          );
        }

        // Log progress every 100k URLs
        if (totalCount % 100000 < PAGE_SIZE) {
          this.logger.log(
            `  Progress: ${totalCount.toLocaleString()} URLs processed, ${filePaths.length} files written...`,
          );
        }
      } else {
        hasMore = false;
      }
    }

    // Ecrire le dernier shard partiel
    if (currentBatch.length > 0) {
      const shardUrls: SitemapUrl[] = currentBatch.map((p) => ({
        url: `/pieces/${normalizeAlias(p.map_pg_alias)}-${p.map_pg_id}/${normalizeAlias(p.map_marque_alias)}-${p.map_marque_id}/${normalizeAlias(p.map_modele_alias)}-${p.map_modele_id}/${normalizeAlias(p.map_type_alias)}-${p.map_type_id}.html`,
        page_type: 'piece',
        changefreq: config.changefreq,
        priority: computePiecePriority(p.map_pg_id, p.map_marque_id),
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
        `   Written ${fileName} (${shardUrls.length.toLocaleString()} URLs) - Final shard`,
      );
    }

    if (totalCount === 0) {
      this.logger.warn('No pieces found');
      return { filePaths: [], totalCount: 0 };
    }

    this.logger.log(
      `  ${totalCount.toLocaleString()} URLs pieces INDEX (threshold: ${minItems}) -> ${filePaths.length} files`,
    );
    if (skippedOrphans > 0) {
      this.logger.warn(
        `  🧹 Filtered out ${skippedOrphans.toLocaleString()} URLs with orphan type_ids (TecDoc V1 remap residue)`,
      );
    }

    return { filePaths, totalCount };
  }

  /**
   * Genere le sitemap XML pour une famille thematique
   * @param familyKey Cle de la famille (ex: 'freinage', 'filtres')
   */
  async generateByFamily(familyKey: string): Promise<GenerationResult> {
    const startTime = Date.now();
    const _runId = crypto.randomUUID();

    this.logger.log(`Generating sitemap for family: ${familyKey}...`);

    const familyConfig = FAMILY_CLUSTERS[familyKey];
    if (!familyConfig) {
      this.logger.error(`Unknown family: ${familyKey}`);
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
      const minItems = await this.resolveMinItemsThreshold();

      // 1. Recuperer toutes les gamme names de cette famille
      const allGammeNames = familyConfig.subcategories.flatMap(
        (s) => s.gamme_names,
      );

      // 2. Recuperer les pg_id correspondants depuis pieces_gamme (INDEX uniquement)
      const { data: gammes, error: gammeError } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id')
        .in('pg_name', allGammeNames)
        .eq('pg_display', '1')
        .eq('pg_relfollow', '1');

      if (gammeError) {
        throw new DatabaseException({
          code: ErrorCodes.SEO.SITEMAP_FETCH_FAILED,
          message: `Gamme lookup failed: ${gammeError.message}`,
          details: gammeError.message,
          cause: gammeError instanceof Error ? gammeError : undefined,
        });
      }

      const pgIds = (gammes || []).map((g) => String(g.pg_id));

      if (pgIds.length === 0) {
        this.logger.warn(`No gammes found for family ${familyKey}`);
        return {
          success: true,
          bucket: 'stable' as TemperatureBucket,
          urlCount: 0,
          filesGenerated: 0,
          durationMs: Date.now() - startTime,
          filePaths: [],
        };
      }

      // 3. Recuperer TOUTES les pieces depuis __sitemap_p_link (pagination)
      // Anti-404 : filtrer les orphelins TecDoc V1 (type_ids absents d'auto_type)
      const validTypeIds = await getValidTypeIds(this.supabase);
      const allPieces: PieceV9[] = [];
      const PAGE_SIZE = 1000;
      let offset = 0;
      let hasMore = true;
      let skippedOrphans = 0;

      while (hasMore) {
        const { data: pieces, error: piecesError } = await this.supabase
          .from('__sitemap_p_link')
          .select(
            'map_pg_alias, map_pg_id, map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id',
          )
          .in('map_pg_id', pgIds)
          .gt('map_has_item', minItems)
          .range(offset, offset + PAGE_SIZE - 1);

        if (piecesError) {
          throw new DatabaseException({
            code: ErrorCodes.SEO.SITEMAP_FETCH_FAILED,
            message: `Pieces fetch failed: ${piecesError.message}`,
            details: piecesError.message,
            cause: piecesError instanceof Error ? piecesError : undefined,
          });
        }

        if (pieces && pieces.length > 0) {
          const rawCount = pieces.length;
          const validPieces = (pieces as PieceV9[]).filter((p) =>
            validTypeIds.has(
              typeof p.map_type_id === 'string'
                ? parseInt(p.map_type_id, 10)
                : (p.map_type_id as number),
            ),
          );
          skippedOrphans += rawCount - validPieces.length;
          allPieces.push(...validPieces);
          offset += PAGE_SIZE;
          hasMore = rawCount === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      this.logger.log(
        `   Found ${allPieces.length.toLocaleString()} URLs for ${familyKey}`,
      );
      if (skippedOrphans > 0) {
        this.logger.warn(
          `   🧹 Filtered out ${skippedOrphans.toLocaleString()} orphan type_ids for ${familyKey}`,
        );
      }

      // 4. Construire les SitemapUrl
      const urls: SitemapUrl[] = allPieces.map((p) => ({
        url: `/pieces/${normalizeAlias(p.map_pg_alias)}-${p.map_pg_id}/${normalizeAlias(p.map_marque_alias)}-${p.map_marque_id}/${normalizeAlias(p.map_modele_alias)}-${p.map_modele_id}/${normalizeAlias(p.map_type_alias)}-${p.map_type_id}.html`,
        page_type: 'product',
        changefreq: 'weekly',
        priority: computePiecePriority(p.map_pg_id, p.map_marque_id),
        last_modified_at: null,
      }));

      // 4.5 Dedupliquer inter-familles
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
          this.logger.log(`   Deduplicated ${dedupedCount} inter-family URLs`);
        }
      }

      // 5. Ecrire le(s) fichier(s) XML avec sharding si >50k URLs
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
          `   Generated ${fileName} (${shardUrls.length.toLocaleString()} URLs)`,
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
        `Failed to generate family ${familyKey}: ${errorMessage}`,
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
