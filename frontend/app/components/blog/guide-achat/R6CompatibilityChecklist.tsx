/**
 * R6CompatibilityChecklist — V2 compatibility axes checklist.
 * Shows what to verify before ordering (dimensions, refs, mounting).
 */

import { AlertTriangle, Search } from "lucide-react";
import { type R6CompatibilityAxis } from "~/types/r6-guide.types";

interface Props {
  axes: R6CompatibilityAxis[];
  gammeName: string;
}

export function R6CompatibilityChecklist({ axes, gammeName }: Props) {
  if (axes.length === 0) return null;

  return (
    <section id="compatibilite" className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-indigo-500">
        Compatibilite — {gammeName}
      </h2>
      <div className="space-y-3">
        {axes.map((axis, i) => (
          <div
            key={i}
            className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-indigo-100 rounded-lg flex-shrink-0 mt-0.5">
                <Search className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">
                  {axis.axis}
                </h3>
                <p className="text-sm text-gray-600 mb-1">
                  Ou trouver : {axis.where_to_find}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Risque si erreur : {axis.risk_if_wrong}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
