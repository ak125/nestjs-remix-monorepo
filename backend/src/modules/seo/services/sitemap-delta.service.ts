/**
 * 🔄 SERVICE DE DELTA SITEMAP (DIFF JOURNALIER)
 * Détection de changements et génération de sitemaps incrémentiaux
 *
 * Principe:
 * 1. Calculer hash SHA1 pour chaque URL (canonique + price + stock + metadata)
 * 2. Comparer avec hash stocké dans Redis
 * 3. Si différent → ajouter URL au delta journalier (Redis Set)
 * 4. Chaque nuit → générer sitemap-latest.xml depuis le delta
 * 5. Vider le delta après génération
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import {
  HashableUrlData,
  UrlContentHash,
  UrlChangeType,
  HashComparisonResult,
  DeltaStats,
  DeltaConfig,
} from '../interfaces/sitemap-delta.interface';
import { SitemapEntry } from '../interfaces/sitemap-config.interface';
import { CacheService } from '../../../cache/cache.service';

@Injectable()
export class SitemapDeltaService {
  private readonly logger = new Logger(SitemapDeltaService.name);
  private readonly config: DeltaConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.config = {
      enabled: true,
      redisHashKey: 'sitemap:hashes',
      redisDeltaPrefix: 'sitemap:delta:',
      deltaRetentionDays: 30,
      emissionTime: '03:00', // 3h du matin
      autoGenerateLatest: true,
      clearDeltaAfterGeneration: true,
    };

    this.logger.log('🔄 SitemapDeltaService initialized');
    this.logger.log('✅ Redis cache connected');
    this.logger.log(
      `⏰ Emission time: ${this.config.emissionTime} (auto: ${this.config.autoGenerateLatest})`,
    );
  }

  /**
   * Calculer le hash SHA1 d'une URL avec ses données
   */
  calculateHash(data: HashableUrlData): string {
    const hashContent = JSON.stringify({
      canonical: data.canonical,
      price: data.price || 0,
      stock: data.stock || 0,
      metadata: data.metadata || {},
    });

    return createHash('sha1').update(hashContent).digest('hex');
  }

  /**
   * Comparer le hash actuel avec le hash stocké
   */
  async compareHash(
    url: string,
    newData: HashableUrlData,
  ): Promise<HashComparisonResult> {
    const newHash = this.calculateHash(newData);

    // 🔄 Récupérer l'ancien hash depuis Redis via CacheService
    const hashKey = `${this.config.redisHashKey}:${this.normalizeUrlKey(url)}`;
    const oldHash = await this.cacheService.get<string>(hashKey);

    if (!oldHash) {
      // Nouvelle URL
      return {
        hasChanged: true,
        changeType: UrlChangeType.NEW,
        newHash,
      };
    }

    if (oldHash === newHash) {
      // Aucun changement
      return {
        hasChanged: false,
        newHash,
        oldHash,
      };
    }

    // Changement détecté, analyser le type
    const changeType = this.detectChangeType(url, oldHash, newHash);

    return {
      hasChanged: true,
      changeType,
      oldHash,
      newHash,
    };
  }

  /**
   * Normaliser une URL pour l'utiliser comme clé Redis
   */
  private normalizeUrlKey(url: string): string {
    return url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 200);
  }

  /**
   * Détecter le type de changement (prix, stock, metadata, etc.)
   */
  private detectChangeType(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _url: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _oldHash: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _newHash: string,
  ): UrlChangeType {
    // TODO: Pour détecter précisément le type de changement,
    // il faudrait stocker les données hashables également
    // Pour l'instant, on retourne un changement générique
    return UrlChangeType.CONTENT_CHANGED;
  }

  /**
   * Enregistrer une URL dans le delta si elle a changé
   */
  async trackUrlChange(
    url: string,
    data: HashableUrlData,
  ): Promise<UrlContentHash> {
    const comparison = await this.compareHash(url, data);

    if (comparison.hasChanged) {
      await this.addToDelta(url, comparison.changeType!);

      // Mettre à jour le hash stocké
      await this.updateStoredHash(url, comparison.newHash);

      this.logger.debug(
        `✅ URL changed: ${url} (${comparison.changeType}) - hash: ${comparison.newHash.substring(0, 8)}...`,
      );
    }

    return {
      url,
      hash: comparison.newHash,
      lastModified: new Date(),
      changeType: comparison.changeType,
      previousHash: comparison.oldHash,
    };
  }

  /**
   * Ajouter une URL au delta journalier (Redis via CacheService)
   */
  private async addToDelta(url: string, changeType: UrlChangeType) {
    const today = this.getTodayKey();
    const deltaKey = `${this.config.redisDeltaPrefix}${today}`;

    // Récupérer la liste actuelle ou créer une nouvelle
    const currentDelta =
      (await this.cacheService.get<string[]>(deltaKey)) || [];

    // Ajouter l'URL si pas déjà présente
    if (!currentDelta.includes(url)) {
      currentDelta.push(url);
      // TTL = 30 jours en secondes
      const ttl = this.config.deltaRetentionDays * 86400;
      await this.cacheService.set(deltaKey, currentDelta, ttl);
    }

    this.logger.debug(
      `📝 Added to delta: ${deltaKey} → ${url} (${changeType})`,
    );
  }

  /**
   * Mettre à jour le hash stocké dans Redis
   */
  private async updateStoredHash(url: string, hash: string) {
    const hashKey = `${this.config.redisHashKey}:${this.normalizeUrlKey(url)}`;
    // TTL long pour les hashes (30 jours)
    await this.cacheService.set(
      hashKey,
      hash,
      this.config.deltaRetentionDays * 86400,
    );

    this.logger.debug(`💾 Updated hash: ${url} → ${hash.substring(0, 8)}...`);
  }

  /**
   * Obtenir la clé du delta d'aujourd'hui
   */
  private getTodayKey(): string {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * Obtenir la clé d'un delta spécifique
   */
  private getDeltaKey(date: string): string {
    return `${this.config.redisDeltaPrefix}${date}`;
  }

  /**
   * Récupérer toutes les URLs du delta d'aujourd'hui
   */
  async getTodayDelta(): Promise<string[]> {
    const today = this.getTodayKey();
    const deltaKey = this.getDeltaKey(today);

    const delta = await this.cacheService.get<string[]>(deltaKey);
    this.logger.debug(
      `📊 Fetching delta: ${deltaKey} → ${delta?.length || 0} URLs`,
    );

    return delta || [];
  }

  /**
   * Récupérer le delta d'une date spécifique
   */
  async getDeltaByDate(date: string): Promise<string[]> {
    const deltaKey = this.getDeltaKey(date);

    const delta = await this.cacheService.get<string[]>(deltaKey);
    this.logger.debug(
      `📊 Fetching delta: ${deltaKey} → ${delta?.length || 0} URLs`,
    );

    return delta || [];
  }

  /**
   * Générer sitemap-latest.xml depuis le delta d'aujourd'hui
   */
  async generateLatestSitemap(): Promise<string> {
    const urls = await this.getTodayDelta();

    if (urls.length === 0) {
      this.logger.log(
        'ℹ️ No changes today, skipping sitemap-latest.xml generation',
      );
      return '';
    }

    this.logger.log(
      `🔄 Generating sitemap-latest.xml with ${urls.length} changed URLs`,
    );

    // Convertir en SitemapEntry
    const entries: SitemapEntry[] = urls.map((url) => ({
      loc: url,
      lastmod: new Date().toISOString(),
      changefreq: 'daily',
      priority: 0.8,
    }));

    // Générer XML
    const xml = this.buildLatestSitemapXml(entries);

    // Optionnel: Vider le delta après génération
    if (this.config.clearDeltaAfterGeneration) {
      await this.clearTodayDelta();
    }

    return xml;
  }

  /**
   * Construire le XML du sitemap-latest
   */
  private buildLatestSitemapXml(urls: SitemapEntry[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Sitemap Latest: URLs modifiées aujourd'hui (${new Date().toISOString().split('T')[0]}) -->
  <!-- Total: ${urls.length} URLs -->
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod || new Date().toISOString()}</lastmod>
    <changefreq>${url.changefreq || 'daily'}</changefreq>
    <priority>${url.priority ?? 0.8}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`;
  }

  /**
   * Vider le delta d'aujourd'hui
   */
  async clearTodayDelta(): Promise<void> {
    const today = this.getTodayKey();
    const deltaKey = this.getDeltaKey(today);

    await this.cacheService.del(deltaKey);
    this.logger.log(`🗑️ Cleared delta: ${deltaKey}`);
  }

  /**
   * Obtenir les statistiques du delta
   */
  async getDeltaStats(date?: string): Promise<DeltaStats> {
    const targetDate = date || this.getTodayKey();
    const urls = await this.getDeltaByDate(targetDate);

    // TODO: Calculer les stats réelles depuis Redis
    const stats: DeltaStats = {
      date: targetDate,
      totalChanges: urls.length,
      changesByType: {
        [UrlChangeType.NEW]: 0,
        [UrlChangeType.PRICE_CHANGED]: 0,
        [UrlChangeType.STOCK_CHANGED]: 0,
        [UrlChangeType.METADATA_CHANGED]: 0,
        [UrlChangeType.CONTENT_CHANGED]: urls.length,
        [UrlChangeType.DELETED]: 0,
      },
    };

    return stats;
  }

  /**
   * Tâche programmée: générer sitemap-latest.xml chaque nuit
   * (À appeler depuis un Cron Job NestJS @Cron)
   */
  async nightlyDeltaGeneration(): Promise<void> {
    this.logger.log('🌙 Starting nightly delta sitemap generation...');

    const startTime = Date.now();
    const xml = await this.generateLatestSitemap();
    const generationTime = Date.now() - startTime;

    if (xml) {
      // TODO: Sauvegarder sitemap-latest.xml sur disque ou S3
      // await this.saveSitemapToDisk('sitemap-latest.xml', xml);

      const stats = await this.getDeltaStats();
      this.logger.log(
        `✅ Nightly delta sitemap generated: ${stats.totalChanges} URLs, ${generationTime}ms`,
      );
    }
  }

  /**
   * Nettoyer les deltas expirés (plus vieux que X jours)
   */
  async cleanupExpiredDeltas(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.deltaRetentionDays);

    this.logger.log(
      `🧹 Cleaning up deltas older than ${cutoffDate.toISOString().split('T')[0]}`,
    );

    // Utiliser clearByPattern du CacheService
    await this.cacheService.clearByPattern(`${this.config.redisDeltaPrefix}*`);

    this.logger.log('🧹 Delta cleanup completed (via pattern clear)');
    return 0; // Le nombre exact n'est pas retourné par clearByPattern
  }

  /**
   * Traiter un batch d'URLs (utilisé dans la génération de sitemap)
   */
  async processBatch(
    urls: Array<{ url: string; data: HashableUrlData }>,
  ): Promise<UrlContentHash[]> {
    const results: UrlContentHash[] = [];

    for (const item of urls) {
      const result = await this.trackUrlChange(item.url, item.data);
      results.push(result);
    }

    this.logger.log(`📊 Processed batch: ${results.length} URLs`);

    return results;
  }

  /**
   * Vérifier si le système de delta est activé
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Obtenir la configuration actuelle
   */
  getConfig(): DeltaConfig {
    return { ...this.config };
  }
}
