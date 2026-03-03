/**
 * R6QualityTiersTable — V2 quality tiers comparison.
 * Displays OE / Equiv OE / Adaptable / Reconditionne / Echange standard.
 * Replaces the V1 R6CriteriaTable for V2 pages.
 */

import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { type R6QualityTier } from "~/types/r6-guide.types";

interface Props {
  tiers: R6QualityTier[];
  gammeName: string;
}

const TIER_COLORS: Record<string, string> = {
  oe: "border-emerald-300 bg-emerald-50",
  equiv_oe: "border-blue-300 bg-blue-50",
  adaptable: "border-amber-300 bg-amber-50",
  reconditionne: "border-purple-300 bg-purple-50",
  echange_standard: "border-teal-300 bg-teal-50",
};

const TIER_BADGE_COLORS: Record<string, string> = {
  oe: "bg-emerald-100 text-emerald-800 border-emerald-300",
  equiv_oe: "bg-blue-100 text-blue-800 border-blue-300",
  adaptable: "bg-amber-100 text-amber-800 border-amber-300",
  reconditionne: "bg-purple-100 text-purple-800 border-purple-300",
  echange_standard: "bg-teal-100 text-teal-800 border-teal-300",
};

export function R6QualityTiersTable({ tiers, gammeName }: Props) {
  if (tiers.length === 0) return null;

  return (
    <section id="niveaux-qualite" className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-emerald-500">
        Niveaux de qualite — {gammeName}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiers.map((tier) => (
          <Card
            key={tier.tier_id}
            className={`border-2 ${TIER_COLORS[tier.tier_id] || "border-gray-200 bg-gray-50"} ${!tier.available ? "opacity-60" : ""}`}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <Badge
                  variant="outline"
                  className={
                    TIER_BADGE_COLORS[tier.tier_id] ||
                    "bg-gray-100 text-gray-800"
                  }
                >
                  {tier.label}
                </Badge>
                {tier.available ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed mb-2">
                {tier.description}
              </p>
              {tier.target_profile && (
                <p className="text-xs text-gray-500">
                  Pour : {tier.target_profile}
                </p>
              )}
              {tier.price_hint && (
                <p className="text-xs text-gray-500 mt-1">
                  Budget : {tier.price_hint}
                </p>
              )}
              {!tier.available && (
                <p className="text-xs text-gray-400 mt-1 italic">
                  Non disponible pour cette gamme
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
