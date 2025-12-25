import React, { useState, useMemo } from 'react';
import { optimizeImageUrl } from '../../utils/image.utils';

interface ProductGalleryProps {
  images?: { id: string; url: string; sort: number; alt: string }[];
  mainImage?: string;
  alt: string;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({ images = [], mainImage, alt }) => {
  // Initialiser avec l'image principale ou la première de la liste
  const initialImage = mainImage || (images.length > 0 ? images[0].url : '');
  const [currentImage, setCurrentImage] = useState(initialImage);
  
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
          src={optimizeImageUrl(currentImage, 400)}
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
        src={optimizeImageUrl(currentImage, 400)}
        alt={alt}
        width={400}
        height={400}
        className="w-full h-full object-contain"
        loading="lazy"
      />
      
      {/* Thumbnails overlay on hover */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 via-black/40 to-transparent backdrop-blur-sm translate-y-full group-hover/gallery:translate-y-0 transition-transform duration-300 flex gap-2 overflow-x-auto scrollbar-hide z-10">
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
                <img src={optimizeImageUrl(img.url, 48)} alt={img.alt || alt} width={48} height={48} className="w-full h-full object-cover" loading="lazy" decoding="async" />
            </button>
        ))}
        {allImages.length > 5 && (
            <div className="w-12 h-12 flex-shrink-0 rounded border-2 border-white/50 bg-black/50 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                +{allImages.length - 5}
            </div>
        )}
      </div>
      
      {/* Indicateur multi-images (visible quand pas hover) */}
      <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-100 group-hover/gallery:opacity-0 transition-opacity duration-300 pointer-events-none flex items-center gap-1.5 shadow-lg backdrop-blur-sm">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="font-semibold">{allImages.length} photo{allImages.length > 1 ? 's' : ''}</span>
      </div>
    </div>
  );
};
