import { Car, List } from "lucide-react";
import { memo } from "react";

interface MobileStickyBarProps {
  gammeName?: string;
  hasCompatibilities?: boolean;
  minPrice?: number | null;
}

const MobileStickyBar = memo(function MobileStickyBar({
  gammeName: _gammeName = "pièces",
  hasCompatibilities = true,
  minPrice,
}: MobileStickyBarProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    // SSR-safe: document/window n'existent pas côté serveur
    if (typeof document === "undefined" || typeof window === "undefined")
      return;
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const elementPosition =
        element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="fixed bottom-0 inset-x-0 md:hidden bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-3 pb-safe flex gap-2 z-40">
      <a
        href="#vehicle-selector"
        onClick={(e) => handleClick(e, "vehicle-selector")}
        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"
      >
        <Car className="w-5 h-5" />
        <span>
          {minPrice ? `dès ${minPrice.toFixed(2)}€` : "Sélectionner véhicule"}
        </span>
      </a>
      {hasCompatibilities && (
        <a
          href="#compatibilities"
          onClick={(e) => handleClick(e, "compatibilities")}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:border-blue-300 hover:text-blue-700 transition-all active:scale-95"
        >
          <List className="w-5 h-5" />
          <span>Compatibilités</span>
        </a>
      )}
    </div>
  );
});

export default MobileStickyBar;
