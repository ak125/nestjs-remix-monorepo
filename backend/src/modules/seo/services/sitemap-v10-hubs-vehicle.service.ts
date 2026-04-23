/**
 * 🚗 VEHICLE HUBS SERVICE - Hubs véhicules et listings
 *
 * Génère les hubs HTML pour:
 * - Listings: Pages gamme/catégorie
 * - Vehicles: Pages constructeurs (marques, modèles, types)
 * - VehiclesByBrand: Hubs par marque avec pagination
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import { SITE_ORIGIN } from '../../../config/app.config';
import { normalizeAlias } from '../../../common/utils/url-builder.utils';
import { getValidTypeIds } from '../helpers/auto-type-valid-ids.helper';
import {
  HubGenerationResult,
  HubType,
  generateSignature,
  htmlEscape,
} from './sitemap-v10-hubs.types';

@Injectable()
export class HubsVehicleService extends SupabaseBaseService {
  protected override readonly logger = new Logger(HubsVehicleService.name);
  private readonly BASE_URL: string;
  private readonly OUTPUT_DIR: string;

  constructor(configService: ConfigService, rpcGate: RpcGateService) {
    super(configService);
    this.rpcGate = rpcGate;

    this.BASE_URL = this.configService.get<string>('BASE_URL') || SITE_ORIGIN;
    this.OUTPUT_DIR =
      this.configService.get<string>('CRAWL_HUBS_DIR') || '/var/www/crawl-hubs';
  }

  /**
   * Génère le hub "listings" avec les pages gamme et gamme+marque
   * Sources: pieces_gamme (pages catégorie)
   * Output: index/listings.html
   */
  async generateListingsHub(): Promise<HubGenerationResult> {
    this.logger.log(
      '📂 Generating listings hub (gamme + gamme/marque) with FULL pagination...',
    );

    try {
      const urls: string[] = [];

      // 1. Pages gamme principales (INDEX uniquement)
      const { data: gammes } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id, pg_alias')
        .eq('pg_display', '1')
        .eq('pg_relfollow', '1') // INDEX only
        .order('pg_id');

      if (gammes && gammes.length > 0) {
        for (const g of gammes) {
          if (g.pg_alias) {
            // ✅ FIX: Format .html (pas /) - vérifié 200 OK
            urls.push(
              `${this.BASE_URL}/pieces/${normalizeAlias(g.pg_alias)}-${g.pg_id}.html`,
            );
          }
        }
        this.logger.log(`   Found ${gammes.length} gamme category pages`);
      }

      // ❌ SUPPRIMÉ: Pages gamme+marque (/pieces/xxx-123/yyy-456/)
      // Ces pages n'existent pas (retournent 404)
      // Seules les pages gamme .html existent
      this.logger.log(`   ℹ️ Gamme+marque pages skipped (don't exist on site)`);

      // Écrire le fichier
      const dirPath = path.join(this.OUTPUT_DIR, 'index');
      await fs.mkdir(dirPath, { recursive: true });
      const filePath = path.join(dirPath, 'listings.html');

      const links = urls
        .map(
          (u) => `    <li><a href="${htmlEscape(u)}">${htmlEscape(u)}</a></li>`,
        )
        .join('\n');

      const signature = generateSignature(urls.length, 'v10-listings');
      const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="index, follow">
  <title>Pages Listing - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #0ea5e9; padding-bottom: 10px; }
    .meta { color: #666; font-size: 14px; }
    .info { background: #e0f2fe; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>📂 Pages Listing - Catégories & Index</h1>
  <p class="meta">${urls.length} liens - Mis à jour le ${new Date().toISOString().split('T')[0]}</p>
  <div class="info">
    <strong>Pages d'index :</strong> Catégories de pièces et pages de listing par marque.
    Ces pages servent de portes d'entrée pour les recherches génériques.
  </div>
  <ul>
${links}
  </ul>
  <p><a href="../index.html">← Retour aux hubs</a></p>
</body>
</html>`;

      await fs.writeFile(filePath, html, 'utf8');
      this.logger.log(
        `   ✓ Generated index/listings.html (${urls.length} URLs)`,
      );

      return {
        success: true,
        hubType: 'gammes' as HubType,
        urlCount: urls.length,
        filePath,
      };
    } catch (error) {
      this.logger.error('Failed to generate listings hub:', error);
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
   * Génère le hub "vehicles" avec les pages constructeurs
   * Sources: auto_marque, auto_modele
   * Output: constructeurs/index.html + part-*.html
   */
  async generateVehiclesHub(): Promise<HubGenerationResult> {
    this.logger.log(
      '🚗 Generating vehicles hub (constructeurs) with FULL pagination...',
    );

    try {
      const urls: string[] = [];

      // 1. Pages marque (ex: /constructeurs/renault.html)
      const { data: marques } = await this.supabase
        .from('auto_marque')
        .select('marque_id, marque_alias')
        .eq('marque_display', '1')
        .order('marque_alias');

      if (marques && marques.length > 0) {
        for (const m of marques) {
          if (m.marque_alias) {
            // ✅ FIX: Ajouter l'ID à l'URL (vérifié 200 OK avec /constructeurs/audi-22.html)
            urls.push(
              `${this.BASE_URL}/constructeurs/${m.marque_alias}-${m.marque_id}.html`,
            );
          }
        }
        this.logger.log(`   Found ${marques.length} car brand pages`);
      }

      // 2. Pages modèle (via __sitemap_p_link pour avoir les combinaisons actives)
      // Format: /constructeurs/{marque}/{modele}/{type}.html
      // ⚠️ PAGINATION COMPLÈTE - récupérer TOUS les véhicules puis dédupliquer
      // Anti-404 : filtrer les orphelins TecDoc V1 (type_ids absents d'auto_type)
      const validTypeIds = await getValidTypeIds(this.supabase);
      const PAGE_SIZE = 1000;
      let offset = 0;
      let hasMore = true;
      let skippedOrphans = 0;
      const seen = new Set<string>();
      const vehicleUrls: string[] = [];

      this.logger.log(`   Fetching ALL vehicle combinations (pagination)...`);

      while (hasMore) {
        const { data: vehicles, error } = await this.supabase
          .from('__sitemap_p_link')
          .select(
            'map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id',
          )
          .gt('map_has_item', 5)
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
          this.logger.warn(`   ⚠️ Error at offset ${offset}: ${error.message}`);
          break;
        }

        if (vehicles && vehicles.length > 0) {
          for (const v of vehicles) {
            const typeIdNum =
              typeof v.map_type_id === 'string'
                ? parseInt(v.map_type_id, 10)
                : (v.map_type_id as number);
            // Skip orphan type_ids (TecDoc V1 remap residue)
            if (!validTypeIds.has(typeIdNum)) {
              skippedOrphans++;
              continue;
            }
            const key = `${v.map_marque_id}-${v.map_modele_id}-${v.map_type_id}`;
            if (
              !seen.has(key) &&
              v.map_marque_alias &&
              v.map_modele_alias &&
              v.map_type_alias
            ) {
              seen.add(key);
              // ✅ FIX: Ajouter les IDs à chaque segment (vérifié 200 OK)
              // Format: /constructeurs/{marque}-{id}/{modele}-{id}/{type}-{id}.html
              vehicleUrls.push(
                `${this.BASE_URL}/constructeurs/${normalizeAlias(v.map_marque_alias)}-${v.map_marque_id}/${normalizeAlias(v.map_modele_alias)}-${v.map_modele_id}/${normalizeAlias(v.map_type_alias)}-${v.map_type_id}.html`,
              );
            }
          }
          offset += PAGE_SIZE;
          hasMore = vehicles.length === PAGE_SIZE;

          // Progress log
          if (offset % 50000 < PAGE_SIZE) {
            this.logger.log(
              `   📊 Progress: ${offset.toLocaleString()} rows scanned, ${seen.size} unique vehicles`,
            );
          }
        } else {
          hasMore = false;
        }
      }

      urls.push(...vehicleUrls);
      this.logger.log(
        `   Found ${seen.size} unique vehicle pages (scanned ${offset} rows)`,
      );
      if (skippedOrphans > 0) {
        this.logger.warn(
          `   🧹 Filtered out ${skippedOrphans.toLocaleString()} orphan type_ids (TecDoc V1 remap residue)`,
        );
      }

      // ═══════════════════════════════════════════════════════════
      // PAGINATION: Écrire plusieurs fichiers (max 5000 URLs/fichier)
      // ═══════════════════════════════════════════════════════════
      const VEHICLES_MAX_PER_PART = 5000;
      const dirPath = path.join(this.OUTPUT_DIR, 'constructeurs');
      await fs.mkdir(dirPath, { recursive: true });

      // Paginer les URLs
      const parts: string[][] = [];
      for (let i = 0; i < urls.length; i += VEHICLES_MAX_PER_PART) {
        parts.push(urls.slice(i, i + VEHICLES_MAX_PER_PART));
      }

      this.logger.log(
        `   📄 Pagination: ${urls.length} URLs → ${parts.length} fichiers`,
      );

      // Écrire chaque part
      for (let i = 0; i < parts.length; i++) {
        const partNum = String(i + 1).padStart(3, '0');
        const partUrls = parts[i];
        const startIdx = i * VEHICLES_MAX_PER_PART + 1;
        const endIdx = startIdx + partUrls.length - 1;

        const prevPart =
          i > 0 ? `part-${String(i).padStart(3, '0')}.html` : null;
        const nextPart =
          i < parts.length - 1
            ? `part-${String(i + 2).padStart(3, '0')}.html`
            : null;

        const links = partUrls
          .map(
            (u) =>
              `    <li><a href="${htmlEscape(u)}">${htmlEscape(u)}</a></li>`,
          )
          .join('\n');

        const signature = generateSignature(
          partUrls.length,
          'v10-vehicles-part',
        );
        const partHtml = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="index, follow">
  <title>Constructeurs Part ${i + 1}/${parts.length} - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; }
    nav { background: #f3f4f6; padding: 10px 15px; border-radius: 8px; margin: 15px 0; }
    nav a { color: #2563eb; margin: 0 10px; }
    .meta { color: #666; font-size: 14px; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>🚗 Constructeurs - Partie ${i + 1}/${parts.length}</h1>
  <p class="meta">${partUrls.length.toLocaleString()} liens - URLs ${startIdx.toLocaleString()} à ${endIdx.toLocaleString()} sur ${urls.length.toLocaleString()}</p>
  <nav>
    <a href="index.html">← Index</a>
    ${prevPart ? `| <a href="${prevPart}">← Préc</a>` : ''}
    | <strong>Part ${i + 1}</strong>
    ${nextPart ? `| <a href="${nextPart}">Suiv →</a>` : ''}
  </nav>
  <ul>
${links}
  </ul>
  <nav>
    <a href="index.html">← Index</a>
    ${prevPart ? `| <a href="${prevPart}">← Préc</a>` : ''}
    | <strong>Part ${i + 1}</strong>
    ${nextPart ? `| <a href="${nextPart}">Suiv →</a>` : ''}
  </nav>
</body>
</html>`;

        await fs.writeFile(
          path.join(dirPath, `part-${partNum}.html`),
          partHtml,
          'utf8',
        );
      }

      // Écrire l'index constructeurs
      const indexLinks = parts
        .map((p, i) => {
          const partNum = String(i + 1).padStart(3, '0');
          const startIdx = i * VEHICLES_MAX_PER_PART + 1;
          const endIdx = startIdx + p.length - 1;
          return `    <li><a href="part-${partNum}.html">Part ${i + 1}</a> - URLs ${startIdx.toLocaleString()}-${endIdx.toLocaleString()} (${p.length.toLocaleString()} liens)</li>`;
        })
        .join('\n');

      const indexSignature = generateSignature(
        urls.length,
        'v10-vehicles-index',
      );
      const indexHtml = `<!DOCTYPE html>
${indexSignature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="index, follow">
  <title>Index Constructeurs - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #10b981; padding-bottom: 10px; }
    .summary { background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .summary strong { font-size: 24px; color: #10b981; }
    ul { list-style: none; padding: 0; }
    li { margin-bottom: 12px; padding: 12px; background: #f9f9f9; border-radius: 8px; }
    a { color: #2563eb; text-decoration: none; font-weight: 500; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>🚗 Constructeurs - Index</h1>
  <div class="summary">
    <strong>${urls.length.toLocaleString()}</strong> URLs répartis sur <strong>${parts.length}</strong> fichiers
    <br><span style="color:#666;font-size:13px">Max 5,000 URLs par fichier • ${new Date().toISOString().split('T')[0]}</span>
  </div>
  <ul>
${indexLinks}
  </ul>
  <p><a href="../index.html">← Index Principal</a></p>
</body>
</html>`;

      await fs.writeFile(path.join(dirPath, 'index.html'), indexHtml, 'utf8');
      this.logger.log(
        `   ✓ Generated constructeurs/index.html + ${parts.length} part files (${urls.length} URLs)`,
      );

      return {
        success: true,
        hubType: 'vehicules' as HubType,
        urlCount: urls.length,
        filePath: path.join(dirPath, 'index.html'),
      };
    } catch (error) {
      this.logger.error('Failed to generate vehicles hub:', error);
      return {
        success: false,
        hubType: 'vehicules' as HubType,
        urlCount: 0,
        filePath: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 🚗 Génère les hubs véhicules par marque
   * Structure: /constructeurs/{brand}/index.html + parts
   */
  async generateVehiclesByBrandHubs(): Promise<HubGenerationResult[]> {
    this.logger.log('🚗 Generating vehicle hubs BY BRAND...');
    const results: HubGenerationResult[] = [];
    const VEHICLES_MAX_PER_PART = 5000;

    try {
      // 1. Récupérer toutes les marques actives
      const { data: brands, error: brandsError } = await this.supabase
        .from('auto_marque')
        .select('marque_id, marque_alias, marque_name')
        .eq('marque_display', '1')
        .order('marque_alias');

      if (brandsError || !brands) {
        this.logger.error(`Failed to fetch brands: ${brandsError?.message}`);
        return results;
      }

      this.logger.log(`   Found ${brands.length} active brands`);

      // 2. Créer le répertoire principal
      const constructeursDir = path.join(this.OUTPUT_DIR, 'constructeurs');
      await fs.mkdir(constructeursDir, { recursive: true });

      // Stats globales
      let totalUrls = 0;
      const brandStats: Array<{
        alias: string;
        name: string;
        urlCount: number;
        partsCount: number;
      }> = [];

      // 3. Pour chaque marque, générer un hub
      for (const brand of brands) {
        const brandAlias = brand.marque_alias.toLowerCase();
        const brandDir = path.join(constructeursDir, brandAlias);
        await fs.mkdir(brandDir, { recursive: true });

        // Récupérer les URLs de cette marque (N1 + N2 uniquement)
        const urls: string[] = [];

        // N1: Page marque principale
        urls.push(
          `${this.BASE_URL}/constructeurs/${brand.marque_alias}-${brand.marque_id}.html`,
        );

        // N2: Modèles de cette marque (DISTINCT, pas de motorisations N3)
        const { data: models, error: modelsError } = await this.supabase
          .from('__sitemap_motorisation')
          .select(
            'map_marque_alias, map_marque_id, map_modele_alias, map_modele_id',
          )
          .eq('map_marque_id', brand.marque_id);

        if (modelsError) {
          this.logger.warn(
            `   ⚠️ Error fetching models for ${brandAlias}: ${modelsError.message}`,
          );
        } else if (models && models.length > 0) {
          // Dédupliquer les modèles (même modèle peut avoir plusieurs motorisations)
          const seenModels = new Set<string>();
          for (const m of models) {
            const key = `${m.map_marque_id}-${m.map_modele_id}`;
            if (
              !seenModels.has(key) &&
              m.map_marque_alias &&
              m.map_modele_alias
            ) {
              seenModels.add(key);
              urls.push(
                `${this.BASE_URL}/constructeurs/${normalizeAlias(m.map_marque_alias)}-${m.map_marque_id}/${normalizeAlias(m.map_modele_alias)}-${m.map_modele_id}.html`,
              );
            }
          }
        }

        if (urls.length === 0) {
          continue; // Skip empty brands
        }

        // Paginer les URLs
        const parts: string[][] = [];
        for (let i = 0; i < urls.length; i += VEHICLES_MAX_PER_PART) {
          parts.push(urls.slice(i, i + VEHICLES_MAX_PER_PART));
        }

        // Écrire chaque part
        for (let i = 0; i < parts.length; i++) {
          const partNum = String(i + 1).padStart(3, '0');
          const partUrls = parts[i];
          const startIdx = i * VEHICLES_MAX_PER_PART + 1;
          const endIdx = startIdx + partUrls.length - 1;

          const prevPart =
            i > 0 ? `part-${String(i).padStart(3, '0')}.html` : null;
          const nextPart =
            i < parts.length - 1
              ? `part-${String(i + 2).padStart(3, '0')}.html`
              : null;

          const links = partUrls
            .map(
              (u) =>
                `    <li><a href="${htmlEscape(u)}">${htmlEscape(u)}</a></li>`,
            )
            .join('\n');

          const signature = generateSignature(
            partUrls.length,
            `v10-brand-${brandAlias}-part`,
          );
          const partHtml = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="index, follow">
  <title>${brand.marque_name} Part ${i + 1}/${parts.length} - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; }
    nav { background: #f3f4f6; padding: 10px 15px; border-radius: 8px; margin: 15px 0; }
    nav a { color: #2563eb; margin: 0 10px; }
    .meta { color: #666; font-size: 14px; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>🚗 ${brand.marque_name} - Partie ${i + 1}/${parts.length}</h1>
  <p class="meta">${partUrls.length.toLocaleString()} liens - URLs ${startIdx.toLocaleString()} à ${endIdx.toLocaleString()} sur ${urls.length.toLocaleString()}</p>
  <nav>
    <a href="index.html">← Index ${brand.marque_name}</a>
    ${prevPart ? `| <a href="${prevPart}">← Préc</a>` : ''}
    | <strong>Part ${i + 1}</strong>
    ${nextPart ? `| <a href="${nextPart}">Suiv →</a>` : ''}
    | <a href="../index.html">Toutes marques</a>
  </nav>
  <ul>
${links}
  </ul>
  <nav>
    <a href="index.html">← Index ${brand.marque_name}</a>
    ${prevPart ? `| <a href="${prevPart}">← Préc</a>` : ''}
    | <strong>Part ${i + 1}</strong>
    ${nextPart ? `| <a href="${nextPart}">Suiv →</a>` : ''}
  </nav>
</body>
</html>`;

          await fs.writeFile(
            path.join(brandDir, `part-${partNum}.html`),
            partHtml,
            'utf8',
          );
        }

        // Index de la marque
        const indexLinks =
          parts.length > 1
            ? parts
                .map((p, i) => {
                  const partNum = String(i + 1).padStart(3, '0');
                  const startIdx = i * VEHICLES_MAX_PER_PART + 1;
                  const endIdx = startIdx + p.length - 1;
                  return `    <li><a href="part-${partNum}.html">Part ${i + 1}</a> - URLs ${startIdx.toLocaleString()}-${endIdx.toLocaleString()} (${p.length.toLocaleString()} liens)</li>`;
                })
                .join('\n')
            : `    <li><a href="part-001.html">Tous les véhicules</a> (${urls.length.toLocaleString()} liens)</li>`;

        const indexSignature = generateSignature(
          urls.length,
          `v10-brand-${brandAlias}-index`,
        );
        const indexHtml = `<!DOCTYPE html>
${indexSignature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="index, follow">
  <title>${brand.marque_name} - Véhicules - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #10b981; padding-bottom: 10px; }
    .summary { background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .summary strong { font-size: 24px; color: #10b981; }
    ul { list-style: none; padding: 0; }
    li { margin-bottom: 12px; padding: 12px; background: #f9f9f9; border-radius: 8px; }
    a { color: #2563eb; text-decoration: none; font-weight: 500; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>🚗 ${brand.marque_name}</h1>
  <div class="summary">
    <strong>${urls.length.toLocaleString()}</strong> véhicules
    ${parts.length > 1 ? `<br><span style="color:#666;font-size:13px">Répartis sur ${parts.length} fichiers • Max 5,000 URLs par fichier</span>` : ''}
  </div>
  <ul>
${indexLinks}
  </ul>
  <p><a href="../index.html">← Toutes les marques</a></p>
</body>
</html>`;

        await fs.writeFile(
          path.join(brandDir, 'index.html'),
          indexHtml,
          'utf8',
        );

        totalUrls += urls.length;
        brandStats.push({
          alias: brandAlias,
          name: brand.marque_name,
          urlCount: urls.length,
          partsCount: parts.length,
        });

        results.push({
          success: true,
          hubType: 'vehicules' as HubType,
          urlCount: urls.length,
          filePath: path.join(brandDir, 'index.html'),
        });

        this.logger.log(
          `   ✓ ${brand.marque_name}: ${urls.length} URLs in ${parts.length} part(s)`,
        );
      }

      // 4. Générer l'index principal des marques
      const brandsLinks = brandStats
        .sort((a, b) => b.urlCount - a.urlCount)
        .map(
          (b) =>
            `    <li><a href="${b.alias}/index.html">${b.name}</a> <span style="color:#666">(${b.urlCount.toLocaleString()} véhicules)</span></li>`,
        )
        .join('\n');

      const mainIndexSignature = generateSignature(
        totalUrls,
        'v10-brands-main-index',
      );
      const mainIndexHtml = `<!DOCTYPE html>
${mainIndexSignature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="index, follow">
  <title>Constructeurs par Marque - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    .summary { background: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .summary strong { font-size: 24px; color: #3b82f6; }
    ul { column-count: 2; column-gap: 30px; list-style: none; padding: 0; }
    li { margin-bottom: 10px; padding: 8px; background: #f9f9f9; border-radius: 6px; }
    a { color: #2563eb; text-decoration: none; font-weight: 500; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>🚗 Constructeurs - Index par Marque</h1>
  <div class="summary">
    <strong>${brandStats.length}</strong> marques • <strong>${totalUrls.toLocaleString()}</strong> véhicules au total
    <br><span style="color:#666;font-size:13px">Généré le ${new Date().toISOString().split('T')[0]}</span>
  </div>
  <ul>
${brandsLinks}
  </ul>
  <p><a href="../index.html">← Index Principal</a></p>
</body>
</html>`;

      await fs.writeFile(
        path.join(constructeursDir, 'index.html'),
        mainIndexHtml,
        'utf8',
      );

      this.logger.log(
        `✅ Vehicle hubs by brand complete: ${brandStats.length} brands, ${totalUrls.toLocaleString()} total URLs`,
      );

      return results;
    } catch (error) {
      this.logger.error('Failed to generate vehicle hubs by brand:', error);
      return results;
    }
  }
}
