import { Link } from "@remix-run/react";
import { Wrench, ArrowRight, Calendar } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { type PopularMaintenancePublic } from "./types";

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  moderate: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critique",
  high: "Haute",
  moderate: "Modérée",
  low: "Basse",
};

interface MaintenancePopularGridProps {
  items: PopularMaintenancePublic[];
  title?: string;
}

export function MaintenancePopularGrid({
  items,
  title = "Entretiens populaires",
}: MaintenancePopularGridProps) {
  if (!items.length) return null;

  return (
    <section aria-labelledby="popular-maint-heading">
      <div className="flex items-center gap-2 mb-4">
        <Wrench className="h-5 w-5 text-emerald-600" />
        <h2 id="popular-maint-heading" className="text-xl font-bold">
          {title}
        </h2>
        <Badge variant="outline" className="ml-auto text-xs">
          <Calendar className="h-3 w-3 mr-1" />À intervalles réguliers
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((m) => {
          const sev = m.severity_if_overdue || "low";
          const badgeClass = SEVERITY_BADGE[sev] || SEVERITY_BADGE.low;
          return (
            <Link key={m.slug} to={`/entretien/${m.slug}`} className="group">
              <Card className="h-full p-4 border transition-all hover:shadow-md hover:border-emerald-400">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <Wrench className="h-4 w-4 text-emerald-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm leading-snug group-hover:text-emerald-700 transition-colors">
                      {m.label}
                    </h3>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {m.system_slug}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeClass}`}
                      >
                        {SEVERITY_LABEL[sev] || sev}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-emerald-600 transition-all" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
