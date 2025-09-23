// 🎨 Composant MultiCarousel moderne et performant
// Carousel responsive avec animations fluides et accessibilité

import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';

interface MultiCarouselProps {
  children: React.ReactNode;
  id: string;
  itemsConfig?: string; // Format: "mobile,tablet,desktop,large" ex: "1,2,3,4"
  className?: string;
  showArrows?: boolean;
  showDots?: boolean;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  gap?: number;
}

const MultiCarousel: React.FC<MultiCarouselProps> = ({
  children,
  id,
  itemsConfig = "1,2,3,4",
  className = "",
  showArrows = true,
  showDots = true,
  autoPlay = false,
  autoPlayInterval = 5000,
  gap = 16
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const carouselRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  const childrenArray = React.Children.toArray(children);
  const totalItems = childrenArray.length;
  const maxIndex = Math.max(0, totalItems - itemsPerView);

  // 📱 Calcul responsive des éléments visibles
  const calculateItemsPerView = useCallback(() => {
    if (!carouselRef.current) return;

    const bodyWidth = window.innerWidth;
    const items = itemsConfig.split(',').map(Number);

    let itemsCount;
    if (bodyWidth >= 1200) itemsCount = items[3] || 4;        // Large screens
    else if (bodyWidth >= 992) itemsCount = items[2] || 3;    // Desktop
    else if (bodyWidth >= 768) itemsCount = items[1] || 2;    // Tablet
    else itemsCount = items[0] || 1;                          // Mobile

    // Limiter au nombre d'éléments disponibles
    itemsCount = Math.min(itemsCount, totalItems);
    
    if (itemsCount !== itemsPerView) {
      setItemsPerView(itemsCount);
      // Ajuster l'index si nécessaire
      if (currentIndex > totalItems - itemsCount) {
        setCurrentIndex(Math.max(0, totalItems - itemsCount));
      }
    }
  }, [itemsConfig, itemsPerView, currentIndex, totalItems]);

  // 📐 Setup et resize handler
  useEffect(() => {
    calculateItemsPerView();
    
    const resizeHandler = () => {
      calculateItemsPerView();
    };

    window.addEventListener('resize', resizeHandler);
    return () => window.removeEventListener('resize', resizeHandler);
  }, [calculateItemsPerView]);

  // ⏰ Auto-play functionality
  useEffect(() => {
    if (autoPlay && !isPaused && maxIndex > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev >= maxIndex ? 0 : prev + 1));
      }, autoPlayInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoPlay, isPaused, maxIndex, autoPlayInterval]);

  // 🎯 Navigation handlers
  const handlePrev = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex(prev => Math.max(0, prev - 1));
    setTimeout(() => setIsAnimating(false), 300);
  }, [isAnimating]);

  const handleNext = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex(prev => Math.min(maxIndex, prev + 1));
    setTimeout(() => setIsAnimating(false), 300);
  }, [isAnimating, maxIndex]);

  const goToSlide = useCallback((index: number) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex(Math.max(0, Math.min(maxIndex, index)));
    setTimeout(() => setIsAnimating(false), 300);
  }, [isAnimating, maxIndex]);

  // ⌨️ Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        handlePrev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        handleNext();
        break;
      case 'Home':
        e.preventDefault();
        goToSlide(0);
        break;
      case 'End':
        e.preventDefault();
        goToSlide(maxIndex);
        break;
    }
  }, [handlePrev, handleNext, goToSlide, maxIndex]);

  // 🎨 Calcul des styles pour l'animation
  const translateX = -(currentIndex * (100 / itemsPerView));
  const itemWidth = `calc(${100 / itemsPerView}% - ${gap * (itemsPerView - 1) / itemsPerView}px)`;

  // 🚫 Pas d'affichage si pas d'éléments
  if (totalItems === 0) return null;

  return (
    <div 
      className={`relative group ${className}`}
      id={id}
      onMouseEnter={() => autoPlay && setIsPaused(true)}
      onMouseLeave={() => autoPlay && setIsPaused(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Carousel"
      aria-live="polite"
    >
      {/* 🎠 Container principal */}
      <div 
        ref={carouselRef}
        className="overflow-hidden rounded-lg"
        role="list"
      >
        <div 
          className="flex transition-transform duration-300 ease-out"
          style={{ 
            transform: `translateX(${translateX}%)`,
            gap: `${gap}px`
          }}
        >
          {childrenArray.map((child, index) => (
            <div
              key={index}
              className="flex-shrink-0"
              style={{ width: itemWidth }}
              role="listitem"
              aria-hidden={index < currentIndex || index >= currentIndex + itemsPerView}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* ⬅️ Bouton précédent */}
      {showArrows && maxIndex > 0 && (
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0 || isAnimating}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white border border-gray-200 rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Élément précédent"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
      )}

      {/* ➡️ Bouton suivant */}
      {showArrows && maxIndex > 0 && (
        <button
          onClick={handleNext}
          disabled={currentIndex >= maxIndex || isAnimating}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white border border-gray-200 rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Élément suivant"
        >
          <ChevronRight className="w-5 h-5 text-gray-700" />
        </button>
      )}

      {/* 🔘 Indicateurs de pagination */}
      {showDots && maxIndex > 0 && (
        <div className="flex justify-center mt-4 space-x-2">
          {Array.from({ length: maxIndex + 1 }, (_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              disabled={isAnimating}
              className={`w-2 h-2 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                index === currentIndex 
                  ? 'bg-blue-600 w-6' 
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Aller à la page ${index + 1}`}
              aria-current={index === currentIndex ? 'true' : 'false'}
            />
          ))}
        </div>
      )}

      {/* 📊 Indicateur de progression pour les lecteurs d'écran */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Affichage {currentIndex + 1} sur {maxIndex + 1}, éléments {currentIndex + 1} à {Math.min(currentIndex + itemsPerView, totalItems)} sur {totalItems}
      </div>
    </div>
  );
};

export default MultiCarousel;