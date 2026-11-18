/**
 * Vérification véhicule d'une commande — carte prête à brancher sur
 * /commercial/orders/<commande> (mandat BN, 2026-11-17).
 *
 * Données : `order.ord_vehicle_check` renvoyé tel quel par
 * GET /api/legacy-orders/:id (select *, permission canSeeCustomerDetails),
 * une fois la migration 20261117_order_vehicle_check.sql appliquée.
 *
 * Branchement (après fusion de BK, hors de ce mandat) :
 *   <OrderVehicleCheckCard vehicleCheck={order.ord_vehicle_check} />
 *
 * Mandat CK (2026-11-18) : `lines` porte le véhicule de chaque ligne (type_id
 * et provenance) ; `OrderLineVehicle` l'affiche sous chaque produit, avec la
 * page d'ajout (`orl_website_url`). Sans véhicule, la ligne le dit.
 *
 * Lecture défensive : la valeur vient d'une colonne jsonb ; une forme inconnue
 * est affichée comme « non lisible », jamais devinée.
 */
import { Car, ClipboardCheck, ExternalLink } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export interface OrderVehicleCheckView {
  customerReference: string | null;
  purchaseVehicle: {
    typeId: number;
    label: string | null;
  } | null;
  lineTypeIds: number[];
  lines: OrderLineVehicleView[];
  capturedAt: string | null;
}

export type LineVehicleSource = "page" | "selected_vehicle";

/** Véhicule d'une ligne (mandat CK). `position` = rang Lnnn de orl_id. */
export interface OrderLineVehicleView {
  position: number;
  typeId: number | null;
  source: LineVehicleSource | null;
}

const LINE_SOURCE_LABEL: Record<LineVehicleSource, string> = {
  page: "véhicule de la page d'ajout",
  selected_vehicle: "véhicule choisi par le client (ajout hors page véhicule)",
};

function readLines(raw: unknown): OrderLineVehicleView[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const e = entry as Record<string, unknown>;
    const position = asPositiveInt(e.position);
    if (!position) return [];
    const typeId = asPositiveInt(e.type_id);
    const source =
      typeId && (e.source === "page" || e.source === "selected_vehicle")
        ? e.source
        : null;
    return [{ position, typeId, source }];
  });
}

/**
 * Rang d'une ligne de commande depuis son orl_id (`<commande>-L001` → 1).
 * Renvoie null si l'identifiant ne suit pas ce format.
 */
export function orderLinePosition(orlId: unknown): number | null {
  const m = /-L(\d+)$/.exec(String(orlId ?? ""));
  return m ? asPositiveInt(m[1]) : null;
}

function asText(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asPositiveInt(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Lit la valeur stockée (version 1). Renvoie null si rien n'a été enregistré,
 * "invalid" si la forme n'est pas reconnue.
 */
export function readOrderVehicleCheck(
  raw: unknown,
): OrderVehicleCheckView | null | "invalid" {
  if (raw === null || raw === undefined) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return "invalid";
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "invalid";
  }
  const v = value as Record<string, unknown>;
  if (v.version !== 1) return "invalid";

  const pv = v.purchase_vehicle as Record<string, unknown> | null | undefined;
  const typeId = pv ? asPositiveInt(pv.type_id) : null;
  const label = pv
    ? [asText(pv.brand), asText(pv.model), asText(pv.engine)]
        .filter(Boolean)
        .join(" ") || null
    : null;

  return {
    customerReference: asText(v.customer_reference),
    purchaseVehicle: typeId ? { typeId, label } : null,
    lineTypeIds: Array.isArray(v.line_type_ids)
      ? v.line_type_ids
          .map(asPositiveInt)
          .filter((n): n is number => n !== null)
      : [],
    lines: readLines(v.lines),
    capturedAt: asText(v.captured_at),
  };
}

interface Props {
  /** `order.ord_vehicle_check` tel que renvoyé par l'API. */
  vehicleCheck: unknown;
}

export function OrderVehicleCheckCard({ vehicleCheck }: Props) {
  const view = readOrderVehicleCheck(vehicleCheck);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
          Vérification véhicule avant envoi
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {view === null && (
          <p className="text-slate-500">
            Aucune immatriculation, VIN ou référence fournie, aucun véhicule
            enregistré avec la commande.
          </p>
        )}
        {view === "invalid" && (
          <p className="text-amber-700">
            Donnée de vérification non lisible : à contrôler avec le client.
          </p>
        )}
        {view !== null && view !== "invalid" && (
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-[max-content_1fr] sm:gap-x-4">
            <dt className="text-slate-500">
              Immatriculation, VIN ou référence
            </dt>
            <dd className="font-mono font-medium text-slate-900">
              {view.customerReference ?? (
                <span className="font-sans font-normal text-slate-400">
                  Non fournie
                </span>
              )}
            </dd>

            <dt className="text-slate-500">
              Véhicule choisi au moment de la commande
            </dt>
            <dd className="text-slate-900">
              {view.purchaseVehicle ? (
                <span className="inline-flex items-center gap-1.5">
                  <Car className="h-3.5 w-3.5" aria-hidden="true" />
                  {view.purchaseVehicle.label ?? "Véhicule"}{" "}
                  <span className="text-slate-500">
                    (type_id {view.purchaseVehicle.typeId})
                  </span>
                </span>
              ) : (
                <span className="text-slate-400">Aucun véhicule choisi</span>
              )}
            </dd>

            {view.lineTypeIds.length > 0 && (
              <>
                <dt className="text-slate-500">type_id des lignes</dt>
                <dd className="font-mono text-slate-900">
                  {view.lineTypeIds.join(", ")}
                </dd>
              </>
            )}
          </dl>
        )}
        <p className="text-xs text-slate-500">
          Aucune vérification automatique : la compatibilité est contrôlée par
          l&apos;équipe avant l&apos;envoi.
        </p>
      </CardContent>
    </Card>
  );
}

interface LineProps {
  /** `order.ord_vehicle_check` tel que renvoyé par l'API. */
  vehicleCheck: unknown;
  /** `orl_id` de la ligne (rang Lnnn). */
  lineId: unknown;
  /** `orl_website_url` : page d'où la pièce a été ajoutée. */
  websiteUrl?: string | null;
}

/**
 * Véhicule d'une ligne de commande (mandat CK) : type_id et provenance, avec
 * le lien de la page d'ajout. Sans véhicule enregistré, la ligne le dit.
 */
export function OrderLineVehicle({
  vehicleCheck,
  lineId,
  websiteUrl,
}: LineProps) {
  const view = readOrderVehicleCheck(vehicleCheck);
  const position = orderLinePosition(lineId);
  const entry =
    view && view !== "invalid" && position
      ? view.lines.find((l) => l.position === position)
      : undefined;
  const label =
    entry?.typeId &&
    view &&
    view !== "invalid" &&
    view.purchaseVehicle?.typeId === entry.typeId
      ? view.purchaseVehicle.label
      : null;
  const url = asText(websiteUrl);
  // La page d'ajout est fournie par le navigateur du client : lien seulement
  // pour un chemin interne (« /… »), sinon texte brut (pas de javascript:, etc.).
  const isInternalPath = !!url && url.startsWith("/") && !url.startsWith("//");

  return (
    <div className="mt-1 space-y-0.5 text-xs font-normal">
      {entry?.typeId ? (
        <p className="inline-flex flex-wrap items-center gap-1 text-slate-700">
          <Car className="h-3 w-3" aria-hidden="true" />
          {label ? `${label} ` : "Véhicule "}
          <span className="text-slate-500">(type_id {entry.typeId})</span>
          {entry.source && (
            <span className="text-slate-500">
              — {LINE_SOURCE_LABEL[entry.source]}
            </span>
          )}
        </p>
      ) : (
        <p className="text-amber-700">Aucun véhicule connu pour cette ligne</p>
      )}
      {url && !isInternalPath && (
        <p className="break-all text-slate-500">Page d&apos;ajout : {url}</p>
      )}
      {url && isInternalPath && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 break-all text-slate-500 underline hover:text-slate-700"
        >
          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
          Page d&apos;ajout : {url}
        </a>
      )}
    </div>
  );
}
