/**
 * 🔍 SEO HUB — FINDINGS (Phase 2c)
 *
 * Dashboard des audit findings on-page (table __seo_audit_findings).
 *
 * Consomme les endpoints Phase 2 foundations + Phase 2a' :
 *  - GET  /api/admin/seo-monitoring/audit/findings/summary?type=r_content_gap
 *  - GET  /api/admin/seo-monitoring/audit/findings?type=r_content_gap&limit=200
 *  - POST /api/admin/seo-monitoring/audit/r-content/run
 *
 * Affiche :
 *  - KPI cards par severity (critical/high/medium/low/info)
 *  - Tableau filtrable des findings (par audit_type, severity, gap_type)
 *  - Bouton "Run R-content audit" (trigger manuel)
 *
 * Refs:
 * - ADR-025 (vault) : architecture département SEO
 * - PR #174 : Phase 2 foundations (table + service générique)
 * - PR #176 : Phase 2a' r-content auditor
 */

import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Info,
  Play,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";

// ─── Types miroirs des endpoints backend ─────────────────────────────────

type AuditType =
  | "schema_violation"
  | "image_seo"
  | "canonical_conflict"
  | "meta_experiment"
  | "internal_link_suggestion"
  | "r_content_gap";

type Severity = "critical" | "high" | "medium" | "low" | "info";

interface FindingRow {
  id: string;
  audit_type: AuditType;
  entity_url: string;
  severity: Severity;
  payload: Record<string, unknown>;
  detected_at: string;
  resolved_at: string | null;
  fixed_at: string | null;
}

interface SeveritySummary {
  audit_type: AuditType;
  total: number;
  by_severity: Record<Severity, number>;
}

interface RContentRunResult {
  durationSeconds: number;
  findingsDetected: number;
  findingsInserted: number;
  bySource: Record<string, number>;
  byGapType: Record<string, number>;
}

// ─── Loader ──────────────────────────────────────────────────────────────

export const meta: MetaFunction = () =>
  createNoIndexMeta("Findings SEO - Admin");

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const auditType = (url.searchParams.get("type") ?? "r_content_gap") as AuditType;
  const limitParam = parseInt(url.searchParams.get("limit") ?? "200", 10);
  const limit = Math.min(Math.max(limitParam, 1), 1000);

  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const headers = { Cookie: cookieHeader };

  try {
    const [summaryRes, findingsRes] = await Promise.all([
      fetch(
        `${backendUrl}/api/admin/seo-monitoring/audit/findings/summary?type=${auditType}`,
        { headers },
      ),
      fetch(
        `${backendUrl}/api/admin/seo-monitoring/audit/findings?type=${auditType}&limit=${limit}`,
        { headers },
      ),
    ]);

    const summary: SeveritySummary | null = summaryRes.ok
      ? await summaryRes.json()
      : null;
    const findingsData = findingsRes.ok ? await findingsRes.json() : null;

    return json({
      auditType,
      limit,
      summary,
      findings: ((findingsData?.rows ?? []) as FindingRow[]),
      error: null as string | null,
    });
  } catch (error) {
    logger.error("[SEO Findings] Loader error:", error);
    return json({
      auditType,
      limit,
      summary: null,
      findings: [] as FindingRow[],
      error: "Erreur connexion backend SEO Monitoring",
    });
  }
}

// ─── Action : trigger r-content run ──────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const dryRun = formData.get("dryRun") === "1";

  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    const res = await fetch(
      `${backendUrl}/api/admin/seo-monitoring/audit/r-content/run`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        body: JSON.stringify({ dryRun }),
      },
    );

    if (!res.ok) {
      return json({
        ok: false,
        message: `Backend ${res.status}: ${await res.text()}`,
        result: null as RContentRunResult | null,
      });
    }

    const result: RContentRunResult = await res.json();
    return json({ ok: true, message: null as string | null, result });
  } catch (error) {
    logger.error("[SEO Findings] Action error:", error);
    return json({
      ok: false,
      message:
        error instanceof Error ? error.message : "Erreur trigger audit",
      result: null as RContentRunResult | null,
    });
  }
}

// ─── Component ───────────────────────────────────────────────────────────

export default function SeoHubFindings() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isRunning = navigation.state === "submitting";

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="size-8" />
            Audit Findings SEO
          </h1>
          <p className="text-muted-foreground mt-1">
            Findings on-page detected · audit_type ={" "}
            <code className="text-sm">{data.auditType}</code>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={data.auditType}
            onValueChange={(v) => {
              searchParams.set("type", v);
              setSearchParams(searchParams);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="r_content_gap">R-content gap (Phase 2a')</SelectItem>
              <SelectItem value="schema_violation">Schema violation</SelectItem>
              <SelectItem value="image_seo">Image SEO</SelectItem>
              <SelectItem value="canonical_conflict">Canonical conflict</SelectItem>
              <SelectItem value="meta_experiment">Meta experiment</SelectItem>
              <SelectItem value="internal_link_suggestion">Internal linking</SelectItem>
            </SelectContent>
          </Select>
          <Form method="post">
            <input type="hidden" name="dryRun" value="0" />
            <Button
              type="submit"
              disabled={isRunning || data.auditType !== "r_content_gap"}
              className="gap-2"
            >
              <Play className="size-4" />
              {isRunning ? "Audit en cours…" : "Run R-content audit"}
            </Button>
          </Form>
        </div>
      </header>

      {data.error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Backend indisponible</AlertTitle>
          <AlertDescription>{data.error}</AlertDescription>
        </Alert>
      ) : null}

      {actionData?.ok && actionData.result ? (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertTitle>Audit terminé</AlertTitle>
          <AlertDescription className="space-y-1 text-sm">
            <p>
              <strong>{actionData.result.findingsDetected}</strong> findings
              détectés ·{" "}
              <strong>{actionData.result.findingsInserted}</strong> insérés ·{" "}
              {actionData.result.durationSeconds.toFixed(2)}s
            </p>
            <p className="text-muted-foreground">
              Sources : conseil={actionData.result.bySource.conseil ?? 0} ·
              R6={actionData.result.bySource.purchase_guide ?? 0} ·
              R4={actionData.result.bySource.reference ?? 0} ·
              R7={actionData.result.bySource.brand_editorial ?? 0}
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {actionData && !actionData.ok ? (
        <Alert variant="destructive">
          <XCircle className="size-4" />
          <AlertTitle>Échec audit</AlertTitle>
          <AlertDescription>{actionData.message}</AlertDescription>
        </Alert>
      ) : null}

      {/* KPI cards by severity */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <SeverityKpi
          label="Critical"
          value={data.summary?.by_severity.critical ?? 0}
          tone="red"
          icon={<XCircle className="size-4" />}
        />
        <SeverityKpi
          label="High"
          value={data.summary?.by_severity.high ?? 0}
          tone="orange"
          icon={<AlertTriangle className="size-4" />}
        />
        <SeverityKpi
          label="Medium"
          value={data.summary?.by_severity.medium ?? 0}
          tone="amber"
          icon={<AlertCircle className="size-4" />}
        />
        <SeverityKpi
          label="Low"
          value={data.summary?.by_severity.low ?? 0}
          tone="blue"
          icon={<Info className="size-4" />}
        />
        <SeverityKpi
          label="Total open"
          value={data.summary?.total ?? 0}
          tone="slate"
          icon={<BarChart3 className="size-4" />}
        />
      </div>

      {/* Findings table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Findings open · top {data.limit}
            <span className="text-muted-foreground font-normal ml-2 text-sm">
              ({data.findings.length} chargés)
            </span>
          </CardTitle>
          <CardDescription>
            Triés par detected_at descendant. resolved_at IS NULL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.findings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Detected</TableHead>
                  <TableHead className="w-24">Severity</TableHead>
                  <TableHead className="w-40">Gap type</TableHead>
                  <TableHead>Entity URL</TableHead>
                  <TableHead className="w-48">Source / Field</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.findings.map((f) => {
                  const gapType = (f.payload.gap_type as string) ?? "—";
                  const source = (f.payload.source_table as string) ?? "—";
                  const field =
                    (f.payload.field as string) ??
                    (f.payload.section_type as string) ??
                    "";
                  const contentLen =
                    typeof f.payload.content_length === "number"
                      ? ` (${f.payload.content_length}c)`
                      : "";

                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-xs">
                        {new Date(f.detected_at).toLocaleString("fr-FR")}
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity={f.severity} />
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{gapType}</code>
                        {contentLen ? (
                          <span className="text-muted-foreground text-xs ml-1">
                            {contentLen}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[400px] truncate text-xs">
                        {f.entity_url}
                      </TableCell>
                      <TableCell className="text-xs">
                        <code className="text-muted-foreground">
                          {source.replace("__seo_", "")}
                        </code>
                        {field ? (
                          <span className="ml-1 text-muted-foreground">
                            · {field}
                          </span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BarChart3 className="size-8 mb-2 opacity-30" />
              <p className="text-sm text-center max-w-md">
                Aucun finding pour <code>{data.auditType}</code>.
                {data.auditType === "r_content_gap" ? (
                  <>
                    {" "}
                    Cliquer sur <strong>Run R-content audit</strong> ci-dessus
                    pour scanner les tables R3/R4/R6/R7 (3306 rows).
                  </>
                ) : (
                  <>
                    {" "}
                    Cet auditor n&apos;est pas encore livré (voir Phase 2b/2c
                    roadmap).
                  </>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Helpers UI ──────────────────────────────────────────────────────────

function SeverityKpi({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "red" | "orange" | "amber" | "blue" | "slate";
  icon: React.ReactNode;
}) {
  const toneClass = {
    red: "text-red-600",
    orange: "text-orange-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    slate: "text-slate-700",
  }[tone];

  return (
    <Card>
      <CardContent className="pt-6">
        <div
          className={cn(
            "flex items-center gap-2 text-sm text-muted-foreground",
            toneClass,
          )}
        >
          {icon}
          {label}
        </div>
        <div className={cn("text-2xl font-bold mt-2", toneClass)}>
          {value.toLocaleString("fr-FR")}
        </div>
      </CardContent>
    </Card>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const variant =
    severity === "critical"
      ? "destructive"
      : severity === "high"
        ? "default"
        : "outline";

  const className =
    severity === "high"
      ? "bg-orange-500 hover:bg-orange-600"
      : severity === "medium"
        ? "border-amber-500 text-amber-700"
        : severity === "low"
          ? "border-blue-500 text-blue-700"
          : "";

  return (
    <Badge variant={variant} className={className}>
      {severity}
    </Badge>
  );
}
