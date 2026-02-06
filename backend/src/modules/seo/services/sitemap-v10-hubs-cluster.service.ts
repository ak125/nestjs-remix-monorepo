/**
 * 🔗 CLUSTER HUBS SERVICE - 19 familles de produits
 *
 * Génère les hubs HTML par famille de produits (clusters thématiques).
 * Supporte la pagination (max 5000 URLs/fichier) et la déduplication inter-clusters.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import {
  FAMILY_CLUSTERS,
  FamilyClusterConfig,
  HubGenerationResult,
  HubType,
  MAX_URLS_PER_PART,
  UrlWithPriority,
  chunkArray,
  generateSignature,
  htmlEscape,
  slugify,
  sortUrlsByPriority,
} from './sitemap-v10-hubs.types';

@Injectable()
export class HubsClusterService extends SupabaseBaseService {
  protected override readonly logger = new Logger(HubsClusterService.name);
  private readonly BASE_URL: string;
  private readonly OUTPUT_DIR: string;

  // Cache déduplication inter-clusters (injecté par l'orchestrateur)
  private processedHubUrlsCache: Set<string> | null = null;

  constructor(configService: ConfigService, rpcGate: RpcGateService) {
    super(configService);
    this.rpcGate = rpcGate;

    this.BASE_URL =
      this.configService.get<string>('BASE_URL') ||
      'https://www.automecanik.com';
    this.OUTPUT_DIR =
      this.configService.get<string>('CRAWL_HUBS_DIR') || '/var/www/crawl-hubs';
  }

  /**
   * Setter pour le cache de déduplication inter-clusters.
   * Appelé par l'orchestrateur avant generatePaginatedClusterHubs().
   */
  setProcessedUrlsCache(cache: Set<string> | null): void {
    this.processedHubUrlsCache = cache;
  }

  /**
   * Génère les hubs de clusters thématiques (19 familles avec sections H2)
   * Version non-paginée.
   */
  async generateClusterHubs(): Promise<HubGenerationResult[]> {
    this.logger.log(
      '🔗 Generating cluster hubs (19 familles avec sections H2)...',
    );
    this.logger.log('   📦 Source: __sitemap_p_link (714k URLs)');
    const results: HubGenerationResult[] = [];

    for (const [slug, familyConfig] of Object.entries(FAMILY_CLUSTERS)) {
      try {
        // Collecter les URLs par sous-catégorie
        const subcategoryData: Array<{
          name: string;
          urls: string[];
          pgIds: string[];
        }> = [];

        let totalUrls = 0;

        for (const subcategory of familyConfig.subcategories) {
          // 1. Récupérer les pg_id pour cette sous-catégorie (INDEX uniquement!)
          const { data: gammes, error: gammeError } = await this.supabase
            .from('pieces_gamme')
            .select('pg_id')
            .in('pg_name', subcategory.gamme_names)
            .eq('pg_display', '1')
            .eq('pg_relfollow', '1'); // ⚠️ IMPORTANT: Seulement les gammes INDEX

          if (gammeError) {
            this.logger.warn(
              `   ⚠️ Gamme lookup failed for ${subcategory.name}: ${gammeError.message}`,
            );
            continue;
          }

          const pgIds = (gammes || []).map((g) => String(g.pg_id));

          if (pgIds.length === 0) {
            this.logger.debug(
              `   No gammes found for subcategory ${subcategory.name}`,
            );
            continue;
          }

          // 2. Récupérer TOUTES les pièces depuis __sitemap_p_link (pagination pour dépasser limite 1000)
          const allPieces: Array<{
            map_pg_alias: string;
            map_pg_id: string;
            map_marque_alias: string;
            map_marque_id: string;
            map_modele_alias: string;
            map_modele_id: string;
            map_type_alias: string;
            map_type_id: string;
          }> = [];

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
              this.logger.warn(
                `   ⚠️ Pieces fetch failed for ${subcategory.name}: ${piecesError.message}`,
              );
              break;
            }

            if (pieces && pieces.length > 0) {
              allPieces.push(...pieces);
              offset += PAGE_SIZE;
              hasMore = pieces.length === PAGE_SIZE;
            } else {
              hasMore = false;
            }
          }

          // 3. Construire les URLs au format V10
          const urls = allPieces.map(
            (p) =>
              `${this.BASE_URL}/pieces/${p.map_pg_alias}-${p.map_pg_id}/${p.map_marque_alias}-${p.map_marque_id}/${p.map_modele_alias}-${p.map_modele_id}/${p.map_type_alias}-${p.map_type_id}.html`,
          );

          if (urls.length > 0) {
            subcategoryData.push({
              name: subcategory.name,
              urls,
              pgIds,
            });
            totalUrls += urls.length;
          }
        }

        // Écrire le fichier hub avec sections H2
        const filePath = await this.writeClusterHubFileWithH2(
          slug,
          familyConfig,
          subcategoryData,
        );

        results.push({
          success: true,
          hubType: slug as HubType,
          urlCount: totalUrls,
          filePath,
        });

        const subcatSummary = subcategoryData
          .map((s) => `${s.name}(${s.urls.length})`)
          .join(', ');
        this.logger.log(
          `   ✓ ${slug}.html: ${totalUrls} URLs (${subcategoryData.length} H2: ${subcatSummary})`,
        );
      } catch (error) {
        this.logger.error(`Failed to generate cluster ${slug}:`, error);
        results.push({
          success: false,
          hubType: slug as HubType,
          urlCount: 0,
          filePath: '',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * 🚀 Génère tous les hubs de clusters avec pagination
   * Structure: clusters/{family}/index.html + part-*.html (max 5000 URLs/fichier)
   */
  async generatePaginatedClusterHubs(): Promise<HubGenerationResult[]> {
    this.logger.log(
      '🚀 Generating PAGINATED cluster hubs (max 5k URLs/file)...',
    );
    const results: HubGenerationResult[] = [];
    const allClusterStats: Array<{
      slug: string;
      title: string;
      totalUrls: number;
      partsCount: number;
      subcategories: Array<{ name: string; count: number }>;
    }> = [];

    for (const [slug, familyConfig] of Object.entries(FAMILY_CLUSTERS)) {
      try {
        // 1. Collecter TOUTES les URLs pour cette famille avec métadonnées
        const { urls, subcategoryStats } =
          await this.collectFamilyUrlsWithMetadata(familyConfig);

        if (urls.length === 0) {
          this.logger.warn(`   ⚠️ No URLs for ${slug}`);
          continue;
        }

        // 1.5. Dédupliquer inter-clusters (même URL ne doit pas apparaître dans plusieurs familles)
        let uniqueUrls = urls;
        if (this.processedHubUrlsCache) {
          const beforeCount = urls.length;
          uniqueUrls = urls.filter((u) => {
            if (this.processedHubUrlsCache!.has(u.url)) {
              return false; // URL déjà dans un cluster précédent
            }
            this.processedHubUrlsCache!.add(u.url);
            return true;
          });
          const dedupedCount = beforeCount - uniqueUrls.length;
          if (dedupedCount > 0) {
            this.logger.log(
              `   🔄 ${slug}: Deduplicated ${dedupedCount} inter-cluster URLs`,
            );
          }
        }

        if (uniqueUrls.length === 0) {
          this.logger.warn(`   ⚠️ No unique URLs for ${slug} after dedup`);
          continue;
        }

        // 2. Trier par priorité (hasItem décroissant = plus de produits = plus important)
        const sortedUrls = sortUrlsByPriority(uniqueUrls);

        // 3. Créer le dossier du cluster
        const clusterDir = path.join(this.OUTPUT_DIR, 'clusters', slug);
        await fs.mkdir(clusterDir, { recursive: true });

        // 4. Paginer en parts de 5000
        const parts = chunkArray(sortedUrls, MAX_URLS_PER_PART);
        const partsCount = parts.length;

        // 5. Écrire chaque fichier part
        for (let i = 0; i < parts.length; i++) {
          const partNum = String(i + 1).padStart(3, '0');
          await this.writePartFile(
            slug,
            partNum,
            parts[i],
            familyConfig,
            i,
            partsCount,
            uniqueUrls.length,
          );
        }

        // 6. Écrire l'index du cluster
        await this.writeClusterIndexFile(
          slug,
          familyConfig,
          subcategoryStats,
          partsCount,
          uniqueUrls.length,
        );

        // 7. Collecter les stats pour l'index global
        allClusterStats.push({
          slug,
          title: familyConfig.title,
          totalUrls: uniqueUrls.length,
          partsCount,
          subcategories: subcategoryStats,
        });

        results.push({
          success: true,
          hubType: slug as HubType,
          urlCount: uniqueUrls.length,
          filePath: `clusters/${slug}/index.html`,
        });

        this.logger.log(
          `   ✓ ${slug}/ : ${uniqueUrls.length.toLocaleString()} URLs → ${partsCount} parts`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to generate paginated cluster ${slug}:`,
          error,
        );
        results.push({
          success: false,
          hubType: slug as HubType,
          urlCount: 0,
          filePath: '',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 7. Écrire l'index global des clusters
    await this.writeGlobalClusterIndexFile(allClusterStats);

    const totalUrls = allClusterStats.reduce((sum, c) => sum + c.totalUrls, 0);
    const totalParts = allClusterStats.reduce(
      (sum, c) => sum + c.partsCount,
      0,
    );
    this.logger.log(
      `✅ Paginated hubs complete: ${totalUrls.toLocaleString()} URLs in ${totalParts} files`,
    );

    return results;
  }

  /**
   * Collecte toutes les URLs d'une famille avec métadonnées pour le tri
   */
  private async collectFamilyUrlsWithMetadata(
    familyConfig: FamilyClusterConfig,
  ): Promise<{
    urls: UrlWithPriority[];
    subcategoryStats: Array<{ name: string; count: number }>;
  }> {
    const allUrls: UrlWithPriority[] = [];
    const subcategoryStats: Array<{ name: string; count: number }> = [];

    for (const subcategory of familyConfig.subcategories) {
      // 1. Récupérer les pg_id pour cette sous-catégorie (INDEX uniquement)
      const { data: gammes, error: gammeError } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id')
        .in('pg_name', subcategory.gamme_names)
        .eq('pg_display', '1')
        .eq('pg_relfollow', '1'); // INDEX only

      if (gammeError || !gammes || gammes.length === 0) continue;

      const pgIds = gammes.map((g) => String(g.pg_id));

      // 2. Pagination complète pour récupérer TOUTES les URLs
      const PAGE_SIZE = 1000;
      let offset = 0;
      let hasMore = true;
      let subcatCount = 0;

      while (hasMore) {
        const { data: pieces, error } = await this.supabase
          .from('__sitemap_p_link')
          .select(
            'map_pg_alias, map_pg_id, map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id, map_has_item',
          )
          .in('map_pg_id', pgIds)
          .gt('map_has_item', 5)
          .range(offset, offset + PAGE_SIZE - 1);

        if (error || !pieces || pieces.length === 0) {
          hasMore = false;
          break;
        }

        for (const p of pieces) {
          allUrls.push({
            url: `${this.BASE_URL}/pieces/${p.map_pg_alias}-${p.map_pg_id}/${p.map_marque_alias}-${p.map_marque_id}/${p.map_modele_alias}-${p.map_modele_id}/${p.map_type_alias}-${p.map_type_id}.html`,
            subcategory: subcategory.name,
            hasItem: p.map_has_item || 0,
          });
          subcatCount++;
        }

        offset += PAGE_SIZE;
        hasMore = pieces.length === PAGE_SIZE;
      }

      if (subcatCount > 0) {
        subcategoryStats.push({ name: subcategory.name, count: subcatCount });
      }
    }

    return { urls: allUrls, subcategoryStats };
  }

  /**
   * Écrit un fichier hub HTML avec sections H2 par sous-catégorie
   */
  private async writeClusterHubFileWithH2(
    slug: string,
    config: FamilyClusterConfig,
    subcategoryData: Array<{ name: string; urls: string[]; pgIds: string[] }>,
  ): Promise<string> {
    const dirPath = path.join(this.OUTPUT_DIR, 'clusters');
    const filePath = path.join(dirPath, `${slug}.html`);

    await fs.mkdir(dirPath, { recursive: true });

    // Générer la navigation interne
    const navLinks = subcategoryData
      .map((sub) => {
        const anchorId = slugify(sub.name);
        return `<a href="#${anchorId}">${htmlEscape(sub.name)} (${sub.urls.length})</a>`;
      })
      .join(' | ');

    // Générer les sections H2 avec leurs liens
    const sections = subcategoryData
      .map((sub) => {
        const anchorId = slugify(sub.name);
        const links = sub.urls
          .map(
            (url) =>
              `      <li><a href="${htmlEscape(url)}">${htmlEscape(url)}</a></li>`,
          )
          .join('\n');

        return `  <h2 id="${anchorId}">${htmlEscape(sub.name)}</h2>
    <p class="subcat-meta">${sub.urls.length} liens</p>
    <ul>
${links}
    </ul>`;
      })
      .join('\n\n');

    const totalUrls = subcategoryData.reduce(
      (sum, s) => sum + s.urls.length,
      0,
    );

    const signature = generateSignature(totalUrls, 'v10-cluster-h2');
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
    h2 { color: #333; margin-top: 40px; padding-bottom: 8px; border-bottom: 1px solid #ddd; }
    p.meta { color: #666; font-size: 14px; }
    p.subcat-meta { color: #888; font-size: 12px; margin-top: -10px; }
    nav { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; line-height: 2; }
    nav a { color: #2563eb; text-decoration: none; margin: 0 5px; }
    nav a:hover { text-decoration: underline; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>${htmlEscape(config.title)}</h1>
  <p class="meta">${totalUrls} liens - ${subcategoryData.length} sous-catégories - Mis à jour le ${new Date().toISOString().split('T')[0]}</p>
  <p>${htmlEscape(config.description)}</p>

  <nav>
    <strong>Navigation :</strong> ${navLinks}
  </nav>

${sections}

  <p style="margin-top: 40px;"><a href="/__crawl__/index.html">← Retour à l'index</a></p>
</body>
</html>`;

    await fs.writeFile(filePath, html, 'utf8');
    return filePath;
  }

  /**
   * Écrit un fichier part (ex: part-001.html)
   */
  private async writePartFile(
    slug: string,
    partNum: string,
    urls: UrlWithPriority[],
    config: FamilyClusterConfig,
    partIndex: number,
    totalParts: number,
    totalUrls: number,
  ): Promise<string> {
    const filePath = path.join(
      this.OUTPUT_DIR,
      'clusters',
      slug,
      `part-${partNum}.html`,
    );
    const startIdx = partIndex * MAX_URLS_PER_PART + 1;
    const endIdx = Math.min(startIdx + urls.length - 1, totalUrls);

    // Navigation entre parts
    const prevPart =
      partIndex > 0 ? `part-${String(partIndex).padStart(3, '0')}.html` : null;
    const nextPart =
      partIndex < totalParts - 1
        ? `part-${String(partIndex + 2).padStart(3, '0')}.html`
        : null;

    const navPrev = prevPart
      ? `<a href="${prevPart}">← Part ${partIndex}</a>`
      : '';
    const navNext = nextPart
      ? `<a href="${nextPart}">Part ${partIndex + 2} →</a>`
      : '';
    const navCurrent = `<strong>Part ${partIndex + 1}</strong>`;

    const links = urls
      .map(
        (u) =>
          `    <li><a href="${htmlEscape(u.url)}">${htmlEscape(u.url)}</a></li>`,
      )
      .join('\n');

    const signature = generateSignature(urls.length, 'v10-part');
    const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="index, follow">
  <title>${htmlEscape(config.title)} - Part ${partIndex + 1}/${totalParts}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e53e3e; padding-bottom: 10px; }
    .meta { color: #666; font-size: 14px; }
    nav { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; display: flex; justify-content: space-between; }
    nav a { color: #2563eb; text-decoration: none; }
    nav a:hover { text-decoration: underline; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>${htmlEscape(config.title)} - Partie ${partIndex + 1}/${totalParts}</h1>
  <p class="meta">${urls.length.toLocaleString()} liens (URLs ${startIdx.toLocaleString()} à ${endIdx.toLocaleString()} sur ${totalUrls.toLocaleString()})</p>

  <nav>
    <span>${navPrev}</span>
    <a href="index.html">Index ${slug}</a>
    <span>${navCurrent}</span>
    <span>${navNext}</span>
  </nav>

  <ul>
${links}
  </ul>

  <nav>
    <span>${navPrev}</span>
    <a href="index.html">Index ${slug}</a>
    <span>${navCurrent}</span>
    <span>${navNext}</span>
  </nav>
</body>
</html>`;

    await fs.writeFile(filePath, html, 'utf8');
    return filePath;
  }

  /**
   * Écrit l'index d'un cluster (ex: clusters/freinage/index.html)
   */
  private async writeClusterIndexFile(
    slug: string,
    config: FamilyClusterConfig,
    subcategoryStats: Array<{ name: string; count: number }>,
    partsCount: number,
    totalUrls: number,
  ): Promise<string> {
    const filePath = path.join(this.OUTPUT_DIR, 'clusters', slug, 'index.html');

    // Liste des sous-catégories
    const subcatLinks = subcategoryStats
      .map(
        (s) =>
          `<li>${htmlEscape(s.name)} (${s.count.toLocaleString()} URLs)</li>`,
      )
      .join('\n    ');

    // Liste des parts
    const partLinks: string[] = [];
    for (let i = 0; i < partsCount; i++) {
      const partNum = String(i + 1).padStart(3, '0');
      const startIdx = i * MAX_URLS_PER_PART + 1;
      const endIdx = Math.min((i + 1) * MAX_URLS_PER_PART, totalUrls);
      partLinks.push(
        `<li><a href="part-${partNum}.html">Part ${i + 1}</a> - URLs ${startIdx.toLocaleString()} à ${endIdx.toLocaleString()}</li>`,
      );
    }

    const signature = generateSignature(totalUrls, 'v10-cluster-index');
    const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="index, follow">
  <title>Index ${htmlEscape(config.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e53e3e; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 30px; }
    .meta { color: #666; font-size: 14px; }
    ul { list-style: none; padding: 0; }
    li { margin-bottom: 10px; padding: 10px; background: #f9f9f9; border-radius: 5px; }
    a { color: #2563eb; text-decoration: none; font-weight: 500; }
    a:hover { text-decoration: underline; }
    .parts li { background: #e8f4fd; }
  </style>
</head>
<body>
  <h1>${htmlEscape(config.title)} - Index</h1>
  <p class="meta">${totalUrls.toLocaleString()} URLs répartis sur ${partsCount} fichiers</p>
  <p>${htmlEscape(config.description)}</p>

  <h2>📂 Sous-catégories</h2>
  <ul>
    ${subcatLinks}
  </ul>

  <h2>📄 Fichiers</h2>
  <ul class="parts">
    ${partLinks.join('\n    ')}
  </ul>

  <p><a href="../index.html">← Index Clusters</a></p>
</body>
</html>`;

    await fs.writeFile(filePath, html, 'utf8');
    return filePath;
  }

  /**
   * Écrit l'index global des clusters (clusters/index.html)
   */
  private async writeGlobalClusterIndexFile(
    clusterStats: Array<{
      slug: string;
      title: string;
      totalUrls: number;
      partsCount: number;
      subcategories: Array<{ name: string; count: number }>;
    }>,
  ): Promise<string> {
    const filePath = path.join(this.OUTPUT_DIR, 'clusters', 'index.html');
    await fs.mkdir(path.join(this.OUTPUT_DIR, 'clusters'), { recursive: true });

    const totalUrls = clusterStats.reduce((sum, c) => sum + c.totalUrls, 0);
    const totalParts = clusterStats.reduce((sum, c) => sum + c.partsCount, 0);

    // Liste des clusters triés par nombre d'URLs décroissant
    const sortedClusters = [...clusterStats].sort(
      (a, b) => b.totalUrls - a.totalUrls,
    );
    const clusterLinks = sortedClusters
      .map(
        (c) => `
    <li>
      <a href="${c.slug}/index.html"><strong>${htmlEscape(c.title)}</strong></a>
      <br><span class="meta">${c.totalUrls.toLocaleString()} URLs → ${c.partsCount} fichiers</span>
    </li>`,
      )
      .join('\n');

    const signature = generateSignature(totalUrls, 'v10-global-cluster-index');
    const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="index, follow">
  <title>Index des Clusters - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e53e3e; padding-bottom: 10px; }
    .summary { background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .summary strong { font-size: 24px; color: #e65100; }
    ul { list-style: none; padding: 0; }
    li { margin-bottom: 15px; padding: 15px; background: #f9f9f9; border-radius: 8px; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .meta { color: #666; font-size: 13px; }
  </style>
</head>
<body>
  <h1>🔥 Index des Clusters Thématiques</h1>

  <div class="summary">
    <strong>${totalUrls.toLocaleString()}</strong> URLs répartis sur <strong>${totalParts}</strong> fichiers (${sortedClusters.length} familles)
    <br><span class="meta">Max ${MAX_URLS_PER_PART.toLocaleString()} URLs par fichier • Mis à jour le ${new Date().toISOString().split('T')[0]}</span>
  </div>

  <ul>
${clusterLinks}
  </ul>

  <p><a href="../index.html">← Retour aux hubs</a></p>
</body>
</html>`;

    await fs.writeFile(filePath, html, 'utf8');
    this.logger.log(`   ✓ Generated global cluster index: ${filePath}`);
    return filePath;
  }
}
