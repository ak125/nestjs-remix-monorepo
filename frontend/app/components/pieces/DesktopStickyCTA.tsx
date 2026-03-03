/**
 * Desktop Sticky CTA — mini-panel bottom-right.
 * Complète MobileStickyBar (md:hidden) côté desktop (hidden md:flex).
 * Apparaît après scroll > 500px pour ne pas gêner le Hero.
 */
import { Car, ChevronUp, Search } from "lucide-react";
import { memo, useEffect, useState } from "react";

const DesktopStickyCTA = memo(function DesktopStickyCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 80;
      const pos = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: pos - offset, behavior: "smooth" });
    }
  };

  if (!visible) return null;

  return (
    <div className="hidden md:flex fixed bottom-6 right-6 z-40 flex-col gap-2 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 max-w-[260px]">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        Accès rapide
      </p>
      <button
        type="button"
        onClick={() => scrollTo("vehicle-selector")}
        className="flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all text-sm"
      >
        <Car className="w-4 h-4" />
        Sélectionner mon véhicule
      </button>
      <button
        type="button"
        onClick={() => scrollTo("compatibilities")}
        className="flex items-center gap-2.5 px-4 py-2.5 bg-white border-2 border-gray-200 text-gray-700 font-semibold rounded-lg hover:border-blue-300 hover:text-blue-700 transition-all text-sm"
      >
        <Search className="w-4 h-4" />
        Voir les compatibilités
      </button>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors pt-1"
      >
        <ChevronUp className="w-3 h-3" />
        Haut de page
      </button>
    </div>
  );
});

export default DesktopStickyCTA;
