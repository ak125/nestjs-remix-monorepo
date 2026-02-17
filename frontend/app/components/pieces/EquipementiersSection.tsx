import { Link } from "@remix-run/react";
import { memo } from "react";

interface EquipementierItem {
  pm_id: number;
  pm_name: string;
  pm_logo: string;
  title: string;
  image: string;
  description: string;
}

interface EquipementiersSectionProps {
  equipementiers?: {
    title: string;
    items: EquipementierItem[];
  };
  isDarkMode?: boolean;
}

/**
 * Génère l'URL de la page équipementier
 * Exemple: BOSCH → /pieces-bosch.html
 */
function getEquipementierUrl(pmName: string): string {
  const slug = pmName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Enlever les accents
    .replace(/[^a-z0-9]+/g, "-") // Remplacer les caractères spéciaux par des tirets
    .replace(/-+/g, "-") // Éviter les doubles tirets
    .replace(/^-|-$/g, ""); // Enlever les tirets au début/fin
  return `/pieces-${slug}.html`;
}

const EquipementiersSection = memo(function EquipementiersSection({
  equipementiers,
}: EquipementiersSectionProps) {
  if (!equipementiers?.items || equipementiers.items.length === 0) {
    return null;
  }

  return (
    <section className="bg-white rounded-xl shadow-lg mb-8 overflow-hidden">
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          🏭 {equipementiers.title}
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
            {equipementiers.items.length} marques
          </span>
        </h2>
      </div>

      <div className="p-6">
        <p className="text-gray-700 mb-6 text-sm leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100">
          <span className="font-medium text-gray-900">
            Nous sélectionnons des équipementiers reconnus
          </span>{" "}
          pour garantir performance, sécurité et longévité, selon les standards
          d'origine.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {equipementiers.items.map((equipementier) => (
            <Link
              key={equipementier.pm_id}
              to={getEquipementierUrl(equipementier.pm_name)}
              className="group border border-gray-200 rounded-lg p-5 hover:border-orange-300 hover:shadow-md transition-all duration-200 block"
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <img
                    src={equipementier.pm_logo || equipementier.image}
                    alt={`Logo ${equipementier.pm_name}`}
                    width={64}
                    height={64}
                    className="w-16 h-16 object-contain rounded-lg border-2 border-gray-100 p-2 group-hover:border-orange-200 transition-colors"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.src = "/images/default-brand.jpg";
                    }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors">
                    {equipementier.pm_name}
                  </h3>

                  <p className="text-sm text-gray-600 leading-relaxed">
                    {equipementier.description}
                  </p>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-orange-600 font-medium flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Marque de confiance
                    </span>
                    <span className="text-xs text-gray-400 group-hover:text-orange-500 transition-colors flex items-center">
                      Voir les pièces
                      <svg
                        className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
});

export default EquipementiersSection;
