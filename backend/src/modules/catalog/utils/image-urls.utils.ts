/**
 * 🖼️ HELPER CENTRALISÉ - URLs D'IMAGES PRODUITS
 *
 * ⚠️ SOURCE UNIQUE BACKEND pour toutes les URLs d'images
 * Tous les services DOIVENT importer depuis ce fichier.
 * NE PAS définir de constantes d'images locales dans les services.
 *
 * Gère la construction des URLs d'images vers Supabase Storage
 * Compatible avec imgproxy pour transformation gratuite
 * Compatible avec les anciennes structures de données (pmi_folder, pmi_name)
 *
 * @see https://docs.imgproxy.net/generating_the_url
 */

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 CONFIGURATION CENTRALISÉE - À UTILISER PARTOUT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration centralisée des URLs d'images
 * Identique à frontend/app/utils/image-optimizer.ts pour cohérence
 */
export const IMAGE_CONFIG = {
  // Base URLs
  PROXY_BASE: '/img', // Caddy proxy (prod+dev)
  IMGPROXY_BASE: '/imgproxy', // Transformation imgproxy
  DOMAIN: 'https://www.automecanik.com',

  // Buckets Supabase
  BUCKETS: {
    UPLOADS: 'uploads',
    RACK_IMAGES: 'rack-images',
  },

  // Chemins par type d'image
  PATHS: {
    GAMMES: 'articles/gammes-produits/catalogue',
    FAMILLES: 'articles/familles-produits',
    LOGOS_MARQUES: 'constructeurs-automobiles/marques-logos',
    LOGOS_EQUIPEMENTIERS: 'equipementiers-automobiles',
    MODELES: 'constructeurs-automobiles/marques-modeles',
    CONCEPTS: 'constructeurs-automobiles/marques-concepts',
  },

  // Images par défaut
  DEFAULT_IMAGE: '/images/pieces/default.png',
  DEFAULT_LOGO: '/images/categories/default.svg',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 CONSTANTES INTERNES (pour rétrocompatibilité)
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = IMAGE_CONFIG.DOMAIN;
const RACK_IMAGES_BUCKET = IMAGE_CONFIG.BUCKETS.RACK_IMAGES;
const DEFAULT_IMAGE = IMAGE_CONFIG.DEFAULT_IMAGE;
const IMG_PROXY_BASE = IMAGE_CONFIG.PROXY_BASE;
const USE_IMGPROXY = true;
const IMGPROXY_BASE_URL = `${IMAGE_CONFIG.DOMAIN}${IMAGE_CONFIG.IMGPROXY_BASE}`;

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
 * // → 'https://www.automecanik.com/img/v1/object/public/rack-images/30/0986479103DRFRWHCO00MM.JPG'
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

// ═══════════════════════════════════════════════════════════════════════════
// 🆕 NOUVELLES FONCTIONS CENTRALISÉES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construit l'URL d'une image de gamme (catalogue produits)
 *
 * @param imagePath - Chemin relatif de l'image (ex: "plaquette-de-frein.jpg")
 * @returns URL via proxy /img/uploads/articles/gammes-produits/catalogue/...
 *
 * @example
 * buildGammeImageUrl('plaquette-de-frein.jpg')
 * // → '/img/uploads/articles/gammes-produits/catalogue/plaquette-de-frein.jpg'
 */
export function buildGammeImageUrl(imagePath?: string | null): string {
  if (!imagePath) {
    return IMAGE_CONFIG.DEFAULT_IMAGE;
  }

  // Si c'est déjà une URL complète ou proxy, retourner tel quel
  if (imagePath.startsWith('http') || imagePath.startsWith('/img/')) {
    return imagePath;
  }

  return `${IMAGE_CONFIG.PROXY_BASE}/${IMAGE_CONFIG.BUCKETS.UPLOADS}/${IMAGE_CONFIG.PATHS.GAMMES}/${imagePath}`;
}

/**
 * Construit l'URL d'un logo de marque constructeur
 *
 * @param logoFilename - Nom du fichier logo (ex: "bmw.webp")
 * @returns URL via proxy /img/uploads/constructeurs-automobiles/marques-logos/...
 *
 * @example
 * buildBrandLogoUrl('bmw.webp')
 * // → '/img/uploads/constructeurs-automobiles/marques-logos/bmw.webp'
 */
export function buildBrandLogoUrl(logoFilename?: string | null): string {
  if (!logoFilename) {
    return IMAGE_CONFIG.DEFAULT_LOGO;
  }

  // Si c'est déjà une URL complète ou proxy, retourner tel quel
  if (logoFilename.startsWith('http') || logoFilename.startsWith('/img/')) {
    return logoFilename;
  }

  return `${IMAGE_CONFIG.PROXY_BASE}/${IMAGE_CONFIG.BUCKETS.UPLOADS}/${IMAGE_CONFIG.PATHS.LOGOS_MARQUES}/${logoFilename}`;
}

/**
 * Construit l'URL d'un logo d'équipementier
 *
 * @param logoFilename - Nom du fichier logo (ex: "bosch.webp")
 * @returns URL via proxy /img/uploads/equipementiers-automobiles/...
 *
 * @example
 * buildEquipementierLogoUrl('bosch.webp')
 * // → '/img/uploads/equipementiers-automobiles/bosch.webp'
 */
export function buildEquipementierLogoUrl(
  logoFilename?: string | null,
): string {
  if (!logoFilename) {
    return IMAGE_CONFIG.DEFAULT_LOGO;
  }

  // Si c'est déjà une URL complète ou proxy, retourner tel quel
  if (logoFilename.startsWith('http') || logoFilename.startsWith('/img/')) {
    return logoFilename;
  }

  return `${IMAGE_CONFIG.PROXY_BASE}/${IMAGE_CONFIG.BUCKETS.UPLOADS}/${IMAGE_CONFIG.PATHS.LOGOS_EQUIPEMENTIERS}/${logoFilename}`;
}

/**
 * Extrait le nom de base d'un modèle (sans génération/châssis)
 *
 * @param modeleAlias - Alias complet du modèle (ex: "serie-3-e46", "clio-ii")
 * @returns Nom de base sans suffixe de génération (ex: "serie-3", "clio")
 *
 * @example
 * extractBaseModelName('serie-3-e46') // → 'serie-3'
 * extractBaseModelName('clio-ii') // → 'clio'
 * extractBaseModelName('m3-coupe-e36') // → 'm3'
 * extractBaseModelName('megane-iii') // → 'megane'
 */
export function extractBaseModelName(modeleAlias: string): string {
  let base = modeleAlias
    // 1. Supprimer variantes (avec ou sans code châssis): m3-coupe-e36 → m3, z3-roadster → z3
    .replace(
      /-(coupe|break|cabriolet|berline|touring|compact|gran-coupe|roadster|convertible)(-[a-z0-9-]*)?$/i,
      '',
    )
    // 2. Supprimer codes châssis: serie-3-e46 → serie-3
    .replace(/-[a-z]\d{2,3}$/i, '')
    // 3. Supprimer chiffres romains: clio-ii → clio
    .replace(/-(i{1,3}|iv|v)$/i, '');

  // 4. Cas spéciaux BMW: toutes séries utilisent une image générique
  // M series: m3, m5, m6 → m
  // X series: x1, x3, x5, x6, x7 → x
  // Z series: z1, z3, z4 → z
  if (/^m\d$/.test(base)) {
    base = 'm';
  } else if (/^x\d$/.test(base)) {
    base = 'x';
  } else if (/^z\d$/.test(base)) {
    base = 'z';
  }

  return base;
}

/**
 * Construit l'URL d'une image de modèle de véhicule
 *
 * Stratégie:
 * 1. Si modele_pic valide → marques-modeles/{marque}/{modele_pic}
 * 2. Sinon → marques-concepts/{marque}/{baseModel}.webp
 *
 * @param brandAlias - Alias de la marque (ex: "renault")
 * @param modelPic - Nom de l'image du modèle (ex: "megane-iii.webp")
 * @param modelAlias - Alias du modèle pour fallback (ex: "megane-iii")
 * @returns URL via proxy /img/uploads/constructeurs-automobiles/...
 *
 * @example
 * buildModelImageUrl('renault', 'megane-iii.webp')
 * // → '/img/uploads/constructeurs-automobiles/marques-modeles/renault/megane-iii.webp'
 *
 * @example
 * buildModelImageUrl('bmw', 'no.webp', 'serie-3-e46')
 * // → '/img/uploads/constructeurs-automobiles/marques-concepts/bmw/serie-3.webp'
 */
export function buildModelImageUrl(
  brandAlias?: string | null,
  modelPic?: string | null,
  modelAlias?: string | null,
): string {
  if (!brandAlias) {
    return IMAGE_CONFIG.DEFAULT_LOGO;
  }

  // 1. Si modele_pic valide (pas no.webp), utiliser marques-modeles
  if (modelPic && modelPic !== 'no.webp') {
    return `${IMAGE_CONFIG.PROXY_BASE}/${IMAGE_CONFIG.BUCKETS.UPLOADS}/${IMAGE_CONFIG.PATHS.MODELES}/${brandAlias}/${modelPic}`;
  }

  // 2. Essayer marques-modeles avec l'alias complet (images spécifiques: x5-e53.webp, serie-3-e46.webp)
  // Le frontend gère le fallback logo via onError si 404
  if (modelAlias) {
    return `${IMAGE_CONFIG.PROXY_BASE}/${IMAGE_CONFIG.BUCKETS.UPLOADS}/${IMAGE_CONFIG.PATHS.MODELES}/${brandAlias}/${modelAlias}.webp`;
  }

  return IMAGE_CONFIG.DEFAULT_LOGO;
}

/**
 * Construit l'URL d'une image de famille de produits
 *
 * @param familyPic - Nom de l'image de famille (ex: "freinage.jpg")
 * @returns URL via proxy /img/uploads/articles/familles-produits/...
 *
 * @example
 * buildFamilyImageUrl('freinage.jpg')
 * // → '/img/uploads/articles/familles-produits/freinage.jpg'
 */
export function buildFamilyImageUrl(familyPic?: string | null): string {
  if (!familyPic) {
    return IMAGE_CONFIG.DEFAULT_IMAGE;
  }

  // Si c'est déjà une URL complète ou proxy, retourner tel quel
  if (familyPic.startsWith('http') || familyPic.startsWith('/img/')) {
    return familyPic;
  }

  return `${IMAGE_CONFIG.PROXY_BASE}/${IMAGE_CONFIG.BUCKETS.UPLOADS}/${IMAGE_CONFIG.PATHS.FAMILLES}/${familyPic}`;
}

/**
 * Construit une URL générique via le proxy /img
 * Pour les cas où le chemin complet est connu
 *
 * @param bucket - Nom du bucket (ex: "uploads", "rack-images")
 * @param path - Chemin dans le bucket
 * @returns URL via proxy /img/{bucket}/{path}
 *
 * @example
 * buildProxyImageUrl('uploads', 'articles/gammes-produits/catalogue/freins.jpg')
 * // → '/img/uploads/articles/gammes-produits/catalogue/freins.jpg'
 */
export function buildProxyImageUrl(bucket: string, path: string): string {
  if (!path) {
    return IMAGE_CONFIG.DEFAULT_IMAGE;
  }

  return `${IMAGE_CONFIG.PROXY_BASE}/${bucket}/${path}`;
}

/**
 * Construit une URL OG image absolue via imgproxy (1200x630, webp, q85)
 *
 * Les URLs OG DOIVENT etre absolues (Facebook/LinkedIn/Twitter l'exigent).
 * Les parametres imgproxy sont stables pour eviter un re-scrape social.
 *
 * @param sourcePath - Chemin relatif Supabase (ex: "articles/gammes-produits/catalogue/disque-frein.jpg")
 *                     ou URL complete Supabase
 * @returns URL absolue https://www.automecanik.com/imgproxy/...@webp
 *
 * @example
 * buildOgImageUrl('articles/gammes-produits/catalogue/disque-frein.jpg')
 * // → 'https://www.automecanik.com/imgproxy/rs:fit:1200:630/q:85/plain/https://www.automecanik.com/storage/v1/object/public/uploads/articles/gammes-produits/catalogue/disque-frein.jpg@webp'
 *
 * @example
 * buildOgImageUrl(null) // → 'https://www.automecanik.com/logo-og.webp'
 */
export function buildOgImageUrl(sourcePath?: string | null): string {
  if (!sourcePath || sourcePath === 'no.webp') {
    return `${IMAGE_CONFIG.DOMAIN}/logo-og.webp`;
  }

  // Si deja une URL absolue, l'utiliser directement comme source
  const sourceUrl = sourcePath.startsWith('http')
    ? sourcePath
    : `${IMAGE_CONFIG.DOMAIN}/storage/v1/object/public/${IMAGE_CONFIG.BUCKETS.UPLOADS}/${sourcePath}`;

  return `${IMGPROXY_BASE_URL}/rs:fit:1200:630/q:85/plain/${sourceUrl}@webp`;
}
