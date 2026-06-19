import { type MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { RefreshCw, FlaskConical, Eye } from "lucide-react";
import { useState } from "react";
import { DashboardShell } from "~/components/admin/patterns/DashboardShell";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Select, SelectItem } from "~/components/ui/select";
import { createNoIndexMeta } from "~/utils/meta-helpers";

// NOTE (rag-purge B9, ADR-031/046) : les formulaires d'ingestion RAG (PDF/web/manuel) + la table
// de jobs ont été RETIRÉS — l'application ne déclenche plus aucune ingestion RAG (RAG = consommateur
// du wiki pour le chat ; seule entrée = le sync wiki→rag). Cette page conserve uniquement l'outil
// PDF → RAG Merge (controller AdminRagIngestController, /api/admin/rag/pdf-merge — hors rag-proxy).

export const meta: MetaFunction = () =>
  createNoIndexMeta("PDF → RAG Merge - Admin RAG");

export default function AdminRagIngest() {
  // PDF → RAG Merge state
  const [mergePdfPath, setMergePdfPath] = useState("");
  const [mergePgAlias, setMergePgAlias] = useState("");
  const [mergeTruthLevel, setMergeTruthLevel] = useState("L2");
  const [mergeSourceRef, setMergeSourceRef] = useState("");
  const [mergeSubmitting, setMergeSubmitting] = useState(false);
  const [mergeMode, setMergeMode] = useState<"preview" | "apply">("preview");
  const [mergeResult, setMergeResult] = useState<{
    status?: string;
    extractedChars?: number;
    pages?: number;
    confidence?: number;
    patch?: unknown;
    mergedFile?: string;
    dbSync?: { inserted: number; updated: number; skipped: number };
    queuedPageTypes?: string[];
    error?: string;
  } | null>(null);

  async function handleMerge(mode: "preview" | "apply") {
    if (!mergePdfPath.trim() || !mergePgAlias.trim()) {
      setMergeResult({
        error: "Le chemin PDF et la gamme (pgAlias) sont requis",
      });
      return;
    }
    setMergeSubmitting(true);
    setMergeMode(mode);
    setMergeResult(null);
    try {
      const res = await fetch(`/api/admin/rag/pdf-merge/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfPath: mergePdfPath.trim(),
          pgAlias: mergePgAlias.trim(),
          truthLevel: mergeTruthLevel,
          ...(mergeSourceRef.trim() && { sourceRef: mergeSourceRef.trim() }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMergeResult({
          error: `Erreur ${res.status}: ${data.message || JSON.stringify(data)}`,
        });
      } else {
        setMergeResult(data);
      }
    } catch (err) {
      setMergeResult({
        error: `Erreur: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setMergeSubmitting(false);
    }
  }

  return (
    <DashboardShell
      title="PDF → RAG Merge"
      description="Extraire un PDF, le classifier par sections RAG, fusionner dans la gamme"
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
          <span className="text-foreground">PDF &rarr; RAG Merge</span>
        </div>
      }
    >
      {/* PDF → RAG Merge */}
      <Card className="border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FlaskConical className="h-4 w-4 text-foreground" />
            PDF &rarr; RAG Merge
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Extrait le texte d&apos;un PDF, le classifie par sections RAG, puis
            fusionne dans le fichier .md de la gamme. Utilisez{" "}
            <strong>Preview</strong> pour voir le patch avant d&apos;appliquer.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="mergePdfPath" className="text-sm font-medium">
                Chemin du PDF
              </label>
              <Input
                id="mergePdfPath"
                placeholder="/opt/automecanik/rag/pdfs/inbox/doc.pdf"
                value={mergePdfPath}
                onChange={(e) => setMergePdfPath(e.target.value)}
                disabled={mergeSubmitting}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="mergePgAlias" className="text-sm font-medium">
                Gamme cible (pgAlias)
              </label>
              <Input
                id="mergePgAlias"
                placeholder="filtre-a-huile"
                value={mergePgAlias}
                onChange={(e) => setMergePgAlias(e.target.value)}
                disabled={mergeSubmitting}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="mergeTruthLevel" className="text-sm font-medium">
                Niveau de confiance
              </label>
              <Select
                value={mergeTruthLevel}
                onValueChange={setMergeTruthLevel}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                disabled={mergeSubmitting}
                name="mergeTruthLevel"
              >
                <SelectItem value="L1">L1 &mdash; Officiel</SelectItem>
                <SelectItem value="L2">L2 &mdash; Technique</SelectItem>
                <SelectItem value="L3">L3 &mdash; Generique</SelectItem>
                <SelectItem value="L4">L4 &mdash; Non verifie</SelectItem>
              </Select>
            </div>
            <div className="space-y-1">
              <label htmlFor="mergeSourceRef" className="text-sm font-medium">
                Reference source{" "}
                <span className="text-muted-foreground">(optionnel)</span>
              </label>
              <Input
                id="mergeSourceRef"
                placeholder="ex: bosch-filtre-2024.pdf"
                value={mergeSourceRef}
                onChange={(e) => setMergeSourceRef(e.target.value)}
                disabled={mergeSubmitting}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleMerge("preview")}
              disabled={mergeSubmitting}
              className="gap-1.5"
            >
              {mergeSubmitting && mergeMode === "preview" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Preview
            </Button>
            <Button
              onClick={() => handleMerge("apply")}
              disabled={mergeSubmitting}
              className="gap-1.5 bg-primary hover:bg-primary"
            >
              {mergeSubmitting && mergeMode === "apply" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="h-4 w-4" />
              )}
              Apply
            </Button>
          </div>

          {/* Merge result */}
          {mergeResult && (
            <div
              className={`rounded-md border p-3 text-sm ${mergeResult.error ? "bg-red-50 border-red-200 text-red-800" : "bg-muted border-purple-200 text-foreground"}`}
            >
              {mergeResult.error ? (
                <p>{mergeResult.error}</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-muted text-foreground"
                    >
                      {mergeResult.status === "preview" ? "Preview" : "Applied"}
                    </Badge>
                    {mergeResult.confidence !== undefined && (
                      <Badge
                        variant="secondary"
                        className={
                          mergeResult.confidence >= 0.8
                            ? "bg-green-100 text-green-700"
                            : mergeResult.confidence >= 0.5
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                        }
                      >
                        Confidence: {(mergeResult.confidence * 100).toFixed(0)}%
                      </Badge>
                    )}
                    {mergeResult.extractedChars !== undefined && (
                      <Badge variant="outline">
                        {mergeResult.extractedChars.toLocaleString()} chars
                      </Badge>
                    )}
                    {mergeResult.pages !== undefined && (
                      <Badge variant="outline">{mergeResult.pages} pages</Badge>
                    )}
                  </div>
                  {mergeResult.mergedFile && (
                    <p className="text-xs">
                      Fichier merge :{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                        {mergeResult.mergedFile}
                      </code>
                    </p>
                  )}
                  {mergeResult.dbSync && (
                    <p className="text-xs">
                      DB Sync : {mergeResult.dbSync.inserted} inseres,{" "}
                      {mergeResult.dbSync.updated} mis a jour,{" "}
                      {mergeResult.dbSync.skipped} ignores
                    </p>
                  )}
                  {mergeResult.queuedPageTypes &&
                    mergeResult.queuedPageTypes.length > 0 && (
                      <p className="text-xs">
                        En queue : {mergeResult.queuedPageTypes.join(", ")}
                      </p>
                    )}
                  {mergeResult.patch != null && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs font-medium text-foreground hover:underline">
                        Voir le patch YAML
                      </summary>
                      <pre className="mt-1 max-h-48 overflow-auto rounded bg-gray-900 p-2 text-xs text-green-300">
                        {typeof mergeResult.patch === "string"
                          ? mergeResult.patch
                          : JSON.stringify(mergeResult.patch, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
