/**
 * FilterBar - Barre de filtres responsive
 *
 * @see packages/design-tokens/DESIGN-SYSTEM.automecanik.md
 *
 * Mobile: Bouton → Bottom Sheet (80vh)
 * Desktop: Barre inline avec flex wrap
 *
 * Pattern Senior: UX type Stripe/Notion
 */

import { Filter, X, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "~/components/ui/sheet";
import { cn } from "~/lib/utils";

export interface FilterBarProps {
  /** Contenu des filtres (Select, Input, etc.) */
  children: React.ReactNode;
  /** Nombre de filtres actifs */
  activeCount?: number;
  /** Callback pour réinitialiser les filtres */
  onReset?: () => void;
  /** Callback pour appliquer (mobile) */
  onApply?: () => void;
  /** Titre du drawer mobile */
  title?: string;
  /** Classes CSS additionnelles */
  className?: string;
  /** Afficher le bouton reset même desktop */
  showResetDesktop?: boolean;
}

export function FilterBar({
  children,
  activeCount = 0,
  onReset,
  onApply,
  title = "Filtres",
  className,
  showResetDesktop = true,
}: FilterBarProps) {
  const [open, setOpen] = useState(false);

  const handleApply = () => {
    onApply?.();
    setOpen(false);
  };

  const handleReset = () => {
    onReset?.();
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Mobile: Bouton + Bottom Sheet */}
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="w-full min-h-11 justify-between"
            >
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                {title}
              </span>
              {activeCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 bg-primary text-primary-foreground"
                >
                  {activeCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] flex flex-col">
            <SheetHeader className="flex-shrink-0">
              <SheetTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  {title}
                </span>
                {activeCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="text-muted-foreground"
                  >
                    <RotateCcw className="mr-1 h-4 w-4" />
                    Réinitialiser
                  </Button>
                )}
              </SheetTitle>
            </SheetHeader>

            {/* Contenu scrollable */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {children}
            </div>

            {/* Footer avec actions */}
            <SheetFooter className="flex-shrink-0 pt-4 border-t">
              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="flex-1 min-h-11"
                >
                  Annuler
                </Button>
                <Button onClick={handleApply} className="flex-1 min-h-11">
                  Appliquer
                  {activeCount > 0 && ` (${activeCount})`}
                </Button>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Barre inline */}
      <div className="hidden md:flex flex-wrap items-center gap-3">
        {children}

        {/* Bouton reset desktop */}
        {showResetDesktop && activeCount > 0 && onReset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-muted-foreground min-h-10"
          >
            <X className="mr-1 h-4 w-4" />
            Réinitialiser ({activeCount})
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * FilterGroup - Groupe de filtres avec label
 * Pour structurer les filtres dans le drawer mobile
 */
export interface FilterGroupProps {
  /** Label du groupe */
  label: string;
  /** Filtres du groupe */
  children: React.ReactNode;
  /** Classes CSS */
  className?: string;
}

export function FilterGroup({ label, children, className }: FilterGroupProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/**
 * FilterChip - Chip pour filtres actifs (desktop)
 */
export interface FilterChipProps {
  /** Label du filtre */
  label: string;
  /** Valeur sélectionnée */
  value: string;
  /** Callback pour supprimer */
  onRemove: () => void;
}

export function FilterChip({ label, value, onRemove }: FilterChipProps) {
  return (
    <Badge
      variant="secondary"
      className="gap-1 pr-1 pl-2 py-1 text-sm cursor-pointer hover:bg-secondary/80"
    >
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-4 w-4 p-0 ml-1 rounded-full hover:bg-destructive/20"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </Badge>
  );
}
