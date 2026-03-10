import { useSearchParams } from "@remix-run/react";
import { Wrench, AlertTriangle, ShoppingCart, X } from "lucide-react";
import { Button } from "~/components/ui/button";

const CONTENT_TYPES = [
  { value: "HOWTO", label: "Montage", icon: Wrench },
  { value: "DIAGNOSTIC", label: "Diagnostic", icon: AlertTriangle },
  { value: "BUYING_GUIDE", label: "Guide d\u2019achat", icon: ShoppingCart },
] as const;

const DIFFICULTY_LEVELS = [
  { value: "1", label: "Facile" },
  { value: "3", label: "Moyen" },
  { value: "5", label: "Avanc\u00e9" },
] as const;

interface CategoryFiltersProps {
  totalResults?: number;
}

export function CategoryFilters({ totalResults }: CategoryFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeType = searchParams.get("type") || "";
  const activeDifficulty = searchParams.get("difficulty") || "";

  function toggleParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (next.get(key) === value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { preventScrollReset: true });
  }

  function clearFilters() {
    setSearchParams({}, { preventScrollReset: true });
  }

  const hasFilters = activeType || activeDifficulty;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
      {/* Type filters */}
      <div className="flex flex-wrap gap-2">
        {CONTENT_TYPES.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            variant={activeType === value ? "default" : "outline"}
            size="sm"
            onClick={() => toggleParam("type", value)}
            className="gap-1.5"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Button>
        ))}
      </div>

      {/* Difficulty filters */}
      <div className="flex flex-wrap gap-2">
        {DIFFICULTY_LEVELS.map(({ value, label }) => (
          <Button
            key={value}
            variant={activeDifficulty === value ? "default" : "outline"}
            size="sm"
            onClick={() => toggleParam("difficulty", value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Results count + clear */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        {totalResults !== undefined && (
          <span className="font-medium">
            {totalResults} article{totalResults !== 1 ? "s" : ""}
          </span>
        )}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1 text-xs text-gray-500"
          >
            <X className="h-3 w-3" />
            R&eacute;initialiser
          </Button>
        )}
      </div>
    </div>
  );
}
