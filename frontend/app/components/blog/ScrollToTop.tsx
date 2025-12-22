import { ArrowUp } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

/**
 * 🔝 ScrollToTop - Bouton flottant pour retourner en haut de page
 * Apparaît après 300px de scroll avec animation smooth
 * 🚀 LCP Fix: Utilise IntersectionObserver au lieu de scroll listener
 *    pour éviter le layout thrashing (lecture de window.scrollY)
 */
export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const lastVisible = useRef(false);

  useEffect(() => {
    // 🚀 Créer un sentinel invisible au début du document
    // Quand il sort du viewport (scroll > 300px), le bouton devient visible
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'position: absolute; top: 300px; left: 0; width: 1px; height: 1px; pointer-events: none;';
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.setAttribute('data-scroll-sentinel', 'true');
    document.body.prepend(sentinel);

    const observer = new IntersectionObserver(
      ([entry]) => {
        const shouldBeVisible = !entry.isIntersecting;
        // 🚀 Only update state if value changed
        if (lastVisible.current !== shouldBeVisible) {
          lastVisible.current = shouldBeVisible;
          setIsVisible(shouldBeVisible);
        }
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      sentinel.remove();
    };
  }, []);

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
