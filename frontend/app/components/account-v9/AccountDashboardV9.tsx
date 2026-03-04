import { Form, Link } from "@remix-run/react";
import {
  Award,
  Bell,
  Bookmark,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  Heart,
  HelpCircle,
  LogOut,
  MapPinned,
  Package,
  Pencil,
  Settings,
  Stethoscope,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

interface AccountV9Props {
  user: {
    firstName?: string;
    lastName?: string;
    email: string;
    isPro?: boolean;
    level?: number;
    createdAt?: string;
  };
  stats: {
    orders: {
      total: number;
      pending: number;
      completed: number;
      revenue?: number;
      recent?: Array<{
        id: string | number;
        date: string;
        totalTtc: number;
        isPaid: boolean;
        status: string;
        info?: string;
      }>;
    };
    messages: { total: number; unread: number };
    profile: { completeness: number };
  };
}

function getInitials(firstName?: string, lastName?: string, email?: string) {
  if (firstName && lastName)
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

function getYearsSince(dateStr?: string): number | null {
  if (!dateStr) return null;
  const created = new Date(dateStr);
  if (isNaN(created.getTime())) return null;
  return Math.floor(
    (Date.now() - created.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
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

const MENU_SECTIONS = [
  {
    title: "Achats",
    items: [
      {
        icon: Heart,
        label: "Mes favoris",
        href: "/account/favorites",
        color: "text-red-500",
      },
      {
        icon: Bookmark,
        label: "Listes d'achat",
        href: "/account/orders",
        color: "text-blue-500",
      },
      {
        icon: CreditCard,
        label: "Moyens de paiement",
        href: "/account/payment-methods",
        color: "text-slate-500",
      },
    ],
  },
  {
    title: "Livraison",
    items: [
      {
        icon: MapPinned,
        label: "Adresses de livraison",
        href: "/account/addresses",
        color: "text-emerald-500",
      },
      {
        icon: Truck,
        label: "Suivi de colis",
        href: "/account/orders",
        color: "text-blue-500",
      },
    ],
  },
  {
    title: "Paramètres",
    items: [
      {
        icon: Bell,
        label: "Notifications",
        href: "/account/settings",
        color: "text-amber-500",
      },
      {
        icon: Settings,
        label: "Paramètres du compte",
        href: "/account/settings",
        color: "text-slate-500",
      },
      {
        icon: HelpCircle,
        label: "Aide & Contact",
        href: "/account/messages",
        color: "text-blue-500",
      },
    ],
  },
];

export default function AccountDashboardV9({ user, stats }: AccountV9Props) {
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [showAllOrders, setShowAllOrders] = useState(false);

  const initials = getInitials(user.firstName, user.lastName, user.email);
  const yearsSince = getYearsSince(user.createdAt);
  const recentOrders = stats.orders.recent || [];
  const visibleOrders = showAllOrders ? recentOrders : recentOrders.slice(0, 2);

  return (
    <div className="pb-20">
      {/* ═══════════════ PROFILE CARD ═══════════════ */}
      <section className="bg-gradient-to-b from-[var(--v9-navy)] to-[var(--v9-navy-light)]">
        <div className="px-5 pt-5 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
              <span className="text-[24px] font-extrabold text-white font-v9-heading">
                {initials}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[18px] font-bold text-white font-v9-heading tracking-tight">
                {user.firstName || user.email.split("@")[0]}
              </div>
              <div className="text-[12px] text-blue-200/50 mt-0.5 truncate">
                {user.email}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {yearsSince !== null && yearsSince > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border-emerald-400/20 px-2 py-0.5"
                  >
                    <Award size={9} className="mr-1" />
                    Client depuis{" "}
                    {yearsSince > 1 ? `${yearsSince} ans` : "1 an"}
                  </Badge>
                )}
                {user.isPro && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border-amber-400/20 px-2 py-0.5"
                  >
                    Pro
                  </Badge>
                )}
              </div>
            </div>
            <Link
              to="/account/profile/edit"
              className="w-9 h-9 rounded-xl bg-white/[0.08] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.15] transition-all"
            >
              <Pencil size={15} />
            </Link>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2.5 mt-5">
            {[
              { n: String(stats.orders.total), l: "Commandes", icon: Package },
              {
                n: String(stats.messages.unread),
                l: "Non lus",
                icon: Stethoscope,
              },
              {
                n: `${stats.profile.completeness}%`,
                l: "Profil",
                icon: Settings,
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.l}
                  className="bg-white/[0.06] border border-white/[0.08] rounded-xl py-3 text-center"
                >
                  <Icon size={16} className="text-white/30 mx-auto mb-1" />
                  <div className="text-[16px] font-extrabold text-white font-v9-heading">
                    {s.n}
                  </div>
                  <div className="text-[10px] text-blue-200/40">{s.l}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ MES COMMANDES ═══════════════ */}
      {recentOrders.length > 0 && (
        <section className="py-6 bg-slate-50">
          <div className="px-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Package size={16} className="text-amber-600" />
                </div>
                <h2 className="text-[18px] font-bold text-slate-900 tracking-tight font-v9-heading">
                  Mes commandes
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-200 px-2.5 py-1 rounded-lg">
                {stats.orders.total} total
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {visibleOrders.map((o, i) => {
                const st = STATUS_MAP[o.status] || STATUS_MAP.pending;
                const isOpen = expandedOrder === i;
                return (
                  <div
                    key={o.id}
                    className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${isOpen ? "border-blue-200 shadow-lg shadow-blue-500/[0.05]" : "border-slate-200"}`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedOrder(isOpen ? null : i)}
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
                      <div className="px-4 pb-4 pt-0 animate-v9-fade-in">
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

            {!showAllOrders && recentOrders.length > 2 && (
              <button
                type="button"
                onClick={() => setShowAllOrders(true)}
                className="w-full mt-3 py-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-600 transition-all flex items-center justify-center gap-2 cursor-pointer font-[inherit]"
              >
                Voir les {recentOrders.length} commandes récentes{" "}
                <ChevronDown size={14} />
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
      )}

      {/* ═══════════════ MENU SECTIONS ═══════════════ */}
      <section className="py-6 bg-slate-50">
        <div className="px-5">
          {MENU_SECTIONS.map((section) => (
            <div key={section.title} className="mb-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                {section.title}
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {section.items.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      to={item.href}
                      className={`flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50 transition-colors ${i < section.items.length - 1 ? "border-b border-slate-100" : ""}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                        <Icon size={16} className={item.color} />
                      </div>
                      <span className="flex-1 text-[13px] font-medium text-slate-700">
                        {item.label}
                      </span>
                      <ChevronRight size={15} className="text-slate-300" />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Espace Pro banner */}
          {user.isPro && (
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-4 flex items-center gap-3.5 mb-4 border border-slate-700">
              <div className="w-11 h-11 rounded-xl bg-amber-500 flex items-center justify-center shadow-md shadow-amber-500/20 flex-shrink-0">
                <Award size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-bold text-white">
                  Espace Pro
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Tarifs préférentiels &amp; facturation
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-500" />
            </div>
          )}

          {/* Logout */}
          <Form method="post" action="/logout">
            <Button
              type="submit"
              variant="outline"
              className="w-full py-3 border-red-100 text-[13px] font-semibold text-red-500 hover:bg-red-50 hover:border-red-200 rounded-xl"
            >
              <LogOut size={15} className="mr-2" /> Se déconnecter
            </Button>
          </Form>
        </div>
      </section>
    </div>
  );
}
