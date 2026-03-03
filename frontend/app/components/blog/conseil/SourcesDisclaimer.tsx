/**
 * SourcesDisclaimer — "Sources / responsabilité" static footer line
 * Displayed below conseil sections for E-E-A-T credibility.
 */

import { FileText } from "lucide-react";

export function SourcesDisclaimer() {
  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <div className="flex items-start gap-2 text-xs text-gray-400">
        <FileText className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <p>
          Les valeurs de couple et intervalles de remplacement indiqués sont
          donnés à titre indicatif et correspondent aux recommandations
          générales des constructeurs. Consultez le manuel de votre véhicule ou
          un professionnel qualifié avant toute intervention.
        </p>
      </div>
    </div>
  );
}
