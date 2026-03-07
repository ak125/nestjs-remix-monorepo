/**
 * 📄 SERVICE XML SITEMAP V10 - Écriture XML, index et cleanup
 *
 * Pure I/O : aucune dépendance base de données.
 * Responsabilités:
 * - Écriture de fichiers sitemap XML (3 variantes: bucket, static, family)
 * - Génération d'index sitemap.xml
 * - Nettoyage des fichiers obsolètes
 * - Escape XML
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SITE_ORIGIN } from '../../../config/app.config';
import {
  type TemperatureBucket,
  type SitemapUrl,
  type GenerationResult,
  BUCKET_CONFIG,
  OBSOLETE_FILES,
} from './sitemap-v10.types';

@Injectable()
export class SitemapV10XmlService {
  private readonly logger = new Logger(SitemapV10XmlService.name);
  readonly BASE_URL: string;
  readonly OUTPUT_DIR: string;

  constructor(configService: ConfigService) {
    this.BASE_URL = configService.get<string>('BASE_URL') || SITE_ORIGIN;
    this.OUTPUT_DIR =
      configService.get<string>('SITEMAP_OUTPUT_DIR') || '/var/www/sitemaps';
  }

  /**
   * Escape XML entities
   */
  xmlEscape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Écrit un fichier sitemap XML (bucket-based avec changefreq/priority)
   * @param bucket - Le bucket de température (pour la config changefreq/priority)
   * @param fileName - Le nom du fichier
   * @param urls - Les URLs à inclure
   * @param writeToRoot - Si true, écrit à la racine de OUTPUT_DIR
   */
  async writeSitemapFile(
    bucket: TemperatureBucket,
    fileName: string,
    urls: SitemapUrl[],
    writeToRoot: boolean = false,
  ): Promise<string> {
    const config = BUCKET_CONFIG[bucket];
    const dirPath = writeToRoot
      ? this.OUTPUT_DIR
      : path.join(this.OUTPUT_DIR, bucket);
    const filePath = path.join(dirPath, fileName);

    await fs.mkdir(dirPath, { recursive: true });

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
   * Écrit un fichier sitemap statique (non-temperature)
   */
  async writeStaticSitemapFile(
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
   * Écrit un fichier sitemap pour une famille thématique
   */
  async writeFamilySitemapFile(
    familyKey: string,
    fileName: string,
    urls: SitemapUrl[],
  ): Promise<string> {
    const dirPath = path.join(this.OUTPUT_DIR, 'familles');
    const filePath = path.join(dirPath, fileName);

    await fs.mkdir(dirPath, { recursive: true });

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
   * Génère l'index principal des sitemaps (depuis GenerationResult[])
   */
  async generateSitemapIndex(results: GenerationResult[]): Promise<string> {
    const indexPath = path.join(this.OUTPUT_DIR, 'sitemap.xml');
    const today = new Date().toISOString().split('T')[0];

    const sitemapEntries = results
      .flatMap((r) =>
        r.filePaths.map((fp) => {
          const relativePath = fp
            .replace(this.OUTPUT_DIR, '')
            .replace(/^\//, '');
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
   * Génère l'index principal à partir d'une liste de chemins
   */
  async generateSitemapIndexFromPaths(filePaths: string[]): Promise<string> {
    const indexPath = path.join(this.OUTPUT_DIR, 'sitemap.xml');
    const today = new Date().toISOString().split('T')[0];

    const sitemapEntries = filePaths
      .map((fp) => {
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

  /**
   * Supprime les fichiers sitemap obsolètes
   */
  async cleanupObsoleteFiles(): Promise<void> {
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
}
