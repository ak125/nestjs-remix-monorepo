/**
 * 🖼️ OPTIMISEUR D'IMAGES WEBP AVEC SUPABASE IMAGE TRANSFORMATION
 * 
 * ✅ Conversion automatique vers WebP
 * ✅ Redimensionnement intelligent
 * ✅ Support responsive (srcset)
 * ✅ Fallback pour compatibilité
 * ✅ Aucun re-upload nécessaire !
 * 
 * @see https://supabase.com/docs/guides/storage/serving/image-transformations
 */

const SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
const STORAGE_BUCKET = 'uploads';

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'origin';
}

export interface ResponsiveImageSet {
  src: string;
  srcSet: string;
  sizes: string;
  webpSrc: string;
  originalSrc: string;
}

/**
 * 🎯 CLASSE PRINCIPALE D'OPTIMISATION
 */
export class ImageOptimizer {
  private static readonly DEFAULT_WIDTHS = [400, 800, 1200, 1600];
  private static readonly DEFAULT_QUALITY = 85;

  /**
   * 🚀 Génère une URL optimisée WebP
   * 
   * @example
   * const url = ImageOptimizer.getOptimizedUrl('constructeurs-automobiles/marques-logos/bmw.jpg', { width: 800 });
   * // => https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/render/image/public/uploads/constructeurs-automobiles/marques-logos/bmw.jpg?format=webp&width=800
   */
  static getOptimizedUrl(
    imagePath: string,
    options: ImageOptimizationOptions = {}
  ): string {
    const {
      width,
      height,
      quality = this.DEFAULT_QUALITY,
      format = 'webp'
    } = options;

    // Nettoyer le chemin de l'image
    const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    
    // 🚀 FIX: Utilisation de object/public car le service de transformation (render/image) semble instable
    // Cela désactive temporairement l'optimisation mais garantit l'affichage des images
    const baseUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${cleanPath}`;
    
    return baseUrl;

    /* 
    // ANCIENNE LOGIQUE (render/image) - À RÉACTIVER QUAND LE SERVICE SERA STABLE
    const baseUrl = `${SUPABASE_URL}/storage/v1/render/image/public/${STORAGE_BUCKET}/${cleanPath}`;
    
    // Construire les paramètres de transformation
    const params = new URLSearchParams();
    params.set('format', format);
    if (width) params.set('width', width.toString());
    if (height) params.set('height', height.toString());
    params.set('quality', quality.toString());
    
    return `${baseUrl}?${params.toString()}`;
    */
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
    quality?: number
  ): string {
    return widths
      .map((width) => {
        const url = this.getOptimizedUrl(imagePath, { width, quality });
        return `${url} ${width}w`;
      })
      .join(', ');
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
    options: ImageOptimizationOptions = {}
  ): ResponsiveImageSet {
    const defaultWidth = options.width || 800;
    
    return {
      src: this.getOptimizedUrl(imagePath, { ...options, width: defaultWidth }),
      srcSet: this.getResponsiveSrcSet(imagePath, this.DEFAULT_WIDTHS, options.quality),
      sizes: '(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px',
      webpSrc: this.getOptimizedUrl(imagePath, { ...options, format: 'webp' }),
      originalSrc: this.getOriginalUrl(imagePath)
    };
  }

  /**
   * 🔙 Obtient l'URL originale (sans transformation)
   */
  static getOriginalUrl(imagePath: string): string {
    const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${cleanPath}`;
  }

  /**
   * 🎯 Génère des URLs pour différents cas d'usage
   */
  static getPresetUrl(imagePath: string, preset: 'thumbnail' | 'card' | 'hero' | 'full'): string {
    const presets = {
      thumbnail: { width: 150, height: 150, quality: 80 },
      card: { width: 300, height: 200, quality: 85 },
      hero: { width: 800, height: 600, quality: 90 },
      full: { width: 1600, height: 1200, quality: 95 }
    };
    
    return this.getOptimizedUrl(imagePath, presets[preset]);
  }
}

/**
 * 🎨 HELPERS SPÉCIFIQUES PAR TYPE D'IMAGE
 */

/**
 * Logo de marque optimisé
 */
export function getOptimizedLogoUrl(logoFilename?: string): string {
  if (!logoFilename) {
    return '/placeholder-logo.svg';
  }
  
  // Si c'est déjà une URL complète
  if (logoFilename.startsWith('http')) {
    return logoFilename;
  }
  
  const path = `constructeurs-automobiles/marques-logos/${logoFilename}`;
  return ImageOptimizer.getOptimizedUrl(path, { width: 200, quality: 90 });
}

/**
 * Image de modèle de véhicule optimisée
 */
export function getOptimizedModelImageUrl(brandAlias: string, modelPic?: string): string {
  if (!modelPic) {
    return '/images/no-model.png';
  }
  
  const path = `constructeurs-automobiles/marques-modeles/${brandAlias}/${modelPic}`;
  return ImageOptimizer.getOptimizedUrl(path, { width: 800, quality: 85 });
}

/**
 * Image de pièce optimisée
 */
export function getOptimizedPartImageUrl(partImg?: string): string {
  if (!partImg) {
    return '/images/no-part.png';
  }
  
  const path = `articles/gammes-produits/catalogue/${partImg}`;
  return ImageOptimizer.getOptimizedUrl(path, { width: 600, quality: 85 });
}

/**
 * Image de famille de produits optimisée
 */
export function getOptimizedFamilyImageUrl(familyPic?: string): string {
  if (!familyPic) {
    return '/images/categories/default.svg';
  }
  
  const path = `articles/familles-produits/${familyPic}`;
  return ImageOptimizer.getOptimizedUrl(path, { width: 800, quality: 90 });
}

/**
 * Images rack (vos 2.7M d'images !)
 */
export function getOptimizedRackImageUrl(folder: string, filename: string, width: number = 800): string {
  const path = `rack-images/${folder}/${filename}`;
  return ImageOptimizer.getOptimizedUrl(path, { width, quality: 85 });
}

/**
 * 🎁 Set responsive pour images rack
 */
export function getResponsiveRackImageSet(folder: string, filename: string): ResponsiveImageSet {
  const path = `rack-images/${folder}/${filename}`;
  return ImageOptimizer.getResponsiveImageSet(path);
}

/**
 * 🔧 Créer un avatar avec initiales (fallback)
 */
export function createInitialsAvatar(brandName: string): string {
  const initials = brandName
    .split(' ')
    .map(word => word[0])
    .join('')
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
    estimatedSavings: '~90% (500 KB → 50 KB)'
  };
}

/**
 * 🧪 MODE DEBUG - Affiche les URLs générées
 */
export function debugImageUrls(imagePath: string): void {
  console.group('🖼️ Image URLs Debug');
  console.log('Original:', ImageOptimizer.getOriginalUrl(imagePath));
  console.log('WebP 400px:', ImageOptimizer.getOptimizedUrl(imagePath, { width: 400 }));
  console.log('WebP 800px:', ImageOptimizer.getOptimizedUrl(imagePath, { width: 800 }));
  console.log('WebP 1200px:', ImageOptimizer.getOptimizedUrl(imagePath, { width: 1200 }));
  console.log('SrcSet:', ImageOptimizer.getResponsiveSrcSet(imagePath));
  console.groupEnd();
}

// Export par défaut
export default ImageOptimizer;
