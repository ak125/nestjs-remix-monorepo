/**
 * Route : /diagnostic-auto/symptome/$slug
 * Page canonical d'un symptome (R5 DIAGNOSTIC) : causes scorees + regles securite.
 * Source : GET /api/diagnostic-engine/symptoms/:slug
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
  CheckCircle2,
  ShieldAlert,
  Target,
  Wrench,
  XCircle,
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
    canonicalEntity: "diagnostic-symptome",
  }),
};

interface SymptomRow {
  slug: string;
  label: string;
  description: string | null;
  urgency: string;
  signal_mode: string;
  synonyms: string[];
  dtc_codes: string[];
}

interface SystemRow {
  slug: string;
  label: string;
  icon_slug: string | null;
  color_token: string | null;
}

interface CauseRow {
  slug: string;
  label: string;
  cause_type: string;
  description: string | null;
  verification_method: string | null;
  urgency: string | null;
  relative_score: number;
  evidence_for: string[];
  evidence_against: string[];
  requires_verification: boolean;
}

interface SafetyRuleRow {
  rule_slug: string;
  condition_description: string;
  risk_flag: string;
  urgency: string | null;
}

interface MaintenanceOpRow {
  slug: string;
  label: string;
  severity_if_overdue: string | null;
  interval_km_min: number | null;
  interval_km_max: number | null;
}

interface LoaderData {
  symptom: SymptomRow | null;
  system: SystemRow | null;
  causes: CauseRow[];
  safety_rules: SafetyRuleRow[];
  maintenance_ops: MaintenanceOpRow[];
  error?: string;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const API_URL = process.env.VITE_API_URL || "http://127.0.0.1:3000";
  const slug = params.slug || "";

  try {
    const res = await fetch(
      `${API_URL}/api/diagnostic-engine/symptoms/${encodeURIComponent(slug)}`,
      { headers: { Accept: "application/json" } },
    );
    const payload = await res.json();
    if (!payload.success) {
      return json<LoaderData>(
        {
          symptom: null,
          system: null,
          causes: [],
          safety_rules: [],
          maintenance_ops: [],
          error: payload.error || "Symptôme introuvable",
        },
        { status: 404 },
      );
    }
    return json<LoaderData>({
      symptom: payload.symptom,
      system: payload.system,
      causes: payload.causes || [],
      safety_rules: payload.safety_rules || [],
      maintenance_ops: payload.maintenance_ops || [],
    });
  } catch (error) {
    logger.error("[diagnostic-auto.symptome] loader error", error);
    return json<LoaderData>(
      {
        symptom: null,
        system: null,
        causes: [],
        safety_rules: [],
        maintenance_ops: [],
        error: "Erreur chargement",
      },
      { status: 500 },
    );
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const d = data as LoaderData | undefined;
  const label = d?.symptom?.label || "Symptôme";
  return [
    { title: `${label} — Diagnostic Auto` },
    {
      name: "description",
      content:
        d?.symptom?.description ||
        `Causes possibles et vérifications pour le symptôme : ${label}.`,
    },
    { name: "robots", content: "index,follow" },
  ];
};

const CAUSE_TYPE_LABEL: Record<string, string> = {
  part_failure: "Panne pièce",
  wear: "Usure normale",
  maintenance: "Entretien requis",
  electrical: "Défaut électrique",
};

function scoreBarColor(score: number) {
  if (score >= 70) return "bg-red-500";
  if (score >= 50) return "bg-orange-500";
  if (score >= 30) return "bg-amber-500";
  return "bg-slate-400";
}

export default function DiagnosticSymptome() {
  const { symptom, system, causes, safety_rules, maintenance_ops, error } =
    useLoaderData<typeof loader>();

  if (!symptom) {
    return (
      <Container className="py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Symptôme introuvable</h1>
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

  const SystemIcon = getDiagnosticIcon(system?.icon_slug);
  const color = getDiagnosticColor(system?.color_token);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <Container className="py-3">
          <PublicBreadcrumb
            items={[
              { label: "Accueil", href: "/" },
              { label: "Diagnostic Auto", href: "/diagnostic-auto" },
              system
                ? {
                    label: system.label,
                    href: `/diagnostic-auto/systeme/${system.slug}`,
                  }
                : null,
              {
                label: symptom.label,
                href: `/diagnostic-auto/symptome/${symptom.slug}`,
              },
            ].filter((x): x is { label: string; href: string } => x !== null)}
          />
        </Container>
      </div>

      <Container className="py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            {system && (
              <Link
                to={`/diagnostic-auto/systeme/${system.slug}`}
                className={`inline-flex items-center gap-1.5 text-xs font-medium uppercase ${color.text} hover:underline`}
              >
                <SystemIcon className="h-3.5 w-3.5" />
                {system.label}
              </Link>
            )}
            <Badge variant="outline" className="text-xs">
              Urgence : {symptom.urgency}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold mb-3">{symptom.label}</h1>
          {symptom.description && (
            <p className="text-muted-foreground max-w-3xl">
              {symptom.description}
            </p>
          )}
          {symptom.dtc_codes?.length > 0 && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">
                Codes OBD associés :
              </span>
              {symptom.dtc_codes.map((c) => (
                <Link
                  key={c}
                  to={`/diagnostic-auto/dtc/${c}`}
                  className="font-mono text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 hover:bg-purple-200"
                >
                  {c}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/diagnostic-auto/wizard"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              <Wrench className="h-4 w-4" />
              Lancer un diagnostic guidé
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
          <Card className="p-4 mb-8 border-red-200 bg-red-50/60">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-red-900 mb-2">
                  Sécurité — attention
                </h2>
                <ul className="space-y-1 text-sm text-red-800">
                  {safety_rules.slice(0, 4).map((r) => (
                    <li key={r.rule_slug} className="flex gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{r.condition_description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}

        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Causes probables ({causes.length})
          </h2>
          {causes.length === 0 ? (
            <p className="text-muted-foreground">
              Aucune cause cataloguée pour ce symptôme. Lancez le diagnostic
              guidé pour une analyse personnalisée.
            </p>
          ) : (
            <div className="space-y-3">
              {causes.map((c) => (
                <Card key={c.slug} className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">
                          {CAUSE_TYPE_LABEL[c.cause_type] || c.cause_type}
                        </Badge>
                        {c.urgency && (
                          <Badge variant="outline" className="text-xs">
                            Urgence : {c.urgency}
                          </Badge>
                        )}
                        {c.requires_verification && (
                          <Badge className="text-xs bg-amber-100 text-amber-900 border-amber-200">
                            Vérification requise
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-base">{c.label}</h3>
                      {c.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {c.description}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 w-32 text-right">
                      <div className="text-xs text-muted-foreground mb-1">
                        Score
                      </div>
                      <div className="text-xl font-bold">
                        {c.relative_score}
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${scoreBarColor(c.relative_score)}`}
                          style={{
                            width: `${Math.min(100, Math.max(0, c.relative_score))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {c.verification_method && (
                    <div className="mt-3 text-sm">
                      <span className="font-medium">Vérification : </span>
                      <span className="text-muted-foreground">
                        {c.verification_method}
                      </span>
                    </div>
                  )}

                  {(c.evidence_for?.length > 0 ||
                    c.evidence_against?.length > 0) && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {c.evidence_for?.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Éléments en faveur
                          </div>
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            {c.evidence_for.map((e, i) => (
                              <li key={i} className="flex gap-1.5">
                                <span>•</span>
                                <span>{e}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {c.evidence_against?.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                            <XCircle className="h-3.5 w-3.5" />
                            Éléments contre
                          </div>
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            {c.evidence_against.map((e, i) => (
                              <li key={i} className="flex gap-1.5">
                                <span>•</span>
                                <span>{e}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>

        {maintenance_ops.length > 0 && (
          <section className="mt-10" aria-labelledby="maint-heading">
            <h2
              id="maint-heading"
              className="text-xl font-bold mb-4 flex items-center gap-2"
            >
              <Wrench className="h-5 w-5 text-emerald-600" />
              Entretien préventif lié ({maintenance_ops.length})
            </h2>
            <p className="text-sm text-muted-foreground mb-4 max-w-3xl">
              Ces opérations d'entretien préviennent ou traitent souvent ce
              symptôme. À vérifier en priorité si elles sont en retard.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {maintenance_ops.map((m) => (
                <Link
                  key={m.slug}
                  to={`/entretien/${m.slug}`}
                  className="group"
                >
                  <Card className="h-full p-4 border transition-all hover:shadow-md hover:border-emerald-400">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                        <Wrench className="h-4 w-4 text-emerald-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm group-hover:text-emerald-700">
                          {m.label}
                        </h3>
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          {m.interval_km_min && (
                            <span>
                              Tous les {m.interval_km_min.toLocaleString()}
                              {m.interval_km_max
                                ? `–${m.interval_km_max.toLocaleString()}`
                                : ""}{" "}
                              km
                            </span>
                          )}
                          {m.severity_if_overdue && (
                            <Badge variant="outline" className="text-[10px]">
                              {m.severity_if_overdue}
                            </Badge>
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
        )}
      </Container>
    </div>
  );
}
