/**
 * 📦 TYPES SITEMAP V10 - Types, interfaces et constantes partagées
 *
 * Extraits de sitemap-v10.service.ts pour usage par tous les services split:
 * - SitemapV10Service (orchestrateur)
 * - SitemapV10XmlService (écriture XML)
 * - SitemapV10DataService (data fetching)
 * - SitemapV10StaticService (générateurs statiques)
 * - SitemapV10PiecesService (streaming batch)
 */

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Interfaces de résultat ──────────────────────────────────────────────────

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
  hubResult?: {
    success: boolean;
    totalUrls: number;
    totalFiles: number;
    error?: string;
  };
}

// ── Configuration par température ───────────────────────────────────────────

export const BUCKET_CONFIG: Record<
  TemperatureBucket,
  { changefreq: string; priority: string; maxAge: number }
> = {
  hot: { changefreq: 'daily', priority: '1.0', maxAge: 3600 },
  new: { changefreq: 'daily', priority: '0.8', maxAge: 3600 },
  stable: { changefreq: 'weekly', priority: '0.6', maxAge: 86400 },
  cold: { changefreq: 'monthly', priority: '0.4', maxAge: 604800 },
};

// ── Configuration des types d'entité par bucket ─────────────────────────────

export const BUCKET_ENTITY_TYPES: Record<TemperatureBucket, EntityType[]> = {
  hot: ['gammes', 'vehicules', 'money'],
  new: [],
  stable: ['gammes', 'vehicules', 'guides'],
  cold: ['filtres', 'longtail'],
};

// ── Mapping des types d'entité vers les page_type de __seo_page ─────────────

export const ENTITY_PAGE_TYPES: Record<EntityType, string[]> = {
  gammes: ['category', 'canonical'],
  vehicules: ['listing', 'hub'],
  money: ['product', 'landing'],
  guides: ['guide', 'blog'],
  filtres: ['filter'],
  longtail: ['longtail', 'variant'],
};

// ── Constantes ──────────────────────────────────────────────────────────────

export const MAX_URLS_PER_FILE = 50000;

export const STATIC_PAGES = [
  { loc: '/', priority: '1.0', changefreq: 'daily' },
  { loc: '/constructeurs', priority: '0.8', changefreq: 'weekly' },
  { loc: '/blog', priority: '0.7', changefreq: 'daily' },
  { loc: '/diagnostic-auto', priority: '0.8', changefreq: 'weekly' },
  { loc: '/reference-auto', priority: '0.8', changefreq: 'weekly' },
  { loc: '/cgv', priority: '0.3', changefreq: 'yearly' },
  { loc: '/mentions-legales', priority: '0.3', changefreq: 'yearly' },
  { loc: '/politique-confidentialite', priority: '0.3', changefreq: 'yearly' },
  { loc: '/contact', priority: '0.4', changefreq: 'yearly' },
  { loc: '/aide', priority: '0.4', changefreq: 'monthly' },
  { loc: '/faq', priority: '0.4', changefreq: 'monthly' },
];

export const OBSOLETE_FILES = [
  'sitemap-constructeurs.xml',
  'sitemap-types.xml',
];

// ── Interface locale pour pièces V9 ────────────────────────────────────────

export interface PieceV9 {
  map_pg_alias: string;
  map_pg_id: string;
  map_marque_alias: string;
  map_marque_id: string;
  map_modele_alias: string;
  map_modele_id: string;
  map_type_alias: string;
  map_type_id: string;
}
