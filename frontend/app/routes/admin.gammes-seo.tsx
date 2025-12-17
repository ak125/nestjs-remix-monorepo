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
} from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useSearchParams, useSubmit, useActionData } from "@remix-run/react";
import React, { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  TrendingUp,
  Search,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Star,
  Eye,
  EyeOff,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from "lucide-react";
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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { AdminBreadcrumb } from "~/components/admin/AdminBreadcrumb";
import { requireUser } from "~/auth/unified.server";

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
}

interface GammeSeoStats {
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
  const sortOrder = url.searchParams.get("sortOrder") || "asc"; // asc = ordre officiel du catalogue

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
    const [gammesRes, statsRes, familiesRes] = await Promise.all([
      fetch(`${backendUrl}/api/admin/gammes-seo?${params.toString()}`, {
        headers: { Cookie: cookieHeader },
      }),
      fetch(`${backendUrl}/api/admin/gammes-seo/stats`, {
        headers: { Cookie: cookieHeader },
      }),
      fetch(`${backendUrl}/api/admin/gammes-seo/families`, {
        headers: { Cookie: cookieHeader },
      }),
    ]);

    const gammesData = gammesRes.ok ? await gammesRes.json() : null;
    const statsData = statsRes.ok ? await statsRes.json() : null;
    const familiesData = familiesRes.ok ? await familiesRes.json() : null;

    return json({
      gammes: gammesData?.data || [],
      total: gammesData?.total || 0,
      page: gammesData?.page || 1,
      totalPages: gammesData?.totalPages || 1,
      stats: statsData?.data || null,
      families: familiesData?.data || [],
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
      filters: { search: "", familyId: "", gLevel: "", status: "", actionRecommended: "", sortBy: "family_name", sortOrder: "asc" },
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
  const { gammes, total, page, totalPages, stats, families, filters, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const isLoading = navigation.state === "loading";
  const isSubmitting = navigation.state === "submitting";

  // Toast notifications après actions
  useEffect(() => {
    if (actionData?.success) {
      toast.success(actionData.message || "Action effectuée avec succès");
    } else if (actionData && !actionData.success && actionData.message) {
      toast.error(actionData.message);
    }
  }, [actionData]);

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
      setSelectedIds(gammes.map((g: GammeSeoItem) => g.pg_id));
    } else {
      setSelectedIds([]);
    }
  }, [gammes]);

  const handleSelectOne = useCallback((pgId: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, pgId]);
    } else {
      setSelectedIds(prev => prev.filter(id => id !== pgId));
    }
  }, []);

  const handleBatchAction = useCallback((actionId: string) => {
    if (selectedIds.length === 0) return;

    const formData = new FormData();
    formData.set("_action", "batch-action");
    formData.set("pgIds", JSON.stringify(selectedIds));
    formData.set("actionId", actionId);
    submit(formData, { method: "post" });
    setSelectedIds([]);
  }, [selectedIds, submit]);

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
  const getAppreciation = (gamme: GammeSeoItem) => {
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

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">{error}</Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <AdminBreadcrumb currentPage="Gammes SEO" />
          <h1 className="text-3xl font-bold mt-2">Gammes SEO (G-Level)</h1>
          <p className="text-gray-600">
            Classification des 230 gammes avec données Google Trends
          </p>
        </div>
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
              {total} gammes
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
                      checked={selectedIds.length === gammes.length && gammes.length > 0}
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
                  <th className="px-3 py-3 text-center">G-Level</th>
                  <th className="px-3 py-3 text-center">Statut</th>
                  <th className="px-3 py-3 text-center">Score</th>
                  <th className="px-3 py-3 text-left">Recommandation</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {gammes.map((gamme: GammeSeoItem, index: number) => {
                  // Afficher un séparateur quand la famille change (si tri par famille)
                  const prevGamme = index > 0 ? gammes[index - 1] : null;
                  const showFamilySeparator = filters.sortBy === "family_name" && (
                    index === 0 || gamme.family_name !== prevGamme?.family_name
                  );

                  return (
                    <React.Fragment key={gamme.pg_id}>
                      {/* En-tête de famille */}
                      {showFamilySeparator && (
                        <tr className="bg-blue-100 border-t-2 border-blue-300">
                          <td colSpan={8} className="px-3 py-2">
                            <span className="font-bold text-blue-800">
                              {gamme.family_name || "Sans famille"}
                            </span>
                            <span className="ml-2 text-sm text-blue-600">
                              ({gammes.filter((g: GammeSeoItem) => g.family_name === gamme.family_name).length} gammes)
                            </span>
                          </td>
                        </tr>
                      )}
                      {/* Ligne de gamme */}
                      <tr
                        className={`hover:bg-gray-50 ${
                          gamme.action_recommended === "PROMOUVOIR_INDEX"
                            ? "bg-orange-50"
                            : gamme.action_recommended === "VERIFIER_G1"
                            ? "bg-yellow-50"
                            : ""
                        }`}
                      >
                        <td className="px-2 py-3">
                          <Checkbox
                            checked={selectedIds.includes(gamme.pg_id)}
                            onChange={(e) => handleSelectOne(gamme.pg_id, e.target.checked)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{gamme.pg_name}</div>
                          <div className="text-xs text-gray-500">ID: {gamme.pg_id}</div>
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          {gamme.family_name || "-"}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {getTrendsBadge(gamme.trends_index)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {getGLevelBadge(gamme.g_level_recommended, gamme.pg_top)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {getStatusBadge(gamme.pg_level)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {getAppreciation(gamme)}
                        </td>
                        <td className="px-3 py-3">
                          {getRecommendationBadge(gamme.action_recommended)}
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

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Légende des indicateurs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <strong className="text-emerald-700">G-Level:</strong>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-emerald-600"><Star className="h-3 w-3 mr-1" />G1</Badge>
                <span className="text-xs">Prioritaire</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-sky-600">G2</Badge>
                <span className="text-xs">Important</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-slate-400">G3</Badge>
                <span className="text-xs">Secondaire</span>
              </div>
            </div>
            <div>
              <strong className="text-green-700">Trends Google:</strong>
              <div className="flex items-center gap-1 mt-1">
                <Badge className="bg-emerald-600 text-xs">70+</Badge>
                <span className="text-[10px]">EXCELLENT</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Badge className="bg-green-500 text-xs">50-69</Badge>
                <span className="text-[10px]">Très bon</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Badge className="bg-lime-500 text-xs">30-49</Badge>
                <span className="text-[10px]">Bon</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Badge className="bg-amber-500 text-xs">20-29</Badge>
                <span className="text-[10px]">Moyen</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Badge className="bg-orange-500 text-xs">10-19</Badge>
                <span className="text-[10px]">Faible</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Badge className="bg-red-400 text-xs">1-9</Badge>
                <span className="text-[10px]">Très faible</span>
              </div>
            </div>
            <div>
              <strong className="text-blue-700">Score Global:</strong>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-12 h-2 bg-emerald-500 rounded-full" />
                <span className="text-xs font-bold text-emerald-600">A+</span>
                <span className="text-[10px]">(80+)</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-10 h-2 bg-green-500 rounded-full" />
                <span className="text-xs text-green-600">A</span>
                <span className="text-[10px]">(60-79)</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-8 h-2 bg-lime-500 rounded-full" />
                <span className="text-xs text-lime-600">B</span>
                <span className="text-[10px]">(40-59)</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-6 h-2 bg-amber-500 rounded-full" />
                <span className="text-xs text-amber-600">C</span>
                <span className="text-[10px]">(25-39)</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-4 h-2 bg-red-400 rounded-full" />
                <span className="text-xs text-red-500">D</span>
                <span className="text-[10px]">(&lt;25)</span>
              </div>
            </div>
            <div>
              <strong className="text-orange-700">Recommandations:</strong>
              <div className="mt-1 text-xs">
                <Badge className="bg-orange-100 border-2 border-orange-500 text-orange-700 text-[10px] mb-1">
                  <TrendingUp className="h-2 w-2 mr-1" />PROMOUVOIR INDEX
                </Badge>
                <div className="text-[10px] text-gray-500">NOINDEX avec trends &gt;= 30</div>
              </div>
              <div className="mt-2 text-xs">
                <Badge className="bg-blue-100 border-2 border-blue-500 text-blue-700 text-[10px] mb-1">
                  <Star className="h-2 w-2 mr-1" />PROMOUVOIR G1
                </Badge>
                <div className="text-[10px] text-gray-500">INDEX avec trends &gt;= 50</div>
              </div>
              <div className="mt-2 text-xs">
                <Badge className="bg-yellow-100 border-2 border-yellow-500 text-yellow-700 text-[10px] mb-1">
                  <AlertTriangle className="h-2 w-2 mr-1" />VÉRIFIER G1
                </Badge>
                <div className="text-[10px] text-gray-500">G1 avec trends &lt; 5</div>
              </div>
            </div>
            <div>
              <strong className="text-gray-700">Ordre catalogue:</strong>
              <div className="text-xs text-gray-600 mt-1">
                Tri officiel Automecanik:
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                1. Système de filtration
              </div>
              <div className="text-[10px] text-gray-500">
                2. Système de freinage
              </div>
              <div className="text-[10px] text-gray-500">
                3. Courroie, galet...
              </div>
              <div className="text-[10px] text-gray-500">
                ... 19 familles
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
