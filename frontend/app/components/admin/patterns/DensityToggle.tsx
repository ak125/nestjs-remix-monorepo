/**
 * DensityToggle - Composant pour changer le mode de densité
 *
 * @see frontend/app/contexts/DensityContext.tsx
 *
 * Affiche un Select avec les 3 modes de densité
 */

import { Rows3, Rows4, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useDensity, type DensityMode } from "~/contexts/DensityContext";
import { cn } from "~/lib/utils";

const densityIcons: Record<DensityMode, React.ReactNode> = {
  compact: <Rows4 className="h-4 w-4" />,
  comfortable: <Rows3 className="h-4 w-4" />,
  reading: <FileText className="h-4 w-4" />,
};

export interface DensityToggleProps {
  /** Classes CSS */
  className?: string;
  /** Afficher les descriptions */
  showDescription?: boolean;
}

export function DensityToggle({
  className,
  showDescription = false,
}: DensityToggleProps) {
  const { density, setDensity, labels } = useDensity();

  return (
    <Select value={density} onValueChange={(v) => setDensity(v as DensityMode)}>
      <SelectTrigger className={cn("w-[160px] min-h-10", className)}>
        <SelectValue>
          <span className="flex items-center gap-2">
            {densityIcons[density]}
            {labels[density].label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(labels) as DensityMode[]).map((mode) => (
          <SelectItem key={mode} value={mode}>
            <div className="flex items-center gap-2">
              {densityIcons[mode]}
              <div>
                <div className="font-medium">{labels[mode].label}</div>
                {showDescription && (
                  <div className="text-xs text-muted-foreground">
                    {labels[mode].description}
                  </div>
                )}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * DensityButtons - Variante avec boutons toggle
 */
export interface DensityButtonsProps {
  className?: string;
}

export function DensityButtons({ className }: DensityButtonsProps) {
  const { density, setDensity, labels } = useDensity();

  return (
    <div
      className={cn(
        "inline-flex rounded-lg border bg-muted p-1 gap-1",
        className,
      )}
    >
      {(Object.keys(labels) as DensityMode[]).map((mode) => (
        <button
          key={mode}
          onClick={() => setDensity(mode)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            density === mode
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          title={labels[mode].description}
        >
          {densityIcons[mode]}
          <span className="hidden sm:inline">{labels[mode].label}</span>
        </button>
      ))}
    </div>
  );
}
