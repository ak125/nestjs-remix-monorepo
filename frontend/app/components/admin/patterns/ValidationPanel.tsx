/**
 * ValidationPanel - Panel de validation avec tests et drill-down
 *
 * @see packages/design-tokens/DESIGN-SYSTEM.automecanik.md Section 8
 *
 * Extrait et généralisé de SectionKCard.tsx
 * Pattern tests T-A à T-F avec status PASS/FAIL/WARN
 */

import { AlertTriangle, ChevronDown, RefreshCw } from "lucide-react";
import { useState } from "react";
import { StatusBadge, type StatusType } from "./StatusBadge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

export interface TestItem {
  /** Identifiant du test (e.g., "T-A", "T-B") */
  id: string;
  /** Label descriptif */
  label: string;
  /** Valeur du test */
  value: number | string;
  /** Status du test */
  status: "pass" | "fail" | null;
  /** Couleur de surbrillance pour la ligne */
  highlight?: "red" | "orange" | null;
}

export interface DrillDownItem {
  id: string;
  label: string;
  sublabel?: string;
}

export interface DrillDownSection {
  count: number;
  items: DrillDownItem[];
  variant: "error" | "warning";
  title: string;
}

export interface ValidationPanelProps {
  /** Titre du panel */
  title: string;
  /** Status global (détermine le badge principal) */
  status: StatusType;
  /** Description de la règle de conformité */
  statusRule?: string;
  /** Liste des tests à afficher */
  tests: TestItem[];
  /** Sections de drill-down (pour les cas non-conformes) */
  drillDown?: DrillDownSection[];
  /** Callback pour recalculer */
  onRecalculate?: () => void;
  /** État de chargement */
  isLoading?: boolean;
  /** Classes CSS additionnelles */
  className?: string;
}

/**
 * Mapping status → StatusType pour le StatusBadge
 */
function mapTestStatus(status: "pass" | "fail" | null): StatusType | null {
  if (status === "pass") return "PASS";
  if (status === "fail") return "FAIL";
  return null;
}

export function ValidationPanel({
  title,
  status,
  statusRule,
  tests,
  drillDown = [],
  onRecalculate,
  isLoading = false,
  className,
}: ValidationPanelProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle],
    }));
  };

  return (
    <Card className={cn("transition-shadow duration-200", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          {title}
          <StatusBadge status={status} />
        </CardTitle>
        {onRecalculate && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRecalculate}
            disabled={isLoading}
            className="min-h-10 min-w-10"
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")}
            />
            <span className="hidden sm:inline">Recalculer</span>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Règle de conformité */}
        {statusRule && (
          <p className="text-sm text-muted-foreground font-mono bg-muted/50 p-2 rounded">
            {statusRule}
          </p>
        )}

        {/* Table des tests */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">Test</TableHead>
                <TableHead className="text-right min-w-[80px]">
                  Valeur
                </TableHead>
                <TableHead className="text-center min-w-[100px]">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tests.map((test) => (
                <TableRow
                  key={test.id}
                  className={cn(
                    test.highlight === "red" && "bg-destructive/5",
                    test.highlight === "orange" && "bg-warning/5",
                  )}
                >
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground mr-1">
                      {test.id}:
                    </span>
                    <span className="text-sm">{test.label}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {typeof test.value === "number"
                      ? test.value.toLocaleString("fr-FR")
                      : test.value}
                  </TableCell>
                  <TableCell className="text-center">
                    {mapTestStatus(test.status) ? (
                      <StatusBadge
                        status={mapTestStatus(test.status)!}
                        size="sm"
                        label={test.status === "pass" ? "PASS" : "FAIL"}
                      />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Sections drill-down */}
        {drillDown.length > 0 && (
          <div className="space-y-3">
            {drillDown.map((section) => (
              <Collapsible
                key={section.title}
                open={openSections[section.title] || false}
                onOpenChange={() => toggleSection(section.title)}
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-3 hover:bg-accent transition-colors">
                  <div
                    className={cn(
                      "flex items-center gap-2",
                      section.variant === "error"
                        ? "text-destructive"
                        : "text-warning",
                    )}
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium text-sm sm:text-base">
                      {section.count.toLocaleString("fr-FR")} {section.title}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      openSections[section.title] && "rotate-180",
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 max-h-60 overflow-y-auto rounded-md border bg-muted/50 p-3">
                    {section.items.length > 0 ? (
                      section.items.slice(0, 50).map((item, i) => (
                        <div
                          key={`${item.id}-${i}`}
                          className="border-b py-2 text-sm last:border-0"
                        >
                          <code className="mr-2 rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                            {item.id}
                          </code>
                          {item.label}
                          {item.sublabel && (
                            <span className="text-muted-foreground ml-1">
                              | {item.sublabel}
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Chargement...
                      </p>
                    )}
                    {section.items.length > 50 && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        ... et{" "}
                        {(section.items.length - 50).toLocaleString("fr-FR")}{" "}
                        autres
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
