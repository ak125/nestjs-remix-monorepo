/**
 * 🎨 Header Premium pour Route Pièces - Style Constructeur/Véhicule
 * Design inspiré de constructeurs.$brand.$model.$type.tsx
 *
 * ⚠️ URLS PRÉSERVÉES - Breadcrumb et navigation inchangés
 */

import { buildR2H1Emitted } from "@repo/seo-types";
import { Car } from "lucide-react";
import React, { useState, memo } from "react";

import { brandColorsService } from "../../services/brand-colors.service";
import {
  type GammeData,
  type PerformanceInfo,
  type VehicleData,
} from "../../types/pieces-route.types";
import { ImageOptimizer, isValidImagePath } from "../../utils/image-optimizer";
import { PiecesHeroTrustStrip } from "./hero";

interface PiecesHeaderProps {
  vehicle: VehicleData;
  gamme: GammeData;
  count: number;
  minPrice?: number;
  prixPasCherText?: string; // Texte dynamique "pas cher" (legacy override)
  /** Per-pg_id technique variations (__seo_gamme_car_switch.sgcs_alias=2) :
   * pool de suffixes H1 gamme-specific (ex. "synchroniser les soupapes" pour
   * pg_id=307 kit-distribution). Rotation déterministe par (typeId+pgId)
   * via @repo/seo-types pickH1Suffix. Vide → fallback SEO_PRICE_VARIATIONS. */
  compSwitch2?: readonly string[];
  performance?: PerformanceInfo;
}

/**
 * Header premium avec gradient dynamique (style page véhicule)
 * ⚠️ URLs breadcrumb strictement préservées
 */
export const PiecesHeader = memo(function PiecesHeader({
  vehicle,
  gamme,
  count,
  minPrice,
  prixPasCherText,
  compSwitch2,
  performance,
}: PiecesHeaderProps) {
  const [imageError, setImageError] = useState(false);

  // H1 R2 = builder partagé @repo/seo-types `buildR2H1Emitted` (PR-D2). L'assemblage
  // (rotation suffixe compSwitch2 → SEO_PRICE_VARIATIONS → "au meilleur prix" legacy
  // #763 ; enrichissement type powerPs/fuel anti-collision ambiguïté, audit 2026-05-26)
  // vit désormais DANS le builder, rendu ici ET hashé par le fingerprint anti-duplicate
  // → divergence impossible. Byte-identique au JSX précédent (golden #1178 +
  // pieces-header-h1-parity.test.tsx).

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
                  <span className="text-foreground from-white via-white to-white/90 drop-shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                    {buildR2H1Emitted({
                      gammeName: gamme.name,
                      marque: vehicle.marque,
                      modele: vehicle.modele,
                      typeName: vehicle.typeName || vehicle.type,
                      typePowerPs: vehicle.typePowerPs,
                      typeFuel: vehicle.typeFuel,
                      ctx: { typeId: vehicle.typeId, pgId: gamme.id },
                      compSwitch2,
                      literalFallback: prixPasCherText,
                    })}
                  </span>
                </h1>
              </header>

              {/*
                Trust Strip 3-tier — refonte 2026-05-28 (direction "Confiance",
                canon `frontend-design` + audit `ui-ux-pro-max`).
                Voir `frontend/app/components/pieces/hero/` pour les sous-composants
                atomiques testés (47 tests passants).
              */}
              <PiecesHeroTrustStrip
                count={count}
                vehicleModele={vehicle.modele}
                vehicleType={vehicle.typeName || vehicle.type}
                minPrice={minPrice}
                debugPerformance={performance}
              />
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
                      {(() => {
                        // Chaîne de fallback hero image :
                        // 1. vehicle.modelePic (photo véhicule)
                        // 2. gamme.image (vignette gamme pg_pic)
                        // 3. Image générique par alias gamme
                        let heroImagePath: string | null = null;
                        let heroAlt = `${vehicle.marque} ${vehicle.modele} ${vehicle.typeName || vehicle.type}`;
                        let objectFit: "cover" | "contain" = "cover";

                        if (
                          !imageError &&
                          vehicle.modelePic &&
                          isValidImagePath(vehicle.modelePic)
                        ) {
                          heroImagePath = `constructeurs-automobiles/marques-modeles/${vehicle.marqueAlias || vehicle.marque.toLowerCase()}/${vehicle.modelePic}`;
                        } else if (
                          gamme.image &&
                          isValidImagePath(gamme.image)
                        ) {
                          heroImagePath = gamme.image.startsWith("http")
                            ? null // URL absolue gérée séparément
                            : gamme.image.includes("/")
                              ? gamme.image.replace(/^\/img\/uploads\//, "")
                              : `articles/gammes-produits/catalogue/${gamme.image}`;
                          heroAlt = `${gamme.name} - pièce auto`;
                          objectFit = "contain";
                        }

                        if (heroImagePath) {
                          const imgSet = ImageOptimizer.getPictureImageSet(
                            heroImagePath,
                            {
                              widths: [200, 300, 380],
                              quality: 85,
                              sizes:
                                "(max-width: 640px) 200px, (max-width: 1024px) 300px, 380px",
                              width: 380,
                              height: 192,
                            },
                          );
                          return (
                            <>
                              <picture>
                                <source
                                  srcSet={imgSet.avifSrcSet}
                                  sizes={imgSet.sizes}
                                  type="image/avif"
                                />
                                <source
                                  srcSet={imgSet.webpSrcSet}
                                  sizes={imgSet.sizes}
                                  type="image/webp"
                                />
                                <img
                                  src={imgSet.fallbackSrc}
                                  alt={heroAlt}
                                  width={380}
                                  height={192}
                                  className={`w-full h-48 object-${objectFit} group-hover:scale-[1.05] transition-transform duration-500 ease-out`}
                                  loading="eager"
                                  fetchPriority="high"
                                  decoding="async"
                                  onError={() => setImageError(true)}
                                />
                              </picture>
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent"></div>
                            </>
                          );
                        }

                        // Fallback ultime : icône véhicule
                        return (
                          <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-col gap-2">
                            <Car
                              className="w-16 h-16 text-gray-400"
                              strokeWidth={1.5}
                              aria-label={`Image ${vehicle.marque} ${vehicle.modele} non disponible`}
                            />
                            <p className="text-xs text-gray-500 font-medium">
                              {gamme.name}
                            </p>
                          </div>
                        );
                      })()}
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
});
