/**
 * Tuiles de /commercial/orders, calculées par le serveur sur TOUTE la base
 * (GET /api/legacy-orders/stats?period=…, champ `tiles`).
 *
 * Décisions de Marwane du 17/11/2026 (complément n° 1 au mandat BN) :
 * impayées = non payées, non annulées, de moins de 30 jours ; au-delà,
 * « abandonnées » ; un montant aberrant est exclu des sommes et relevé ;
 * une commande annulée n'est pas une vente (21:45) : une payée puis annulée
 * sort du chiffre d'affaires et apparaît dans la tuile « Annulées ».
 * Annulée = `ord_cancel_date` renseignée ou statut 2 (réponse de Marwane
 * du 18/11 00:27 : « Oui, 2 = annulée », trace de l'ancien site).
 * Une indisponibilité s'affiche comme telle, jamais comme des zéros.
 *
 * Tuile et filtre « Payées non traitées depuis plus de 24 h » (complément
 * du 18/11/2026) : payée, non annulée, paiement ni annulé ni remboursé, et
 * une ligne sans fournisseur posé ou sans commande fournisseur (statut de
 * ligne 6). Pas de nouveau canal d'alerte (décision 4) : la file vit ici.
 *
 * @see backend/src/database/services/order-stats-tiles.ts
 */

import {
  AlertTriangle,
  Ban,
  CheckCircle,
  Clock,
  DollarSign,
  Hourglass,
  Package,
  XCircle,
} from "lucide-react";
import { memo, type ReactNode } from "react";
import { Link } from "react-router";

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
  paidUnprocessed: PaidUnprocessedData;
}

/** Valeur du paramètre `queue` qui active le filtre de la file. */
export const PAID_UNPROCESSED_QUEUE = "payees-non-traitees";

type PaidUnprocessedReason =
  | "no_active_line"
  | "supplier_missing"
  | "supplier_order_missing";

/** Miroir de `tiles.paidUnprocessed` (backend). */
export interface PaidUnprocessedData {
  afterHours: number;
  captureStateRead: boolean;
  orders: number;
  list: Array<{
    ordId: string;
    ordDate: string;
    paidAt: string;
    paidAtSource: "ord_date_pay" | "ord_date";
    totalTtc: string | null;
    ageDays: number;
    linesActive: number;
    linesWithSupplier: number;
    linesOrderedFromSupplier: number;
    reason: PaidUnprocessedReason;
  }>;
}

const PAID_UNPROCESSED_REASON: Record<PaidUnprocessedReason, string> = {
  no_active_line: "aucune ligne active",
  supplier_missing: "fournisseur non confirmé",
  supplier_order_missing: "pas de commande fournisseur",
};

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
  className = "border-gray-200",
}: {
  icon: ReactNode;
  title: string;
  value: ReactNode;
  sub: ReactNode;
  testId: string;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow-sm p-5 border h-full ${className}`}
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
  queueHref,
  queueActive = false,
}: {
  tiles: OrderTilesState;
  onPeriodChange: (period: OrderTilesPeriod) => void;
  /** Lien qui active (ou retire) le filtre de la file. */
  queueHref?: string;
  queueActive?: boolean;
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
  const queue = t.paidUnprocessed;
  const oldest = queue.list[0];
  const queueTile = (
    <Tile
      testId="tile-paid-unprocessed"
      className={
        queueActive
          ? "border-amber-500 ring-2 ring-amber-300"
          : queue.orders > 0
            ? "border-amber-300"
            : "border-gray-200"
      }
      icon={<Hourglass className="w-5 h-5 text-amber-600" />}
      title={`Payées non traitées depuis plus de ${queue.afterHours} h`}
      value={
        <span className={queue.orders > 0 ? "text-amber-700" : undefined}>
          {queue.orders}
        </span>
      }
      sub={
        oldest
          ? `La plus ancienne attend depuis ${plural(oldest.ageDays, "jour")}${queueActive ? " — filtre actif" : ""}`
          : "Aucune commande en attente"
      }
    />
  );

  return (
    <section className="py-4 space-y-4" aria-label="Indicateurs commandes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {periodSelect}
        <p className="text-xs text-gray-500">
          Calculé sur toute la base ({plural(t.rowsRead, "commande")} lues), sur
          le paiement et l'annulation enregistrés par le site (date
          d'annulation, ou statut 2 pour l'historique de l'ancien site).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {queueHref ? (
          <Link
            to={queueHref}
            aria-pressed={queueActive}
            aria-label={
              queueActive
                ? "Retirer le filtre des commandes payées non traitées"
                : "Filtrer les commandes payées non traitées"
            }
            className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            data-testid="tile-paid-unprocessed-link"
          >
            {queueTile}
          </Link>
        ) : (
          queueTile
        )}
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
        <Tile
          testId="tile-cancelled"
          icon={<XCircle className="w-5 h-5 text-gray-500" />}
          title="Annulées"
          value={
            <span className="text-gray-700">
              {formatPrice(t.cancelled.paidAmount)}
            </span>
          }
          sub={`${plural(t.cancelled.paidOrders, "commande")} payée${t.cancelled.paidOrders > 1 ? "s" : ""} puis annulée${t.cancelled.paidOrders > 1 ? "s" : ""}, hors chiffre d'affaires (${plural(t.cancelled.orders, "annulation")} au total)`}
        />
      </div>

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

/**
 * Vue filtrée « Payées non traitées depuis plus de 24 h », de la plus
 * ancienne à la plus récente, avec l'âge en jours depuis le paiement.
 */
export function PaidUnprocessedList({
  queue,
  basePath,
  clearHref,
}: {
  queue: PaidUnprocessedData;
  basePath: string;
  clearHref: string;
}) {
  return (
    <section
      className="bg-white rounded-lg shadow overflow-hidden"
      aria-label="Commandes payées non traitées"
      data-testid="paid-unprocessed-list"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b">
        <h2 className="font-semibold text-gray-900">
          {plural(queue.orders, "commande")} payée{queue.orders > 1 ? "s" : ""}{" "}
          non traitée{queue.orders > 1 ? "s" : ""} depuis plus de{" "}
          {queue.afterHours} h
        </h2>
        <Link
          to={clearHref}
          className="text-sm text-blue-700 underline"
          data-testid="paid-unprocessed-clear"
        >
          Retirer le filtre
        </Link>
      </div>
      <p className="px-4 pt-3 text-xs text-gray-500">
        Traitée = chaque ligne active a un fournisseur confirmé et le statut «
        Pièce commandée chez fournisseur ».
        {!queue.captureStateRead &&
          " L'état d'encaissement (paiement annulé ou remboursé) n'est pas encore enregistré par le site : il n'est pas pris en compte."}
      </p>
      {queue.list.length === 0 ? (
        <p className="p-4 text-sm text-gray-600">
          Aucune commande payée en attente de traitement.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2 font-medium">Commande</th>
                <th className="px-4 py-2 font-medium">Payée le</th>
                <th className="px-4 py-2 font-medium text-right">Âge</th>
                <th className="px-4 py-2 font-medium text-right">
                  Montant TTC
                </th>
                <th className="px-4 py-2 font-medium">Lignes</th>
                <th className="px-4 py-2 font-medium">À faire</th>
              </tr>
            </thead>
            <tbody>
              {queue.list.map((o) => (
                <tr
                  key={o.ordId}
                  className="border-t"
                  data-testid="paid-unprocessed-row"
                >
                  <td className="px-4 py-2">
                    <Link
                      to={`${basePath}/${encodeURIComponent(o.ordId)}`}
                      className="text-blue-700 underline"
                    >
                      {o.ordId}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {o.paidAt.slice(0, 10)}
                    {o.paidAtSource === "ord_date" && (
                      <span className="text-gray-500"> (date de commande)</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {plural(o.ageDays, "jour")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {o.totalTtc ?? "—"} €
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {o.linesActive === 0
                      ? "—"
                      : `${o.linesWithSupplier}/${o.linesActive} fournisseur, ${o.linesOrderedFromSupplier}/${o.linesActive} commandée${o.linesOrderedFromSupplier > 1 ? "s" : ""}`}
                  </td>
                  <td className="px-4 py-2">
                    {PAID_UNPROCESSED_REASON[o.reason]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
