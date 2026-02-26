/**
 * ADMIN GAMME SEO DETAIL
 *
 * Dashboard centralise pour gerer tout le contenu SEO d'une gamme
 * - SEO: Meta title, description, H1, content, switches
 * - Blog: Articles conseil lies
 * - Vehicules: Compatibilites par niveau
 * - V-Level: Motorisations championnes
 * - Conseils: Conseils remplacement
 *
 * REFACTORED: Tab components extracted to reduce file size
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  useNavigation,
  Link,
  useFetcher,
} from "@remix-run/react";
import {
  ArrowLeft,
  BarChart3,
  Eye,
  FileText,
  Car,
  TrendingUp,
  Wrench,
  Calendar,
  ExternalLink,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  ToggleLeft,
  ToggleRight,
  Save,
} from "lucide-react";
import { useState } from "react";

import {
  type GammeDetail,
  type LoaderFreshness,
  type SeoFormState,
  getFreshnessStatus,
  getDefaultGuideForm,
  SeoTabContent,
  VLevelTab,
  VehiclesTab,
} from "~/components/admin/gamme-seo";
import { VLevelImportDialog } from "~/components/admin/VLevelImportDialog";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";

// Import extracted components
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction<typeof loader> = ({ data }) =>
  createNoIndexMeta(
    data?.detail?.gamme?.pg_name
      ? `${data.detail.gamme.pg_name} - Admin`
      : "Gamme SEO - Admin",
  );

// Loader
export async function loader({ request, params }: LoaderFunctionArgs) {
  const pgId = params.pgId;
  if (!pgId) {
    throw new Response("pgId manquant", { status: 400 });
  }

  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  const response = await fetch(
    `${backendUrl}/api/admin/gammes-seo/${pgId}/detail`,
    {
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    // Handle different error statuses appropriately
    if (response.status === 401 || response.status === 403) {
      throw new Response("Non autorise", { status: response.status });
    }
    if (response.status === 404) {
      throw new Response("Gamme non trouvee", { status: 404 });
    }
    // For other errors, try to get error message from response
    let errorMessage = "Erreur serveur";
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch {
      // Ignore JSON parse error
    }
    throw new Response(errorMessage, { status: response.status });
  }

  const result = await response.json();

  if (!result.success) {
    throw new Response(result.message || "Erreur", { status: 500 });
  }

  // Pre-calculate freshness values server-side to avoid hydration mismatch
  const now = Date.now();
  const detail = result.data as GammeDetail;

  // Helper for relative time (SSR-safe)
  const getRelativeTime = (dateStr: string | null): string => {
    if (!dateStr) return "Jamais";
    const days = Math.floor(
      (now - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Hier";
    if (days < 30) return `Il y a ${days} jours`;
    if (days < 365) return `Il y a ${Math.floor(days / 30)} mois`;
    return `Il y a ${Math.floor(days / 365)} an(s)`;
  };

  const freshness: LoaderFreshness = {
    vLevel: getFreshnessStatus(detail.stats?.vLevel_last_updated || null, now),
    articles: getFreshnessStatus(detail.stats?.last_article_date || null, now),
    articleRelativeTime: getRelativeTime(
      detail.stats?.last_article_date || null,
    ),
  };

  return json({ detail, freshness });
}

// Action
export async function action({ request, params }: ActionFunctionArgs) {
  const pgId = params.pgId;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    if (intent === "updateSeo") {
      const seoData = {
        sg_title: formData.get("sg_title") as string,
        sg_descrip: formData.get("sg_descrip") as string,
        sg_keywords: formData.get("sg_keywords") as string,
        sg_h1: formData.get("sg_h1") as string,
        sg_content: formData.get("sg_content") as string,
      };

      const response = await fetch(
        `${backendUrl}/api/admin/gammes-seo/${pgId}/seo`,
        {
          method: "PATCH",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify(seoData),
        },
      );

      return json(await response.json());
    }

    if (intent === "updateSwitch") {
      const alias = formData.get("alias") as string;
      const content = formData.get("content") as string;

      const response = await fetch(
        `${backendUrl}/api/admin/gammes-seo/${pgId}/switch/${alias}`,
        {
          method: "PATCH",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );

      return json(await response.json());
    }

    if (intent === "updatePurchaseGuide") {
      const guideDataRaw = formData.get("guideData") as string;
      const guideData = JSON.parse(guideDataRaw);

      const response = await fetch(
        `${backendUrl}/api/admin/gammes-seo/${pgId}/purchase-guide`,
        {
          method: "PUT",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify(guideData),
        },
      );

      return json(await response.json());
    }

    // === TOGGLE INDEX/NOINDEX ===
    if (intent === "toggleIndex") {
      const newLevel = formData.get("newLevel") as string;
      const response = await fetch(
        `${backendUrl}/api/admin/gammes-seo/${pgId}`,
        {
          method: "PATCH",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            pg_level: newLevel,
            pg_relfollow: newLevel === "1" ? "1" : "0",
            pg_sitemap: newLevel === "1" ? "1" : "0",
          }),
        },
      );

      return json(await response.json());
    }

    return json({ success: false, message: "Action non reconnue" });
  } catch (error) {
    return json({
      success: false,
      message: error instanceof Error ? error.message : "Erreur",
    });
  }
}

// Component
export default function AdminGammeSeoDetail() {
  const { detail, freshness } = useLoaderData<typeof loader>();
  const _navigation = useNavigation();
  const fetcher = useFetcher();

  // Local state for SEO form
  const [seoForm, setSeoForm] = useState<SeoFormState>({
    sg_title: detail.seo.sg_title || "",
    sg_descrip: detail.seo.sg_descrip || "",
    sg_keywords: detail.seo.sg_keywords || "",
    sg_h1: detail.seo.sg_h1 || "",
    sg_content: detail.seo.sg_content || "",
  });

  // State for article edit modal
  const [editingArticle, setEditingArticle] = useState<{
    ba_id: number;
    ba_title: string;
    ba_preview: string;
  } | null>(null);
  const [editForm, setEditForm] = useState({ title: "", preview: "" });
  const [isEditSaving, setIsEditSaving] = useState(false);

  // State for VLevel import dialog
  const [showVLevelImport, setShowVLevelImport] = useState(false);

  // State for Purchase Guide form
  const [guideForm, setGuideForm] = useState(() => {
    if (detail.purchaseGuide) {
      return {
        step1: detail.purchaseGuide.step1,
        step2: detail.purchaseGuide.step2,
        step3: detail.purchaseGuide.step3,
      };
    }
    return getDefaultGuideForm(detail.gamme.pg_name);
  });
  const [guideSaving, setGuideSaving] = useState(false);

  // Helper to update nested guide form state
  const updateGuideForm = (path: string, value: unknown) => {
    setGuideForm((prev) => {
      const newForm = JSON.parse(JSON.stringify(prev));
      const parts = path.split(".");
      let current: Record<string, unknown> = newForm;
      for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]] as Record<string, unknown>;
      }
      current[parts[parts.length - 1]] = value;
      return newForm;
    });
  };

  // Save purchase guide
  const savePurchaseGuide = async () => {
    setGuideSaving(true);
    try {
      const formData = new FormData();
      formData.append("intent", "updatePurchaseGuide");
      formData.append("guideData", JSON.stringify(guideForm));
      fetcher.submit(formData, { method: "post" });
    } finally {
      setGuideSaving(false);
    }
  };

  // Open edit modal for an article
  const openEditModal = (article: (typeof detail.articles)[0]) => {
    setEditingArticle({
      ba_id: article.ba_id,
      ba_title: article.ba_title,
      ba_preview: article.ba_preview,
    });
    setEditForm({ title: article.ba_title, preview: article.ba_preview });
  };

  // Save article changes
  const saveArticle = async () => {
    if (!editingArticle) return;

    setIsEditSaving(true);
    try {
      const response = await fetch(`/api/blog/advice/${editingArticle.ba_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: editForm.title,
          preview: editForm.preview,
        }),
      });

      const result = await response.json();
      if (result.success) {
        window.location.reload();
      } else {
        alert("Erreur: " + (result.message || "Impossible de sauvegarder"));
      }
    } catch {
      alert("Erreur de connexion");
    } finally {
      setIsEditSaving(false);
      setEditingArticle(null);
    }
  };

  // Status badges
  const isIndexed = detail.gamme.pg_level === "1";
  const isG1 = detail.gamme.pg_top === "1";
  const inSitemap = detail.gamme.pg_sitemap === "1";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Breadcrumb */}
      <PublicBreadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: `Gammes SEO > ${detail.gamme.pg_name}` },
        ]}
      />

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/gammes-seo">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{detail.gamme.pg_name}</h1>
            <p className="text-sm text-gray-500">/{detail.gamme.pg_alias}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Status badges */}
          <Badge variant={isIndexed ? "default" : "secondary"}>
            {isIndexed ? "INDEX" : "NOINDEX"}
          </Badge>
          {isG1 && <Badge className="bg-amber-500">G1</Badge>}
          <Badge variant={inSitemap ? "outline" : "secondary"}>
            {inSitemap ? "Sitemap" : "No Sitemap"}
          </Badge>

          {/* Toggle Index button */}
          <fetcher.Form method="post" className="inline">
            <input type="hidden" name="intent" value="toggleIndex" />
            <input
              type="hidden"
              name="newLevel"
              value={isIndexed ? "2" : "1"}
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className={
                isIndexed
                  ? "text-red-600 hover:bg-red-50"
                  : "text-green-600 hover:bg-green-50"
              }
            >
              {isIndexed ? (
                <>
                  <ToggleRight className="mr-1 h-4 w-4" /> Desindexer
                </>
              ) : (
                <>
                  <ToggleLeft className="mr-1 h-4 w-4" /> Indexer
                </>
              )}
            </Button>
          </fetcher.Form>

          {/* Preview link */}
          <a
            href={`https://www.automecanik.com/pieces/${detail.gamme.pg_alias}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <Eye className="mr-2 h-4 w-4" />
              Voir
            </Button>
          </a>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6">
        <div className="grid grid-cols-6 gap-4">
          {/* Products */}
          <Card
            className={
              detail.stats.products_count > 0
                ? "border-green-200"
                : "border-gray-200"
            }
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-500">Produits</p>
                  <p className="text-2xl font-bold">
                    {detail.stats.products_count}
                  </p>
                </div>
                <div
                  className={`p-2 rounded-full ${detail.stats.products_count > 0 ? "bg-green-100" : "bg-gray-100"}`}
                >
                  <BarChart3
                    className={`h-6 w-6 ${detail.stats.products_count > 0 ? "text-green-600" : "text-gray-400"}`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vehicles */}
          <Card
            className={
              detail.stats.vehicles_total_count > 0
                ? "border-orange-200"
                : "border-gray-200"
            }
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-500">Vehicules</p>
                  <p className="text-2xl font-bold">
                    {detail.stats.vehicles_total_count}
                  </p>
                </div>
                <div
                  className={`p-2 rounded-full ${detail.stats.vehicles_total_count > 0 ? "bg-orange-100" : "bg-gray-100"}`}
                >
                  <Car
                    className={`h-6 w-6 ${detail.stats.vehicles_total_count > 0 ? "text-orange-600" : "text-gray-400"}`}
                  />
                </div>
              </div>
              <div className="flex gap-1 text-xs text-gray-400">
                <span>L1: {detail.stats.vehicles_level1_count}</span>
                <span>L2: {detail.stats.vehicles_level2_count}</span>
                <span>L5: {detail.stats.vehicles_level5_count}</span>
              </div>
            </CardContent>
          </Card>

          {/* Articles */}
          <Card
            className={
              detail.stats.articles_count > 0
                ? "border-blue-200"
                : "border-gray-200"
            }
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-500">Articles</p>
                  <p className="text-2xl font-bold">
                    {detail.stats.articles_count}
                  </p>
                </div>
                <div
                  className={`p-2 rounded-full ${detail.stats.articles_count > 0 ? "bg-blue-100" : "bg-gray-100"}`}
                >
                  <FileText
                    className={`h-6 w-6 ${detail.stats.articles_count > 0 ? "text-blue-600" : "text-gray-400"}`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* V-Level */}
          <Card
            className={
              detail.stats.vLevel_total_count > 0
                ? "border-purple-200"
                : "border-gray-200"
            }
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-500">V-Level</p>
                  <p className="text-2xl font-bold">
                    {detail.stats.vLevel_total_count}
                  </p>
                </div>
                <div
                  className={`p-2 rounded-full ${detail.stats.vLevel_total_count > 0 ? "bg-purple-100" : "bg-gray-100"}`}
                >
                  <TrendingUp
                    className={`h-6 w-6 ${detail.stats.vLevel_total_count > 0 ? "text-purple-600" : "text-gray-400"}`}
                  />
                </div>
              </div>
              <div className="flex gap-1 text-xs text-gray-400">
                <span>V1: {detail.stats.vLevel_v1_count}</span>
                <span>V2: {detail.stats.vLevel_v2_count}</span>
                <span>V3: {detail.stats.vLevel_v3_count}</span>
              </div>
            </CardContent>
          </Card>

          {/* Keywords SEO */}
          <Card
            className={
              detail.stats.keyword_total > 0
                ? "border-indigo-200"
                : "border-gray-200"
            }
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-500">Keywords</p>
                  <p className="text-2xl font-bold">
                    {detail.stats.keyword_total}
                  </p>
                </div>
                <div
                  className={`p-2 rounded-full ${detail.stats.keyword_total > 0 ? "bg-indigo-100" : "bg-gray-100"}`}
                >
                  <Search
                    className={`h-6 w-6 ${detail.stats.keyword_total > 0 ? "text-indigo-600" : "text-gray-400"}`}
                  />
                </div>
              </div>
              <div className="text-xs text-gray-400">
                G-Level:{" "}
                <span
                  className={`font-semibold ${detail.stats.g_level === "G1" ? "text-amber-600" : "text-blue-600"}`}
                >
                  {detail.stats.g_level || "G3"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Last Article */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-500">Dernier article</p>
                  <p className="text-lg font-medium">
                    {detail.stats.last_article_date
                      ? new Date(
                          detail.stats.last_article_date,
                        ).toLocaleDateString("fr-FR")
                      : "Aucun"}
                  </p>
                </div>
                <div className="p-2 rounded-full bg-gray-100">
                  <Calendar className="h-6 w-6 text-gray-600" />
                </div>
              </div>
              {detail.stats.last_article_date && (
                <p className="text-xs text-gray-400">
                  {freshness.articleRelativeTime}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="seo" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="seo" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            SEO
          </TabsTrigger>
          <TabsTrigger value="blog" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Blog ({detail.articles.length})
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="flex items-center gap-2">
            <Car className="h-4 w-4" />
            Vehicules
          </TabsTrigger>
          <TabsTrigger value="vlevel" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            V-Level
          </TabsTrigger>
          <TabsTrigger value="conseils" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Conseils ({detail.conseils.length})
          </TabsTrigger>
          <TabsTrigger value="guide" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Guide d'achat
            {detail.purchaseGuide && (
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB SEO - Using extracted component */}
        <TabsContent value="seo">
          <SeoTabContent
            detail={detail}
            seoForm={seoForm}
            setSeoForm={setSeoForm}
            pgId={detail.gamme.pg_id}
          />
        </TabsContent>

        {/* TAB BLOG */}
        <TabsContent value="blog">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Articles Blog</CardTitle>
                <CardDescription>
                  Articles conseil lies a cette gamme
                </CardDescription>
              </div>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nouvel article
              </Button>
            </CardHeader>
            <CardContent>
              {detail.articles.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Aucun article pour cette gamme
                </p>
              ) : (
                <div className="space-y-4">
                  {detail.articles.map((article) => (
                    <div
                      key={article.ba_id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium">{article.ba_title}</h4>
                        <p className="text-sm text-gray-500 line-clamp-1">
                          {article.ba_preview}
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                          <span>{article.ba_visit} visites</span>
                          <span>{article.sections_count} sections</span>
                          <span>
                            Maj:{" "}
                            {new Date(article.ba_update).toLocaleDateString(
                              "fr-FR",
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://www.automecanik.com/blog-pieces-auto/conseils/${article.ba_alias}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(article)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB VEHICLES - Using extracted component */}
        <TabsContent value="vehicles">
          <VehiclesTab detail={detail} />
        </TabsContent>

        {/* TAB V-LEVEL - Using extracted component */}
        <TabsContent value="vlevel">
          <VLevelTab
            detail={detail}
            freshness={freshness}
            onShowImport={() => setShowVLevelImport(true)}
          />
        </TabsContent>

        {/* TAB CONSEILS */}
        <TabsContent value="conseils">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Conseils Remplacement</CardTitle>
                <CardDescription>
                  Conseils affiches sur la page gamme
                </CardDescription>
              </div>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau conseil
              </Button>
            </CardHeader>
            <CardContent>
              {detail.conseils.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Aucun conseil pour cette gamme
                </p>
              ) : (
                <div className="space-y-4">
                  {detail.conseils.map((conseil) => (
                    <div key={conseil.sgc_id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{conseil.sgc_title}</h4>
                          <p className="mt-1 text-sm text-gray-600">
                            {conseil.sgc_content}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB GUIDE D'ACHAT */}
        <TabsContent value="guide">
          <div className="space-y-6">
            {/* Status */}
            <Card
              className={
                detail.purchaseGuide ? "border-green-200" : "border-orange-200"
              }
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {detail.purchaseGuide ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="font-medium text-green-700">
                          Guide d'achat configure
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-orange-500" />
                        <span className="font-medium text-orange-700">
                          Guide d'achat a configurer
                        </span>
                      </>
                    )}
                  </div>
                  <Button onClick={savePurchaseGuide} disabled={guideSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    {guideSaving ? "Sauvegarde..." : "Sauvegarder le guide"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Step 1 - Identification */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                    Etape 1
                  </span>
                  Identification
                </CardTitle>
                <CardDescription>
                  Aide l'utilisateur a identifier la piece dont il a besoin
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="step1_title">Titre</Label>
                  <Input
                    id="step1_title"
                    value={guideForm.step1.title}
                    onChange={(e) =>
                      updateGuideForm("step1.title", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="step1_content">Contenu</Label>
                  <Textarea
                    id="step1_content"
                    value={guideForm.step1.content}
                    onChange={(e) =>
                      updateGuideForm("step1.content", e.target.value)
                    }
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="step1_highlight">Mise en avant</Label>
                  <Input
                    id="step1_highlight"
                    value={guideForm.step1.highlight}
                    onChange={(e) =>
                      updateGuideForm("step1.highlight", e.target.value)
                    }
                    placeholder="Ex: Verifiez toujours le diametre"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Step 2 - Price ranges */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                    Etape 2
                  </span>
                  Gammes de prix
                </CardTitle>
                <CardDescription>
                  Definissez les 3 gammes de prix disponibles
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Economique */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium mb-3">Economique</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Sous-titre</Label>
                      <Input
                        value={guideForm.step2.economique.subtitle}
                        onChange={(e) =>
                          updateGuideForm(
                            "step2.economique.subtitle",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Fourchette de prix</Label>
                      <Input
                        value={guideForm.step2.economique.priceRange}
                        onChange={(e) =>
                          updateGuideForm(
                            "step2.economique.priceRange",
                            e.target.value,
                          )
                        }
                        placeholder="Ex: 15-30 euros"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Description</Label>
                      <Textarea
                        value={guideForm.step2.economique.description}
                        onChange={(e) =>
                          updateGuideForm(
                            "step2.economique.description",
                            e.target.value,
                          )
                        }
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                {/* Qualite Plus */}
                <div className="border rounded-lg p-4 bg-blue-50">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    Qualite Plus
                    <Badge className="bg-blue-600">Le plus choisi</Badge>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Sous-titre</Label>
                      <Input
                        value={guideForm.step2.qualitePlus.subtitle}
                        onChange={(e) =>
                          updateGuideForm(
                            "step2.qualitePlus.subtitle",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Fourchette de prix</Label>
                      <Input
                        value={guideForm.step2.qualitePlus.priceRange}
                        onChange={(e) =>
                          updateGuideForm(
                            "step2.qualitePlus.priceRange",
                            e.target.value,
                          )
                        }
                        placeholder="Ex: 30-60 euros"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Description</Label>
                      <Textarea
                        value={guideForm.step2.qualitePlus.description}
                        onChange={(e) =>
                          updateGuideForm(
                            "step2.qualitePlus.description",
                            e.target.value,
                          )
                        }
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                {/* Premium */}
                <div className="border rounded-lg p-4 bg-amber-50">
                  <h4 className="font-medium mb-3">Premium</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Sous-titre</Label>
                      <Input
                        value={guideForm.step2.premium.subtitle}
                        onChange={(e) =>
                          updateGuideForm(
                            "step2.premium.subtitle",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Fourchette de prix</Label>
                      <Input
                        value={guideForm.step2.premium.priceRange}
                        onChange={(e) =>
                          updateGuideForm(
                            "step2.premium.priceRange",
                            e.target.value,
                          )
                        }
                        placeholder="Ex: 60-120 euros"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Description</Label>
                      <Textarea
                        value={guideForm.step2.premium.description}
                        onChange={(e) =>
                          updateGuideForm(
                            "step2.premium.description",
                            e.target.value,
                          )
                        }
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 3 - Safety */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                    Etape 3
                  </span>
                  Securite et conseils
                </CardTitle>
                <CardDescription>
                  Informations de securite et conseils importants
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="step3_title">Titre</Label>
                  <Input
                    id="step3_title"
                    value={guideForm.step3.title}
                    onChange={(e) =>
                      updateGuideForm("step3.title", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="step3_content">Contenu</Label>
                  <Textarea
                    id="step3_content"
                    value={guideForm.step3.content}
                    onChange={(e) =>
                      updateGuideForm("step3.content", e.target.value)
                    }
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Article Dialog */}
      <Dialog
        open={!!editingArticle}
        onOpenChange={() => setEditingArticle(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'article</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_title">Titre</Label>
              <Input
                id="edit_title"
                value={editForm.title}
                onChange={(e) =>
                  setEditForm({ ...editForm, title: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="edit_preview">Apercu</Label>
              <Textarea
                id="edit_preview"
                value={editForm.preview}
                onChange={(e) =>
                  setEditForm({ ...editForm, preview: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingArticle(null)}>
              Annuler
            </Button>
            <Button onClick={saveArticle} disabled={isEditSaving}>
              {isEditSaving ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VLevel Import Dialog */}
      <VLevelImportDialog
        open={showVLevelImport}
        onOpenChange={setShowVLevelImport}
        pgId={detail.gamme.pg_id}
        gammeName={detail.gamme.pg_name}
      />
    </div>
  );
}
