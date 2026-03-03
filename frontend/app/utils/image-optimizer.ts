/**
 * 🖼️ HELPER IMAGES - IMGPROXY TRANSFORMATION GRATUITE
 *
 * ⚠️ SOURCE UNIQUE FRONTEND pour toutes les URLs d'images
 * Tous les composants DOIVENT importer depuis ce fichier.
 * NE PAS définir de constantes d'images locales dans les composants.
 *
 * ✅ Transformation via imgproxy (self-hosted, $0)
 * ✅ WebP/AVIF automatique selon Accept header
 * ✅ Resize on-the-fly (fit, fill, crop)
 * ✅ Cache 1 an via Cloudflare CDN
 *
 * @see https://docs.imgproxy.net/generating_the_url
 */

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 CONFIGURATION CENTRALISÉE - Identique à backend/image-urls.utils.ts
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration centralisée des URLs d'images
 * Identique à backend/src/modules/catalog/utils/image-urls.utils.ts pour cohérence
 *
 * ⚠️ CSP: Le domaine DOMAIN doit être dans backend/src/config/csp.config.ts → IMAGE_DOMAINS
 */
import { logger } from "~/utils/logger";

export const IMAGE_CONFIG = {
  // Base URLs
  PROXY_BASE: "/img", // Caddy proxy (prod+dev)
  IMGPROXY_BASE: "/imgproxy", // Transformation imgproxy
  DOMAIN: "https://www.automecanik.com", // ← Doit matcher CSP IMAGE_DOMAINS.IMGPROXY

  // Buckets Supabase
  BUCKETS: {
    UPLOADS: "uploads",
    RACK_IMAGES: "rack-images",
  },

  // Chemins par type d'image
  PATHS: {
    GAMMES: "articles/gammes-produits/catalogue",
    FAMILLES: "articles/familles-produits",
    LOGOS_MARQUES: "constructeurs-automobiles/marques-logos",
    LOGOS_EQUIPEMENTIERS: "equipementiers-automobiles",
    MODELES: "constructeurs-automobiles/marques-modeles",
  },

  // Images par défaut
  DEFAULT_IMAGE: "/images/pieces/default.png",
  DEFAULT_LOGO: "/images/categories/default.svg",
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 CONSTANTES INTERNES (pour rétrocompatibilité)
// ═══════════════════════════════════════════════════════════════════════════

// 🚀 Configuration imgproxy
const USE_IMGPROXY = true; // Basculer à false pour désactiver transformations

// ✅ FIX 2026-01-20: Toujours utiliser imgproxy (même en dev)
// - Évite facturation Supabase en dev (requêtes directes = facturées)
// - Même comportement prod/dev = moins de bugs
// - URLs imgproxy pointent vers automecanik.com donc pas de CSP issues
const USE_IMGPROXY_RUNTIME = USE_IMGPROXY;

const PROXY_BASE_URL = IMAGE_CONFIG.DOMAIN;

// Source pour imgproxy (l'utilisateur ne voit jamais cette URL)
const SUPABASE_STORAGE_URL = `${typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL ? process.env.VITE_SUPABASE_URL : "https://cxpojprgwgubzjyqzmoq.supabase.co"}/storage/v1/object/public`;
const DEFAULT_BUCKET = IMAGE_CONFIG.BUCKETS.UPLOADS;

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: "webp" | "avif" | "origin";
}

export interface ResponsiveImageSet {
  src: string;
  srcSet: string;
  sizes: string;
  webpSrc: string;
  originalSrc: string;
}

/**
 * 🚀 LCP Optimization: Picture-ready image set for AVIF/WebP with fallback
 * Used by <picture> elements for optimal format delivery
 */
export interface PictureImageSet {
  avifSrcSet: string;
  webpSrcSet: string;
  fallbackSrc: string;
  sizes: string;
  width?: number;
  height?: number;
}

/**
 * 🎯 CLASSE PRINCIPALE D'OPTIMISATION
 */
export class ImageOptimizer {
  private static readonly DEFAULT_WIDTHS = [400, 800, 1200, 1600];
  private static readonly DEFAULT_QUALITY = 85;

  /**
   * 🚀 Génère une URL optimisée via imgproxy
   *
   * imgproxy transforme les images on-the-fly:
   * - Resize (fit, fill, crop)
   * - WebP/AVIF automatique selon Accept header
   * - Cache 1 an via Cloudflare CDN
   *
   * @example
   * const url = ImageOptimizer.getOptimizedUrl('constructeurs-automobiles/marques-logos/bmw.jpg', { width: 800 });
   * // => /imgproxy/rs:fit:800/q:85/plain/https://supabase.co/.../bmw.jpg@webp
   *
   * @example
   * const url = ImageOptimizer.getOptimizedUrl('rack-images/101/image.jpg', { width: 600 });
   * // => /imgproxy/rs:fit:600/q:85/plain/https://supabase.co/.../image.jpg@webp
   */
  static getOptimizedUrl(
    imagePath: string,
    options: ImageOptimizationOptions = {},
  ): string {
    const {
      width,
      height,
      quality = this.DEFAULT_QUALITY,
      format = "webp",
    } = options;

    // Nettoyer le chemin de l'image
    const cleanPath = imagePath.startsWith("/")
      ? imagePath.slice(1)
      : imagePath;

    // Détecter dynamiquement le bucket
    let bucket: string = DEFAULT_BUCKET;
    let actualPath = cleanPath;

    if (cleanPath.startsWith("rack-images/")) {
      bucket = "rack-images";
      actualPath = cleanPath.replace("rack-images/", "");
    } else if (cleanPath.startsWith("uploads/")) {
      // ✅ FIX 2026-01-18: Gérer le prefix uploads/ pour éviter double bucket
      // Quand l'URL Supabase complète est parsée, le path inclut déjà "uploads/"
      bucket = "uploads";
      actualPath = cleanPath.replace("uploads/", "");
    }

    // Si imgproxy désactivé, utiliser proxy /img direct
    if (!USE_IMGPROXY_RUNTIME) {
      return `${SUPABASE_STORAGE_URL}/${bucket}/${actualPath}`;
    }

    // 🚀 Construire l'URL imgproxy
    // Format: /imgproxy/{processing_options}/plain/{source_url}@{format}
    // Source via /img proxy (Caddy → Supabase)
    const sourceUrl = `${SUPABASE_STORAGE_URL}/${bucket}/${actualPath}`;

    // Options de processing imgproxy
    const processingOptions: string[] = [];

    // Resize: rs:fit:{width}:{height} ou rs:fit:{width}
    // Note: imgproxy requiert au moins une option de processing avant /plain/
    if (width && height) {
      processingOptions.push(`rs:fit:${width}:${height}`);
    } else if (width) {
      processingOptions.push(`rs:fit:${width}`);
    } else if (height) {
      processingOptions.push(`rs:fit:0:${height}`);
    } else {
      // Passthrough: garder taille originale mais permettre conversion format
      processingOptions.push("rs:fit:0:0");
    }

    // Qualité: q:{quality}
    if (quality && quality !== 85) {
      processingOptions.push(`q:${quality}`);
    }

    // Construire l'URL finale
    const optionsPath =
      processingOptions.length > 0 ? processingOptions.join("/") + "/" : "";

    // Format de sortie (webp par défaut pour auto-détection Accept header)
    const outputFormat = format === "origin" ? "" : `@${format}`;

    return `${PROXY_BASE_URL}/imgproxy/${optionsPath}plain/${sourceUrl}${outputFormat}`;
  }

  /**
   * 🎨 Génère un srcSet complet pour images responsive
   *
   * @example
   * const srcSet = ImageOptimizer.getResponsiveSrcSet('articles/familles-produits/piece.jpg');
   * // => "https://...?width=400 400w, https://...?width=800 800w, ..."
   */
  static getResponsiveSrcSet(
    imagePath: string,
    widths: number[] = this.DEFAULT_WIDTHS,
    quality?: number,
  ): string {
    return widths
      .map((width) => {
        const url = this.getOptimizedUrl(imagePath, { width, quality });
        return `${url} ${width}w`;
      })
      .join(", ");
  }

  /**
   * 📱 Génère un set d'images responsive complet
   *
   * @example
   * const { src, srcSet, sizes } = ImageOptimizer.getResponsiveImageSet('logos/bmw.jpg');
   * <img src={src} srcSet={srcSet} sizes={sizes} />
   */
  static getResponsiveImageSet(
    imagePath: string,
    options: ImageOptimizationOptions = {},
  ): ResponsiveImageSet {
    const defaultWidth = options.width || 800;

    return {
      src: this.getOptimizedUrl(imagePath, { ...options, width: defaultWidth }),
      srcSet: this.getResponsiveSrcSet(
        imagePath,
        this.DEFAULT_WIDTHS,
        options.quality,
      ),
      sizes: "(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px",
      webpSrc: this.getOptimizedUrl(imagePath, { ...options, format: "webp" }),
      originalSrc: this.getOriginalUrl(imagePath),
    };
  }

  /**
   * 🚀 LCP Optimization: Generates picture-ready image set for AVIF/WebP
   *
   * Returns srcSet strings for both AVIF and WebP formats to be used
   * with <picture> elements for optimal format delivery.
   * AVIF is 25-35% smaller than WebP for supported browsers.
   *
   * @example
   * const { avifSrcSet, webpSrcSet, fallbackSrc, sizes } = ImageOptimizer.getPictureImageSet('logos/bmw.jpg');
   * <picture>
   *   <source srcSet={avifSrcSet} type="image/avif" sizes={sizes} />
   *   <source srcSet={webpSrcSet} type="image/webp" sizes={sizes} />
   *   <img src={fallbackSrc} alt="..." loading="lazy" decoding="async" />
   * </picture>
   */
  static getPictureImageSet(
    imagePath: string,
    options: {
      widths?: number[];
      quality?: number;
      sizes?: string;
      width?: number;
      height?: number;
    } = {},
  ): PictureImageSet {
    const {
      widths = this.DEFAULT_WIDTHS,
      quality = this.DEFAULT_QUALITY,
      sizes = "(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px",
      width,
      height,
    } = options;

    // Generate AVIF srcSet
    const avifSrcSet = widths
      .map((w) => {
        const url = this.getOptimizedUrl(imagePath, {
          width: w,
          quality,
          format: "avif",
        });
        return `${url} ${w}w`;
      })
      .join(", ");

    // Generate WebP srcSet
    const webpSrcSet = widths
      .map((w) => {
        const url = this.getOptimizedUrl(imagePath, {
          width: w,
          quality,
          format: "webp",
        });
        return `${url} ${w}w`;
      })
      .join(", ");

    // Fallback to WebP at default width
    const fallbackSrc = this.getOptimizedUrl(imagePath, {
      width: width || 800,
      quality,
      format: "webp",
    });

    return {
      avifSrcSet,
      webpSrcSet,
      fallbackSrc,
      sizes,
      width,
      height,
    };
  }

  /**
   * 🔙 Obtient l'URL originale (sans transformation, mais via proxy pour cache)
   * ✅ Migration 2026-01-21: Toujours utiliser /img/* proxy
   * - En prod: Caddy gère le proxy vers Supabase + cache 1 an
   * - En dev: Vite proxy redirige vers Supabase (configuré dans vite.config.ts)
   */
  static getOriginalUrl(imagePath: string): string {
    const cleanPath = imagePath.startsWith("/")
      ? imagePath.slice(1)
      : imagePath;

    // Détecter le bucket
    let bucket: string = DEFAULT_BUCKET;
    let actualPath = cleanPath;

    if (cleanPath.startsWith("rack-images/")) {
      bucket = "rack-images";
      actualPath = cleanPath.replace("rack-images/", "");
    } else if (cleanPath.startsWith("uploads/")) {
      // ✅ FIX 2026-01-18: Gérer le prefix uploads/ pour éviter double bucket
      bucket = "uploads";
      actualPath = cleanPath.replace("uploads/", "");
    }

    // ✅ Toujours utiliser le proxy /img/* (fonctionne en dev ET prod)
    return `/img/${bucket}/${actualPath}`;
  }

  /**
   * 🔙 Obtient l'URL via proxy /img (pour debug uniquement)
   */
  static getDirectSupabaseUrl(imagePath: string): string {
    const cleanPath = imagePath.startsWith("/")
      ? imagePath.slice(1)
      : imagePath;
    return `${SUPABASE_STORAGE_URL}/${DEFAULT_BUCKET}/${cleanPath}`;
  }

  /**
   * 🎯 Génère des URLs pour différents cas d'usage
   */
  static getPresetUrl(
    imagePath: string,
    preset: "thumbnail" | "card" | "hero" | "full",
  ): string {
    const presets = {
      thumbnail: { width: 150, height: 150, quality: 80 },
      card: { width: 300, height: 200, quality: 85 },
      hero: { width: 800, height: 600, quality: 90 },
      full: { width: 1600, height: 1200, quality: 95 },
    };

    return this.getOptimizedUrl(imagePath, presets[preset]);
  }
}

/**
 * 🎨 HELPERS SPÉCIFIQUES PAR TYPE D'IMAGE
 */

/**
 * Logo de marque optimisé
 *
 * @param logoFilename - Nom du fichier OU chemin complet
 *
 * @example
 * // Juste un filename → préfixé avec constructeurs-automobiles/marques-logos/
 * getOptimizedLogoUrl("bmw.webp")
 *
 * @example
 * // Chemin complet → utilisé tel quel
 * getOptimizedLogoUrl("equipementiers-automobiles/aisin.webp")
 *
 * 📝 FIX 2026-01-17: Si le fichier est déjà .webp, utiliser format "origin"
 * pour éviter la double extension .webp@webp qui cause des 404
 */
export function getOptimizedLogoUrl(logoFilename?: string): string {
  if (!logoFilename) {
    return "/images/categories/default.svg";
  }

  // Si c'est déjà une URL complète
  if (logoFilename.startsWith("http")) {
    return logoFilename;
  }

  // ✅ FIX 2026-01-17: Si le filename contient déjà un "/", c'est un chemin complet
  // Sinon, préfixer avec le dossier par défaut (constructeurs-automobiles/marques-logos/)
  const path = logoFilename.includes("/")
    ? logoFilename // Chemin complet: "equipementiers-automobiles/aisin.webp"
    : `constructeurs-automobiles/marques-logos/${logoFilename}`; // Juste un filename: "bmw.webp"

  // ✅ FIX: Si le fichier est déjà .webp, pas de conversion format
  // pour éviter bosch.webp → bosch.webp@webp → 404
  const isWebp = logoFilename.toLowerCase().endsWith(".webp");
  return ImageOptimizer.getOptimizedUrl(path, {
    width: 200,
    quality: 90,
    format: isWebp ? "origin" : "webp",
  });
}

/**
 * Image de modèle de véhicule optimisée
 * Utilise l'URL directe car les images sont déjà en .webp sur Supabase
 *
 * @param pathOrBrandAlias - Chemin complet OU alias de la marque
 * @param modelPic - Nom de l'image (optionnel si pathOrBrandAlias est le chemin complet)
 *
 * @example
 * // Avec chemin complet (nouveau comportement)
 * getOptimizedModelImageUrl("constructeurs-automobiles/marques-modeles/renault/megane-iii.webp")
 *
 * @example
 * // Avec deux arguments (ancien comportement)
 * getOptimizedModelImageUrl("renault", "megane-iii.webp")
 */
export function getOptimizedModelImageUrl(
  pathOrBrandAlias: string,
  modelPic?: string,
): string {
  let path: string;

  if (modelPic) {
    // Ancien comportement: deux arguments (brandAlias, modelPic)
    if (modelPic === "no.webp") {
      return "/images/categories/default.svg";
    }
    // Chemin correct: marques-modeles (dossier réel dans Supabase)
    path = `constructeurs-automobiles/marques-modeles/${pathOrBrandAlias}/${modelPic}`;
  } else {
    // Nouveau comportement: chemin complet passé directement
    // Vérifier si c'est un chemin valide
    if (
      !pathOrBrandAlias ||
      pathOrBrandAlias.endsWith("no.webp") ||
      pathOrBrandAlias.endsWith("/undefined") ||
      pathOrBrandAlias.endsWith("/null")
    ) {
      return "/images/categories/default.svg";
    }
    path = pathOrBrandAlias;
  }

  return ImageOptimizer.getOriginalUrl(path);
}

/**
 * Image de pièce optimisée
 */
/** Vérifie si un chemin d'image est valide (pas null, pas "no.webp", pas undefined) */
export function isValidImagePath(path?: string | null): boolean {
  if (!path) return false;
  if (path === "no.webp") return false;
  if (path.endsWith("/no.webp")) return false;
  if (path.endsWith("/undefined") || path.endsWith("/null")) return false;
  return true;
}

export function getOptimizedPartImageUrl(partImg?: string): string {
  if (!partImg) {
    return "/images/categories/default.svg"; // FIX: utiliser placeholder existant
  }

  const path = `articles/gammes-produits/catalogue/${partImg}`;
  return ImageOptimizer.getOptimizedUrl(path, { width: 600, quality: 85 });
}

/**
 * Image de famille de produits optimisée
 */
export function getOptimizedFamilyImageUrl(familyPic?: string): string {
  if (!familyPic) {
    return "/images/categories/default.svg";
  }

  const path = `articles/familles-produits/${familyPic}`;
  return ImageOptimizer.getOptimizedUrl(path, { width: 800, quality: 90 });
}

/**
 * Images rack (vos 2.7M d'images !)
 */
export function getOptimizedRackImageUrl(
  folder: string,
  filename: string,
  width: number = 800,
): string {
  const path = `rack-images/${folder}/${filename}`;
  return ImageOptimizer.getOptimizedUrl(path, { width, quality: 85 });
}

/**
 * 🎁 Set responsive pour images rack
 */
export function getResponsiveRackImageSet(
  folder: string,
  filename: string,
): ResponsiveImageSet {
  const path = `rack-images/${folder}/${filename}`;
  return ImageOptimizer.getResponsiveImageSet(path);
}

/**
 * 🔧 Créer un avatar avec initiales (fallback)
 */
export function createInitialsAvatar(brandName: string): string {
  const initials = brandName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  return `https://ui-avatars.com/api/?name=${initials}&size=48&background=f1f5f9&color=475569&font-size=0.6`;
}

/**
 * 📊 STATISTIQUES & DEBUG
 */
export function compareImageSizes(imagePath: string): {
  original: string;
  webp: string;
  estimatedSavings: string;
} {
  return {
    original: ImageOptimizer.getOriginalUrl(imagePath),
    webp: ImageOptimizer.getOptimizedUrl(imagePath, { width: 800 }),
    estimatedSavings: "~90% (500 KB → 50 KB)",
  };
}

/**
 * 🧪 MODE DEBUG - Affiche les URLs générées
 */
export function debugImageUrls(imagePath: string): void {
  logger.log("🖼️ Image URLs Debug");
  logger.log(
    "Proxy 400px:",
    ImageOptimizer.getOptimizedUrl(imagePath, { width: 400 }),
  );
  logger.log(
    "Proxy 800px:",
    ImageOptimizer.getOptimizedUrl(imagePath, { width: 800 }),
  );
  logger.log(
    "Proxy 1200px:",
    ImageOptimizer.getOptimizedUrl(imagePath, { width: 1200 }),
  );
  logger.log("Proxy Original:", ImageOptimizer.getOriginalUrl(imagePath));
  logger.log(
    "Direct Supabase:",
    ImageOptimizer.getDirectSupabaseUrl(imagePath),
  );
  logger.log("SrcSet:", ImageOptimizer.getResponsiveSrcSet(imagePath));
  logger.log("--- End Image URLs Debug ---");
}

// Export par défaut
export default ImageOptimizer;
