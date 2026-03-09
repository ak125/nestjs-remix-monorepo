import { Form, Link } from "@remix-run/react";
import {
  Award,
  Bell,
  ChevronRight,
  HelpCircle,
  LogOut,
  MapPinned,
  Package,
  Settings,
  Truck,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import type { MenuSection } from "./account.types";

const MENU_SECTIONS: MenuSection[] = [
  {
    title: "Achats",
    items: [
      {
        icon: Package,
        label: "Mes commandes",
        href: "/account/orders",
        color: "text-blue-500",
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

interface AccountMenuSectionsProps {
  isPro?: boolean;
}

export function AccountMenuSections({ isPro }: AccountMenuSectionsProps) {
  return (
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

        {isPro && (
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
  );
}
