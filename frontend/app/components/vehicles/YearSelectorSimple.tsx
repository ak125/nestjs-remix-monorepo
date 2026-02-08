import { useFetcher } from "@remix-run/react";
import { useEffect, useState, memo } from "react";

interface YearSelectorProps {
  typeId?: number;
  onSelect: (year: number) => void;
  className?: string;
}

export const YearSelector = memo(function YearSelector({
  typeId,
  onSelect,
  className,
}: YearSelectorProps) {
  const fetcher = useFetcher<{
    years: Array<{ year: number; count: number; available: boolean }>;
    totalYears: number;
  }>();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (typeId) params.append("typeId", typeId.toString());

    fetcher.load(`/api/vehicles/forms/years?${params.toString()}`);
  }, [typeId, fetcher]);

  const handleSelect = (year: number) => {
    setSelectedYear(year);
    onSelect(year);
  };

  const yearGroups = fetcher.data?.years?.reduce((acc: any, yearData: any) => {
    const decade = Math.floor(yearData.year / 10) * 10;
    if (!acc[decade]) acc[decade] = [];
    acc[decade].push(yearData);
    return acc;
  }, {});

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Année de production
      </label>

      {fetcher.state === "loading" ? (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-full"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(yearGroups || {}).map(
            ([decade, years]: [string, any]) => (
              <div key={decade} className="border rounded-lg p-3">
                <h4 className="text-sm font-medium mb-2">{decade}s</h4>
                <div className="grid grid-cols-5 gap-2">
                  {years.map((yearData: any) => (
                    <button
                      key={yearData.year}
                      onClick={() => handleSelect(yearData.year)}
                      className={`
                      px-3 py-1 text-sm rounded border
                      ${
                        selectedYear === yearData.year
                          ? "bg-primary text-primary-foreground border-blue-600"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }
                    `}
                    >
                      {yearData.year}
                      {yearData.count > 1 && (
                        <span className="text-xs ml-1">({yearData.count})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
});
