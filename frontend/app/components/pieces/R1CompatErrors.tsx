/**
 * R1 "Erreurs fréquentes de compatibilité" — Checklist visuelle.
 * Family-aware defaults: contenu différencié par famille automobile.
 */
import { Square } from "lucide-react";

import {
  getDefaultCompatErrors,
  inferFamilyKey,
} from "~/utils/r1-family-defaults";

export function R1CompatErrors({
  compatErrors,
  gammeName,
  familleName,
}: {
  compatErrors?: string[] | null;
  gammeName: string;
  familleName?: string;
}) {
  const errors =
    compatErrors && compatErrors.length > 0
      ? compatErrors
      : getDefaultCompatErrors(
          gammeName,
          inferFamilyKey(gammeName, familleName),
        );

  return (
    <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 sm:p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-3">
        Vérifiez avant de commander votre {gammeName}
      </h3>
      <ul className="space-y-2.5">
        {errors.slice(0, 4).map((error, i) => (
          <li key={i} className="flex items-start gap-3">
            <Square className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
            <span className="text-sm text-gray-700 leading-snug">{error}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
