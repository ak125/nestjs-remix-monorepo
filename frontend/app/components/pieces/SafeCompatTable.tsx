import {
  Car,
  FileSearch,
  RotateCcw,
  ShieldCheck,
  PackageCheck,
  HelpCircle,
} from "lucide-react";
import { memo } from "react";

import {
  getDefaultSafeTableRows,
  inferFamilyKey,
} from "~/utils/r1-family-defaults";

/** Ligne du tableau safe — uniquement "comment vérifier sa compatibilité" */
interface SafeRow {
  element: string;
  howToCheck: string;
}

interface SafeCompatTableProps {
  /** Lignes custom (depuis sgpg_safe_table_rows) */
  rows?: SafeRow[];
  /** Nom gamme pour le contexte */
  gammeName?: string;
  /** Nom famille pour defaults différenciés */
  familleName?: string;
}

// Icône par index de ligne (max 6 pour couvrir les lignes custom)
const ROW_ICONS = [
  Car,
  FileSearch,
  RotateCcw,
  ShieldCheck,
  PackageCheck,
  HelpCircle,
];

const SafeCompatTable = memo(function SafeCompatTable({
  rows,
  gammeName,
  familleName,
}: SafeCompatTableProps) {
  const displayRows =
    rows && rows.length > 0
      ? rows.slice(0, 6)
      : getDefaultSafeTableRows(inferFamilyKey(gammeName || "", familleName));

  return (
    <div className="bg-blue-50/50 border border-blue-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-blue-100/60 border-b border-blue-200">
        <h3 className="text-sm font-semibold text-blue-900">
          Avant de commander : {displayRows.length} vérifications
          {gammeName ? ` — ${gammeName}` : ""}
        </h3>
      </div>

      <div className="divide-y divide-blue-100">
        {displayRows.map((row, i) => {
          const Icon = ROW_ICONS[i % ROW_ICONS.length];
          return (
            <div key={i} className="flex items-start gap-3 px-4 py-3 text-sm">
              <Icon
                className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-900">{row.element}</span>
                <span className="text-gray-500 mx-1.5">—</span>
                <span className="text-gray-600">{row.howToCheck}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default SafeCompatTable;
