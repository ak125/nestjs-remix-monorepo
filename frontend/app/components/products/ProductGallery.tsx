/**
 * 🖼️ Product Gallery - Carousel d'images produit professionnel
 * 
 * Features:
 * - Carousel principal avec navigation
 * - Thumbnails cliquables
 * - Zoom au clic
 * - Navigation clavier (flèches)
 * - Indicateurs de position
 * - Lightbox (vue plein écran)
 * - Responsive mobile/desktop
 */

import { X, ZoomIn } from 'lucide-react';
import { useState } from 'react';

import { Button } from '../ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '../ui/carousel';

interface ProductImage {
  id: string;
  url: string;
  alt: string;
  thumbnail?: string;
}

interface ProductGalleryProps {
  /** Liste des images du produit */
  images: ProductImage[];
  /** Nom du produit (pour l'alt des images) */
  productName: string;
  /** Afficher les thumbnails */
  showThumbnails?: boolean;
  /** Classe CSS additionnelle */
  className?: string;
}

export function ProductGallery({
  images,
  productName,
  showThumbnails = true,
  className = '',
}: ProductGalleryProps) {
  const [mainApi, setMainApi] = useState<CarouselApi>();
  const [thumbnailApi, setThumbnailApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Synchroniser les deux carousels
  const handleThumbnailClick = (index: number) => {
    mainApi?.scrollTo(index);
    setCurrent(index);
  };

  // Écouter les changements du carousel principal
  useState(() => {
    if (!mainApi) return;

    mainApi.on('select', () => {
      const selected = mainApi.selectedScrollSnap();
      setCurrent(selected);
      thumbnailApi?.scrollTo(selected);
    });
  });

  // Ouvrir la lightbox
  const openLightbox = () => {
    setLightboxOpen(true);
  };

  // Fermer la lightbox
  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-400">Aucune image disponible</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Carousel principal */}
      <div className="relative group">
        <Carousel
          setApi={setMainApi}
          className="w-full"
          opts={{
            align: 'start',
            loop: true,
          }}
        >
          <CarouselContent>
            {images.map((image, index) => (
              <CarouselItem key={image.id}>
                <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={image.url}
                    alt={image.alt || `${productName} - Image ${index + 1}`}
                    className="w-full h-full object-contain cursor-zoom-in hover:scale-105 transition-transform duration-300"
                    onClick={openLightbox}
                  />
                  {/* Bouton zoom */}
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={openLightbox}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2" />
          <CarouselNext className="right-2" />
        </Carousel>

        {/* Indicateur de position */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
          {current + 1} / {images.length}
        </div>
      </div>

      {/* Thumbnails */}
      {showThumbnails && images.length > 1 && (
        <Carousel
          setApi={setThumbnailApi}
          opts={{
            align: 'start',
            dragFree: true,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-2">
            {images.map((image, index) => (
              <CarouselItem
                key={image.id}
                className="pl-2 basis-1/4 md:basis-1/5 lg:basis-1/6"
              >
                <button
                  onClick={() => handleThumbnailClick(index)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    index === current
                      ? 'border-blue-600 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <img
                    src={image.thumbnail || image.url}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      )}

      {/* Lightbox (vue plein écran) */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={closeLightbox}
          >
            <X className="w-6 h-6" />
          </Button>

          <div className="relative w-full h-full flex items-center justify-center p-8">
            <Carousel
              opts={{
                align: 'center',
                loop: true,
                startIndex: current,
              }}
              className="w-full max-w-5xl"
            >
              <CarouselContent>
                {images.map((image, index) => (
                  <CarouselItem key={image.id}>
                    <div className="flex items-center justify-center">
                      <img
                        src={image.url}
                        alt={image.alt || `${productName} - Image ${index + 1}`}
                        className="max-h-[85vh] max-w-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-4 bg-white/10 border-white/20 text-white hover:bg-white/20" />
              <CarouselNext className="right-4 bg-white/10 border-white/20 text-white hover:bg-white/20" />
            </Carousel>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white text-lg">
            {current + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  );
}
