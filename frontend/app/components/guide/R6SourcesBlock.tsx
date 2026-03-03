/**
 * R6SourcesBlock — E-E-A-T block: source type, verification status, freshness.
 */

import { ShieldCheck, Calendar, Info } from "lucide-react";
import { Badge } from "~/components/ui/badge";

interface R6SourcesBlockProps {
  sourceType: string | null;
  sourceVerified: boolean;
  updatedAt: string;
}

export function R6SourcesBlock({
  sourceType,
  sourceVerified,
  updatedAt,
}: R6SourcesBlockProps) {
  const formattedDate = new Date(updatedAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      id="sources"
      className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-gray-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Sources et fiabilite
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {sourceType && (
          <Badge variant="outline" className="text-xs">
            {sourceType}
          </Badge>
        )}

        {sourceVerified && (
          <div className="inline-flex items-center gap-1.5 text-xs text-green-700">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verifie par nos experts</span>
          </div>
        )}

        <div className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>Mis a jour le {formattedDate}</span>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
        Les informations de ce guide sont basees sur des donnees constructeurs,
        des retours de professionnels de la mecanique et notre base de
        connaissances technique.
      </p>
    </div>
  );
}
