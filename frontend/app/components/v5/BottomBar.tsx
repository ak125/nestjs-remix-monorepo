import { Link, useLocation } from "@remix-run/react";
import {
  Home,
  LayoutGrid,
  ShoppingCart,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type Item = {
  key: string;
  to: string;
  label: string;
  icon: LucideIcon;
  matchPrefix?: string;
};

const ITEMS: Item[] = [
  { key: "home", to: "/v5", label: "Accueil", icon: Home, matchPrefix: "/v5" },
  {
    key: "catalog",
    to: "/v5/liste",
    label: "Catalogue",
    icon: LayoutGrid,
    matchPrefix: "/v5/liste",
  },
  {
    key: "garage",
    to: "/v5/garage",
    label: "Garage",
    icon: Wrench,
    matchPrefix: "/v5/garage",
  },
  {
    key: "cart",
    to: "/v5/panier",
    label: "Panier",
    icon: ShoppingCart,
    matchPrefix: "/v5/panier",
  },
  {
    key: "account",
    to: "/v5/compte",
    label: "Compte",
    icon: User,
    matchPrefix: "/v5/compte",
  },
];

const isActive = (pathname: string, item: Item): boolean => {
  // /v5 home only matches exact (otherwise it'd match every /v5/* route)
  if (item.key === "home") return pathname === "/v5" || pathname === "/v5/";
  return Boolean(item.matchPrefix && pathname.startsWith(item.matchPrefix));
};

export function V5BottomBar() {
  const { pathname } = useLocation();

  return (
    <nav className="v5-bottombar" aria-label="Navigation principale">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.key}
            to={item.to}
            className={`v5-bottombar-item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={22} aria-hidden="true" />
            <span className="v5-bottombar-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
