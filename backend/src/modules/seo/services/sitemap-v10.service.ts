/**
 * 🔥 SERVICE SITEMAP V10 UNIFIÉ - ORCHESTRATEUR
 *
 * Coordonne la génération de tous les sitemaps et hubs de crawl.
 * Délègue à 4 services spécialisés + le service hubs existant:
 *
 * - SitemapV10XmlService:    Écriture XML, index, cleanup
 * - SitemapV10DataService:   Data fetching, caching, pagination
 * - SitemapV10StaticService: 8 générateurs statiques
 * - SitemapV10PiecesService: Streaming batch 714k URLs + familles
 * - SitemapV10HubsService:   Crawl hubs HTML (intégré dans generateAll)
 *
 * Sitemaps générés (7 types):
 * 1. sitemap-racine.xml       - Homepage (1 URL)
 * 2. sitemap-categories.xml   - Gammes INDEX (~123 URLs)
 * 3. sitemap-vehicules.xml    - Marques+Modèles+Types (~13.8k URLs)
 * 4. sitemap-{bucket}-*.xml   - Pièces par température (~714k URLs)
 * 5. sitemap-blog.xml         - Articles blog (~109 URLs)
 * 6. sitemap-pages.xml        - Pages statiques (~9 URLs)
 * 7. sitemap.xml              - Index principal
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import { DatabaseException, ErrorCodes } from '../../../common/exceptions';
import { SitemapV10XmlService } from './sitemap-v10-xml.service';
import { SitemapV10DataService } from './sitemap-v10-data.service';
import { SitemapV10StaticService } from './sitemap-v10-static.service';
import {
  SitemapV10PiecesService,
  PRODUCT_FAMILY_KEYS,
} from './sitemap-v10-pieces.service';
import { SitemapV10HubsService } from './sitemap-v10-hubs.service';
import {
  type TemperatureBucket,
  type SitemapUrl,
  type GenerationResult,
  type AllBucketsResult,
  BUCKET_ENTITY_TYPES,
  MAX_URLS_PER_FILE,
} from './sitemap-v10.types';

// Re-export types for backward compatibility
export {
  TemperatureBucket,
  SitemapUrl,
  GenerationResult,
  AllBucketsResult,
} from './sitemap-v10.types';

@Injectable()
export class SitemapV10Service extends SupabaseBaseService {
  protected override readonly logger = new Logger(SitemapV10Service.name);

  constructor(
    configService: ConfigService,
    rpcGate: RpcGateService,
    private readonly xmlService: SitemapV10XmlService,
    private readonly dataService: SitemapV10DataService,
    private readonly staticService: SitemapV10StaticService,
    private readonly piecesService: SitemapV10PiecesService,
    private readonly hubsService: SitemapV10HubsService,
  ) {
    super(configService);
    this.rpcGate = rpcGate;

    this.logger.log('🔥 SitemapV10Service initialized (orchestrator)');
    this.logger.log(`   Base URL: ${this.xmlService.BASE_URL}`);
    this.logger.log(`   Output: ${this.xmlService.OUTPUT_DIR}`);
  }

  /**
   * 🚀 MÉTHODE PRINCIPALE - Génère TOUS les sitemaps + hubs
   *
   * Génère automatiquement:
   * 1-7. Sitemaps statiques (racine, categories, vehicules, blog, pages, diagnostic, reference)
   * 8. Sitemaps pièces par température (714k URLs via source V9)
   * 9. Crawl hubs HTML (non-bloquant)
   */
  async generateAll(): Promise<AllBucketsResult> {
    const startTime = Date.now();
    this.logger.log(
      '🚀 Starting V10 UNIFIED sitemap generation (replaces V9)...',
    );

    // Reset cache
    this.dataService.resetCaches();

    const results: GenerationResult[] = [];
    const allFilePaths: string[] = [];

    // 🧹 Nettoyer les fichiers obsolètes
    await this.xmlService.cleanupObsoleteFiles();

    try {
      // 1. Racine/Homepage (1 URL)
      this.logger.log('🏠 [1/9] Generating sitemap-racine.xml...');
      const racine = await this.staticService.generateRacineSitemap();
      if (racine) allFilePaths.push(racine);

      // 2. Catégories/Gammes INDEX
      this.logger.log('📂 [2/9] Generating sitemap-categories.xml...');
      const categories = await this.staticService.generateCategoriesSitemap();
      if (categories) allFilePaths.push(categories);

      // 3. Véhicules fusionné
      this.logger.log('🚗 [3/9] Generating sitemap-vehicules.xml...');
      const vehicules = await this.staticService.generateVehiculesSitemap();
      if (vehicules) allFilePaths.push(vehicules);

      // 4. Blog
      this.logger.log('📝 [4/9] Generating sitemap-blog.xml...');
      const blog = await this.staticService.generateBlogSitemap();
      if (blog) allFilePaths.push(blog);

      // 5. Pages statiques
      this.logger.log('📄 [5/9] Generating sitemap-pages.xml...');
      const pages = await this.staticService.generatePagesSitemap();
      if (pages) allFilePaths.push(pages);

      // 6. Diagnostic R5 (Observable Pro)
      this.logger.log('🩺 [6/9] Generating sitemap-diagnostic.xml...');
      const diagnostic = await this.staticService.generateDiagnosticSitemap();
      if (diagnostic) allFilePaths.push(diagnostic);

      // 7. Référence R4
      this.logger.log('📖 [7/9] Generating sitemap-reference.xml...');
      const reference = await this.staticService.generateReferenceSitemap();
      if (reference) allFilePaths.push(reference);

      // 8. Pièces par température (714k URLs via source V9)
      this.logger.log('📦 [8/9] Generating sitemap-{bucket}-pieces-*.xml...');
      const buckets: TemperatureBucket[] = ['hot', 'stable', 'cold'];

      for (const bucket of buckets) {
        const bucketStart = Date.now();
        const runId = crypto.randomUUID();

        try {
          const { filePaths, totalCount } =
            await this.piecesService.generatePiecesSitemapsFromV9Source(bucket);

          if (totalCount === 0) {
            results.push({
              success: true,
              bucket,
              urlCount: 0,
              filesGenerated: 0,
              durationMs: Date.now() - bucketStart,
              filePaths: [],
            });
            continue;
          }

          allFilePaths.push(...filePaths);

          const durationMs = Date.now() - bucketStart;
          await this.dataService.logGeneration(
            runId,
            bucket,
            'success',
            totalCount,
            filePaths.length,
            durationMs,
          );

          results.push({
            success: true,
            bucket,
            urlCount: totalCount,
            filesGenerated: filePaths.length,
            durationMs,
            filePaths,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`❌ Failed to generate ${bucket}: ${errorMessage}`);
          await this.dataService.logGeneration(
            runId,
            bucket,
            'failed',
            0,
            0,
            Date.now() - bucketStart,
            errorMessage,
          );

          results.push({
            success: false,
            bucket,
            urlCount: 0,
            filesGenerated: 0,
            durationMs: Date.now() - bucketStart,
            filePaths: [],
            error: errorMessage,
          });
        }
      }
    } catch (error) {
      this.logger.error(`❌ Fatal error during generation:`, error);
    }

    // Générer l'index principal avec TOUS les fichiers
    const indexPath =
      await this.xmlService.generateSitemapIndexFromPaths(allFilePaths);

    const totalDurationMs = Date.now() - startTime;
    const totalUrls = results.reduce((sum, r) => sum + r.urlCount, 0);
    const totalFiles = allFilePaths.length;

    // 🚀 P7.4 PERF: Clear caches after generation to free memory
    this.dataService.clearCaches();

    this.logger.log(`✅ V10 UNIFIED generation complete:`);
    this.logger.log(`   Total URLs: ${totalUrls.toLocaleString()}`);
    this.logger.log(`   Total Files: ${totalFiles}`);
    this.logger.log(`   Duration: ${totalDurationMs}ms`);

    // 9. Crawl Hubs (non-bloquant)
    let hubResult: AllBucketsResult['hubResult'];
    this.logger.log('🔗 [9/9] Generating crawl hubs...');
    try {
      const hubs = await this.hubsService.generateAllHubsRobust();
      hubResult = {
        success: true,
        totalUrls: hubs.summary.totalUrls,
        totalFiles: hubs.summary.totalFiles,
      };
      this.logger.log(
        `   ✅ Hubs: ${hubs.summary.totalUrls.toLocaleString()} URLs in ${hubs.summary.totalFiles} files`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `⚠️ Hub generation failed (non-blocking): ${errorMessage}`,
      );
      hubResult = {
        success: false,
        totalUrls: 0,
        totalFiles: 0,
        error: errorMessage,
      };
    }

    return {
      success: results.every((r) => r.success),
      results,
      totalUrls,
      totalFiles,
      totalDurationMs,
      indexPath,
      hubResult,
    };
  }

  /**
   * Génère les sitemaps pour une température spécifique
   */
  async generateByTemperature(
    bucket: TemperatureBucket,
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    const runId = crypto.randomUUID();

    this.logger.log(`📝 Generating ${bucket} sitemap (run: ${runId})...`);

    try {
      // 1. Compter le total d'URLs
      // 🛡️ RPC Safety Gate
      const { data: countData, error: countError } = await this.callRpc<number>(
        'count_sitemap_urls_by_temperature',
        { p_temperature: bucket },
        { source: 'cron' },
      );

      if (countError) {
        throw new DatabaseException({
          code: ErrorCodes.SEO.SITEMAP_FETCH_FAILED,
          message: `Count error: ${countError.message}`,
          details: countError.message,
          cause: countError instanceof Error ? countError : undefined,
        });
      }

      const totalUrls = Number(countData) || 0;
      this.logger.log(
        `   Found ${totalUrls.toLocaleString()} URLs for ${bucket}`,
      );

      if (totalUrls === 0) {
        return {
          success: true,
          bucket,
          urlCount: 0,
          filesGenerated: 0,
          durationMs: Date.now() - startTime,
          filePaths: [],
        };
      }

      // 2. Générer les fichiers par type d'entité (ou par date pour 'new')
      const filePaths: string[] = [];
      const entityTypes = BUCKET_ENTITY_TYPES[bucket];

      if (bucket === 'new') {
        const today = new Date().toISOString().split('T')[0];
        const { data: urls, error: urlsError } = await this.callRpc<
          SitemapUrl[]
        >(
          'get_sitemap_urls_by_temperature',
          {
            p_temperature: bucket,
            p_limit: MAX_URLS_PER_FILE,
            p_offset: 0,
          },
          { source: 'cron' },
        );

        if (urlsError) {
          throw new DatabaseException({
            code: ErrorCodes.SEO.SITEMAP_FETCH_FAILED,
            message: `Fetch error: ${urlsError.message}`,
            details: urlsError.message,
            cause: urlsError instanceof Error ? urlsError : undefined,
          });
        }

        if ((urls as SitemapUrl[]).length > 0) {
          const fileName = `sitemap-new-${today}.xml`;
          const filePath = await this.xmlService.writeSitemapFile(
            bucket,
            fileName,
            urls as SitemapUrl[],
          );
          filePaths.push(filePath);
          this.logger.log(
            `   ✓ Generated ${fileName} (${(urls as SitemapUrl[]).length} URLs)`,
          );
        }
      } else if (entityTypes.length > 0) {
        for (const entityType of entityTypes) {
          const entityUrls = await this.dataService.getUrlsByEntityType(
            bucket,
            entityType,
          );
          if (entityUrls.length > 0) {
            const fileName = `sitemap-${bucket}-${entityType}.xml`;
            const filePath = await this.xmlService.writeSitemapFile(
              bucket,
              fileName,
              entityUrls,
            );
            filePaths.push(filePath);
            this.logger.log(
              `   ✓ Generated ${fileName} (${entityUrls.length} URLs)`,
            );
          }
        }
      } else {
        const numFiles = Math.ceil(totalUrls / MAX_URLS_PER_FILE);
        for (let i = 0; i < numFiles; i++) {
          const offset = i * MAX_URLS_PER_FILE;
          const { data: urls, error: urlsError } = await this.callRpc<
            SitemapUrl[]
          >(
            'get_sitemap_urls_by_temperature',
            {
              p_temperature: bucket,
              p_limit: MAX_URLS_PER_FILE,
              p_offset: offset,
            },
            { source: 'cron' },
          );

          if (urlsError) {
            throw new DatabaseException({
              code: ErrorCodes.SEO.SITEMAP_FETCH_FAILED,
              message: `Fetch error: ${urlsError.message}`,
              details: urlsError.message,
              cause: urlsError instanceof Error ? urlsError : undefined,
            });
          }

          const fileName =
            numFiles === 1
              ? `sitemap-${bucket}.xml`
              : `sitemap-${bucket}-${i + 1}.xml`;
          const filePath = await this.xmlService.writeSitemapFile(
            bucket,
            fileName,
            urls as SitemapUrl[],
          );
          filePaths.push(filePath);
          this.logger.log(
            `   ✓ Generated ${fileName} (${(urls as SitemapUrl[]).length} URLs)`,
          );
        }
      }

      const durationMs = Date.now() - startTime;

      await this.dataService.logGeneration(
        runId,
        bucket,
        'success',
        totalUrls,
        filePaths.length,
        durationMs,
      );

      return {
        success: true,
        bucket,
        urlCount: totalUrls,
        filesGenerated: filePaths.length,
        durationMs,
        filePaths,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.dataService.logGeneration(
        runId,
        bucket,
        'failed',
        0,
        0,
        Date.now() - startTime,
        errorMessage,
      );

      throw error;
    }
  }

  /**
   * Obtenir les stats de distribution par température
   */
  async getTemperatureStats(): Promise<Record<string, unknown>[]> {
    const { data, error } = await this.supabase
      .from('v_seo_temperature_stats')
      .select('*');

    if (error) {
      this.logger.error(`Failed to get temperature stats: ${error.message}`);
      return [];
    }

    return data || [];
  }

  /**
   * Ping Google pour un sitemap spécifique
   */
  async pingGoogle(
    bucket?: TemperatureBucket,
  ): Promise<{ ok: boolean; status: number }> {
    const sitemapUrl = bucket
      ? `${this.xmlService.BASE_URL}/sitemaps/${bucket}/sitemap-${bucket}.xml`
      : `${this.xmlService.BASE_URL}/sitemap.xml`;

    const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;

    try {
      const response = await fetch(pingUrl, { method: 'GET' });
      this.logger.log(`🔔 Pinged Google: ${sitemapUrl} → ${response.status}`);
      return { ok: response.ok, status: response.status };
    } catch (error) {
      this.logger.error(`Failed to ping Google: ${error}`);
      return { ok: false, status: 0 };
    }
  }

  /**
   * Génère le sitemap XML pour une famille thématique (délègue)
   */
  async generateByFamily(familyKey: string): Promise<GenerationResult> {
    return this.piecesService.generateByFamily(familyKey);
  }

  /**
   * Génère sitemaps véhicules par marque (délègue)
   */
  async generateVehiculesByBrand() {
    return this.staticService.generateVehiculesByBrand();
  }

  /**
   * 🚀 Génère TOUS les sitemaps par famille thématique + hubs
   */
  async generateAllByFamily(): Promise<AllBucketsResult> {
    const startTime = Date.now();
    this.logger.log('🚀 Starting V10 FAMILY-BASED sitemap generation...');

    // Reset caches
    this.dataService.resetCaches();
    this.dataService.initDeduplicationCache();

    const results: GenerationResult[] = [];
    const allFilePaths: string[] = [];

    // 🧹 Nettoyer les fichiers obsolètes
    await this.xmlService.cleanupObsoleteFiles();

    try {
      // 1. Sitemaps statiques
      this.logger.log('🏠 [1/9] Generating sitemap-racine.xml...');
      const racine = await this.staticService.generateRacineSitemap();
      if (racine) allFilePaths.push(racine);

      this.logger.log('📂 [2/9] Generating sitemap-categories.xml...');
      const categories = await this.staticService.generateCategoriesSitemap();
      if (categories) allFilePaths.push(categories);

      this.logger.log('🚗 [3/9] Generating vehicules by brand (~30 files)...');
      const vehiculesResult =
        await this.staticService.generateVehiculesByBrand();
      if (vehiculesResult.success) {
        allFilePaths.push(...vehiculesResult.filePaths);
        this.logger.log(
          `   ✅ ${vehiculesResult.brandCount} brand sitemaps: ${vehiculesResult.totalUrls} URLs`,
        );
      }

      this.logger.log('📝 [4/9] Generating sitemap-blog.xml...');
      const blog = await this.staticService.generateBlogSitemap();
      if (blog) allFilePaths.push(blog);

      this.logger.log('📄 [5/9] Generating sitemap-pages.xml...');
      const pages = await this.staticService.generatePagesSitemap();
      if (pages) allFilePaths.push(pages);

      this.logger.log('🩺 [6/9] Generating sitemap-diagnostic.xml...');
      const diagnostic = await this.staticService.generateDiagnosticSitemap();
      if (diagnostic) allFilePaths.push(diagnostic);

      this.logger.log('📖 [7/9] Generating sitemap-reference.xml...');
      const reference = await this.staticService.generateReferenceSitemap();
      if (reference) allFilePaths.push(reference);

      // 2. Sitemaps par FAMILLE (19 familles)
      this.logger.log(
        `📦 [8/9] Generating ${PRODUCT_FAMILY_KEYS.length} family sitemaps...`,
      );

      for (let i = 0; i < PRODUCT_FAMILY_KEYS.length; i++) {
        const familyKey = PRODUCT_FAMILY_KEYS[i];
        this.logger.log(
          `   [${i + 1}/${PRODUCT_FAMILY_KEYS.length}] ${familyKey}...`,
        );

        const result = await this.piecesService.generateByFamily(familyKey);
        results.push(result);
        allFilePaths.push(...result.filePaths);
      }
    } catch (error) {
      this.logger.error(`❌ Fatal error during generation:`, error);
    }

    // Générer l'index principal avec TOUS les fichiers
    const indexPath =
      await this.xmlService.generateSitemapIndexFromPaths(allFilePaths);

    const totalDurationMs = Date.now() - startTime;
    const totalUrls = results.reduce((sum, r) => sum + r.urlCount, 0);
    const totalFiles = allFilePaths.length;

    // 🚀 P7.4 PERF: Clear caches after generation to free memory
    this.dataService.clearCaches();

    this.logger.log(`✅ V10 FAMILY generation complete:`);
    this.logger.log(`   Total URLs: ${totalUrls.toLocaleString()}`);
    this.logger.log(`   Total Files: ${totalFiles}`);
    this.logger.log(`   Duration: ${totalDurationMs}ms`);

    // 9. Crawl Hubs (non-bloquant)
    let hubResult: AllBucketsResult['hubResult'];
    this.logger.log('🔗 [9/9] Generating crawl hubs...');
    try {
      const hubs = await this.hubsService.generateAllHubsRobust();
      hubResult = {
        success: true,
        totalUrls: hubs.summary.totalUrls,
        totalFiles: hubs.summary.totalFiles,
      };
      this.logger.log(
        `   ✅ Hubs: ${hubs.summary.totalUrls.toLocaleString()} URLs in ${hubs.summary.totalFiles} files`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `⚠️ Hub generation failed (non-blocking): ${errorMessage}`,
      );
      hubResult = {
        success: false,
        totalUrls: 0,
        totalFiles: 0,
        error: errorMessage,
      };
    }

    return {
      success: results.every((r) => r.success),
      results,
      totalUrls,
      totalFiles,
      totalDurationMs,
      indexPath,
      hubResult,
    };
  }
}
