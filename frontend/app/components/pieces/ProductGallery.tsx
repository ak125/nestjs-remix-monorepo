import React, { useState, useMemo } from 'react';
import { normalizeImageUrl } from '../../utils/image.utils';

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
    
    // Ajouter l'image principale si elle existe
    if (mainImage) {
        list.push({ id: 'main', url: mainImage, sort: 0, alt });
    }
    
    // Ajouter les autres images
    if (images && images.length > 0) {
        images.forEach(img => {
            // Éviter les doublons d'URL
            if (!list.some(existing => existing.url === img.url)) {
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
          src={normalizeImageUrl(currentImage)}
          alt={alt}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
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
        src={normalizeImageUrl(currentImage)}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-500"
        loading="lazy"
      />
      
      {/* Thumbnails overlay on hover */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/40 backdrop-blur-sm translate-y-full group-hover/gallery:translate-y-0 transition-transform duration-300 flex gap-2 overflow-x-auto scrollbar-hide z-10">
        {allImages.slice(0, 5).map((img, idx) => (
            <button
                key={img.id || idx}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentImage(img.url);
                }}
                onMouseEnter={() => setCurrentImage(img.url)}
                className={`w-10 h-10 flex-shrink-0 rounded border-2 ${currentImage === img.url ? 'border-blue-500 ring-1 ring-blue-500' : 'border-white/50 hover:border-white'} overflow-hidden transition-all bg-white`}
            >
                <img src={normalizeImageUrl(img.url)} alt={img.alt || alt} className="w-full h-full object-cover" />
            </button>
        ))}
        {allImages.length > 5 && (
            <div className="w-10 h-10 flex-shrink-0 rounded border-2 border-white/50 bg-black/50 flex items-center justify-center text-white text-xs font-bold">
                +{allImages.length - 5}
            </div>
        )}
      </div>
      
      {/* Indicateur multi-images (visible quand pas hover) */}
      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded opacity-100 group-hover/gallery:opacity-0 transition-opacity duration-300 pointer-events-none">
        1/{allImages.length}
      </div>
    </div>
  );
};
