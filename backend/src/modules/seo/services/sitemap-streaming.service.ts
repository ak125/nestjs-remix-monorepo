/**
 * 🗜️ SERVICE DE STREAMING SITEMAP (GROS VOLUMES)
 * Génération de sitemaps compressés (.xml.gz) pour millions d'URLs
 *
 * Architecture:
 * 1. Écrire shards .xml.gz sur disque (plus sûr que streaming HTTP)
 * 2. Générer index sitemap après les shards
 * 3. Exposer en téléchargement statique via Caddy (/public/sitemaps/)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { createHash } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  StreamingConfig,
  ShardGenerationResult,
  IndexGenerationResult,
  StreamingGenerationResult,
  GenerationOptions,
  DownloadInfo,
} from '../interfaces/sitemap-streaming.interface';
import { SitemapEntry } from '../interfaces/sitemap-config.interface';

/**
 * Résultat de génération de sitemaps statiques
 */
export interface StaticSitemapResult {
  success: boolean;
  files: {
    name: string;
    path: string;
    urlCount: number;
    size: number;
  }[];
  totalUrls: number;
  duration: number;
  errors?: string[];
}

@Injectable()
export class SitemapStreamingService {
  private readonly logger = new Logger(SitemapStreamingService.name);
  private readonly config: StreamingConfig;
  private readonly supabase: SupabaseClient;
  private readonly BASE_URL = 'https://www.automecanik.com';

  constructor(private configService: ConfigService) {
    this.config = {
      enableGzip: true,
      compressionLevel: 9, // Maximum compression
      outputDirectory: path.join(process.cwd(), 'public', 'sitemaps'),
      shardSize: 50000, // 50k URLs par shard (limite Google)
      autoGenerateIndex: true,
      publicBaseUrl: 'https://www.automecanik.com/public/sitemaps',
      cleanupBeforeGeneration: false,
    };

    // Initialiser le client Supabase
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn('⚠️ Supabase credentials not configured - static sitemap generation disabled');
    }

    this.supabase = createClient(supabaseUrl || '', supabaseKey || '');

    this.ensureOutputDirectory();
    this.logger.log('🗜️ SitemapStreamingService initialized');
    this.logger.log(`📁 Output directory: ${this.config.outputDirectory}`);
    this.logger.log(`📦 Shard size: ${this.config.shardSize} URLs`);
  }

  /**
   * Créer le répertoire de sortie si nécessaire
   */
  private ensureOutputDirectory() {
    if (!fs.existsSync(this.config.outputDirectory)) {
      fs.mkdirSync(this.config.outputDirectory, { recursive: true });
      this.logger.log(
        `✅ Created output directory: ${this.config.outputDirectory}`,
      );
    }
  }

  /**
   * Générer tous les sitemaps avec streaming
   */
  async generateAll(
    options: Partial<GenerationOptions> = {},
  ): Promise<StreamingGenerationResult> {
    const startTime = new Date();
    this.logger.log('🚀 Starting streaming sitemap generation...');

    const opts: GenerationOptions = {
      sitemapType: 'all',
      forceRegeneration: false,
      includeHreflang: true,
      includeImages: true,
      dryRun: false,
      ...options,
    };

    // Nettoyer les anciens fichiers si demandé
    if (this.config.cleanupBeforeGeneration && !opts.dryRun) {
      await this.cleanup();
    }

    const shardResults: ShardGenerationResult[] = [];
    const errors: string[] = [];

    try {
      // Récupérer toutes les URLs (à adapter selon votre source de données)
      const allUrls = await this.fetchAllUrls(opts);

      // Diviser en shards
      const shards = this.splitIntoShards(allUrls, this.config.shardSize);
      this.logger.log(
        `📊 Generating ${shards.length} shards for ${allUrls.length} URLs`,
      );

      // Générer chaque shard
      for (let i = 0; i < shards.length; i++) {
        try {
          const shardResult = await this.generateShard(
            shards[i],
            i + 1,
            opts.sitemapType,
            opts,
          );
          shardResults.push(shardResult);

          this.logger.log(
            `✅ Shard ${i + 1}/${shards.length}: ${shardResult.filename} (${shardResult.urlCount} URLs, ${this.formatBytes(shardResult.compressedSize || shardResult.fileSize)})`,
          );
        } catch (error: any) {
          const errorMsg = `Failed to generate shard ${i + 1}: ${error.message}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Générer l'index sitemap
      let indexResult: IndexGenerationResult | undefined;
      if (
        this.config.autoGenerateIndex &&
        shardResults.length > 0 &&
        !opts.dryRun
      ) {
        indexResult = await this.generateIndex(shardResults, opts.sitemapType);
        this.logger.log(
          `✅ Index generated: ${indexResult.filename} (${indexResult.shardCount} shards)`,
        );
      }

      const endTime = new Date();
      const totalDuration = endTime.getTime() - startTime.getTime();

      // Calculer statistiques
      const stats = this.calculateStats(shardResults, totalDuration);

      const result: StreamingGenerationResult = {
        success: errors.length === 0,
        startTime,
        endTime,
        totalDuration,
        shards: shardResults,
        index: indexResult,
        stats,
        errors: errors.length > 0 ? errors : undefined,
      };

      this.logger.log('🎉 Streaming generation complete!');
      this.logger.log(
        `📊 Total: ${stats.totalUrls} URLs in ${stats.totalShards} shards`,
      );
      this.logger.log(`⚡ Speed: ${stats.urlsPerSecond.toFixed(0)} URLs/sec`);
      this.logger.log(
        `💾 Size: ${this.formatBytes(stats.totalSize)} → ${this.formatBytes(stats.totalCompressedSize)} (${stats.averageCompressionRatio.toFixed(1)}%)`,
      );

      return result;
    } catch (error: any) {
      this.logger.error(`❌ Generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Générer un shard spécifique
   */
  private async generateShard(
    urls: SitemapEntry[],
    shardNumber: number,
    type: string,
    options: GenerationOptions,
  ): Promise<ShardGenerationResult> {
    const startTime = Date.now();
    const filename = `sitemap-${type}-${shardNumber}.xml.gz`;
    const filepath = path.join(this.config.outputDirectory, filename);

    // Générer le XML
    const xml = this.buildSitemapXml(urls, options);

    if (options.dryRun) {
      return {
        filename,
        filepath,
        urlCount: urls.length,
        fileSize: Buffer.byteLength(xml, 'utf8'),
        generationTime: Date.now() - startTime,
      };
    }

    // Compresser et écrire sur disque
    const xmlBuffer = Buffer.from(xml, 'utf8');
    const compressedBuffer = await this.compressGzip(xmlBuffer);

    fs.writeFileSync(filepath, compressedBuffer);

    // Calculer hash SHA256
    const fileHash = createHash('sha256')
      .update(compressedBuffer)
      .digest('hex');

    const compressionRatio =
      ((xmlBuffer.length - compressedBuffer.length) / xmlBuffer.length) * 100;

    return {
      filename,
      filepath,
      urlCount: urls.length,
      fileSize: xmlBuffer.length,
      compressedSize: compressedBuffer.length,
      compressionRatio,
      generationTime: Date.now() - startTime,
      fileHash,
    };
  }

  /**
   * Générer le sitemap index
   */
  private async generateIndex(
    shards: ShardGenerationResult[],
    type: string,
  ): Promise<IndexGenerationResult> {
    const startTime = Date.now();
    const filename = `sitemap-${type}-index.xml`;
    const filepath = path.join(this.config.outputDirectory, filename);

    const shardEntries = shards.map((shard) => ({
      name: shard.filename,
      url: `${this.config.publicBaseUrl}/${shard.filename}`,
      lastmod: new Date().toISOString(),
    }));

    const xml = this.buildIndexXml(shardEntries);
    fs.writeFileSync(filepath, xml, 'utf8');

    const stats = fs.statSync(filepath);

    return {
      filename,
      filepath,
      shardCount: shards.length,
      fileSize: stats.size,
      generationTime: Date.now() - startTime,
      shards: shardEntries,
    };
  }

  /**
   * Construire le XML d'un sitemap
   */
  private buildSitemapXml(
    urls: SitemapEntry[],
    options: GenerationOptions,
  ): string {
    const hasHreflang =
      options.includeHreflang &&
      urls.some((url) => url.alternates && url.alternates.length > 0);
    const hasImages =
      options.includeImages &&
      urls.some((url) => url.images && url.images.length > 0);

    const xmlnsXhtml = hasHreflang
      ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"'
      : '';
    const xmlnsImage = hasImages
      ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
      : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${xmlnsXhtml}${xmlnsImage}>
${urls.map((url) => this.buildUrlEntry(url, options)).join('\n')}
</urlset>`;
  }

  /**
   * Construire une entrée URL
   */
  private buildUrlEntry(url: SitemapEntry, options: GenerationOptions): string {
    let xml = `  <url>
    <loc>${this.escapeXml(url.loc)}</loc>
    <lastmod>${url.lastmod || new Date().toISOString()}</lastmod>`;

    if (url.changefreq) {
      xml += `\n    <changefreq>${url.changefreq}</changefreq>`;
    }

    if (url.priority !== undefined) {
      xml += `\n    <priority>${url.priority}</priority>`;
    }

    // Hreflang
    if (options.includeHreflang && url.alternates) {
      url.alternates.forEach((alt) => {
        xml += `\n    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${this.escapeXml(alt.href)}" />`;
      });
    }

    // Images
    if (options.includeImages && url.images) {
      url.images.forEach((image) => {
        xml += '\n    <image:image>';
        xml += `\n      <image:loc>${this.escapeXml(image.loc)}</image:loc>`;
        if (image.title) {
          xml += `\n      <image:title>${this.escapeXml(image.title)}</image:title>`;
        }
        if (image.caption) {
          xml += `\n      <image:caption>${this.escapeXml(image.caption)}</image:caption>`;
        }
        xml += '\n    </image:image>';
      });
    }

    xml += '\n  </url>';
    return xml;
  }

  /**
   * Construire le XML de l'index
   */
  private buildIndexXml(
    shards: Array<{ name: string; url: string; lastmod: string }>,
  ): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${shards
  .map(
    (shard) => `  <sitemap>
    <loc>${this.escapeXml(shard.url)}</loc>
    <lastmod>${shard.lastmod}</lastmod>
  </sitemap>`,
  )
  .join('\n')}
</sitemapindex>`;
  }

  /**
   * Compresser avec GZIP
   */
  private async compressGzip(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gzip(
        buffer,
        { level: this.config.compressionLevel },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        },
      );
    });
  }

  /**
   * Diviser les URLs en shards
   */
  private splitIntoShards(
    urls: SitemapEntry[],
    shardSize: number,
  ): SitemapEntry[][] {
    const shards: SitemapEntry[][] = [];

    for (let i = 0; i < urls.length; i += shardSize) {
      shards.push(urls.slice(i, i + shardSize));
    }

    return shards;
  }

  /**
   * Récupérer toutes les URLs (mock pour l'instant)
   */
  private async fetchAllUrls(
    options: GenerationOptions,
  ): Promise<SitemapEntry[]> {
    // TODO: Intégrer avec vraie source de données (Supabase, etc.)
    const urls: SitemapEntry[] = [];

    // Mock: générer quelques URLs de test
    for (let i = 1; i <= (options.maxUrls || 1000); i++) {
      urls.push({
        loc: `https://www.automecanik.com/pieces/produit-${i}.html`,
        lastmod: new Date().toISOString(),
        changefreq: 'weekly',
        priority: 0.8,
      });
    }

    return urls;
  }

  /**
   * Calculer les statistiques globales
   */
  private calculateStats(
    shards: ShardGenerationResult[],
    totalDuration: number,
  ) {
    const totalUrls = shards.reduce((sum, shard) => sum + shard.urlCount, 0);
    const totalSize = shards.reduce((sum, shard) => sum + shard.fileSize, 0);
    const totalCompressedSize = shards.reduce(
      (sum, shard) => sum + (shard.compressedSize || 0),
      0,
    );
    const averageCompressionRatio =
      ((totalSize - totalCompressedSize) / totalSize) * 100;
    const urlsPerSecond = (totalUrls / totalDuration) * 1000;

    return {
      totalUrls,
      totalShards: shards.length,
      totalSize,
      totalCompressedSize,
      averageCompressionRatio,
      urlsPerSecond,
    };
  }

  /**
   * Lister tous les fichiers sitemaps disponibles
   */
  async listAvailableFiles(): Promise<DownloadInfo[]> {
    const files = fs.readdirSync(this.config.outputDirectory);
    const sitemapFiles = files.filter(
      (f) => f.endsWith('.xml') || f.endsWith('.xml.gz'),
    );

    return sitemapFiles.map((filename) => {
      const filepath = path.join(this.config.outputDirectory, filename);
      const stats = fs.statSync(filepath);

      return {
        filename,
        publicUrl: `${this.config.publicBaseUrl}/${filename}`,
        size: stats.size,
        lastModified: stats.mtime,
        mimeType: filename.endsWith('.gz')
          ? 'application/gzip'
          : 'application/xml',
      };
    });
  }

  /**
   * Nettoyer tous les fichiers sitemaps
   */
  async cleanup(): Promise<number> {
    const files = fs.readdirSync(this.config.outputDirectory);
    const sitemapFiles = files.filter(
      (f) =>
        f.startsWith('sitemap-') &&
        (f.endsWith('.xml') || f.endsWith('.xml.gz')),
    );

    sitemapFiles.forEach((file) => {
      const filepath = path.join(this.config.outputDirectory, file);
      fs.unlinkSync(filepath);
    });

    this.logger.log(`🧹 Cleaned up ${sitemapFiles.length} sitemap files`);
    return sitemapFiles.length;
  }

  /**
   * Échapper les caractères spéciaux XML
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Formater la taille en bytes
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Obtenir la configuration actuelle
   */
  getConfig(): StreamingConfig {
    return { ...this.config };
  }

  // ============================================
  // 🆕 GÉNÉRATION SITEMAPS STATIQUES
  // Constructeurs, Types, Blog depuis tables Supabase
  // ============================================

  /**
   * Générer les sitemaps statiques (constructeurs, types, blog)
   * Écrit directement les fichiers XML dans le répertoire de sortie
   *
   * @param outputDir Répertoire de sortie (par défaut: /srv/sitemaps ou OUTPUT_DIR)
   */
  async generateStaticSitemaps(outputDir?: string): Promise<StaticSitemapResult> {
    const startTime = Date.now();
    const dir = outputDir || process.env.OUTPUT_DIR || '/srv/sitemaps';
    const files: StaticSitemapResult['files'] = [];
    const errors: string[] = [];

    this.logger.log(`🏭 Generating static sitemaps to: ${dir}`);

    // S'assurer que le répertoire existe
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      // 1. Sitemap Constructeurs (35 marques)
      const constructeursResult = await this.generateConstructeursSitemap(dir);
      if (constructeursResult.success) {
        files.push(constructeursResult.file);
      } else if (constructeursResult.error) {
        errors.push(constructeursResult.error);
      }

      // 2. Sitemap Types/Motorisations (12.7k)
      const typesResult = await this.generateTypesSitemap(dir);
      if (typesResult.success) {
        files.push(typesResult.file);
      } else if (typesResult.error) {
        errors.push(typesResult.error);
      }

      // 3. Sitemap Blog (109 articles)
      const blogResult = await this.generateBlogSitemap(dir);
      if (blogResult.success) {
        files.push(blogResult.file);
      } else if (blogResult.error) {
        errors.push(blogResult.error);
      }

      // 4. Mettre à jour l'index sitemap.xml
      await this.updateMainSitemapIndex(dir, files);

      const duration = Date.now() - startTime;
      const totalUrls = files.reduce((sum, f) => sum + f.urlCount, 0);

      this.logger.log(`✅ Static sitemaps generated: ${files.length} files, ${totalUrls} URLs in ${duration}ms`);

      return {
        success: errors.length === 0,
        files,
        totalUrls,
        duration,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      this.logger.error(`❌ Static sitemap generation failed: ${error.message}`);
      return {
        success: false,
        files,
        totalUrls: 0,
        duration: Date.now() - startTime,
        errors: [error.message],
      };
    }
  }

  /**
   * Générer sitemap-constructeurs.xml depuis __sitemap_marque
   */
  private async generateConstructeursSitemap(dir: string): Promise<{
    success: boolean;
    file?: StaticSitemapResult['files'][0];
    error?: string;
  }> {
    try {
      this.logger.log('📦 Generating sitemap-constructeurs.xml...');

      const { data: marques, error } = await this.supabase
        .from('__sitemap_marque')
        .select('map_id, map_marque_alias, map_marque_id')
        .order('map_marque_alias');

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      if (!marques || marques.length === 0) {
        throw new Error('No marques found in __sitemap_marque');
      }

      const urls = marques
        .filter((m: any) => m.map_marque_alias && m.map_marque_id)
        .map((m: any) => ({
          loc: `${this.BASE_URL}/constructeurs/${m.map_marque_alias}-${m.map_marque_id}.html`,
          priority: '0.8',
          changefreq: 'monthly',
        }));

      const xml = this.buildSimpleSitemapXml(urls);
      const filepath = path.join(dir, 'sitemap-constructeurs.xml');
      fs.writeFileSync(filepath, xml, 'utf8');

      const stats = fs.statSync(filepath);

      this.logger.log(`✅ sitemap-constructeurs.xml: ${urls.length} URLs, ${this.formatBytes(stats.size)}`);

      return {
        success: true,
        file: {
          name: 'sitemap-constructeurs.xml',
          path: filepath,
          urlCount: urls.length,
          size: stats.size,
        },
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to generate constructeurs sitemap: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Générer sitemap-types.xml depuis __sitemap_motorisation
   */
  private async generateTypesSitemap(dir: string): Promise<{
    success: boolean;
    file?: StaticSitemapResult['files'][0];
    error?: string;
  }> {
    try {
      this.logger.log('📦 Generating sitemap-types.xml...');

      // Charger avec pagination (12.7k entrées)
      const allMotorisations: any[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await this.supabase
          .from('__sitemap_motorisation')
          .select('map_id, map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id')
          .range(offset, offset + batchSize - 1)
          .order('map_id');

        if (error) {
          throw new Error(`Supabase error: ${error.message}`);
        }

        if (data && data.length > 0) {
          allMotorisations.push(...data);
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      this.logger.log(`📊 Loaded ${allMotorisations.length} motorisations from __sitemap_motorisation`);

      const urls = allMotorisations
        .filter((m: any) => m.map_marque_alias && m.map_modele_alias && m.map_type_alias)
        .map((m: any) => ({
          loc: `${this.BASE_URL}/constructeurs/${m.map_marque_alias}-${m.map_marque_id}/${m.map_modele_alias}-${m.map_modele_id}/${m.map_type_alias}-${m.map_type_id}.html`,
          priority: '0.7',
          changefreq: 'monthly',
        }));

      const xml = this.buildSimpleSitemapXml(urls);
      const filepath = path.join(dir, 'sitemap-types.xml');
      fs.writeFileSync(filepath, xml, 'utf8');

      const stats = fs.statSync(filepath);

      this.logger.log(`✅ sitemap-types.xml: ${urls.length} URLs, ${this.formatBytes(stats.size)}`);

      return {
        success: true,
        file: {
          name: 'sitemap-types.xml',
          path: filepath,
          urlCount: urls.length,
          size: stats.size,
        },
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to generate types sitemap: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Générer sitemap-blog.xml depuis __sitemap_blog
   */
  private async generateBlogSitemap(dir: string): Promise<{
    success: boolean;
    file?: StaticSitemapResult['files'][0];
    error?: string;
  }> {
    try {
      this.logger.log('📦 Generating sitemap-blog.xml...');

      const { data: articles, error } = await this.supabase
        .from('__sitemap_blog')
        .select('map_id, map_alias, map_date')
        .order('map_date', { ascending: false });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      if (!articles || articles.length === 0) {
        this.logger.warn('⚠️ No articles found in __sitemap_blog');
        // Créer un sitemap vide mais valide
        const emptyXml = this.buildSimpleSitemapXml([]);
        const filepath = path.join(dir, 'sitemap-blog.xml');
        fs.writeFileSync(filepath, emptyXml, 'utf8');
        return {
          success: true,
          file: { name: 'sitemap-blog.xml', path: filepath, urlCount: 0, size: 0 },
        };
      }

      const urls = articles
        .filter((a: any) => a.map_alias)
        .map((a: any) => ({
          loc: `${this.BASE_URL}/blog-pieces-auto/${a.map_alias}`,
          priority: '0.6',
          changefreq: 'monthly',
        }));

      const xml = this.buildSimpleSitemapXml(urls);
      const filepath = path.join(dir, 'sitemap-blog.xml');
      fs.writeFileSync(filepath, xml, 'utf8');

      const stats = fs.statSync(filepath);

      this.logger.log(`✅ sitemap-blog.xml: ${urls.length} URLs, ${this.formatBytes(stats.size)}`);

      return {
        success: true,
        file: {
          name: 'sitemap-blog.xml',
          path: filepath,
          urlCount: urls.length,
          size: stats.size,
        },
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to generate blog sitemap: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mettre à jour l'index sitemap.xml principal
   */
  private async updateMainSitemapIndex(
    dir: string,
    newFiles: StaticSitemapResult['files'],
  ): Promise<void> {
    this.logger.log('📝 Updating main sitemap.xml index...');

    const today = new Date().toISOString().split('T')[0];

    // Lister tous les sitemaps existants dans le répertoire
    const existingFiles = fs.readdirSync(dir)
      .filter(f => f.startsWith('sitemap-') && f.endsWith('.xml') && f !== 'sitemap.xml')
      .sort();

    // Construire l'index
    const entries = existingFiles.map(filename => `  <sitemap>
    <loc>${this.BASE_URL}/${filename}</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`);

    const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</sitemapindex>`;

    const indexPath = path.join(dir, 'sitemap.xml');
    fs.writeFileSync(indexPath, indexXml, 'utf8');

    this.logger.log(`✅ sitemap.xml updated with ${existingFiles.length} sitemaps`);
  }

  /**
   * Construire un XML sitemap simple (sans hreflang/images)
   */
  private buildSimpleSitemapXml(
    urls: { loc: string; priority: string; changefreq: string }[],
  ): string {
    const urlEntries = urls.map(u => `  <url>
    <loc>${this.escapeXml(u.loc)}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
  }
}
