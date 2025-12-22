import { ArrowUp } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 🔝 ScrollToTop - Bouton flottant pour retourner en haut de page
 * Apparaît après 300px de scroll avec animation smooth
 * 🚀 LCP Fix Phase 9: Évite les setState inutiles pour prévenir layout thrashing
 */
export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const ticking = useRef(false);
  const lastVisible = useRef(false); // 🚀 Track last value to avoid unnecessary re-renders

  // 🚀 Throttled scroll handler - only updates state when value actually changes
  const toggleVisibility = useCallback(() => {
    if (!ticking.current) {
      ticking.current = true;
      requestAnimationFrame(() => {
        const shouldBeVisible = window.scrollY > 300;
        // 🚀 Only call setState if value changed - prevents React re-renders
        if (lastVisible.current !== shouldBeVisible) {
          lastVisible.current = shouldBeVisible;
          setIsVisible(shouldBeVisible);
        }
        ticking.current = false;
      });
    }
  }, []);

  useEffect(() => {
    // Passive listener pour meilleures performances
    window.addEventListener('scroll', toggleVisibility, { passive: true });
    toggleVisibility(); // Check initial position

    return () => window.removeEventListener('scroll', toggleVisibility);
  }, [toggleVisibility]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`
        fixed bottom-8 right-8 z-50
        bg-primary hover:bg-primary/90 text-primary-foreground
        p-4 rounded-full shadow-2xl
        transition-all duration-300 transform
        will-change-transform
        ${isVisible
          ? 'translate-y-0 opacity-100 scale-100'
          : 'translate-y-16 opacity-0 scale-50 pointer-events-none'
        }
        hover:scale-110 active:scale-95
        focus:outline-none focus:ring-4 focus:ring-blue-300
      `}
      aria-label="Retour en haut"
      title="Retour en haut de la page"
    >
      <ArrowUp className="w-6 h-6" />
    </button>
  );
}
