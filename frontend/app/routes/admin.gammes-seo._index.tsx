/**
 * 🎯 ADMIN GAMMES SEO
 *
 * Page d'administration pour la classification G-Level des 230 gammes
 * - KPIs: INDEX vs NOINDEX, G1/G2/G3
 * - Tableau filtrable avec données Trends
 * - Actions en masse: Promouvoir INDEX, Marquer G1, etc.
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
  useSearchParams,
  Link,
} from "@remix-run/react";
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Filter,
  History,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  Star,
  XCircle,
} from "lucide-react";
import React, { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

import { AdminBreadcrumb } from "~/components/admin/AdminBreadcrumb";
import { Alert } from "~/components/ui/alert";
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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";

export const meta: MetaFunction = () => [
  { title: "Gammes SEO | Admin AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/admin/gammes-seo",
  },
];

// Smart Action types
type SmartActionType =
  | "INDEX_G1"
  | "INDEX"
  | "INVESTIGUER"
  | "OBSERVER"
  | "PARENT"
  | "EVALUER"
  | "NOINDEX";

// Types
interface GammeSeoItem {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  pg_level: string;
  pg_top: string;
  pg_relfollow: string;
  pg_sitemap: string;
  pg_display: string;
  trends_index: number;
  g_level_recommended: string;
  action_recommended: string | null;
  user_notes: string | null;
  user_action: string | null;
  trends_updated_at: string | null;
  family_name: string | null;
  family_id: number | null;
  // Agent 2 - SEO Expert data
  seo_score: number;
  serp_score: number;
  search_intent: string;
  competition_level: string;
  competition_difficulty: number;
  shopping_likely: boolean;
  paa_count: number;
  commercial_value: number;
  // Smart Action (calculé backend)
  smart_action?: SmartActionType;
  smart_action_description?: string;
  // Badges v2 (from gamme_aggregates)
  priority_score?: number;
  execution_status?: string;
  final_priority?: string;
  catalog_status?: string;
  vehicle_coverage?: string;
  content_depth?: string;
  content_words_total?: number;
}

interface _GammeSeoStats {
  total: number;
  indexed: number;
  noindexed: number;
  g1Count: number;
  g2Count: number;
  g3Count: number;
  toPromoteIndex: number;
  toPromoteG1: number;
  toVerifyG1: number;
  inSitemap: number;
  avgTrends: number;
}

interface Family {
  id: number;
  name: string;
}

// Seuils configurables
interface SmartActionThresholds {
  trends_high: number;
  trends_medium: number;
  seo_excellent: number;
  seo_good: number;
}

// Historique des actions
interface AuditEntry {
  id: number;
  admin_id: number;
  admin_email: string;
  action_type: string;
  entity_type: string;
  entity_ids: number[] | null;
  old_values: unknown;
  new_values: unknown;
  impact_summary: string;
  created_at: string;
}

// Loader
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  // Extract query params
  const page = url.searchParams.get("page") || "1";
  const limit = url.searchParams.get("limit") || "50";
  const search = url.searchParams.get("search") || "";
  const familyId = url.searchParams.get("familyId") || "";
  const gLevel = url.searchParams.get("gLevel") || "";
  const status = url.searchParams.get("status") || "";
  const actionRecommended = url.searchParams.get("actionRecommended") || "";
  const sortBy = url.searchParams.get("sortBy") || "family_name";
  const sortOrder = url.searchParams.get("sortOrder") || "desc"; // desc = ordre par défaut backend

  try {
    // Build query string
    const params = new URLSearchParams();
    params.set("page", page);
    params.set("limit", limit);
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    if (search) params.set("search", search);
    if (familyId) params.set("familyId", familyId);
    if (gLevel) params.set("gLevel", gLevel);
    if (status) params.set("status", status);
    if (actionRecommended) params.set("actionRecommended", actionRecommended);

    // Fetch data in parallel
    const [gammesRes, statsRes, familiesRes, thresholdsRes, auditRes] =
      await Promise.all([
        fetch(`${backendUrl}/api/admin/gammes-seo?${params.toString()}`, {
          headers: { Cookie: cookieHeader },
        }),
        fetch(`${backendUrl}/api/admin/gammes-seo/stats`, {
          headers: { Cookie: cookieHeader },
        }),
        fetch(`${backendUrl}/api/admin/gammes-seo/families`, {
          headers: { Cookie: cookieHeader },
        }),
        fetch(`${backendUrl}/api/admin/gammes-seo/thresholds`, {
          headers: { Cookie: cookieHeader },
        }),
        fetch(`${backendUrl}/api/admin/gammes-seo/audit?limit=10`, {
          headers: { Cookie: cookieHeader },
        }),
      ]);

    const gammesData = gammesRes.ok ? await gammesRes.json() : null;
    const statsData = statsRes.ok ? await statsRes.json() : null;
    const familiesData = familiesRes.ok ? await familiesRes.json() : null;
    const thresholdsData = thresholdsRes.ok ? await thresholdsRes.json() : null;
    const auditData = auditRes.ok ? await auditRes.json() : null;

    return json({
      gammes: gammesData?.data || [],
      total: gammesData?.total || 0,
      page: gammesData?.page || 1,
      totalPages: gammesData?.totalPages || 1,
      stats: statsData?.data || null,
      families: familiesData?.data || [],
      thresholds: thresholdsData?.data?.thresholds || {
        trends_high: 50,
        trends_medium: 20,
        seo_excellent: 75,
        seo_good: 45,
      },
      auditHistory: auditData?.data || [],
      filters: {
        search,
        familyId,
        gLevel,
        status,
        actionRecommended,
        sortBy,
        sortOrder,
      },
      error: null,
    });
  } catch (error) {
    logger.error("[Admin Gammes SEO] Error:", error);
    return json({
      gammes: [],
      total: 0,
      page: 1,
      totalPages: 1,
      stats: null,
      families: [],
      thresholds: {
        trends_high: 50,
        trends_medium: 20,
        seo_excellent: 75,
        seo_good: 45,
      },
      auditHistory: [],
      filters: {
        search: "",
        familyId: "",
        gLevel: "",
        status: "",
        actionRecommended: "",
        sortBy: "family_name",
        sortOrder: "desc",
      },
      error: "Erreur chargement données",
    });
  }
}

// Action
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("_action");
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    switch (actionType) {
      case "update-single": {
        const pgId = formData.get("pgId");
        const field = formData.get("field");
        const value = formData.get("value");

        const response = await fetch(
          `${backendUrl}/api/admin/gammes-seo/${pgId}`,
          {
            method: "PATCH",
            headers: {
              Cookie: cookieHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ [field as string]: value }),
          },
        );

        const result = await response.json();
        return json({ success: result.success, message: result.message });
      }

      case "batch-action": {
        const pgIds = JSON.parse((formData.get("pgIds") as string) || "[]");
        const actionId = formData.get("actionId");

        const response = await fetch(
          `${backendUrl}/api/admin/gammes-seo/action`,
          {
            method: "POST",
            headers: {
              Cookie: cookieHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ pgIds, actionId }),
          },
        );

        const result = await response.json();
        return json({
          success: result.success,
          message: result.message,
          updated: result.updated,
        });
      }

      case "regenerate-sitemap": {
        const response = await fetch(
          `${backendUrl}/api/sitemap/generate-all?skipValidation=true`,
          {
            method: "POST",
            headers: {
              Cookie: cookieHeader,
              "Content-Type": "application/json",
            },
          },
        );

        const result = await response.json();
        if (result.success) {
          return json({
            success: true,
            message: `Sitemap régénéré: ${result.data?.totalUrls || 0} URLs dans ${result.data?.files?.length || 0} fichiers`,
            sitemapData: result.data,
          });
        }
        return json({
          success: false,
          message: result.message || "Erreur lors de la régénération",
        });
      }

      default:
        return json({ success: false, message: "Action inconnue" });
    }
  } catch (error) {
    return json({
      success: false,
      message: error instanceof Error ? error.message : "Erreur",
    });
  }
}

// Component
export default function AdminGammesSeo() {
  const {
    gammes,
    total,
    page,
    totalPages,
    stats,
    families,
    thresholds,
    auditHistory,
    filters,
    error,
  } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLoading = navigation.state === "loading";

  // State pour les seuils configurables
  const [editThresholds, setEditThresholds] =
    useState<SmartActionThresholds>(thresholds);
  const [isThresholdsModified, setIsThresholdsModified] = useState(false);
  const [isSavingThresholds, setIsSavingThresholds] = useState(false);
  const [showThresholdsPanel, setShowThresholdsPanel] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [isRegeneratingSitemap, setIsRegeneratingSitemap] = useState(false);
  const [lastSitemapResult, setLastSitemapResult] = useState<{
    totalUrls: number;
    files: number;
    timestamp: string;
  } | null>(null);

  // Sync thresholds when data changes
  useEffect(() => {
    setEditThresholds(thresholds);
    setIsThresholdsModified(false);
  }, [thresholds]);

  // Handler pour modifier un seuil
  const handleThresholdChange = (
    key: keyof SmartActionThresholds,
    value: number,
  ) => {
    setEditThresholds((prev) => ({ ...prev, [key]: value }));
    setIsThresholdsModified(true);
  };

  // Sauvegarder les seuils
  const handleSaveThresholds = async () => {
    setIsSavingThresholds(true);
    try {
      const response = await fetch("/api/admin/gammes-seo/thresholds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editThresholds),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        toast.success("Seuils sauvegardés");
        setIsThresholdsModified(false);
        window.location.reload();
      } else {
        toast.error(result.message || "Erreur sauvegarde");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setIsSavingThresholds(false);
    }
  };

  // Réinitialiser les seuils
  const handleResetThresholds = async () => {
    const confirmed = window.confirm(
      "Réinitialiser les seuils aux valeurs par défaut ?",
    );
    if (!confirmed) return;

    setIsSavingThresholds(true);
    try {
      const response = await fetch("/api/admin/gammes-seo/thresholds/reset", {
        method: "POST",
        credentials: "include",
      });

      const result = await response.json();
      if (response.ok && result.success) {
        toast.success("Seuils réinitialisés");
        window.location.reload();
      } else {
        toast.error(result.message || "Erreur reset");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setIsSavingThresholds(false);
    }
  };

  // Handler pour régénérer le sitemap
  const handleRegenerateSitemap = async () => {
    const confirmed = window.confirm(
      "Régénérer tous les sitemaps ? Cette opération peut prendre 30-60 secondes.",
    );
    if (!confirmed) return;

    setIsRegeneratingSitemap(true);
    try {
      const formData = new FormData();
      formData.append("_action", "regenerate-sitemap");

      const response = await fetch("/admin/gammes-seo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const result = await response.json();
      if (result.success) {
        setLastSitemapResult({
          totalUrls: result.sitemapData?.totalUrls || 0,
          files: result.sitemapData?.files?.length || 0,
          timestamp: new Date().toLocaleString("fr-FR"),
        });
        toast.success(result.message);
      } else {
        toast.error(result.message || "Erreur lors de la régénération");
      }
    } catch {
      toast.error("Erreur réseau lors de la régénération");
    } finally {
      setIsRegeneratingSitemap(false);
    }
  };

  // Helper pour calculer le Smart Action d'une gamme
  // Utilise la valeur backend si disponible, sinon calcule côté client avec seuils configurables
  const getSmartActionType = (gamme: GammeSeoItem): SmartActionType => {
    // Priorité au backend si disponible
    if (gamme.smart_action) return gamme.smart_action;

    // Fallback: calcul côté client avec seuils configurables
    const trends = gamme.trends_index || 0;
    const seoScore = gamme.seo_score || 0;
    const th = editThresholds;
    if (trends >= th.trends_high && seoScore >= th.seo_excellent)
      return "INDEX_G1";
    if (trends >= th.trends_high && seoScore >= th.seo_good) return "INDEX";
    if (trends >= th.trends_high && seoScore < th.seo_good)
      return "INVESTIGUER";
    if (trends >= th.trends_medium && seoScore >= th.seo_excellent)
      return "OBSERVER";
    if (trends < th.trends_medium && seoScore >= th.seo_excellent)
      return "PARENT";
    if (trends >= th.trends_medium && seoScore >= th.seo_good) return "EVALUER";
    return "NOINDEX";
  };

  // Handler pour click-to-filter sur les KPIs Smart Actions
  const handleSmartActionClick = (actionType: SmartActionType | "all") => {
    const params = new URLSearchParams(searchParams);
    if (actionType === "all") {
      params.delete("smartAction");
    } else {
      params.set("smartAction", actionType);
    }
    setSearchParams(params);
  };

  // Filtre Smart Action côté client
  const smartActionFilter = searchParams.get("smartAction");
  const filteredGammes = React.useMemo(() => {
    if (!smartActionFilter || smartActionFilter === "all") return gammes;
    return gammes.filter(
      (g: GammeSeoItem) => getSmartActionType(g) === smartActionFilter,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gammes, smartActionFilter]);

  // Stats des Smart Actions (calculées côté client) - sur gammes non filtrées
  const smartActionStats = React.useMemo(() => {
    const counts = {
      INDEX_G1: 0,
      INDEX: 0,
      INVESTIGUER: 0,
      OBSERVER: 0,
      PARENT: 0,
      EVALUER: 0,
      NOINDEX: 0,
    };
    gammes.forEach((g: GammeSeoItem) => {
      const action = getSmartActionType(g);
      counts[action as keyof typeof counts]++;
    });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gammes]);

  // Handlers
  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams);
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.set("page", "1"); // Reset to first page
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams);
      params.set("page", String(newPage));
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const handleSort = useCallback(
    (column: string) => {
      const params = new URLSearchParams(searchParams);
      const currentSortBy = params.get("sortBy") || "trends_index";
      const currentOrder = params.get("sortOrder") || "desc";

      if (currentSortBy === column) {
        params.set("sortOrder", currentOrder === "asc" ? "desc" : "asc");
      } else {
        params.set("sortBy", column);
        params.set("sortOrder", "desc");
      }
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(filteredGammes.map((g: GammeSeoItem) => g.pg_id));
      } else {
        setSelectedIds([]);
      }
    },
    [filteredGammes],
  );

  const handleSelectOne = useCallback((pgId: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, pgId]);
    } else {
      setSelectedIds((prev) => prev.filter((id) => id !== pgId));
    }
  }, []);

  // Action batch via appel direct à l'API (plus fiable que Remix useSubmit)
  const handleBatchAction = async (actionId: string) => {
    if (selectedIds.length === 0) {
      toast.warning("Sélectionnez au moins une gamme");
      return;
    }

    const actionLabels: Record<string, string> = {
      PROMOTE_INDEX: `Promouvoir ${selectedIds.length} gamme(s) en INDEX`,
      DEMOTE_NOINDEX: `Passer ${selectedIds.length} gamme(s) en NOINDEX`,
      MARK_G1: `Marquer ${selectedIds.length} gamme(s) comme G1`,
      UNMARK_G1: `Retirer G1 de ${selectedIds.length} gamme(s)`,
    };

    const confirmed = window.confirm(
      `${actionLabels[actionId] || actionId}\n\nConfirmer cette action ?`,
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/gammes-seo/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pgIds: selectedIds, actionId }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(result.message || "Action effectuée");
        setSelectedIds([]);
        window.location.reload();
      } else {
        toast.error(result.message || `Erreur ${response.status}`);
      }
    } catch (error) {
      toast.error("Erreur réseau");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Badge Priorité unifié (G1/INDEX/NOINDEX) - remplace G-Level + Statut
  const getPriorityBadge = (pgTop: string, pgLevel: string) => {
    // G1 = prioritaire (toujours indexé)
    if (pgTop === "1") {
      return (
        <Badge className="bg-emerald-600 text-white font-bold px-3 py-1 shadow-sm">
          <Star className="h-3 w-3 mr-1 inline" />
          G1
        </Badge>
      );
    }
    // INDEX = niveau principal (pg_level = 1) - VERT pour cohérence visuelle
    if (pgLevel === "1") {
      return (
        <Badge className="bg-green-600 text-white font-medium px-3 py-1">
          <Eye className="h-3 w-3 mr-1 inline" />
          INDEX
        </Badge>
      );
    }
    // NOINDEX = niveau accessoire (pg_level = 2)
    return (
      <Badge className="bg-slate-400 text-white px-3 py-1">
        <EyeOff className="h-3 w-3 mr-1 inline" />
        NOINDEX
      </Badge>
    );
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">{error}</Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <AdminBreadcrumb currentPage="Gammes SEO" />
          <h1 className="text-3xl font-bold mt-2">
            Classification G-Level des Gammes
          </h1>
          <p className="text-gray-600">
            Gestion SEO des {stats?.total || 230} gammes avec indicateurs Google
            Trends
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowThresholdsPanel(!showThresholdsPanel)}
            className={
              showThresholdsPanel ? "bg-indigo-100 border-indigo-400" : ""
            }
          >
            <Settings className="h-4 w-4 mr-2" />
            Seuils
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAuditPanel(!showAuditPanel)}
            className={showAuditPanel ? "bg-purple-100 border-purple-400" : ""}
          >
            <History className="h-4 w-4 mr-2" />
            Historique
          </Button>
          <a
            href="/api/admin/gammes-seo/export"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </a>
        </div>
      </div>

      {/* Panel Configuration des Seuils */}
      {showThresholdsPanel && (
        <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4 text-indigo-600" />
                Configuration des Seuils Smart Action
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResetThresholds}
                  disabled={isSavingThresholds}
                  className="text-gray-600"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Défaut
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveThresholds}
                  disabled={!isThresholdsModified || isSavingThresholds}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {isSavingThresholds ? (
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  Sauvegarder
                </Button>
              </div>
            </div>
            <CardDescription className="text-xs">
              Ajustez les seuils selon les performances GSC. Modifiez puis
              sauvegardez.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs font-medium text-indigo-700">
                  Trends Élevé (INDEX)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editThresholds.trends_high}
                  onChange={(e) =>
                    handleThresholdChange(
                      "trends_high",
                      parseInt(e.target.value) || 0,
                    )
                  }
                  className="mt-1 border-indigo-200"
                />
                <span className="text-[10px] text-gray-500">Défaut: 50</span>
              </div>
              <div>
                <Label className="text-xs font-medium text-indigo-700">
                  Trends Moyen (OBSERVER)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editThresholds.trends_medium}
                  onChange={(e) =>
                    handleThresholdChange(
                      "trends_medium",
                      parseInt(e.target.value) || 0,
                    )
                  }
                  className="mt-1 border-indigo-200"
                />
                <span className="text-[10px] text-gray-500">Défaut: 20</span>
              </div>
              <div>
                <Label className="text-xs font-medium text-indigo-700">
                  SEO Excellent (G1)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editThresholds.seo_excellent}
                  onChange={(e) =>
                    handleThresholdChange(
                      "seo_excellent",
                      parseInt(e.target.value) || 0,
                    )
                  }
                  className="mt-1 border-indigo-200"
                />
                <span className="text-[10px] text-gray-500">Défaut: 75</span>
              </div>
              <div>
                <Label className="text-xs font-medium text-indigo-700">
                  SEO Bon (INDEX)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editThresholds.seo_good}
                  onChange={(e) =>
                    handleThresholdChange(
                      "seo_good",
                      parseInt(e.target.value) || 0,
                    )
                  }
                  className="mt-1 border-indigo-200"
                />
                <span className="text-[10px] text-gray-500">Défaut: 45</span>
              </div>
            </div>

            {/* Aperçu de la matrice de décision */}
            <div className="mt-4 pt-4 border-t border-indigo-200">
              <h4 className="text-xs font-semibold text-indigo-700 mb-2">
                Matrice de décision actuelle:
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="p-2 bg-emerald-100 rounded">
                  <span className="font-bold">INDEX+G1:</span> Trends≥
                  {editThresholds.trends_high} & SEO≥
                  {editThresholds.seo_excellent}
                </div>
                <div className="p-2 bg-green-100 rounded">
                  <span className="font-bold">INDEX:</span> Trends≥
                  {editThresholds.trends_high} & SEO≥{editThresholds.seo_good}
                </div>
                <div className="p-2 bg-blue-100 rounded">
                  <span className="font-bold">OBSERVER:</span> Trends{" "}
                  {editThresholds.trends_medium}-
                  {editThresholds.trends_high - 1} & SEO≥
                  {editThresholds.seo_excellent}
                </div>
                <div className="p-2 bg-violet-100 rounded">
                  <span className="font-bold">PARENT:</span> Trends&lt;
                  {editThresholds.trends_medium} & SEO≥
                  {editThresholds.seo_excellent}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Panel Historique des Actions */}
      {showAuditPanel && (
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-purple-600" />
              Historique des Actions (10 dernières)
            </CardTitle>
            <CardDescription className="text-xs">
              Suivi des modifications de seuils et des actions en masse
            </CardDescription>
          </CardHeader>
          <CardContent>
            {auditHistory.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                Aucune action enregistrée
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-purple-100 text-purple-800">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Admin</th>
                      <th className="px-3 py-2 text-left">Action</th>
                      <th className="px-3 py-2 text-left">Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-100">
                    {(auditHistory as AuditEntry[]).map((entry) => (
                      <tr key={entry.id} className="hover:bg-purple-50">
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {new Date(entry.created_at).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {entry.admin_email}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            className={`text-xs ${
                              entry.action_type.includes("THRESHOLD")
                                ? "bg-indigo-100 text-indigo-700"
                                : entry.action_type.includes("PROMOTE")
                                  ? "bg-green-100 text-green-700"
                                  : entry.action_type.includes("DEMOTE")
                                    ? "bg-red-100 text-red-700"
                                    : entry.action_type.includes("G1")
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {entry.action_type.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700">
                          {entry.impact_summary}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions / Légende - EN HAUT */}
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Guide de classification G-Level
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
            {/* Classification G-Level */}
            <div>
              <strong className="text-gray-700 block mb-2">
                Classification:
              </strong>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-600 text-white">
                    <Star className="h-3 w-3 mr-1" />
                    G1
                  </Badge>
                  <span className="text-xs text-gray-600">Prioritaire</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600 text-white">INDEX</Badge>
                  <span className="text-xs text-gray-600">Indexé</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-slate-400 text-white">NOINDEX</Badge>
                  <span className="text-xs text-gray-600">Non indexé</span>
                </div>
              </div>
            </div>

            {/* Trends */}
            <div>
              <strong className="text-gray-700 block mb-2">Trends:</strong>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-600 text-white text-xs">
                    70+
                  </Badge>
                  <span className="text-xs">Excellent</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500 text-white text-xs">50+</Badge>
                  <span className="text-xs">Très bon</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500 text-white text-xs">20+</Badge>
                  <span className="text-xs">Moyen</span>
                </div>
              </div>
            </div>

            {/* SEO Score (Agent 2) */}
            <div>
              <strong className="text-gray-700 block mb-2">Score SEO:</strong>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs">
                    90+
                  </Badge>
                  <span className="text-xs">Excellent</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-lime-500 to-green-500 text-white text-xs">
                    60+
                  </Badge>
                  <span className="text-xs">Bon</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white text-xs">
                    45+
                  </Badge>
                  <span className="text-xs">Moyen</span>
                </div>
              </div>
            </div>

            {/* Intent (Agent 2) */}
            <div>
              <strong className="text-gray-700 block mb-2">Intent:</strong>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white text-xs">
                    💰 Achat
                  </Badge>
                  <span className="text-xs">Transactionnel</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-violet-600 to-indigo-500 text-white text-xs">
                    🔍 Comparatif
                  </Badge>
                  <span className="text-xs">Investigation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs">
                    📚 Info
                  </Badge>
                  <span className="text-xs">Informationnel</span>
                </div>
              </div>
            </div>

            {/* Competition (Agent 2) */}
            <div>
              <strong className="text-gray-700 block mb-2">Compétition:</strong>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-emerald-400 to-green-500 text-white text-xs">
                    ✓ Facile
                  </Badge>
                  <span className="text-xs">&lt;30</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs">
                    ⚡ Moyen
                  </Badge>
                  <span className="text-xs">30-60</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs">
                    🔥 Difficile
                  </Badge>
                  <span className="text-xs">&gt;60</span>
                </div>
              </div>
            </div>

            {/* Actions disponibles */}
            <div>
              <strong className="text-gray-700 block mb-2">Actions:</strong>
              <div className="space-y-1 text-xs text-gray-600">
                <div>
                  • <strong>INDEX</strong>: pg_relfollow=1{" "}
                  <span className="text-green-600">(→ sitemap auto)</span>
                </div>
                <div>
                  • <strong>NOINDEX</strong>: pg_relfollow=0
                </div>
                <div>
                  • <strong>G1</strong>: pg_top=1
                </div>
              </div>
            </div>
          </div>

          {/* Matrice de Décision - Croisement des critères */}
          <div className="mt-4 pt-4 border-t border-slate-300">
            <strong className="text-gray-700 block mb-3">
              📊 Matrice de Décision (Croisement des critères):
            </strong>

            {/* Tableau de décision avec explications */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-200">
                    <th className="border border-slate-300 px-2 py-1 text-left">
                      Trends
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-left">
                      SEO
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-left">
                      Intent
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-left">
                      Compét.
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-center">
                      Action
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-left">
                      Explication
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-left">
                      À faire
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-emerald-50 hover:bg-emerald-100">
                    <td className="border border-slate-300 px-2 py-1">
                      ≥{editThresholds.trends_high}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">
                      ≥{editThresholds.seo_excellent}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">💰</td>
                    <td className="border border-slate-300 px-2 py-1">Any</td>
                    <td className="border border-slate-300 px-2 py-1 text-center">
                      <Badge className="bg-emerald-600 text-white text-xs">
                        🚀 INDEX+G1
                      </Badge>
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-gray-600">
                      Fort volume + excellent SEO + transactionnel
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-emerald-700 font-medium">
                      Créer page, optimiser contenu, priorité haute
                    </td>
                  </tr>
                  <tr className="bg-green-50 hover:bg-green-100">
                    <td className="border border-slate-300 px-2 py-1">
                      ≥{editThresholds.trends_high}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">
                      ≥{editThresholds.seo_good}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">💰/🔍</td>
                    <td className="border border-slate-300 px-2 py-1">
                      &lt;60
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-center">
                      <Badge className="bg-green-600 text-white text-xs">
                        📈 INDEX
                      </Badge>
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-gray-600">
                      Bon volume + SEO correct + compétition gérable
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-green-700 font-medium">
                      Créer page, inclure sitemap
                    </td>
                  </tr>
                  <tr className="bg-amber-50 hover:bg-amber-100">
                    <td className="border border-slate-300 px-2 py-1">
                      ≥{editThresholds.trends_high}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">
                      &lt;{editThresholds.seo_good}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">Any</td>
                    <td className="border border-slate-300 px-2 py-1">Any</td>
                    <td className="border border-slate-300 px-2 py-1 text-center">
                      <Badge className="bg-amber-500 text-white text-xs">
                        🔍 Investiguer
                      </Badge>
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-gray-600">
                      Demande forte mais page pas optimisée
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-amber-700 font-medium">
                      Analyser SERP, améliorer contenu, retester
                    </td>
                  </tr>
                  <tr className="bg-blue-50 hover:bg-blue-100">
                    <td className="border border-slate-300 px-2 py-1">
                      {editThresholds.trends_medium}-
                      {editThresholds.trends_high - 1}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">
                      ≥{editThresholds.seo_excellent}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">Any</td>
                    <td className="border border-slate-300 px-2 py-1">
                      &lt;30
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-center">
                      <Badge className="bg-blue-500 text-white text-xs">
                        ⭐ Observer
                      </Badge>
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-gray-600">
                      SEO excellent mais volume moyen
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-blue-700 font-medium">
                      Créer page, surveiller évolution trends
                    </td>
                  </tr>
                  <tr className="bg-violet-50 hover:bg-violet-100">
                    <td className="border border-slate-300 px-2 py-1">
                      &lt;{editThresholds.trends_medium}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">
                      ≥{editThresholds.seo_excellent}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">Any</td>
                    <td className="border border-slate-300 px-2 py-1">Any</td>
                    <td className="border border-slate-300 px-2 py-1 text-center">
                      <Badge className="bg-violet-500 text-white text-xs">
                        🔗 Parent
                      </Badge>
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-gray-600">
                      Bon SEO mais trop faible volume
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-violet-700 font-medium">
                      NE PAS créer page, enrichir page parente
                    </td>
                  </tr>
                  <tr className="bg-slate-50 hover:bg-slate-100">
                    <td className="border border-slate-300 px-2 py-1">
                      {editThresholds.trends_medium}-
                      {editThresholds.trends_high - 1}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">
                      {editThresholds.seo_good}-
                      {editThresholds.seo_excellent - 1}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">Any</td>
                    <td className="border border-slate-300 px-2 py-1">Any</td>
                    <td className="border border-slate-300 px-2 py-1 text-center">
                      <Badge className="bg-slate-500 text-white text-xs">
                        📊 Évaluer
                      </Badge>
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-gray-600">
                      Métriques moyennes
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-slate-700 font-medium">
                      Analyser au cas par cas, décider manuellement
                    </td>
                  </tr>
                  <tr className="bg-gray-100 hover:bg-gray-200">
                    <td className="border border-slate-300 px-2 py-1">
                      &lt;{editThresholds.trends_medium}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">
                      &lt;{editThresholds.seo_good}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">📚</td>
                    <td className="border border-slate-300 px-2 py-1">
                      &gt;60
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-center">
                      <Badge className="bg-gray-400 text-white text-xs">
                        ❌ NOINDEX
                      </Badge>
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-gray-600">
                      Faible potentiel commercial
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-gray-500 font-medium">
                      Ne pas indexer, économiser crawl budget
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Légende des actions */}
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="p-2 bg-emerald-100 rounded border border-emerald-300">
                <strong>🚀 INDEX+G1:</strong> Priorité max, fort potentiel
                commercial
              </div>
              <div className="p-2 bg-green-100 rounded border border-green-300">
                <strong>📈 INDEX:</strong> Bon potentiel, inclure dans sitemap
              </div>
              <div className="p-2 bg-amber-100 rounded border border-amber-300">
                <strong>🔍 Investiguer:</strong> Demande forte mais SEO faible
              </div>
              <div className="p-2 bg-violet-100 rounded border border-violet-300">
                <strong>🔗 Parent:</strong> Enrichir page parente au lieu de
                créer
              </div>
            </div>

            {/* Notes importantes */}
            <div className="mt-3 space-y-2">
              <div className="p-2 bg-green-50 border border-green-200 rounded text-xs">
                <strong className="text-green-800">✅ INDEX = Sitemap:</strong>
                <span className="text-green-700 ml-1">
                  Toute catégorie INDEX (
                  <code className="bg-green-100 px-1 rounded">
                    pg_relfollow=1
                  </code>
                  ) est automatiquement incluse dans le sitemap.
                </span>
              </div>
              <div className="text-xs text-gray-500 italic">
                💡 "🔗 Parent" = Ne pas créer de page dédiée, enrichir la page
                parente (ex: "Vis de disque" → ajouter à "Disque de frein")
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-green-600">INDEX</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                {stats.indexed}
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-red-600">NOINDEX</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">
                {stats.noindexed}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">
                G1 / G2 / G3
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                <span className="text-green-600">{stats.g1Count}</span>
                {" / "}
                <span className="text-blue-600">{stats.g2Count}</span>
                {" / "}
                <span className="text-gray-500">{stats.g3Count}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-orange-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />A promouvoir
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">
                {stats.toPromoteIndex}
              </div>
              <div className="text-xs text-orange-500">
                NOINDEX avec fort trends
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">
                Trends moyen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgTrends}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sitemap Regeneration Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              🗺️ Sitemap
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateSitemap}
              disabled={isRegeneratingSitemap}
              className="text-blue-600 border-blue-300 hover:bg-blue-100"
            >
              {isRegeneratingSitemap ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Régénérer
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {lastSitemapResult ? (
            <div className="text-sm text-blue-700">
              <div className="font-medium">
                {lastSitemapResult.totalUrls.toLocaleString()} URLs
              </div>
              <div className="text-xs text-blue-500">
                {lastSitemapResult.files} fichiers •{" "}
                {lastSitemapResult.timestamp}
              </div>
            </div>
          ) : (
            <div className="text-xs text-blue-500">
              Cliquez pour régénérer les sitemaps
            </div>
          )}
        </CardContent>
      </Card>

      {/* Smart Actions KPIs - Click to filter */}
      <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              🎯 Actions Intelligentes (page actuelle: {gammes.length} gammes)
            </CardTitle>
            {smartActionFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSmartActionClick("all")}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                ✕ Réinitialiser filtre
              </Button>
            )}
          </div>
          <CardDescription className="text-xs text-indigo-600">
            Cliquez sur un KPI pour filtrer par action
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
            <button
              type="button"
              onClick={() => handleSmartActionClick("INDEX_G1")}
              className={`text-center p-2 bg-white rounded-lg shadow-sm border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-400 transition-all cursor-pointer ${smartActionFilter === "INDEX_G1" ? "ring-2 ring-emerald-500 bg-emerald-50" : ""}`}
            >
              <div className="text-xl font-bold text-emerald-600">
                {smartActionStats.INDEX_G1}
              </div>
              <div className="text-[10px] text-emerald-700">🚀 INDEX+G1</div>
            </button>
            <button
              type="button"
              onClick={() => handleSmartActionClick("INDEX")}
              className={`text-center p-2 bg-white rounded-lg shadow-sm border border-green-200 hover:bg-green-50 hover:border-green-400 transition-all cursor-pointer ${smartActionFilter === "INDEX" ? "ring-2 ring-green-500 bg-green-50" : ""}`}
            >
              <div className="text-xl font-bold text-green-600">
                {smartActionStats.INDEX}
              </div>
              <div className="text-[10px] text-green-700">📈 INDEX</div>
            </button>
            <button
              type="button"
              onClick={() => handleSmartActionClick("INVESTIGUER")}
              className={`text-center p-2 bg-white rounded-lg shadow-sm border border-amber-200 hover:bg-amber-50 hover:border-amber-400 transition-all cursor-pointer ${smartActionFilter === "INVESTIGUER" ? "ring-2 ring-amber-500 bg-amber-50" : ""}`}
            >
              <div className="text-xl font-bold text-amber-600">
                {smartActionStats.INVESTIGUER}
              </div>
              <div className="text-[10px] text-amber-700">🔍 Investiguer</div>
            </button>
            <button
              type="button"
              onClick={() => handleSmartActionClick("OBSERVER")}
              className={`text-center p-2 bg-white rounded-lg shadow-sm border border-blue-200 hover:bg-blue-50 hover:border-blue-400 transition-all cursor-pointer ${smartActionFilter === "OBSERVER" ? "ring-2 ring-blue-500 bg-blue-50" : ""}`}
            >
              <div className="text-xl font-bold text-blue-600">
                {smartActionStats.OBSERVER}
              </div>
              <div className="text-[10px] text-blue-700">⭐ Observer</div>
            </button>
            <button
              type="button"
              onClick={() => handleSmartActionClick("PARENT")}
              className={`text-center p-2 bg-white rounded-lg shadow-sm border border-violet-200 hover:bg-violet-50 hover:border-violet-400 transition-all cursor-pointer ${smartActionFilter === "PARENT" ? "ring-2 ring-violet-500 bg-violet-50" : ""}`}
            >
              <div className="text-xl font-bold text-violet-600">
                {smartActionStats.PARENT}
              </div>
              <div className="text-[10px] text-violet-700">🔗 Parent</div>
            </button>
            <button
              type="button"
              onClick={() => handleSmartActionClick("EVALUER")}
              className={`text-center p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 hover:border-slate-400 transition-all cursor-pointer ${smartActionFilter === "EVALUER" ? "ring-2 ring-slate-500 bg-slate-50" : ""}`}
            >
              <div className="text-xl font-bold text-slate-600">
                {smartActionStats.EVALUER}
              </div>
              <div className="text-[10px] text-slate-700">📊 Évaluer</div>
            </button>
            <button
              type="button"
              onClick={() => handleSmartActionClick("NOINDEX")}
              className={`text-center p-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 hover:border-gray-400 transition-all cursor-pointer ${smartActionFilter === "NOINDEX" ? "ring-2 ring-gray-500 bg-gray-50" : ""}`}
            >
              <div className="text-xl font-bold text-gray-500">
                {smartActionStats.NOINDEX}
              </div>
              <div className="text-[10px] text-gray-600">❌ NOINDEX</div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* Search */}
            <div className="col-span-2">
              <Label>Recherche</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Nom de gamme..."
                  className="pl-9"
                  defaultValue={filters.search}
                  onChange={(e) => {
                    // Debounce search
                    const timer = setTimeout(() => {
                      handleFilterChange("search", e.target.value);
                    }, 500);
                    return () => clearTimeout(timer);
                  }}
                />
              </div>
            </div>

            {/* Family filter */}
            <div>
              <Label>Famille</Label>
              <Select
                value={filters.familyId}
                onValueChange={(v) =>
                  handleFilterChange("familyId", v === "all" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {families.map((f: Family) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* G-Level filter */}
            <div>
              <Label>G-Level</Label>
              <Select
                value={filters.gLevel}
                onValueChange={(v) =>
                  handleFilterChange("gLevel", v === "all" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="G1">G1 (Prioritaire)</SelectItem>
                  <SelectItem value="G2">G2 (Important)</SelectItem>
                  <SelectItem value="G3">G3 (Secondaire)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status filter */}
            <div>
              <Label>Statut</Label>
              <Select
                value={filters.status}
                onValueChange={(v) =>
                  handleFilterChange("status", v === "all" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="INDEX">INDEX</SelectItem>
                  <SelectItem value="NOINDEX">NOINDEX</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action filter */}
            <div>
              <Label>Action recommandée</Label>
              <Select
                value={filters.actionRecommended}
                onValueChange={(v) =>
                  handleFilterChange("actionRecommended", v === "all" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="PROMOUVOIR_INDEX">
                    Promouvoir INDEX
                  </SelectItem>
                  <SelectItem value="PROMOUVOIR_G1">Promouvoir G1</SelectItem>
                  <SelectItem value="VERIFIER_G1">Vérifier G1</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Smart Action filter */}
            <div>
              <Label>🎯 Action Smart</Label>
              <Select
                value={searchParams.get("smartAction") || "all"}
                onValueChange={(v) => {
                  const params = new URLSearchParams(searchParams);
                  if (v === "all") {
                    params.delete("smartAction");
                  } else {
                    params.set("smartAction", v);
                  }
                  setSearchParams(params);
                }}
              >
                <SelectTrigger className="border-indigo-200">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="INDEX_G1">🚀 INDEX+G1</SelectItem>
                  <SelectItem value="INDEX">📈 INDEX</SelectItem>
                  <SelectItem value="INVESTIGUER">🔍 Investiguer</SelectItem>
                  <SelectItem value="OBSERVER">⭐ Observer</SelectItem>
                  <SelectItem value="PARENT">🔗 Parent</SelectItem>
                  <SelectItem value="EVALUER">📊 Évaluer</SelectItem>
                  <SelectItem value="NOINDEX">❌ NOINDEX</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch Actions */}
      {selectedIds.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-blue-700">
                {selectedIds.length} gamme(s) sélectionnée(s)
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleBatchAction("PROMOTE_INDEX")}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  )}
                  Promouvoir INDEX
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleBatchAction("DEMOTE_NOINDEX")}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-1" />
                  )}
                  Passer NOINDEX
                </Button>
                <Button
                  size="sm"
                  className="bg-yellow-500 hover:bg-yellow-600"
                  onClick={() => handleBatchAction("MARK_G1")}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Star className="h-4 w-4 mr-1" />
                  )}
                  Marquer G1
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBatchAction("UNMARK_G1")}
                  disabled={isSubmitting}
                >
                  Retirer G1
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {smartActionFilter ? (
                <span>
                  <span className="text-indigo-600">
                    {filteredGammes.length}
                  </span>
                  <span className="text-gray-400">
                    {" "}
                    / {gammes.length} gammes
                  </span>
                  <Badge className="ml-2 bg-indigo-100 text-indigo-700 text-xs">
                    Filtre Smart Action
                  </Badge>
                </span>
              ) : (
                <span>{total} gammes</span>
              )}
              {isLoading && (
                <RefreshCw className="inline-block ml-2 h-4 w-4 animate-spin" />
              )}
            </CardTitle>
            <div className="text-sm text-gray-500">
              Page {page} / {totalPages}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-3 text-left">
                    <Checkbox
                      checked={
                        selectedIds.length === filteredGammes.length &&
                        filteredGammes.length > 0
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th
                    className="px-3 py-3 text-left cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("pg_name")}
                  >
                    <div className="flex items-center gap-1">
                      Gamme
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-left cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("family_name")}
                  >
                    <div className="flex items-center gap-1">
                      Famille
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  {/* Interface simplifiée: 6 colonnes essentielles */}
                  <th className="px-3 py-3 text-center">Priorité</th>
                  <th className="px-2 py-3 text-center">Sitemap</th>
                  <th className="px-2 py-3 text-center">Smart Action</th>
                  <th className="px-2 py-3 text-center">Execution</th>
                  <th className="px-2 py-3 text-center">Content</th>
                  <th className="px-2 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredGammes.map((gamme: GammeSeoItem, index: number) => {
                  // Afficher un séparateur quand la famille change (si tri par famille)
                  const prevGamme =
                    index > 0 ? filteredGammes[index - 1] : null;
                  const showFamilySeparator =
                    filters.sortBy === "family_name" &&
                    (index === 0 ||
                      gamme.family_name !== prevGamme?.family_name);

                  return (
                    <React.Fragment key={gamme.pg_id}>
                      {/* En-tête de famille */}
                      {showFamilySeparator && (
                        <tr className="bg-blue-100 border-t-2 border-blue-300">
                          <td colSpan={9} className="px-3 py-2">
                            <span className="font-bold text-blue-800">
                              {gamme.family_name || "Sans famille"}
                            </span>
                            <span className="ml-2 text-sm text-blue-600">
                              (
                              {
                                filteredGammes.filter(
                                  (g: GammeSeoItem) =>
                                    g.family_name === gamme.family_name,
                                ).length
                              }{" "}
                              gammes)
                            </span>
                          </td>
                        </tr>
                      )}
                      {/* Ligne de gamme - Highlighting basé sur Execution status */}
                      <tr
                        className={`hover:bg-gray-100 transition-colors ${
                          gamme.pg_top === "1"
                            ? "bg-emerald-50 border-l-4 border-l-emerald-500"
                            : gamme.execution_status === "PASS"
                              ? "bg-green-50 border-l-4 border-l-green-400"
                              : gamme.execution_status === "WARN"
                                ? "bg-amber-50 border-l-4 border-l-amber-400"
                                : gamme.execution_status === "FAIL"
                                  ? "bg-red-50 border-l-4 border-l-red-400"
                                  : ""
                        }`}
                      >
                        <td className="px-2 py-3">
                          <Checkbox
                            checked={selectedIds.includes(gamme.pg_id)}
                            onChange={(e) =>
                              handleSelectOne(gamme.pg_id, e.target.checked)
                            }
                          />
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            to={`/admin/gammes-seo/${gamme.pg_id}`}
                            className="group block"
                          >
                            <div className="font-medium text-blue-600 group-hover:text-blue-800 group-hover:underline">
                              {gamme.pg_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              ID: {gamme.pg_id}
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          {gamme.family_name || "-"}
                        </td>
                        {/* Priorité: G1/INDEX/NOINDEX */}
                        <td className="px-3 py-3 text-center">
                          {getPriorityBadge(gamme.pg_top, gamme.pg_level)}
                        </td>
                        {/* Sitemap: basé sur INDEX (pg_relfollow) */}
                        <td className="px-2 py-3 text-center">
                          {gamme.pg_relfollow === "1" ? (
                            <Badge className="bg-green-500 text-white text-xs">
                              ✓ Auto
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-gray-400 text-xs"
                            >
                              ✗ Exclu
                            </Badge>
                          )}
                        </td>
                        {/* Smart Action: recommandation matrice décision */}
                        <td className="px-2 py-3 text-center">
                          {(() => {
                            const action = getSmartActionType(gamme);
                            const actionConfig: Record<
                              string,
                              { emoji: string; label: string; color: string }
                            > = {
                              INDEX_G1: {
                                emoji: "🚀",
                                label: "INDEX+G1",
                                color: "bg-emerald-600",
                              },
                              INDEX: {
                                emoji: "📈",
                                label: "INDEX",
                                color: "bg-green-600",
                              },
                              INVESTIGUER: {
                                emoji: "🔍",
                                label: "Investiguer",
                                color: "bg-amber-500",
                              },
                              OBSERVER: {
                                emoji: "⭐",
                                label: "Observer",
                                color: "bg-blue-500",
                              },
                              PARENT: {
                                emoji: "🔗",
                                label: "Parent",
                                color: "bg-violet-500",
                              },
                              EVALUER: {
                                emoji: "📊",
                                label: "Évaluer",
                                color: "bg-slate-500",
                              },
                              NOINDEX: {
                                emoji: "❌",
                                label: "NOINDEX",
                                color: "bg-gray-400",
                              },
                            };
                            const config =
                              actionConfig[action] || actionConfig.NOINDEX;
                            return (
                              <Badge
                                className={`${config.color} text-white text-xs`}
                              >
                                {config.emoji} {config.label}
                              </Badge>
                            );
                          })()}
                        </td>
                        {/* Execution: PASS/WARN/FAIL */}
                        <td className="px-2 py-3 text-center">
                          <Badge
                            variant={
                              gamme.execution_status === "PASS"
                                ? "default"
                                : gamme.execution_status === "WARN"
                                  ? "secondary"
                                  : "destructive"
                            }
                            className={
                              gamme.execution_status === "PASS"
                                ? "bg-green-500"
                                : gamme.execution_status === "WARN"
                                  ? "bg-amber-500 text-white"
                                  : ""
                            }
                          >
                            {gamme.execution_status || "FAIL"}
                          </Badge>
                        </td>
                        {/* Content: RICH/OK/THIN */}
                        <td className="px-2 py-3 text-center">
                          <Badge
                            variant="outline"
                            className={
                              gamme.content_depth === "RICH"
                                ? "bg-green-100 text-green-700 border-green-300"
                                : gamme.content_depth === "OK"
                                  ? "bg-blue-100 text-blue-700 border-blue-300"
                                  : "bg-gray-100 text-gray-500"
                            }
                          >
                            {gamme.content_depth || "THIN"}
                          </Badge>
                        </td>
                        {/* Actions: lien vers détail */}
                        <td className="px-2 py-3 text-center">
                          <Link
                            to={`/admin/gammes-seo/${gamme.pg_id}`}
                            className="inline-flex items-center justify-center p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-gray-500">
              Affichage {(page - 1) * 50 + 1} - {Math.min(page * 50, total)} sur{" "}
              {total}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
