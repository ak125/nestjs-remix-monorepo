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
import { useLoaderData, useNavigation, useSearchParams, Link } from "@remix-run/react";
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
  TrendingUp,
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

export const meta: MetaFunction = () => [
  { title: 'Gammes SEO | Admin AutoMecanik' },
  { name: 'robots', content: 'noindex, nofollow' },
  { tagName: "link", rel: "canonical", href: "https://www.automecanik.com/admin/gammes-seo" },
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
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
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
    const [gammesRes, statsRes, familiesRes, thresholdsRes, auditRes] = await Promise.all([
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
      thresholds: thresholdsData?.data?.thresholds || { trends_high: 50, trends_medium: 20, seo_excellent: 75, seo_good: 45 },
      auditHistory: auditData?.data || [],
      filters: { search, familyId, gLevel, status, actionRecommended, sortBy, sortOrder },
      error: null,
    });
  } catch (error) {
    console.error("[Admin Gammes SEO] Error:", error);
    return json({
      gammes: [],
      total: 0,
      page: 1,
      totalPages: 1,
      stats: null,
      families: [],
      thresholds: { trends_high: 50, trends_medium: 20, seo_excellent: 75, seo_good: 45 },
      auditHistory: [],
      filters: { search: "", familyId: "", gLevel: "", status: "", actionRecommended: "", sortBy: "family_name", sortOrder: "desc" },
      error: "Erreur chargement données",
    });
  }
}

// Action
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("_action");
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    switch (actionType) {
      case "update-single": {
        const pgId = formData.get("pgId");
        const field = formData.get("field");
        const value = formData.get("value");

        const response = await fetch(`${backendUrl}/api/admin/gammes-seo/${pgId}`, {
          method: "PATCH",
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ [field as string]: value }),
        });

        const result = await response.json();
        return json({ success: result.success, message: result.message });
      }

      case "batch-action": {
        const pgIds = JSON.parse(formData.get("pgIds") as string || "[]");
        const actionId = formData.get("actionId");

        const response = await fetch(`${backendUrl}/api/admin/gammes-seo/action`, {
          method: "POST",
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pgIds, actionId }),
        });

        const result = await response.json();
        return json({ success: result.success, message: result.message, updated: result.updated });
      }

      default:
        return json({ success: false, message: "Action inconnue" });
    }
  } catch (error) {
    return json({
      success: false,
      message: error instanceof Error ? error.message : "Erreur"
    });
  }
}

// Component
export default function AdminGammesSeo() {
  const { gammes, total, page, totalPages, stats, families, thresholds, auditHistory, filters, error } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLoading = navigation.state === "loading";

  // State pour les seuils configurables
  const [editThresholds, setEditThresholds] = useState<SmartActionThresholds>(thresholds);
  const [isThresholdsModified, setIsThresholdsModified] = useState(false);
  const [isSavingThresholds, setIsSavingThresholds] = useState(false);
  const [showThresholdsPanel, setShowThresholdsPanel] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(false);

  // Sync thresholds when data changes
  useEffect(() => {
    setEditThresholds(thresholds);
    setIsThresholdsModified(false);
  }, [thresholds]);

  // Handler pour modifier un seuil
  const handleThresholdChange = (key: keyof SmartActionThresholds, value: number) => {
    setEditThresholds(prev => ({ ...prev, [key]: value }));
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
    const confirmed = window.confirm("Réinitialiser les seuils aux valeurs par défaut ?");
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

  // Helper pour calculer le Smart Action d'une gamme
  // Utilise la valeur backend si disponible, sinon calcule côté client avec seuils configurables
  const getSmartActionType = (gamme: GammeSeoItem): SmartActionType => {
    // Priorité au backend si disponible
    if (gamme.smart_action) return gamme.smart_action;

    // Fallback: calcul côté client avec seuils configurables
    const trends = gamme.trends_index || 0;
    const seoScore = gamme.seo_score || 0;
    const th = editThresholds;
    if (trends >= th.trends_high && seoScore >= th.seo_excellent) return "INDEX_G1";
    if (trends >= th.trends_high && seoScore >= th.seo_good) return "INDEX";
    if (trends >= th.trends_high && seoScore < th.seo_good) return "INVESTIGUER";
    if (trends >= th.trends_medium && seoScore >= th.seo_excellent) return "OBSERVER";
    if (trends < th.trends_medium && seoScore >= th.seo_excellent) return "PARENT";
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
  const handleFilterChange = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1"); // Reset to first page
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const handlePageChange = useCallback((newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const handleSort = useCallback((column: string) => {
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
  }, [searchParams, setSearchParams]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredGammes.map((g: GammeSeoItem) => g.pg_id));
    } else {
      setSelectedIds([]);
    }
  }, [filteredGammes]);

  const handleSelectOne = useCallback((pgId: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, pgId]);
    } else {
      setSelectedIds(prev => prev.filter(id => id !== pgId));
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

    const confirmed = window.confirm(`${actionLabels[actionId] || actionId}\n\nConfirmer cette action ?`);
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

  // G-Level badge color avec icône
  const getGLevelBadge = (gLevel: string, pgTop: string) => {
    if (pgTop === "1") {
      return (
        <Badge className="bg-emerald-600 text-white font-bold px-3 py-1 shadow-sm">
          <Star className="h-3 w-3 mr-1 inline" />
          G1
        </Badge>
      );
    }
    if (gLevel === "G2" || (gLevel !== "G1" && gLevel !== "G3")) {
      return (
        <Badge className="bg-sky-600 text-white font-medium px-3 py-1">
          G2
        </Badge>
      );
    }
    return (
      <Badge className="bg-slate-400 text-white px-3 py-1">
        G3
      </Badge>
    );
  };

  // Status badge avec icône
  const getStatusBadge = (pgLevel: string) => {
    if (pgLevel === "1") {
      return (
        <Badge className="bg-green-600 text-white font-medium px-2 py-1">
          <Eye className="h-3 w-3 mr-1 inline" />
          INDEX
        </Badge>
      );
    }
    return (
      <Badge className="bg-rose-600 text-white px-2 py-1">
        <EyeOff className="h-3 w-3 mr-1 inline" />
        NOINDEX
      </Badge>
    );
  };

  // Trends badge avec label et couleur améliorée
  const getTrendsBadge = (trends: number) => {
    if (trends >= 70) {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <Badge className="bg-emerald-600 text-white font-bold px-3 py-1 shadow-md">
            {trends}
          </Badge>
          <span className="text-[10px] text-emerald-700 font-semibold">EXCELLENT</span>
        </div>
      );
    }
    if (trends >= 50) {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <Badge className="bg-green-500 text-white font-bold px-3 py-1">
            {trends}
          </Badge>
          <span className="text-[10px] text-green-600 font-medium">Très bon</span>
        </div>
      );
    }
    if (trends >= 30) {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <Badge className="bg-lime-500 text-white font-medium px-3 py-1">
            {trends}
          </Badge>
          <span className="text-[10px] text-lime-600">Bon</span>
        </div>
      );
    }
    if (trends >= 20) {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <Badge className="bg-amber-500 text-white px-3 py-1">
            {trends}
          </Badge>
          <span className="text-[10px] text-amber-600">Moyen</span>
        </div>
      );
    }
    if (trends >= 10) {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <Badge className="bg-orange-500 text-white px-3 py-1">
            {trends}
          </Badge>
          <span className="text-[10px] text-orange-600">Faible</span>
        </div>
      );
    }
    if (trends >= 1) {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <Badge className="bg-red-400 text-white px-3 py-1">
            {trends}
          </Badge>
          <span className="text-[10px] text-red-500">Très faible</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-0.5">
        <Badge className="bg-gray-300 text-gray-600 px-3 py-1">
          {trends}
        </Badge>
        <span className="text-[10px] text-gray-400">Nul</span>
      </div>
    );
  };

  // Appréciation globale (combinaison G-Level + Trends + Status)
  const _getAppreciation = (gamme: GammeSeoItem) => {
    const isG1 = gamme.pg_top === "1";
    const isIndex = gamme.pg_level === "1";
    const trends = gamme.trends_index;

    // Score calculé
    let score = 0;
    if (isG1) score += 40;
    else if (isIndex) score += 20;
    if (trends >= 50) score += 40;
    else if (trends >= 30) score += 30;
    else if (trends >= 20) score += 20;
    else if (trends >= 10) score += 10;
    if (gamme.pg_sitemap === "1") score += 10;
    if (gamme.pg_relfollow === "1") score += 10;

    if (score >= 80) {
      return (
        <div className="flex items-center gap-1">
          <div className="w-16 h-2 bg-emerald-500 rounded-full" />
          <span className="text-xs text-emerald-600 font-bold">A+</span>
        </div>
      );
    }
    if (score >= 60) {
      return (
        <div className="flex items-center gap-1">
          <div className="w-12 h-2 bg-green-500 rounded-full" />
          <span className="text-xs text-green-600 font-medium">A</span>
        </div>
      );
    }
    if (score >= 40) {
      return (
        <div className="flex items-center gap-1">
          <div className="w-10 h-2 bg-lime-500 rounded-full" />
          <span className="text-xs text-lime-600">B</span>
        </div>
      );
    }
    if (score >= 25) {
      return (
        <div className="flex items-center gap-1">
          <div className="w-8 h-2 bg-amber-500 rounded-full" />
          <span className="text-xs text-amber-600">C</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1">
        <div className="w-6 h-2 bg-red-400 rounded-full" />
        <span className="text-xs text-red-500">D</span>
      </div>
    );
  };

  // Badge recommandation amélioré
  const getRecommendationBadge = (action: string | null) => {
    if (!action) return null;

    const configs: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
      PROMOUVOIR_INDEX: {
        bg: "bg-orange-100 border-2 border-orange-500",
        text: "text-orange-700",
        icon: <TrendingUp className="h-3 w-3" />,
        label: "PROMOUVOIR INDEX"
      },
      PROMOUVOIR_G1: {
        bg: "bg-blue-100 border-2 border-blue-500",
        text: "text-blue-700",
        icon: <Star className="h-3 w-3" />,
        label: "PROMOUVOIR G1"
      },
      VERIFIER_G1: {
        bg: "bg-yellow-100 border-2 border-yellow-500",
        text: "text-yellow-700",
        icon: <AlertTriangle className="h-3 w-3" />,
        label: "VÉRIFIER G1"
      }
    };

    const config = configs[action] || {
      bg: "bg-gray-100 border border-gray-300",
      text: "text-gray-600",
      icon: null,
      label: action.replace(/_/g, " ")
    };

    return (
      <Badge className={`${config.bg} ${config.text} font-medium px-2 py-1 flex items-center gap-1`}>
        {config.icon}
        <span className="text-[10px]">{config.label}</span>
      </Badge>
    );
  };

  // Badge SEO Score (Agent 2) - Couleurs vibrantes avec gradient
  const getSeoScoreBadge = (score: number) => {
    if (score >= 90) {
      return (
        <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold px-3 py-1 shadow-sm">
          {score}
        </Badge>
      );
    }
    if (score >= 75) {
      return (
        <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold px-3 py-1 shadow-sm">
          {score}
        </Badge>
      );
    }
    if (score >= 60) {
      return (
        <Badge className="bg-gradient-to-r from-lime-500 to-green-500 text-white font-medium px-3 py-1">
          {score}
        </Badge>
      );
    }
    if (score >= 45) {
      return (
        <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-3 py-1">
          {score}
        </Badge>
      );
    }
    if (score >= 30) {
      return (
        <Badge className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-3 py-1">
          {score}
        </Badge>
      );
    }
    return (
      <Badge className="bg-gradient-to-r from-gray-400 to-gray-500 text-white px-3 py-1">
        {score}
      </Badge>
    );
  };

  // Badge Intent (Agent 2) - Couleurs vibrantes avec icônes
  const getIntentBadge = (intent: string) => {
    const configs: Record<string, { bg: string; label: string; icon: string }> = {
      TRANSACTIONAL: { bg: "bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white shadow-sm", label: "Achat", icon: "💰" },
      COMMERCIAL_INVESTIGATION: { bg: "bg-gradient-to-r from-violet-600 to-indigo-500 text-white", label: "Comparatif", icon: "🔍" },
      INFORMATIONAL: { bg: "bg-gradient-to-r from-cyan-500 to-blue-500 text-white", label: "Info", icon: "📚" },
      NAVIGATIONAL: { bg: "bg-slate-500 text-white", label: "Nav", icon: "🧭" },
      UNKNOWN: { bg: "bg-gray-300 text-gray-600", label: "?", icon: "❓" },
    };
    const config = configs[intent] || configs.UNKNOWN;
    return (
      <Badge className={`${config.bg} text-xs px-2 py-0.5 font-medium`}>
        {config.icon} {config.label}
      </Badge>
    );
  };

  // Badge Competition (Agent 2) - Gradients avec icônes
  const getCompetitionBadge = (level: string, difficulty: number) => {
    if (level === "EASY" || difficulty < 30) {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <Badge className="bg-gradient-to-r from-emerald-400 to-green-500 text-white text-xs px-2 py-0.5 font-medium shadow-sm">
            ✓ Facile
          </Badge>
          <span className="text-[10px] text-emerald-600 font-medium">{difficulty}</span>
        </div>
      );
    }
    if (level === "MEDIUM" || difficulty < 60) {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs px-2 py-0.5 font-medium">
            ⚡ Moyen
          </Badge>
          <span className="text-[10px] text-amber-600 font-medium">{difficulty}</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-0.5">
        <Badge className="bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs px-2 py-0.5 font-medium shadow-sm">
          🔥 Difficile
        </Badge>
        <span className="text-[10px] text-red-600 font-medium">{difficulty}</span>
      </div>
    );
  };

  // 🎯 Smart Action Badge - Combinaison Trends × SEO Score (avec seuils dynamiques)
  const getSmartActionBadge = (gamme: GammeSeoItem) => {
    const trends = gamme.trends_index || 0;
    const seoScore = gamme.seo_score || 0;
    const th = editThresholds;

    // Matrice de décision Trends × SEO Score avec seuils configurables
    if (trends >= th.trends_high && seoScore >= th.seo_excellent) {
      return (
        <div className="flex flex-col items-center gap-0.5" title="Page dédiée prioritaire - Fort volume + forte valeur commerciale">
          <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs px-2 py-0.5 font-bold shadow-md">
            🚀 INDEX+G1
          </Badge>
        </div>
      );
    }
    if (trends >= th.trends_high && seoScore >= th.seo_good) {
      return (
        <div className="flex flex-col items-center gap-0.5" title="Page dédiée standard - Fort volume">
          <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs px-2 py-0.5 font-medium shadow-sm">
            📈 INDEX
          </Badge>
        </div>
      );
    }
    if (trends >= th.trends_high && seoScore < th.seo_good) {
      return (
        <div className="flex flex-col items-center gap-0.5" title="Fort volume mais faible valeur commerciale - À vérifier">
          <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs px-2 py-0.5 font-medium">
            🔍 Investiguer
          </Badge>
        </div>
      );
    }
    if (trends >= th.trends_medium && seoScore >= th.seo_excellent) {
      return (
        <div className="flex flex-col items-center gap-0.5" title="Potentiel élevé - Surveiller l'évolution des tendances">
          <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs px-2 py-0.5 font-medium">
            ⭐ Observer
          </Badge>
        </div>
      );
    }
    if (trends < th.trends_medium && seoScore >= th.seo_excellent) {
      return (
        <div className="flex flex-col items-center gap-0.5" title="Forte valeur mais faible volume - Intégrer dans page parente">
          <Badge className="bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs px-2 py-0.5 font-medium">
            🔗 Parent
          </Badge>
        </div>
      );
    }
    if (trends >= th.trends_medium && seoScore >= th.seo_good) {
      return (
        <div className="flex flex-col items-center gap-0.5" title="Potentiel moyen - Décision manuelle requise">
          <Badge className="bg-gradient-to-r from-slate-400 to-slate-500 text-white text-xs px-2 py-0.5">
            📊 Évaluer
          </Badge>
        </div>
      );
    }
    // Default: NOINDEX
    return (
      <div className="flex flex-col items-center gap-0.5" title="Faible volume + faible valeur - Garder NOINDEX">
        <Badge className="bg-gray-400 text-white text-xs px-2 py-0.5">
          ❌ NOINDEX
        </Badge>
      </div>
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
          <h1 className="text-3xl font-bold mt-2">Classification G-Level des Gammes</h1>
          <p className="text-gray-600">
            Gestion SEO des {stats?.total || 230} gammes avec indicateurs Google Trends
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowThresholdsPanel(!showThresholdsPanel)}
            className={showThresholdsPanel ? "bg-indigo-100 border-indigo-400" : ""}
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
              Ajustez les seuils selon les performances GSC. Modifiez puis sauvegardez.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs font-medium text-indigo-700">Trends Élevé (INDEX)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editThresholds.trends_high}
                  onChange={(e) => handleThresholdChange("trends_high", parseInt(e.target.value) || 0)}
                  className="mt-1 border-indigo-200"
                />
                <span className="text-[10px] text-gray-500">Défaut: 50</span>
              </div>
              <div>
                <Label className="text-xs font-medium text-indigo-700">Trends Moyen (OBSERVER)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editThresholds.trends_medium}
                  onChange={(e) => handleThresholdChange("trends_medium", parseInt(e.target.value) || 0)}
                  className="mt-1 border-indigo-200"
                />
                <span className="text-[10px] text-gray-500">Défaut: 20</span>
              </div>
              <div>
                <Label className="text-xs font-medium text-indigo-700">SEO Excellent (G1)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editThresholds.seo_excellent}
                  onChange={(e) => handleThresholdChange("seo_excellent", parseInt(e.target.value) || 0)}
                  className="mt-1 border-indigo-200"
                />
                <span className="text-[10px] text-gray-500">Défaut: 75</span>
              </div>
              <div>
                <Label className="text-xs font-medium text-indigo-700">SEO Bon (INDEX)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editThresholds.seo_good}
                  onChange={(e) => handleThresholdChange("seo_good", parseInt(e.target.value) || 0)}
                  className="mt-1 border-indigo-200"
                />
                <span className="text-[10px] text-gray-500">Défaut: 45</span>
              </div>
            </div>

            {/* Aperçu de la matrice de décision */}
            <div className="mt-4 pt-4 border-t border-indigo-200">
              <h4 className="text-xs font-semibold text-indigo-700 mb-2">Matrice de décision actuelle:</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="p-2 bg-emerald-100 rounded">
                  <span className="font-bold">INDEX+G1:</span> Trends≥{editThresholds.trends_high} & SEO≥{editThresholds.seo_excellent}
                </div>
                <div className="p-2 bg-green-100 rounded">
                  <span className="font-bold">INDEX:</span> Trends≥{editThresholds.trends_high} & SEO≥{editThresholds.seo_good}
                </div>
                <div className="p-2 bg-blue-100 rounded">
                  <span className="font-bold">OBSERVER:</span> Trends {editThresholds.trends_medium}-{editThresholds.trends_high - 1} & SEO≥{editThresholds.seo_excellent}
                </div>
                <div className="p-2 bg-violet-100 rounded">
                  <span className="font-bold">PARENT:</span> Trends&lt;{editThresholds.trends_medium} & SEO≥{editThresholds.seo_excellent}
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
              <p className="text-sm text-gray-500 text-center py-4">Aucune action enregistrée</p>
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
                            minute: "2-digit"
                          })}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {entry.admin_email}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={`text-xs ${
                            entry.action_type.includes("THRESHOLD") ? "bg-indigo-100 text-indigo-700" :
                            entry.action_type.includes("PROMOTE") ? "bg-green-100 text-green-700" :
                            entry.action_type.includes("DEMOTE") ? "bg-red-100 text-red-700" :
                            entry.action_type.includes("G1") ? "bg-yellow-100 text-yellow-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>
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
              <strong className="text-gray-700 block mb-2">Classification:</strong>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-600 text-white"><Star className="h-3 w-3 mr-1" />G1</Badge>
                  <span className="text-xs text-gray-600">Prioritaire</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-sky-600 text-white">G2</Badge>
                  <span className="text-xs text-gray-600">INDEX</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-slate-400 text-white">G3</Badge>
                  <span className="text-xs text-gray-600">NOINDEX</span>
                </div>
              </div>
            </div>

            {/* Trends */}
            <div>
              <strong className="text-gray-700 block mb-2">Trends:</strong>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-600 text-white text-xs">70+</Badge>
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
                  <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs">90+</Badge>
                  <span className="text-xs">Excellent</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-lime-500 to-green-500 text-white text-xs">60+</Badge>
                  <span className="text-xs">Bon</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white text-xs">45+</Badge>
                  <span className="text-xs">Moyen</span>
                </div>
              </div>
            </div>

            {/* Intent (Agent 2) */}
            <div>
              <strong className="text-gray-700 block mb-2">Intent:</strong>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white text-xs">💰 Achat</Badge>
                  <span className="text-xs">Transactionnel</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-violet-600 to-indigo-500 text-white text-xs">🔍 Comparatif</Badge>
                  <span className="text-xs">Investigation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs">📚 Info</Badge>
                  <span className="text-xs">Informationnel</span>
                </div>
              </div>
            </div>

            {/* Competition (Agent 2) */}
            <div>
              <strong className="text-gray-700 block mb-2">Compétition:</strong>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-emerald-400 to-green-500 text-white text-xs">✓ Facile</Badge>
                  <span className="text-xs">&lt;30</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs">⚡ Moyen</Badge>
                  <span className="text-xs">30-60</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs">🔥 Difficile</Badge>
                  <span className="text-xs">&gt;60</span>
                </div>
              </div>
            </div>

            {/* Actions disponibles */}
            <div>
              <strong className="text-gray-700 block mb-2">Actions:</strong>
              <div className="space-y-1 text-xs text-gray-600">
                <div>• <strong>INDEX</strong>: pg_level=1</div>
                <div>• <strong>NOINDEX</strong>: pg_level=2</div>
                <div>• <strong>G1</strong>: pg_top=1</div>
              </div>
            </div>
          </div>

          {/* Actions Intelligentes - Matrice Trends × SEO Score (avec seuils dynamiques) */}
          <div className="mt-4 pt-4 border-t border-slate-300">
            <strong className="text-gray-700 block mb-3">🎯 Actions Intelligentes (Trends × SEO Score):</strong>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs px-2 py-0.5 font-bold">🚀 INDEX+G1</Badge>
                <span className="text-gray-600">Trends≥{editThresholds.trends_high} & SEO≥{editThresholds.seo_excellent}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs px-2 py-0.5">📈 INDEX</Badge>
                <span className="text-gray-600">Trends≥{editThresholds.trends_high} & SEO≥{editThresholds.seo_good}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs px-2 py-0.5">🔍 Investiguer</Badge>
                <span className="text-gray-600">Trends≥{editThresholds.trends_high} & SEO&lt;{editThresholds.seo_good}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs px-2 py-0.5">⭐ Observer</Badge>
                <span className="text-gray-600">Trends {editThresholds.trends_medium}-{editThresholds.trends_high - 1} & SEO≥{editThresholds.seo_excellent}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs px-2 py-0.5">🔗 Parent</Badge>
                <span className="text-gray-600">Trends&lt;{editThresholds.trends_medium} & SEO≥{editThresholds.seo_excellent}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-gradient-to-r from-slate-400 to-slate-500 text-white text-xs px-2 py-0.5">📊 Évaluer</Badge>
                <span className="text-gray-600">Trends {editThresholds.trends_medium}-{editThresholds.trends_high - 1} & SEO {editThresholds.seo_good}-{editThresholds.seo_excellent - 1}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-gray-400 text-white text-xs px-2 py-0.5">❌ NOINDEX</Badge>
                <span className="text-gray-600">Faible potentiel</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500 italic">
              💡 "🔗 Parent" = Ne pas créer de page dédiée, enrichir la page parente avec ces mots-clés (ex: "Vis de disque" → ajouter à "Disque de frein")
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
              <div className="text-2xl font-bold text-green-700">{stats.indexed}</div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-red-600">NOINDEX</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">{stats.noindexed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">G1 / G2 / G3</CardTitle>
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
                <AlertTriangle className="h-3 w-3" />
                A promouvoir
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">{stats.toPromoteIndex}</div>
              <div className="text-xs text-orange-500">NOINDEX avec fort trends</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Trends moyen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgTrends}</div>
            </CardContent>
          </Card>
        </div>
      )}

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
              <div className="text-xl font-bold text-emerald-600">{smartActionStats.INDEX_G1}</div>
              <div className="text-[10px] text-emerald-700">🚀 INDEX+G1</div>
            </button>
            <button
              type="button"
              onClick={() => handleSmartActionClick("INDEX")}
              className={`text-center p-2 bg-white rounded-lg shadow-sm border border-green-200 hover:bg-green-50 hover:border-green-400 transition-all cursor-pointer ${smartActionFilter === "INDEX" ? "ring-2 ring-green-500 bg-green-50" : ""}`}
            >
              <div className="text-xl font-bold text-green-600">{smartActionStats.INDEX}</div>
              <div className="text-[10px] text-green-700">📈 INDEX</div>
            </button>
            <button
              type="button"
              onClick={() => handleSmartActionClick("INVESTIGUER")}
              className={`text-center p-2 bg-white rounded-lg shadow-sm border border-amber-200 hover:bg-amber-50 hover:border-amber-400 transition-all cursor-pointer ${smartActionFilter === "INVESTIGUER" ? "ring-2 ring-amber-500 bg-amber-50" : ""}`}
            >
              <div className="text-xl font-bold text-amber-600">{smartActionStats.INVESTIGUER}</div>
              <div className="text-[10px] text-amber-700">🔍 Investiguer</div>
            </button>
            <button
              type="button"
              onClick={() => handleSmartActionClick("OBSERVER")}
              className={`text-center p-2 bg-white rounded-lg shadow-sm border border-blue-200 hover:bg-blue-50 hover:border-blue-400 transition-all cursor-pointer ${smartActionFilter === "OBSERVER" ? "ring-2 ring-blue-500 bg-blue-50" : ""}`}
            >
              <div className="text-xl font-bold text-blue-600">{smartActionStats.OBSERVER}</div>
              <div className="text-[10px] text-blue-700">⭐ Observer</div>
            </button>
            <button
              type="button"
              onClick={() => handleSmartActionClick("PARENT")}
              className={`text-center p-2 bg-white rounded-lg shadow-sm border border-violet-200 hover:bg-violet-50 hover:border-violet-400 transition-all cursor-pointer ${smartActionFilter === "PARENT" ? "ring-2 ring-violet-500 bg-violet-50" : ""}`}
            >
              <div className="text-xl font-bold text-violet-600">{smartActionStats.PARENT}</div>
              <div className="text-[10px] text-violet-700">🔗 Parent</div>
            </button>
            <button
              type="button"
              onClick={() => handleSmartActionClick("EVALUER")}
              className={`text-center p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 hover:border-slate-400 transition-all cursor-pointer ${smartActionFilter === "EVALUER" ? "ring-2 ring-slate-500 bg-slate-50" : ""}`}
            >
              <div className="text-xl font-bold text-slate-600">{smartActionStats.EVALUER}</div>
              <div className="text-[10px] text-slate-700">📊 Évaluer</div>
            </button>
            <button
              type="button"
              onClick={() => handleSmartActionClick("NOINDEX")}
              className={`text-center p-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 hover:border-gray-400 transition-all cursor-pointer ${smartActionFilter === "NOINDEX" ? "ring-2 ring-gray-500 bg-gray-50" : ""}`}
            >
              <div className="text-xl font-bold text-gray-500">{smartActionStats.NOINDEX}</div>
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
                onValueChange={(v) => handleFilterChange("familyId", v === "all" ? "" : v)}
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
                onValueChange={(v) => handleFilterChange("gLevel", v === "all" ? "" : v)}
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
                onValueChange={(v) => handleFilterChange("status", v === "all" ? "" : v)}
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
                onValueChange={(v) => handleFilterChange("actionRecommended", v === "all" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="PROMOUVOIR_INDEX">Promouvoir INDEX</SelectItem>
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
                  <span className="text-indigo-600">{filteredGammes.length}</span>
                  <span className="text-gray-400"> / {gammes.length} gammes</span>
                  <Badge className="ml-2 bg-indigo-100 text-indigo-700 text-xs">
                    Filtre Smart Action
                  </Badge>
                </span>
              ) : (
                <span>{total} gammes</span>
              )}
              {isLoading && <RefreshCw className="inline-block ml-2 h-4 w-4 animate-spin" />}
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
                      checked={selectedIds.length === filteredGammes.length && filteredGammes.length > 0}
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
                  <th
                    className="px-3 py-3 text-center cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("trends_index")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Trends
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-center cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("seo_score")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      SEO
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-2 py-3 text-center">Intent</th>
                  <th className="px-2 py-3 text-center">Compétition</th>
                  <th className="px-3 py-3 text-center">G-Level</th>
                  <th className="px-3 py-3 text-center">Statut</th>
                  <th className="px-3 py-3 text-left">Recommandation</th>
                  <th className="px-3 py-3 text-center">Action Smart</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredGammes.map((gamme: GammeSeoItem, index: number) => {
                  // Afficher un séparateur quand la famille change (si tri par famille)
                  const prevGamme = index > 0 ? filteredGammes[index - 1] : null;
                  const showFamilySeparator = filters.sortBy === "family_name" && (
                    index === 0 || gamme.family_name !== prevGamme?.family_name
                  );

                  return (
                    <React.Fragment key={gamme.pg_id}>
                      {/* En-tête de famille */}
                      {showFamilySeparator && (
                        <tr className="bg-blue-100 border-t-2 border-blue-300">
                          <td colSpan={11} className="px-3 py-2">
                            <span className="font-bold text-blue-800">
                              {gamme.family_name || "Sans famille"}
                            </span>
                            <span className="ml-2 text-sm text-blue-600">
                              ({filteredGammes.filter((g: GammeSeoItem) => g.family_name === gamme.family_name).length} gammes)
                            </span>
                          </td>
                        </tr>
                      )}
                      {/* Ligne de gamme - Highlighting basé sur Smart Action */}
                      <tr
                        className={`hover:bg-gray-100 transition-colors ${
                          (() => {
                            const smartAction = getSmartActionType(gamme);
                            switch (smartAction) {
                              case "INDEX_G1": return "bg-emerald-50 border-l-4 border-l-emerald-500";
                              case "INDEX": return "bg-green-50 border-l-4 border-l-green-400";
                              case "INVESTIGUER": return "bg-amber-50 border-l-4 border-l-amber-400";
                              case "OBSERVER": return "bg-blue-50 border-l-4 border-l-blue-400";
                              case "PARENT": return "bg-violet-50 border-l-4 border-l-violet-400";
                              case "EVALUER": return "bg-slate-50 border-l-2 border-l-slate-300";
                              default: return "";
                            }
                          })()
                        }`}
                      >
                        <td className="px-2 py-3">
                          <Checkbox
                            checked={selectedIds.includes(gamme.pg_id)}
                            onChange={(e) => handleSelectOne(gamme.pg_id, e.target.checked)}
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
                            <div className="text-xs text-gray-500">ID: {gamme.pg_id}</div>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          {gamme.family_name || "-"}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {getTrendsBadge(gamme.trends_index)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {getSeoScoreBadge(gamme.seo_score || 0)}
                        </td>
                        <td className="px-2 py-3 text-center">
                          {getIntentBadge(gamme.search_intent || "UNKNOWN")}
                        </td>
                        <td className="px-2 py-3 text-center">
                          {getCompetitionBadge(gamme.competition_level || "UNKNOWN", gamme.competition_difficulty || 0)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {getGLevelBadge(gamme.g_level_recommended, gamme.pg_top)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {getStatusBadge(gamme.pg_level)}
                        </td>
                        <td className="px-3 py-3">
                          {getRecommendationBadge(gamme.action_recommended)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {getSmartActionBadge(gamme)}
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
              Affichage {((page - 1) * 50) + 1} - {Math.min(page * 50, total)} sur {total}
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
