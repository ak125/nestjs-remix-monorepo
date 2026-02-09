// 📁 frontend/app/components/home/BrandCarousel.tsx
// 🎠 Carousel des marques automobiles

import { Link } from "@remix-run/react";
import { ChevronLeft, ChevronRight, Car, ExternalLink } from "lucide-react";
import { useState, useEffect, memo } from "react";

import { Alert } from "~/components/ui";
import { type VehicleBrand } from "../../services/api/enhanced-vehicle.api";

interface BrandCarouselProps {
  brands: VehicleBrand[];
  autoPlay?: boolean;
  interval?: number;
}

export const BrandCarousel = memo(function BrandCarousel({
  brands,
  autoPlay = true,
  interval = 4000,
}: BrandCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [itemsPerSlide, setItemsPerSlide] = useState(6);

  useEffect(() => {
    const updateItemsPerSlide = () => {
      if (window.innerWidth < 640) {
        setItemsPerSlide(2);
      } else if (window.innerWidth < 768) {
        setItemsPerSlide(3);
      } else if (window.innerWidth < 1024) {
        setItemsPerSlide(4);
      } else if (window.innerWidth < 1280) {
        setItemsPerSlide(5);
      } else {
        setItemsPerSlide(6);
      }
    };

    updateItemsPerSlide();
    window.addEventListener("resize", updateItemsPerSlide);
    return () => window.removeEventListener("resize", updateItemsPerSlide);
  }, []);

  useEffect(() => {
    if (autoPlay && !isHovered && brands.length > itemsPerSlide) {
      const timer = setInterval(() => {
        setCurrentIndex((prev) =>
          prev >= Math.ceil(brands.length / itemsPerSlide) - 1 ? 0 : prev + 1,
        );
      }, interval);

      return () => clearInterval(timer);
    }
  }, [autoPlay, isHovered, brands.length, itemsPerSlide, interval]);

  const totalSlides = Math.ceil(brands.length / itemsPerSlide);

  const goToSlide = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, totalSlides - 1)));
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev <= 0 ? totalSlides - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev >= totalSlides - 1 ? 0 : prev + 1));
  };

  if (brands.length === 0) {
    return (
      <div className="text-center py-12">
        <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Aucune marque automobile disponible</p>
      </div>
    );
  }

  return (
    <div
      className="relative bg-white rounded-2xl shadow-lg overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Marques automobiles</h3>
              <p className="text-blue-100 text-sm">
                {brands.length} marques disponibles
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
            width: `${totalSlides * 100}%`,
          }}
        >
          {Array.from({ length: totalSlides }).map((_, slideIndex) => (
            <div
              key={slideIndex}
              className="flex-shrink-0"
              style={{ width: `${100 / totalSlides}%` }}
            >
              <div
                className="grid gap-4 p-6"
                style={{
                  gridTemplateColumns: `repeat(${itemsPerSlide}, 1fr)`,
                }}
              >
                {brands
                  .slice(
                    slideIndex * itemsPerSlide,
                    (slideIndex + 1) * itemsPerSlide,
                  )
                  .map((brand, brandIndex) => (
                    <Link
                      key={brand.marque_id || `brand-${brandIndex}`}
                      to={`/catalogue?brand=${brand.marque_id}`}
                      className="group"
                    >
                      <div className="bg-gray-50 rounded-xl p-4 text-center hover:bg-gradient-to-br hover:from-blue-50 hover:to-blue-100 hover:shadow-xl transform hover:-translate-y-2 transition-all duration-300 border-2 border-transparent hover:border-blue-200">
                        <div className="w-16 h-16 mx-auto mb-3 bg-white rounded-xl shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          {brand.marque_logo ? (
                            <img
                              src={brand.marque_logo}
                              alt={`Logo ${brand.marque_name || "marque"}`}
                              width={48}
                              height={48}
                              loading="lazy"
                              decoding="async"
                              className="w-12 h-12 object-contain"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gradient-to-br from-gray-400 to-gray-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                              {brand.marque_name?.charAt(0) || "?"}
                            </div>
                          )}
                        </div>

                        <h4 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors text-sm mb-1">
                          {brand.marque_name || "Marque inconnue"}
                        </h4>

                        {brand.marque_country && (
                          <p className="text-xs text-gray-600 mb-2">
                            {brand.marque_country}
                          </p>
                        )}

                        {brand.products_count && (
                          <Alert intent="info">
                            {brand.products_count.toLocaleString()} pièces
                          </Alert>
                        )}

                        {brand.is_featured && (
                          <div className="bg-gradient-to-r from-orange-400 to-orange-500 text-white text-xs py-1 px-2 rounded-full inline-block">
                            ⭐ Premium
                          </div>
                        )}

                        <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="flex items-center justify-center text-blue-600 text-xs font-semibold">
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Voir les pièces
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {totalSlides > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:text-blue-600 transition-all transform hover:scale-110"
              aria-label="Slide précédent"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:text-blue-600 transition-all transform hover:scale-110"
              aria-label="Slide suivant"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {totalSlides > 1 && (
        <div className="flex justify-center space-x-2 p-4 bg-gray-50">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentIndex
                  ? "bg-primary w-8"
                  : "bg-muted/50 hover:bg-gray-400"
              }`}
              aria-label={`Aller au slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
});
