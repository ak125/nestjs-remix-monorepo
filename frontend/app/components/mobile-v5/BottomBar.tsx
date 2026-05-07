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
  {
    key: "home",
    to: "/preview-mobile",
    label: "Accueil",
    icon: Home,
    matchPrefix: "/preview-mobile",
  },
  {
    key: "catalog",
    to: "/preview-mobile/catalog",
    label: "Catalogue",
    icon: LayoutGrid,
    matchPrefix: "/preview-mobile/catalog",
  },
  {
    key: "garage",
    to: "/preview-mobile/garage",
    label: "Garage",
    icon: Wrench,
    matchPrefix: "/preview-mobile/garage",
  },
  {
    key: "cart",
    to: "/preview-mobile/panier",
    label: "Panier",
    icon: ShoppingCart,
    matchPrefix: "/preview-mobile/panier",
  },
  {
    key: "account",
    to: "/preview-mobile/compte",
    label: "Compte",
    icon: User,
    matchPrefix: "/preview-mobile/compte",
  },
];

const isActive = (pathname: string, item: Item): boolean => {
  if (item.key === "home") {
    return pathname === "/preview-mobile" || pathname === "/preview-mobile/";
  }
  return Boolean(item.matchPrefix && pathname.startsWith(item.matchPrefix));
};

export function MV5BottomBar() {
  const { pathname } = useLocation();

  return (
    <nav className="mv5-bottombar" aria-label="Navigation principale">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.key}
            to={item.to}
            className={`mv5-bottombar-item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={22} aria-hidden="true" />
            <span className="mv5-bottombar-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
