import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
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

// Types Section K
export interface SectionKMetrics {
  pg_id: number;
  gamme_name: string;
  catalog_valid: number;
  covered_v2v3: number;
  expected_v4: number;
  actual_v4: number;
  missing: number;
  extras: number;
  status: "CONFORME" | "NON_CONFORME";
}

export interface MissingTypeId {
  pg_id: number;
  type_id: string;
  modele_name: string;
  type_name: string;
  type_fuel: string;
}

export interface ExtraTypeId {
  pg_id: number;
  type_id: string;
  keyword_id: number;
  keyword: string;
}

interface SectionKCardProps {
  metrics: SectionKMetrics | null;
  missingTypeIds?: MissingTypeId[];
  extrasTypeIds?: ExtraTypeId[];
  onRecalculate?: () => void;
  isLoading?: boolean;
}

export function SectionKCard({
  metrics,
  missingTypeIds = [],
  extrasTypeIds = [],
  onRecalculate,
  isLoading = false,
}: SectionKCardProps) {
  const [missingOpen, setMissingOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);

  if (!metrics) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Section K - Conformité V4
            <Badge variant="outline">Chargement...</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Données non disponibles</p>
        </CardContent>
      </Card>
    );
  }

  const isConforme = metrics.status === "CONFORME";

  // Tests data
  const tests = [
    {
      id: "T-A",
      label: "catalog_valid",
      value: metrics.catalog_valid,
      status: null,
    },
    {
      id: "T-B",
      label: "covered_v2v3",
      value: metrics.covered_v2v3,
      status: null,
    },
    {
      id: "T-C",
      label: "expected_v4",
      value: metrics.expected_v4,
      status: null,
    },
    { id: "T-D", label: "actual_v4", value: metrics.actual_v4, status: null },
    {
      id: "T-E",
      label: "missing",
      value: metrics.missing,
      status: metrics.missing === 0 ? "pass" : "fail",
      highlight: metrics.missing > 0 ? "red" : null,
    },
    {
      id: "T-F",
      label: "extras",
      value: metrics.extras,
      status: metrics.extras === 0 ? "pass" : "fail",
      highlight: metrics.extras > 0 ? "orange" : null,
    },
  ];

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          Section K - Conformité V4
          {isConforme ? (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              CONFORME
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="mr-1 h-3 w-3" />
              NON-CONFORME
            </Badge>
          )}
        </CardTitle>
        {onRecalculate && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRecalculate}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Recalculer
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Définition de conformité */}
        <p className="text-sm text-muted-foreground">
          STATUS = (missing = 0 AND extras = 0) → CONFORME
        </p>

        {/* Tests T-A à T-F */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test</TableHead>
                <TableHead className="text-right">Valeur</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tests.map((test) => (
                <TableRow
                  key={test.id}
                  className={
                    test.highlight === "red"
                      ? "bg-red-50"
                      : test.highlight === "orange"
                        ? "bg-orange-50"
                        : ""
                  }
                >
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {test.id}:
                    </span>{" "}
                    {test.label}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {test.value.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    {test.status === "pass" ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        PASS
                      </Badge>
                    ) : test.status === "fail" ? (
                      <Badge variant="destructive">
                        <XCircle className="mr-1 h-3 w-3" />
                        FAIL
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Drill-down si non-conforme */}
        {!isConforme && (
          <div className="space-y-3">
            {/* Missing type_ids */}
            {metrics.missing > 0 && (
              <Collapsible open={missingOpen} onOpenChange={setMissingOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-3 hover:bg-accent">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">
                      {metrics.missing.toLocaleString()} type_ids manquants
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${missingOpen ? "rotate-180" : ""}`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 max-h-60 overflow-y-auto rounded-md border bg-muted/50 p-3">
                    {missingTypeIds.length > 0 ? (
                      missingTypeIds.slice(0, 50).map((t, i) => (
                        <div
                          key={`${t.type_id}-${i}`}
                          className="border-b py-1 text-sm last:border-0"
                        >
                          <code className="mr-2 rounded bg-muted px-1 text-xs">
                            {t.type_id}
                          </code>
                          {t.modele_name} | {t.type_name} | {t.type_fuel}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">Chargement...</p>
                    )}
                    {missingTypeIds.length > 50 && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        ... et {missingTypeIds.length - 50} autres
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Extras type_ids */}
            {metrics.extras > 0 && (
              <Collapsible open={extrasOpen} onOpenChange={setExtrasOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-3 hover:bg-accent">
                  <div className="flex items-center gap-2 text-orange-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">
                      {metrics.extras.toLocaleString()} type_ids extras
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${extrasOpen ? "rotate-180" : ""}`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 max-h-60 overflow-y-auto rounded-md border bg-muted/50 p-3">
                    {extrasTypeIds.length > 0 ? (
                      extrasTypeIds.slice(0, 50).map((t, i) => (
                        <div
                          key={`${t.type_id}-${i}`}
                          className="border-b py-1 text-sm last:border-0"
                        >
                          <code className="mr-2 rounded bg-muted px-1 text-xs">
                            {t.type_id}
                          </code>
                          {t.keyword}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">Chargement...</p>
                    )}
                    {extrasTypeIds.length > 50 && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        ... et {extrasTypeIds.length - 50} autres
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
