import React, { useState, useMemo, useCallback } from 'react';

interface ProductGalleryProps {
  images?: { id: string; url: string; sort: number; alt: string }[];
  mainImage?: string;
  alt: string;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({ images = [], mainImage, alt }) => {
  // Initialiser avec l'image principale ou la première de la liste
  const initialImage = mainImage || (images.length > 0 ? images[0].url : '');
  const [currentImage, setCurrentImage] = useState(initialImage);

  // Touch swipe state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // Combiner mainImage et images array, assurer l'unicité et le tri
  const allImages = useMemo(() => {
    const list: { id: string; url: string; sort: number; alt: string }[] = [];
    
    // Ajouter l'image principale si elle existe et est valide
    if (mainImage && typeof mainImage === 'string' && mainImage.trim()) {
        list.push({ id: 'main', url: mainImage, sort: 0, alt });
    }
    
    // Ajouter les autres images
    if (images && images.length > 0) {
        images.forEach(img => {
            // Vérifier que l'URL est valide et éviter les doublons
            if (img.url && typeof img.url === 'string' && img.url.trim() && 
                !list.some(existing => existing.url === img.url)) {
                list.push(img);
            }
        });
    }
    
    return list.sort((a, b) => a.sort - b.sort);
  }, [images, mainImage, alt]);

  // Current index based on currentImage
  const currentIndex = useMemo(() => {
    const idx = allImages.findIndex(img => img.url === currentImage);
    return idx >= 0 ? idx : 0;
  }, [allImages, currentImage]);

  // Swipe threshold (min distance to trigger navigation)
  const minSwipeDistance = 50;

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isSwipe = Math.abs(distance) > minSwipeDistance;

    if (isSwipe) {
      if (distance > 0 && currentIndex < allImages.length - 1) {
        // Swipe left → next image
        setCurrentImage(allImages[currentIndex + 1].url);
      } else if (distance < 0 && currentIndex > 0) {
        // Swipe right → previous image
        setCurrentImage(allImages[currentIndex - 1].url);
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd, currentIndex, allImages]);

  // Fallback si aucune image
  if (allImages.length === 0) {
    return (
        <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        </div>
    );
  }

  // Si une seule image, affichage simple
  if (allImages.length === 1) {
     return (
        <img
          src={currentImage}
          alt={alt}
          width={400}
          height={400}
          className="w-full h-full object-contain"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement?.classList.add('image-error');
          }}
        />
     );
  }

  // Galerie multi-images
  return (
    <div className="relative w-full h-full group/gallery">
      <img
        src={currentImage}
        alt={alt}
        width={400}
        height={400}
        className="w-full h-full object-contain touch-pan-y"
        loading="lazy"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* 📱 Mobile swipe dot indicators - visible on touch devices only */}
      <div className="flex gap-1.5 justify-center absolute bottom-2 left-1/2 -translate-x-1/2 sm:hidden z-10">
        {allImages.slice(0, 5).map((_, i) => (
          <button
            key={i}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCurrentImage(allImages[i].url);
            }}
            className={`w-2 h-2 rounded-full transition-all ${i === currentIndex ? 'bg-blue-500 scale-125' : 'bg-white/70'} shadow-sm`}
            aria-label={`Image ${i + 1}`}
          />
        ))}
        {allImages.length > 5 && (
          <span className="text-white/70 text-xs font-bold">+{allImages.length - 5}</span>
        )}
      </div>

      {/* Thumbnails overlay on hover (desktop) */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 via-black/40 to-transparent backdrop-blur-sm translate-y-full group-hover/gallery:translate-y-0 transition-transform duration-300 hidden sm:flex gap-2 overflow-x-auto scrollbar-hide z-10">
        {allImages.slice(0, 5).map((img, idx) => (
            <button
                key={img.id || idx}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentImage(img.url);
                }}
                onMouseEnter={() => setCurrentImage(img.url)}
                className={`w-12 h-12 flex-shrink-0 rounded border-2 ${currentImage === img.url ? 'border-blue-400 ring-2 ring-blue-400 scale-110' : 'border-white/50 hover:border-white'} overflow-hidden transition-all bg-white shadow-lg`}
            >
                <img src={img.url} alt={img.alt || alt} width={48} height={48} className="w-full h-full object-cover" loading="lazy" decoding="async" />
            </button>
        ))}
        {allImages.length > 5 && (
            <div className="w-12 h-12 flex-shrink-0 rounded border-2 border-white/50 bg-black/50 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                +{allImages.length - 5}
            </div>
        )}
      </div>

      {/* Indicateur multi-images (visible quand pas hover, desktop only) */}
      <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-100 group-hover/gallery:opacity-0 transition-opacity duration-300 pointer-events-none hidden sm:flex items-center gap-1.5 shadow-lg backdrop-blur-sm">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="font-semibold">{allImages.length} photo{allImages.length > 1 ? 's' : ''}</span>
      </div>
    </div>
  );
};
