/**
 * Route : /diagnostic-auto/systeme/$slug
 * Liste des symptomes d'un systeme + regles de securite (R5 DIAGNOSTIC).
 * Source : GET /api/diagnostic-engine/systems/:slug
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
  Shield,
  Wrench,
} from "lucide-react";

import Container from "~/components/layout/Container";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { getDiagnosticColor, getDiagnosticIcon } from "~/lib/diagnostic-icons";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

export const handle = {
  pageRole: createPageRoleMeta(PageRole.R5_DIAGNOSTIC, {
    clusterId: "diagnostic",
    canonicalEntity: "diagnostic-systeme",
  }),
};

interface SystemDetail {
  slug: string;
  label: string;
  description: string | null;
  icon_slug: string | null;
  color_token: string | null;
}

interface SymptomRow {
  slug: string;
  label: string;
  description: string | null;
  urgency: string;
}

interface SafetyRuleRow {
  rule_slug: string;
  condition_description: string;
  risk_flag: string;
  urgency: string | null;
}

interface LoaderData {
  system: SystemDetail | null;
  symptoms: SymptomRow[];
  safety_rules: SafetyRuleRow[];
  error?: string;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const API_URL = process.env.VITE_API_URL || "http://127.0.0.1:3000";
  const slug = params.slug || "";

  try {
    const res = await fetch(
      `${API_URL}/api/diagnostic-engine/systems/${encodeURIComponent(slug)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) {
      return json<LoaderData>(
        {
          system: null,
          symptoms: [],
          safety_rules: [],
          error: `Système non trouvé (${res.status})`,
        },
        { status: res.status },
      );
    }
    const payload = await res.json();
    if (!payload.success) {
      return json<LoaderData>(
        {
          system: null,
          symptoms: [],
          safety_rules: [],
          error: payload.error || "Erreur",
        },
        { status: 404 },
      );
    }
    return json<LoaderData>({
      system: payload.system,
      symptoms: payload.symptoms || [],
      safety_rules: payload.safety_rules || [],
    });
  } catch (error) {
    logger.error("[diagnostic-auto.systeme] loader error", error);
    return json<LoaderData>(
      {
        system: null,
        symptoms: [],
        safety_rules: [],
        error: "Erreur chargement",
      },
      { status: 500 },
    );
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const d = data as LoaderData | undefined;
  const label = d?.system?.label || "Système";
  return [
    { title: `${label} — Diagnostic Auto` },
    {
      name: "description",
      content:
        d?.system?.description ||
        `Symptômes et diagnostics du système ${label}.`,
    },
    { name: "robots", content: "index,follow" },
  ];
};

const URGENCY_COLOR: Record<string, string> = {
  critique: "bg-red-100 text-red-800 border-red-200",
  haute: "bg-orange-100 text-orange-800 border-orange-200",
  moyenne: "bg-amber-100 text-amber-800 border-amber-200",
  basse: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export default function DiagnosticSysteme() {
  const { system, symptoms, safety_rules, error } =
    useLoaderData<typeof loader>();

  if (!system) {
    return (
      <Container className="py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Système introuvable</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Link
          to="/diagnostic-auto"
          className="text-primary hover:underline inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au diagnostic
        </Link>
      </Container>
    );
  }

  const Icon = getDiagnosticIcon(system.icon_slug);
  const color = getDiagnosticColor(system.color_token);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <Container className="py-3">
          <PublicBreadcrumb
            items={[
              { label: "Accueil", href: "/" },
              { label: "Diagnostic Auto", href: "/diagnostic-auto" },
              {
                label: system.label,
                href: `/diagnostic-auto/systeme/${system.slug}`,
              },
            ]}
          />
        </Container>
      </div>

      <Container className="py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div
              className={`h-14 w-14 rounded-xl bg-gradient-to-br ${color.from} ${color.to} flex items-center justify-center`}
            >
              <Icon className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{system.label}</h1>
              {system.description && (
                <p className="text-muted-foreground mt-1 max-w-2xl">
                  {system.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/diagnostic-auto/wizard"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              <Wrench className="h-4 w-4" />
              Diagnostic guidé
            </Link>
            <Link
              to="/diagnostic-auto"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border text-sm font-medium hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
          </div>
        </div>

        {safety_rules.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-bold">Règles de sécurité</h2>
              <Badge variant="outline" className="ml-auto text-xs">
                {safety_rules.length} règle(s)
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {safety_rules.map((r) => (
                <Card
                  key={r.rule_slug}
                  className="p-4 border-red-200 bg-red-50/40"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-red-900">
                        {r.condition_description}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="text-red-700">
                          {r.risk_flag}
                        </Badge>
                        {r.urgency && (
                          <span className="text-red-600">
                            Urgence : {r.urgency}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-bold mb-4">
            Symptômes identifiables ({symptoms.length})
          </h2>
          {symptoms.length === 0 ? (
            <p className="text-muted-foreground">
              Aucun symptôme enregistré pour ce système.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {symptoms.map((s) => {
                const badge = URGENCY_COLOR[s.urgency] || URGENCY_COLOR.moyenne;
                return (
                  <Link
                    key={s.slug}
                    to={`/diagnostic-auto/symptome/${s.slug}`}
                    className="group"
                  >
                    <Card className="h-full p-4 border transition-all hover:shadow-md hover:border-primary/40">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-snug group-hover:text-primary">
                            {s.label}
                          </h3>
                          {s.description && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                              {s.description}
                            </p>
                          )}
                          <div className="mt-2">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded border ${badge}`}
                            >
                              {s.urgency}
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
          )}
        </section>
      </Container>
    </div>
  );
}
