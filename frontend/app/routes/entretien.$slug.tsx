/**
 * Route : /entretien/$slug
 * Detail d'une operation d'entretien (R3 CONSEILS preventif).
 * Source : GET /api/diagnostic-engine/maintenance/:slug
 */
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Gauge,
  ShoppingCart,
  Wrench,
} from "lucide-react";

import Container from "~/components/layout/Container";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { logger } from "~/utils/logger";

interface MaintenanceOp {
  slug: string;
  label: string;
  description: string | null;
  system_id: number;
  interval_km_min: number | null;
  interval_km_max: number | null;
  interval_months_min: number | null;
  interval_months_max: number | null;
  severity_if_overdue: string | null;
  normal_wear_km_min: number | null;
  normal_wear_km_max: number | null;
  related_gamme_slug: string | null;
  related_pg_id: number | null;
}

interface LinkedSymptom {
  slug: string;
  label: string;
  urgency: string;
}

interface LoaderData {
  operation: MaintenanceOp | null;
  linked_symptoms: LinkedSymptom[];
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

export async function loader({ params }: LoaderFunctionArgs) {
  const API_URL = process.env.VITE_API_URL || "http://127.0.0.1:3000";
  const slug = params.slug || "";

  try {
    const res = await fetch(
      `${API_URL}/api/diagnostic-engine/maintenance/${encodeURIComponent(slug)}`,
      { headers: { Accept: "application/json" } },
    );
    const payload = await res.json();
    if (!payload.success) {
      return json<LoaderData>(
        {
          operation: null,
          linked_symptoms: [],
          error: payload.error || "Opération introuvable",
        },
        { status: 404 },
      );
    }
    return json<LoaderData>({
      operation: payload.operation,
      linked_symptoms: payload.linked_symptoms || [],
    });
  } catch (error) {
    logger.error("[entretien.$slug] loader error", error);
    return json<LoaderData>(
      {
        operation: null,
        linked_symptoms: [],
        error: "Erreur chargement",
      },
      { status: 500 },
    );
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const d = data as LoaderData | undefined;
  const label = d?.operation?.label || "Entretien";
  return [
    { title: `${label} — Guide d'entretien auto` },
    {
      name: "description",
      content:
        d?.operation?.description ||
        `Guide complet : ${label}. Intervalle conseillé, signes d'usure, gravité en cas de retard.`,
    },
    { name: "robots", content: "index,follow" },
  ];
};

export default function EntretienDetail() {
  const { operation, linked_symptoms, error } = useLoaderData<typeof loader>();

  if (!operation) {
    return (
      <Container className="py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Opération introuvable</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Link
          to="/entretien"
          className="text-primary hover:underline inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux entretiens
        </Link>
      </Container>
    );
  }

  const severity = operation.severity_if_overdue || "low";
  const badgeClass = SEVERITY_BADGE[severity] || SEVERITY_BADGE.low;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <Container className="py-3">
          <PublicBreadcrumb
            items={[
              { label: "Accueil", href: "/" },
              { label: "Entretien", href: "/entretien" },
              { label: operation.label, href: `/entretien/${operation.slug}` },
            ]}
          />
        </Container>
      </div>

      <Container className="py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Wrench className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-xs uppercase font-medium text-emerald-700">
                Entretien préventif
              </div>
              <h1 className="text-3xl font-bold">{operation.label}</h1>
            </div>
          </div>
          {operation.description && (
            <p className="text-muted-foreground max-w-3xl">
              {operation.description}
            </p>
          )}
          <div className="mt-4">
            <span
              className={`text-xs px-2 py-1 rounded border ${badgeClass} font-medium`}
            >
              Gravité si retard : {SEVERITY_LABEL[severity] || severity}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {(operation.interval_km_min || operation.interval_km_max) && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="h-4 w-4 text-emerald-600" />
                <h2 className="font-semibold text-sm">
                  Intervalle kilométrique
                </h2>
              </div>
              <p className="text-2xl font-bold">
                {operation.interval_km_min?.toLocaleString() || "?"}
                {operation.interval_km_max
                  ? `–${operation.interval_km_max.toLocaleString()}`
                  : ""}{" "}
                km
              </p>
              {operation.normal_wear_km_min && (
                <p className="text-xs text-muted-foreground mt-2">
                  Usure normale observée :{" "}
                  {operation.normal_wear_km_min.toLocaleString()}
                  {operation.normal_wear_km_max
                    ? `–${operation.normal_wear_km_max.toLocaleString()}`
                    : ""}{" "}
                  km
                </p>
              )}
            </Card>
          )}

          {(operation.interval_months_min || operation.interval_months_max) && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <h2 className="font-semibold text-sm">Intervalle temporel</h2>
              </div>
              <p className="text-2xl font-bold">
                {operation.interval_months_min || "?"}
                {operation.interval_months_max
                  ? `–${operation.interval_months_max}`
                  : ""}{" "}
                mois
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Applicable au premier des deux seuils atteint.
              </p>
            </Card>
          )}
        </div>

        {linked_symptoms.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Symptômes qui déclenchent cet entretien
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {linked_symptoms.map((s) => (
                <Link
                  key={s.slug}
                  to={`/diagnostic-auto/symptome/${s.slug}`}
                  className="group"
                >
                  <Card className="h-full p-4 border transition-all hover:shadow-md hover:border-amber-400">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm group-hover:text-amber-700">
                          {s.label}
                        </h3>
                        <Badge variant="outline" className="mt-1.5 text-[10px]">
                          {s.urgency}
                        </Badge>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-3">
          {operation.related_gamme_slug && (
            <Link
              to={`/pieces/${operation.related_gamme_slug}`}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              <ShoppingCart className="h-4 w-4" />
              Voir les pièces
            </Link>
          )}
          <Link
            to="/entretien"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md border text-sm font-medium hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux entretiens
          </Link>
          <Link
            to="/diagnostic-auto"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md border text-sm font-medium hover:bg-accent"
          >
            Diagnostic auto
          </Link>
        </div>
      </Container>
    </div>
  );
}
