import { Link } from "@remix-run/react";
import { AlertTriangle, ArrowRight, TrendingUp } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { type PopularSymptomPublic } from "./types";

const URGENCY_BADGE: Record<string, string> = {
  critique: "bg-red-100 text-red-800 border-red-200",
  haute: "bg-orange-100 text-orange-800 border-orange-200",
  moyenne: "bg-amber-100 text-amber-800 border-amber-200",
  basse: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

interface PopularSymptomsGridProps {
  items: PopularSymptomPublic[];
  title?: string;
}

export function PopularSymptomsGrid({
  items,
  title = "Diagnostics fréquents",
}: PopularSymptomsGridProps) {
  if (!items.length) return null;

  return (
    <section aria-labelledby="popular-symptoms-heading">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-orange-600" />
        <h2 id="popular-symptoms-heading" className="text-xl font-bold">
          {title}
        </h2>
        <Badge variant="outline" className="ml-auto text-xs">
          D'après les analyses récentes
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((s) => {
          const badgeClass = URGENCY_BADGE[s.urgency] || URGENCY_BADGE.moyenne;
          return (
            <Link
              key={s.slug}
              to={`/diagnostic-auto/symptome/${s.slug}`}
              className="group"
            >
              <Card className="h-full p-4 border transition-all hover:shadow-md hover:border-primary/40">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm leading-snug group-hover:text-primary transition-colors">
                      {s.label}
                    </h3>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {s.system_label}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeClass}`}
                      >
                        {s.urgency}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {s.session_count} analyses
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition-all" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
