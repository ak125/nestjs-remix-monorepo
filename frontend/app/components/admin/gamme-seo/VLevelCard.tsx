/**
 * VLevelCard component for displaying V-Level rankings by energy type
 * With deduplication and complete vehicle info display
 *
 * Patches applied:
 * - Patch 2: UI-level deduplication by canon_key
 * - Patch 3: V3 excludes V2 entries (done via canon_key check)
 */

import { ChevronUp, ChevronDown, Copy, Check } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { type VLevelItem } from "./types";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { type EnrichedVehicleType } from "~/hooks/useVehicleEnrichment";

interface VLevelCardProps {
  title: string;
  description: string;
  items: VLevelItem[] | undefined | null;
  colorClass: string;
  icon: string;
  defaultExpanded?: boolean;
  v2Items?: VLevelItem[] | null; // For V3 exclusion check
  enrichedTypes?: Record<number, EnrichedVehicleType>; // Enriched vehicle data
}

/**
 * Normalize string for canonical key
 */
function normalizeForCanon(str: string | undefined | null): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s.]/g, "");
}

/**
 * Generate canonical key for deduplication
 */
function getCanonKey(item: VLevelItem): string {
  if (item.canon_key) return item.canon_key;
  const energy = normalizeForCanon(item.energy) || "unknown";
  const model = normalizeForCanon(item.model_name);
  const variant = normalizeForCanon(item.variant_name);
  return `${energy}|${model}|${variant}`;
}

/**
 * Deduplicate items by canonical key, keeping the best one
 * Best = highest volume, then lowest rank, then lowest id
 * Handles undefined/null input safely
 */
function deduplicateItems(
  items: VLevelItem[] | undefined | null,
  excludeCanonKeys?: Set<string>,
): {
  deduplicated: VLevelItem[];
  duplicatesRemoved: number;
  excludedByV2: number;
} {
  // Handle undefined/null input
  if (!items || !Array.isArray(items)) {
    return { deduplicated: [], duplicatesRemoved: 0, excludedByV2: 0 };
  }

  const canonMap = new Map<string, VLevelItem>();
  let duplicatesRemoved = 0;
  let excludedByV2 = 0;

  for (const item of items) {
    const canonKey = getCanonKey(item);

    // Check if excluded by V2
    if (excludeCanonKeys?.has(canonKey)) {
      excludedByV2++;
      continue;
    }

    const existing = canonMap.get(canonKey);
    if (!existing) {
      canonMap.set(canonKey, item);
    } else {
      duplicatesRemoved++;
      // Keep the better one
      const existingVolume = existing.search_volume ?? 0;
      const newVolume = item.search_volume ?? 0;
      const existingRank = existing.rank || 999;
      const newRank = item.rank || 999;

      if (
        newVolume > existingVolume ||
        (newVolume === existingVolume && newRank < existingRank)
      ) {
        canonMap.set(canonKey, item);
      }
    }
  }

  return {
    deduplicated: Array.from(canonMap.values()),
    duplicatesRemoved,
    excludedByV2,
  };
}

/**
 * Component to display a single vehicle item with complete info
 * Uses internal state for copy feedback - no parent re-render
 *
 * Data priority:
 * 1. item.vehicle_label (from RPC get_vlevel_dashboard - pre-formatted)
 * 2. enrichment (from useVehicleEnrichment hook - separate API)
 * 3. Basic item fields (fallback)
 */
function VehicleItem({
  item,
  enrichment,
}: {
  item: VLevelItem;
  enrichment?: EnrichedVehicleType;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const idToCopy = enrichment?.type_id || item.type_id;
      if (idToCopy) {
        navigator.clipboard.writeText(String(idToCopy));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    },
    [item.type_id, enrichment?.type_id],
  );

  // Priority: RPC vehicle_label > enrichment > fallback
  const hasRpcLabel = !!item.vehicle_label;
  const hasEnrichment = !!enrichment;

  // Use enriched data if available (from RPC item or enrichment hook)
  const displayMake = enrichment?.make || item.brand || "";
  const displayModel =
    enrichment?.generation || enrichment?.model || item.model_name || "";
  const displayEngine = enrichment?.engine || item.variant_name || "";
  const displayPower = item.power_hp || enrichment?.power_hp;
  const displayFuel = item.fuel || enrichment?.fuel || item.energy || "";
  const displayTypeId = enrichment?.type_id || item.type_id;

  // Format years display - prefer RPC data
  const yearsDisplay = item.year_from
    ? `${item.year_from}–${item.year_to || "..."}`
    : enrichment?.year_from
      ? `${enrichment.year_from}–${enrichment.year_to || "..."}`
      : null;

  return (
    <div className="flex items-center justify-between text-sm bg-white p-2 rounded border hover:bg-gray-50 transition-colors">
      {/* ID + Label */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Type ID badge - fixed width to prevent layout shift */}
        {displayTypeId ? (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-mono text-xs shrink-0 w-16 justify-center"
            title={copied ? "Copié !" : `Copier #${displayTypeId}`}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            <span className="truncate">
              #{String(displayTypeId).slice(0, 5)}
            </span>
          </button>
        ) : (
          <span className="w-16 shrink-0" /> // Placeholder for alignment
        )}

        {/* Vehicle info - priority: RPC label > enrichment > fallback */}
        {hasRpcLabel ? (
          // RPC pre-formatted label: "RENAULT CLIO II Diesel 65 ch (2001–2009)"
          <span className="truncate font-medium text-slate-800">
            {item.vehicle_label}
          </span>
        ) : hasEnrichment ? (
          // Enriched display: MAKE MODEL — engine — power
          <span className="truncate">
            <span className="font-semibold uppercase text-primary">
              {displayMake}
            </span>{" "}
            <span className="font-medium">{displayModel}</span>
            {displayEngine && displayEngine !== "N/A" && (
              <span className="text-muted-foreground"> — {displayEngine}</span>
            )}
            {displayPower && (
              <span className="text-muted-foreground"> — {displayPower}ch</span>
            )}
          </span>
        ) : (
          // Fallback display
          <span className="truncate">
            <span className="font-medium">{item.brand}</span> {item.model_name}{" "}
            <span className="text-gray-600">{item.variant_name}</span>
          </span>
        )}

        {/* Years - only show if NOT using RPC label (which includes years) */}
        {!hasRpcLabel && yearsDisplay && (
          <span className="text-gray-400 text-xs shrink-0 ml-1">
            {yearsDisplay}
          </span>
        )}

        {/* Fuel badge - only show if NOT using RPC label (which includes fuel) */}
        {!hasRpcLabel &&
          displayFuel &&
          displayFuel !== "N/A" &&
          displayFuel !== "unknown" && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                displayFuel.toLowerCase() === "diesel"
                  ? "bg-blue-100 text-blue-700"
                  : displayFuel.toLowerCase() === "essence"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              {displayFuel}
            </span>
          )}
      </div>

      {/* Metrics - fixed min-width to prevent layout shift */}
      <div className="flex items-center gap-1.5 text-xs ml-2 shrink-0 min-w-[100px] justify-end">
        {item.search_volume != null && item.search_volume > 0 && (
          <span className="text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
            {item.search_volume.toLocaleString()}/m
          </span>
        )}
        {item.rank > 0 && (
          <span
            className={`px-1.5 py-0.5 rounded ${
              item.rank <= 3
                ? "bg-green-100 text-green-700"
                : item.rank <= 7
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-gray-100 text-gray-600"
            }`}
            title="Position Google Suggest"
          >
            #{item.rank}
          </span>
        )}
        {item.v2_repetitions > 1 && (
          <span
            className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded"
            title={`V2 dans ${item.v2_repetitions} gammes`}
          >
            x{item.v2_repetitions}
          </span>
        )}
      </div>
    </div>
  );
}

export function VLevelCard({
  title,
  description,
  items,
  colorClass,
  icon,
  defaultExpanded = true,
  v2Items,
  enrichedTypes,
}: VLevelCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Build V2 canon keys set for V3 exclusion - stable reference
  const v2CanonKeys = useMemo(() => {
    if (!v2Items) return undefined;
    return new Set(v2Items.map(getCanonKey));
  }, [v2Items]);

  // Deduplicate items (Patch 2 + 3) - stable reference
  const { deduplicated, duplicatesRemoved, excludedByV2 } = useMemo(
    () => deduplicateItems(items, v2CanonKeys),
    [items, v2CanonKeys],
  );

  // Filter by energy - stable references
  const dieselItems = useMemo(
    () => deduplicated.filter((v) => v.energy?.toLowerCase() === "diesel"),
    [deduplicated],
  );

  const essenceItems = useMemo(
    () =>
      deduplicated.filter(
        (v) =>
          v.energy?.toLowerCase() === "essence" ||
          v.energy?.toLowerCase() === "petrol",
      ),
    [deduplicated],
  );

  // Quality control info
  const hasQualityIssues = duplicatesRemoved > 0 || excludedByV2 > 0;

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <Card className={colorClass}>
      <CardHeader className="cursor-pointer py-3" onClick={toggleExpanded}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-xs">
                {description}
              </CardDescription>
            </div>
          </div>
          {/* Fixed width container for badges to prevent layout shift */}
          <div className="flex items-center gap-2 min-w-[120px] justify-end">
            <Badge variant="secondary">{deduplicated.length}</Badge>
            {/* Quality control badges - always reserve space */}
            {hasQualityIssues ? (
              <div className="flex items-center gap-1">
                {duplicatesRemoved > 0 && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-amber-50 text-amber-700 border-amber-200"
                  >
                    -{duplicatesRemoved}
                  </Badge>
                )}
                {excludedByV2 > 0 && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                  >
                    -{excludedByV2}
                  </Badge>
                )}
              </div>
            ) : null}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </div>
      </CardHeader>
      {isExpanded && deduplicated.length > 0 && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-4">
            {/* Diesel */}
            <div>
              <h4 className="text-sm font-medium text-blue-700 mb-2 flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                Diesel ({dieselItems.length})
              </h4>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {dieselItems.length === 0 ? (
                  <span className="text-gray-400 text-sm">Aucun</span>
                ) : (
                  dieselItems.map((v) => (
                    <VehicleItem
                      key={v.id}
                      item={v}
                      enrichment={
                        v.type_id && enrichedTypes
                          ? enrichedTypes[Number(v.type_id)]
                          : undefined
                      }
                    />
                  ))
                )}
              </div>
            </div>
            {/* Essence */}
            <div>
              <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                Essence ({essenceItems.length})
              </h4>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {essenceItems.length === 0 ? (
                  <span className="text-gray-400 text-sm">Aucun</span>
                ) : (
                  essenceItems.map((v) => (
                    <VehicleItem
                      key={v.id}
                      item={v}
                      enrichment={
                        v.type_id && enrichedTypes
                          ? enrichedTypes[Number(v.type_id)]
                          : undefined
                      }
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      )}
      {isExpanded && deduplicated.length === 0 && (
        <CardContent className="pt-0">
          <p className="text-center text-gray-400 py-4 text-sm">
            Aucune motorisation dans ce niveau
          </p>
        </CardContent>
      )}
    </Card>
  );
}
