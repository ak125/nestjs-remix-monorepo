import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { ArrowLeft, FileText } from "lucide-react";
import { DashboardShell } from "~/components/admin/patterns/DashboardShell";
import {
  StatusBadge,
  type StatusType,
} from "~/components/admin/patterns/StatusBadge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction<typeof loader> = ({ data }) =>
  createNoIndexMeta(data?.doc?.id ? `Doc: ${data.doc.id}` : "Document RAG");

interface KnowledgeDocFull {
  id: string;
  content: string;
  source_path: string;
  truth_level: string;
  verification_status: string;
  doc_family?: string;
  source_type?: string;
  category?: string;
  title?: string;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";
  const docId = params.docId || "";

  const apiUrl = getInternalApiUrlFromRequest(
    `/api/rag/admin/knowledge/doc/${encodeURIComponent(docId)}`,
    request,
  );

  const response = await fetch(apiUrl, { headers: { Cookie: cookie } });

  if (!response.ok) {
    throw new Response("Document introuvable", { status: 404 });
  }

  const doc: KnowledgeDocFull = await response.json();

  return json({ doc });
}

const TRUTH_STATUS: Record<string, StatusType> = {
  L1: "PASS",
  L2: "INFO",
  L3: "WARN",
  L4: "FAIL",
};

const TRUTH_LABEL: Record<string, string> = {
  L1: "Source officielle constructeur",
  L2: "Source technique vérifiée",
  L3: "Source communautaire",
  L4: "Source non vérifiée",
};

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between border-b border-border py-2 last:border-0">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground text-right max-w-[60%] break-all">
        {value || "\u2014"}
      </span>
    </div>
  );
}

export default function AdminRagDocDetail() {
  const { doc } = useLoaderData<typeof loader>();

  return (
    <DashboardShell
      title={doc.title || doc.id}
      description={doc.id}
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
          <Link to="/admin/rag/documents" className="hover:text-foreground">
            Documents
          </Link>
          <span>/</span>
          <span className="text-foreground">{doc.title || doc.id}</span>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/rag/documents">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Retour
            </Link>
          </Button>
          <StatusBadge
            status={TRUTH_STATUS[doc.truth_level] || "NEUTRAL"}
            label={`${doc.truth_level} — ${TRUTH_LABEL[doc.truth_level] || "Inconnu"}`}
          />
        </div>
      }
    >
      <Tabs defaultValue="preview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="preview">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Aperçu
          </TabsTrigger>
          <TabsTrigger value="source">Source</TabsTrigger>
          <TabsTrigger value="metadata">Métadonnées</TabsTrigger>
        </TabsList>

        {/* Preview: rendered markdown-like content */}
        <TabsContent value="preview">
          <Card>
            <CardContent className="pt-6">
              <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                {doc.content || "Aucun contenu disponible."}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Source: raw content */}
        <TabsContent value="source">
          <Card>
            <CardContent className="pt-6">
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
                <code>{doc.content || "\u2014 vide \u2014"}</code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metadata grid */}
        <TabsContent value="metadata">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Identification
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MetadataRow label="ID" value={doc.id} />
                <MetadataRow label="Titre" value={doc.title || "\u2014"} />
                <MetadataRow
                  label="Catégorie"
                  value={doc.category || "\u2014"}
                />
                <MetadataRow
                  label="Source path"
                  value={doc.source_path || "\u2014"}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Classification
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between border-b border-border py-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Niveau de vérité
                  </span>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={TRUTH_STATUS[doc.truth_level] || "NEUTRAL"}
                      label={doc.truth_level}
                      size="sm"
                    />
                    <span className="text-xs text-muted-foreground">
                      {TRUTH_LABEL[doc.truth_level] || ""}
                    </span>
                  </div>
                </div>
                <MetadataRow
                  label="Vérification"
                  value={doc.verification_status || "\u2014"}
                />
                <MetadataRow
                  label="Famille"
                  value={doc.doc_family || "\u2014"}
                />
                <MetadataRow
                  label="Type source"
                  value={doc.source_type || "\u2014"}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Statistiques
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MetadataRow
                  label="Taille du contenu"
                  value={`${(doc.content || "").length.toLocaleString("fr-FR")} caractères`}
                />
                <MetadataRow
                  label="Nombre de lignes"
                  value={`${(doc.content || "").split("\n").length.toLocaleString("fr-FR")} lignes`}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}
