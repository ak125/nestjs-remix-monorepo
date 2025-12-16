/**
 * MotorisationsTable - Tableau des motorisations V1-V5
 *
 * Affiche les motorisations d'un modèle avec leur niveau V
 * et leur type d'énergie (Diesel/Essence).
 *
 * @example
 * <MotorisationsTable
 *   motorisations={[
 *     { variante: '1.5 dCi 85cv', puissance: '85cv', niveau_v: 'V1', energie: 'Diesel' }
 *   ]}
 *   title="Motorisations disponibles"
 * />
 */

import { Car, Fuel, Zap, Battery } from 'lucide-react';

export interface MotorisationEntry {
  variante: string;
  puissance: string;
  niveau_v: 'V1' | 'V2' | 'V3' | 'V4' | 'V5';
  energie: 'Diesel' | 'Essence' | 'Hybride' | 'Electrique';
  cylindree?: string;
  annees?: string;
  code_moteur?: string;
}

interface MotorisationsTableProps {
  motorisations: MotorisationEntry[];
  title?: string;
  showLegend?: boolean;
  className?: string;
}

// Badge colors for V levels
const levelColors: Record<string, string> = {
  V1: 'bg-blue-600 text-white',
  V2: 'bg-green-600 text-white',
  V3: 'bg-yellow-500 text-white',
  V4: 'bg-orange-500 text-white',
  V5: 'bg-gray-500 text-white',
};

// Icons for energy types
const energyIcons: Record<string, JSX.Element> = {
  Diesel: <Fuel className="w-4 h-4" />,
  Essence: <Zap className="w-4 h-4" />,
  Hybride: <Battery className="w-4 h-4" />,
  Electrique: <Battery className="w-4 h-4" />,
};

// Colors for energy types
const energyColors: Record<string, string> = {
  Diesel: 'bg-gray-700 text-white',
  Essence: 'bg-red-600 text-white',
  Hybride: 'bg-green-600 text-white',
  Electrique: 'bg-blue-500 text-white',
};

export function MotorisationsTable({
  motorisations,
  title = 'Motorisations',
  showLegend = true,
  className = '',
}: MotorisationsTableProps) {
  if (!motorisations || motorisations.length === 0) {
    return null;
  }

  // Group by energy type
  const diesel = motorisations.filter((m) => m.energie === 'Diesel');
  const essence = motorisations.filter((m) => m.energie === 'Essence');
  const autres = motorisations.filter(
    (m) => !['Diesel', 'Essence'].includes(m.energie)
  );

  return (
    <div className={`rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3">
        <div className="flex items-center gap-2">
          <Car className="w-5 h-5 text-white" />
          <h3 className="font-semibold text-white">{title}</h3>
          <span className="ml-auto text-sm text-gray-300">
            {motorisations.length} motorisation{motorisations.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Motorisation</th>
              <th className="px-4 py-2 text-center font-medium">Puissance</th>
              <th className="px-4 py-2 text-center font-medium">Énergie</th>
              <th className="px-4 py-2 text-center font-medium">Niveau</th>
              {motorisations.some((m) => m.code_moteur) && (
                <th className="px-4 py-2 text-center font-medium">Code moteur</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* Diesel section */}
            {diesel.length > 0 && (
              <>
                <tr className="bg-gray-50">
                  <td
                    colSpan={motorisations.some((m) => m.code_moteur) ? 5 : 4}
                    className="px-4 py-2 font-semibold text-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <Fuel className="w-4 h-4 text-gray-600" />
                      Diesel ({diesel.length})
                    </div>
                  </td>
                </tr>
                {diesel.map((m, i) => (
                  <MotorisationRow
                    key={`diesel-${i}`}
                    motorisation={m}
                    showCodeMoteur={motorisations.some((m) => m.code_moteur)}
                  />
                ))}
              </>
            )}

            {/* Essence section */}
            {essence.length > 0 && (
              <>
                <tr className="bg-gray-50">
                  <td
                    colSpan={motorisations.some((m) => m.code_moteur) ? 5 : 4}
                    className="px-4 py-2 font-semibold text-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-red-500" />
                      Essence ({essence.length})
                    </div>
                  </td>
                </tr>
                {essence.map((m, i) => (
                  <MotorisationRow
                    key={`essence-${i}`}
                    motorisation={m}
                    showCodeMoteur={motorisations.some((m) => m.code_moteur)}
                  />
                ))}
              </>
            )}

            {/* Other energy types */}
            {autres.length > 0 && (
              <>
                <tr className="bg-gray-50">
                  <td
                    colSpan={motorisations.some((m) => m.code_moteur) ? 5 : 4}
                    className="px-4 py-2 font-semibold text-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <Battery className="w-4 h-4 text-green-500" />
                      Autres ({autres.length})
                    </div>
                  </td>
                </tr>
                {autres.map((m, i) => (
                  <MotorisationRow
                    key={`autres-${i}`}
                    motorisation={m}
                    showCodeMoteur={motorisations.some((m) => m.code_moteur)}
                  />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${levelColors.V1}`}>
                V1
              </span>
              <span>Variante dominante</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${levelColors.V2}`}>
                V2
              </span>
              <span>Champion gamme</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${levelColors.V3}`}>
                V3
              </span>
              <span>Challengers</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${levelColors.V4}`}>
                V4
              </span>
              <span>Variantes</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Row component for individual motorisations
function MotorisationRow({
  motorisation,
  showCodeMoteur,
}: {
  motorisation: MotorisationEntry;
  showCodeMoteur: boolean;
}) {
  const isV1 = motorisation.niveau_v === 'V1';

  return (
    <tr className={`hover:bg-gray-50 ${isV1 ? 'bg-blue-50/50' : ''}`}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          {isV1 && (
            <span className="text-blue-600 text-xs" title="Variante dominante">
              ★
            </span>
          )}
          <span className={isV1 ? 'font-semibold text-gray-900' : 'text-gray-700'}>
            {motorisation.variante}
          </span>
          {motorisation.annees && (
            <span className="text-gray-400 text-xs">({motorisation.annees})</span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 text-center">
        <span className="font-medium text-gray-800">{motorisation.puissance}</span>
      </td>
      <td className="px-4 py-2.5 text-center">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
            energyColors[motorisation.energie] || 'bg-gray-500 text-white'
          }`}
        >
          {energyIcons[motorisation.energie]}
          {motorisation.energie}
        </span>
      </td>
      <td className="px-4 py-2.5 text-center">
        <span
          className={`px-2 py-0.5 rounded text-xs font-bold ${
            levelColors[motorisation.niveau_v] || 'bg-gray-500 text-white'
          }`}
        >
          {motorisation.niveau_v}
        </span>
      </td>
      {showCodeMoteur && (
        <td className="px-4 py-2.5 text-center">
          <span className="font-mono text-xs text-gray-600">
            {motorisation.code_moteur || '-'}
          </span>
        </td>
      )}
    </tr>
  );
}

export default MotorisationsTable;
