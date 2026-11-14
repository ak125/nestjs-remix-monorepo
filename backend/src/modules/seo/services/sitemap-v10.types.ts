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

/**
 * Pages statiques de sitemap-pages.xml : seules les destinations servies en
 * 200 indexable, et non déjà portées par un autre fichier du même index.
 *
 * Retirées le 2026-11-06 (relevé HTTP du 2026-11-06, révision PROD 0b291e9b) :
 *   - `/`               → déjà unique entrée de sitemap-racine.xml
 *   - `/diagnostic-auto`→ déjà unique entrée de sitemap-diagnostic.xml
 *   - `/constructeurs`, `/cgv`, `/faq` → 404
 *   - `/blog`           → 301
 *   - `/mentions-legales`, `/politique-confidentialite` → 200 `noindex, follow`
 * Aucune de ces URL n'est modifiée ni supprimée du site : seule leur
 * déclaration dans le sitemap cesse.
 */
export const STATIC_PAGES = [
  { loc: '/reference-auto', priority: '0.8', changefreq: 'weekly' },
  { loc: '/contact', priority: '0.4', changefreq: 'yearly' },
  { loc: '/aide', priority: '0.4', changefreq: 'monthly' },
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
