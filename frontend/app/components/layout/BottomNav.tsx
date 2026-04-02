import { Link, useLocation } from "@remix-run/react";
import { Home, Package, ShoppingCart, Stethoscope, User } from "lucide-react";
import { useEffect, useRef } from "react";

import { openCartSidebar } from "~/hooks/useCartSidebar";
import { useRootCart } from "~/hooks/useRootData";

const LINK_ITEMS = [
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
];

const itemClass = (active: boolean) =>
  `flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-all relative ${active ? "text-cta" : "text-slate-400"}`;

function ActiveIndicator() {
  return (
    <span className="absolute top-0 left-[20%] w-[60%] h-[2.5px] bg-gradient-to-r from-cta to-cta-hover rounded-b" />
  );
}

export default function BottomNav() {
  const navRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const cartData = useRootCart();
  const itemCount = cartData?.summary?.total_items || 0;
  const isCartActive = location.pathname.startsWith("/cart");

  // Expose la hauteur réelle via CSS variable (même pattern que --navbar-height dans Navbar)
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        document.documentElement.style.setProperty(
          "--bottom-nav-height",
          `${Math.round(entry.contentRect.height)}px`,
        );
      }
    });
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="Navigation mobile"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-lg shadow-black/5 flex lg:hidden"
      style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}
    >
      {LINK_ITEMS.map((n) => {
        const Icon = n.icon;
        const isActive = n.match(location.pathname);
        return (
          <Link
            key={n.label}
            to={n.href}
            prefetch="intent"
            aria-current={isActive ? "page" : undefined}
            className={`no-style no-visited ${itemClass(isActive)}`}
          >
            {isActive && <ActiveIndicator />}
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
            {n.label}
          </Link>
        );
      })}

      {/* Panier — ouvre le sidebar (meme UX que le header) */}
      <button
        type="button"
        onClick={openCartSidebar}
        aria-label="Ouvrir le panier"
        className={itemClass(isCartActive)}
      >
        {isCartActive && <ActiveIndicator />}
        <span className="relative">
          <ShoppingCart size={20} strokeWidth={isCartActive ? 2.5 : 1.5} />
          {itemCount > 0 && (
            <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-0.5 bg-cta rounded-full text-[9px] font-bold flex items-center justify-center text-white">
              {itemCount > 99 ? "99+" : itemCount}
            </span>
          )}
        </span>
        Panier
      </button>
    </nav>
  );
}
