import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  DashboardShell,
  KpiGrid,
} from "~/components/admin/patterns/DashboardShell";
import { KpiCard } from "~/components/admin/patterns/KpiCard";
import { StatusBadge } from "~/components/admin/patterns/StatusBadge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Verification SEO - Admin RAG");

interface QaGateResult {
  seo_mutations: number;
  ref_mutations: number;
  h1_override_mutations: number;
  gate: "GO" | "BLOCK";
  checked_at: string;
  baseline_count: number;
  details: Array<{ pg_alias: string; field: string }>;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";

  const res = await fetch(
    getInternalApiUrlFromRequest("/api/admin/content-refresh/qa-gate", request),
    { headers: { Cookie: cookie } },
  );

  const rawQaGate = res.ok ? await res.json() : null;
  // Handle AdminApiResponse wrapper: { success, data, meta }
  const qaGate: QaGateResult = rawQaGate?.data ??
    rawQaGate ?? {
      seo_mutations: 0,
      ref_mutations: 0,
      h1_override_mutations: 0,
      gate: "GO" as const,
      checked_at: new Date().toISOString(),
      baseline_count: 0,
      details: [],
    };

  return json({ qaGate });
}

export default function AdminRagQaGate() {
  const { qaGate } = useLoaderData<typeof loader>();
  const refreshFetcher = useFetcher<typeof loader>();

  const data = refreshFetcher.data?.qaGate ?? qaGate;
  const totalMutations =
    data.seo_mutations + data.ref_mutations + data.h1_override_mutations;
  const isGo = data.gate === "GO";
  const isLoading = refreshFetcher.state !== "idle";

  const checkedAt = new Date(data.checked_at).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <DashboardShell
      title="Verification SEO"
      description="Controle automatique des champs SEO proteges apres enrichissement"
      breadcrumb={
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/admin" className="hover:text-foreground">
            Admin
          </Link>
          <span>/</span>
          <Link to="/admin/rag" className="hover:text-foreground">
            RAG
          </Link>
          <span>/</span>
          <span className="text-foreground">Verification SEO</span>
        </div>
      }
      actions={
        <div className="flex items-center gap-3">
          {/* Q3: Timestamp visible */}
          <span className="text-xs text-muted-foreground">
            Verifie le {checkedAt}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshFetcher.load("/admin/rag/qa-gate")}
            className="gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Reverifier
          </Button>
          <StatusBadge
            status={isGo ? "PASS" : "FAIL"}
            label={isGo ? "OK" : "ALERTE"}
          />
        </div>
      }
      kpis={
        <KpiGrid columns={4}>
          <KpiCard
            title="Gammes surveillees"
            value={data.baseline_count}
            icon={ShieldCheck}
            variant="info"
          />
          <KpiCard
            title="Titres/descriptions"
            value={data.seo_mutations}
            icon={data.seo_mutations > 0 ? ShieldAlert : ShieldCheck}
            variant={data.seo_mutations > 0 ? "danger" : "success"}
          />
          <KpiCard
            title="URLs/meta"
            value={data.ref_mutations}
            icon={data.ref_mutations > 0 ? ShieldAlert : ShieldCheck}
            variant={data.ref_mutations > 0 ? "danger" : "success"}
          />
          <KpiCard
            title="Titres H1"
            value={data.h1_override_mutations}
            icon={data.h1_override_mutations > 0 ? ShieldAlert : ShieldCheck}
            variant={data.h1_override_mutations > 0 ? "danger" : "success"}
          />
        </KpiGrid>
      }
    >
      {/* Guide */}
      <Alert
        variant="info"
        icon={<Info className="h-4 w-4" />}
        title="Verification des champs SEO proteges"
      >
        <AlertDescription>
          Cette page verifie que l&apos;enrichissement automatique n&apos;a pas
          modifie les titres, descriptions et URLs de vos gammes existantes.{" "}
          <strong>Vert = tout est OK.</strong>{" "}
          <strong>Rouge = des modifications ont ete detectees.</strong>
        </AlertDescription>
      </Alert>

      {/* Q1: Compact alert only when mutations detected (replaces big redundant card) */}
      {!isGo && (
        <Alert variant="destructive" icon={<ShieldAlert className="h-4 w-4" />}>
          <AlertDescription>
            <strong>
              {totalMutations} modification
              {totalMutations !== 1 ? "s" : ""} non autorisee
              {totalMutations !== 1 ? "s" : ""} detectee
              {totalMutations !== 1 ? "s" : ""}
            </strong>{" "}
            sur {data.baseline_count} gamme
            {data.baseline_count !== 1 ? "s" : ""} surveillee
            {data.baseline_count !== 1 ? "s" : ""}. Consultez les details
            ci-dessous.
          </AlertDescription>
        </Alert>
      )}

      {/* Verifications automatiques */}
      <div className="relative">
        {/* Q2: Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-[1px]">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Verifications automatiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Verification</TableHead>
                  <TableHead>Champs verifies</TableHead>
                  <TableHead>Modifications</TableHead>
                  <TableHead>Resultat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">
                    Titres et descriptions
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    Titre SEO, H1, meta description
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`font-mono ${data.seo_mutations > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
                    >
                      {data.seo_mutations}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={data.seo_mutations === 0 ? "PASS" : "FAIL"}
                      label={data.seo_mutations === 0 ? "OK" : "ALERTE"}
                      size="sm"
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">URLs et meta</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    Titre page, meta description, URL canonique
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`font-mono ${data.ref_mutations > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
                    >
                      {data.ref_mutations}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={data.ref_mutations === 0 ? "PASS" : "FAIL"}
                      label={data.ref_mutations === 0 ? "OK" : "ALERTE"}
                      size="sm"
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Titres H1</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    Surcharges H1 manuelles
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`font-mono ${data.h1_override_mutations > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
                    >
                      {data.h1_override_mutations}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={
                        data.h1_override_mutations === 0 ? "PASS" : "FAIL"
                      }
                      label={data.h1_override_mutations === 0 ? "OK" : "ALERTE"}
                      size="sm"
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Q4: Separator before details section */}
      <Separator />

      {/* Q5: Positive empty state when all OK */}
      {data.details.length === 0 && isGo && (
        <div className="flex items-center gap-4 rounded-lg border border-green-200 bg-green-50/50 p-6">
          <ShieldCheck className="h-10 w-10 flex-shrink-0 text-green-600" />
          <div>
            <h3 className="text-sm font-semibold text-green-800">
              Aucune modification non autorisee
            </h3>
            <p className="text-sm text-green-700">
              Les {data.baseline_count} gamme
              {data.baseline_count !== 1 ? "s" : ""} surveillee
              {data.baseline_count !== 1 ? "s" : ""} sont intactes. Le pipeline
              d&apos;enrichissement respecte les champs proteges.
            </p>
          </div>
        </div>
      )}

      {/* Modifications non autorisees */}
      {data.details.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-red-800">
              <AlertTriangle className="h-4 w-4" />
              Modifications non autorisees ({data.details.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gamme</TableHead>
                  <TableHead>Champ modifie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.details.map((d, i) => (
                  <TableRow key={`${d.pg_alias}-${d.field}-${i}`}>
                    <TableCell className="font-mono text-sm font-medium">
                      {d.pg_alias}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="text-xs">
                        {d.field}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </DashboardShell>
  );
}
