/**
 * Hook pour gérer le comportement de scroll de la page
 * Gère le smooth scroll et le bouton "retour en haut"
 *
 * ⚡ Optimisé INP: Scroll listener throttlé à 100ms
 */

import { useState, useEffect, useRef } from 'react';
import { throttle } from '../utils/performance.utils';

export function useScrollBehavior() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  // Garder référence au handler throttlé pour cleanup
  const throttledHandlerRef = useRef<ReturnType<typeof throttle> | null>(null);

  // Active le smooth scroll au montage
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  // Affiche/masque le bouton de retour en haut
  // ⚡ Throttlé à 100ms pour réduire l'INP
  useEffect(() => {
    throttledHandlerRef.current = throttle(() => {
      setShowScrollTop(window.scrollY > 500);
    }, 100);

    window.addEventListener('scroll', throttledHandlerRef.current, { passive: true });
    return () => {
      if (throttledHandlerRef.current) {
        window.removeEventListener('scroll', throttledHandlerRef.current);
      }
    };
  }, []);

  // Fonction de scroll vers une section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80; // Hauteur du navbar
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  // Fonction de scroll vers le haut
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    showScrollTop,
    scrollToSection,
    scrollToTop
  };
}
