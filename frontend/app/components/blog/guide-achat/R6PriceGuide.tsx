/**
 * R6PriceGuide — V2 price guide section.
 * Two modes: "ranges" (sourced price tiers) or "factors" (variation factors).
 */

import { DollarSign, Info } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { type R6PriceGuideSection } from "~/types/r6-guide.types";

interface Props {
  priceGuide: R6PriceGuideSection;
  gammeName: string;
}

export function R6PriceGuide({ priceGuide, gammeName }: Props) {
  if (!priceGuide) return null;

  return (
    <section id="guide-prix" className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-green-500">
        Guide des prix — {gammeName}
      </h2>

      {priceGuide.mode === "ranges" && priceGuide.tiers && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {priceGuide.tiers.map((tier, i) => (
            <Card key={i} className="border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-gray-900 text-sm">
                    {tier.label}
                  </span>
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-300 text-xs ml-auto"
                  >
                    {tier.range_hint}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{tier.safe_wording}</p>
                {tier.target_profile && (
                  <p className="text-xs text-gray-500 mt-1">
                    Pour : {tier.target_profile}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {priceGuide.mode === "factors" && priceGuide.variation_factors && (
        <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 mb-4">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">
            Facteurs qui influencent le prix
          </h3>
          <ul className="space-y-2">
            {priceGuide.variation_factors.map((factor, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-sm text-gray-700"
              >
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>{priceGuide.disclaimer}</span>
      </div>
    </section>
  );
}
