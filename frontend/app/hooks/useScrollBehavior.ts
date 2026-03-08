/**
 * Hook pour gérer le comportement de scroll de la page
 * Gère le smooth scroll et le bouton "retour en haut"
 *
 * ⚡ Optimisé INP: Scroll listener throttlé à 100ms
 */

import { useState, useEffect } from "react";

export function useScrollBehavior() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Active le smooth scroll au montage
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = "auto";
    };
  }, []);

  // Affiche/masque le bouton de retour en haut
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setShowScrollTop(window.scrollY > 500);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // check initial position
    return () => window.removeEventListener("scroll", onScroll);
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
        behavior: "smooth",
      });
    }
  };

  // Fonction de scroll vers le haut
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return {
    showScrollTop,
    scrollToSection,
    scrollToTop,
  };
}
