import { Link, useLocation } from "@remix-run/react";
import {
  Home,
  ShoppingCart,
  Truck,
  BarChart3,
  Car,
  RotateCcw,
  Menu,
  X,
  LogOut,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import * as React from "react";
import { memo } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "./ui/button";

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

interface CommercialSidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  stats?: {
    totalUsers: number;
    totalOrders: number;
    totalRevenue: number;
    activeUsers: number;
    pendingOrders: number;
    completedOrders: number;
    totalSuppliers: number;
  };
}

export const CommercialSidebar = memo(function CommercialSidebar({
  className,
  stats,
  ...props
}: CommercialSidebarProps) {
  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);

  const navigation = [
    {
      name: "Dashboard",
      href: "/commercial",
      icon: Home,
      description: "Vue d'ensemble",
    },
    {
      name: "Commandes",
      href: "/commercial/orders",
      icon: ShoppingCart,
      description: "Gestion des commandes",
      badge:
        stats?.pendingOrders && stats.pendingOrders > 0
          ? stats.pendingOrders.toString()
          : undefined,
    },
    {
      name: "Exp\u00E9dition",
      href: "/commercial/shipping",
      icon: Truck,
      description: "Suivi des exp\u00E9ditions",
    },
    {
      name: "V\u00E9hicules",
      href: "/commercial/vehicles",
      icon: Car,
      description: "Recherche compatibilit\u00E9",
    },
    {
      name: "Retours",
      href: "/commercial/returns",
      icon: RotateCcw,
      description: "Gestion des retours",
    },
    {
      name: "Rapports",
      href: "/commercial/reports",
      icon: BarChart3,
      description: "Rapports et analyses",
    },
  ];

  const isActive = (href: string) => {
    if (href === "/commercial") {
      return location.pathname === "/commercial";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 z-50 p-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-background"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 transform bg-white border-r border-gray-200 transition-transform duration-200 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          className,
        )}
        {...props}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center border-b border-gray-200 px-4">
            <Link to="/commercial" className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">C</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">
                Commercial
              </span>
            </Link>
          </div>

          {/* Stats Overview */}
          {stats && (
            <div className="border-b border-gray-200 p-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-primary/5 p-2 rounded">
                  <div className="flex items-center space-x-1">
                    <ShoppingCart className="h-3 w-3 text-blue-600" />
                    <span className="text-blue-900 font-medium">Commandes</span>
                  </div>
                  <div className="text-blue-700 font-bold">
                    {stats.totalOrders?.toLocaleString()}
                  </div>
                </div>
                <div className="bg-success/5 p-2 rounded">
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="h-3 w-3 text-green-600" />
                    <span className="text-green-900 font-medium">CA</span>
                  </div>
                  <div className="text-green-700 font-bold">
                    {(stats.totalRevenue / 1000).toFixed(0)}k\u20AC
                  </div>
                </div>
                <div className="bg-orange-50 p-2 rounded">
                  <div className="flex items-center space-x-1">
                    <AlertTriangle className="h-3 w-3 text-orange-600" />
                    <span className="text-orange-900 font-medium">
                      En attente
                    </span>
                  </div>
                  <div className="text-orange-700 font-bold">
                    {stats.pendingOrders}
                  </div>
                </div>
                <div className="bg-green-50 p-2 rounded">
                  <div className="flex items-center space-x-1">
                    <Truck className="h-3 w-3 text-green-600" />
                    <span className="text-green-900 font-medium">
                      Termin\u00E9es
                    </span>
                  </div>
                  <div className="text-green-700 font-bold">
                    {stats.completedOrders?.toLocaleString() || 0}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "group flex items-center justify-between rounded-md px-2 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/15 text-blue-900"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                  )}
                >
                  <div className="flex items-center">
                    <Icon
                      className={cn(
                        "mr-3 h-5 w-5 flex-shrink-0",
                        active
                          ? "text-blue-600"
                          : "text-gray-400 group-hover:text-gray-600",
                      )}
                    />
                    <div>
                      <div className="text-sm">{item.name}</div>
                      <div
                        className={cn(
                          "text-xs",
                          active ? "text-blue-700" : "text-gray-500",
                        )}
                      >
                        {item.description}
                      </div>
                    </div>
                  </div>
                  {item.badge && <Badge variant="error">{item.badge}</Badge>}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-gray-200 p-4">
            <form action="/logout" method="post">
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-start text-gray-700 hover:text-gray-900"
              >
                <LogOut className="mr-2 h-4 w-4" />
                D\u00E9connexion
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
});

export default CommercialSidebar;
