// 📁 frontend/app/components/ui/LazyImage.tsx
// ⚡ Composant image avec lazy loading optimisé

import { useState, useRef, useEffect } from 'react';
import { SkeletonLoader } from './SkeletonLoader';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
  skeletonAnimation?: 'pulse' | 'wave' | 'none';
}

export default function LazyImage({ 
  src, 
  alt, 
  className = '', 
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PC9zdmc+',
  onLoad,
  onError,
  skeletonAnimation = 'wave'
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px', // Commencer le chargement 50px avant
        threshold: 0.1
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  return (
    <div 
      ref={imgRef}
      className={`relative overflow-hidden bg-gray-100 ${className}`}
    >
            {/* Skeleton loader avant que l'image soit en vue */}
      {!isInView && (
        <SkeletonLoader 
          className="w-full h-full" 
          animation={skeletonAnimation}
        />
      )}

      {/* Placeholder pendant le chargement (image en vue mais pas encore chargée) */}
      {isInView && !isLoaded && !hasError && placeholder && (
        <img
          src={placeholder}
          alt="Loading..."
          className="w-full h-full object-cover blur-sm transition-opacity duration-300"
        />
      )}

      {/* Skeleton pendant le chargement si pas de placeholder */}
      {isInView && !isLoaded && !hasError && !placeholder && (
        <SkeletonLoader 
          className="w-full h-full" 
          animation={skeletonAnimation}
        />
      )}

      {/* Image principale */}
      {isInView && !hasError && (
        <img
          src={src}
          alt={alt}
          className={`
            w-full h-full object-cover transition-all duration-500
            ${isLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'}
          `}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      )}

      {/* Fallback en cas d'erreur */}
      {hasError && (
        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500">
          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  );
}