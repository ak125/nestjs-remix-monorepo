/**
 * 🎨 Header Premium pour Route Pièces - Style Constructeur/Véhicule
 * Design inspiré de constructeurs.$brand.$model.$type.tsx
 *
 * ⚠️ URLS PRÉSERVÉES - Breadcrumb et navigation inchangés
 */

import { Car, Package, Shield, Truck } from "lucide-react";
import React, { useState } from "react";

import { brandColorsService } from "../../services/brand-colors.service";
import {
  type GammeData,
  type PerformanceInfo,
  type VehicleData,
} from "../../types/pieces-route.types";
import { ImageOptimizer } from "../../utils/image-optimizer";

interface PiecesHeaderProps {
  vehicle: VehicleData;
  gamme: GammeData;
  count: number;
  minPrice?: number;
  prixPasCherText?: string; // Texte dynamique "pas cher"
  performance?: PerformanceInfo;
}

/**
 * Header premium avec gradient dynamique (style page véhicule)
 * ⚠️ URLs breadcrumb strictement préservées
 */
export function PiecesHeader({
  vehicle,
  gamme,
  count,
  minPrice,
  prixPasCherText,
  performance,
}: PiecesHeaderProps) {
  const [imageError, setImageError] = useState(false);

  // Formater le prix et le texte "pas cher"
  const _priceText =
    minPrice && minPrice > 0
      ? `à partir de ${minPrice.toFixed(2)} €`
      : "au meilleur prix";

  // Utiliser le texte dynamique ou fallback
  const finalText = prixPasCherText || "au meilleur prix";

  // Récupérer le gradient de la marque du véhicule
  const brandGradient = vehicle.marqueAlias
    ? brandColorsService.getBrandGradient(vehicle.marqueAlias)
    : brandColorsService.getBrandGradient(vehicle.marque);

  // Convertir le gradient CSS en classes Tailwind (approximation)
  // On garde la logique de gradient CSS inline pour plus de flexibilité
  const gradientStyle = brandGradient;

  return (
    <>
      {/* 🚗 Hero Section - Design UI/UX Expert Premium */}
      <section
        className="relative overflow-hidden text-white py-8 md:py-10"
        style={gradientStyle}
      >
        {/* Effets d'arrière-plan optimisés */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 30%, rgba(255,255,255,0.12) 0%, transparent 45%),
                           radial-gradient(circle at 80% 70%, rgba(0,0,0,0.18) 0%, transparent 45%)`,
          }}
          aria-hidden="true"
        />
        {/* Animation infinie retirée pour LCP */}
        <div
          className="absolute top-0 right-0 w-[700px] h-[700px] bg-white/[0.025] rounded-full blur-3xl"
          aria-hidden="true"
        ></div>

        <div className="relative z-10 container mx-auto px-4 max-w-7xl">
          {/* Hero Grid - Layout optimal */}
          <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 lg:gap-8 items-start">
            {/* Zone de contenu principale */}
            <div className="space-y-5">
              {/* Header typographique optimisé - animations retirées pour LCP */}
              <header>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight mb-3 tracking-tight">
                  <span className="bg-gradient-to-br from-white via-white to-white/90 bg-clip-text text-transparent drop-shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                    {gamme.name} {vehicle.marque.toUpperCase()}{" "}
                    {vehicle.modele.toUpperCase()}{" "}
                    {vehicle.typeName || vehicle.type} {finalText}
                  </span>
                </h1>
              </header>

              {/* Specs Grid - Badges horizontaux premium */}
              <div className="flex flex-wrap gap-2.5">
                {/* Badge Prix premium avec pulse */}
                {minPrice && minPrice > 0 && (
                  <div className="group bg-gradient-to-br from-white/[0.24] via-white/[0.18] to-white/[0.10] backdrop-blur-none md:backdrop-blur-xl rounded-xl px-4 py-2.5 border border-white/35 shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-default">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform duration-300">
                        <span className="text-lg">💰</span>
                      </div>
                      <div>
                        <div className="text-2xl font-black text-white leading-none tracking-tight">
                          {minPrice.toFixed(2)} €
                        </div>
                        <div className="text-white/70 text-[9px] uppercase tracking-wider font-bold mt-0.5">
                          À partir de
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Badge Nombre de pièces */}
                <div className="group bg-white/[0.14] backdrop-blur-none md:backdrop-blur-xl rounded-xl px-3.5 py-2.5 border border-white/30 shadow-lg hover:bg-white/[0.18] hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-default">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center shadow-md group-hover:rotate-6 transition-transform duration-300">
                      <Package
                        className="w-4 h-4 text-white"
                        strokeWidth={2.5}
                      />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-black text-white">
                        {count}
                      </span>
                      <span className="text-sm font-bold text-white/90">
                        pièce{count > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Badge Qualité */}
                <div className="group bg-white/[0.14] backdrop-blur-none md:backdrop-blur-xl rounded-xl px-3.5 py-2.5 border border-white/30 shadow-lg hover:bg-white/[0.18] hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-default relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-shimmer"></div>
                  <div className="flex items-center gap-2.5 relative z-10">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center shadow-md group-hover:-rotate-6 transition-transform duration-300">
                      <Shield
                        className="w-4 h-4 text-white"
                        strokeWidth={2.5}
                      />
                    </div>
                    <span className="text-sm font-bold text-white">
                      Qualité garantie
                    </span>
                  </div>
                </div>

                {/* Badge Livraison */}
                <div className="group bg-white/[0.14] backdrop-blur-none md:backdrop-blur-xl rounded-xl px-3.5 py-2.5 border border-white/30 shadow-lg hover:bg-white/[0.18] hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-default">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center shadow-md group-hover:translate-x-1 transition-transform duration-300">
                      <Truck className="w-4 h-4 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-bold text-white">
                      Livraison rapide
                    </span>
                  </div>
                </div>

                {/* Badge Performance si disponible */}
                {performance && (
                  <div className="flex items-center gap-2 bg-purple-500/20 backdrop-blur-sm border border-purple-300/30 rounded-xl px-3 py-2">
                    <svg
                      className="w-3.5 h-3.5 text-purple-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    <span className="text-white text-xs font-medium">
                      {performance.source} • {performance.loadTime}ms
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Image Premium - Sidebar optimisée */}
            <div className="lg:sticky lg:top-8">
              <div className="relative group">
                {/* Effet halo lumineux */}
                <div className="absolute -inset-3 bg-gradient-to-br from-white/[0.22] via-white/[0.12] to-transparent rounded-2xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-700"></div>

                {/* Container carte - backdrop-blur désactivé sur mobile pour LCP */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-white/[0.18] via-white/[0.12] to-white/[0.06] backdrop-blur-none md:backdrop-blur-2xl rounded-2xl p-2.5 border border-white/30 shadow-[0_12px_48px_rgba(0,0,0,0.15)]">
                    <div className="relative overflow-hidden rounded-xl">
                      {!imageError &&
                      vehicle.modelePic &&
                      vehicle.modelePic !== "no.webp" ? (
                        <>
                          {/* 🚀 LCP FIX: srcSet responsive via imgproxy pour charger taille adaptée au viewport */}
                          {(() => {
                            const heroImagePath = `constructeurs-automobiles/marques-modeles/${vehicle.marqueAlias || vehicle.marque.toLowerCase()}/${vehicle.modelePic}`;
                            const heroSrc = ImageOptimizer.getOptimizedUrl(
                              heroImagePath,
                              { width: 380, quality: 85 },
                            );
                            const heroSrcSet =
                              ImageOptimizer.getResponsiveSrcSet(
                                heroImagePath,
                                [200, 300, 380],
                                85,
                              );
                            return (
                              <img
                                src={heroSrc}
                                srcSet={heroSrcSet}
                                sizes="(max-width: 640px) 200px, (max-width: 1024px) 300px, 380px"
                                alt={`${vehicle.marque} ${vehicle.modele} ${vehicle.typeName || vehicle.type}`}
                                width={380}
                                height={192}
                                className="w-full h-48 object-cover group-hover:scale-[1.05] transition-transform duration-500 ease-out"
                                loading="eager"
                                // @ts-expect-error - fetchpriority is a valid HTML attribute but React types it as fetchPriority
                                fetchpriority="high"
                                decoding="async"
                                onError={() => setImageError(true)}
                              />
                            );
                          })()}
                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent"></div>
                        </>
                      ) : (
                        <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-col gap-2">
                          <Car
                            className="w-16 h-16 text-gray-400"
                            strokeWidth={1.5}
                            aria-label={`Image ${vehicle.marque} ${vehicle.modele} non disponible`}
                          />
                          <p className="text-xs text-gray-500 font-medium">
                            Image non disponible
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
