// 📁 frontend/app/components/home/FamilyGammeHierarchy.tsx
// 🏗️ Composant d'affichage de la hiérarchie Familles → Gammes (sous-catégories)

import { Link } from "@remix-run/react";
import { useState, useEffect, memo } from "react";

import { getFamilyTheme } from "~/utils/family-theme";
import {
  type FamilyWithGammes,
  type HierarchyStats,
} from "../../services/api/hierarchy.api";
import { Button } from "../ui/button";

// 🎨 Fonctions utilitaires locales pour éviter les imports API redondants
const getFamilyIcon = (family: FamilyWithGammes): string => {
  const iconMap: { [id: string]: string } = {
    "1": "🔧", // Système de filtration
    "2": "🛠️", // Système de freinage
    "3": "⚙️", // Système d'échappement
    "4": "🔌", // Système électrique
    "5": "🏁", // Performance
    "6": "🛡️", // Protection
    "7": "💡", // Éclairage
    "8": "🌡️", // Refroidissement
    "9": "🚗", // Carrosserie
    "10": "🔩", // Visserie
  };
  return iconMap[family.mf_id] || "🔧";
};

const getFamilyColor = (family: FamilyWithGammes): string => {
  return getFamilyTheme(family.mf_id).gradient;
};

const getFamilyImage = (family: FamilyWithGammes): string => {
  if (!family.mf_pic) {
    return "/images/categories/default.svg";
  }
  // ✅ Migration /img/* : Proxy Caddy avec cache 1 an
  return `/img/uploads/articles/familles-produits/${family.mf_pic}`;
};

interface FamilyGammeHierarchyProps {
  className?: string;
  hierarchyData?: {
    families: FamilyWithGammes[];
    stats: HierarchyStats;
    success: boolean;
  } | null;
}

const FamilyGammeHierarchy = memo(function FamilyGammeHierarchy({
  className = "",
  hierarchyData,
}: FamilyGammeHierarchyProps) {
  const [families, setFamilies] = useState<FamilyWithGammes[]>([]);
  const [stats, setStats] = useState<HierarchyStats>({
    total_families: 0,
    total_gammes: 0,
    total_manufacturers: 0,
    families_with_gammes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [expandedFamilies, setExpandedFamilies] = useState<string[]>([]);

  // Charger les données depuis les props (pas de fallback API pour éviter les doublons)
  useEffect(() => {
    if (hierarchyData && hierarchyData.success && hierarchyData.families) {
      setFamilies(hierarchyData.families);
      setStats(hierarchyData.stats);

      // ✅ AUTO-EXPAND TOUTES LES FAMILLES PAR DÉFAUT pour afficher toutes les sous-catégories
      if (hierarchyData.families.length > 0) {
        setExpandedFamilies(hierarchyData.families.map((f) => String(f.mf_id)));
      }
      setLoading(false);
    } else {
      // Pas de données valides - affichage vide sans appel API redondant
      setFamilies([]);
      setStats({
        total_families: 0,
        total_gammes: 0,
        total_manufacturers: 0,
        families_with_gammes: 0,
      });
      setLoading(false);
    }
  }, [hierarchyData]);

  // Toggle d'expansion d'une famille
  const toggleFamily = (familyId: string) => {
    setExpandedFamilies((prev) =>
      prev.includes(familyId)
        ? prev.filter((id) => id !== familyId)
        : [...prev, familyId],
    );
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
        <p className="text-center text-gray-500 mt-6">
          🏗️ Chargement de la hiérarchie des catégories...
        </p>
      </div>
    );
  }

  if (families.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏗️</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            Aucune catégorie disponible
          </h3>
          <p className="text-gray-600">
            La hiérarchie des catégories n'est pas encore configurée.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* En-tête avec statistiques */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white p-6 rounded-t-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">🏗️ Catégories de Produits</h2>
          <div className="text-right">
            <div className="text-3xl font-bold">{stats.total_gammes}</div>
            <div className="text-sm opacity-90">Sous-catégories</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{families.length}</div>
            <div className="text-xs opacity-90">Familles affichées</div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">
              {stats.families_with_gammes}
            </div>
            <div className="text-xs opacity-90">Familles actives</div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">
              {stats.total_manufacturers}
            </div>
            <div className="text-xs opacity-90">Fabricants</div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">
              {stats.total_gammes > 0
                ? Math.round(stats.total_gammes / stats.families_with_gammes)
                : 0}
            </div>
            <div className="text-xs opacity-90">Moy./famille</div>
          </div>
        </div>
      </div>

      {/* Grille des familles */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {families.map((family) => {
            const isExpanded = expandedFamilies.includes(String(family.mf_id));
            const familyIcon = getFamilyIcon(family);
            const familyColor = getFamilyColor(family);
            const familyImage = getFamilyImage(family);

            return (
              <div
                key={family.mf_id}
                className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* En-tête de la famille */}
                <div
                  className={`bg-gradient-to-r ${familyColor} text-white p-4`}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-2xl">{familyIcon}</span>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">
                        {family.mf_name_system}
                      </h3>
                      <p className="text-sm opacity-90">{family.mf_name}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="bg-white bg-opacity-30 rounded-full px-3 py-1 text-sm font-bold">
                      {family.gammes_count} sous-catégories
                    </span>
                    <button
                      onClick={() => toggleFamily(String(family.mf_id))}
                      className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-2 transition-colors"
                    >
                      <svg
                        className={`w-4 h-4 transform transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Image et description */}
                <div className="p-4">
                  <div className="aspect-video bg-gray-100 rounded-lg mb-3 overflow-hidden">
                    <img
                      src={familyImage}
                      alt={family.mf_name_system}
                      width={400}
                      height={225}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = "/images/categories/default.svg";
                      }}
                    />
                  </div>

                  <p className="text-sm text-gray-600 line-clamp-3">
                    {family.mf_description}
                  </p>
                </div>

                {/* Sous-catégories (gammes) */}
                {isExpanded && (
                  <div className="bg-gray-50 p-4 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-3">
                      Sous-catégories ({family.gammes_count})
                    </h4>
                    <div className="grid grid-cols-1 gap-2 max-h-none overflow-visible">
                      {/* ✅ AFFICHER TOUTES LES SOUS-CATÉGORIES (pas de .slice(0, 10)) */}
                      {family.gammes.map((gamme) => {
                        // Générer l'URL directement vers la page gamme au format pieces/{alias}-{id}.html
                        const categoryUrl =
                          gamme.pg_id && gamme.pg_alias
                            ? `/pieces/${gamme.pg_alias}-${gamme.pg_id}.html`
                            : `/products/catalog?search=${encodeURIComponent(gamme.pg_name || "")}&gamme=${gamme.pg_id}`;

                        return (
                          <Link
                            key={gamme.pg_id}
                            to={categoryUrl}
                            className="bg-white rounded p-2 text-sm hover:bg-info/20 transition-colors block"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-gray-700">
                                {gamme.pg_name || `Gamme #${gamme.pg_id}`}
                              </span>
                              <span className="text-xs text-gray-500">
                                {gamme.mc_sort ? `Ordre ${gamme.mc_sort}` : ""}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pied de carte */}
                <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                  <Link
                    to={`/products/catalog?family=${family.mf_id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
                  >
                    Explorer {family.mf_name_system} →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pied de page avec actions */}
      <div className="bg-gray-50 px-6 py-4 rounded-b-lg border-t border-gray-200">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {expandedFamilies.length} famille(s) dépliée(s) sur{" "}
            {families.length}
          </div>
          <div className="space-x-3">
            <button
              onClick={() =>
                setExpandedFamilies(families.map((f) => String(f.mf_id)))
              }
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Tout déplier
            </button>
            <button
              onClick={() => setExpandedFamilies([])}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              Tout replier
            </button>
            <Button
              className="text-sm  px-4 py-2 rounded"
              variant="blue"
              asChild
            >
              <Link to="/catalog">Voir tout le catalogue</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default FamilyGammeHierarchy;
