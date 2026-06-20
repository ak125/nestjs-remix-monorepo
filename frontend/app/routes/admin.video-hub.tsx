import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Outlet, Link, useLocation, useLoaderData } from "@remix-run/react";
import {
  LayoutDashboard,
  Film,
  Activity,
  FileVideo,
  Image,
  ChevronRight,
  Settings,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

const navItems = [
  {
    label: "Dashboard",
    href: "/admin/video-hub",
    icon: LayoutDashboard,
    description: "Stats productions video",
  },
  {
    label: "Productions",
    href: "/admin/video-hub/productions",
    icon: Film,
    description: "Toutes les productions",
  },
  {
    label: "Executions",
    href: "/admin/video-hub/executions",
    icon: Activity,
    description: "Historique des rendus",
  },
  {
    label: "Templates",
    href: "/admin/video-hub/templates",
    icon: FileVideo,
    description: "Templates versionnes",
  },
  {
    label: "Assets",
    href: "/admin/video-hub/assets",
    icon: Image,
    description: "Visuels valides",
  },
];

export const meta: MetaFunction = () => createNoIndexMeta("Video Hub - Admin");

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    const res = await fetch(`${backendUrl}/api/admin/video/dashboard`, {
      headers: { Cookie: cookieHeader },
    });

    const dashboard = res.ok ? await res.json() : null;

    return json({
      stats: dashboard?.data || null,
      error: null,
    });
  } catch {
    return json({
      stats: null,
      error: "Erreur chargement dashboard video",
    });
  }
}

export default function AdminVideoHubLayout() {
  const { stats } = useLoaderData<typeof loader>();
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === "/admin/video-hub") {
      return location.pathname === "/admin/video-hub";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <Link to="/admin/video-hub" className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-rose-500 to-orange-500 rounded-lg">
              <Film className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Video Hub</h1>
              <p className="text-xs text-gray-500">Gouvernance P6</p>
            </div>
          </Link>

          {/* Quick Stats */}
          {stats && (
            <div className="mt-3 p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Productions</span>
                <span className="font-medium">{stats.total ?? 0}</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  active
                    ? "bg-rose-50 text-rose-700 font-medium"
                    : "text-gray-700 hover:bg-gray-100",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    active ? "text-rose-600" : "text-gray-400",
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="h-4 w-4 text-rose-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <Link
            to="/admin"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <Settings className="h-4 w-4" />
            Retour Admin
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
