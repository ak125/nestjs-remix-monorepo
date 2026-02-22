/**
 * VLevel Tab Content for Admin Gamme SEO Detail page
 * Handles V-Level rankings display, filtering, and validation
 */

import { AlertCircle, Download, RefreshCw, Upload } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { useVehicleEnrichment } from "~/hooks/useVehicleEnrichment";
import { logger } from "~/utils/logger";
import {
  type EnergyFilter,
  type GammeDetail,
  type LoaderFreshness,
  type VLevelItem,
} from "./types";
import { checkV2Violations, exportVLevelToCSV, filterByEnergy } from "./utils";
import { VLevelCard } from "./VLevelCard";

interface VLevelTabProps {
  detail: GammeDetail;
  freshness: LoaderFreshness;
  onShowImport: () => void;
}

export const VLevelTab = memo(function VLevelTab({
  detail,
  freshness,
  onShowImport,
}: VLevelTabProps) {
  const [energyFilter, setEnergyFilter] = useState<EnergyFilter>("all");
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Check for V2 violations (duplicates) - safely handle undefined vLevel
  const v2Violations = useMemo(
    () => checkV2Violations(detail.vLevel?.v2),
    [detail.vLevel?.v2],
  );

  // Collect all type_ids from V-Level items for batch enrichment
  const allTypeIds = useMemo(() => {
    const ids: number[] = [];
    const levels = ["v2", "v3", "v4", "v5"] as const;

    levels.forEach((level) => {
      const items = detail.vLevel?.[level];
      if (Array.isArray(items)) {
        items.forEach((item) => {
          if (item.type_id) {
            const id = Number(item.type_id);
            if (!isNaN(id) && id > 0) ids.push(id);
          }
        });
      }
    });

    return [...new Set(ids)];
  }, [detail.vLevel]);

  // Debug: Log collected type_ids
  logger.log(
    "[VLevelTab] allTypeIds collected:",
    allTypeIds.slice(0, 10),
    "... (total:",
    allTypeIds.length,
    ")",
  );

  // Fetch vehicle enrichment data in batch
  const { data: enrichedTypes, isLoading: isEnrichmentLoading } =
    useVehicleEnrichment(allTypeIds);

  // Debug: Log enrichment result
  logger.log(
    "[VLevelTab] enrichedTypes:",
    enrichedTypes ? Object.keys(enrichedTypes).length : 0,
    "entries, isLoading:",
    isEnrichmentLoading,
  );

  const handleRecalculateVLevel = async () => {
    setIsRecalculating(true);
    try {
      const res = await fetch(
        `/api/admin/gammes-seo/${detail.gamme.pg_id}/recalculate-vlevel`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (res.ok) {
        window.location.reload();
      }
    } catch (error) {
      logger.error("Erreur recalcul V-Level:", error);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleExportCSV = () => {
    exportVLevelToCSV(detail.vLevel, detail.gamme.pg_alias);
  };

  const filterItems = (items: VLevelItem[]) =>
    filterByEnergy(items, energyFilter);

  return (
    <div className="space-y-4">
      {/* Warning if data is stale */}
      {(freshness.vLevel.status === "stale" ||
        freshness.vLevel.status === "old") && (
        <div
          className={`p-3 rounded-lg flex items-center gap-3 ${
            freshness.vLevel.status === "old"
              ? "bg-red-50 border border-red-200 text-red-800"
              : "bg-yellow-50 border border-yellow-200 text-yellow-800"
          }`}
        >
          <span className="text-xl">{freshness.vLevel.icon}</span>
          <div className="flex-1">
            <p className="font-medium">
              {freshness.vLevel.status === "old"
                ? "Donnees V-Level tres anciennes"
                : "Donnees V-Level a mettre a jour"}
            </p>
            <p className="text-sm opacity-80">
              Derniere mise a jour:{" "}
              {detail.stats.vLevel_last_updated
                ? new Date(detail.stats.vLevel_last_updated).toLocaleDateString(
                    "fr-FR",
                  )
                : "Jamais"}
              {freshness.vLevel.status === "old"
                ? " (> 30 jours). Les classements peuvent etre obsoletes."
                : " (> 7 jours). Un recalcul est recommande."}
            </p>
          </div>
        </div>
      )}

      {/* V2 violation warning */}
      {(v2Violations.diesel.length > 0 || v2Violations.essence.length > 0) && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-medium">Violation regle V2</p>
            <p className="text-sm">
              V2 dedup par modele+energie (max 10). Doublons detectes:
              {v2Violations.diesel.length > 0 && (
                <span className="ml-1">
                  <span className="font-medium">Diesel:</span>{" "}
                  {v2Violations.diesel.join(", ")}
                </span>
              )}
              {v2Violations.essence.length > 0 && (
                <span className="ml-1">
                  <span className="font-medium">Essence:</span>{" "}
                  {v2Violations.essence.join(", ")}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Action bar: Filters + Buttons */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        {/* Energy filters */}
        <div className="flex gap-2">
          <Button
            variant={energyFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setEnergyFilter("all")}
          >
            Tous
          </Button>
          <Button
            variant={energyFilter === "diesel" ? "default" : "outline"}
            size="sm"
            onClick={() => setEnergyFilter("diesel")}
            className={
              energyFilter === "diesel"
                ? ""
                : "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
            }
          >
            Diesel
          </Button>
          <Button
            variant={energyFilter === "essence" ? "default" : "outline"}
            size="sm"
            onClick={() => setEnergyFilter("essence")}
            className={
              energyFilter === "essence"
                ? ""
                : "bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
            }
          >
            Essence
          </Button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculateVLevel}
            disabled={isRecalculating}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRecalculating ? "animate-spin" : ""}`}
            />
            {isRecalculating ? "Recalcul..." : "Recalculer"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onShowImport}
            className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
        </div>
      </div>

      {/* V2 - Champions Gamme */}
      <VLevelCard
        title="V2 - Champions Gamme"
        description="Champions LOCAUX #1 par gamme+energie (UNIQUE)"
        items={filterItems(detail.vLevel?.v2)}
        colorClass="border-green-200 bg-green-50"
        icon="\uD83E\uDD47"
        defaultExpanded={true}
        enrichedTypes={enrichedTypes}
      />

      {/* V3 - Champions Groupe (excludes V2 via v2Items prop) */}
      <VLevelCard
        title="V3 - Champions Groupe"
        description="Match principal par groupe model+energie"
        items={filterItems(detail.vLevel?.v3)}
        colorClass="border-blue-200 bg-blue-50"
        icon="\uD83C\uDFC5"
        defaultExpanded={true}
        v2Items={detail.vLevel?.v2}
        enrichedTypes={enrichedTypes}
      />

      {/* V4 - Challengers CSV */}
      <VLevelCard
        title="V4 - Challengers CSV"
        description="Dans le CSV, pas le match principal"
        items={filterItems(detail.vLevel?.v4)}
        colorClass="border-gray-200 bg-gray-50"
        icon="\uD83E\uDD48"
        defaultExpanded={false}
        enrichedTypes={enrichedTypes}
      />

      {/* V5 - Autres motorisations */}
      <VLevelCard
        title="V5 - Autres motorisations"
        description="Autres motorisations du meme modele (en DB, pas dans V3/V4)"
        items={filterItems(detail.vLevel?.v5)}
        colorClass="border-orange-200 bg-orange-50"
        icon="\uD83D\uDD17"
        defaultExpanded={false}
        enrichedTypes={enrichedTypes}
      />

      {/* Message if no data */}
      {detail.stats.vLevel_total_count === 0 && (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-gray-500">
              Aucune donnee V-Level pour cette gamme
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
});
