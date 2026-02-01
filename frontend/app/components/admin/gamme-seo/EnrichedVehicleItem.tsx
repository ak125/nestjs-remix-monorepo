import { Copy, ExternalLink } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { type EnrichedVehicleType } from "~/hooks/useVehicleEnrichment";
import { type VLevelItem } from "./types";

interface EnrichedVehicleItemProps {
  item: VLevelItem;
  enrichment?: EnrichedVehicleType;
  showActions?: boolean;
}

/**
 * Composant pour afficher un véhicule enrichi avec toutes les informations
 *
 * Format enrichi: #520 — RENAULT MEGANE III — 1.5 dCi — 95 ch — 2013–2015 — Diesel
 * Fallback: brand model variant #type_id
 */
export function EnrichedVehicleItem({
  item,
  enrichment,
  showActions = true,
}: EnrichedVehicleItemProps) {
  const copyId = async () => {
    const id = enrichment?.type_id || item.type_id;
    if (id) {
      try {
        await navigator.clipboard.writeText(String(id));
      } catch (e) {
        console.error("Failed to copy ID:", e);
      }
    }
  };

  // Fallback: affichage texte simple si pas d'enrichissement
  if (!enrichment) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {/* Vehicle text */}
        <span className="text-sm">
          {[item.brand, item.model_name, item.variant_name]
            .filter(Boolean)
            .join(" ")}
        </span>

        {/* Type ID badge (si disponible) */}
        {item.type_id && (
          <Badge variant="outline" className="font-mono text-xs">
            #{item.type_id}
          </Badge>
        )}

        {/* Energy badge */}
        {item.energy && item.energy !== "unknown" && (
          <Badge variant="secondary" className="text-xs capitalize">
            {item.energy}
          </Badge>
        )}
      </div>
    );
  }

  // Format enrichi complet
  const yearRange = enrichment.year_from
    ? `${enrichment.year_from}–${enrichment.year_to || "..."}`
    : null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap text-sm">
      {/* Type ID avec copie */}
      <div className="flex items-center gap-0.5">
        <Badge
          variant="outline"
          className="font-mono text-xs px-1.5 py-0 h-5 cursor-pointer hover:bg-muted"
          onClick={copyId}
          title="Cliquer pour copier"
        >
          #{enrichment.type_id}
        </Badge>
        {showActions && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-50 hover:opacity-100"
            onClick={copyId}
            title="Copier ID"
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>

      <span className="text-muted-foreground">—</span>

      {/* Marque (uppercase) */}
      <span className="font-semibold uppercase text-primary">
        {enrichment.make}
      </span>

      {/* Modèle/Génération */}
      <span className="font-medium">
        {enrichment.generation || enrichment.model}
      </span>

      {/* Moteur */}
      {enrichment.engine && enrichment.engine !== "N/A" && (
        <>
          <span className="text-muted-foreground">—</span>
          <span className="text-muted-foreground">{enrichment.engine}</span>
        </>
      )}

      {/* Puissance */}
      {enrichment.power_hp && (
        <>
          <span className="text-muted-foreground">—</span>
          <span>{enrichment.power_hp} ch</span>
        </>
      )}

      {/* Années */}
      {yearRange && (
        <>
          <span className="text-muted-foreground">—</span>
          <span className="text-muted-foreground">{yearRange}</span>
        </>
      )}

      {/* Carburant */}
      <Badge
        variant={
          enrichment.fuel === "Diesel"
            ? "default"
            : enrichment.fuel === "Essence"
              ? "secondary"
              : "outline"
        }
        className="text-xs ml-1"
      >
        {enrichment.fuel}
      </Badge>

      {/* Actions */}
      {showActions && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-50 hover:opacity-100 ml-1"
          title="Voir fiche véhicule"
          asChild
        >
          <a
            href={`/constructeurs/${enrichment.make.toLowerCase()}.html`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      )}
    </div>
  );
}

/**
 * Composant compact pour afficher juste l'essentiel
 */
export function EnrichedVehicleItemCompact({
  item,
  enrichment,
}: EnrichedVehicleItemProps) {
  if (!enrichment) {
    return (
      <span className="text-sm text-muted-foreground">
        {[item.brand, item.model_name, item.variant_name]
          .filter(Boolean)
          .join(" ")}
        {item.type_id && ` #${item.type_id}`}
      </span>
    );
  }

  return (
    <span className="text-sm">
      <span className="font-mono text-xs text-muted-foreground">
        #{enrichment.type_id}
      </span>{" "}
      <span className="font-semibold uppercase">{enrichment.make}</span>{" "}
      <span>{enrichment.generation || enrichment.model}</span>
      {enrichment.engine && enrichment.engine !== "N/A" && (
        <span className="text-muted-foreground"> {enrichment.engine}</span>
      )}
      {enrichment.power_hp && (
        <span className="text-muted-foreground"> {enrichment.power_hp}ch</span>
      )}
    </span>
  );
}
