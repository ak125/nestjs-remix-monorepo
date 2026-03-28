import { Link } from "@remix-run/react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Package,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { formatPrice } from "~/utils/format";
import { type OrderStatus, type RecentOrder } from "./account.types";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

const STATUS_MAP: Record<OrderStatus, { label: string; className: string }> = {
  paid: {
    label: "Payée",
    className: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  pending: {
    label: "En attente",
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
  shipped: {
    label: "Expédiée",
    className: "text-blue-700 bg-blue-50 border-blue-200",
  },
  delivered: {
    label: "Livrée",
    className: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  cancelled: {
    label: "Annulée",
    className: "text-red-700 bg-red-50 border-red-200",
  },
};

interface AccountOrdersSectionProps {
  orders: RecentOrder[];
  totalOrders: number;
}

export function AccountOrdersSection({
  orders,
  totalOrders,
}: AccountOrdersSectionProps) {
  const [expandedOrderId, setExpandedOrderId] = useState<
    string | number | null
  >(null);
  const [showAllOrders, setShowAllOrders] = useState(false);

  if (orders.length === 0) return null;

  const visibleOrders = showAllOrders ? orders : orders.slice(0, 2);

  return (
    <section className="py-6 bg-slate-50">
      <div className="px-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Package size={16} className="text-amber-600" />
            </div>
            <h2 className="text-[18px] font-bold text-slate-900 tracking-tight font-heading">
              Mes commandes
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-200 px-2.5 py-1 rounded-lg">
            {totalOrders} total
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {visibleOrders.map((o) => {
            const st = STATUS_MAP[o.status] ?? STATUS_MAP.pending;
            const isOpen = expandedOrderId === o.id;
            return (
              <div
                key={o.id}
                className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${isOpen ? "border-blue-200 shadow-lg shadow-blue-500/[0.05]" : "border-slate-200"}`}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`order-panel-${o.id}`}
                  onClick={() => setExpandedOrderId(isOpen ? null : o.id)}
                  className="w-full p-4 text-left flex items-center gap-3 bg-transparent border-none cursor-pointer font-[inherit]"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Package size={18} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-slate-800">
                        #{o.id}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${st.className}`}
                      >
                        {st.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {o.info || "Commande"} &middot; {formatDate(o.date)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[13px] font-bold text-slate-800">
                      {formatPrice(o.totalTtc)}
                    </div>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-slate-400 ml-1 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <div
                    id={`order-panel-${o.id}`}
                    className="px-4 pb-4 pt-0 animate-subtle-fade-in"
                  >
                    <div className="border-t border-slate-100 pt-3 flex gap-2">
                      <Button
                        asChild
                        size="sm"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg shadow-md shadow-blue-200"
                      >
                        <Link to={`/account/orders/${o.id}`}>
                          <Truck size={13} className="mr-1.5" /> Détails
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="secondary"
                        size="sm"
                        className="flex-1 text-[12px] font-semibold rounded-lg"
                      >
                        <Link to={`/account/orders/${o.id}/invoice`}>
                          <FileText size={13} className="mr-1.5" /> Facture
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {orders.length > 2 && (
          <button
            type="button"
            onClick={() => setShowAllOrders((prev) => !prev)}
            className="w-full mt-3 py-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-600 transition-all flex items-center justify-center gap-2 cursor-pointer font-[inherit]"
          >
            {showAllOrders
              ? "Masquer les commandes récentes"
              : `Voir les ${orders.length} commandes récentes`}
            <ChevronDown
              size={14}
              className={
                showAllOrders
                  ? "rotate-180 transition-transform"
                  : "transition-transform"
              }
            />
          </button>
        )}

        <Button
          asChild
          variant="outline"
          className="w-full mt-2 text-[13px] font-semibold rounded-xl"
        >
          <Link to="/account/orders">
            Toutes mes commandes <ChevronRight size={14} className="ml-1" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
