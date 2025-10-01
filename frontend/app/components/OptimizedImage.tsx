/**
 * 🖼️ COMPOSANT IMAGE OPTIMISÉ AVEC WEBP AUTOMATIQUE
 * 
 * ✅ Conversion WebP automatique via Supabase
 * ✅ Images responsive (srcset)
 * ✅ Lazy loading natif
 * ✅ Fallback automatique
 * ✅ Préchargement intelligent
 */

import { useState, useEffect } from 'react';
import ImageOptimizer, { type ImageOptimizationOptions } from '~/utils/image-optimizer';

interface OptimizedImageProps {
  /** Chemin de l'image dans Supabase Storage (ex: 'articles/familles-produits/piece.jpg') */
  imagePath: string;
  
  /** Texte alternatif pour l'accessibilité */
  alt: string;
  
  /** Largeur par défaut */
  width?: number;
  
  /** Hauteur par défaut */
  height?: number;
  
  /** Qualité (0-100, défaut: 85) */
  quality?: number;
  
  /** Classes CSS supplémentaires */
  className?: string;
  
  /** Active le lazy loading (défaut: true) */
  lazy?: boolean;
  
  /** Active le mode responsive avec srcset (défaut: true) */
  responsive?: boolean;
  
  /** Preset prédéfini ('thumbnail' | 'card' | 'hero' | 'full') */
  preset?: 'thumbnail' | 'card' | 'hero' | 'full';
  
  /** Fonction appelée au chargement */
  onLoad?: () => void;
  
  /** Fonction appelée en cas d'erreur */
  onError?: () => void;
  
  /** Image de fallback en cas d'erreur */
  fallbackSrc?: string;
}

/**
 * 🎯 Composant Image Optimisé
 * 
 * @example
 * // Simple
 * <OptimizedImage 
 *   imagePath="articles/familles-produits/piece.jpg" 
 *   alt="Pièce auto" 
 * />
 * 
 * @example
 * // Avec options
 * <OptimizedImage 
 *   imagePath="rack-images/13/IMG_0001.jpg"
 *   alt="Image produit"
 *   width={800}
 *   quality={90}
 *   preset="hero"
 * />
 */
export function OptimizedImage({
  imagePath,
  alt,
  width,
  height,
  quality = 85,
  className = '',
  lazy = true,
  responsive = true,
  preset,
  onLoad,
  onError,
  fallbackSrc = '/images/placeholder.svg'
}: OptimizedImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Utiliser le preset ou les options personnalisées
  const imageUrl = preset 
    ? ImageOptimizer.getPresetUrl(imagePath, preset)
    : ImageOptimizer.getOptimizedUrl(imagePath, { width, height, quality });

  // Générer le srcSet pour responsive
  const srcSet = responsive 
    ? ImageOptimizer.getResponsiveSrcSet(imagePath, undefined, quality)
    : undefined;

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Image de fallback en cas d'erreur
  if (hasError) {
    return (
      <img
        src={fallbackSrc}
        alt={alt}
        className={`${className} opacity-50`}
        loading="lazy"
      />
    );
  }

  return (
    <img
      src={imageUrl}
      srcSet={srcSet}
      sizes={responsive ? '(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px' : undefined}
      alt={alt}
      className={`${className} ${!isLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}

/**
 * 🎨 COMPOSANTS SPÉCIALISÉS
 */

interface LogoImageProps {
  logoFilename?: string;
  alt: string;
  className?: string;
  size?: number;
}

/**
 * Logo de marque optimisé
 */
export function OptimizedLogo({ logoFilename, alt, className = '', size = 200 }: LogoImageProps) {
  if (!logoFilename) {
    return <div className={`${className} bg-gray-200 rounded`} />;
  }

  return (
    <OptimizedImage
      imagePath={`constructeurs-automobiles/marques-logos/${logoFilename}`}
      alt={alt}
      width={size}
      quality={90}
      className={className}
    />
  );
}

interface ModelImageProps {
  brandAlias: string;
  modelPic?: string;
  alt: string;
  className?: string;
}

/**
 * Image de modèle de véhicule
 */
export function OptimizedModelImage({ brandAlias, modelPic, alt, className = '' }: ModelImageProps) {
  if (!modelPic) {
    return (
      <div className={`${className} bg-gray-200 flex items-center justify-center`}>
        <span className="text-gray-400">Aucune image</span>
      </div>
    );
  }

  return (
    <OptimizedImage
      imagePath={`constructeurs-automobiles/marques-modeles/${brandAlias}/${modelPic}`}
      alt={alt}
      preset="card"
      className={className}
    />
  );
}

interface PartImageProps {
  partImg?: string;
  alt: string;
  className?: string;
}

/**
 * Image de pièce automobile
 */
export function OptimizedPartImage({ partImg, alt, className = '' }: PartImageProps) {
  if (!partImg) {
    return <div className={`${className} bg-gray-100`} />;
  }

  return (
    <OptimizedImage
      imagePath={`articles/gammes-produits/catalogue/${partImg}`}
      alt={alt}
      width={600}
      quality={85}
      className={className}
    />
  );
}

interface RackImageProps {
  folder: string;
  filename: string;
  alt: string;
  className?: string;
  preset?: 'thumbnail' | 'card' | 'hero' | 'full';
}

/**
 * Image Rack (vos 2.7M d'images !)
 */
export function OptimizedRackImage({ folder, filename, alt, className = '', preset = 'card' }: RackImageProps) {
  return (
    <OptimizedImage
      imagePath={`rack-images/${folder}/${filename}`}
      alt={alt}
      preset={preset}
      className={className}
    />
  );
}

/**
 * 🎁 COMPOSANT AVEC <picture> POUR COMPATIBILITÉ MAXIMALE
 */
interface PictureImageProps extends OptimizedImageProps {
  avifSupport?: boolean;
}

/**
 * Composant Picture avec WebP + Fallback JPEG
 */
export function OptimizedPictureImage({
  imagePath,
  alt,
  className = '',
  width = 800,
  quality = 85,
  avifSupport = false
}: PictureImageProps) {
  const webpUrl = ImageOptimizer.getOptimizedUrl(imagePath, { width, quality, format: 'webp' });
  const avifUrl = avifSupport 
    ? ImageOptimizer.getOptimizedUrl(imagePath, { width, quality, format: 'avif' })
    : null;
  const fallbackUrl = ImageOptimizer.getOriginalUrl(imagePath);

  return (
    <picture>
      {avifUrl && (
        <source srcSet={avifUrl} type="image/avif" />
      )}
      <source srcSet={webpUrl} type="image/webp" />
      <img
        src={fallbackUrl}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}

/**
 * 🔧 HOOK PERSONNALISÉ
 */
export function useOptimizedImage(imagePath: string, options?: ImageOptimizationOptions) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const imageSet = ImageOptimizer.getResponsiveImageSet(imagePath, options);

  useEffect(() => {
    const img = new Image();
    img.src = imageSet.src;
    
    img.onload = () => setIsLoading(false);
    img.onerror = () => {
      setIsLoading(false);
      setHasError(true);
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageSet.src]);

  return {
    ...imageSet,
    isLoading,
    hasError
  };
}
