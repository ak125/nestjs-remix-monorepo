import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "@remix-run/react";
import {
  FileText,
  Search,
  Upload,
  ChevronRight,
  ShieldCheck,
  BookOpen,
  AlertTriangle,
  Layers,
  PackageOpen,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  DashboardShell,
  KpiGrid,
} from "~/components/admin/patterns/DashboardShell";
import { FilterBar, FilterGroup } from "~/components/admin/patterns/FilterBar";
import { KpiCard } from "~/components/admin/patterns/KpiCard";
import {
  ResponsiveDataTable,
  type DataColumn,
} from "~/components/admin/patterns/ResponsiveDataTable";
import {
  StatusBadge,
  type StatusType,
} from "~/components/admin/patterns/StatusBadge";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select, SelectItem } from "~/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Documents RAG - Admin");

interface KnowledgeDoc {
  [key: string]: unknown;
  id: string;
  title: string;
  doc_family: string;
  source_type: string;
  category: string;
  truth_level: string;
  verification_status: string;
}

interface GammeCoverage {
  [key: string]: unknown;
  pg_id: number;
  pg_alias: string;
  pg_name: string;
  pg_top: string | null;
  pg_g_level: string | null;
  rag_doc_count: number;
  has_disk_file: boolean;
  has_db_source: boolean;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";
  const url = new URL(request.url);
  const prefix = url.searchParams.get("prefix") || "";

  const docsUrl = getInternalApiUrlFromRequest(
    `/api/rag/admin/knowledge${prefix ? `?prefix=${encodeURIComponent(prefix)}` : ""}`,
    request,
  );
  const coverageUrl = getInternalApiUrlFromRequest(
    "/api/rag/admin/gamme-coverage",
    request,
  );

  const [docsRes, coverageRes] = await Promise.all([
    fetch(docsUrl, { headers: { Cookie: cookie } }),
    fetch(coverageUrl, { headers: { Cookie: cookie } }),
  ]);

  const documents: KnowledgeDoc[] = docsRes.ok ? await docsRes.json() : [];
  const coverage: GammeCoverage[] = coverageRes.ok
    ? await coverageRes.json()
    : [];

  return json({ documents, coverage });
}

const TRUTH_STATUS: Record<string, StatusType> = {
  L1: "PASS",
  L2: "INFO",
  L3: "WARN",
  L4: "FAIL",
};

const docColumns: DataColumn<KnowledgeDoc>[] = [
  {
    key: "title",
    header: "Titre",
    mobilePriority: 1,
    sortable: true,
    render: (value, row) => (
      <div>
        <div className="flex items-center gap-1.5">
          {String(row.id).startsWith("_quarantine") && (
            <Badge
              variant="outline"
              className="border-warning/30 px-1 text-[10px] text-warning"
            >
              QTN
            </Badge>
          )}
          <span className="font-medium text-foreground">
            {String(value).length > 55
              ? `${String(value).slice(0, 55)}…`
              : String(value)}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">{String(row.id)}</div>
      </div>
    ),
  },
  {
    key: "doc_family",
    header: "Famille",
    mobilePriority: 2,
    sortable: true,
    render: (value) => <Badge variant="outline">{String(value)}</Badge>,
  },
  {
    key: "truth_level",
    header: "Niveau",
    mobilePriority: 3,
    sortable: true,
    render: (value) => {
      const level = String(value);
      const status = TRUTH_STATUS[level];
      return status ? (
        <StatusBadge status={status} label={level} size="sm" />
      ) : (
        <Badge variant="secondary">{level}</Badge>
      );
    },
  },
  {
    key: "source_type",
    header: "Type",
    mobilePriority: 4,
    sortable: true,
  },
  {
    key: "category",
    header: "Catégorie",
    sortable: true,
  },
  {
    key: "id",
    header: "",
    align: "right" as const,
    render: () => <ChevronRight className="h-4 w-4 text-muted-foreground" />,
  },
];

const coverageColumns: DataColumn<GammeCoverage>[] = [
  {
    key: "pg_name",
    header: "Gamme",
    mobilePriority: 1,
    sortable: true,
    render: (value, row) => (
      <div>
        <span className="font-medium text-foreground">{String(value)}</span>
        <div className="text-xs text-muted-foreground">{row.pg_alias}</div>
      </div>
    ),
  },
  {
    key: "pg_g_level",
    header: "Niveau",
    mobilePriority: 4,
    sortable: true,
    render: (value) =>
      value ? (
        <Badge variant="outline">{String(value)}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "has_disk_file",
    header: "Fichier .md",
    mobilePriority: 3,
    sortable: true,
    render: (value) =>
      value ? (
        <Badge variant="secondary">oui</Badge>
      ) : (
        <Badge variant="destructive">absent</Badge>
      ),
  },
  {
    key: "has_db_source",
    header: "Ingesté DB",
    mobilePriority: 2,
    sortable: true,
    render: (value) =>
      value ? (
        <Badge variant="secondary">oui</Badge>
      ) : (
        <Badge variant="destructive">non</Badge>
      ),
  },
  {
    key: "rag_doc_count",
    header: "Docs RAG",
    mobilePriority: 2,
    sortable: true,
    render: (value) => {
      const count = Number(value);
      return count === 0 ? (
        <Badge variant="destructive">0 doc</Badge>
      ) : (
        <Badge variant="secondary">
          {count} doc{count > 1 ? "s" : ""}
        </Badge>
      );
    },
  },
  {
    key: "pg_id",
    header: "",
    align: "right" as const,
    render: () => <ChevronRight className="h-4 w-4 text-muted-foreground" />,
  },
];

export default function AdminRagDocuments() {
  const { documents, coverage } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterFamily, setFilterFamily] = useState("");
  const [filterType, setFilterType] = useState("");
  const [sortKey, setSortKey] = useState<keyof KnowledgeDoc | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Coverage tab state
  const [covSearch, setCovSearch] = useState("");
  const [covOnlyMissing, setCovOnlyMissing] = useState(false);
  const [covSortKey, setCovSortKey] = useState<keyof GammeCoverage | null>(
    null,
  );
  const [covSortDir, setCovSortDir] = useState<"asc" | "desc">("asc");

  const families = useMemo(
    () =>
      [...new Set(documents.map((d) => d.doc_family).filter(Boolean))].sort(),
    [documents],
  );

  const sourceTypes = useMemo(
    () =>
      [...new Set(documents.map((d) => d.source_type).filter(Boolean))].sort(),
    [documents],
  );

  const counts = useMemo(() => {
    let l1 = 0;
    let l2 = 0;
    let quarantine = 0;
    for (const d of documents) {
      if (d.truth_level === "L1") l1++;
      if (d.truth_level === "L2") l2++;
      if (d.id.startsWith("_quarantine")) quarantine++;
    }
    return { l1, l2, quarantine };
  }, [documents]);

  const covCounts = useMemo(() => {
    const total = coverage.length;
    const withDocs = coverage.filter((g) => g.rag_doc_count > 0).length;
    const withoutDocs = total - withDocs;
    const withDisk = coverage.filter((g) => g.has_disk_file).length;
    const withDbSource = coverage.filter((g) => g.has_db_source).length;
    const noDiskNoDb = coverage.filter(
      (g) => !g.has_disk_file && !g.has_db_source && g.rag_doc_count === 0,
    ).length;
    return { total, withDocs, withoutDocs, withDisk, withDbSource, noDiskNoDb };
  }, [coverage]);

  const activeFilterCount =
    (filterLevel ? 1 : 0) +
    (filterFamily ? 1 : 0) +
    (filterType ? 1 : 0) +
    (search ? 1 : 0);

  const filtered = useMemo(() => {
    const result = documents.filter((doc) => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          doc.title.toLowerCase().includes(q) ||
          doc.id.toLowerCase().includes(q) ||
          doc.category.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterLevel && doc.truth_level !== filterLevel) return false;
      if (filterFamily && doc.doc_family !== filterFamily) return false;
      if (filterType && doc.source_type !== filterType) return false;
      return true;
    });

    if (sortKey) {
      result.sort((a, b) => {
        const aVal = String(a[sortKey] ?? "").toLowerCase();
        const bVal = String(b[sortKey] ?? "").toLowerCase();
        const cmp = aVal.localeCompare(bVal, "fr");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [
    documents,
    search,
    filterLevel,
    filterFamily,
    filterType,
    sortKey,
    sortDir,
  ]);

  const filteredCoverage = useMemo(() => {
    const result = coverage.filter((g) => {
      if (covOnlyMissing && g.rag_doc_count > 0) return false;
      if (covSearch) {
        const q = covSearch.toLowerCase();
        return (
          g.pg_name.toLowerCase().includes(q) ||
          g.pg_alias.toLowerCase().includes(q)
        );
      }
      return true;
    });

    if (covSortKey) {
      result.sort((a, b) => {
        const aVal = a[covSortKey];
        const bVal = b[covSortKey];
        if (typeof aVal === "number" && typeof bVal === "number") {
          return covSortDir === "asc" ? aVal - bVal : bVal - aVal;
        }
        const cmp = String(aVal ?? "").localeCompare(String(bVal ?? ""), "fr");
        return covSortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [coverage, covSearch, covOnlyMissing, covSortKey, covSortDir]);

  const handleSort = useCallback(
    (key: keyof KnowledgeDoc) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  const handleCovSort = useCallback(
    (key: keyof GammeCoverage) => {
      if (covSortKey === key) {
        setCovSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setCovSortKey(key);
        setCovSortDir("asc");
      }
    },
    [covSortKey],
  );

  const handleReset = () => {
    setSearch("");
    setFilterLevel("");
    setFilterFamily("");
    setFilterType("");
  };

  return (
    <DashboardShell
      title="Documents RAG"
      description="Corpus documentaire et couverture gammes"
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
          <span className="text-foreground">Documents</span>
        </div>
      }
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/rag/ingest">
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Ingestion
          </Link>
        </Button>
      }
    >
      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Documents ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="coverage" className="gap-1.5">
            <Layers className="h-4 w-4" />
            Couverture gammes
            {covCounts.withoutDocs > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 text-[10px]">
                {covCounts.withoutDocs}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1 : Documents ─── */}
        <TabsContent value="documents">
          <KpiGrid columns={4}>
            <KpiCard
              title="Documents"
              value={documents.length}
              icon={FileText}
              variant="info"
            />
            <KpiCard
              title="L1 Constructeur"
              value={counts.l1}
              icon={ShieldCheck}
              variant="success"
            />
            <KpiCard
              title="L2 Technique"
              value={counts.l2}
              icon={BookOpen}
              variant="info"
            />
            <KpiCard
              title="Quarantaine"
              value={counts.quarantine}
              icon={AlertTriangle}
              variant="warning"
            />
          </KpiGrid>

          <div className="mt-4">
            <FilterBar activeCount={activeFilterCount} onReset={handleReset}>
              <FilterGroup label="Recherche">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Titre, ID ou catégorie…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </FilterGroup>
              <FilterGroup label="Niveau de vérité">
                <Select
                  value={filterLevel}
                  onValueChange={setFilterLevel}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <SelectItem value="">Tous niveaux</SelectItem>
                  <SelectItem value="L1">L1 — Constructeur</SelectItem>
                  <SelectItem value="L2">L2 — Technique vérifiée</SelectItem>
                  <SelectItem value="L3">L3 — Communautaire</SelectItem>
                  <SelectItem value="L4">L4 — Non vérifiée</SelectItem>
                </Select>
              </FilterGroup>
              <FilterGroup label="Famille">
                <Select
                  value={filterFamily}
                  onValueChange={setFilterFamily}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <SelectItem value="">Toutes familles</SelectItem>
                  {families.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </Select>
              </FilterGroup>
              <FilterGroup label="Type source">
                <Select
                  value={filterType}
                  onValueChange={setFilterType}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <SelectItem value="">Tous types</SelectItem>
                  {sourceTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </Select>
              </FilterGroup>
            </FilterBar>
          </div>

          <div className="mt-4">
            {filtered.length === 0 ? (
              <div className="rounded-lg border bg-card p-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <h3 className="mt-4 text-lg font-medium text-foreground">
                  Aucun document trouvé
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {documents.length === 0
                    ? "Le corpus RAG est vide. Lancez une ingestion pour commencer."
                    : "Essayez de modifier vos filtres de recherche."}
                </p>
                {documents.length === 0 && (
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link to="/admin/rag/ingest">
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Ingestion PDF
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <ResponsiveDataTable<KnowledgeDoc>
                data={filtered}
                columns={docColumns}
                statusColumn={{
                  key: "truth_level",
                  mapping: TRUTH_STATUS,
                }}
                getRowKey={(row) => row.id}
                emptyMessage="Aucun document trouvé"
                onRowClick={(row) =>
                  navigate(`/admin/rag/documents/${encodeURIComponent(row.id)}`)
                }
                sortBy={sortKey ?? undefined}
                sortDirection={sortDir}
                onSort={handleSort}
                pageSize={50}
              />
            )}
          </div>
        </TabsContent>

        {/* ─── Tab 2 : Couverture gammes ─── */}
        <TabsContent value="coverage">
          <KpiGrid columns={4}>
            <KpiCard
              title="Gammes actives"
              value={covCounts.total}
              icon={Layers}
              variant="info"
            />
            <KpiCard
              title="Fichier .md disque"
              value={covCounts.withDisk}
              icon={FileText}
              variant="info"
            />
            <KpiCard
              title="Ingesté en DB"
              value={covCounts.withDbSource}
              icon={ShieldCheck}
              variant={
                covCounts.withDbSource < covCounts.total ? "warning" : "success"
              }
            />
            <KpiCard
              title="Sans doc (0 source)"
              value={covCounts.noDiskNoDb}
              icon={PackageOpen}
              variant={covCounts.noDiskNoDb > 0 ? "warning" : "success"}
            />
          </KpiGrid>

          <div className="mt-4">
            <FilterBar
              activeCount={(covSearch ? 1 : 0) + (covOnlyMissing ? 1 : 0)}
              onReset={() => {
                setCovSearch("");
                setCovOnlyMissing(false);
              }}
            >
              <FilterGroup label="Recherche">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Nom ou alias de gamme…"
                    value={covSearch}
                    onChange={(e) => setCovSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </FilterGroup>
              <FilterGroup label="Couverture">
                <Button
                  variant={covOnlyMissing ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCovOnlyMissing(!covOnlyMissing)}
                >
                  <PackageOpen className="mr-1.5 h-3.5 w-3.5" />
                  Sans doc uniquement
                </Button>
              </FilterGroup>
            </FilterBar>
          </div>

          <div className="mt-4">
            {filteredCoverage.length === 0 ? (
              <div className="rounded-lg border bg-card p-12 text-center">
                <Layers className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <h3 className="mt-4 text-lg font-medium text-foreground">
                  {covOnlyMissing
                    ? "Toutes les gammes ont de la documentation"
                    : "Aucune gamme trouvée"}
                </h3>
              </div>
            ) : (
              <ResponsiveDataTable<GammeCoverage>
                data={filteredCoverage}
                columns={coverageColumns}
                getRowKey={(row) => String(row.pg_id)}
                emptyMessage="Aucune gamme trouvée"
                onRowClick={(row) => navigate(`/admin/gammes-seo/${row.pg_id}`)}
                sortBy={covSortKey ?? undefined}
                sortDirection={covSortDir}
                onSort={handleCovSort}
                pageSize={50}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}
