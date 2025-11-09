/**
 * 🎁 PROMO BAR - Banner slim sticky premium
 * 
 * Design épuré avec :
 * - Livraison gratuite message
 * - Numéro de téléphone cliquable
 * - Responsive et compact
 * - Sticky au scroll
 */

import { Truck, Phone } from 'lucide-react';

export const PromoBar = () => {
  return (
    <div className="sticky top-0 z-40 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-4 text-sm md:text-base">
          {/* Message livraison gratuite */}
          <div className="flex items-center gap-2 flex-1">
            <Truck className="w-4 h-4 flex-shrink-0" />
            <span className="font-semibold">Livraison gratuite dès 100€</span>
          </div>

          {/* Numéro de téléphone cliquable */}
          <a
            href="tel:+33123456789"
            className="flex items-center gap-2 ml-auto md:ml-0 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors font-semibold"
          >
            <Phone className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">01 23 45 67 89</span>
            <span className="sm:hidden">Appeler</span>
          </a>
        </div>
      </div>
    </div>
  );
};
