/**
 * 🔗 Section Cross-Selling pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 *
 * ⚠️ CRITIQUE: URLs préservées /pieces/{gamme}/{marque}/{modele}/{type}.html
 * 📊 TRACKING: Intégration du hook useSeoLinkTracking pour analytics
 */

import { Link } from "@remix-run/react";
import React, { useEffect } from "react";

import { useSeoLinkTracking } from "../../hooks/useSeoLinkTracking";
import {
  type CrossSellingGamme,
  type VehicleData,
} from "../../types/pieces-route.types";

interface PiecesCrossSellingProps {
  gammes: CrossSellingGamme[];
  vehicle: VehicleData;
}

/**
 * Composant Cross-Selling avec gammes complémentaires
 * URLs FORMAT: /pieces/{gamme}/{marque}/{modele}/{type}.html
 */
export function PiecesCrossSelling({
  gammes,
  vehicle,
}: PiecesCrossSellingProps) {
  const { trackClick, trackImpression } = useSeoLinkTracking();

  // 📊 Track les impressions au montage
  useEffect(() => {
    if (gammes.length > 0) {
      trackImpression("CrossSelling", gammes.length);
    }
  }, [gammes.length, trackImpression]);

  // Handler pour tracker les clics avec ancres SEO enrichies
  const handleCrossSellingClick = (gamme: CrossSellingGamme, url: string) => {
    // Ancre enrichie: "Gamme + véhicule + qualité"
    const seoAnchor = `${gamme.PG_NAME} ${vehicle.marque} ${vehicle.modele} - Qualité origine`;
    trackClick("CrossSelling", url, {
      anchorText: seoAnchor,
      position: "crossselling",
    });
  };

  if (gammes.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 px-6 py-4 border-b border-teal-200">
        <h2 className="text-2xl font-bold text-teal-900 flex items-center gap-3">
          <svg
            className="w-7 h-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
          </svg>
          Pièces complémentaires
        </h2>
        <p className="text-sm text-teal-700 mt-1">
          Découvrez d'autres gammes pour votre {vehicle.marque} {vehicle.modele}
        </p>
      </div>

      <div className="p-6">
        {/* Grid des gammes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {gammes.map((gamme) => {
            // ⚠️ CRITIQUE: Construction URL préservée
            // Format: /pieces/{gamme}/{marque}/{modele}/{type}.html
            const url = `/pieces/${gamme.PG_ALIAS}/${vehicle.marque}/${vehicle.modele}/${vehicle.type}.html`;

            return (
              <Link
                key={gamme.PG_ID}
                to={url}
                className="group bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200 hover:border-teal-400 hover:shadow-lg transition-all duration-300 overflow-hidden"
                onClick={() => handleCrossSellingClick(gamme, url)}
                title={`Achetez des ${gamme.PG_NAME} pour ${vehicle.marque} ${vehicle.modele} ${vehicle.type} - Livraison rapide`}
              >
                {/* Image gamme */}
                <div className="aspect-video bg-gradient-to-br from-teal-50 to-cyan-50 relative overflow-hidden">
                  {gamme.PG_IMAGE ? (
                    <img
                      src={gamme.PG_IMAGE}
                      alt={gamme.PG_NAME}
                      width={320}
                      height={180}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg
                        className="w-16 h-16 text-teal-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Badge overlay */}
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium text-teal-700 shadow-md">
                    Voir les pièces
                  </div>
                </div>

                {/* Contenu - Ancre SEO enrichie */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 group-hover:text-teal-600 transition-colors line-clamp-2 leading-tight min-h-[40px]">
                    {gamme.PG_NAME} {vehicle.marque}
                  </h3>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      Compatible {vehicle.type}
                    </span>
                    <svg
                      className="w-5 h-5 text-teal-600 group-hover:translate-x-1 transition-transform"
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
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Message si beaucoup de gammes */}
        {gammes.length > 8 && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 mb-3">
              Et bien d'autres pièces disponibles pour votre véhicule
            </p>
            <Link
              to={`/pieces`}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-sm hover:shadow-md"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
              Voir toutes les gammes
            </Link>
          </div>
        )}

        {/* Info URLs préservées */}
        <div className="mt-6 p-4 bg-teal-50 rounded-lg border border-teal-200">
          <p className="text-xs text-teal-800 flex items-start gap-2">
            <svg
              className="w-4 h-4 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              Les liens vous redirigent vers les pièces compatibles avec votre{" "}
              <strong>
                {vehicle.marque} {vehicle.modele} {vehicle.type}
              </strong>
              . Tous les produits affichés sont garantis compatibles avec votre
              motorisation.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Version compacte pour sidebar (optionnelle)
 */
export function PiecesCrossSellingCompact({
  gammes,
  vehicle,
}: PiecesCrossSellingProps) {
  if (gammes.length === 0) return null;

  // Limiter à 5 gammes max pour version compacte
  const limitedGammes = gammes.slice(0, 5);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 px-4 py-3 border-b border-teal-200">
        <h3 className="text-sm font-bold text-teal-900 flex items-center gap-2">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
          </svg>
          Autres pièces
        </h3>
      </div>

      <div className="p-3 space-y-2">
        {limitedGammes.map((gamme) => {
          // ⚠️ CRITIQUE: Construction URL préservée
          const url = `/pieces/${gamme.PG_ALIAS}/${vehicle.marque}/${vehicle.modele}/${vehicle.type}.html`;

          return (
            <Link
              key={gamme.PG_ID}
              to={url}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-teal-50 transition-colors group"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                {gamme.PG_IMAGE ? (
                  <img
                    src={gamme.PG_IMAGE}
                    alt=""
                    width={32}
                    height={32}
                    className="w-8 h-8 object-cover rounded"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <svg
                    className="w-5 h-5 text-teal-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 group-hover:text-teal-600 transition-colors line-clamp-1">
                  {gamme.PG_NAME}
                </div>
              </div>
              <svg
                className="w-4 h-4 text-gray-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all"
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}
