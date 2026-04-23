/**
 * Route : /diagnostic-auto/dtc/$code
 * Lookup DTC OBD-II → symptomes correspondants + causes probables.
 * Source : GET /api/diagnostic-engine/dtc/:code
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
  ScanLine,
  Wrench,
} from "lucide-react";

import Container from "~/components/layout/Container";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

export const handle = {
  pageRole: createPageRoleMeta(PageRole.R5_DIAGNOSTIC, {
    clusterId: "diagnostic",
    canonicalEntity: "diagnostic-dtc",
  }),
};

const DTC_RE = /^[PCBU]\d{4}$/i;

interface SymptomRow {
  slug: string;
  label: string;
  description: string | null;
  urgency: string;
  dtc_codes: string[];
}

interface CauseLink {
  cause_id: number;
  relative_score: number;
  evidence_for: string[];
  evidence_against: string[];
  cause?: {
    slug: string;
    label: string;
    cause_type: string;
    description: string | null;
    urgency: string | null;
  };
}

interface LoaderData {
  code: string;
  symptoms: SymptomRow[];
  likely_causes: CauseLink[];
  error?: string;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const API_URL = process.env.VITE_API_URL || "http://127.0.0.1:3000";
  const code = (params.code || "").toUpperCase();

  if (!DTC_RE.test(code)) {
    return json<LoaderData>(
      {
        code,
        symptoms: [],
        likely_causes: [],
        error: "Format DTC invalide. Exemple : P0300, C0035, B1001.",
      },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      `${API_URL}/api/diagnostic-engine/dtc/${encodeURIComponent(code)}`,
      { headers: { Accept: "application/json" } },
    );
    const payload = await res.json();
    if (!payload.success) {
      return json<LoaderData>(
        {
          code,
          symptoms: [],
          likely_causes: [],
          error: payload.error || "Code introuvable",
        },
        { status: 404 },
      );
    }
    return json<LoaderData>({
      code: payload.code || code,
      symptoms: payload.symptoms || [],
      likely_causes: payload.likely_causes || [],
    });
  } catch (error) {
    logger.error("[diagnostic-auto.dtc] loader error", error);
    return json<LoaderData>(
      {
        code,
        symptoms: [],
        likely_causes: [],
        error: "Erreur lors du lookup",
      },
      { status: 500 },
    );
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const d = data as LoaderData | undefined;
  const code = d?.code || "DTC";
  return [
    { title: `Code OBD ${code} — Diagnostic Auto` },
    {
      name: "description",
      content: `Signification du code défaut ${code} : symptômes associés et causes probables.`,
    },
    { name: "robots", content: "index,follow" },
  ];
};

export default function DiagnosticDtc() {
  const { code, symptoms, likely_causes, error } =
    useLoaderData<typeof loader>();

  const notFound = !symptoms.length && !likely_causes.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <Container className="py-3">
          <PublicBreadcrumb
            items={[
              { label: "Accueil", href: "/" },
              { label: "Diagnostic Auto", href: "/diagnostic-auto" },
              {
                label: `Code OBD ${code}`,
                href: `/diagnostic-auto/dtc/${code}`,
              },
            ]}
          />
        </Container>
      </div>

      <Container className="py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <ScanLine className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-xs uppercase font-medium text-purple-700">
                Code OBD-II
              </div>
              <h1 className="text-3xl font-bold font-mono">{code}</h1>
            </div>
          </div>
          {error && (
            <Card className="p-4 border-amber-300 bg-amber-50">
              <div className="flex items-start gap-2 text-sm text-amber-900">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            </Card>
          )}
        </div>

        {notFound ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-6">
              Aucune correspondance catalogée pour le code{" "}
              <strong>{code}</strong>. Lancez le diagnostic guidé pour une
              analyse contextuelle.
            </p>
            <div className="flex justify-center gap-3">
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
          </Card>
        ) : (
          <>
            {symptoms.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xl font-bold mb-4">
                  Symptômes associés ({symptoms.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {symptoms.map((s) => (
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
                            <div className="mt-2 flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">
                                {s.urgency}
                              </Badge>
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition-all" />
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {likely_causes.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4">
                  Causes probables scorées ({likely_causes.length})
                </h2>
                <div className="space-y-3">
                  {likely_causes.map((c, i) => (
                    <Card key={i} className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm mb-1">
                            {c.cause?.label || `Cause #${c.cause_id}`}
                          </h3>
                          {c.cause?.description && (
                            <p className="text-xs text-muted-foreground">
                              {c.cause.description}
                            </p>
                          )}
                          {c.cause?.cause_type && (
                            <Badge
                              variant="secondary"
                              className="mt-2 text-[10px]"
                            >
                              {c.cause.cause_type}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs text-muted-foreground">
                            Score
                          </div>
                          <div className="text-lg font-bold">
                            {c.relative_score}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/diagnostic-auto/wizard"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
              >
                <Wrench className="h-4 w-4" />
                Diagnostic guidé contextuel
              </Link>
              <Link
                to="/diagnostic-auto"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border text-sm font-medium hover:bg-accent"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour au diagnostic
              </Link>
            </div>
          </>
        )}
      </Container>
    </div>
  );
}
