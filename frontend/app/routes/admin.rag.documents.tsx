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
} from "lucide-react";
import { useMemo, useState } from "react";
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

export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";
  const url = new URL(request.url);
  const prefix = url.searchParams.get("prefix") || "";

  const apiUrl = getInternalApiUrlFromRequest(
    `/api/rag/admin/knowledge${prefix ? `?prefix=${encodeURIComponent(prefix)}` : ""}`,
    request,
  );

  const response = await fetch(apiUrl, { headers: { Cookie: cookie } });

  const documents: KnowledgeDoc[] = response.ok ? await response.json() : [];

  return json({ documents });
}

const TRUTH_STATUS: Record<string, StatusType> = {
  L1: "PASS",
  L2: "INFO",
  L3: "WARN",
  L4: "FAIL",
};

const columns: DataColumn<KnowledgeDoc>[] = [
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
    render: (value) => <Badge variant="outline">{String(value)}</Badge>,
  },
  {
    key: "truth_level",
    header: "Niveau",
    mobilePriority: 3,
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
  },
  {
    key: "category",
    header: "Catégorie",
  },
  {
    key: "id",
    header: "",
    align: "right" as const,
    render: () => <ChevronRight className="h-4 w-4 text-muted-foreground" />,
  },
];

export default function AdminRagDocuments() {
  const { documents } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterFamily, setFilterFamily] = useState("");
  const [filterType, setFilterType] = useState("");

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

  const activeFilterCount =
    (filterLevel ? 1 : 0) +
    (filterFamily ? 1 : 0) +
    (filterType ? 1 : 0) +
    (search ? 1 : 0);

  const filtered = useMemo(() => {
    return documents.filter((doc) => {
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
  }, [documents, search, filterLevel, filterFamily, filterType]);

  const handleReset = () => {
    setSearch("");
    setFilterLevel("");
    setFilterFamily("");
    setFilterType("");
  };

  return (
    <DashboardShell
      title="Documents"
      description={`${filtered.length} document(s) sur ${documents.length}`}
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
      kpis={
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
      }
      filters={
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
      }
    >
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
          columns={columns}
          statusColumn={{
            key: "truth_level",
            mapping: TRUTH_STATUS,
          }}
          getRowKey={(row) => row.id}
          emptyMessage="Aucun document trouvé"
          onRowClick={(row) =>
            navigate(`/admin/rag/documents/${encodeURIComponent(row.id)}`)
          }
          maxRows={100}
        />
      )}
    </DashboardShell>
  );
}
