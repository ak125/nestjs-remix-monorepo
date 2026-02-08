/**
 * 🔍 HOME SEARCH CARDS
 *
 * Composant pour les 4 cartes de navigation principale de recherche
 *
 * Features :
 * - 4 types de recherche : Par pièce, Par marque, Expert, Référence OEM
 * - Design coloré avec dégradés (bleu, indigo, vert, orange)
 * - Hover effects avec transformations
 * - Navigation via scroll et liens
 *
 * Props :
 * - scrollToSection: Fonction pour scroller vers une section
 * - onReferenceSearchClick: Callback pour ouvrir le modal de recherche
 */

import { Link } from "@remix-run/react";
import { Award, ChevronRight, Package, Search, Users } from "lucide-react";
import { memo } from "react";

interface HomeSearchCardsProps {
  scrollToSection: (sectionId: string) => void;
  onReferenceSearchClick: () => void;
}

const HomeSearchCards = memo(function HomeSearchCards({
  scrollToSection,
  onReferenceSearchClick,
}: HomeSearchCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Type de pièce - BLEU - Scroll vers catalogue */}
      <button
        onClick={() => scrollToSection("catalogue")}
        className="group relative bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 border-blue-400 text-left w-full"
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>

        <div className="relative">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Package className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            Recherche par pièce
          </h3>
          <p className="text-sm text-white/95 mb-4 font-medium">
            Plaquettes, filtres, amortisseurs...
          </p>
          <div className="flex items-center text-white text-sm font-semibold">
            <span>Explorer le catalogue</span>
            <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </button>

      {/* Constructeur - INDIGO - Scroll vers marques */}
      <button
        onClick={() => scrollToSection("marques-title")}
        className="group relative bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 border-indigo-400 text-left w-full"
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>

        <div className="relative">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Award className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            Recherche par marque
          </h3>
          <p className="text-sm text-white/95 mb-4 font-medium">
            Choisissez votre véhicule
          </p>
          <div className="flex items-center text-white text-sm font-semibold">
            <span>Voir les marques</span>
            <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </button>

      {/* Avis expert - VERT */}
      <Link
        to="/contact"
        className="group relative bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 border-green-400"
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>

        <div className="relative">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Users className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Besoin d'aide ?</h3>
          <p className="text-sm text-white/95 mb-4 font-medium">
            Conseillers disponibles
          </p>
          <div className="flex items-center text-white text-sm font-semibold">
            <span>Contacter un expert</span>
            <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </Link>

      {/* Référence OEM - ORANGE */}
      <button
        onClick={onReferenceSearchClick}
        className="group relative bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 border-orange-400 text-left w-full"
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>

        <div className="relative">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Search className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            Code référence ?
          </h3>
          <p className="text-sm text-white/95 mb-4 font-medium">
            Ex: 7701208265
          </p>
          <div className="flex items-center text-white text-sm font-semibold">
            <span>Rechercher</span>
            <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </button>
    </div>
  );
});

export default HomeSearchCards;
