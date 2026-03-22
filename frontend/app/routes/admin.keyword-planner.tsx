/**
 * Admin Keyword Planner — Generateur de prompts + import mots-cles.
 * Workflow simple : choisir gamme → generer prompt → copier → coller dans Claude → importer JSON.
 */

import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Database,
  FileUp,
  Loader2,
  Sparkles,
  Target,
  Upload,
  Zap,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  DashboardShell,
  KpiGrid,
} from "~/components/admin/patterns/DashboardShell";
import { KpiCard } from "~/components/admin/patterns/KpiCard";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Combobox } from "~/components/ui/combobox";
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
import { Textarea } from "~/components/ui/textarea";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Keyword Planner - Admin");

// ── Types ──

interface RoleCoverage {
  role: string;
  label: string;
  count: number;
  total: number;
  pct: number;
}

interface GammeRow {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
  famille: string;
  famille_parent: string;
  famille_sort: number;
  gamme_sort: number;
  has_r1: boolean;
  has_r3: boolean;
  has_r4: boolean;
  has_r5: boolean;
  has_r6: boolean;
  kw_count: number;
  rag_status: "ingested" | "file_only" | "none";
  ingest_count: number;
}

interface PromptResult {
  role: string;
  prompt: string | null;
  chars?: number;
  error?: string | null;
}

interface RagStats {
  ingested: number;
  file_only: number;
  none: number;
  pct_ingested: number;
}

interface LoaderData {
  coverage: RoleCoverage[];
  gammes: GammeRow[];
  totalGammes: number;
  totalKeywords: number;
  fullyCoveredCount: number;
  rag: RagStats;
}

// ── Loader ──

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrlFromRequest("", request);
  const cookieHeader = request.headers.get("Cookie") || "";

  let coverage: RoleCoverage[] = [];
  let gammes: GammeRow[] = [];
  let totalGammes = 221;
  let totalKeywords = 0;
  let fullyCoveredCount = 0;
  let rag: RagStats = { ingested: 0, file_only: 0, none: 0, pct_ingested: 0 };

  try {
    const resp = await fetch(
      `${backendUrl}/api/admin/keyword-planner/coverage`,
      { headers: { Cookie: cookieHeader } },
    );
    if (resp.ok) {
      const data = await resp.json();
      coverage = data.coverage || [];
      gammes = (data.gammes || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (g: any) => ({
          pg_id: g.pg_id,
          pg_alias: g.pg_alias || "",
          pg_name: g.pg_name || `#${g.pg_id}`,
          famille: g.famille || "",
          famille_parent: g.famille_parent || "Non classé",
          famille_sort: g.famille_sort ?? 999,
          gamme_sort: g.gamme_sort ?? 999,
          has_r1: !!g.has_r1,
          has_r3: !!g.has_r3,
          has_r4: !!g.has_r4,
          has_r5: !!g.has_r5,
          has_r6: !!g.has_r6,
          kw_count: g.kw_count || 0,
          rag_status: g.rag_status || "none",
          ingest_count: g.ingest_count || 0,
        }),
      );
      totalGammes = data.totalGammes || 221;
      totalKeywords = data.totalKeywords || 0;
      fullyCoveredCount = data.fullyCoveredCount || 0;
      if (data.rag) {
        rag = data.rag;
      }
    }
  } catch {
    /* loader error — empty state */
  }

  return json<LoaderData>({
    coverage,
    gammes,
    totalGammes,
    totalKeywords,
    fullyCoveredCount,
    rag,
  });
}

// ── Action ──

export async function action({ request }: ActionFunctionArgs) {
  const backendUrl = getInternalApiUrlFromRequest("", request);
  const cookieHeader = request.headers.get("Cookie") || "";
  const form = await request.formData();
  const actionType = String(form.get("_action") || "generate");

  if (actionType === "import") {
    const pg_id = Number(form.get("pg_id") || 0);
    const pg_alias = String(form.get("pg_alias") || "");
    const rawJson = String(form.get("json_content") || "");
    const dryRun = form.get("dry_run") === "true";

    let cleaned = rawJson.trim();
    if (cleaned.startsWith("```"))
      cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");

    let keywords: unknown[];
    try {
      keywords = JSON.parse(cleaned);
      if (!Array.isArray(keywords))
        return json({ _action: "import", error: "JSON doit etre un array" });
    } catch (e) {
      return json({ _action: "import", error: `JSON invalide: ${e}` });
    }

    try {
      const resp = await fetch(
        `${backendUrl}/api/admin/keyword-planner/import`,
        {
          method: "POST",
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pg_id, pg_alias, keywords, dry_run: dryRun }),
        },
      );
      return json({ _action: "import", ...(await resp.json()) });
    } catch (e) {
      return json({ _action: "import", error: String(e) });
    }
  }

  if (actionType === "generate_content") {
    const pg_id = Number(form.get("pg_id") || 0);
    const pg_alias = String(form.get("pg_alias") || "");
    const roles = String(form.get("roles") || "R1");
    try {
      const resp = await fetch(
        `${backendUrl}/api/admin/keyword-planner/generate-content`,
        {
          method: "POST",
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pg_id, pg_alias, roles: roles.split(",") }),
        },
      );
      if (resp.ok) {
        return json({ _action: "generate_content", ...(await resp.json()) });
      }
      return json({
        _action: "generate_content",
        error: `Backend ${resp.status}: ${await resp.text()}`,
      });
    } catch (e) {
      return json({ _action: "generate_content", error: String(e) });
    }
  }

  // Generate prompt
  const pg_id = Number(form.get("pg_id"));
  const roleVal = String(form.get("role") || "all");
  const roles =
    roleVal === "all"
      ? ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"]
      : [roleVal];

  try {
    const resp = await fetch(
      `${backendUrl}/api/admin/keyword-planner/generate`,
      {
        method: "POST",
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pg_id, roles }),
      },
    );
    if (resp.ok) return json({ _action: "generate", ...(await resp.json()) });
    return json({ _action: "generate", error: `Backend ${resp.status}` });
  } catch (e) {
    return json({ _action: "generate", error: String(e) });
  }
}

// ── Role colors ──

const ROLE_COLORS: Record<string, string> = {
  R1: "bg-blue-100 text-blue-800",
  R2: "bg-purple-100 text-purple-800",
  R3: "bg-green-100 text-green-800",
  R4: "bg-gray-100 text-gray-800",
  R5: "bg-red-100 text-red-800",
  R6: "bg-amber-100 text-amber-800",
  R7: "bg-indigo-100 text-indigo-800",
  R8: "bg-teal-100 text-teal-800",
};

// ── Component ──

export default function KeywordPlannerPage() {
  const {
    coverage,
    gammes,
    totalGammes,
    totalKeywords,
    fullyCoveredCount,
    rag,
  } = useLoaderData<LoaderData>();

  const gammesWithKw = useMemo(
    () => gammes.filter((g) => g.kw_count > 0).length,
    [gammes],
  );

  // Generate fetcher
  const genFetcher = useFetcher<{
    _action?: string;
    pg_name?: string;
    pg_alias?: string;
    results?: PromptResult[];
    error?: string;
  }>();
  const [selectedPgId, setSelectedPgId] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Group gammes by famille_parent for the selector
  const sortedGammesByFamily = useMemo(() => {
    const groups = new Map<string, GammeRow[]>();
    for (const g of gammes) {
      const fam = g.famille_parent || "Non classé";
      const list = groups.get(fam) ?? [];
      list.push(g);
      groups.set(fam, list);
    }
    const items: Array<{
      type: "header" | "item";
      key: string;
      label: string;
      value?: string;
      count?: number;
    }> = [];
    for (const [fam, list] of [...groups.entries()].sort((a, b) => {
      const sortA = Math.min(...a[1].map((g) => g.famille_sort ?? 999));
      const sortB = Math.min(...b[1].map((g) => g.famille_sort ?? 999));
      return sortA - sortB || a[0].localeCompare(b[0]);
    })) {
      items.push({
        type: "header",
        key: `hdr-${fam}`,
        label: fam,
        count: list.length,
      });
      for (const g of list.sort(
        (a, b) =>
          (a.gamme_sort ?? 999) - (b.gamme_sort ?? 999) ||
          a.pg_name.localeCompare(b.pg_name),
      )) {
        items.push({
          type: "item",
          key: `g-${g.pg_id}`,
          label: g.pg_name,
          value: String(g.pg_id),
        });
      }
    }
    return items;
  }, [gammes]);

  // Combobox items for gamme search (flat list with famille prefix)
  const gammeComboItems = useMemo(() => {
    return sortedGammesByFamily
      .filter((item) => item.type === "item")
      .map((item) => ({
        value: item.value!,
        label: item.label,
      }));
  }, [sortedGammesByFamily]);

  // Import fetcher
  const importFetcher = useFetcher<{
    _action?: string;
    imported?: number;
    valid?: number;
    dry_run?: boolean;
    rejected?: number;
    rejected_details?: Array<{ kw: string; reason: string }>;
    warnings?: Array<{ kw: string; reason: string }>;
    quality?: {
      input: number;
      after_validation: number;
      after_competitors: number;
      after_dedup: number;
      final?: number;
      after_intent_check?: number;
      reject_rate: number;
      warning_rate?: number;
    };
    gammes?: Array<{
      pg_id: number;
      pg_alias: string;
      roles: string[];
      count: number;
    }>;
    errors?: string[];
    error?: string;
  }>();
  const contentFetcher = useFetcher<{
    _action?: string;
    message?: string;
    error?: string;
    kw_total?: number;
    roles_ready?: string[];
    command?: string;
  }>();
  const [jsonContent, setJsonContent] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGenerating =
    genFetcher.state !== "idle" &&
    genFetcher.formData?.get("_action") !== "import";
  const isImporting = importFetcher.state !== "idle";
  const genResults =
    genFetcher.data?._action === "generate" ? genFetcher.data : null;
  const importResult =
    importFetcher.data?._action === "import" ? importFetcher.data : null;
  const contentResult =
    contentFetcher.data?._action === "generate_content"
      ? contentFetcher.data
      : null;

  function handleGenerate() {
    if (!selectedPgId) return;
    genFetcher.submit(
      { _action: "generate", pg_id: selectedPgId, role: selectedRole },
      { method: "post" },
    );
  }

  async function copyPrompt(text: string, idx: number) {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  function handleJsonChange(val: string) {
    setJsonContent(val);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setJsonContent(ev.target?.result as string);
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleImport() {
    if (!jsonContent) return;
    const gamme = gammes.find((g) => g.pg_id === Number(selectedPgId));
    importFetcher.submit(
      {
        _action: "import",
        pg_id: selectedPgId || "0",
        pg_alias: gamme?.pg_alias || "",
        json_content: jsonContent,
        dry_run: dryRun ? "true" : "false",
      },
      { method: "post" },
    );
  }

  const kwCount = jsonContent ? (jsonContent.match(/"kw"/g) || []).length : 0;

  const gapCount = totalGammes - fullyCoveredCount;

  return (
    <DashboardShell
      title="Keyword Planner"
      description={`${totalGammes} gammes — ${totalKeywords} mots-cles importes`}
    >
      {/* KPI summary */}
      <KpiGrid columns={4}>
        <KpiCard
          title="Progression KW"
          value={`${gammesWithKw}/${totalGammes}`}
          subtitle={`${Math.round((gammesWithKw / Math.max(totalGammes, 1)) * 100)}% gammes avec KW — ${totalKeywords} KW total`}
          icon={Target}
          variant={
            gammesWithKw > totalGammes * 0.5
              ? "success"
              : gammesWithKw > 0
                ? "warning"
                : "danger"
          }
        />
        <KpiCard
          title="Covered R1+R3+R6"
          value={fullyCoveredCount}
          subtitle={`/ ${totalGammes} gammes`}
          icon={CheckCircle2}
          variant={
            fullyCoveredCount > totalGammes * 0.8 ? "success" : "warning"
          }
        />
        <KpiCard
          title="Gaps"
          value={gapCount}
          subtitle="gammes incompletes"
          icon={Target}
          variant={
            gapCount === 0 ? "success" : gapCount < 20 ? "warning" : "danger"
          }
        />
        <KpiCard
          title="RAG Ingere"
          value={`${rag.pct_ingested}%`}
          subtitle={`${rag.ingested} ingere / ${rag.file_only} fichier seul / ${rag.none} aucun`}
          icon={Database}
          variant={
            rag.pct_ingested >= 50
              ? "success"
              : rag.pct_ingested >= 20
                ? "warning"
                : "danger"
          }
        />
        {coverage
          .filter((c) => c.pct < 50)
          .slice(0, 1)
          .map((c) => (
            <KpiCard
              key={c.role}
              title={`${c.role} le plus faible`}
              value={`${c.pct}%`}
              subtitle={`${c.count}/${c.total} — ${c.label}`}
              icon={Target}
              variant="danger"
            />
          ))}
        {coverage.filter((c) => c.pct < 50).length === 0 && (
          <KpiCard
            title="Couverture"
            value="OK"
            subtitle="tous les roles > 50%"
            icon={CheckCircle2}
            variant="success"
          />
        )}
      </KpiGrid>

      {/* ── STEP 1 : Generer ── */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold">
              1
            </span>
            Generer le prompt
          </CardTitle>
          <CardDescription>
            Selectionner la gamme et le role, puis copier le prompt dans Claude
            Chrome.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <Combobox
                items={gammeComboItems}
                value={selectedPgId}
                onValueChange={setSelectedPgId}
                placeholder="Choisir une gamme..."
                searchPlaceholder="Rechercher une gamme..."
                className="h-10"
              />
            </div>
            <div className="w-44">
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous (R1-R8)</SelectItem>
                  <SelectItem value="R1">R1 — Achat</SelectItem>
                  <SelectItem value="R2">R2 — Produit</SelectItem>
                  <SelectItem value="R3">R3 — Conseils</SelectItem>
                  <SelectItem value="R4">R4 — Reference</SelectItem>
                  <SelectItem value="R5">R5 — Diagnostic</SelectItem>
                  <SelectItem value="R6">R6 — Guide Achat</SelectItem>
                  <SelectItem value="R7">R7 — Marque</SelectItem>
                  <SelectItem value="R8">R8 — Vehicule</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={!selectedPgId || isGenerating}
              className="h-10 gap-2 px-6"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generer
            </Button>
          </div>

          {/* Error */}
          {genResults?.error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {genResults.error}
            </div>
          )}

          {/* Prompt results */}
          {genResults?.results && genResults.results.length > 0 && (
            <div className="mt-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                Prompts pour{" "}
                <span className="font-semibold text-foreground">
                  {genResults.pg_name}
                </span>{" "}
                — copier puis coller dans Claude Chrome
              </p>
              {genResults.results.map((r, idx) => (
                <div key={r.role} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
                    <div className="flex items-center gap-2">
                      <Badge className={ROLE_COLORS[r.role]}>{r.role}</Badge>
                      {r.chars && (
                        <span className="text-xs text-muted-foreground">
                          {r.chars} chars
                        </span>
                      )}
                    </div>
                    {r.prompt && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-8"
                        onClick={() => copyPrompt(r.prompt!, idx)}
                      >
                        <ClipboardCopy className="h-3.5 w-3.5" />
                        {copiedIdx === idx ? "Copie !" : "Copier"}
                      </Button>
                    )}
                  </div>
                  {r.error ? (
                    <div className="px-4 py-3 text-sm text-red-600 bg-red-50">
                      {r.error}
                    </div>
                  ) : (
                    <pre className="px-4 py-3 text-xs font-mono text-muted-foreground bg-muted/20 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                      {r.prompt}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── STEP 2 : Importer ── */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-green-600 text-white text-xs font-bold">
              2
            </span>
            Importer les mots-cles
          </CardTitle>
          <CardDescription>
            Collez le JSON retourne par Claude Chrome ou uploadez un fichier
            .json. Format :{" "}
            <code className="text-xs bg-muted px-1 rounded">
              [{`{pg_id, kw, intent, vol, role}`}]
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden" // eslint-disable-line no-restricted-syntax -- file input intentionally hidden
              onChange={handleFileUpload}
            />
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="h-4 w-4" />
              Upload .json
            </Button>
            <div className="flex items-center gap-2">
              <Checkbox
                id="dry-run"
                checked={dryRun}
                onCheckedChange={(v) => setDryRun(!!v)}
              />
              <label
                htmlFor="dry-run"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Dry-run (valider sans ecrire)
              </label>
            </div>
            {kwCount > 0 && (
              <span className="text-xs text-muted-foreground">
                ~{kwCount} mots-cles detectes
              </span>
            )}
          </div>

          <Textarea
            value={jsonContent}
            onChange={(e) => handleJsonChange(e.target.value)}
            rows={6}
            placeholder={`[\n  {"pg_id": 82, "kw": "disque de frein prix", "intent": "transactional", "vol": "HIGH", "role": "R1"},\n  ...\n]`}
            className="font-mono text-xs"
          />

          <Button
            onClick={handleImport}
            disabled={!jsonContent || isImporting}
            variant={dryRun ? "outline" : "default"}
            className="gap-2"
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {dryRun ? "Valider (dry-run)" : "Importer en DB"}
          </Button>

          {/* Import result */}
          {importResult && (
            <div
              className={`p-4 rounded-lg border space-y-3 ${
                importResult.error
                  ? "bg-red-50 border-red-200"
                  : importResult.imported
                    ? "bg-green-50 border-green-200"
                    : "bg-blue-50 border-blue-200"
              }`}
            >
              {importResult.error ? (
                <p className="text-sm text-red-700">{importResult.error}</p>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <p
                      className={`text-sm font-medium ${importResult.dry_run ? "text-blue-700" : "text-green-700"}`}
                    >
                      {importResult.dry_run
                        ? `Dry-run : ${importResult.valid} mots-cles valides`
                        : `${importResult.imported} mots-cles importes`}
                    </p>
                    {importResult.rejected ? (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-200"
                      >
                        {importResult.rejected} rejetes
                      </Badge>
                    ) : null}
                  </div>

                  {/* Quality funnel */}
                  {importResult.quality && (
                    <div className="flex flex-wrap gap-1 text-[10px] font-mono text-muted-foreground">
                      <span>{importResult.quality.input} input</span>
                      <span className="text-muted-foreground/40">&rarr;</span>
                      <span>{importResult.quality.after_validation} valid</span>
                      <span className="text-muted-foreground/40">&rarr;</span>
                      <span>
                        {importResult.quality.after_competitors} sans
                        concurrents
                      </span>
                      <span className="text-muted-foreground/40">&rarr;</span>
                      <span>
                        {importResult.quality.after_dedup} sans doublons
                      </span>
                      <span className="text-muted-foreground/40">&rarr;</span>
                      <span className="font-bold text-foreground">
                        {importResult.quality.final ??
                          importResult.quality.after_intent_check}{" "}
                        final
                      </span>
                      {importResult.quality.reject_rate > 0 && (
                        <span className="text-amber-600 ml-1">
                          ({importResult.quality.reject_rate}% rejetes)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Gamme stats */}
                  {importResult.gammes?.map((g) => (
                    <div
                      key={g.pg_id}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="font-medium">
                        {g.pg_alias || `#${g.pg_id}`}
                      </span>
                      <span className="text-muted-foreground">
                        {g.count} kw
                      </span>
                      {g.roles.map((r) => (
                        <Badge
                          key={r}
                          className={ROLE_COLORS[r]}
                          variant="outline"
                        >
                          {r}
                        </Badge>
                      ))}
                    </div>
                  ))}

                  {/* Rejected details */}
                  {(importResult.rejected_details?.length ?? 0) > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-amber-700 font-medium">
                        {importResult.rejected} mots-cles rejetes
                      </summary>
                      <div className="mt-1 space-y-0.5 pl-3">
                        {importResult.rejected_details?.map((r, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-red-500">✕</span>
                            <span className="text-muted-foreground">
                              {r.kw}
                            </span>
                            <span className="text-amber-600 italic">
                              {r.reason}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Warnings */}
                  {(importResult.warnings?.length ?? 0) > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-yellow-700 font-medium">
                        {importResult.warnings?.length} avertissements intent
                      </summary>
                      <div className="mt-1 space-y-0.5 pl-3">
                        {importResult.warnings?.map((w, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-yellow-500">⚠</span>
                            <span className="text-muted-foreground">
                              {w.kw}
                            </span>
                            <span className="text-yellow-600 italic">
                              {w.reason}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Errors */}
                  {(importResult.errors?.length ?? 0) > 0 && (
                    <p className="text-xs text-red-600">
                      Erreurs : {importResult.errors?.join(", ")}
                    </p>
                  )}

                  {/* Generate content button — after successful import */}
                  {!importResult.dry_run &&
                    (importResult.imported ?? 0) > 0 && (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <div className="flex items-center gap-3">
                          <Button
                            variant="default"
                            size="sm"
                            className="gap-2 bg-purple-600 hover:bg-purple-700"
                            onClick={() => {
                              const roles =
                                importResult.gammes?.flatMap((g) => g.roles) ??
                                [];
                              const uniqueRoles = [...new Set(roles)];
                              const pgId = importResult.gammes?.[0]?.pg_id;
                              const alias =
                                importResult.gammes?.[0]?.pg_alias ?? "";
                              if (pgId) {
                                contentFetcher.submit(
                                  {
                                    _action: "generate_content",
                                    pg_id: String(pgId),
                                    pg_alias: alias,
                                    roles: uniqueRoles.join(","),
                                  },
                                  { method: "post" },
                                );
                              }
                            }}
                            disabled={contentFetcher.state !== "idle"}
                          >
                            {contentFetcher.state !== "idle" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Zap className="h-4 w-4" />
                            )}
                            Generer le contenu
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Utilise les {importResult.imported} KW pour
                            optimiser H1, H2, meta et body
                          </span>
                        </div>
                        {contentResult && (
                          <div
                            className={`mt-2 p-3 rounded text-sm space-y-2 ${contentResult.error ? "bg-red-50 text-red-700" : "bg-purple-50 text-purple-700"}`}
                          >
                            {contentResult.error ? (
                              <p>{contentResult.error}</p>
                            ) : (
                              <>
                                <p className="font-medium">
                                  {contentResult.kw_total} KW pour{" "}
                                  {contentResult.roles_ready?.join(", ")}
                                </p>
                                {contentResult.command && (
                                  <div className="flex items-center gap-2">
                                    <code className="bg-purple-100 px-2 py-1 rounded text-xs font-mono">
                                      {contentResult.command}
                                    </code>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-xs"
                                      onClick={() =>
                                        navigator.clipboard.writeText(
                                          contentResult.command ?? "",
                                        )
                                      }
                                    >
                                      <ClipboardCopy className="h-3 w-3 mr-1" />
                                      Copier
                                    </Button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {/* ── FAMILLES — Vue par systeme avec recommandations ── */}
      <FamilyOverview gammes={gammes} />
    </DashboardShell>
  );
}

// ══════════════════════════════════════
// Family Overview — modern cards by system
// ══════════════════════════════════════

interface FamilyStats {
  name: string;
  sort: number;
  gammes: GammeRow[];
  total: number;
  r1: number;
  r3: number;
  r4: number;
  r5: number;
  r6: number;
  kwTotal: number;
  recommendations: Array<{
    role: string;
    label: string;
    priority: "high" | "medium" | "low";
  }>;
}

function FamilyOverview({ gammes }: { gammes: GammeRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ragFilter, setRagFilter] = useState("all");

  // Filter gammes by RAG status before grouping
  const filteredGammes = useMemo(() => {
    if (ragFilter === "all") return gammes;
    if (ragFilter === "ingested")
      return gammes.filter((g) => g.rag_status === "ingested");
    if (ragFilter === "not_ingested")
      return gammes.filter((g) => g.rag_status !== "ingested");
    if (ragFilter === "none")
      return gammes.filter((g) => g.rag_status === "none");
    return gammes;
  }, [gammes, ragFilter]);

  const families = useMemo(() => {
    const groups = new Map<string, GammeRow[]>();
    for (const g of filteredGammes) {
      const fam = g.famille_parent || "Non classé";
      const list = groups.get(fam) ?? [];
      list.push(g);
      groups.set(fam, list);
    }

    return [...groups.entries()]
      .map(([name, list]): FamilyStats => {
        const r1 = list.filter((g) => g.has_r1).length;
        const r3 = list.filter((g) => g.has_r3).length;
        const r4 = list.filter((g) => g.has_r4).length;
        const r5 = list.filter((g) => g.has_r5).length;
        const r6 = list.filter((g) => g.has_r6).length;
        const kwTotal = list.reduce((s, g) => s + g.kw_count, 0);
        const total = list.length;
        // Use minimum famille_sort from gammes in this group (catalog order)
        const sortOrder = Math.min(...list.map((g) => g.famille_sort));

        // Generate smart recommendations
        const recs: FamilyStats["recommendations"] = [];
        if (r1 < total)
          recs.push({
            role: "R1",
            label: `${total - r1} gammes sans R1 (achat)`,
            priority: r1 < total * 0.5 ? "high" : "medium",
          });
        if (r3 < total)
          recs.push({
            role: "R3",
            label: `${total - r3} gammes sans R3 (conseils)`,
            priority: r3 < total * 0.5 ? "high" : "medium",
          });
        if (r6 < total)
          recs.push({
            role: "R6",
            label: `${total - r6} gammes sans R6 (guide achat)`,
            priority: r6 < total * 0.5 ? "high" : "medium",
          });
        if (r4 < total * 0.3)
          recs.push({
            role: "R4",
            label: `${total - r4} gammes sans R4 (reference)`,
            priority: "low",
          });
        if (r5 === 0 && total >= 3)
          recs.push({
            role: "R5",
            label: `Aucun R5 (diagnostic)`,
            priority: "low",
          });

        return {
          name,
          sort: sortOrder,
          gammes: list.sort(
            (a, b) =>
              (a.gamme_sort ?? 999) - (b.gamme_sort ?? 999) ||
              a.pg_name.localeCompare(b.pg_name),
          ),
          total,
          r1,
          r3,
          r4,
          r5,
          r6,
          kwTotal,
          recommendations: recs,
        };
      })
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  }, [filteredGammes]);

  function pctBar(val: number, total: number) {
    const pct = total > 0 ? Math.round((val / total) * 100) : 0;
    const color =
      pct >= 90 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
    return { pct, color };
  }

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Familles ({families.length})
            {ragFilter !== "all" && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {ragFilter === "ingested"
                  ? "Ingéré"
                  : ragFilter === "not_ingested"
                    ? "Non ingéré"
                    : "Aucun RAG"}
              </Badge>
            )}
          </CardTitle>
          <Select value={ragFilter} onValueChange={setRagFilter}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">RAG: Tous</SelectItem>
              <SelectItem value="ingested">Ingéré</SelectItem>
              <SelectItem value="not_ingested">Non ingéré</SelectItem>
              <SelectItem value="none">Aucun RAG</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardDescription>
          Vue par systeme automobile — cliquer pour voir les gammes et
          recommandations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {families.map((f) => {
          const isOpen = expanded === f.name;
          const hasIssues =
            f.recommendations.filter((r) => r.priority === "high").length > 0;
          const allGood = f.recommendations.length === 0;

          return (
            <div key={f.name} className="border rounded-lg overflow-hidden">
              {/* Family header */}
              <button
                onClick={() => setExpanded(isOpen ? null : f.name)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
              >
                <ChevronRight
                  className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{f.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {f.total} gammes
                    </span>
                    {allGood && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    )}
                    {hasIssues && (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    {f.kwTotal > 0 && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-5 bg-blue-50 text-blue-700"
                      >
                        {f.kwTotal} KW
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Mini role bars */}
                <div className="hidden sm:flex items-center gap-1.5">
                  {(["r1", "r3", "r4", "r5", "r6"] as const).map((role) => {
                    const val = f[role];
                    const { pct, color } = pctBar(val, f.total);
                    const roleLabel = role.toUpperCase();
                    return (
                      <div
                        key={role}
                        className="flex flex-col items-center w-8"
                        title={`${roleLabel}: ${val}/${f.total}`}
                      >
                        <span className="text-[9px] text-muted-foreground leading-none mb-0.5">
                          {roleLabel}
                        </span>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${color}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="border-t">
                  {/* Role coverage cards */}
                  <div className="grid grid-cols-5 divide-x bg-muted/30">
                    {(
                      [
                        {
                          key: "r1" as const,
                          label: "R1 Achat",
                          color: "blue",
                        },
                        {
                          key: "r3" as const,
                          label: "R3 Conseils",
                          color: "green",
                        },
                        {
                          key: "r4" as const,
                          label: "R4 Reference",
                          color: "gray",
                        },
                        {
                          key: "r5" as const,
                          label: "R5 Diagnostic",
                          color: "red",
                        },
                        {
                          key: "r6" as const,
                          label: "R6 Guide",
                          color: "amber",
                        },
                      ] as const
                    ).map(({ key, label, color }) => {
                      const val = f[key];
                      const { pct } = pctBar(val, f.total);
                      const missing = f.total - val;
                      const barColor =
                        pct >= 90
                          ? "bg-green-500"
                          : pct >= 50
                            ? `bg-${color}-500`
                            : "bg-red-500";
                      return (
                        <div key={key} className="px-3 py-2.5 text-center">
                          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            {label}
                          </div>
                          <div className="text-lg font-bold mt-0.5">
                            {pct}
                            <span className="text-xs font-normal text-muted-foreground">
                              %
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {missing > 0 && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {missing} manquant{missing > 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Recommendations banner — grouped by priority */}
                  {f.recommendations.length > 0 && (
                    <div className="border-t">
                      {/* High/Medium priority actions */}
                      {f.recommendations.filter((r) => r.priority !== "low")
                        .length > 0 && (
                        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="h-4 w-4 text-amber-600 shrink-0" />
                            <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                              Actions prioritaires
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {f.recommendations
                              .filter((r) => r.priority !== "low")
                              .map((rec) => {
                                const missingGammes = f.gammes.filter((g) => {
                                  if (rec.role === "R1") return !g.has_r1;
                                  if (rec.role === "R3") return !g.has_r3;
                                  if (rec.role === "R6") return !g.has_r6;
                                  return false;
                                });
                                return (
                                  <div
                                    key={rec.role}
                                    className="bg-white rounded border border-amber-200 p-2.5"
                                  >
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <Badge
                                        className={ROLE_COLORS[rec.role]}
                                        variant="outline"
                                      >
                                        {rec.role}
                                      </Badge>
                                      <span className="text-xs font-semibold text-amber-900">
                                        {rec.label}
                                      </span>
                                    </div>
                                    {missingGammes.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {missingGammes.slice(0, 8).map((g) => (
                                          <span
                                            key={g.pg_id}
                                            className="text-[10px] bg-amber-100 text-amber-800 rounded px-1.5 py-0.5"
                                          >
                                            {g.pg_name}
                                          </span>
                                        ))}
                                        {missingGammes.length > 8 && (
                                          <span className="text-[10px] text-amber-600">
                                            +{missingGammes.length - 8} autres
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                      {/* Low priority (R4, R5) — with expandable gamme list */}
                      {f.recommendations.filter((r) => r.priority === "low")
                        .length > 0 && (
                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                              Optionnel
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {f.recommendations
                              .filter((r) => r.priority === "low")
                              .map((rec) => {
                                const missingGammes = f.gammes.filter((g) => {
                                  if (rec.role === "R4") return !g.has_r4;
                                  if (rec.role === "R5") return !g.has_r5;
                                  return false;
                                });
                                return (
                                  <div
                                    key={rec.role}
                                    className="bg-white rounded border border-gray-200 p-2.5"
                                  >
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] h-4"
                                      >
                                        {rec.role}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {rec.label}
                                      </span>
                                    </div>
                                    {missingGammes.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {missingGammes.slice(0, 6).map((g) => (
                                          <span
                                            key={g.pg_id}
                                            className="text-[10px] bg-gray-100 text-gray-700 rounded px-1.5 py-0.5"
                                          >
                                            {g.pg_name}
                                          </span>
                                        ))}
                                        {missingGammes.length > 6 && (
                                          <span className="text-[10px] text-muted-foreground">
                                            +{missingGammes.length - 6} autres
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Gammes table — shadcn Table */}
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20 text-xs">
                        <TableHead className="py-1.5 px-3">Gamme</TableHead>
                        <TableHead className="py-1.5 px-1.5 text-center w-8">
                          R1
                        </TableHead>
                        <TableHead className="py-1.5 px-1.5 text-center w-8">
                          R3
                        </TableHead>
                        <TableHead className="py-1.5 px-1.5 text-center w-8">
                          R4
                        </TableHead>
                        <TableHead className="py-1.5 px-1.5 text-center w-8">
                          R5
                        </TableHead>
                        <TableHead className="py-1.5 px-1.5 text-center w-8">
                          R6
                        </TableHead>
                        <TableHead className="py-1.5 px-1.5 text-center w-10 text-indigo-600">
                          RAG
                        </TableHead>
                        <TableHead className="py-1.5 px-2 text-right w-10 text-violet-600">
                          KW
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {f.gammes.map((g) => (
                        <GammeAuditRow key={g.pg_id} g={g} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RoleDot({ ok, label }: { ok: boolean; label: string }) {
  if (ok) {
    return (
      <span className="inline-flex mx-auto" aria-label={`${label}: OK`}>
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      </span>
    );
  }
  return (
    <span
      aria-label={`${label}: manquant`}
      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-500 text-[9px] font-bold mx-auto"
    >
      ✕
    </span>
  );
}

function RagDot({ status, count }: { status: string; count: number }) {
  if (status === "ingested") {
    return (
      <Badge
        variant="secondary"
        className="bg-indigo-100 text-indigo-700 text-[9px] px-1.5 py-0"
        title={`RAG ingéré (${count} source${count > 1 ? "s" : ""})`}
      >
        {count}
      </Badge>
    );
  }
  if (status === "file_only") {
    return (
      <Badge
        variant="secondary"
        className="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0"
        title="Fichier RAG sans ingestion web"
      >
        !
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="bg-red-100 text-red-600 text-[9px] px-1.5 py-0"
      title="Aucun RAG"
    >
      ✕
    </Badge>
  );
}

// ── Gamme row with expandable audit panel ──

interface AuditData {
  pg_id: number;
  total_kw: number;
  score: number;
  high: { total: number; found: number; pct: number };
  med: { total: number; found: number; pct: number };
  low: { total: number; found: number; pct: number };
  maillage: { r3: boolean; r4: boolean; r6: boolean };
  h1: string;
  title: string;
  missing_high: string[];
  missing_med: string[];
  message?: string;
  error?: string;
}

function GammeAuditRow({ g }: { g: GammeRow }) {
  const [expanded, setExpanded] = useState(false);
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(false);

  const missingRoles = [
    !g.has_r1 && "R1",
    !g.has_r3 && "R3",
    !g.has_r6 && "R6",
  ].filter(Boolean);
  const rowClass =
    missingRoles.length > 0
      ? "bg-red-50/30 hover:bg-red-50/60"
      : "hover:bg-muted/30";

  async function toggleExpand() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (g.kw_count > 0 && !audit) {
      setLoading(true);
      try {
        const resp = await fetch(
          `/api/admin/keyword-planner/audit?pg_id=${g.pg_id}`,
          { credentials: "include" },
        );
        if (resp.ok) setAudit(await resp.json());
      } catch {
        /* silent */
      }
      setLoading(false);
    }
  }

  return (
    <>
      <TableRow
        className={`cursor-pointer text-xs ${rowClass}`}
        onClick={toggleExpand}
      >
        <TableCell
          className={`py-1 px-3 font-medium ${missingRoles.length > 0 ? "text-red-700" : ""}`}
        >
          <span className="flex items-center gap-1">
            <ChevronRight
              className={`h-3 w-3 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
            />
            {g.pg_name}
          </span>
          {missingRoles.length > 0 && missingRoles.length < 3 && (
            <span className="ml-5 text-[9px] text-red-400 font-normal">
              {missingRoles.join(", ")} manquant
            </span>
          )}
        </TableCell>
        <TableCell className="py-1 px-1.5 text-center">
          <RoleDot ok={g.has_r1} label="R1" />
        </TableCell>
        <TableCell className="py-1 px-1.5 text-center">
          <RoleDot ok={g.has_r3} label="R3" />
        </TableCell>
        <TableCell className="py-1 px-1.5 text-center">
          <RoleDot ok={g.has_r4} label="R4" />
        </TableCell>
        <TableCell className="py-1 px-1.5 text-center">
          <RoleDot ok={g.has_r5} label="R5" />
        </TableCell>
        <TableCell className="py-1 px-1.5 text-center">
          <RoleDot ok={g.has_r6} label="R6" />
        </TableCell>
        <TableCell className="py-1 px-1.5 text-center">
          <RagDot status={g.rag_status} count={g.ingest_count} />
        </TableCell>
        <TableCell className="py-1 px-2 text-right">
          {g.kw_count > 0 ? (
            <Badge
              variant="secondary"
              className="bg-violet-100 text-violet-800"
            >
              {g.kw_count}
            </Badge>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded audit panel */}
      {expanded && (
        <TableRow>
          <TableCell colSpan={8} className="p-0">
            <div className="bg-muted/20 border-t px-4 py-3">
              {g.kw_count === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucun KW importé. Générez un prompt et importez d'abord.
                </p>
              ) : loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Chargement audit...
                </div>
              ) : audit ? (
                <div className="space-y-3">
                  {/* Score global */}
                  <div className="flex items-center gap-4">
                    <div
                      className={`text-2xl font-bold ${
                        audit.score >= 80
                          ? "text-green-600"
                          : audit.score >= 50
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}
                    >
                      {audit.score}/100
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Score intégration KW ({audit.total_kw} mots-clés)
                    </div>
                  </div>

                  {/* Vol breakdown */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "HIGH", data: audit.high, weight: "50%" },
                      { label: "MED", data: audit.med, weight: "35%" },
                      { label: "LOW", data: audit.low, weight: "15%" },
                    ].map((v) => (
                      <div
                        key={v.label}
                        className="bg-white rounded border p-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-muted-foreground">
                            {v.label} ({v.weight})
                          </span>
                          <span
                            className={`text-xs font-bold ${v.data.pct >= 80 ? "text-green-600" : v.data.pct >= 50 ? "text-amber-600" : "text-red-600"}`}
                          >
                            {v.data.found}/{v.data.total}
                          </span>
                        </div>
                        <div className="w-full h-1 bg-muted rounded-full mt-1">
                          <div
                            className={`h-full rounded-full ${v.data.pct >= 80 ? "bg-green-500" : v.data.pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${v.data.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Maillage */}
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="font-semibold text-muted-foreground uppercase">
                      Maillage :
                    </span>
                    <span
                      className={
                        audit.maillage.r3 ? "text-green-600" : "text-red-500"
                      }
                    >
                      R3 {audit.maillage.r3 ? "✓" : "✕"}
                    </span>
                    <span
                      className={
                        audit.maillage.r4 ? "text-green-600" : "text-red-500"
                      }
                    >
                      R4 {audit.maillage.r4 ? "✓" : "✕"}
                    </span>
                    <span
                      className={
                        audit.maillage.r6 ? "text-green-600" : "text-red-500"
                      }
                    >
                      R6 {audit.maillage.r6 ? "✓" : "✕"}
                    </span>
                  </div>

                  {/* Missing KW */}
                  {(audit.missing_high.length > 0 ||
                    audit.missing_med.length > 0) && (
                    <div className="text-[10px]">
                      {audit.missing_high.length > 0 && (
                        <div className="text-red-600">
                          <span className="font-bold">HIGH manquants :</span>{" "}
                          {audit.missing_high.join(", ")}
                        </div>
                      )}
                      {audit.missing_med.length > 0 && (
                        <div className="text-amber-600 mt-0.5">
                          <span className="font-bold">MED manquants :</span>{" "}
                          {audit.missing_med.slice(0, 5).join(", ")}
                          {audit.missing_med.length > 5 &&
                            ` +${audit.missing_med.length - 5}`}
                        </div>
                      )}
                    </div>
                  )}

                  {/* H1 & Title */}
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    <div>
                      <span className="font-bold">H1:</span> {audit.h1}
                    </div>
                    <div>
                      <span className="font-bold">Title:</span> {audit.title}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Erreur chargement audit
                </p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
