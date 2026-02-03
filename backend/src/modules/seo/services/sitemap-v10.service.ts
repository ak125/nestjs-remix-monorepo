/**
 * 🔥 SERVICE SITEMAP V10 UNIFIÉ - REMPLACEMENT COMPLET DE V9
 *
 * ✅ SERVICE UNIQUE (V9 supprimé):
 * - Source données: __sitemap_p_link (714k URLs)
 * - Filtres: thin content (map_has_item > 5), INDEX gammes (pg_relfollow='1')
 * - Features: température, scoring, crawl hubs
 *
 * Sitemaps générés (7 types comme V9):
 * 1. sitemap-racine.xml       - Homepage (1 URL)
 * 2. sitemap-categories.xml   - Gammes INDEX (~123 URLs)
 * 3. sitemap-vehicules.xml    - Marques+Modèles+Types (~13.8k URLs)
 * 4. sitemap-{bucket}-*.xml   - Pièces par température (~714k URLs)
 * 5. sitemap-blog.xml         - Articles blog (~109 URLs)
 * 6. sitemap-pages.xml        - Pages statiques (~9 URLs)
 * 7. sitemap.xml              - Index principal
 *
 * Architecture température-based:
 * - hot:    Pages prioritaires (score >= 70) → daily, priority 1.0
 * - stable: Pages normales → weekly, priority 0.6
 * - cold:   Pages basse priorité → monthly, priority 0.4
 *
 * Tables utilisées:
 * - __sitemap_p_link (714k+ URLs pièces) ← SOURCE PRINCIPALE
 * - pieces_gamme (filtre INDEX pg_relfollow='1')
 * - __sitemap_vehicules (vue véhicules fusionnés)
 * - __sitemap_blog (articles blog)
 * - __seo_generation_log (audit)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import { FAMILY_CLUSTERS } from './sitemap-v10-hubs.service';

// Types
export type TemperatureBucket = 'hot' | 'new' | 'stable' | 'cold';
export type EntityType =
  | 'gammes'
  | 'vehicules'
  | 'money'
  | 'guides'
  | 'filtres'
  | 'longtail';

export interface SitemapUrl {
  url: string;
  page_type: string;
  changefreq: string;
  priority: string;
  last_modified_at: string | null;
}

// Configuration des types d'entité par bucket
const BUCKET_ENTITY_TYPES: Record<TemperatureBucket, EntityType[]> = {
  hot: ['gammes', 'vehicules', 'money'],
  new: [], // Cas spécial: utilise date YYYY-MM-DD
  stable: ['gammes', 'vehicules', 'guides'],
  cold: ['filtres', 'longtail'],
};

// Mapping des types d'entité vers les page_type de __seo_page
const ENTITY_PAGE_TYPES: Record<EntityType, string[]> = {
  gammes: ['category', 'canonical'],
  vehicules: ['listing', 'hub'],
  money: ['product', 'landing'],
  guides: ['guide', 'blog'],
  filtres: ['filter'],
  longtail: ['longtail', 'variant'],
};

export interface GenerationResult {
  success: boolean;
  bucket: TemperatureBucket;
  urlCount: number;
  filesGenerated: number;
  durationMs: number;
  filePaths: string[];
  error?: string;
}

export interface AllBucketsResult {
  success: boolean;
  results: GenerationResult[];
  totalUrls: number;
  totalFiles: number;
  totalDurationMs: number;
  indexPath?: string;
}

// Configuration par température
const BUCKET_CONFIG: Record<
  TemperatureBucket,
  { changefreq: string; priority: string; maxAge: number }
> = {
  hot: { changefreq: 'daily', priority: '1.0', maxAge: 3600 }, // 1h cache
  new: { changefreq: 'daily', priority: '0.8', maxAge: 3600 },
  stable: { changefreq: 'weekly', priority: '0.6', maxAge: 86400 }, // 24h cache
  cold: { changefreq: 'monthly', priority: '0.4', maxAge: 604800 }, // 7d cache
};

// Pages statiques du site (de V9)
const STATIC_PAGES = [
  { loc: '/', priority: '1.0', changefreq: 'daily' },
  { loc: '/constructeurs', priority: '0.8', changefreq: 'weekly' },
  { loc: '/blog', priority: '0.7', changefreq: 'daily' },
  { loc: '/diagnostic-auto', priority: '0.8', changefreq: 'weekly' }, // R5 Index
  { loc: '/reference-auto', priority: '0.8', changefreq: 'weekly' }, // R4 Index
  { loc: '/cgv', priority: '0.3', changefreq: 'yearly' },
  { loc: '/mentions-legales', priority: '0.3', changefreq: 'yearly' },
  { loc: '/politique-confidentialite', priority: '0.3', changefreq: 'yearly' },
  { loc: '/contact', priority: '0.4', changefreq: 'yearly' },
  { loc: '/aide', priority: '0.4', changefreq: 'monthly' },
  { loc: '/faq', priority: '0.4', changefreq: 'monthly' },
];

// Fichiers obsolètes à supprimer (de V9)
const OBSOLETE_FILES = ['sitemap-constructeurs.xml', 'sitemap-types.xml'];

@Injectable()
export class SitemapV10Service extends SupabaseBaseService {
  protected override readonly logger = new Logger(SitemapV10Service.name);
  private readonly BASE_URL: string;
  private readonly OUTPUT_DIR: string;
  private readonly MAX_URLS_PER_FILE = 50000;

  constructor(configService: ConfigService, rpcGate: RpcGateService) {
    super(configService);
    this.rpcGate = rpcGate;

    this.BASE_URL =
      this.configService.get<string>('BASE_URL') ||
      'https://www.automecanik.com';
    this.OUTPUT_DIR =
      this.configService.get<string>('SITEMAP_OUTPUT_DIR') ||
      '/var/www/sitemaps';

    this.logger.log('🔥 SitemapV10Service initialized');
    this.logger.log(`   Base URL: ${this.BASE_URL}`);
    this.logger.log(`   Output: ${this.OUTPUT_DIR}`);
  }

  /**
   * 🚀 MÉTHODE PRINCIPALE - Génère TOUS les sitemaps (remplace V9)
   *
   * Génère automatiquement:
   * 1. Sitemaps statiques (racine, categories, vehicules, blog, pages)
   * 2. Sitemaps pièces par température (hot/stable/cold)
   * 3. Index principal
   */
  async generateAll(): Promise<AllBucketsResult> {
    const startTime = Date.now();
    this.logger.log(
      '🚀 Starting V10 UNIFIED sitemap generation (replaces V9)...',
    );

    // Reset cache
    this.indexPgIdsCache = null;

    const results: GenerationResult[] = [];
    const allFilePaths: string[] = [];

    // 🧹 Nettoyer les fichiers obsolètes
    await this.cleanupObsoleteFiles();

    try {
      // 1. Racine/Homepage (1 URL)
      this.logger.log('🏠 [1/6] Generating sitemap-racine.xml...');
      const racine = await this.generateRacineSitemap();
      if (racine) allFilePaths.push(racine);

      // 2. Catégories/Gammes INDEX
      this.logger.log('📂 [2/6] Generating sitemap-categories.xml...');
      const categories = await this.generateCategoriesSitemap();
      if (categories) allFilePaths.push(categories);

      // 3. Véhicules fusionné
      this.logger.log('🚗 [3/6] Generating sitemap-vehicules.xml...');
      const vehicules = await this.generateVehiculesSitemap();
      if (vehicules) allFilePaths.push(vehicules);

      // 4. Blog
      this.logger.log('📝 [4/6] Generating sitemap-blog.xml...');
      const blog = await this.generateBlogSitemap();
      if (blog) allFilePaths.push(blog);

      // 5. Pages statiques
      this.logger.log('📄 [5/8] Generating sitemap-pages.xml...');
      const pages = await this.generatePagesSitemap();
      if (pages) allFilePaths.push(pages);

      // 6. Diagnostic R5 (Observable Pro)
      this.logger.log('🩺 [6/8] Generating sitemap-diagnostic.xml...');
      const diagnostic = await this.generateDiagnosticSitemap();
      if (diagnostic) allFilePaths.push(diagnostic);

      // 7. Référence R4
      this.logger.log('📖 [7/8] Generating sitemap-reference.xml...');
      const reference = await this.generateReferenceSitemap();
      if (reference) allFilePaths.push(reference);

      // 8. Pièces par température (714k URLs via source V9)
      this.logger.log('📦 [8/8] Generating sitemap-{bucket}-pieces-*.xml...');
      const buckets: TemperatureBucket[] = ['hot', 'stable', 'cold'];

      for (const bucket of buckets) {
        const bucketStart = Date.now();
        const runId = crypto.randomUUID();

        try {
          const { urls } =
            await this.generatePiecesSitemapsFromV9Source(bucket);

          if (urls.length === 0) {
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

          // Sharding si nécessaire (>50k URLs)
          const filePaths: string[] = [];
          const numShards = Math.ceil(urls.length / this.MAX_URLS_PER_FILE);

          for (let shard = 0; shard < numShards; shard++) {
            const shardUrls = urls.slice(
              shard * this.MAX_URLS_PER_FILE,
              (shard + 1) * this.MAX_URLS_PER_FILE,
            );

            // Format simplifié: sitemap-pieces-*.xml à la racine (cohérent avec categories, vehicules)
            const fileName =
              numShards === 1
                ? `sitemap-pieces.xml`
                : `sitemap-pieces-${shard + 1}.xml`;

            const filePath = await this.writeSitemapFile(
              bucket,
              fileName,
              shardUrls,
              true, // writeToRoot: écrire à la racine pour cohérence avec autres sitemaps
            );
            filePaths.push(filePath);
            allFilePaths.push(filePath);
            this.logger.log(
              `   ✓ Generated ${fileName} (${shardUrls.length.toLocaleString()} URLs)`,
            );
          }

          const durationMs = Date.now() - bucketStart;
          await this.logGeneration(
            runId,
            bucket,
            'success',
            urls.length,
            filePaths.length,
            durationMs,
          );

          results.push({
            success: true,
            bucket,
            urlCount: urls.length,
            filesGenerated: filePaths.length,
            durationMs,
            filePaths,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`❌ Failed to generate ${bucket}: ${errorMessage}`);
          await this.logGeneration(
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
    const indexPath = await this.generateSitemapIndexFromPaths(allFilePaths);

    const totalDurationMs = Date.now() - startTime;
    const totalUrls = results.reduce((sum, r) => sum + r.urlCount, 0);
    const totalFiles = allFilePaths.length;

    this.logger.log(`✅ V10 UNIFIED generation complete:`);
    this.logger.log(`   Total URLs: ${totalUrls.toLocaleString()}`);
    this.logger.log(`   Total Files: ${totalFiles}`);
    this.logger.log(`   Duration: ${totalDurationMs}ms`);

    return {
      success: results.every((r) => r.success),
      results,
      totalUrls,
      totalFiles,
      totalDurationMs,
      indexPath,
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
        throw new Error(`Count error: ${countError.message}`);
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
        // Cas spécial pour 'new': fichier avec date YYYY-MM-DD
        const today = new Date().toISOString().split('T')[0];
        // 🛡️ RPC Safety Gate
        const { data: urls, error: urlsError } = await this.callRpc<
          SitemapUrl[]
        >(
          'get_sitemap_urls_by_temperature',
          {
            p_temperature: bucket,
            p_limit: this.MAX_URLS_PER_FILE,
            p_offset: 0,
          },
          { source: 'cron' },
        );

        if (urlsError) {
          throw new Error(`Fetch error: ${urlsError.message}`);
        }

        if ((urls as SitemapUrl[]).length > 0) {
          const fileName = `sitemap-new-${today}.xml`;
          const filePath = await this.writeSitemapFile(
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
        // Générer un fichier par type d'entité
        for (const entityType of entityTypes) {
          const entityUrls = await this.getUrlsByEntityType(bucket, entityType);
          if (entityUrls.length > 0) {
            const fileName = `sitemap-${bucket}-${entityType}.xml`;
            const filePath = await this.writeSitemapFile(
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
        // Fallback: ancien comportement par batch de 50k
        const numFiles = Math.ceil(totalUrls / this.MAX_URLS_PER_FILE);
        for (let i = 0; i < numFiles; i++) {
          const offset = i * this.MAX_URLS_PER_FILE;
          // 🛡️ RPC Safety Gate
          const { data: urls, error: urlsError } = await this.callRpc<
            SitemapUrl[]
          >(
            'get_sitemap_urls_by_temperature',
            {
              p_temperature: bucket,
              p_limit: this.MAX_URLS_PER_FILE,
              p_offset: offset,
            },
            { source: 'cron' },
          );

          if (urlsError) {
            throw new Error(`Fetch error: ${urlsError.message}`);
          }

          const fileName =
            numFiles === 1
              ? `sitemap-${bucket}.xml`
              : `sitemap-${bucket}-${i + 1}.xml`;
          const filePath = await this.writeSitemapFile(
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

      // 3. Logger la génération
      await this.logGeneration(
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
      await this.logGeneration(
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
   * Écrit un fichier sitemap XML
   * @param bucket - Le bucket de température (pour la config changefreq/priority)
   * @param fileName - Le nom du fichier
   * @param urls - Les URLs à inclure
   * @param writeToRoot - Si true, écrit à la racine de OUTPUT_DIR au lieu du sous-répertoire bucket
   */
  private async writeSitemapFile(
    bucket: TemperatureBucket,
    fileName: string,
    urls: SitemapUrl[],
    writeToRoot: boolean = false,
  ): Promise<string> {
    const config = BUCKET_CONFIG[bucket];
    // Si writeToRoot, écrire directement à OUTPUT_DIR, sinon dans le sous-répertoire bucket
    const dirPath = writeToRoot
      ? this.OUTPUT_DIR
      : path.join(this.OUTPUT_DIR, bucket);
    const filePath = path.join(dirPath, fileName);

    // Créer le répertoire si nécessaire
    await fs.mkdir(dirPath, { recursive: true });

    // Construire le XML
    const urlEntries = urls
      .map((u) => {
        const loc = u.url.startsWith('http')
          ? u.url
          : `${this.BASE_URL}${u.url}`;
        const lastmod = u.last_modified_at
          ? new Date(u.last_modified_at).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        return `  <url>
    <loc>${this.xmlEscape(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${u.changefreq || config.changefreq}</changefreq>
    <priority>${u.priority || config.priority}</priority>
  </url>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

    await fs.writeFile(filePath, xml, 'utf8');
    return filePath;
  }

  /**
   * Récupère les URLs par type d'entité pour un bucket donné
   * Utilise la table de scoring pour filtrer par température
   */
  private async getUrlsByEntityType(
    bucket: TemperatureBucket,
    entityType: EntityType,
  ): Promise<SitemapUrl[]> {
    const pageTypes = ENTITY_PAGE_TYPES[entityType];
    const config = BUCKET_CONFIG[bucket];

    // 1. Récupérer les URLs avec le bon bucket depuis __seo_entity_score_v10
    const { data: scoredUrls, error: scoreError } = await this.supabase
      .from('__seo_entity_score_v10')
      .select('url')
      .eq('bucket', bucket)
      .limit(this.MAX_URLS_PER_FILE * 2); // Marge pour filtrage page_type

    if (scoreError) {
      this.logger.warn(
        `Score fetch failed for ${bucket}: ${scoreError.message}`,
      );
      return [];
    }

    if (!scoredUrls || scoredUrls.length === 0) {
      return [];
    }

    const urlList = scoredUrls.map((s) => s.url);

    // 2. Récupérer les détails des pages correspondant aux types d'entité
    const { data, error } = await this.supabase
      .from('__seo_page')
      .select('url, page_type, last_modified_at')
      .in('url', urlList)
      .in('page_type', pageTypes)
      .eq('is_indexable_hint', true)
      .limit(this.MAX_URLS_PER_FILE);

    if (error) {
      throw new Error(`Entity type fetch error: ${error.message}`);
    }

    return (data || []).map((row) => ({
      url: row.url,
      page_type: row.page_type,
      changefreq: config.changefreq,
      priority: config.priority,
      last_modified_at: row.last_modified_at,
    }));
  }

  /**
   * Génère l'index principal des sitemaps
   */
  private async generateSitemapIndex(
    results: GenerationResult[],
  ): Promise<string> {
    const indexPath = path.join(this.OUTPUT_DIR, 'sitemap.xml');
    const today = new Date().toISOString().split('T')[0];

    const sitemapEntries = results
      .flatMap((r) =>
        r.filePaths.map((fp) => {
          // Extraire le chemin relatif sans le slash initial
          const relativePath = fp
            .replace(this.OUTPUT_DIR, '')
            .replace(/^\//, '');
          // Fichiers à la racine (sans /) → URL directe, sinon préfixer avec /sitemaps/
          const sitemapUrl = relativePath.includes('/')
            ? `${this.BASE_URL}/sitemaps/${relativePath}`
            : `${this.BASE_URL}/${relativePath}`;
          return `  <sitemap>
    <loc>${sitemapUrl}</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
        }),
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`;

    await fs.writeFile(indexPath, xml, 'utf8');
    this.logger.log(`   ✓ Generated sitemap index: ${indexPath}`);
    return indexPath;
  }

  /**
   * Logger une génération dans __seo_generation_log
   */
  private async logGeneration(
    runId: string,
    bucket: TemperatureBucket,
    status: 'success' | 'failed',
    urlsTotal: number,
    filesGenerated: number,
    durationMs: number,
    error?: string,
  ): Promise<void> {
    try {
      await this.supabase.from('__seo_generation_log').insert({
        run_id: runId,
        generation_type: 'sitemap',
        bucket,
        status,
        urls_total: urlsTotal,
        files_generated: filesGenerated,
        duration_ms: durationMs,
        error_message: error || null,
        completed_at: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.warn(`Failed to log generation: ${err}`);
    }
  }

  /**
   * Escape XML entities
   */
  private xmlEscape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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
    // L'index principal est à /sitemap.xml (racine)
    // Les sitemaps de bucket (si utilisés) seraient dans /sitemaps/${bucket}/
    const sitemapUrl = bucket
      ? `${this.BASE_URL}/sitemaps/${bucket}/sitemap-${bucket}.xml`
      : `${this.BASE_URL}/sitemap.xml`;

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

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔥 MÉTHODES FUSION V9 - Source __sitemap_p_link avec filtres V9
  // ═══════════════════════════════════════════════════════════════════════════

  // Cache des pg_id INDEX (évite double requête DB)
  private indexPgIdsCache: Set<string> | null = null;

  // Cache global pour déduplication inter-familles
  private processedUrlsCache: Set<string> | null = null;

  /**
   * 🎯 Récupère les pg_id des gammes INDEX (avec cache) - LOGIQUE V9
   */
  private async getIndexGammeIds(): Promise<Set<string>> {
    if (this.indexPgIdsCache) {
      return this.indexPgIdsCache;
    }

    const { data: indexGammes, error } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id')
      .eq('pg_display', '1')
      .eq('pg_relfollow', '1'); // INDEX = dans sitemap

    if (error) {
      this.logger.error(`❌ Error fetching INDEX gammes: ${error.message}`);
      return new Set();
    }

    this.indexPgIdsCache = new Set(
      (indexGammes || []).map((g) => String(g.pg_id)),
    );
    this.logger.log(`  🎯 ${this.indexPgIdsCache.size} gammes INDEX en cache`);

    return this.indexPgIdsCache;
  }

  /**
   * 📄 Récupère des données avec pagination - LOGIQUE V9
   * Contourne la limite Supabase de 1000 lignes
   */
  private async fetchWithPagination<T>(
    table: string,
    columns: string,
    totalLimit: number,
    startOffset = 0,
    filter?: {
      column: string;
      operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
      value: number | string;
    },
  ): Promise<T[]> {
    const PAGE_SIZE = 1000;
    const allData: T[] = [];
    let currentOffset = startOffset;
    let fetchedCount = 0;

    while (fetchedCount < totalLimit) {
      const remaining = totalLimit - fetchedCount;
      const batchSize = Math.min(PAGE_SIZE, remaining);

      let query = this.supabase.from(table).select(columns);

      if (filter) {
        switch (filter.operator) {
          case 'gt':
            query = query.gt(filter.column, filter.value);
            break;
          case 'gte':
            query = query.gte(filter.column, filter.value);
            break;
          case 'lt':
            query = query.lt(filter.column, filter.value);
            break;
          case 'lte':
            query = query.lte(filter.column, filter.value);
            break;
          case 'eq':
            query = query.eq(filter.column, filter.value);
            break;
          case 'neq':
            query = query.neq(filter.column, filter.value);
            break;
        }
      }

      const { data, error } = await query.range(
        currentOffset,
        currentOffset + batchSize - 1,
      );

      if (error) {
        this.logger.error(
          `❌ Pagination error on ${table} at offset ${currentOffset}: ${error.message}`,
        );
        break;
      }

      if (!data || data.length === 0) {
        break;
      }

      allData.push(...(data as T[]));
      fetchedCount += data.length;
      currentOffset += data.length;

      if (data.length < batchSize) {
        break;
      }
    }

    return allData;
  }

  /**
   * 📦 Génère les sitemaps pièces avec source V9 (__sitemap_p_link)
   * ⚠️ CORRIGÉ: Pagination COMPLÈTE sans limite (comme cluster hubs)
   * Combine: filtres V9 (thin content, INDEX) + température V10
   */
  async generatePiecesSitemapsFromV9Source(
    bucket: TemperatureBucket,
  ): Promise<{ urls: SitemapUrl[]; totalCount: number }> {
    // Seul le bucket 'stable' génère les URLs pour éviter les doublons
    // hot et cold retournent vide (pas de scoring température implémenté)
    if (bucket !== 'stable') {
      this.logger.log(`⏭️ Skipping ${bucket} bucket (all URLs go to stable)`);
      return { urls: [], totalCount: 0 };
    }

    this.logger.log(
      `📦 Fetching ALL pieces from V9 source (pagination complète)...`,
    );

    // 1. Récupérer les gammes INDEX
    const indexPgIds = await this.getIndexGammeIds();
    if (indexPgIds.size === 0) {
      this.logger.warn('⚠️ Aucune gamme INDEX trouvée');
      return { urls: [], totalCount: 0 };
    }

    // Type pour les pièces V9
    interface PieceV9 {
      map_pg_alias: string;
      map_pg_id: string;
      map_marque_alias: string;
      map_marque_id: string;
      map_modele_alias: string;
      map_modele_id: string;
      map_type_alias: string;
      map_type_id: string;
    }

    // 2. Pagination COMPLÈTE - récupérer TOUTES les URLs INDEX
    const PAGE_SIZE = 1000;
    const allPieces: PieceV9[] = [];
    let offset = 0;
    let hasMore = true;
    const pgIdsArray = Array.from(indexPgIds);

    this.logger.log(
      `  🎯 Fetching pieces for ${pgIdsArray.length} gammes INDEX...`,
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
        allPieces.push(...(pieces as PieceV9[]));
        offset += PAGE_SIZE;
        hasMore = pieces.length === PAGE_SIZE;

        // Log progress every 50k URLs
        if (allPieces.length % 50000 < PAGE_SIZE) {
          this.logger.log(
            `  📊 Progress: ${allPieces.length.toLocaleString()} URLs fetched...`,
          );
        }
      } else {
        hasMore = false;
      }
    }

    if (allPieces.length === 0) {
      this.logger.warn('⚠️ No pieces found');
      return { urls: [], totalCount: 0 };
    }

    // 3. Construire les URLs avec config température
    const config = BUCKET_CONFIG[bucket];
    const urls: SitemapUrl[] = allPieces.map((p) => ({
      url: `/pieces/${p.map_pg_alias}-${p.map_pg_id}/${p.map_marque_alias}-${p.map_marque_id}/${p.map_modele_alias}-${p.map_modele_id}/${p.map_type_alias}-${p.map_type_id}.html`,
      page_type: 'piece',
      changefreq: config.changefreq,
      priority: config.priority,
      last_modified_at: null,
    }));

    this.logger.log(
      `  ✅ ${urls.length.toLocaleString()} URLs pièces INDEX (pagination complète)`,
    );

    return { urls, totalCount: urls.length };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 📄 SITEMAPS STATIQUES (de V9)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 🏠 Génère sitemap-racine.xml (Homepage uniquement)
   */
  private async generateRacineSitemap(): Promise<string | null> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const urls: SitemapUrl[] = [
        {
          url: '/',
          page_type: 'homepage',
          changefreq: 'daily',
          priority: '1.0',
          last_modified_at: today,
        },
      ];

      const filePath = path.join(this.OUTPUT_DIR, 'sitemap-racine.xml');
      await this.writeStaticSitemapFile(filePath, urls);
      this.logger.log(`   ✅ sitemap-racine.xml: 1 URL`);
      return filePath;
    } catch (error) {
      this.logger.error(`❌ Failed to generate racine sitemap: ${error}`);
      return null;
    }
  }

  /**
   * 📂 Génère sitemap-categories.xml (Gammes INDEX)
   */
  private async generateCategoriesSitemap(): Promise<string | null> {
    try {
      const { data: gammes, error } = await this.supabase
        .from('pieces_gamme')
        .select('pg_alias, pg_id')
        .eq('pg_display', '1')
        .eq('pg_relfollow', '1')
        .neq('pg_alias', '')
        .order('pg_alias');

      if (error) {
        this.logger.error(`❌ Error fetching categories: ${error.message}`);
        return null;
      }

      if (!gammes || gammes.length === 0) {
        this.logger.warn('⚠️ No categories found');
        return null;
      }

      const urls: SitemapUrl[] = gammes.map((g) => ({
        url: `/pieces/${g.pg_alias}-${g.pg_id}.html`,
        page_type: 'category',
        changefreq: 'weekly',
        priority: '0.8',
        last_modified_at: null,
      }));

      const filePath = path.join(this.OUTPUT_DIR, 'sitemap-categories.xml');
      await this.writeStaticSitemapFile(filePath, urls);
      this.logger.log(`   ✅ sitemap-categories.xml: ${urls.length} URLs`);
      return filePath;
    } catch (error) {
      this.logger.error(`❌ Failed to generate categories sitemap: ${error}`);
      return null;
    }
  }

  /**
   * 🚗 Génère sitemap-vehicules.xml (marques + modèles + motorisations)
   */
  private async generateVehiculesSitemap(): Promise<string | null> {
    try {
      interface VehiculeType {
        niveau: number;
        url: string;
        priority: number;
        changefreq: string;
      }

      // Compter le total
      const { count, error: countError } = await this.supabase
        .from('__sitemap_vehicules')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        this.logger.error(`❌ Error counting vehicules: ${countError.message}`);
        return null;
      }

      const totalCount = count || 0;
      if (totalCount === 0) {
        this.logger.warn('⚠️ No vehicules found');
        return null;
      }

      // Récupérer avec pagination
      const vehicules = await this.fetchWithPagination<VehiculeType>(
        '__sitemap_vehicules',
        'niveau, url, priority, changefreq',
        totalCount,
      );

      if (!vehicules || vehicules.length === 0) {
        return null;
      }

      const urls: SitemapUrl[] = vehicules.map((v) => ({
        url: v.url,
        page_type: 'vehicule',
        changefreq: v.changefreq || 'monthly',
        priority: v.priority.toString(),
        last_modified_at: null,
      }));

      const filePath = path.join(this.OUTPUT_DIR, 'sitemap-vehicules.xml');
      await this.writeStaticSitemapFile(filePath, urls);
      this.logger.log(`   ✅ sitemap-vehicules.xml: ${urls.length} URLs`);
      return filePath;
    } catch (error) {
      this.logger.error(`❌ Failed to generate vehicules sitemap: ${error}`);
      return null;
    }
  }

  /**
   * 🚗 Génère sitemaps véhicules par marque
   * Output: vehicules/sitemap-{brand}.xml
   * ~30 marques, 100-1400 URLs chacune
   */
  async generateVehiculesByBrand(): Promise<{
    success: boolean;
    filePaths: string[];
    totalUrls: number;
    brandCount: number;
  }> {
    const startTime = Date.now();
    this.logger.log('🚗 Starting vehicle sitemaps by brand generation...');

    const filePaths: string[] = [];
    let totalUrls = 0;

    try {
      interface VehiculeType {
        niveau: number;
        url: string;
        priority: number;
        changefreq: string;
      }

      // Récupérer tous les véhicules
      const { count, error: countError } = await this.supabase
        .from('__sitemap_vehicules')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        this.logger.error(`❌ Error counting vehicules: ${countError.message}`);
        return { success: false, filePaths: [], totalUrls: 0, brandCount: 0 };
      }

      const totalCount = count || 0;
      if (totalCount === 0) {
        this.logger.warn('⚠️ No vehicules found');
        return { success: false, filePaths: [], totalUrls: 0, brandCount: 0 };
      }

      const vehicules = await this.fetchWithPagination<VehiculeType>(
        '__sitemap_vehicules',
        'niveau, url, priority, changefreq',
        totalCount,
      );

      if (!vehicules || vehicules.length === 0) {
        return { success: false, filePaths: [], totalUrls: 0, brandCount: 0 };
      }

      // Grouper par marque (extraire de l'URL: /constructeurs/{brand}-{id}/...)
      const brandMap = new Map<string, VehiculeType[]>();

      for (const v of vehicules) {
        // Extraire la marque depuis l'URL: /constructeurs/mercedes-benz-4/...
        const match = v.url.match(/\/constructeurs\/([a-z0-9-]+?)-\d+/i);
        const brand = match ? match[1].toLowerCase() : 'autres';

        if (!brandMap.has(brand)) {
          brandMap.set(brand, []);
        }
        brandMap.get(brand)!.push(v);
      }

      // Créer le répertoire vehicules/
      const vehiculesDir = path.join(this.OUTPUT_DIR, 'vehicules');
      await fs.mkdir(vehiculesDir, { recursive: true });

      // Générer un sitemap par marque
      const brands = Array.from(brandMap.keys()).sort();
      this.logger.log(`   Found ${brands.length} brands to process...`);

      for (const brand of brands) {
        const brandVehicules = brandMap.get(brand)!;
        const urls: SitemapUrl[] = brandVehicules.map((v) => ({
          url: v.url,
          page_type: 'vehicule',
          changefreq: v.changefreq || 'monthly',
          priority: v.priority.toString(),
          last_modified_at: null,
        }));

        const filePath = path.join(vehiculesDir, `sitemap-${brand}.xml`);
        await this.writeStaticSitemapFile(filePath, urls);
        filePaths.push(filePath);
        totalUrls += urls.length;

        this.logger.log(
          `   ✅ vehicules/sitemap-${brand}.xml: ${urls.length} URLs`,
        );
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Vehicle by brand generation complete: ${totalUrls} URLs in ${brands.length} files (${duration}ms)`,
      );

      return {
        success: true,
        filePaths,
        totalUrls,
        brandCount: brands.length,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to generate vehicules by brand: ${error}`);
      return { success: false, filePaths: [], totalUrls: 0, brandCount: 0 };
    }
  }

  /**
   * 📝 Génère sitemap-blog.xml
   */
  private async generateBlogSitemap(): Promise<string | null> {
    try {
      const { data: articles, error } = await this.supabase
        .from('__sitemap_blog')
        .select('map_alias, map_date')
        .order('map_date', { ascending: false });

      if (error) {
        this.logger.error(`❌ Error fetching blog: ${error.message}`);
        return null;
      }

      if (!articles || articles.length === 0) {
        this.logger.warn('⚠️ No blog articles found');
        return null;
      }

      const urls: SitemapUrl[] = articles.map((a) => ({
        url: `/blog-pieces-auto/${a.map_alias}`,
        page_type: 'blog',
        changefreq: 'monthly',
        priority: '0.6',
        last_modified_at: a.map_date || null,
      }));

      const filePath = path.join(this.OUTPUT_DIR, 'sitemap-blog.xml');
      await this.writeStaticSitemapFile(filePath, urls);
      this.logger.log(`   ✅ sitemap-blog.xml: ${urls.length} URLs`);
      return filePath;
    } catch (error) {
      this.logger.error(`❌ Failed to generate blog sitemap: ${error}`);
      return null;
    }
  }

  /**
   * 📄 Génère sitemap-pages.xml (pages statiques)
   */
  private async generatePagesSitemap(): Promise<string | null> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const urls: SitemapUrl[] = STATIC_PAGES.map((p) => ({
        url: p.loc,
        page_type: 'static',
        changefreq: p.changefreq,
        priority: p.priority,
        last_modified_at: today,
      }));

      const filePath = path.join(this.OUTPUT_DIR, 'sitemap-pages.xml');
      await this.writeStaticSitemapFile(filePath, urls);
      this.logger.log(`   ✅ sitemap-pages.xml: ${urls.length} URLs`);
      return filePath;
    } catch (error) {
      this.logger.error(`❌ Failed to generate pages sitemap: ${error}`);
      return null;
    }
  }

  /**
   * 🩺 Génère sitemap-diagnostic.xml (pages R5 Observable Pro)
   * Source: table __seo_observable via RPC get_all_seo_observables_for_sitemap
   *
   * Priorités basées sur risk_level:
   * - critique: 0.9 (urgence sécurité)
   * - securite: 0.8 (impact sécurité)
   * - confort: 0.7 (impact confort)
   */
  private async generateDiagnosticSitemap(): Promise<string | null> {
    try {
      // Appeler la RPC function créée dans la migration
      // 🛡️ RPC Safety Gate
      const { data: diagnostics, error } = await this.callRpc<any[]>(
        'get_all_seo_observables_for_sitemap',
        {},
        { source: 'cron' },
      );

      if (error) {
        this.logger.error(
          `❌ Error fetching diagnostics for sitemap: ${error.message}`,
        );
        return null;
      }

      if (!diagnostics || diagnostics.length === 0) {
        this.logger.warn('⚠️ No diagnostic pages found for sitemap');
        return null;
      }

      // Mapper vers SitemapUrl avec priorité basée sur risk_level
      const urls: SitemapUrl[] = diagnostics.map(
        (d: {
          slug: string;
          updated_at: string;
          risk_level: string;
          safety_gate: string;
        }) => {
          // Priorité: critique > securite > confort
          let priority = '0.7';
          if (d.risk_level === 'critique') {
            priority = '0.9';
          } else if (d.risk_level === 'securite') {
            priority = '0.8';
          }

          // Pages avec safety_gate stop_immediate = urgence maximale
          if (d.safety_gate === 'stop_immediate') {
            priority = '1.0';
          }

          return {
            url: `/diagnostic-auto/${d.slug}`,
            page_type: 'diagnostic',
            changefreq: 'weekly',
            priority,
            last_modified_at: d.updated_at,
          };
        },
      );

      const filePath = path.join(this.OUTPUT_DIR, 'sitemap-diagnostic.xml');
      await this.writeStaticSitemapFile(filePath, urls);
      this.logger.log(`   ✅ sitemap-diagnostic.xml: ${urls.length} URLs (R5)`);
      return filePath;
    } catch (error) {
      this.logger.error(`❌ Failed to generate diagnostic sitemap: ${error}`);
      return null;
    }
  }

  /**
   * 📖 Génère sitemap-reference.xml (pages R4 Référence)
   * Source: table __seo_reference
   *
   * Priorité fixe 0.8 (pages canoniques de référence)
   */
  private async generateReferenceSitemap(): Promise<string | null> {
    try {
      const { data: references, error } = await this.supabase
        .from('__seo_reference')
        .select('slug, updated_at')
        .eq('is_published', true)
        .order('updated_at', { ascending: false });

      if (error) {
        this.logger.error(
          `❌ Error fetching references for sitemap: ${error.message}`,
        );
        return null;
      }

      if (!references || references.length === 0) {
        this.logger.warn('⚠️ No reference pages found for sitemap');
        return null;
      }

      const urls: SitemapUrl[] = references.map(
        (r: { slug: string; updated_at: string }) => ({
          url: `/reference-auto/${r.slug}`,
          page_type: 'reference',
          changefreq: 'monthly', // Contenu canonique stable
          priority: '0.8',
          last_modified_at: r.updated_at,
        }),
      );

      const filePath = path.join(this.OUTPUT_DIR, 'sitemap-reference.xml');
      await this.writeStaticSitemapFile(filePath, urls);
      this.logger.log(`   ✅ sitemap-reference.xml: ${urls.length} URLs (R4)`);
      return filePath;
    } catch (error) {
      this.logger.error(`❌ Failed to generate reference sitemap: ${error}`);
      return null;
    }
  }

  /**
   * 🧹 Supprime les fichiers sitemap obsolètes
   */
  private async cleanupObsoleteFiles(): Promise<void> {
    for (const filename of OBSOLETE_FILES) {
      const filePath = path.join(this.OUTPUT_DIR, filename);
      try {
        await fs.access(filePath);
        await fs.unlink(filePath);
        this.logger.log(`🗑️ Deleted obsolete file: ${filename}`);
      } catch {
        // File doesn't exist, ignore
      }
    }
  }

  /**
   * Écrit un fichier sitemap statique (non-temperature)
   */
  private async writeStaticSitemapFile(
    filePath: string,
    urls: SitemapUrl[],
  ): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const urlEntries = urls
      .map((u) => {
        const loc = u.url.startsWith('http')
          ? u.url
          : `${this.BASE_URL}${u.url}`;
        const lastmod = u.last_modified_at
          ? new Date(u.last_modified_at).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        return `  <url>
    <loc>${this.xmlEscape(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

    await fs.writeFile(filePath, xml, 'utf8');
  }

  /**
   * Génère l'index principal à partir d'une liste de chemins
   */
  private async generateSitemapIndexFromPaths(
    filePaths: string[],
  ): Promise<string> {
    const indexPath = path.join(this.OUTPUT_DIR, 'sitemap.xml');
    const today = new Date().toISOString().split('T')[0];

    const sitemapEntries = filePaths
      .map((fp) => {
        // Extraire le nom relatif du fichier
        const relativePath = fp.replace(this.OUTPUT_DIR, '').replace(/^\//, '');
        const sitemapUrl = relativePath.includes('/')
          ? `${this.BASE_URL}/sitemaps/${relativePath}`
          : `${this.BASE_URL}/${relativePath}`;

        return `  <sitemap>
    <loc>${sitemapUrl}</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`;

    await fs.writeFile(indexPath, xml, 'utf8');
    this.logger.log(`   ✓ Generated sitemap index: ${indexPath}`);
    return indexPath;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔥 GÉNÉRATION PAR FAMILLE THÉMATIQUE (18 familles)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Liste des clés de familles produits (exclut les hubs transversaux)
   */
  private readonly PRODUCT_FAMILY_KEYS = [
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

  /**
   * 🔥 Génère le sitemap XML pour une famille thématique
   * @param familyKey Clé de la famille (ex: 'freinage', 'filtres')
   */
  async generateByFamily(familyKey: string): Promise<GenerationResult> {
    const startTime = Date.now();
    const _runId = crypto.randomUUID(); // Reserved for future logging

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
        .eq('pg_relfollow', '1'); // INDEX uniquement

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
      interface PieceV9 {
        map_pg_alias: string;
        map_pg_id: string;
        map_marque_alias: string;
        map_marque_id: string;
        map_modele_alias: string;
        map_modele_id: string;
        map_type_alias: string;
        map_type_id: string;
      }

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
          .gt('map_has_item', 5) // Filtre thin content
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

      // 4.5 Dédupliquer inter-familles (éviter qu'une URL apparaisse dans plusieurs sitemaps)
      let uniqueUrls = urls;
      if (this.processedUrlsCache) {
        const beforeCount = urls.length;
        uniqueUrls = urls.filter((u) => {
          if (this.processedUrlsCache!.has(u.url)) {
            return false; // URL déjà traitée dans famille précédente
          }
          this.processedUrlsCache!.add(u.url);
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
      const numShards = Math.ceil(uniqueUrls.length / this.MAX_URLS_PER_FILE);

      for (let shard = 0; shard < numShards; shard++) {
        const shardUrls = uniqueUrls.slice(
          shard * this.MAX_URLS_PER_FILE,
          (shard + 1) * this.MAX_URLS_PER_FILE,
        );

        const fileName =
          numShards === 1
            ? `sitemap-${familyKey}.xml`
            : `sitemap-${familyKey}-${shard + 1}.xml`;

        const filePath = await this.writeFamilySitemapFile(
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
        bucket: 'stable' as TemperatureBucket, // Pour compatibilité avec le type existant
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

  /**
   * Écrit un fichier sitemap pour une famille thématique
   */
  private async writeFamilySitemapFile(
    familyKey: string,
    fileName: string,
    urls: SitemapUrl[],
  ): Promise<string> {
    const dirPath = path.join(this.OUTPUT_DIR, 'familles');
    const filePath = path.join(dirPath, fileName);

    // Créer le répertoire si nécessaire
    await fs.mkdir(dirPath, { recursive: true });

    // Construire le XML
    const urlEntries = urls
      .map((u) => {
        const loc = u.url.startsWith('http')
          ? u.url
          : `${this.BASE_URL}${u.url}`;
        const lastmod = u.last_modified_at
          ? new Date(u.last_modified_at).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        return `  <url>
    <loc>${this.xmlEscape(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${u.changefreq || 'weekly'}</changefreq>
    <priority>${u.priority || '0.6'}</priority>
  </url>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

    await fs.writeFile(filePath, xml, 'utf8');
    return filePath;
  }

  /**
   * 🚀 Génère TOUS les sitemaps par famille thématique
   * Remplace la génération par température
   */
  async generateAllByFamily(): Promise<AllBucketsResult> {
    const startTime = Date.now();
    this.logger.log('🚀 Starting V10 FAMILY-BASED sitemap generation...');

    // Reset caches
    this.indexPgIdsCache = null;
    this.processedUrlsCache = new Set<string>(); // Déduplication inter-familles

    const results: GenerationResult[] = [];
    const allFilePaths: string[] = [];

    // 🧹 Nettoyer les fichiers obsolètes
    await this.cleanupObsoleteFiles();

    try {
      // 1. Sitemaps statiques (comme avant)
      this.logger.log('🏠 [1/8] Generating sitemap-racine.xml...');
      const racine = await this.generateRacineSitemap();
      if (racine) allFilePaths.push(racine);

      this.logger.log('📂 [2/8] Generating sitemap-categories.xml...');
      const categories = await this.generateCategoriesSitemap();
      if (categories) allFilePaths.push(categories);

      this.logger.log('🚗 [3/8] Generating vehicules by brand (~30 files)...');
      const vehiculesResult = await this.generateVehiculesByBrand();
      if (vehiculesResult.success) {
        allFilePaths.push(...vehiculesResult.filePaths);
        this.logger.log(
          `   ✅ ${vehiculesResult.brandCount} brand sitemaps: ${vehiculesResult.totalUrls} URLs`,
        );
      }

      this.logger.log('📝 [4/8] Generating sitemap-blog.xml...');
      const blog = await this.generateBlogSitemap();
      if (blog) allFilePaths.push(blog);

      this.logger.log('📄 [5/8] Generating sitemap-pages.xml...');
      const pages = await this.generatePagesSitemap();
      if (pages) allFilePaths.push(pages);

      this.logger.log('🩺 [6/8] Generating sitemap-diagnostic.xml...');
      const diagnostic = await this.generateDiagnosticSitemap();
      if (diagnostic) allFilePaths.push(diagnostic);

      this.logger.log('📖 [7/8] Generating sitemap-reference.xml...');
      const reference = await this.generateReferenceSitemap();
      if (reference) allFilePaths.push(reference);

      // 2. Sitemaps par FAMILLE (19 familles)
      this.logger.log(
        `📦 [8/8] Generating ${this.PRODUCT_FAMILY_KEYS.length} family sitemaps...`,
      );

      for (let i = 0; i < this.PRODUCT_FAMILY_KEYS.length; i++) {
        const familyKey = this.PRODUCT_FAMILY_KEYS[i];
        this.logger.log(
          `   [${i + 1}/${this.PRODUCT_FAMILY_KEYS.length}] ${familyKey}...`,
        );

        const result = await this.generateByFamily(familyKey);
        results.push(result);
        allFilePaths.push(...result.filePaths);
      }
    } catch (error) {
      this.logger.error(`❌ Fatal error during generation:`, error);
    }

    // Générer l'index principal avec TOUS les fichiers
    const indexPath = await this.generateSitemapIndexFromPaths(allFilePaths);

    const totalDurationMs = Date.now() - startTime;
    const totalUrls = results.reduce((sum, r) => sum + r.urlCount, 0);
    const totalFiles = allFilePaths.length;

    this.logger.log(`✅ V10 FAMILY generation complete:`);
    this.logger.log(`   Total URLs: ${totalUrls.toLocaleString()}`);
    this.logger.log(`   Total Files: ${totalFiles}`);
    this.logger.log(`   Duration: ${totalDurationMs}ms`);

    return {
      success: results.every((r) => r.success),
      results,
      totalUrls,
      totalFiles,
      totalDurationMs,
      indexPath,
    };
  }
}
