import { Outlet, Link, useLocation } from "@remix-run/react";
import { Megaphone, BarChart3, Link2, Map } from "lucide-react";

export default function MarketingLayout() {
  const location = useLocation();

  const tabs = [
    { name: "Dashboard", href: "/admin/marketing", icon: BarChart3 },
    { name: "Backlinks", href: "/admin/marketing/backlinks", icon: Link2 },
    {
      name: "Content Roadmap",
      href: "/admin/marketing/content-roadmap",
      icon: Map,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Megaphone className="h-8 w-8 text-purple-600" />
        <div>
          <h1 className="text-2xl font-bold">Marketing</h1>
          <p className="text-sm text-muted-foreground">
            Backlinks, contenu et KPIs SEO
          </p>
        </div>
      </div>

      <nav className="flex gap-2 border-b pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.href;
          return (
            <Link
              key={tab.href}
              to={tab.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white border border-b-0 border-gray-200 text-purple-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.name}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
