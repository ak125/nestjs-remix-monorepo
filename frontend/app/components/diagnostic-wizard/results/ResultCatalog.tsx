/**
 * ResultCatalog — Block 5: Catalog orientation (CatalogGuard)
 * Catalogue destinations require permission and a valid gamme alias + ID.
 * Shows permitted suggestions with caution when compatibility is unconfirmed.
 */
import { ShoppingCart, ExternalLink, ShieldCheck, ShieldX } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { emitFunnel, getFunnelSessionId } from "~/utils/funnel-beacon";
import { buildGammeUrl, normalizeAlias } from "~/utils/url-builder.utils";
import { type EvidencePack } from "../types";

interface Props {
  catalogGuard: EvidencePack["catalog_guard"];
}

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  high: {
    label: "Confiance élevée",
    color: "text-green-700 bg-green-50 border-green-200",
  },
  medium: {
    label: "Confiance moyenne",
    color: "text-amber-700 bg-amber-50 border-amber-200",
  },
  low: {
    label: "Confiance faible",
    color: "text-orange-700 bg-orange-50 border-orange-200",
  },
  insufficient: {
    label: "Données insuffisantes",
    color: "text-red-700 bg-red-50 border-red-200",
  },
};

export function hasSuggestedGammes(guard: EvidencePack["catalog_guard"]) {
  return (
    guard.allowed_output_mode !== "none" && guard.suggested_gammes.length > 0
  );
}

export function ResultCatalog({ catalogGuard }: Props) {
  const confidence =
    CONFIDENCE_LABELS[catalogGuard.confidence_before_purchase] ||
    CONFIDENCE_LABELS.low;

  const hasGammes = hasSuggestedGammes(catalogGuard);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            Orientation pièces
          </span>
          <Badge variant="outline" className={`text-xs ${confidence.color}`}>
            {catalogGuard.ready_for_catalog ? (
              <ShieldCheck className="w-3 h-3 mr-1" />
            ) : (
              <ShieldX className="w-3 h-3 mr-1" />
            )}
            {confidence.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Guard reason */}
        <p className="text-sm text-gray-600">{catalogGuard.reason}</p>

        {/* Caution notice — before gammes */}
        {!catalogGuard.ready_for_catalog && hasGammes && (
          <div
            className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800"
            role="alert"
          >
            <strong>Important :</strong> Un contrôle visuel ou professionnel est
            recommandé avant tout achat pour confirmer le diagnostic.
          </div>
        )}

        {/* Suggested gammes */}
        {hasGammes && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Familles de pièces concernées
            </p>
            <div className="grid gap-2">
              {catalogGuard.suggested_gammes.map((g) => {
                const href = buildGammeUrl(g.gamme_slug, g.pg_id);
                const Tag = href ? "a" : "div";
                const gammeConfidence =
                  CONFIDENCE_LABELS[g.confidence] || CONFIDENCE_LABELS.low;
                return (
                  <Tag
                    key={g.gamme_slug}
                    href={href}
                    onClick={
                      href
                        ? () =>
                            emitFunnel({
                              event_type: "diag_gamme_cta_click",
                              payload: {
                                session_id: getFunnelSessionId(),
                                gamme_slug: normalizeAlias(g.gamme_slug),
                                confidence: g.confidence,
                              },
                            })
                        : undefined
                    }
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-colors group min-h-[48px]"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                        {g.gamme_label}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${gammeConfidence.color}`}
                      >
                        {gammeConfidence.label}
                      </Badge>
                    </div>
                    {href && (
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-500 shrink-0" />
                    )}
                  </Tag>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
