/**
 * Keyword Clusters & Overlaps — Read-only Dashboard
 *
 * /admin/seo-hub/keyword-clusters
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  Layers,
  Tag,
} from "lucide-react";
import { Fragment, useState } from "react";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Keyword Clusters - Admin");

// ── Types ──

interface ClusterRow {
  id: number;
  pg_id: number;
  pg_alias: string;
  primary_keyword: string;
  primary_volume: number;
  primary_intent: string;
  variant_count: number;
  overlap_count: number;
  overlap_flags: Array<{
    overlapping_gamme: string;
    severity: string;
    shared_keywords: string[];
    shared_tokens: string[];
    is_expected?: boolean;
  }>;
  role_count: number;
  role_keywords: Record<string, unknown> | null;
  built_at: string;
  brief_count?: number;
}

interface ClusterStats {
  total_clusters: number;
  total_variants: number;
  with_overlaps: number;
  overlap_high: number;
  overlap_medium: number;
  overlap_low: number;
}

// ── Loader ──

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    const [clustersRes, statsRes] = await Promise.all([
      fetch(`${backendUrl}/api/admin/keyword-clusters`, {
        headers: { Cookie: cookieHeader },
      }),
      fetch(`${backendUrl}/api/admin/keyword-clusters/stats`, {
        headers: { Cookie: cookieHeader },
      }),
    ]);

    const clustersData = clustersRes.ok ? await clustersRes.json() : null;
    const statsData = statsRes.ok ? await statsRes.json() : null;

    return json({
      clusters: (clustersData?.data ?? []) as ClusterRow[],
      stats: (statsData?.data ?? null) as ClusterStats | null,
      error: null,
    });
  } catch (error) {
    return json({
      clusters: [] as ClusterRow[],
      stats: null as ClusterStats | null,
      error: `Erreur chargement: ${error instanceof Error ? error.message : "inconnu"}`,
    });
  }
}

// ── Component ──

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toLowerCase();
  if (s === "high")
    return (
      <Badge variant="destructive" className="text-xs">
        HIGH
      </Badge>
    );
  if (s === "medium")
    return (
      <Badge className="bg-amber-500 text-white text-xs hover:bg-amber-600">
        MEDIUM
      </Badge>
    );
  return (
    <Badge variant="secondary" className="text-xs">
      LOW
    </Badge>
  );
}

function StatsCards({ stats }: { stats: ClusterStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1">
            <Database className="h-4 w-4" />
            Clusters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{stats.total_clusters}</p>
          <p className="text-xs text-muted-foreground">
            {stats.total_variants} variants
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Overlaps HIGH
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-red-600">
            {stats.overlap_high}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Overlaps MEDIUM
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-amber-600">
            {stats.overlap_medium}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1">
            <Layers className="h-4 w-4" />
            Avec overlaps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{stats.with_overlaps}</p>
          <p className="text-xs text-muted-foreground">
            sur {stats.total_clusters}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ExpectedBadge({
  isExpected,
  severity,
}: {
  isExpected?: boolean;
  severity: string;
}) {
  if (isExpected) {
    return (
      <Badge className="bg-green-100 text-green-700 text-xs hover:bg-green-200 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Attendu
      </Badge>
    );
  }
  if (severity.toLowerCase() === "high") {
    return (
      <Badge variant="destructive" className="text-xs gap-1">
        <AlertTriangle className="h-3 w-3" />
        HIGH inattendu
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-700 text-xs hover:bg-amber-200">
      Inattendu
    </Badge>
  );
}

function OverlapDetails({ flags }: { flags: ClusterRow["overlap_flags"] }) {
  if (!flags || flags.length === 0) return null;
  return (
    <div className="pl-8 py-2 space-y-2 bg-gray-50 border-t">
      {flags.map((f, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          <SeverityBadge severity={f.severity} />
          <ExpectedBadge isExpected={f.is_expected} severity={f.severity} />
          <div>
            <span className="font-medium">{f.overlapping_gamme}</span>
            {f.shared_keywords?.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Keywords: {f.shared_keywords.slice(0, 3).join(", ")}
                {f.shared_keywords.length > 3 &&
                  ` (+${f.shared_keywords.length - 3})`}
              </p>
            )}
            {f.shared_tokens?.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Tokens: {f.shared_tokens.join(", ")}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ClusterTable({ clusters }: { clusters: ClusterRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (alias: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(alias)) next.delete(alias);
      else next.add(alias);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Keyword Clusters
        </CardTitle>
        <CardDescription>
          {clusters.length} gammes avec clusters SEO
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Gamme</th>
                <th className="text-left p-3 font-medium">Primary Keyword</th>
                <th className="text-right p-3 font-medium">Volume</th>
                <th className="text-left p-3 font-medium">Intent</th>
                <th className="text-right p-3 font-medium">Variants</th>
                <th className="text-right p-3 font-medium">Roles</th>
                <th className="text-right p-3 font-medium">Overlaps</th>
                <th className="text-right p-3 font-medium">Briefs</th>
                <th className="text-left p-3 font-medium">Built</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((c) => {
                const isExpanded = expanded.has(c.pg_alias);
                const hasOverlaps = c.overlap_count > 0;

                return (
                  <Fragment key={c.pg_alias}>
                    <tr
                      className={`border-b hover:bg-muted/30 ${hasOverlaps ? "cursor-pointer" : ""}`}
                      onClick={() => hasOverlaps && toggle(c.pg_alias)}
                    >
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-1">
                          {hasOverlaps &&
                            (isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ))}
                          {c.pg_alias}
                        </div>
                      </td>
                      <td className="p-3">{c.primary_keyword}</td>
                      <td className="p-3 text-right font-mono">
                        {c.primary_volume?.toLocaleString()}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {c.primary_intent}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">{c.variant_count}</td>
                      <td className="p-3 text-right">{c.role_count}</td>
                      <td className="p-3 text-right">
                        {hasOverlaps ? (
                          <Badge variant="destructive" className="text-xs">
                            {c.overlap_count}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {c.brief_count ?? (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {c.built_at
                          ? new Date(c.built_at).toLocaleDateString("fr-FR")
                          : "-"}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={9}>
                          <OverlapDetails flags={c.overlap_flags} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminKeywordClusters() {
  const { clusters, stats, error } = useLoaderData<typeof loader>();

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Keyword Clusters & Overlaps
        </h1>
        <p className="text-muted-foreground">
          Vue lecture seule des clusters SEO et overlaps cross-gamme
        </p>
      </div>

      {stats && <StatsCards stats={stats} />}

      <ClusterTable clusters={clusters} />
    </div>
  );
}
