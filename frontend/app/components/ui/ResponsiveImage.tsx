/**
 * 🖼️ Composant Image Responsive
 * Optimise automatiquement les images avec srcset et sizes
 * Compatible avec Supabase Storage et CDN
 */

import { useState } from 'react';

interface ResponsiveImageProps {
  src: string;
  alt: string;
  fallback?: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  /** Tailles pour différents breakpoints: "(max-width: 640px) 100vw, 50vw" */
  sizes?: string;
  /** Largeurs à générer pour srcset: [320, 480, 640, 800] */
  widths?: number[];
  /** Qualité d'image (1-100, défaut 80) */
  quality?: number;
  /** Callback en cas d'erreur */
  onError?: () => void;
  /** Afficher un placeholder pendant le chargement */
  showPlaceholder?: boolean;
  /** Aspect ratio pour le placeholder (ex: "16/9", "1/1", "4/3") */
  aspectRatio?: string;
}

/**
 * Génère une URL optimisée pour Supabase Storage
 * @param url URL de base
 * @param width Largeur souhaitée
 * @param quality Qualité (1-100)
 */
function getOptimizedUrl(url: string, width: number, quality: number = 80): string {
  if (!url) return '';
  
  // URLs Supabase Storage - utiliser le transform API
  if (url.includes('supabase.co/storage')) {
    // Format: /storage/v1/render/image/public/bucket/path?width=X&quality=Y
    const transformUrl = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    const separator = transformUrl.includes('?') ? '&' : '?';
    return `${transformUrl}${separator}width=${width}&quality=${quality}`;
  }
  
  // Cloudinary
  if (url.includes('cloudinary.com')) {
    return url.replace('/upload/', `/upload/w_${width},q_${quality}/`);
  }
  
  // Imgix ou autres CDN avec paramètres standard
  if (url.includes('imgix.net') || url.includes('imagekit.io')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}w=${width}&q=${quality}`;
  }
  
  // URL standard - pas de transformation possible
  return url;
}

/**
 * Génère le srcset pour différentes tailles
 */
function generateSrcSet(url: string, widths: number[], quality: number): string {
  if (!url) return '';
  
  return widths
    .map(w => `${getOptimizedUrl(url, w, quality)} ${w}w`)
    .join(', ');
}

export function ResponsiveImage({
  src,
  alt,
  fallback = '/images/placeholder.webp',
  className = '',
  loading = 'lazy',
  decoding = 'async',
  sizes = '100vw',
  widths = [320, 480, 640, 800, 1024],
  quality = 80,
  onError,
  showPlaceholder = false,
  aspectRatio,
}: ResponsiveImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const handleError = () => {
    setHasError(true);
    onError?.();
  };
  
  const handleLoad = () => {
    setIsLoaded(true);
  };
  
  const imageSrc = hasError ? fallback : (src || fallback);
  const srcSet = !hasError && src ? generateSrcSet(src, widths, quality) : '';
  
  return (
    <div className={`relative overflow-hidden ${aspectRatio ? `aspect-[${aspectRatio}]` : ''}`}>
      {/* Placeholder pendant chargement */}
      {showPlaceholder && !isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse" />
      )}
      
      <img
        src={imageSrc}
        srcSet={srcSet || undefined}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        className={`${className} ${!isLoaded && showPlaceholder ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        loading={loading}
        decoding={decoding}
        onError={handleError}
        onLoad={handleLoad}
      />
    </div>
  );
}

/**
 * 🚗 Image de véhicule responsive
 */
export function VehicleImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  loading = 'lazy',
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
}: {
  src?: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
}) {
  return (
    <ResponsiveImage
      src={src || ''}
      alt={alt}
      fallback="/images/default-vehicle.png"
      className={className}
      loading={loading}
      sizes={sizes}
      widths={[320, 480, 640]}
      quality={75}
      showPlaceholder
    />
  );
}

/**
 * 📦 Image de pièce responsive
 */
export function PartImage({
  src,
  alt,
  className = 'w-full h-full object-contain',
  loading = 'lazy',
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw',
}: {
  src?: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
}) {
  return (
    <ResponsiveImage
      src={src || ''}
      alt={alt}
      fallback="/images/default-part.png"
      className={className}
      loading={loading}
      sizes={sizes}
      widths={[160, 240, 320]}
      quality={80}
      showPlaceholder
    />
  );
}

/**
 * 🏭 Logo de marque responsive
 */
export function BrandLogo({
  src,
  alt,
  className = 'w-full h-full object-contain',
  loading = 'eager',
  sizes = '(max-width: 640px) 128px, 192px',
}: {
  src?: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
}) {
  return (
    <ResponsiveImage
      src={src || ''}
      alt={alt}
      fallback="/images/default-brand.png"
      className={className}
      loading={loading}
      sizes={sizes}
      widths={[128, 192, 256]}
      quality={90}
    />
  );
}

export default ResponsiveImage;
