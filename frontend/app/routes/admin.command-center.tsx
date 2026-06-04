/**
 * Admin Command Center — /admin/command-center
 *
 * Read-only cockpit over the AI Operating Map. Loader fetches the backend
 * projection (GET /api/admin/command-center, mirroring admin.control-plane.tsx)
 * which serves the deterministic snapshot + live envelope (stale/validation/
 * global_status/health_score_current). Never throws on a data error — renders a
 * degraded banner so the page is always reachable (the backend already returns
 * 200 + degraded:true when the snapshot file is absent).
 */
import { type LoaderFunctionArgs, json, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { CommandCenterResponse } from "@repo/registry";
import { AlertTriangle, Boxes, GitBranch, FileWarning } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";
import { requireAdmin } from "../auth/unified.server";
import { GlobalHealthBar } from "~/components/command-center/GlobalHealthBar";
import { OwnerActionQueue } from "~/components/command-center/OwnerActionQueue";
import { ModuleGrid } from "~/components/command-center/ModuleGrid";
import { CertBadge } from "~/components/command-center/badges";

export const meta: MetaFunction = () => createNoIndexMeta("Command Center — Admin");

function degraded(reason: string): CommandCenterResponse {
  return {
    degraded: true,
    schema_version: "command-center.v1",
    source_truth: { canon_path: "", last_verified: null },
    summary: {
      departments_total: 0,
      by_priority: { P0: 0, P1: 0, P2: 0, P3: 0 },
      by_state: { live: 0, partial: 0, dormant: 0, broken: 0, duplicate: 0 },
      capabilities_total: 0,
      capabilities_certified: 0,
      capabilities_without_evidence: 0,
      handoffs_total: 0,
      handoffs_incomplete: 0,
    },
    executive_kpis: [],
    departments: [],
    capabilities: [],
    chains: [],
    alerts: [],
    owner_actions: [],
    generated_at: new Date().toISOString(),
    git_sha: null,
    stale_status: "UNKNOWN",
    validation_status: "UNKNOWN",
    global_status: { level: "WARNING", verdict: "BLOCKED", reasons: [reason] },
  };
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireAdmin({ context }); // 401/403 → redirect (auth errors are NOT degraded)

  try {
    const res = await fetch(
      getInternalApiUrlFromRequest("/api/admin/command-center", request),
      { headers: { "Content-Type": "application/json", Cookie: request.headers.get("Cookie") || "" } },
    );
    if (!res.ok) {
      logger.warn(`[command-center] API ${res.status} — rendering degraded`);
      return json(degraded(`backend API ${res.status}`));
    }
    const body = (await res.json()) as { data?: CommandCenterResponse } & CommandCenterResponse;
    // AdminResponseInterceptor wraps as { success, data, meta }.
    return json(body.data ?? (body as CommandCenterResponse));
  } catch (e) {
    logger.error(`[command-center] fetch failed: ${e}`);
    return json(degraded("backend unreachable"));
  }
}

export default function AdminCommandCenter() {
  const data = useLoaderData<typeof loader>() as CommandCenterResponse;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">AI Command Center</h1>
        <p className="text-sm text-muted-foreground">
          Projection lecture-seule de la carte opérationnelle IA — {data.summary.departments_total}{" "}
          départements · {data.summary.capabilities_certified}/{data.summary.capabilities_total} capacités certifiées
        </p>
      </header>

      {data.degraded ? (
        <Alert variant="error" icon={<AlertTriangle className="h-5 w-5" aria-hidden />}>
          <AlertTitle>Command Center indisponible</AlertTitle>
          <AlertDescription>
            {data.global_status.reasons[0] ??
              "Snapshot absent. Générez-le (npm run governance:command-center) puis rechargez."}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <GlobalHealthBar data={data} />

          <Tabs defaultValue="actions">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="actions">Actions</TabsTrigger>
              <TabsTrigger value="departments">Départements</TabsTrigger>
              <TabsTrigger value="handoffs">Handoffs</TabsTrigger>
              <TabsTrigger value="capabilities">Capacités</TabsTrigger>
            </TabsList>

            <TabsContent value="actions" className="mt-4">
              <OwnerActionQueue data={data} />
            </TabsContent>

            <TabsContent value="departments" className="mt-4">
              <ModuleGrid data={data} />
            </TabsContent>

            <TabsContent value="handoffs" className="mt-4">
              <HandoffList data={data} />
            </TabsContent>

            <TabsContent value="capabilities" className="mt-4">
              <CapabilityTable data={data} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function HandoffList({ data }: { data: CommandCenterResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4" aria-hidden /> Chaînes inter-départements (
          {data.summary.handoffs_incomplete}/{data.summary.handoffs_total} incomplètes)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul role="list" className="space-y-2">
          {data.chains.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex items-center gap-2 text-sm">
                <Badge variant="outline">{c.from}</Badge>
                <span aria-hidden>→</span>
                <Badge variant="outline">{c.to}</Badge>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {c.contract_ref ? (
                  <code className="text-xs text-muted-foreground">{c.contract_ref}</code>
                ) : null}
                <Badge variant={c.incomplete ? "warning" : "success"}>{c.state}</Badge>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CapabilityTable({ data }: { data: CommandCenterResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Boxes className="h-4 w-4" aria-hidden /> Capacités ({data.capabilities.length})
          {data.summary.capabilities_without_evidence > 0 ? (
            <Badge variant="warning" className="ml-2">
              <FileWarning className="mr-1 h-3 w-3" aria-hidden />
              {data.summary.capabilities_without_evidence} sans preuve
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* desktop table */}
        <div className="hidden md:block">
          <Table>
            <caption className="sr-only">Capacités et leur certification</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Capacité</TableHead>
                <TableHead scope="col">Département</TableHead>
                <TableHead scope="col">Type</TableHead>
                <TableHead scope="col">Certification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.capabilities.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.id}</TableCell>
                  <TableCell>{c.owner}</TableCell>
                  <TableCell className="text-muted-foreground">{c.type}</TableCell>
                  <TableCell>
                    <CertBadge value={c.certification} />
                    {c.reason ? (
                      <span className="ml-2 text-xs text-muted-foreground">{c.reason}</span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {/* mobile cards */}
        <ul role="list" className="space-y-2 md:hidden">
          {data.capabilities.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{c.id}</p>
                <p className="text-xs text-muted-foreground">
                  {c.owner} · {c.type}
                </p>
              </div>
              <CertBadge value={c.certification} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
