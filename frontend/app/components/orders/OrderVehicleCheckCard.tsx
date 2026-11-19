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
 * Lecture défensive : la valeur vient d'une colonne jsonb ; une forme inconnue
 * est affichée comme « non lisible », jamais devinée.
 */
import { Car, ClipboardCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export interface OrderVehicleCheckView {
  customerReference: string | null;
  purchaseVehicle: {
    typeId: number;
    label: string | null;
  } | null;
  lineTypeIds: number[];
  capturedAt: string | null;
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

            <dt className="text-slate-500">Véhicule de la page d&apos;achat</dt>
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
