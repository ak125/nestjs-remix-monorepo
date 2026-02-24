import { Injectable, Logger } from '@nestjs/common';

/**
 * Shared text-processing utilities extracted from conseil-enricher and buying-guide-enricher.
 *
 * Duplicated methods consolidated here:
 * - anonymizeContent  (conseil-enricher L1468, buying-guide-enricher L2015)
 * - stripHtml         (conseil-enricher L1664)
 * - restoreAccents    (conseil-enricher L1783, buying-guide-enricher L2046)
 * - truncateText      (conseil-enricher L1657)
 * - extractBulletList (buying-guide-enricher L1364, alias of extractListItems in conseil L1618)
 */
@Injectable()
export class EnricherTextUtils {
  private readonly logger = new Logger(EnricherTextUtils.name);

  /**
   * Merged OEM brand list from both enrichers.
   * conseil-enricher adds: Mahle, Mann, Behr, Pierburg, Hengst, Bilstein, Monroe, KYB, Febi, Meyle, Lemförder, Corteco, Elring
   * buying-guide-enricher adds: Victor Reinz, Mann Filter, Purflux
   */
  static readonly OEM_BRANDS = [
    'DENSO',
    'Bosch',
    'Valeo',
    'Continental',
    'Hella',
    'Sachs',
    'LuK',
    'TRW',
    'Brembo',
    'ATE',
    'Delphi',
    'SKF',
    'INA',
    'FAG',
    'Gates',
    'Dayco',
    'NGK',
    'Magneti Marelli',
    'ZF',
    'Aisin',
    'NTN',
    'SNR',
    'Febi',
    'Meyle',
    'Lemförder',
    'Corteco',
    'Elring',
    'Mahle',
    'Mann',
    'Mann Filter',
    'Behr',
    'Pierburg',
    'Hengst',
    'Bilstein',
    'Monroe',
    'KYB',
    'Victor Reinz',
    'Purflux',
  ];

  /**
   * Remove OEM brand names, self-promotional phrases, and third-party URLs.
   * Content must read as AutoMecanik technical knowledge, not manufacturer copy.
   *
   * Combines both enricher variants:
   * - conseil-enricher: single forward-pass replace per brand
   * - buying-guide-enricher: two-pass replace (leading and trailing whitespace)
   *
   * Copied from buying-guide-enricher.service.ts L2015 (superset of conseil variant).
   */
  anonymizeContent(text: string): string {
    if (!text) return text;
    let result = text;
    for (const brand of EnricherTextUtils.OEM_BRANDS) {
      const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`\\b${escaped}\\b\\s*`, 'gi'), '');
      result = result.replace(new RegExp(`\\s*\\b${escaped}\\b`, 'gi'), '');
    }
    // Remove self-promotional phrases
    result = result.replace(
      /\b(chez|par|de|from)\s+(nous|notre|our)\b[^.]*\./gi,
      '',
    );
    // Remove third-party URLs
    result = result.replace(/https?:\/\/[^\s)]+/g, '');
    // Clean multiple spaces
    return result.replace(/\s{2,}/g, ' ').trim();
  }

  /**
   * Strip HTML tags and HTML entities for fair text-length comparison.
   *
   * Copied from conseil-enricher.service.ts L1664.
   */
  stripHtml(html: string): string {
    if (!html) return html;
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  /**
   * Restore common French accents missing from YAML source files.
   * Band-aid fix until YAML gamme files are regenerated with proper accents.
   *
   * Copied from conseil-enricher.service.ts L1783 and buying-guide-enricher.service.ts L2046
   * (identical implementations).
   */
  restoreAccents(text: string): string {
    if (!text) return text;
    const ACCENT_MAP: Array<[RegExp, string]> = [
      [/\bequipements?\b/gi, 'équipement'],
      [/\belectriques?\b/gi, 'électrique'],
      [/\bvehicules?\b/gi, 'véhicule'],
      [/\bverifi/gi, 'vérifi'],
      [/\bgeneral\b/gi, 'général'],
      [/\bsecurite\b/gi, 'sécurité'],
      [/\bprecedent/gi, 'précédent'],
      [/\bdefaut\b/gi, 'défaut'],
      [/\bdetect/gi, 'détect'],
      [/\bdegradation/gi, 'dégradation'],
      [/\bcontrole\b/gi, 'contrôle'],
      [/\bmodele\b/gi, 'modèle'],
      [/\bannee\b/gi, 'année'],
      [/\bspecifi/gi, 'spécifi'],
      [/\breferen/gi, 'référen'],
      [/\bprocedure\b/gi, 'procédure'],
      [/\bcomplete\b/gi, 'complète'],
      [/\bpieces\b/gi, 'pièces'],
      [/\bpiece\b/gi, 'pièce'],
      [/\belectri/gi, 'électri'],
      [/\benergie\b/gi, 'énergie'],
      [/\bnecessaire\b/gi, 'nécessaire'],
      [/\bpreventif\b/gi, 'préventif'],
    ];
    let result = text;
    for (const [pattern, replacement] of ACCENT_MAP) {
      result = result.replace(pattern, (match) => {
        // Preserve plural suffix
        const suffix =
          match.endsWith('s') && !replacement.endsWith('s') ? 's' : '';
        return replacement + suffix;
      });
    }
    return result;
  }

  /**
   * Truncate text to maxLen characters, breaking at word boundary, stripping
   * leading markdown headings.
   *
   * Copied from conseil-enricher.service.ts L1657.
   */
  truncateText(text: string, maxLen: number): string {
    if (!text) return text;
    const cleaned = text.replace(/^#{1,4}\s+.+\n/, '').trim();
    if (cleaned.length <= maxLen) return cleaned;
    return cleaned.slice(0, maxLen).replace(/\s+\S*$/, '') + '...';
  }

  /**
   * Extract bullet-list items from a markdown section.
   * Strips leading list markers, **bold** and *italic* markdown.
   * Keeps lines with length >= 10.
   *
   * Copied from buying-guide-enricher.service.ts L1364 (extractBulletList).
   * The conseil-enricher equivalent (extractListItems L1618) adds extra filters
   * (max 300 chars, no pipe, no "Produits" header) — use extractListItems() for
   * those stricter cases.
   */
  extractBulletList(markdown: string): string[] {
    if (!markdown) return [];
    return markdown
      .split('\n')
      .map((line) =>
        line
          .replace(/^[-•*\d.)\s]+/, '') // Strip leading list markers
          .replace(/\*\*(.+?)\*\*/g, '$1') // Strip **bold** markdown
          .replace(/\*(.+?)\*/g, '$1') // Strip *italic* markdown
          .trim(),
      )
      .filter((line) => line.length >= 10);
  }

  /**
   * Stricter variant of extractBulletList: also strips markdown headings,
   * enforces max 300 chars, excludes pipe/nav lines and "Produits" headers.
   *
   * Copied from conseil-enricher.service.ts L1618 (extractListItems).
   */
  extractListItems(chunk: string): string[] {
    if (!chunk) return [];
    return chunk
      .split('\n')
      .map((line) =>
        line
          .replace(/^[-•*\d.)\s]+/, '')
          .replace(/^#{1,4}\s+/, '')
          .trim(),
      )
      .filter(
        (line) =>
          line.length >= 15 &&
          line.length <= 300 &&
          !line.includes('|') && // Skip breadcrumb/nav lines
          !/^(Produits|Products)\b/i.test(line), // Skip product nav headers
      );
  }
}
