/**
 * Route : /entretien
 * Liste publique des operations d'entretien (preventif).
 * Complement de /diagnostic-auto : focus sur l'entretien planifie.
 *
 * Role SEO : R3 - CONSEILS (maintenance preventive)
 */
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { ArrowRight, Calendar, Gauge, Wrench, TrendingUp } from "lucide-react";

import { type MaintenanceOpPublic } from "~/components/diagnostic-public/types";
import Container from "~/components/layout/Container";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { logger } from "~/utils/logger";

interface LoaderData {
  items: MaintenanceOpPublic[];
  error?: string;
}

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

export async function loader(_args: LoaderFunctionArgs) {
  const API_URL = process.env.VITE_API_URL || "http://127.0.0.1:3000";

  try {
    const res = await fetch(
      `${API_URL}/api/diagnostic-engine/maintenance?limit=100`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok)
      return json<LoaderData>({ items: [], error: `HTTP ${res.status}` });
    const payload = await res.json();
    return json<LoaderData>({ items: payload.items || [] });
  } catch (error) {
    logger.error("[entretien._index] loader error", error);
    return json<LoaderData>({ items: [], error: "Erreur chargement" });
  }
}

export const meta: MetaFunction = () => [
  { title: "Entretien automobile — Guide par opération" },
  {
    name: "description",
    content:
      "Calendrier d'entretien automobile : vidange, filtres, plaquettes, courroie. Intervalles, signes d'usure et gravité en cas de retard.",
  },
  { name: "robots", content: "index,follow" },
];

function kmLabel(min: number | null, max: number | null): string {
  if (min && max)
    return `Tous les ${min.toLocaleString()}–${max.toLocaleString()} km`;
  if (min) return `À partir de ${min.toLocaleString()} km`;
  return "";
}

function monthsLabel(min: number | null, max: number | null): string {
  if (min && max) return `ou ${min}–${max} mois`;
  if (min) return `ou ${min} mois`;
  return "";
}

export default function EntretienIndex() {
  const { items, error } = useLoaderData<typeof loader>();

  // Group by severity for quick scanning
  const bySeverity = new Map<string, MaintenanceOpPublic[]>();
  for (const m of items) {
    const key = m.severity_if_overdue || "low";
    if (!bySeverity.has(key)) bySeverity.set(key, []);
    bySeverity.get(key)!.push(m);
  }
  const severityOrder = ["critical", "high", "moderate", "low"];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <Container className="py-3">
          <PublicBreadcrumb
            items={[
              { label: "Accueil", href: "/" },
              { label: "Entretien", href: "/entretien" },
            ]}
          />
        </Container>
      </div>

      <section className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white py-12">
        <Container>
          <div className="flex items-center gap-3 mb-3">
            <Wrench className="h-8 w-8" />
            <h1 className="text-3xl md:text-4xl font-bold">
              Entretien automobile
            </h1>
          </div>
          <p className="text-emerald-50 max-w-2xl">
            Les {items.length} opérations d'entretien qui rallongent la durée de
            vie de votre véhicule. Intervalles constructeur, signes d'usure
            normale et gravité en cas de retard.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/diagnostic-auto"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-white text-emerald-700 text-sm font-medium hover:bg-emerald-50"
            >
              <TrendingUp className="h-4 w-4" />
              Plutôt un diagnostic ?
            </Link>
          </div>
        </Container>
      </section>

      <Container className="py-8">
        {error && (
          <Card className="p-4 mb-6 border-red-200 bg-red-50 text-sm text-red-900">
            Impossible de charger la liste : {error}
          </Card>
        )}

        {severityOrder.map((sev) => {
          const rows = bySeverity.get(sev);
          if (!rows?.length) return null;
          const badgeClass = SEVERITY_BADGE[sev] || SEVERITY_BADGE.low;
          return (
            <section key={sev} className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-xl font-bold">
                  Gravité si négligé : {SEVERITY_LABEL[sev] || sev}
                </h2>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeClass}`}
                >
                  {rows.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {rows.map((m) => (
                  <Link
                    key={m.slug}
                    to={`/entretien/${m.slug}`}
                    className="group"
                  >
                    <Card className="h-full p-4 border transition-all hover:shadow-md hover:border-emerald-400">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                          <Wrench className="h-4 w-4 text-emerald-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-snug group-hover:text-emerald-700">
                            {m.label}
                          </h3>
                          {m.description && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                              {m.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                            {m.interval_km_min && (
                              <span className="inline-flex items-center gap-1">
                                <Gauge className="h-3 w-3" />
                                {kmLabel(m.interval_km_min, m.interval_km_max)}
                              </span>
                            )}
                            {m.interval_months_min && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {monthsLabel(
                                  m.interval_months_min,
                                  m.interval_months_max,
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-emerald-600 transition-all" />
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        {items.length === 0 && !error && (
          <Card className="p-8 text-center">
            <Badge variant="outline" className="mb-3">
              Aucune opération
            </Badge>
            <p className="text-muted-foreground">
              Aucune opération d'entretien disponible pour l'instant.
            </p>
          </Card>
        )}
      </Container>
    </div>
  );
}
