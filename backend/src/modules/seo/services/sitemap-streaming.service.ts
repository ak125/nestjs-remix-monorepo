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
import { gzipAsync } from '../../../utils/promise-helpers';
import { createHash } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEffectiveSupabaseKey } from '@common/utils';
import { SITE_ORIGIN } from '../../../config/app.config';
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
  private readonly BASE_URL = SITE_ORIGIN;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      enableGzip: true,
      compressionLevel: 9, // Maximum compression
      outputDirectory: path.join(process.cwd(), 'public', 'sitemaps'),
      shardSize: 50000, // 50k URLs par shard (limite Google)
      autoGenerateIndex: true,
      publicBaseUrl: `${SITE_ORIGIN}/public/sitemaps`,
      cleanupBeforeGeneration: false,
    };

    // Initialiser le client Supabase
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || '';
    // ADR-028 Option D — fallback to ANON_KEY in read-only mode (RLS protects writes)
    const supabaseKey = getEffectiveSupabaseKey();

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn(
        '⚠️ Supabase credentials not configured - static sitemap generation disabled',
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);

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
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          const errorMsg = `Failed to generate shard ${i + 1}: ${message}`;
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Generation failed: ${message}`);
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
    return gzipAsync(buffer, {
      level: this.config.compressionLevel,
    }) as Promise<Buffer>;
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
        loc: `${SITE_ORIGIN}/pieces/produit-${i}.html`,
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
  // 🆕 GÉNÉRATION SITEMAPS STATIQUES - OBSOLÈTE
  // Remplacé par SitemapV10Service
  // Utiliser: POST /api/sitemap/generate-all
  // ============================================
}
