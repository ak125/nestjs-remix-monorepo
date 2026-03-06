import { Link, useLocation } from "@remix-run/react";
import { Home, Package, ShoppingCart, Stethoscope, User } from "lucide-react";

const NAV_ITEMS = [
  { icon: Home, label: "Accueil", href: "/", match: (p: string) => p === "/" },
  {
    icon: Package,
    label: "Catalogue",
    href: "/#catalogue",
    match: (p: string) => p.startsWith("/pieces"),
  },
  {
    icon: Stethoscope,
    label: "Diagnostic",
    href: "/diagnostic-auto",
    match: (p: string) => p.startsWith("/diagnostic"),
  },
  {
    icon: User,
    label: "Compte",
    href: "/account/dashboard",
    match: (p: string) => p.startsWith("/account"),
  },
  {
    icon: ShoppingCart,
    label: "Panier",
    href: "/cart",
    match: (p: string) => p.startsWith("/cart"),
  },
];

export default function BottomNavV9() {
  const location = useLocation();

  return (
    <nav
      aria-label="Navigation mobile"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-lg shadow-black/5 flex lg:hidden"
      style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}
    >
      {NAV_ITEMS.map((n) => {
        const Icon = n.icon;
        const isActive = n.match(location.pathname);
        return (
          <Link
            key={n.label}
            to={n.href}
            prefetch="intent"
            aria-current={isActive ? "page" : undefined}
            className={`no-style no-visited flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-all relative ${isActive ? "text-cta" : "text-slate-400"}`}
          >
            {isActive && (
              <span className="absolute top-0 left-[20%] w-[60%] h-[2.5px] bg-gradient-to-r from-cta to-cta-hover rounded-b" />
            )}
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
