/**
 * PiecesCatalogueFamille - Catalogue collapsible des gammes de la même famille
 *
 * Affiche une grille 4x8 de gammes avec:
 * - Couleur dynamique selon la famille (hierarchyApi)
 * - Toggle collapsible avec animation
 * - Hover effects sur les items
 * - Lazy loading des images
 */

import { Await } from "@remix-run/react";
import { ChevronDown, Eye, Package } from "lucide-react";
import { Suspense, useState } from "react";

import { hierarchyApi } from "../../services/api/hierarchy.api";

export interface CatalogueMameFamilleItem {
  name: string;
  link: string;
  image: string;
  description: string;
}

export interface CatalogueMameFamilleFamily {
  mf_id: number;
  mf_name: string;
  mf_pic: string | null;
}

export interface CatalogueMameFamille {
  title: string;
  family: CatalogueMameFamilleFamily;
  items: CatalogueMameFamilleItem[];
}

interface PiecesCatalogueFamilleProps {
  catalogueMameFamillePromise: Promise<CatalogueMameFamille | null>;
  getAnchorText: (index: number) => string;
}

export function PiecesCatalogueFamille({
  catalogueMameFamillePromise,
  getAnchorText,
}: PiecesCatalogueFamilleProps) {
  const [catalogueOpen, setCatalogueOpen] = useState(false);

  return (
    <Suspense fallback={null}>
      <Await resolve={catalogueMameFamillePromise}>
        {(catalogueMameFamille) => {
          if (!catalogueMameFamille || !catalogueMameFamille.items?.length) {
            return null;
          }

          // Calculer la couleur de la famille
          const familleColor = catalogueMameFamille.family
            ? hierarchyApi.getFamilyColor({
                mf_id: catalogueMameFamille.family.mf_id,
                mf_name: catalogueMameFamille.family.mf_name,
                mf_pic: catalogueMameFamille.family.mf_pic,
              } as any)
            : "from-blue-950 via-indigo-900 to-purple-900";

          return (
            <div>
              <div
                className={`relative rounded-lg overflow-hidden shadow-lg bg-gradient-to-br ${familleColor}`}
              >
                {/* Header cliquable pour toggle */}
                <button
                  onClick={() => setCatalogueOpen(!catalogueOpen)}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/10 transition-colors"
                >
                  <h2 className="text-sm font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Catalogue{" "}
                    {catalogueMameFamille.family?.mf_name || "Système de freinage"}
                    <span className="text-xs font-normal opacity-75">
                      ({catalogueMameFamille.items.length})
                    </span>
                  </h2>
                  <ChevronDown
                    className={`w-5 h-5 text-white transition-transform duration-300 ${
                      catalogueOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Contenu collapsible */}
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    catalogueOpen
                      ? "max-h-[1000px] opacity-100"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="p-3 pt-0">
                    <div className="grid grid-cols-4 gap-1.5 auto-rows-max">
                      {catalogueMameFamille.items
                        .slice(0, 32)
                        .map((item, index) => (
                          <a
                            key={index}
                            href={item.link}
                            className="group relative aspect-square rounded-md overflow-hidden bg-white border border-white/20 hover:border-white hover:shadow-2xl hover:scale-110 hover:z-10 transition-all duration-300 cursor-pointer"
                            title={item.name}
                          >
                            {/* Image du produit */}
                            <img
                              src={item.image}
                              alt={item.name}
                              width={128}
                              height={128}
                              className="w-full h-full object-contain p-1 group-hover:p-0.5 transition-all duration-300"
                              loading="lazy"
                              decoding="async"
                              onError={(e) => {
                                e.currentTarget.src =
                                  "/images/placeholder-product.png";
                              }}
                            />

                            {/* Nom du produit - toujours visible en bas */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent text-white text-[6px] p-1 group-hover:from-black/95 group-hover:via-black/85 transition-all duration-300">
                              <p className="line-clamp-2 font-medium text-center leading-tight">
                                {item.name}
                              </p>
                            </div>

                            {/* Badge "Voir" au hover - apparaît en haut à droite */}
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                              <div className="bg-white/90 backdrop-blur-sm text-gray-900 text-[7px] font-bold px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-0.5">
                                <Eye className="w-2 h-2" />
                                <span>{getAnchorText(index)}</span>
                              </div>
                            </div>

                            {/* Effet de brillance au hover */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/0 to-transparent group-hover:via-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                          </a>
                        ))}
                      {catalogueMameFamille.items.length > 32 && (
                        <div className="flex items-center justify-center aspect-square rounded-md bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold text-[9px] shadow-sm">
                          +{catalogueMameFamille.items.length - 32}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }}
      </Await>
    </Suspense>
  );
}
