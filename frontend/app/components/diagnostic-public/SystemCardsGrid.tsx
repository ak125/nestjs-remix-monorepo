import { Link } from "@remix-run/react";
import { ChevronRight } from "lucide-react";
import { Card } from "~/components/ui/card";
import { getDiagnosticIcon, getDiagnosticColor } from "~/lib/diagnostic-icons";
import { type DiagSystemPublic } from "./types";

interface SystemCardsGridProps {
  systems: DiagSystemPublic[];
}

export function SystemCardsGrid({ systems }: SystemCardsGridProps) {
  if (!systems.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Aucun système disponible. Vérifiez la configuration DB.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {systems.map((s) => {
        const Icon = getDiagnosticIcon(s.icon_slug);
        const color = getDiagnosticColor(s.color_token);
        return (
          <Link
            key={s.slug}
            to={`/diagnostic-auto/systeme/${s.slug}`}
            className="group block"
            aria-label={`Diagnostic ${s.label}`}
          >
            <Card
              className={`h-full p-5 border-2 transition-all hover:shadow-lg ${color.border}`}
            >
              <div
                className={`h-11 w-11 rounded-lg bg-gradient-to-br ${color.from} ${color.to} flex items-center justify-center mb-3`}
              >
                <Icon className="h-6 w-6 text-white" />
              </div>
              <h3 className={`font-semibold text-base mb-1 ${color.text}`}>
                {s.label}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {s.description || "Diagnostic système automobile"}
              </p>
              <div
                className={`mt-3 flex items-center text-xs font-medium ${color.text} group-hover:translate-x-1 transition-transform`}
              >
                Voir symptômes
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
