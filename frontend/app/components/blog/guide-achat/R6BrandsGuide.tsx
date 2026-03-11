/**
 * R6BrandsGuide — V2 brands guide section.
 * Anti-defamation: JAMAIS nommer de marques a eviter.
 * Shows recognized brands, quality signals, and alert signs.
 *
 * Supports 2 data formats:
 * - Flat: { recognized_brands, quality_signals, alert_signs }
 * - Tiered: { tiers: [{ label, quality_signals, recognized_brands }], alert_signs }
 */

import { Award, Shield, AlertTriangle, Star } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { type R6BrandsGuideSection } from "~/types/r6-guide.types";

/** Tiered format from newer V2 pipeline */
interface BrandTier {
  label: string;
  level?: string;
  quality_signals?: string[];
  recognized_brands?: string[];
}

/** Extended brandsGuide that may include tiers */
type BrandsGuideData = R6BrandsGuideSection & {
  intro?: string;
  tiers?: BrandTier[];
  alert_intro?: string;
};

interface Props {
  brandsGuide: BrandsGuideData;
  gammeName: string;
}

export function R6BrandsGuide({ brandsGuide, gammeName }: Props) {
  if (!brandsGuide) return null;

  const hasTiers =
    Array.isArray(brandsGuide.tiers) && brandsGuide.tiers.length > 0;
  const alertSigns = brandsGuide.alert_signs ?? [];

  return (
    <section id="guide-marques" className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-purple-500">
        Guide des marques — {gammeName}
      </h2>

      {brandsGuide.intro && (
        <p className="text-gray-600 mb-5 leading-relaxed">
          {brandsGuide.intro}
        </p>
      )}

      {/* Tiered format (disque-de-frein style) */}
      {hasTiers && (
        <div className="space-y-5 mb-5">
          {brandsGuide.tiers!.map((tier, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-4">
              <h3 className="flex items-center gap-2 font-semibold text-gray-900 mb-3">
                <Star className="w-4 h-4 text-purple-600" />
                {tier.label}
              </h3>
              {tier.recognized_brands && tier.recognized_brands.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {tier.recognized_brands.map((brand, j) => (
                    <Badge
                      key={j}
                      variant="outline"
                      className="bg-purple-50 text-purple-800 border-purple-300 px-3 py-1.5"
                    >
                      {brand}
                    </Badge>
                  ))}
                </div>
              )}
              {tier.quality_signals && tier.quality_signals.length > 0 && (
                <ul className="space-y-1 text-sm text-gray-600">
                  {tier.quality_signals.map((signal, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <Shield className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>{signal}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Flat format — Recognized brands */}
      {!hasTiers &&
        brandsGuide.recognized_brands &&
        brandsGuide.recognized_brands.length > 0 && (
          <div className="mb-4">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900 text-sm mb-3">
              <Award className="w-4 h-4 text-purple-600" />
              Marques reconnues
            </h3>
            <div className="flex flex-wrap gap-2">
              {brandsGuide.recognized_brands.map((brand, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="bg-purple-50 text-purple-800 border-purple-300 px-3 py-1.5"
                >
                  {brand.name}
                  {brand.speciality && (
                    <span className="text-purple-500 ml-1">
                      — {brand.speciality}
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

      {/* Flat format — Quality signals (object format) */}
      {!hasTiers &&
        brandsGuide.quality_signals &&
        brandsGuide.quality_signals.length > 0 && (
          <div className="mb-4">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900 text-sm mb-3">
              <Shield className="w-4 h-4 text-emerald-600" />
              Criteres de qualite
            </h3>
            <div className="space-y-2">
              {brandsGuide.quality_signals.map((signal, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3"
                >
                  <p className="font-medium text-sm text-gray-900">
                    {signal.signal}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {signal.why_it_matters}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Alert signs (shared by both formats) */}
      {alertSigns.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-gray-900 text-sm mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Signaux d&apos;alerte
          </h3>
          <div className="flex flex-wrap gap-2">
            {alertSigns.map((sign, i) => (
              <Badge
                key={i}
                variant="outline"
                className="bg-amber-50 text-amber-800 border-amber-300 text-xs px-3 py-1.5"
              >
                <AlertTriangle className="w-3 h-3 mr-1 inline" />
                {sign}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
