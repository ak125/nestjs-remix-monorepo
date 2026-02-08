/**
 * 🎯 Navigation Header - Architecture à 2 niveaux
 *
 * Stratégie Expert :
 * - TopBar (contexte) : visible static, cachée au scroll
 * - Navbar (actions) : sticky, reste visible
 *
 * Comportements :
 * - Scroll = 0 : TopBar visible + Navbar normale
 * - Scroll > 40px : TopBar cachée + Navbar sticky compacte
 *
 * Performance : 60 FPS, GPU accelerated transforms
 * ⚡ Optimisé INP: Scroll listener throttlé à 100ms
 */

import { useEffect, useState, useRef, memo } from "react";

import { throttle } from "../../utils/performance.utils";
import { Navbar } from "../Navbar";
import { TopBar } from "./TopBar";

interface NavigationHeaderProps {
  logo: string;
  topBarConfig?: {
    tagline?: string;
    phone?: string;
    email?: string;
    showQuickLinks?: boolean;
  };
  user?: {
    firstName?: string;
    lastName?: string;
    gender?: "M" | "F" | "Autre";
  } | null;
}

export const NavigationHeader = memo(function NavigationHeader({
  logo,
  topBarConfig = {
    tagline: "Pièces auto à prix pas cher",
    phone: "01 48 49 78 69",
    showQuickLinks: true,
  },
  user,
}: NavigationHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  // Garder référence au handler throttlé pour cleanup
  const throttledHandlerRef = useRef<ReturnType<typeof throttle> | null>(null);

  // ⚡ Throttlé à 100ms pour réduire l'INP
  useEffect(() => {
    throttledHandlerRef.current = throttle(() => {
      setIsScrolled(window.scrollY > 40); // TopBar height
    }, 100);

    window.addEventListener("scroll", throttledHandlerRef.current, {
      passive: true,
    });
    return () => {
      if (throttledHandlerRef.current) {
        window.removeEventListener("scroll", throttledHandlerRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      {/* TopBar - Slide up au scroll */}
      <div
        className={`transition-all duration-normal ${
          isScrolled
            ? "-translate-y-full opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100"
        }`}
        style={{
          position: isScrolled ? "absolute" : "static",
          willChange: "transform, opacity",
        }}
      >
        <TopBar config={topBarConfig} user={user} />
      </div>

      {/* Navbar - Reste visible (sticky) */}
      <div
        className={`transition-all duration-normal ${
          isScrolled ? "shadow-xl" : "shadow-sm"
        }`}
      >
        <Navbar logo={logo} />
      </div>
    </div>
  );
});
