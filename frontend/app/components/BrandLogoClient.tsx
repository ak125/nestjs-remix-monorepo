"use client";
import { useState, useEffect, memo } from "react";
import { getOptimizedLogoUrl } from "~/utils/image-optimizer";
import { logger } from "~/utils/logger";

interface BrandLogoClientProps {
  logoPath: string | null;
  brandName: string;
}

export const BrandLogoClient = memo(function BrandLogoClient({
  logoPath,
  brandName,
}: BrandLogoClientProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const availableLogos = [
    "audi.webp",
    "bmw.webp",
    "mercedes.webp",
    "alfa-romeo.webp",
    "renault.webp",
    "peugeot.webp",
    "citroen.webp",
    "volkswagen.webp",
    "ford.webp",
    "toyota.webp",
    "opel.webp",
    "seat.webp",
    "skoda.webp",
    "fiat.webp",
    "honda.webp",
    "hyundai.webp",
    "kia.webp",
    "mazda.webp",
    "mitsubishi.webp",
    "nissan.webp",
    "dacia.webp",
    "jeep.webp",
    "lancia.webp",
    "land-rover.webp",
    "mini.webp",
    "smart.webp",
    "suzuki.webp",
    "volvo.webp",
  ];

  // Initiales pour fallback
  const initials = brandName
    .split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#f3f4f6" rx="8"/><text x="32" y="40" text-anchor="middle" font-family="Arial" font-size="18" font-weight="bold" fill="#374151">${initials}</text></svg>`;

  // Pendant l'hydratation ou si pas de logo disponible, afficher initiales
  if (
    !isClient ||
    !logoPath ||
    !availableLogos.includes(logoPath) ||
    imageError
  ) {
    return (
      <div className="w-16 h-16 rounded-lg bg-gray-100 border border-gray-300 overflow-hidden">
        <img
          src={`data:image/svg+xml;base64,${btoa(svg)}`}
          alt={brandName}
          width={64}
          height={64}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  // Essayer d'afficher le logo via imgproxy (WebP optimisé)
  return (
    <div className="w-16 h-16 rounded-lg bg-white border border-gray-300 overflow-hidden shadow-sm">
      <img
        src={getOptimizedLogoUrl(
          `constructeurs-automobiles/marques-logos/${logoPath}`,
        )}
        alt={brandName}
        width={64}
        height={64}
        className="w-full h-full object-contain p-2"
        onLoad={() => {
          setImageLoaded(true);
          logger.log(`🎨 Logo affiché: ${brandName} (${logoPath})`);
        }}
        onError={() => {
          setImageError(true);
          logger.log(`❌ Logo échoué: ${brandName} (${logoPath})`);
        }}
      />

      {/* Fallback pendant le chargement */}
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 w-16 h-16 rounded-lg bg-gray-100 border border-gray-300 overflow-hidden">
          <img
            src={`data:image/svg+xml;base64,${btoa(svg)}`}
            alt={brandName}
            width={64}
            height={64}
            className="w-full h-full object-contain opacity-50"
          />
        </div>
      )}
    </div>
  );
});
