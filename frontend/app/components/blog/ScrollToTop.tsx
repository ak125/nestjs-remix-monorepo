import { ArrowUp } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 🔝 ScrollToTop - Bouton flottant pour retourner en haut de page
 * Apparaît après 300px de scroll avec animation smooth
 * 🚀 LCP Fix: Throttled scroll listener pour éviter layout thrashing
 */
export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const ticking = useRef(false);

  // 🚀 Throttled scroll handler avec requestAnimationFrame
  const toggleVisibility = useCallback(() => {
    if (!ticking.current) {
      requestAnimationFrame(() => {
        setIsVisible(window.pageYOffset > 300);
        ticking.current = false;
      });
      ticking.current = true;
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
