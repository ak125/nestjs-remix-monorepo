import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  CheckCircle2,
  XCircle,
  Search,
  TrendingUp,
  AlertTriangle,
  Database,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
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
import { getInternalApiUrl } from "~/utils/internal-api.server";

// Types Section K
interface SectionKMetrics {
  pg_id: number;
  gamme_name: string;
  catalog_valid: number;
  covered_v2v3: number;
  expected_v4: number;
  actual_v4: number;
  missing: number;
  extras: number;
  status: "CONFORME" | "NON_CONFORME";
}

interface SectionKKpis {
  total: number;
  conformes: number;
  nonConformes: number;
  coverageGlobal: string;
}

interface LoaderData {
  metrics: SectionKMetrics[];
  kpis: SectionKKpis;
}

export const meta: MetaFunction = () => {
  return [
    { title: "Conformité V-Level Section K | Admin" },
    { name: "description", content: "Dashboard conformité V-Level Section K" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const apiUrl = getInternalApiUrl("");

  try {
    const response = await fetch(
      `${apiUrl}/api/admin/gammes-seo/section-k/metrics`,
      {
        headers: {
          Cookie: request.headers.get("Cookie") || "",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: LoaderData = await response.json();
    return json(data);
  } catch (error) {
    console.error("Section K loader error:", error);
    // Retourner des données vides en cas d'erreur
    return json({
      metrics: [],
      kpis: { total: 0, conformes: 0, nonConformes: 0, coverageGlobal: "0.0" },
    });
  }
}

export default function AdminVLevelConformite() {
  const { metrics, kpis } = useLoaderData<LoaderData>();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "CONFORME" | "NON_CONFORME"
  >("all");

  // Filtrage des métriques
  const filteredMetrics = useMemo(() => {
    return metrics.filter((m) => {
      const matchesSearch =
        m.gamme_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.pg_id.toString().includes(searchTerm);
      const matchesStatus = statusFilter === "all" || m.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [metrics, searchTerm, statusFilter]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Conformité V-Level - Section K
          </h1>
          <p className="text-muted-foreground">
            STATUS = (missing = 0 AND extras = 0) → CONFORME
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Gammes Auditées
            </CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conformes</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {kpis.conformes}
            </div>
            <p className="text-xs text-muted-foreground">
              {kpis.total > 0
                ? ((kpis.conformes / kpis.total) * 100).toFixed(1)
                : 0}
              %
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Non-Conformes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {kpis.nonConformes}
            </div>
            <p className="text-xs text-muted-foreground">
              {kpis.total > 0
                ? ((kpis.nonConformes / kpis.total) * 100).toFixed(1)
                : 0}
              %
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Couverture Globale
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {kpis.coverageGlobal}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as "all" | "CONFORME" | "NON_CONFORME")
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="CONFORME">Conformes</SelectItem>
                <SelectItem value="NON_CONFORME">Non-Conformes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Métriques Section K ({filteredMetrics.length} gammes)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">ID</TableHead>
                  <TableHead>Gamme</TableHead>
                  <TableHead className="text-right">T-A: catalog</TableHead>
                  <TableHead className="text-right">T-B: covered</TableHead>
                  <TableHead className="text-right">T-C: expected</TableHead>
                  <TableHead className="text-right">T-D: actual</TableHead>
                  <TableHead className="text-right">T-E: missing</TableHead>
                  <TableHead className="text-right">T-F: extras</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMetrics.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground py-8"
                    >
                      Aucune gamme trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMetrics.map((m) => (
                    <TableRow
                      key={m.pg_id}
                      className={
                        m.status === "NON_CONFORME" ? "bg-red-50/50" : ""
                      }
                    >
                      <TableCell className="font-mono text-sm">
                        {m.pg_id}
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/admin/gammes-seo/${m.pg_id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {m.gamme_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {m.catalog_valid.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {m.covered_v2v3.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {m.expected_v4.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {m.actual_v4.toLocaleString()}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${m.missing > 0 ? "text-red-600 font-bold" : ""}`}
                      >
                        {m.missing.toLocaleString()}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${m.extras > 0 ? "text-orange-600 font-bold" : ""}`}
                      >
                        {m.extras.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        {m.status === "CONFORME" ? (
                          <Badge
                            variant="default"
                            className="bg-green-100 text-green-800 hover:bg-green-100"
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            CONFORME
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="mr-1 h-3 w-3" />
                            NON-CONFORME
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
