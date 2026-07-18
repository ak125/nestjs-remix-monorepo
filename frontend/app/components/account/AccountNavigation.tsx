import {
  User,
  ShoppingBag,
  MapPin,
  Mail,
  Key,
  Home,
  LogOut,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { Link, useLocation } from "react-router";

import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface SideNavigationProps {
  user: {
    firstName?: string;
    lastName?: string;
    email: string;
    isAdmin?: boolean;
  };
  stats?: {
    orders: { pending: number };
    messages: { unread: number };
  };
}

export function SideNavigation({ user, stats }: SideNavigationProps) {
  const location = useLocation();

  const navigationItems = [
    {
      title: "Vue d'ensemble",
      href: "/account/dashboard",
      icon: Home,
      description: "Tableau de bord principal",
    },
    {
      title: "Mon profil",
      href: "/account/profile",
      icon: User,
      description: "Informations personnelles",
    },
    {
      title: "Mes commandes",
      href: "/account/orders",
      icon: ShoppingBag,
      badge: stats?.orders.pending,
      description: "Suivi de vos commandes",
    },
    {
      title: "Mes adresses",
      href: "/account/addresses",
      icon: MapPin,
      description: "Adresses de livraison et facturation",
    },
    {
      title: "Messages",
      href: "/account/messages",
      icon: Mail,
      badge: stats?.messages.unread,
      description: "Centre de messages",
    },
    {
      title: "SAV / Réclamations",
      href: "/account/claims",
      icon: AlertTriangle,
      description: "Suivi de vos réclamations",
    },
    {
      title: "Sécurité",
      href: "/account/security",
      icon: Key,
      description: "Mot de passe et sécurité",
    },
  ];

  const isActive = (href: string) => {
    if (href === "/account/dashboard") {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen">
      {/* En-tête utilisateur */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-full">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {user.firstName || user.email.split("@")[0]}
            </p>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {navigationItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group",
              isActive(item.href)
                ? "bg-primary/10 text-primary border border-blue-200"
                : "text-gray-700 hover:bg-gray-50 hover:text-gray-900",
            )}
          >
            <item.icon
              className={cn(
                "w-5 h-5 shrink-0",
                isActive(item.href)
                  ? "text-blue-600"
                  : "text-gray-400 group-hover:text-gray-500",
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="truncate">{item.title}</span>
                {item.badge && item.badge > 0 && (
                  <Badge
                    variant={isActive(item.href) ? "default" : "secondary"}
                    className="ml-2 text-xs"
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
              {!isActive(item.href) && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {item.description}
                </p>
              )}
            </div>
            <ChevronRight
              className={cn(
                "w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
                isActive(item.href) && "opacity-100",
              )}
            />
          </Link>
        ))}
      </nav>

      {/* Section actions rapides */}
      <div className="p-4 border-t border-gray-200 mt-6">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Actions rapides
        </h3>
        <div className="space-y-2">
          {/*
           * NO "Nouvelle commande" CTA here.
           *
           * `/orders/new` is intentionally disabled (loader + action return 503)
           * until an authenticated, idempotent, audited order-create use case
           * exists — the real contract (idempotency `order_idempotency` +
           * `create_order_atomic` RPC + resume-token) lives in OrdersController.
           * This nav is rendered by AccountLayout on every /account/* route, so a
           * CTA here put every logged-in customer one click from a bare 503.
           *
           * Do NOT re-add a link to /orders/new until that use case ships.
           * Guarded by frontend/tests/unit/no-orders-new-cta.test.ts.
           */}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            asChild
          >
            <Link to="/account/messages/new">
              <Mail className="w-4 h-4 mr-2" />
              Contacter le support
            </Link>
          </Button>
        </div>
      </div>

      {/* Déconnexion */}
      <div className="p-4 border-t border-gray-200 mt-auto">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          asChild
        >
          <Link to="/logout">
            <LogOut className="w-4 h-4 mr-2" />
            Se déconnecter
          </Link>
        </Button>
      </div>
    </div>
  );
}

// Composant de layout avec navigation
interface AccountLayoutProps {
  children: React.ReactNode;
  user: {
    firstName?: string;
    lastName?: string;
    email: string;
    isAdmin?: boolean;
  };
  stats?: {
    orders: { pending: number };
    messages: { unread: number };
  };
}

export function AccountLayout({ children, user, stats }: AccountLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <SideNavigation user={user} stats={stats} />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
