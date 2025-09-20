// app/routes/pro.orders.tsx
// Layout pour toutes les pages de gestion des commandes professionnelles

import { Outlet, Link, useLocation } from "@remix-run/react";
import { 
  Package, 
  Plus, 
  BarChart3,
  Download,
  Settings
} from "lucide-react";

export default function ProOrdersLayout() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const navItems = [
    { 
      path: "/pro/orders", 
      label: "📋 Toutes les commandes", 
      icon: Package,
      exact: true 
    },
    { 
      path: "/pro/orders/new", 
      label: "➕ Nouvelle commande",
      icon: Plus
    },
    { 
      path: "/pro/orders/analytics", 
      label: "📊 Analytics",
      icon: BarChart3
    },
    { 
      path: "/pro/orders/export", 
      label: "📥 Export & Rapports",
      icon: Download
    },
    { 
      path: "/pro/orders/settings", 
      label: "⚙️ Configuration",
      icon: Settings
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation secondaire */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    isActive(item.path)
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
