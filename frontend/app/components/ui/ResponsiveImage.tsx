/**
 * 🖼️ Composant Image Responsive
 * Optimise automatiquement les images avec srcset et sizes via imgproxy
 * Compatible avec Supabase Storage et CDN
 */

import { useState, useRef, useEffect } from "react";
import { ImageOptimizer, type PictureImageSet } from "~/utils/image-optimizer";

interface ResponsiveImageProps {
  src: string;
  alt: string;
  fallback?: string;
  className?: string;
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync" | "auto";
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
 * Génère une URL optimisée via imgproxy
 * ✅ Transformation gratuite via imgproxy self-hosted
 * @param url URL de base (Supabase ou autre)
 * @param width Largeur souhaitée
 * @param quality Qualité (1-100)
 */
function getOptimizedUrl(
  url: string,
  width: number,
  quality: number = 80,
): string {
  if (!url) return "";

  // URLs Supabase Storage - transformer via imgproxy
  if (url.includes("supabase.co/storage")) {
    // Extraire le path depuis l'URL Supabase
    const match = url.match(/\/public\/(.+?)(?:\?|$)/);
    if (match) {
      const path = match[1]; // ex: "uploads/rack-images/260/6216001.JPG"
      return ImageOptimizer.getOptimizedUrl(path, { width, quality });
    }
  }

  // Cloudinary - utiliser sa propre API
  if (url.includes("cloudinary.com")) {
    return url;
  }

  // Imgix ou autres CDN - utiliser leur propre API
  if (url.includes("imgix.net") || url.includes("imagekit.io")) {
    return url;
  }

  // URL standard - retourner telle quelle
  return url;
}

/**
 * Génère le srcset pour différentes tailles
 */
function generateSrcSet(
  url: string,
  widths: number[],
  quality: number,
): string {
  if (!url) return "";

  return widths
    .map((w) => `${getOptimizedUrl(url, w, quality)} ${w}w`)
    .join(", ");
}

export function ResponsiveImage({
  src,
  alt,
  fallback = "/images/placeholder.webp",
  className = "",
  loading = "lazy",
  decoding = "async",
  sizes = "100vw",
  widths = [320, 480, 640, 800, 1024],
  quality = 80,
  onError,
  showPlaceholder = false,
  aspectRatio,
}: ResponsiveImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // ✅ FIX SSR Hydration: Vérifier si l'image est déjà chargée après mount
  // Quand l'image charge avant que React hydrate, onLoad ne fire jamais
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, []);

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const imageSrc = hasError ? fallback : src || fallback;
  const srcSet = !hasError && src ? generateSrcSet(src, widths, quality) : "";

  return (
    <div
      className={`relative overflow-hidden ${aspectRatio ? `aspect-[${aspectRatio}]` : ""}`}
    >
      {/* Placeholder pendant chargement */}
      {showPlaceholder && !isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse" />
      )}

      <img
        ref={imgRef}
        src={imageSrc}
        srcSet={srcSet || undefined}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        className={`${className} ${!isLoaded && showPlaceholder ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
        loading={loading}
        decoding={decoding}
        onError={handleError}
        onLoad={handleLoad}
      />
    </div>
  );
}

/**
 * 🚀 LCP Optimization: Picture element with AVIF/WebP format cascade
 *
 * Uses <picture> element for optimal format delivery:
 * - AVIF: 25-35% smaller than WebP (Chrome 85+, Firefox 93+, Safari 16+)
 * - WebP: Fallback for older browsers
 * - JPEG/PNG: Final fallback
 *
 * @example
 * <PictureImage
 *   path="articles/gammes-produits/catalogue/piece.jpg"
 *   alt="Brake pad"
 *   widths={[400, 800, 1200]}
 *   sizes="(max-width: 640px) 100vw, 50vw"
 * />
 */
interface PictureImageProps {
  /** Path to image (relative to Supabase storage) */
  path: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync" | "auto";
  sizes?: string;
  widths?: number[];
  quality?: number;
  fallback?: string;
  width?: number;
  height?: number;
  onError?: () => void;
  showPlaceholder?: boolean;
}

export function PictureImage({
  path,
  alt,
  className = "",
  imgClassName = "",
  loading = "lazy",
  decoding = "async",
  sizes = "(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px",
  widths = [400, 800, 1200],
  quality = 85,
  fallback = "/images/placeholder.webp",
  width,
  height,
  onError,
  showPlaceholder = false,
}: PictureImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Check if image is already loaded after mount (SSR hydration fix)
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, []);

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  const handleLoad = () => {
    setIsLoaded(true);
  };

  // Generate picture-ready image set
  const imageSet: PictureImageSet = hasError
    ? {
        avifSrcSet: "",
        webpSrcSet: "",
        fallbackSrc: fallback,
        sizes,
        width,
        height,
      }
    : ImageOptimizer.getPictureImageSet(path, {
        widths,
        quality,
        sizes,
        width,
        height,
      });

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Placeholder during loading */}
      {showPlaceholder && !isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse" />
      )}

      <picture>
        {/* AVIF source - best compression, modern browsers */}
        {!hasError && imageSet.avifSrcSet && (
          <source
            srcSet={imageSet.avifSrcSet}
            sizes={imageSet.sizes}
            type="image/avif"
          />
        )}
        {/* WebP source - good compression, wide support */}
        {!hasError && imageSet.webpSrcSet && (
          <source
            srcSet={imageSet.webpSrcSet}
            sizes={imageSet.sizes}
            type="image/webp"
          />
        )}
        {/* Fallback img */}
        <img
          ref={imgRef}
          src={imageSet.fallbackSrc}
          alt={alt}
          width={width}
          height={height}
          className={`${imgClassName} ${!isLoaded && showPlaceholder ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
          loading={loading}
          decoding={decoding}
          onError={handleError}
          onLoad={handleLoad}
        />
      </picture>
    </div>
  );
}

/**
 * 🚗 Image de véhicule responsive
 */
export function VehicleImage({
  src,
  alt,
  className = "w-full h-full object-cover",
  loading = "lazy",
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
}: {
  src?: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  sizes?: string;
}) {
  return (
    <ResponsiveImage
      src={src || ""}
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
  className = "w-full h-full object-contain",
  loading = "lazy",
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw",
}: {
  src?: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  sizes?: string;
}) {
  return (
    <ResponsiveImage
      src={src || ""}
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
  className = "w-full h-full object-contain",
  loading = "eager",
  sizes = "(max-width: 640px) 128px, 192px",
}: {
  src?: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  sizes?: string;
}) {
  return (
    <ResponsiveImage
      src={src || ""}
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
