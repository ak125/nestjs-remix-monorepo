/**
 * Tuiles de /commercial/orders, calculées par le serveur sur TOUTE la base
 * (GET /api/legacy-orders/stats?period=…, champ `tiles`).
 *
 * Décisions de Marwane du 17/11/2026 (complément n° 1 au mandat BN) :
 * impayées = non payées, non annulées, de moins de 30 jours ; au-delà,
 * « abandonnées » ; un montant aberrant est exclu des sommes et relevé.
 * Une indisponibilité s'affiche comme telle, jamais comme des zéros.
 *
 * @see backend/src/database/services/order-stats-tiles.ts
 */

import {
  AlertTriangle,
  Ban,
  CheckCircle,
  Clock,
  DollarSign,
  Package,
} from "lucide-react";
import { memo, type ReactNode } from "react";

import { formatPrice } from "../../utils/orders.utils";

const ORDER_TILES_PERIODS = ["all", "year", "month"] as const;
export type OrderTilesPeriod = (typeof ORDER_TILES_PERIODS)[number];

const ORDER_TILES_PERIOD_LABEL: Record<OrderTilesPeriod, string> = {
  all: "Toute la période",
  year: "Cette année",
  month: "Ce mois",
};

export function parseTilesPeriod(value: string | null): OrderTilesPeriod {
  return (ORDER_TILES_PERIODS as readonly string[]).includes(value ?? "")
    ? (value as OrderTilesPeriod)
    : "all";
}

/** Miroir du champ `tiles` renvoyé par le backend. */
export interface OrderTilesData {
  period: OrderTilesPeriod;
  periodStart: string | null;
  computedAt: string;
  rowsRead: number;
  paid: { orders: number; revenue: number; averageBasket: number };
  monthRevenue: number;
  unpaid: { orders: number; amount: number };
  abandoned: { orders: number; amount: number; afterDays: number };
  cancelled: { orders: number; paidOrders: number; paidAmount: number };
  excluded: {
    thresholdTtc: number;
    orders: Array<{
      ordId: string;
      ordDate: string | null;
      totalTtc: string | null;
      isPaid: boolean;
      reason:
        | "amount_above_threshold"
        | "amount_unreadable"
        | "date_unreadable";
    }>;
  };
}

export type OrderTilesState =
  | { status: "ok"; period: OrderTilesPeriod; data: OrderTilesData }
  | { status: "forbidden"; period: OrderTilesPeriod }
  | { status: "unavailable"; period: OrderTilesPeriod };

const EXCLUSION_REASON: Record<
  OrderTilesData["excluded"]["orders"][number]["reason"],
  string
> = {
  amount_above_threshold: "montant au-delà du seuil",
  amount_unreadable: "montant illisible",
  date_unreadable: "date illisible",
};

function plural(n: number, word: string) {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

function Tile({
  icon,
  title,
  value,
  sub,
  testId,
}: {
  icon: ReactNode;
  title: string;
  value: ReactNode;
  sub: ReactNode;
  testId: string;
}) {
  return (
    <div
      className="bg-white rounded-lg shadow-sm p-5 border border-gray-200"
      data-testid={testId}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="p-2.5 bg-muted rounded-lg">{icon}</div>
        <span className="text-sm font-medium text-gray-500">{title}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-600 mt-1">{sub}</p>
    </div>
  );
}

export const OrdersTiles = memo(function OrdersTiles({
  tiles,
  onPeriodChange,
}: {
  tiles: OrderTilesState;
  onPeriodChange: (period: OrderTilesPeriod) => void;
}) {
  const periodSelect = (
    <label className="flex items-center gap-2 text-sm text-gray-600">
      Période
      <select
        name="period"
        value={tiles.period}
        onChange={(e) => onPeriodChange(parseTilesPeriod(e.target.value))}
        className="border rounded-md px-2 py-1 text-sm bg-white"
      >
        {ORDER_TILES_PERIODS.map((p) => (
          <option key={p} value={p}>
            {ORDER_TILES_PERIOD_LABEL[p]}
          </option>
        ))}
      </select>
    </label>
  );

  if (tiles.status === "forbidden") {
    return (
      <p className="text-sm text-gray-600 py-4" data-testid="tiles-forbidden">
        Les indicateurs financiers sont réservés aux profils autorisés à voir le
        chiffre d'affaires.
      </p>
    );
  }

  if (tiles.status === "unavailable") {
    return (
      <div className="py-4 space-y-2" data-testid="tiles-unavailable">
        {periodSelect}
        <p className="text-sm text-red-700">
          Indicateurs indisponibles : le calcul sur toute la base n'a pas
          abouti. Aucun chiffre n'est affiché plutôt qu'un chiffre faux.
        </p>
      </div>
    );
  }

  const t = tiles.data;
  const excluded = t.excluded.orders;

  return (
    <section className="py-4 space-y-4" aria-label="Indicateurs commandes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {periodSelect}
        <p className="text-xs text-gray-500">
          Calculé sur toute la base ({plural(t.rowsRead, "commande")} lues),
          sans lire les statuts : paiement et annulation enregistrés par le
          site.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Tile
          testId="tile-orders"
          icon={<Package className="w-5 h-5 text-blue-600" />}
          title={ORDER_TILES_PERIOD_LABEL[t.period]}
          value={t.paid.orders}
          sub="Commandes payées"
        />
        <Tile
          testId="tile-revenue"
          icon={<DollarSign className="w-5 h-5 text-green-600" />}
          title="Chiffre d'affaires"
          value={formatPrice(t.paid.revenue)}
          sub={
            <span className="text-green-700">
              +{formatPrice(t.monthRevenue)} ce mois
            </span>
          }
        />
        <Tile
          testId="tile-basket"
          icon={<CheckCircle className="w-5 h-5 text-foreground" />}
          title="Panier moyen"
          value={formatPrice(t.paid.averageBasket)}
          sub="Par commande payée"
        />
        <Tile
          testId="tile-unpaid"
          icon={<Clock className="w-5 h-5 text-red-600" />}
          title="Impayées"
          value={
            <span className="text-red-600">{formatPrice(t.unpaid.amount)}</span>
          }
          sub={`${plural(t.unpaid.orders, "commande")} de moins de ${t.abandoned.afterDays} jours`}
        />
        <Tile
          testId="tile-abandoned"
          icon={<Ban className="w-5 h-5 text-gray-500" />}
          title="Abandonnées"
          value={
            <span className="text-gray-700">
              {formatPrice(t.abandoned.amount)}
            </span>
          }
          sub={`${plural(t.abandoned.orders, "commande")} non payée${t.abandoned.orders > 1 ? "s" : ""} depuis ${t.abandoned.afterDays} jours ou plus`}
        />
      </div>

      {t.cancelled.paidOrders > 0 && (
        <p className="text-xs text-gray-600" data-testid="tiles-paid-cancelled">
          Dont {plural(t.cancelled.paidOrders, "commande")} payée
          {t.cancelled.paidOrders > 1 ? "s" : ""} puis annulée
          {t.cancelled.paidOrders > 1 ? "s" : ""} (
          {formatPrice(t.cancelled.paidAmount)}), comptée
          {t.cancelled.paidOrders > 1 ? "s" : ""} dans le chiffre d'affaires.
        </p>
      )}

      {excluded.length > 0 && (
        <div
          className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          role="note"
          data-testid="tiles-excluded"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">
              {plural(excluded.length, "commande")} exclue
              {excluded.length > 1 ? "s" : ""} de toutes les sommes (seuil{" "}
              {formatPrice(t.excluded.thresholdTtc)} TTC) — relevée
              {excluded.length > 1 ? "s" : ""}, rien n'est corrigé en base :
            </p>
            <ul className="mt-1 list-disc pl-5">
              {excluded.map((o) => (
                <li key={o.ordId}>
                  n° {o.ordId}
                  {o.ordDate ? ` du ${o.ordDate.slice(0, 10)}` : ""} :{" "}
                  {o.totalTtc ?? "—"} € TTC, {EXCLUSION_REASON[o.reason]}
                  {o.isPaid ? " (payée)" : " (non payée)"}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
});
