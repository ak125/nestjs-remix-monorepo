import { Zap } from "lucide-react";

export function FlashBanner() {
  return (
    <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white py-4">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center space-x-4 animate-pulse">
          <Zap className="h-6 w-6" />
          <p className="text-lg font-bold">
            🔥 OFFRE DU JOUR : 30% de réduction sur les filtres à air !
          </p>
          <span className="bg-white text-red-600 px-3 py-1 rounded-full text-sm font-semibold">
            CODE: FILTRE30
          </span>
          <a 
            href="/promo/filtres" 
            className="bg-white text-red-600 px-6 py-2 rounded-full font-semibold hover:bg-gray-100 transition"
          >
            J'en profite →
          </a>
        </div>
      </div>
    </div>
  );
}
