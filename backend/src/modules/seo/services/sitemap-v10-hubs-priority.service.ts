/**
 * 🔥 PRIORITY HUBS SERVICE - Hubs transversaux et éditoriaux
 *
 * Génère les hubs HTML pour:
 * - Money: Pages à fort ROI
 * - Risk: Pages en danger de désindexation
 * - Stabilize: Pages récemment indexées (J7)
 * - Editorial: Blog, guides, conseils
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import {
  HubGenerationResult,
  HubType,
  generateSignature,
  htmlEscape,
} from './sitemap-v10-hubs.types';

@Injectable()
export class HubsPriorityService extends SupabaseBaseService {
  protected override readonly logger = new Logger(HubsPriorityService.name);
  private readonly BASE_URL: string;
  private readonly OUTPUT_DIR: string;

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
   * Génère le hub "money" avec les top pages ROI
   * Source: Gammes sélectionnées dynamiquement par volume de recherche
   * Fallback: IDs hardcodés si RPC non disponible
   */
  async generateMoneyHub(): Promise<HubGenerationResult> {
    this.logger.log(
      '💰 Generating money hub (dynamic top gammes by volume)...',
    );

    try {
      // 1. Récupérer les top gammes par volume de recherche via RPC
      // 🛡️ RPC Safety Gate
      let topGammeIds: string[];
      const { data: topGammes, error: gammeError } = await this.callRpc<
        { gamme_id: number }[]
      >(
        'get_top_money_gammes',
        {
          p_limit: 10,
        },
        { source: 'cron' },
      );

      if (gammeError || !topGammes || topGammes.length === 0) {
        this.logger.warn(
          `   RPC get_top_money_gammes failed or empty, using fallback IDs`,
        );
        if (gammeError) this.logger.warn(`   Error: ${gammeError.message}`);
        // Fallback vers IDs hardcodés si RPC échoue
        topGammeIds = ['402', '82', '7', '8', '400', '401'];
      } else {
        topGammeIds = topGammes.map((g: { gamme_id: number }) =>
          String(g.gamme_id),
        );
        this.logger.log(
          `   Using dynamic top gammes: ${topGammeIds.join(', ')}`,
        );
      }

      // 2. Récupérer les pages avec le plus de produits (= plus populaires)
      const { data: pieces, error } = await this.supabase
        .from('__sitemap_p_link')
        .select(
          'map_pg_alias, map_pg_id, map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id, map_has_item',
        )
        .in('map_pg_id', topGammeIds)
        .gt('map_has_item', 20) // Pages riches en contenu
        .order('map_has_item', { ascending: false })
        .limit(2000);

      if (error) throw new Error(error.message);

      const urls = (pieces || []).map(
        (p) =>
          `${this.BASE_URL}/pieces/${p.map_pg_alias}-${p.map_pg_id}/${p.map_marque_alias}-${p.map_marque_id}/${p.map_modele_alias}-${p.map_modele_id}/${p.map_type_alias}-${p.map_type_id}.html`,
      );

      // Écrire le fichier
      const dirPath = path.join(this.OUTPUT_DIR, 'hot');
      await fs.mkdir(dirPath, { recursive: true });
      const filePath = path.join(dirPath, 'money.html');

      const links = urls
        .map(
          (u) => `    <li><a href="${htmlEscape(u)}">${htmlEscape(u)}</a></li>`,
        )
        .join('\n');

      const signature = generateSignature(urls.length, 'v10-money');
      const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="index, follow">
  <title>Pages Money - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; }
    .meta { color: #666; font-size: 14px; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>💰 Pages Money - Top ROI</h1>
  <p class="meta">${urls.length} liens - Pages avec le plus de produits (conversion élevée)</p>
  <p>Ces pages sont les plus importantes pour le business. Priorisées pour le crawl.</p>
  <ul>
${links}
  </ul>
  <p><a href="../index.html">← Retour aux hubs</a></p>
</body>
</html>`;

      await fs.writeFile(filePath, html, 'utf8');
      this.logger.log(`   ✓ Generated hot/money.html (${urls.length} URLs)`);

      return {
        success: true,
        hubType: 'money' as HubType,
        urlCount: urls.length,
        filePath,
      };
    } catch (error) {
      this.logger.error('Failed to generate money hub:', error);
      return {
        success: false,
        hubType: 'money' as HubType,
        urlCount: 0,
        filePath: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Génère le hub "risk" avec les pages en danger
   * Source: Pages avec risk_flag ORPHAN ou LOW_CRAWL
   */
  async generateRiskHub(): Promise<HubGenerationResult> {
    this.logger.log('⚠️ Generating risk hub (pages at risk)...');

    try {
      // Récupérer les pages à risque depuis __seo_entity_health
      const { data: riskPages, error } = await this.supabase
        .from('__seo_entity_health')
        .select('url')
        .in('risk_flag', ['ORPHAN', 'LOW_CRAWL', 'WEAK_CLUSTER'])
        .order('risk_level', { ascending: false })
        .limit(3000);

      if (error) {
        this.logger.warn(
          `   Risk hub: table __seo_entity_health not available: ${error.message}`,
        );
        // Fallback: pages avec peu de produits (potentiellement à risque)
        const { data: fallback } = await this.supabase
          .from('__sitemap_p_link')
          .select(
            'map_pg_alias, map_pg_id, map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id',
          )
          .gt('map_has_item', 5)
          .lt('map_has_item', 15) // Pages faibles
          .limit(2000);

        const urls = (fallback || []).map(
          (p) =>
            `${this.BASE_URL}/pieces/${p.map_pg_alias}-${p.map_pg_id}/${p.map_marque_alias}-${p.map_marque_id}/${p.map_modele_alias}-${p.map_modele_id}/${p.map_type_alias}-${p.map_type_id}.html`,
        );

        return this.writeRiskHubFile(urls);
      }

      const urls = (riskPages || [])
        .map((p) =>
          p.url.startsWith('http') ? p.url : `${this.BASE_URL}${p.url}`,
        )
        .filter((u) => u);

      return this.writeRiskHubFile(urls);
    } catch (error) {
      this.logger.error('Failed to generate risk hub:', error);
      return {
        success: false,
        hubType: 'clusters' as HubType,
        urlCount: 0,
        filePath: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Génère le hub "stabilize" avec les pages indexées depuis ~7 jours
   * qui nécessitent stabilisation (score 30-70)
   * Source: __seo_index_history avec first_indexed_at de J-6 à J-8
   */
  async generateStabilizeHub(): Promise<HubGenerationResult> {
    this.logger.log('📊 Generating STABILIZE hub (J7 pages)...');

    try {
      // Appeler la RPC pour récupérer les pages à stabiliser
      // 🛡️ RPC Safety Gate
      const { data: pages, error } = await this.callRpc<any[]>(
        'get_stabilize_pages',
        {
          p_days_min: 6,
          p_days_max: 8,
          p_limit: 2000,
        },
        { source: 'cron' },
      );

      if (error) {
        this.logger.warn(
          `   Stabilize hub: RPC not available: ${error.message}`,
        );
        // Pas de fallback - si la table n'existe pas, on retourne vide
        return {
          success: true,
          hubType: 'stabilize' as HubType,
          urlCount: 0,
          filePath: '',
        };
      }

      if (!pages || pages.length === 0) {
        this.logger.log('   No pages need stabilization (J7)');
        return {
          success: true,
          hubType: 'stabilize' as HubType,
          urlCount: 0,
          filePath: '',
        };
      }

      const urls = pages.map((p: { url: string }) =>
        p.url.startsWith('http') ? p.url : `${this.BASE_URL}${p.url}`,
      );

      // Écrire le fichier HTML
      const dirPath = path.join(this.OUTPUT_DIR, 'stabilize');
      await fs.mkdir(dirPath, { recursive: true });

      const filePath = path.join(dirPath, 'j7.html');
      const links = urls
        .map(
          (u) => `    <li><a href="${htmlEscape(u)}">${htmlEscape(u)}</a></li>`,
        )
        .join('\n');

      const signature = generateSignature(urls.length, 'v10-stabilize');
      const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="index, follow">
  <title>Pages à stabiliser (J7) - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #8b5cf6; padding-bottom: 10px; }
    .meta { color: #666; font-size: 14px; }
    .info { background: #f3e8ff; border-left: 4px solid #8b5cf6; padding: 15px; margin: 20px 0; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>📊 Pages à stabiliser - Jour 7</h1>
  <p class="meta">${urls.length.toLocaleString()} pages indexées depuis 6-8 jours</p>
  <div class="info">
    Ces pages sont récemment indexées mais n'ont pas encore atteint leur plein potentiel.
    Le renforcement via liens internes aide à stabiliser leur positionnement.
  </div>
  <ul>
${links}
  </ul>
  <p><a href="../index.html">← Retour aux hubs</a></p>
</body>
</html>`;

      await fs.writeFile(filePath, html, 'utf8');
      this.logger.log(`   ✓ Generated stabilize/j7.html (${urls.length} URLs)`);

      return {
        success: true,
        hubType: 'stabilize' as HubType,
        urlCount: urls.length,
        filePath,
      };
    } catch (error) {
      this.logger.error('Failed to generate stabilize hub:', error);
      return {
        success: false,
        hubType: 'stabilize' as HubType,
        urlCount: 0,
        filePath: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Génère le hub "editorial" avec les pages blog et guides
   * Sources: __blog_advice, __blog_guide, __seo_gamme_conseil, __blog_seo_marque
   * Output: content/editorial.html
   */
  async generateEditorialHub(): Promise<HubGenerationResult> {
    this.logger.log('📝 Generating editorial hub (blog + guides)...');

    try {
      const urls: string[] = [];

      // 1. Blog Advice (conseils techniques) - no display filter, column doesn't exist
      const { data: advices } = await this.supabase
        .from('__blog_advice')
        .select('ba_alias')
        .limit(1000);

      if (advices && advices.length > 0) {
        for (const a of advices) {
          if (a.ba_alias) {
            urls.push(
              `${this.BASE_URL}/blog-pieces-auto/article/${a.ba_alias}`,
            );
          }
        }
        this.logger.log(`   Found ${advices.length} blog advice pages`);
      }

      // 2. Blog Guides - no display filter, column doesn't exist
      const { data: guides } = await this.supabase
        .from('__blog_guide')
        .select('bg_alias')
        .limit(1000);

      if (guides && guides.length > 0) {
        for (const g of guides) {
          if (g.bg_alias) {
            urls.push(
              `${this.BASE_URL}/blog-pieces-auto/article/${g.bg_alias}`,
            );
          }
        }
        this.logger.log(`   Found ${guides.length} blog guide pages`);
      }

      // 3. SEO Gamme Conseil (conseils par gamme)
      const { data: conseilGammes } = await this.supabase
        .from('__seo_gamme_conseil')
        .select('sgc_pg_alias')
        .limit(500);

      if (conseilGammes && conseilGammes.length > 0) {
        for (const c of conseilGammes) {
          if (c.sgc_pg_alias) {
            urls.push(
              `${this.BASE_URL}/blog-pieces-auto/conseils/${c.sgc_pg_alias}`,
            );
          }
        }
        this.logger.log(`   Found ${conseilGammes.length} conseil gamme pages`);
      }

      // 4. Use __sitemap_blog as authoritative source (already has correct URLs)
      const { data: sitemapBlog } = await this.supabase
        .from('__sitemap_blog')
        .select('url')
        .limit(500);

      if (sitemapBlog && sitemapBlog.length > 0) {
        for (const b of sitemapBlog) {
          if (b.url) {
            urls.push(`${this.BASE_URL}${b.url}`);
          }
        }
        this.logger.log(`   Found ${sitemapBlog.length} sitemap blog pages`);
      }

      // Écrire le fichier
      const dirPath = path.join(this.OUTPUT_DIR, 'content');
      await fs.mkdir(dirPath, { recursive: true });
      const filePath = path.join(dirPath, 'editorial.html');

      const links = urls
        .map(
          (u) => `    <li><a href="${htmlEscape(u)}">${htmlEscape(u)}</a></li>`,
        )
        .join('\n');

      const signature = generateSignature(urls.length, 'v10-editorial');
      const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="index, follow">
  <title>Contenu Éditorial - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #8b5cf6; padding-bottom: 10px; }
    .meta { color: #666; font-size: 14px; }
    .info { background: #f3e8ff; border-left: 4px solid #8b5cf6; padding: 15px; margin: 20px 0; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>📝 Contenu Éditorial - Blog & Guides</h1>
  <p class="meta">${urls.length} liens - Mis à jour le ${new Date().toISOString().split('T')[0]}</p>
  <div class="info">
    <strong>Contenu de qualité :</strong> Articles techniques, guides d'achat, conseils d'entretien.
    Ces pages sont essentielles pour le SEO et l'autorité thématique.
  </div>
  <ul>
${links}
  </ul>
  <p><a href="../index.html">← Retour aux hubs</a></p>
</body>
</html>`;

      await fs.writeFile(filePath, html, 'utf8');
      this.logger.log(
        `   ✓ Generated content/editorial.html (${urls.length} URLs)`,
      );

      return {
        success: true,
        hubType: 'gammes' as HubType, // Reuse type for consistency
        urlCount: urls.length,
        filePath,
      };
    } catch (error) {
      this.logger.error('Failed to generate editorial hub:', error);
      return {
        success: false,
        hubType: 'gammes' as HubType,
        urlCount: 0,
        filePath: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Helper pour écrire le fichier risk hub
   */
  private async writeRiskHubFile(urls: string[]): Promise<HubGenerationResult> {
    const dirPath = path.join(this.OUTPUT_DIR, 'risk');
    await fs.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, 'weak-cluster.html');

    const links = urls
      .map(
        (u) => `    <li><a href="${htmlEscape(u)}">${htmlEscape(u)}</a></li>`,
      )
      .join('\n');

    const signature = generateSignature(urls.length, 'v10-risk');
    const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="index, follow">
  <title>Pages à risque - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #dc2626; padding-bottom: 10px; }
    .meta { color: #666; font-size: 14px; }
    .warning { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>⚠️ Pages à Risque - Sauvetage Crawl</h1>
  <p class="meta">${urls.length} liens - Pages avec faible crawl ou cluster faible</p>
  <div class="warning">
    <strong>Attention :</strong> Ces pages risquent d'être désindexées si elles ne reçoivent pas de liens internes.
    Ce hub les expose à Googlebot pour maintenir leur indexation.
  </div>
  <ul>
${links}
  </ul>
  <p><a href="../index.html">← Retour aux hubs</a></p>
</body>
</html>`;

    await fs.writeFile(filePath, html, 'utf8');
    this.logger.log(
      `   ✓ Generated risk/weak-cluster.html (${urls.length} URLs)`,
    );

    return {
      success: true,
      hubType: 'clusters' as HubType,
      urlCount: urls.length,
      filePath,
    };
  }
}
