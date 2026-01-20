/**
 * 🖼️ HELPER CENTRALISÉ - URLs D'IMAGES PRODUITS
 *
 * Gère la construction des URLs d'images vers Supabase Storage
 * Compatible avec imgproxy pour transformation gratuite
 * Compatible avec les anciennes structures de données (pmi_folder, pmi_name)
 *
 * @see https://docs.imgproxy.net/generating_the_url
 */

// ✅ Migration 2026-01-20: Utiliser le proxy Caddy /img/* au lieu d'URLs Supabase directes
// Avantages: Cache 1 an, protection contre transformations (410 Gone), contrôle total
const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const RACK_IMAGES_BUCKET = 'rack-images';
const DEFAULT_IMAGE = '/images/pieces/default.png';

// Proxy Caddy pour images (cache 1 an, protection params)
const IMG_PROXY_BASE = '/img';

// Configuration imgproxy (transformations)
const USE_IMGPROXY = true;
const IMGPROXY_BASE_URL = 'https://www.automecanik.com/imgproxy';

/**
 * Options de transformation imgproxy
 */
export interface ImgproxyOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpg' | 'png';
  fit?: 'fit' | 'fill' | 'crop';
}

/**
 * Interface pour les données d'image depuis la BDD
 */
export interface PieceImageData {
  pmi_folder?: string | number;
  pmi_name?: string;
}

/**
 * Construit l'URL complète d'une image de pièce automobile (image brute)
 * ⚠️ PAS de transformation (désactivé pour éviter coûts $5/1000 images)
 *
 * @param imageData - Données image (pmi_folder, pmi_name)
 * @returns URL complète Supabase sans transformation
 *
 * @example
 * buildRackImageUrl({ pmi_folder: 30, pmi_name: '0986479103DRFRWHCO00MM.JPG' })
 * // → 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/rack-images/30/0986479103DRFRWHCO00MM.JPG'
 */
export function buildRackImageUrl(imageData?: PieceImageData | null): string {
  // Si pas de données d'image, retourner l'image par défaut
  if (!imageData || !imageData.pmi_folder || !imageData.pmi_name) {
    return DEFAULT_IMAGE;
  }

  // Construire l'URL via le proxy Caddy /img/* (cache 1 an, protection params)
  // Note: pmi_name contient déjà l'extension (.JPG, .webp, etc.)
  const folder = imageData.pmi_folder.toString();
  const filename = imageData.pmi_name;

  // ✅ Migration /img/* : Proxy Caddy au lieu d'URL Supabase directe
  return `${IMG_PROXY_BASE}/${RACK_IMAGES_BUCKET}/${folder}/${filename}`;
}

/**
 * Construit l'URL avec transformation WebP via Supabase Image Transform
 * ⚠️ À utiliser avec précaution : peut impacter le SEO (change l'URL)
 *
 * @param imageData - Données image (pmi_folder, pmi_name)
 * @returns URL avec transformation WebP
 */
export function buildRackImageUrlWithTransform(
  imageData?: PieceImageData | null,
): string {
  // Si pas de données, retourner défaut
  if (!imageData || !imageData.pmi_folder || !imageData.pmi_name) {
    return DEFAULT_IMAGE;
  }

  const folder = imageData.pmi_folder.toString();
  const filename = imageData.pmi_name;

  // ✅ Migration /img/* : Proxy Caddy (mêmes URLs que buildRackImageUrl)
  return `${IMG_PROXY_BASE}/${RACK_IMAGES_BUCKET}/${folder}/${filename}`;
}

/**
 * Construit les métadonnées alt/title pour l'image
 *
 * @param pieceName - Nom de la pièce
 * @param brandName - Nom de la marque équipementier
 * @param reference - Référence de la pièce
 * @returns Object avec alt et title
 */
export function buildImageMetadata(
  pieceName: string,
  brandName?: string,
  reference?: string,
): { alt: string; title: string } {
  const parts = [pieceName, brandName, reference].filter(Boolean);
  const alt = parts.join(' ');
  const title = [pieceName, reference].filter(Boolean).join(' ');

  return { alt, title };
}

/**
 * Vérifie si une URL est déjà une URL Supabase ou proxy /img/*
 * Utile pour éviter de reconstruire une URL déjà construite
 */
export function isSupabaseUrl(url: string): boolean {
  return url.includes('supabase.co/storage') || url.startsWith('/img/');
}

/**
 * Extrait le nom du bucket et le chemin depuis une URL Supabase ou /img/*
 */
export function parseSupabaseUrl(url: string): {
  bucket: string;
  path: string;
} | null {
  // Essayer le format Supabase
  const supabaseMatch = url.match(
    /\/storage\/v1\/object\/public\/([^/]+)\/(.+)/,
  );
  if (supabaseMatch) {
    return {
      bucket: supabaseMatch[1],
      path: supabaseMatch[2],
    };
  }

  // Essayer le format /img/*
  const imgMatch = url.match(/^\/img\/([^/]+)\/(.+)$/);
  if (imgMatch) {
    return {
      bucket: imgMatch[1],
      path: imgMatch[2],
    };
  }

  return null;
}

/**
 * 🚀 Construit une URL imgproxy pour transformation d'image gratuite
 *
 * @param imageData - Données image (pmi_folder, pmi_name)
 * @param options - Options de transformation (width, height, quality, format)
 * @returns URL imgproxy transformée
 *
 * @example
 * buildImgproxyUrl({ pmi_folder: 30, pmi_name: 'image.JPG' }, { width: 800 })
 * // → 'https://www.automecanik.com/imgproxy/rs:fit:800/plain/https://supabase.co/.../image.JPG@webp'
 */
export function buildImgproxyUrl(
  imageData?: PieceImageData | null,
  options: ImgproxyOptions = {},
): string {
  // Si pas de données d'image, retourner l'image par défaut
  if (!imageData || !imageData.pmi_folder || !imageData.pmi_name) {
    return DEFAULT_IMAGE;
  }

  // Si imgproxy désactivé, retourner l'URL Supabase brute
  if (!USE_IMGPROXY) {
    return buildRackImageUrl(imageData);
  }

  const folder = imageData.pmi_folder.toString();
  const filename = imageData.pmi_name;

  // URL source Supabase
  const sourceUrl = `${SUPABASE_URL}/storage/v1/object/public/${RACK_IMAGES_BUCKET}/${folder}/${filename}`;

  // Construire les options de processing
  const { width, height, quality = 85, format = 'webp', fit = 'fit' } = options;
  const processingOptions: string[] = [];

  // Resize - imgproxy requiert au moins une option avant /plain/
  if (width && height) {
    processingOptions.push(`rs:${fit}:${width}:${height}`);
  } else if (width) {
    processingOptions.push(`rs:${fit}:${width}`);
  } else if (height) {
    processingOptions.push(`rs:${fit}:0:${height}`);
  } else {
    // Passthrough: garder taille originale mais permettre conversion format
    processingOptions.push('rs:fit:0:0');
  }

  // Qualité (si différente de 85)
  if (quality !== 85) {
    processingOptions.push(`q:${quality}`);
  }

  // Construire l'URL finale
  const optionsPath =
    processingOptions.length > 0 ? processingOptions.join('/') + '/' : '';

  return `${IMGPROXY_BASE_URL}/${optionsPath}plain/${sourceUrl}@${format}`;
}

/**
 * Construit une URL imgproxy à partir d'une URL Supabase existante
 */
export function transformToImgproxyUrl(
  supabaseUrl: string,
  options: ImgproxyOptions = {},
): string {
  if (!supabaseUrl || !isSupabaseUrl(supabaseUrl)) {
    return supabaseUrl;
  }

  if (!USE_IMGPROXY) {
    return supabaseUrl;
  }

  const { width, height, quality = 85, format = 'webp', fit = 'fit' } = options;
  const processingOptions: string[] = [];

  // Resize - imgproxy requiert au moins une option avant /plain/
  if (width && height) {
    processingOptions.push(`rs:${fit}:${width}:${height}`);
  } else if (width) {
    processingOptions.push(`rs:${fit}:${width}`);
  } else if (height) {
    processingOptions.push(`rs:${fit}:0:${height}`);
  } else {
    processingOptions.push('rs:fit:0:0');
  }

  if (quality !== 85) {
    processingOptions.push(`q:${quality}`);
  }

  const optionsPath = processingOptions.join('/') + '/';

  return `${IMGPROXY_BASE_URL}/${optionsPath}plain/${supabaseUrl}@${format}`;
}
