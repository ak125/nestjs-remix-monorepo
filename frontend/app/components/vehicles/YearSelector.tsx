import { useFetcher } from "@remix-run/react";
import { Alert } from '~/components/ui/alert';
import { useEffect, useState } from "react";

interface YearData {
  year: number;
  count: number;
  available: boolean;
}

interface YearSelectorProps {
  typeId?: number;
  onSelect: (year: number) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  showDecades?: boolean;
}

export function YearSelector({ 
  typeId, 
  onSelect, 
  className = "",
  disabled = false,
  placeholder = "Année de production",
  showDecades = true
}: YearSelectorProps) {
  const fetcher = useFetcher<{
    years: YearData[];
    totalYears: number;
    typeId?: number;
  }>();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    if (!typeId) {
      setSelectedYear(null);
      return;
    }

    const params = new URLSearchParams();
    params.append('typeId', typeId.toString());
    
    fetcher.load(`/api/vehicles/forms/years?${params.toString()}`);
  }, [typeId, fetcher]);

  const handleSelect = (year: number) => {
    setSelectedYear(year);
    onSelect(year);
  };

  const years = fetcher.data?.years || [];
  const isLoading = fetcher.state === 'loading';

  // Grouper les années par décennies
  const yearGroups = showDecades ? years.reduce((acc: Record<string, YearData[]>, yearData: YearData) => {
    const decade = Math.floor(yearData.year / 10) * 10;
    const decadeKey = `${decade}s`;
    if (!acc[decadeKey]) acc[decadeKey] = [];
    acc[decadeKey].push(yearData);
    return acc;
  }, {}) : { 'Années': years };

  if (!typeId) {
    return (
      <div className={className}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {placeholder}
        </label>
        <div className="text-sm text-gray-500 p-3 border rounded-md bg-gray-50">
          Sélectionnez d'abord un type de véhicule
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {placeholder}
      </label>
      
      {isLoading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-full"></div>
          <div className="mt-2 space-y-2">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      ) : years.length === 0 ? (
        <div className="text-sm text-gray-500 p-3 border rounded-md bg-gray-50">
          Aucune année disponible pour ce type
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(yearGroups).map(([decadeLabel, decadeYears]) => (
            <div key={decadeLabel} className="border rounded-lg p-3">
              <h4 className="text-sm font-medium mb-2 text-gray-800">
                {decadeLabel}
                <span className="ml-2 text-xs text-gray-500">
                  ({decadeYears.length} années)
                </span>
              </h4>
              <div className="grid grid-cols-5 gap-2">
                {decadeYears.map((yearData: YearData) => (
                  <button
                    key={yearData.year}
                    onClick={() => handleSelect(yearData.year)}
                    disabled={disabled || !yearData.available}
                    className={`
                      px-3 py-2 text-sm rounded border transition-colors
                      ${selectedYear === yearData.year 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                        : yearData.available
                          ? 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:border-blue-300'
                          : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'}
                      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {yearData.year}
                    {yearData.count > 1 && (
                      <span className="text-xs ml-1 opacity-75">
                        ({yearData.count})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
          
          {selectedYear && (
<Alert className="mt-4 p-3  rounded-lg" variant="info">
              <div className="text-sm">
                <strong className="text-blue-800">Année sélectionnée :</strong>{' '}
                <span className="text-blue-700">{selectedYear}</span>
              </div>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

// Export du type pour réutilisation
export type { YearData };
