/**
 * 🔗 SERVICE HUBS CRAWL V10 - ORCHESTRATEUR
 *
 * Orchestre la génération de pages HTML de liens internes pour faciliter
 * le crawl par Googlebot (non indexées).
 *
 * Délègue à 3 services spécialisés:
 * - HubsClusterService: 19 familles de produits (clusters thématiques)
 * - HubsPriorityService: Money, Risk, Stabilize, Editorial
 * - HubsVehicleService: Listings, Vehicles, VehiclesByBrand
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import { DatabaseException, ErrorCodes } from '../../../common/exceptions';
import { SITE_ORIGIN } from '../../../config/app.config';
import { HubsClusterService } from './sitemap-v10-hubs-cluster.service';
import { HubsPriorityService } from './sitemap-v10-hubs-priority.service';
import { HubsVehicleService } from './sitemap-v10-hubs-vehicle.service';
import {
  CLUSTER_CONFIGS,
  HUB_CONFIGS,
  HubConfig,
  HubGenerationResult,
  HubType,
  MAX_URLS_PER_PART,
  generateSignature,
  htmlEscape,
} from './sitemap-v10-hubs.types';

@Injectable()
export class SitemapV10HubsService extends SupabaseBaseService {
  protected override readonly logger = new Logger(SitemapV10HubsService.name);
  private readonly BASE_URL: string;
  private readonly OUTPUT_DIR: string;

  // Cache global pour déduplication inter-clusters
  private processedHubUrlsCache: Set<string> | null = null;

  constructor(
    configService: ConfigService,
    rpcGate: RpcGateService,
    private readonly clusterService: HubsClusterService,
    private readonly priorityService: HubsPriorityService,
    private readonly vehicleService: HubsVehicleService,
  ) {
    super(configService);
    this.rpcGate = rpcGate;

    this.BASE_URL = this.configService.get<string>('BASE_URL') || SITE_ORIGIN;
    this.OUTPUT_DIR =
      this.configService.get<string>('CRAWL_HUBS_DIR') || '/var/www/crawl-hubs';

    this.logger.log('🔗 SitemapV10HubsService initialized');
    this.logger.log(`   Output: ${this.OUTPUT_DIR}`);
  }

  /**
   * Génère tous les hubs de crawl
   */
  async generateAllHubs(): Promise<HubGenerationResult[]> {
    this.logger.log('🚀 Generating all crawl hubs...');

    const results: HubGenerationResult[] = [];
    const hubTypes: HubType[] = ['money', 'new-pages', 'gammes', 'vehicules'];

    // Générer les hubs principaux
    for (const hubType of hubTypes) {
      try {
        const result = await this.generateHub(hubType);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to generate ${hubType} hub:`, error);
        results.push({
          success: false,
          hubType,
          urlCount: 0,
          filePath: '',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Générer les clusters thématiques (arme SEO la plus puissante!)
    const clusterResults = await this.clusterService.generateClusterHubs();
    results.push(...clusterResults);

    // Générer l'index des hubs (inclut les clusters)
    await this.generateHubIndex(results);

    return results;
  }

  /**
   * Génère un hub spécifique
   */
  async generateHub(hubType: HubType): Promise<HubGenerationResult> {
    const config = HUB_CONFIGS[hubType];
    this.logger.log(`📝 Generating ${hubType} hub...`);

    try {
      // Récupérer les URLs selon la config
      let urls: string[] = [];

      if (config.bucket) {
        // Récupérer par bucket de température
        // 🛡️ RPC Safety Gate
        const { data, error } = await this.callRpc<{ url: string }[]>(
          'get_sitemap_urls_by_temperature',
          {
            p_temperature: config.bucket,
            p_limit: config.maxUrls,
            p_offset: 0,
          },
          { source: 'cron' },
        );

        if (error)
          throw new DatabaseException({
            code: ErrorCodes.SEO.SITEMAP_FETCH_FAILED,
            message: error.message,
            details: error.message,
          });
        urls = (data || []).map((row: { url: string }) =>
          row.url.startsWith('http') ? row.url : `${this.BASE_URL}${row.url}`,
        );
      } else if (config.pageTypes) {
        // Récupérer par type de page
        const { data, error } = await this.supabase
          .from('__seo_page')
          .select('url')
          .in('page_type', config.pageTypes)
          .eq('is_indexable_hint', true)
          .limit(config.maxUrls);

        if (error)
          throw new DatabaseException({
            code: ErrorCodes.SEO.SITEMAP_FETCH_FAILED,
            message: error.message,
            details: error.message,
          });
        urls = (data || []).map((row) =>
          row.url.startsWith('http') ? row.url : `${this.BASE_URL}${row.url}`,
        );
      }

      if (urls.length === 0) {
        this.logger.warn(`   No URLs found for ${hubType} hub`);
      }

      // Générer le fichier HTML
      const filePath = await this.writeHubFile(hubType, config, urls);

      // Enregistrer dans la table d'audit
      await this.logHubGeneration(
        hubType,
        config.bucket || 'all',
        urls.length,
        filePath,
      );

      this.logger.log(`   ✓ Generated ${hubType}.html (${urls.length} URLs)`);

      return {
        success: true,
        hubType,
        urlCount: urls.length,
        filePath,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Écrit un fichier hub HTML
   */
  private async writeHubFile(
    hubType: HubType,
    config: HubConfig,
    urls: string[],
  ): Promise<string> {
    const dirPath = path.join(this.OUTPUT_DIR, config.bucket || 'all');
    const filePath = path.join(dirPath, `${hubType}.html`);

    await fs.mkdir(dirPath, { recursive: true });

    const links = urls
      .map(
        (url) =>
          `    <li><a href="${htmlEscape(url)}">${htmlEscape(url)}</a></li>`,
      )
      .join('\n');

    const signature = generateSignature(urls.length, 'v10-hub');
    const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="index, follow">
  <title>${htmlEscape(config.title)}</title>
  <meta name="description" content="${htmlEscape(config.description)}">
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e53e3e; padding-bottom: 10px; }
    p.meta { color: #666; font-size: 14px; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>${htmlEscape(config.title)}</h1>
  <p class="meta">${urls.length} liens - Mis à jour le ${new Date().toISOString().split('T')[0]}</p>
  <p>${htmlEscape(config.description)}</p>
  <ul>
${links}
  </ul>
  <p><a href="/__crawl__/index.html">← Retour à l'index</a></p>
</body>
</html>`;

    await fs.writeFile(filePath, html, 'utf8');
    return filePath;
  }

  /**
   * Génère l'index des hubs
   */
  private async generateHubIndex(
    results: HubGenerationResult[],
  ): Promise<void> {
    const indexPath = path.join(this.OUTPUT_DIR, 'index.html');

    // Séparer les hubs principaux des clusters
    const mainHubs = results.filter((r) => r.success && HUB_CONFIGS[r.hubType]);
    const clusterHubs = results.filter(
      (r) => r.success && CLUSTER_CONFIGS[r.hubType as string],
    );

    const hubLinks = mainHubs
      .map((r) => {
        const config = HUB_CONFIGS[r.hubType];
        const relativePath = r.filePath.replace(this.OUTPUT_DIR, '');
        return `    <li>
      <a href="/__crawl__${relativePath}"><strong>${htmlEscape(config.title)}</strong></a>
      <br><span class="meta">${r.urlCount} liens - ${htmlEscape(config.description)}</span>
    </li>`;
      })
      .join('\n');

    const clusterLinks = clusterHubs
      .map((r) => {
        const config = CLUSTER_CONFIGS[r.hubType as string];
        const relativePath = r.filePath.replace(this.OUTPUT_DIR, '');
        return `    <li>
      <a href="/__crawl__${relativePath}"><strong>${htmlEscape(config.title)}</strong></a>
      <br><span class="meta">${r.urlCount} liens - ${htmlEscape(config.description)}</span>
    </li>`;
      })
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="index, follow">
  <title>Index des hubs de crawl - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; }
    h2 { color: #333; margin-top: 30px; border-bottom: 1px solid #e53e3e; padding-bottom: 8px; }
    ul { list-style: none; padding: 0; }
    li { margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px; }
    a { color: #2563eb; text-decoration: none; font-size: 18px; }
    a:hover { text-decoration: underline; }
    .meta { color: #666; font-size: 13px; }
    .clusters { background: #fff3e0; }
  </style>
</head>
<body>
  <h1>Hubs de crawl - Automecanik</h1>
  <p>Pages de liens internes pour faciliter le crawl du site.</p>

  <h2>📂 Hubs principaux</h2>
  <ul>
${hubLinks}
  </ul>

  <h2>🔥 Clusters thématiques (19 familles)</h2>
  <p>Les clusters regroupent les pages par famille de produits - basés sur la hiérarchie officielle catalog_family.</p>
  <ul class="clusters">
${clusterLinks}
  </ul>

  <p><a href="${this.BASE_URL}">← Retour au site</a></p>
</body>
</html>`;

    await fs.mkdir(this.OUTPUT_DIR, { recursive: true });
    await fs.writeFile(indexPath, html, 'utf8');
    this.logger.log(`   ✓ Generated hub index: ${indexPath}`);
  }

  /**
   * Enregistre la génération dans la table d'audit
   */
  private async logHubGeneration(
    hubType: HubType,
    bucket: string,
    urlCount: number,
    filePath: string,
  ): Promise<void> {
    try {
      // Use filePath if it looks like a relative path, otherwise build from bucket/hubType
      const normalizedPath = filePath.startsWith('/')
        ? filePath
        : `/__crawl__/${bucket}/${hubType}.html`;

      await this.supabase.from('__seo_crawl_hub').upsert(
        {
          path: normalizedPath,
          bucket,
          hub_type: hubType === 'new-pages' ? 'new' : hubType,
          urls_count: urlCount,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'path' },
      );
    } catch (error) {
      this.logger.warn(`Failed to log hub generation: ${error}`);
    }
  }

  /**
   * 🚀 Génère TOUS les hubs (paginated + transversaux + content)
   * Point d'entrée principal pour la génération complète
   */
  async generateAllHubsRobust(): Promise<{
    clusters: HubGenerationResult[];
    transversal: HubGenerationResult[];
    summary: { totalUrls: number; totalFiles: number };
  }> {
    this.logger.log(
      '═══════════════════════════════════════════════════════════',
    );
    this.logger.log('🚀 GENERATING ALL HUBS (ROBUST STRATEGY)');
    this.logger.log(
      '═══════════════════════════════════════════════════════════',
    );

    // Reset cache déduplication inter-clusters
    this.processedHubUrlsCache = new Set<string>();
    this.clusterService.setProcessedUrlsCache(this.processedHubUrlsCache);
    this.logger.log('🔄 Deduplication cache initialized');

    // 1. Générer les clusters paginés (pièces auto)
    const clusterResults =
      await this.clusterService.generatePaginatedClusterHubs();

    // Clear cache from cluster service
    this.clusterService.setProcessedUrlsCache(null);

    // 2. Générer les hubs transversaux (prioritaires)
    const transversalResults: HubGenerationResult[] = [];

    const riskResult = await this.priorityService.generateRiskHub();
    transversalResults.push(riskResult);

    const stabilizeResult = await this.priorityService.generateStabilizeHub();
    transversalResults.push(stabilizeResult);

    // 3. Générer les hubs de contenu (blog, listings, véhicules)
    this.logger.log(
      '═══════════════════════════════════════════════════════════',
    );
    this.logger.log('📝 GENERATING CONTENT HUBS');
    this.logger.log(
      '═══════════════════════════════════════════════════════════',
    );

    const editorialResult = await this.priorityService.generateEditorialHub();
    transversalResults.push(editorialResult);

    const listingsResult = await this.vehicleService.generateListingsHub();
    transversalResults.push(listingsResult);

    // Véhicules par marque (35 dossiers)
    const vehiclesByBrandResults =
      await this.vehicleService.generateVehiclesByBrandHubs();
    transversalResults.push(...vehiclesByBrandResults);

    // 4. Mettre à jour l'index global principal
    await this.generateMainHubIndex(clusterResults, transversalResults);

    // 5. Résumé
    const totalUrls =
      clusterResults.reduce((sum, r) => sum + r.urlCount, 0) +
      transversalResults.reduce((sum, r) => sum + r.urlCount, 0);

    const clusterFiles = clusterResults.reduce((sum, r) => {
      const parts = Math.ceil(r.urlCount / MAX_URLS_PER_PART);
      return sum + parts + 1; // +1 for index
    }, 1); // +1 for global index

    const totalFiles = clusterFiles + transversalResults.length + 1; // +1 for main index

    this.logger.log(
      '═══════════════════════════════════════════════════════════',
    );
    this.logger.log(
      `✅ ALL HUBS GENERATED: ${totalUrls.toLocaleString()} URLs in ${totalFiles} files`,
    );
    this.logger.log(
      '═══════════════════════════════════════════════════════════',
    );

    return {
      clusters: clusterResults,
      transversal: transversalResults,
      summary: { totalUrls, totalFiles },
    };
  }

  /**
   * Génère l'index principal des hubs (/__crawl__/index.html)
   */
  private async generateMainHubIndex(
    clusterResults: HubGenerationResult[],
    transversalResults: HubGenerationResult[],
  ): Promise<void> {
    const filePath = path.join(this.OUTPUT_DIR, 'index.html');

    const totalClusterUrls = clusterResults.reduce(
      (sum, r) => sum + r.urlCount,
      0,
    );
    const totalTransversalUrls = transversalResults.reduce(
      (sum, r) => sum + r.urlCount,
      0,
    );
    const totalUrls = totalClusterUrls + totalTransversalUrls;

    // Extraire les stats des hubs de contenu
    const editorialUrls =
      transversalResults.find((r) => r.filePath.includes('editorial'))
        ?.urlCount || 0;
    const listingsUrls =
      transversalResults.find((r) => r.filePath.includes('listings'))
        ?.urlCount || 0;
    // Véhicules sont générés par marque, sommer tous les résultats
    const vehiclesUrls = transversalResults
      .filter((r) => r.hubType === 'vehicules')
      .reduce((sum, r) => sum + r.urlCount, 0);

    const signature = generateSignature(totalUrls, 'v10-main-index');
    const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="index, follow">
  <title>Hubs de Crawl - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; }
    h2 { color: #333; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
    .summary { background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .summary strong { font-size: 24px; color: #16a34a; }
    ul { list-style: none; padding: 0; }
    li { margin-bottom: 15px; padding: 15px; background: #f9f9f9; border-radius: 8px; }
    li.hot { background: #fef3c7; }
    li.risk { background: #fef2f2; }
    li.content { background: #f3e8ff; }
    li.listings { background: #e0f2fe; }
    li.vehicles { background: #d1fae5; }
    a { color: #2563eb; text-decoration: none; font-weight: 500; }
    a:hover { text-decoration: underline; }
    .meta { color: #666; font-size: 13px; }
  </style>
</head>
<body>
  <h1>🔗 Hubs de Crawl - Automecanik</h1>

  <div class="summary">
    <strong>${totalUrls.toLocaleString()}</strong> URLs pour le crawl Googlebot
    <br><span class="meta">Structure optimisée: max ${MAX_URLS_PER_PART.toLocaleString()} URLs/fichier • ${new Date().toISOString().split('T')[0]}</span>
  </div>

  <h2>🔥 Hubs Prioritaires</h2>
  <ul>
    <li class="risk">
      <a href="risk/weak-cluster.html">⚠️ Pages à Risque</a>
      <br><span class="meta">Pages orphelines ou faible crawl - Sauvetage SEO</span>
    </li>
  </ul>

  <h2>📝 Hubs de Contenu</h2>
  <ul>
    <li class="content">
      <a href="content/editorial.html">📝 Contenu Éditorial</a>
      <br><span class="meta">${editorialUrls.toLocaleString()} liens - Blog, guides, conseils techniques</span>
    </li>
    <li class="listings">
      <a href="index/listings.html">📂 Pages Listing</a>
      <br><span class="meta">${listingsUrls.toLocaleString()} liens - Catégories et index gamme/marque</span>
    </li>
    <li class="vehicles">
      <a href="constructeurs/index.html">🚗 Pages Véhicules</a>
      <br><span class="meta">${vehiclesUrls.toLocaleString()} liens - Marques, modèles, motorisations</span>
    </li>
  </ul>

  <h2>📂 Clusters Thématiques</h2>
  <p><strong><a href="clusters/index.html">Voir tous les clusters</a></strong> (${totalClusterUrls.toLocaleString()} URLs)</p>
  <p class="meta">19 familles de produits, chacune paginée en fichiers de ${MAX_URLS_PER_PART.toLocaleString()} URLs max.</p>

  <p style="margin-top: 40px;"><a href="${this.BASE_URL}">← Retour au site</a></p>
</body>
</html>`;

    await fs.writeFile(filePath, html, 'utf8');
    this.logger.log(`   ✓ Generated main hub index: ${filePath}`);
  }
}
