/**
 * 🎯 ADMIN GAMME SEO DETAIL
 *
 * Dashboard centralisé pour gérer tout le contenu SEO d'une gamme
 * - SEO: Meta title, description, H1, content, switches
 * - Blog: Articles conseil liés
 * - Véhicules: Compatibilités par niveau
 * - V-Level: Motorisations championnes
 * - Conseils: Conseils remplacement
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import {
  useLoaderData,
  useNavigation,
  Link,
  useFetcher,
} from "@remix-run/react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Eye,
  FileText,
  Car,
  TrendingUp,
  Wrench,
  Save,
  Package,
  Calendar,
  ExternalLink,
  Plus,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Download,
  Search,
  Globe,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Trophy,
  BookOpen,
  Zap,
} from "lucide-react";
import { useState, useMemo } from "react";

import { AdminBreadcrumb } from "~/components/admin/AdminBreadcrumb";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";

// Types
interface VLevelItem {
  id: number;
  gamme_name: string;
  model_name: string;
  brand: string;
  variant_name: string;
  energy: string;
  v_level: string;
  rank: number;
  score: number;
  search_volume: number | null;
  updated_at: string | null;
}

// Freshness status helper
const getFreshnessStatus = (lastUpdated: string | null) => {
  if (!lastUpdated)
    return { status: "unknown", color: "gray", text: "Inconnu", icon: "❓" };
  const days = Math.floor(
    (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days <= 7)
    return { status: "fresh", color: "green", text: "Frais", icon: "✅" };
  if (days <= 30)
    return { status: "stale", color: "yellow", text: "Périmé", icon: "⚠️" };
  return { status: "old", color: "red", text: "Ancien", icon: "🔴" };
};

interface GammeDetail {
  gamme: {
    pg_id: number;
    pg_name: string;
    pg_alias: string;
    pg_level: string;
    pg_top: string;
    pg_relfollow: string;
    pg_sitemap: string;
    pg_display: string;
    pg_img: string | null;
  };
  seo: {
    sg_id: number | null;
    sg_title: string;
    sg_descrip: string;
    sg_keywords: string;
    sg_h1: string;
    sg_content: string;
  };
  conseils: Array<{
    sgc_id: number;
    sgc_title: string;
    sgc_content: string;
  }>;
  switchGroups: Array<{
    alias: string;
    count: number;
    sample: string;
    name?: string;
    placeholder?: string;
    usedInTemplate?: boolean;
    variations: Array<{ sis_id: number; content: string }>;
  }>;
  familySwitchGroups: Array<{
    alias: string;
    count: number;
    sample: string;
    name?: string;
    placeholder?: string;
    usedInTemplate?: boolean;
    variations: Array<{ id: number; content: string }>;
  }>;
  articles: Array<{
    ba_id: number;
    ba_title: string;
    ba_alias: string;
    ba_preview: string;
    ba_visit: string;
    ba_create: string;
    ba_update: string;
    sections_count: number;
  }>;
  vehicles: {
    level1: Array<{
      cgc_id: number;
      type_id: number;
      type_name: string;
      marque_name: string;
      modele_name: string;
      fuel: string;
      year_from: string;
      year_to: string;
      power_ps: string;
    }>;
    level2: Array<{
      cgc_id: number;
      type_id: number;
      type_name: string;
      marque_name: string;
      modele_name: string;
      fuel: string;
      year_from: string;
      year_to: string;
      power_ps: string;
    }>;
    level5: Array<{
      cgc_id: number;
      type_id: number;
      type_name: string;
      marque_name: string;
      modele_name: string;
      fuel: string;
      year_from: string;
      year_to: string;
      power_ps: string;
    }>;
  };
  vLevel: {
    v1: VLevelItem[];
    v2: VLevelItem[];
    v3: VLevelItem[];
    v4: VLevelItem[];
    v5: VLevelItem[];
  };
  stats: {
    // 🎯 Valeurs "vérité" (agrégats)
    products_count: number;
    vehicles_count?: number;
    content_words?: number;
    vlevel_counts?: {
      V1: number;
      V2: number;
      V3: number;
      V4: number;
      V5: number;
    };
    // 🏷️ Phase 2 Badges
    priority_score?: number;
    catalog_issues?: string[];
    smart_actions?: Array<{ action: string; priority: string }>;
    // 🏷️ Badges v2 (11 badges)
    // Pilotage
    index_policy?: "INDEX" | "SOFT-INDEX" | "NOINDEX";
    final_priority?: "P1" | "P1-PENDING" | "P2" | "P3" | "SOFT-INDEX";
    // Potentiel
    potential_level?: "HIGH" | "MID" | "LOW";
    demand_level?: "HIGH" | "MID" | "LOW";
    difficulty_level?: "EASY" | "MED" | "HARD";
    intent_type?: "BUY" | "COMPARE" | "INFO" | "MIXED";
    // Réalité Intra-Gamme
    catalog_status?: "OK" | "LOW" | "EMPTY";
    vehicle_coverage?: "COVERED" | "PARTIAL" | "EMPTY";
    content_depth?: "RICH" | "OK" | "THIN";
    freshness_status?: "FRESH" | "STALE" | "EXPIRED";
    cluster_health?: "STRONG" | "MISSING" | "ISOLATED" | "CANNIBAL";
    topic_purity?: "PURE" | "DILUTED";
    // Exécutabilité
    execution_status?: "PASS" | "WARN" | "FAIL";
    // Champs existants (backward compatibility)
    articles_count: number;
    vehicles_level1_count: number;
    vehicles_level2_count: number;
    vehicles_level5_count: number;
    vehicles_total_count: number;
    vLevel_v1_count: number;
    vLevel_v2_count: number;
    vLevel_v3_count: number;
    vLevel_v4_count: number;
    vLevel_v5_count: number;
    vLevel_total_count: number;
    vLevel_last_updated: string | null;
    last_article_date: string | null;
    // 🔍 Debug (valeurs brutes)
    _debug?: {
      products_direct: number;
      products_via_vehicles: number;
      products_via_family: number;
      seo_content_raw_words: number;
      content_breakdown?: {
        seo: number;
        conseil: number;
        switches: number;
        purchaseGuide: number;
      } | null;
      aggregates_computed_at: string | null;
      source_updated_at: string | null;
      _note?: string;
    };
  };
  purchaseGuide: PurchaseGuideData | null;
}

// Interface for Purchase Guide data
interface PurchaseGuideData {
  id?: number;
  pgId?: string;
  step1: {
    title: string;
    content: string;
    highlight: string;
    bullets?: string[];
  };
  step2: {
    economique: {
      subtitle: string;
      description: string;
      specs: string[];
      priceRange: string;
    };
    qualitePlus: {
      subtitle: string;
      description: string;
      specs: string[];
      priceRange: string;
      badge?: string;
    };
    premium: {
      subtitle: string;
      description: string;
      specs: string[];
      priceRange: string;
    };
  };
  step3: {
    title: string;
    content: string;
    alerts: Array<{ type: "danger" | "warning" | "info"; text: string }>;
    relatedGammes?: Array<{ pgId: number; pgName: string; pgAlias: string }>;
  };
  createdAt?: string;
  updatedAt?: string;
}

// Loader
export async function loader({ request, params }: LoaderFunctionArgs) {
  const pgId = params.pgId;
  if (!pgId) {
    throw new Response("pgId manquant", { status: 400 });
  }

  const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
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
    throw new Response("Gamme non trouvée", { status: 404 });
  }

  const result = await response.json();

  if (!result.success) {
    throw new Response(result.message || "Erreur", { status: 500 });
  }

  return json({ detail: result.data as GammeDetail });
}

// Action
export async function action({ request, params }: ActionFunctionArgs) {
  const pgId = params.pgId;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
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
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(seoData),
        },
      );

      const result = await response.json();
      return json(result);
    }

    if (intent === "updateSwitch") {
      const alias = formData.get("alias") as string;
      const content = formData.get("content") as string;

      const response = await fetch(
        `${backendUrl}/api/admin/gammes-seo/${pgId}/switch/${alias}`,
        {
          method: "PATCH",
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        },
      );

      const result = await response.json();
      return json(result);
    }

    if (intent === "updatePurchaseGuide") {
      const guideDataRaw = formData.get("guideData") as string;
      const guideData = JSON.parse(guideDataRaw);

      const response = await fetch(
        `${backendUrl}/api/admin/gammes-seo/${pgId}/purchase-guide`,
        {
          method: "PUT",
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(guideData),
        },
      );

      const result = await response.json();
      return json(result);
    }

    // === INFORMATIONS TECHNIQUES ===
    if (intent === "addInformation") {
      const content = formData.get("content") as string;
      const response = await fetch(
        `${backendUrl}/api/admin/gammes-seo/${pgId}/informations`,
        {
          method: "POST",
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        },
      );
      const result = await response.json();
      return json(result);
    }

    if (intent === "updateInformation") {
      const sgiId = formData.get("sgiId") as string;
      const content = formData.get("content") as string;
      const response = await fetch(
        `${backendUrl}/api/admin/gammes-seo/informations/${sgiId}`,
        {
          method: "PUT",
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        },
      );
      const result = await response.json();
      return json(result);
    }

    if (intent === "deleteInformation") {
      const sgiId = formData.get("sgiId") as string;
      const response = await fetch(
        `${backendUrl}/api/admin/gammes-seo/informations/${sgiId}`,
        {
          method: "DELETE",
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
        },
      );
      const result = await response.json();
      return json(result);
    }

    // === ÉQUIPEMENTIERS ===
    if (intent === "addEquipementier") {
      const pmId = formData.get("pmId") as string;
      const content = formData.get("content") as string;
      const response = await fetch(
        `${backendUrl}/api/admin/gammes-seo/${pgId}/equipementiers`,
        {
          method: "POST",
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pmId: parseInt(pmId, 10), content }),
        },
      );
      const result = await response.json();
      return json(result);
    }

    if (intent === "updateEquipementier") {
      const segId = formData.get("segId") as string;
      const content = formData.get("content") as string;
      const response = await fetch(
        `${backendUrl}/api/admin/gammes-seo/equipementiers/${segId}`,
        {
          method: "PUT",
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        },
      );
      const result = await response.json();
      return json(result);
    }

    if (intent === "deleteEquipementier") {
      const segId = formData.get("segId") as string;
      const response = await fetch(
        `${backendUrl}/api/admin/gammes-seo/equipementiers/${segId}`,
        {
          method: "DELETE",
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
        },
      );
      const result = await response.json();
      return json(result);
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
  const { detail } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const fetcher = useFetcher();

  const _isSubmitting = navigation.state === "submitting";

  // Local state for SEO form
  const [seoForm, setSeoForm] = useState({
    sg_title: detail.seo.sg_title || "",
    sg_descrip: detail.seo.sg_descrip || "",
    sg_keywords: detail.seo.sg_keywords || "",
    sg_h1: detail.seo.sg_h1 || "",
    sg_content: detail.seo.sg_content || "",
  });

  // State for expandable switches
  const [expandedSwitches, setExpandedSwitches] = useState<Set<string>>(
    new Set(),
  );
  const [showAllVariations, setShowAllVariations] = useState<Set<string>>(
    new Set(),
  );
  const MAX_VISIBLE_VARIATIONS = 5;

  // State for article edit modal
  const [editingArticle, setEditingArticle] = useState<{
    ba_id: number;
    ba_title: string;
    ba_preview: string;
  } | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    preview: "",
  });
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [energyFilter, setEnergyFilter] = useState<
    "all" | "diesel" | "essence"
  >("all");
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // State pour édition Family Switches
  const [editingSwitch, setEditingSwitch] = useState<{
    id: number;
    content: string;
  } | null>(null);
  const [newSwitchAlias, setNewSwitchAlias] = useState<number | null>(null);
  const [newSwitchContent, setNewSwitchContent] = useState("");
  const [switchSaving, setSwitchSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    violations: Array<{
      model_name: string;
      variant_name: string;
      energy: string;
      v2_count: number;
      g1_total: number;
      percentage: number;
    }>;
    g1_count: number;
    summary: { total_v1: number; valid_v1: number; invalid_v1: number };
  } | null>(null);

  // State for Purchase Guide form
  const getDefaultGuideForm = (): Omit<
    PurchaseGuideData,
    "id" | "pgId" | "createdAt" | "updatedAt"
  > => ({
    step1: {
      title: `Identifiez votre ${detail.gamme.pg_name.toLowerCase()}`,
      content: "",
      highlight: "",
      bullets: [],
    },
    step2: {
      economique: {
        subtitle: "Usage standard",
        description: "",
        specs: [],
        priceRange: "",
      },
      qualitePlus: {
        subtitle: "Équipement d'origine",
        description: "",
        specs: [],
        priceRange: "",
        badge: "Le plus choisi",
      },
      premium: {
        subtitle: "Haute performance",
        description: "",
        specs: [],
        priceRange: "",
      },
    },
    step3: {
      title: "Sécurité et conseils",
      content: "",
      alerts: [],
      relatedGammes: [],
    },
  });

  const [guideForm, setGuideForm] = useState(() => {
    if (detail.purchaseGuide) {
      return {
        step1: detail.purchaseGuide.step1,
        step2: detail.purchaseGuide.step2,
        step3: detail.purchaseGuide.step3,
      };
    }
    return getDefaultGuideForm();
  });
  const [guideSaving, setGuideSaving] = useState(false);

  // Helper to update nested guide form state
  const updateGuideForm = (path: string, value: any) => {
    setGuideForm((prev) => {
      const newForm = JSON.parse(JSON.stringify(prev));
      const parts = path.split(".");
      let current = newForm;
      for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
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

  // Détecter les doublons V2 par énergie (violation règle V2 = UNIQUE par gamme+énergie)
  const v2Violations = useMemo(() => {
    const check = (items: VLevelItem[], energy: string) => {
      const models = items
        .filter((v) => v.energy?.toLowerCase() === energy)
        .map((v) => v.model_name);
      const duplicates = models.filter((m, i) => models.indexOf(m) !== i);
      return [...new Set(duplicates)];
    };
    return {
      diesel: check(detail.vLevel.v2, "diesel"),
      essence: check(detail.vLevel.v2, "essence"),
    };
  }, [detail.vLevel.v2]);

  // Handlers pour Family Switches CRUD
  const handleCreateSwitch = async (alias: number, content: string) => {
    setSwitchSaving(true);
    try {
      const response = await fetch(
        `/api/admin/gammes-seo/${detail.gamme.pg_id}/switches`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alias, content }),
        },
      );
      const result = await response.json();
      if (result.success) {
        setNewSwitchAlias(null);
        setNewSwitchContent("");
        window.location.reload(); // Refresh pour voir le nouveau switch
      } else {
        alert(result.message || "Erreur lors de la création");
      }
    } catch (error) {
      alert("Erreur réseau");
    } finally {
      setSwitchSaving(false);
    }
  };

  const handleUpdateSwitch = async (id: number, content: string) => {
    setSwitchSaving(true);
    try {
      const response = await fetch(
        `/api/admin/gammes-seo/${detail.gamme.pg_id}/switches/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      const result = await response.json();
      if (result.success) {
        setEditingSwitch(null);
        window.location.reload();
      } else {
        alert(result.message || "Erreur lors de la mise à jour");
      }
    } catch (error) {
      alert("Erreur réseau");
    } finally {
      setSwitchSaving(false);
    }
  };

  const handleDeleteSwitch = async (id: number) => {
    if (!confirm("Supprimer ce switch ?")) return;
    setSwitchSaving(true);
    try {
      const response = await fetch(
        `/api/admin/gammes-seo/${detail.gamme.pg_id}/switches/${id}`,
        {
          method: "DELETE",
        },
      );
      const result = await response.json();
      if (result.success) {
        window.location.reload();
      } else {
        alert(result.message || "Erreur lors de la suppression");
      }
    } catch (error) {
      alert("Erreur réseau");
    } finally {
      setSwitchSaving(false);
    }
  };

  // Export CSV V-Levels
  const exportVLevelToCSV = () => {
    const allItems = [
      ...detail.vLevel.v1.map((v) => ({ ...v, level: "V1" })),
      ...detail.vLevel.v2.map((v) => ({ ...v, level: "V2" })),
      ...detail.vLevel.v3.map((v) => ({ ...v, level: "V3" })),
      ...detail.vLevel.v4.map((v) => ({ ...v, level: "V4" })),
      ...detail.vLevel.v5.map((v) => ({ ...v, level: "V5" })),
    ];

    const headers = [
      "V-Level",
      "Marque",
      "Modele",
      "Variante",
      "Energie",
      "Rang",
      "Score",
      "Volume",
    ];
    const rows = allItems.map((v) => [
      v.level,
      v.brand,
      v.model_name,
      v.variant_name,
      v.energy,
      v.rank,
      v.score,
      v.search_volume || "",
    ]);

    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `v-level-${detail.gamme.pg_alias}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Recalcul V-Level
  const handleRecalculateVLevel = async () => {
    setIsRecalculating(true);
    try {
      const res = await fetch(
        `/api/admin/gammes-seo/${detail.gamme.pg_id}/recalculate-vlevel`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (res.ok) {
        // Rafraîchir la page pour voir les nouvelles données
        window.location.reload();
      }
    } catch (error) {
      console.error("Erreur recalcul V-Level:", error);
    } finally {
      setIsRecalculating(false);
    }
  };

  // Validation V1 >= 30% G1
  const handleValidateV1Rules = async () => {
    setIsValidating(true);
    try {
      const res = await fetch("/api/admin/gammes-seo/v-level/validate", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setValidationResult(data.data);
      }
    } catch (error) {
      console.error("Erreur validation V1:", error);
    } finally {
      setIsValidating(false);
    }
  };

  // Filtre V-Level par énergie
  const filterByEnergy = (items: VLevelItem[]) => {
    if (energyFilter === "all") return items;
    return items.filter((item) => item.energy?.toLowerCase() === energyFilter);
  };

  // Fonction d'export CSV pour les véhicules
  const exportVehiclesToCSV = (
    vehicles: typeof detail.vehicles.level1,
    filename: string,
  ) => {
    const headers = [
      "Marque",
      "Modèle",
      "Moteur",
      "Puissance",
      "Carburant",
      "Années",
    ];
    const rows = vehicles.map((v) => [
      v.marque_name,
      v.modele_name,
      v.type_name,
      v.power_ps ? `${v.power_ps}ch` : "",
      v.fuel || "",
      v.year_from && v.year_to ? `${v.year_from}-${v.year_to}` : "",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filtrer et trier les véhicules
  const filterAndSortVehicles = (vehicles: typeof detail.vehicles.level1) => {
    return vehicles
      .filter((v) =>
        `${v.marque_name} ${v.modele_name} ${v.type_name}`
          .toLowerCase()
          .includes(vehicleSearch.toLowerCase()),
      )
      .sort(
        (a, b) => parseInt(b.year_from || "0") - parseInt(a.year_from || "0"),
      );
  };

  // Fonction pour la couleur du badge selon le carburant
  const getFuelBadgeClass = (fuel: string) => {
    const fuelLower = fuel?.toLowerCase() || "";
    if (fuelLower.includes("diesel"))
      return "bg-blue-100 text-blue-800 border-blue-200";
    if (fuelLower.includes("essence"))
      return "bg-green-100 text-green-800 border-green-200";
    if (fuelLower.includes("hybrid") || fuelLower.includes("électrique"))
      return "bg-purple-100 text-purple-800 border-purple-200";
    return "";
  };

  // Fonction pour la couleur des compteurs de caractères SEO
  const getCharCountClass = (current: number, optimal: number, max: number) => {
    if (current === 0) return "text-gray-400";
    if (current <= optimal) return "text-green-600";
    if (current <= max) return "text-yellow-600";
    return "text-red-600";
  };

  // Fonction pour le status des compteurs de caractères
  const getCharCountStatus = (
    current: number,
    optimal: number,
    max: number,
  ) => {
    if (current === 0) return "Vide";
    if (current <= optimal) return "Optimal";
    if (current <= max) return "Acceptable";
    return "Trop long";
  };

  // Progress bar pour les stats
  const _getProgressColor = (value: number, target: number) => {
    const ratio = value / target;
    if (ratio >= 0.8) return "bg-green-500";
    if (ratio >= 0.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  const toggleSwitch = (alias: string) => {
    setExpandedSwitches((prev) => {
      const next = new Set(prev);
      if (next.has(alias)) {
        next.delete(alias);
      } else {
        next.add(alias);
      }
      return next;
    });
  };

  const toggleShowAllVariations = (key: string) => {
    setShowAllVariations((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Status badges
  const isIndexed = detail.gamme.pg_level === "1";
  const isG1 = detail.gamme.pg_top === "1";
  const inSitemap = detail.gamme.pg_sitemap === "1";

  // Open edit modal for an article
  const openEditModal = (article: (typeof detail.articles)[0]) => {
    setEditingArticle({
      ba_id: article.ba_id,
      ba_title: article.ba_title,
      ba_preview: article.ba_preview,
    });
    setEditForm({
      title: article.ba_title,
      preview: article.ba_preview,
    });
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
        // Refresh the page to get updated data
        window.location.reload();
      } else {
        alert("Erreur: " + (result.message || "Impossible de sauvegarder"));
      }
    } catch (error) {
      alert("Erreur de connexion");
    } finally {
      setIsEditSaving(false);
      setEditingArticle(null);
    }
  };

  // Composant VLevelCard pour afficher chaque niveau
  const VLevelCard = ({
    title,
    description,
    items,
    colorClass,
    icon,
    defaultExpanded = true,
  }: {
    title: string;
    description: string;
    items: VLevelItem[];
    colorClass: string;
    icon: string;
    defaultExpanded?: boolean;
  }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const dieselItems = items.filter(
      (v) => v.energy?.toLowerCase() === "diesel",
    );
    const essenceItems = items.filter(
      (v) =>
        v.energy?.toLowerCase() === "essence" ||
        v.energy?.toLowerCase() === "petrol",
    );

    return (
      <Card className={colorClass}>
        <CardHeader
          className="cursor-pointer py-3"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{icon}</span>
              <div>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="text-xs">
                  {description}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{items.length}</Badge>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </div>
        </CardHeader>
        {isExpanded && items.length > 0 && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-4">
              {/* Diesel */}
              <div>
                <h4 className="text-sm font-medium text-blue-700 mb-2 flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  Diesel ({dieselItems.length})
                </h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {dieselItems.length === 0 ? (
                    <span className="text-gray-400 text-sm">Aucun</span>
                  ) : (
                    dieselItems.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between text-sm bg-white p-2 rounded border"
                      >
                        <span className="truncate flex-1">
                          {v.brand} {v.model_name} {v.variant_name}
                        </span>
                        <div className="flex items-center gap-2 text-xs ml-2">
                          {v.search_volume && (
                            <span className="text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                              {v.search_volume.toLocaleString()}/m
                            </span>
                          )}
                          <span className="text-gray-400">
                            #{v.rank} ({v.score})
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {/* Essence */}
              <div>
                <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  Essence ({essenceItems.length})
                </h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {essenceItems.length === 0 ? (
                    <span className="text-gray-400 text-sm">Aucun</span>
                  ) : (
                    essenceItems.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between text-sm bg-white p-2 rounded border"
                      >
                        <span className="truncate flex-1">
                          {v.brand} {v.model_name} {v.variant_name}
                        </span>
                        <div className="flex items-center gap-2 text-xs ml-2">
                          {v.search_volume && (
                            <span className="text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                              {v.search_volume.toLocaleString()}/m
                            </span>
                          )}
                          <span className="text-gray-400">
                            #{v.rank} ({v.score})
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        )}
        {isExpanded && items.length === 0 && (
          <CardContent className="pt-0">
            <p className="text-center text-gray-400 py-4 text-sm">
              Aucune motorisation dans ce niveau
            </p>
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Breadcrumb */}
      <AdminBreadcrumb currentPage={`Gammes SEO > ${detail.gamme.pg_name}`} />

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
          <Badge variant={isIndexed ? "default" : "secondary"}>
            {isIndexed ? "INDEX" : "NOINDEX"}
          </Badge>
          {isG1 && <Badge variant="default">G1</Badge>}
          {inSitemap && <Badge variant="outline">Sitemap</Badge>}
          {detail.stats.vLevel_v1_count > 0 && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-300">
              <Trophy className="h-3 w-3 mr-1" />
              {detail.stats.vLevel_v1_count} V1
            </Badge>
          )}
          <Link to="/admin/v-level-status">
            <Button
              variant="outline"
              size="sm"
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              V-Level
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
          <a
            href={`https://automecanik.com/pieces-auto/${detail.gamme.pg_alias}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              Voir la page
            </Button>
          </a>
        </div>
      </div>

      {/* Stats Cards - Améliorées avec progress bars + Phase 1 Badges v2 */}
      <div className="mb-6">
        {/* Header avec bouton Refresh */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-500">
            Statistiques agrégées
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const response = await fetch(
                  `/api/admin/gammes-seo/${detail.gamme.pg_id}/refresh-aggregates`,
                  {
                    method: "POST",
                    credentials: "include",
                  },
                );
                if (response.ok) {
                  window.location.reload();
                }
              } catch (e) {
                console.error("Error refreshing aggregates:", e);
              }
            }}
            className="text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Rafraîchir stats
          </Button>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {/* Produits - avec debug breakdown */}
          <Card
            className={
              detail.stats.products_count > 0
                ? "border-green-200"
                : "border-orange-200"
            }
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-500">Produits</p>
                  <p className="text-2xl font-bold">
                    {detail.stats.products_count}
                  </p>
                  {/* Debug breakdown si disponible */}
                  {detail.stats._debug &&
                    detail.stats._debug.products_direct !==
                      detail.stats.products_count && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Direct: {detail.stats._debug.products_direct} | Via véh:{" "}
                        {detail.stats._debug.products_via_vehicles}
                      </p>
                    )}
                </div>
                <div
                  className={`p-2 rounded-full ${detail.stats.products_count > 0 ? "bg-green-100" : "bg-orange-100"}`}
                >
                  <Package
                    className={`h-6 w-6 ${detail.stats.products_count > 0 ? "text-green-600" : "text-orange-600"}`}
                  />
                </div>
              </div>
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${detail.stats.products_count > 50 ? "bg-green-500" : detail.stats.products_count > 0 ? "bg-yellow-500" : "bg-gray-300"}`}
                  style={{
                    width: `${Math.min((detail.stats.products_count / 100) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {detail.stats.products_count > 50
                  ? "Bien fourni"
                  : detail.stats.products_count > 0
                    ? "À enrichir"
                    : "Aucun produit"}
              </p>
            </CardContent>
          </Card>

          {/* Contenu (mots) - NOUVEAU */}
          <Card
            className={
              (detail.stats.content_words || 0) > 500
                ? "border-indigo-200"
                : "border-gray-200"
            }
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-500">Contenu</p>
                  <p className="text-2xl font-bold">
                    {detail.stats.content_words || 0}
                  </p>
                  {/* Breakdown par source */}
                  {detail.stats._debug?.content_breakdown && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      SEO: {detail.stats._debug.content_breakdown.seo} | Guide:{" "}
                      {detail.stats._debug.content_breakdown.purchaseGuide}
                    </p>
                  )}
                </div>
                <div
                  className={`p-2 rounded-full ${(detail.stats.content_words || 0) > 500 ? "bg-indigo-100" : "bg-gray-100"}`}
                >
                  <FileText
                    className={`h-6 w-6 ${(detail.stats.content_words || 0) > 500 ? "text-indigo-600" : "text-gray-400"}`}
                  />
                </div>
              </div>
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${(detail.stats.content_words || 0) > 1000 ? "bg-green-500" : (detail.stats.content_words || 0) > 500 ? "bg-indigo-500" : "bg-gray-300"}`}
                  style={{
                    width: `${Math.min(((detail.stats.content_words || 0) / 2000) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {(detail.stats.content_words || 0) > 1000
                  ? "Riche"
                  : (detail.stats.content_words || 0) > 500
                    ? "Correct"
                    : (detail.stats.content_words || 0) > 0
                      ? "Léger"
                      : "Vide"}
              </p>
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
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${detail.stats.articles_count >= 3 ? "bg-green-500" : detail.stats.articles_count > 0 ? "bg-blue-500" : "bg-gray-300"}`}
                  style={{
                    width: `${Math.min((detail.stats.articles_count / 5) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {detail.stats.articles_count >= 3
                  ? "Contenu riche"
                  : detail.stats.articles_count > 0
                    ? `${3 - detail.stats.articles_count} article(s) de plus recommandé(s)`
                    : "Aucun article"}
              </p>
            </CardContent>
          </Card>

          {/* Motorisations V-Level */}
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
                  <p className="text-sm text-gray-500">Motorisations V-Level</p>
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
              {/* Mini bars par V-Level */}
              <div className="flex gap-0.5 mb-1">
                {[
                  {
                    key: "v1",
                    count: detail.stats.vLevel_v1_count,
                    color: "bg-amber-500",
                  },
                  {
                    key: "v2",
                    count: detail.stats.vLevel_v2_count,
                    color: "bg-green-500",
                  },
                  {
                    key: "v3",
                    count: detail.stats.vLevel_v3_count,
                    color: "bg-blue-500",
                  },
                  {
                    key: "v4",
                    count: detail.stats.vLevel_v4_count,
                    color: "bg-gray-400",
                  },
                  {
                    key: "v5",
                    count: detail.stats.vLevel_v5_count,
                    color: "bg-orange-500",
                  },
                ].map(({ key, count, color }) => (
                  <div key={key} className="flex-1">
                    <div
                      className={`h-1.5 ${color} rounded-sm`}
                      style={{
                        width: `${Math.max((count / Math.max(detail.stats.vLevel_total_count, 1)) * 100, count > 0 ? 10 : 0)}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-400 flex-wrap gap-1">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  V1: {detail.stats.vLevel_v1_count}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  V2: {detail.stats.vLevel_v2_count}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  V3: {detail.stats.vLevel_v3_count}
                </span>
              </div>
              {/* Indicateur fraîcheur des données */}
              {(() => {
                const freshness = getFreshnessStatus(
                  detail.stats.vLevel_last_updated,
                );
                return (
                  <div
                    className={`mt-2 pt-2 border-t text-xs flex items-center justify-between ${
                      freshness.status === "old"
                        ? "text-red-600 bg-red-50 -mx-4 -mb-4 px-4 py-2 rounded-b-lg"
                        : freshness.status === "stale"
                          ? "text-yellow-700"
                          : "text-gray-500"
                    }`}
                  >
                    <span>
                      {freshness.icon} MAJ:{" "}
                      {detail.stats.vLevel_last_updated
                        ? new Date(
                            detail.stats.vLevel_last_updated,
                          ).toLocaleDateString("fr-FR")
                        : "Jamais"}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        freshness.status === "fresh"
                          ? "bg-green-100 text-green-700"
                          : freshness.status === "stale"
                            ? "bg-yellow-100 text-yellow-700"
                            : freshness.status === "old"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {freshness.text}
                    </span>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Dernier article */}
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
                  {(() => {
                    const days = Math.floor(
                      (Date.now() -
                        new Date(detail.stats.last_article_date).getTime()) /
                        (1000 * 60 * 60 * 24),
                    );
                    if (days === 0) return "Aujourd'hui";
                    if (days === 1) return "Hier";
                    if (days < 30) return `Il y a ${days} jours`;
                    if (days < 365)
                      return `Il y a ${Math.floor(days / 30)} mois`;
                    return `Il y a ${Math.floor(days / 365)} an(s)`;
                  })()}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== BADGES SEO v2 - 11 BADGES ===== */}

        {/* GROUPE A: Pilotage SEO (2 badges) */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Search className="h-4 w-4" />
            Pilotage SEO
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Index Policy */}
            {(() => {
              const policy = detail.stats.index_policy ?? "NOINDEX";
              const colors = {
                INDEX: {
                  border: "border-l-green-500",
                  bg: "bg-green-100",
                  text: "text-green-700",
                  badge: "bg-green-600",
                },
                "SOFT-INDEX": {
                  border: "border-l-yellow-500",
                  bg: "bg-yellow-100",
                  text: "text-yellow-700",
                  badge: "bg-yellow-600",
                },
                NOINDEX: {
                  border: "border-l-gray-400",
                  bg: "bg-gray-100",
                  text: "text-gray-500",
                  badge: "bg-gray-500",
                },
              };
              const c = colors[policy] || colors.NOINDEX;
              return (
                <Card className={`border-l-4 ${c.border}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          Index Policy
                        </p>
                        <Badge className={`mt-1 ${c.badge}`}>{policy}</Badge>
                      </div>
                      <div className={`p-2 rounded-full ${c.bg}`}>
                        <Search className={`h-5 w-5 ${c.text}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Final Priority */}
            {(() => {
              const priority = detail.stats.final_priority ?? "P3";
              const colors: Record<
                string,
                { border: string; bg: string; text: string; badge: string }
              > = {
                P1: {
                  border: "border-l-red-500",
                  bg: "bg-red-100",
                  text: "text-red-700",
                  badge: "bg-red-600",
                },
                "P1-PENDING": {
                  border: "border-l-orange-500",
                  bg: "bg-orange-100",
                  text: "text-orange-700",
                  badge: "bg-orange-500",
                },
                P2: {
                  border: "border-l-blue-500",
                  bg: "bg-blue-100",
                  text: "text-blue-700",
                  badge: "bg-blue-600",
                },
                P3: {
                  border: "border-l-gray-400",
                  bg: "bg-gray-100",
                  text: "text-gray-500",
                  badge: "bg-gray-500",
                },
                "SOFT-INDEX": {
                  border: "border-l-yellow-500",
                  bg: "bg-yellow-100",
                  text: "text-yellow-700",
                  badge: "bg-yellow-600",
                },
              };
              const c = colors[priority] || colors.P3;
              return (
                <Card className={`border-l-4 ${c.border}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          Priorité Finale
                        </p>
                        <Badge className={`mt-1 ${c.badge}`}>{priority}</Badge>
                        <p className="text-xs text-gray-400 mt-1">
                          Score: {detail.stats.priority_score ?? 0}/100
                        </p>
                      </div>
                      <div className={`p-2 rounded-full ${c.bg}`}>
                        <TrendingUp className={`h-5 w-5 ${c.text}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        </div>

        {/* GROUPE B: Potentiel (4 badges) */}
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Potentiel SEO
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {/* Demand Level */}
            {(() => {
              const level = detail.stats.demand_level ?? "LOW";
              const colors: Record<
                string,
                { bg: string; text: string; icon: string }
              > = {
                HIGH: {
                  bg: "bg-green-50",
                  text: "text-green-700",
                  icon: "text-green-500",
                },
                MID: {
                  bg: "bg-yellow-50",
                  text: "text-yellow-700",
                  icon: "text-yellow-500",
                },
                LOW: {
                  bg: "bg-gray-50",
                  text: "text-gray-600",
                  icon: "text-gray-400",
                },
              };
              const c = colors[level] || colors.LOW;
              return (
                <div className={`p-3 rounded-lg ${c.bg} text-center`}>
                  <p className="text-xs text-gray-500 mb-1">Demande</p>
                  <Badge
                    variant="outline"
                    className={`${c.text} border-current`}
                  >
                    {level}
                  </Badge>
                </div>
              );
            })()}

            {/* Difficulty */}
            {(() => {
              const level = detail.stats.difficulty_level ?? "MED";
              const colors: Record<
                string,
                { bg: string; text: string; icon: string }
              > = {
                EASY: {
                  bg: "bg-green-50",
                  text: "text-green-700",
                  icon: "text-green-500",
                },
                MED: {
                  bg: "bg-yellow-50",
                  text: "text-yellow-700",
                  icon: "text-yellow-500",
                },
                HARD: {
                  bg: "bg-red-50",
                  text: "text-red-700",
                  icon: "text-red-500",
                },
              };
              const c = colors[level] || colors.MED;
              return (
                <div className={`p-3 rounded-lg ${c.bg} text-center`}>
                  <p className="text-xs text-gray-500 mb-1">Difficulté</p>
                  <Badge
                    variant="outline"
                    className={`${c.text} border-current`}
                  >
                    {level}
                  </Badge>
                </div>
              );
            })()}

            {/* Intent Type */}
            {(() => {
              const intent = detail.stats.intent_type ?? "COMPARE";
              const colors: Record<string, { bg: string; text: string }> = {
                BUY: { bg: "bg-green-50", text: "text-green-700" },
                COMPARE: { bg: "bg-blue-50", text: "text-blue-700" },
                INFO: { bg: "bg-purple-50", text: "text-purple-700" },
                MIXED: { bg: "bg-gray-50", text: "text-gray-600" },
              };
              const c = colors[intent] || colors.COMPARE;
              return (
                <div className={`p-3 rounded-lg ${c.bg} text-center`}>
                  <p className="text-xs text-gray-500 mb-1">Intent</p>
                  <Badge
                    variant="outline"
                    className={`${c.text} border-current`}
                  >
                    {intent}
                  </Badge>
                </div>
              );
            })()}

            {/* Potential Level */}
            {(() => {
              const level = detail.stats.potential_level ?? "LOW";
              const colors: Record<string, { bg: string; text: string }> = {
                HIGH: { bg: "bg-green-50", text: "text-green-700" },
                MID: { bg: "bg-yellow-50", text: "text-yellow-700" },
                LOW: { bg: "bg-gray-50", text: "text-gray-600" },
              };
              const c = colors[level] || colors.LOW;
              return (
                <div className={`p-3 rounded-lg ${c.bg} text-center`}>
                  <p className="text-xs text-gray-500 mb-1">Potentiel</p>
                  <Badge
                    variant="outline"
                    className={`${c.text} border-current`}
                  >
                    {level}
                  </Badge>
                </div>
              );
            })()}
          </div>
        </div>

        {/* GROUPE C: Réalité Intra-Gamme (6 badges) */}
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Réalité Intra-Gamme
          </h3>
          <div className="grid grid-cols-6 gap-2">
            {/* Catalog Status */}
            {(() => {
              const status = detail.stats.catalog_status ?? "EMPTY";
              const colors: Record<string, { bg: string; text: string }> = {
                OK: { bg: "bg-green-100", text: "text-green-700" },
                LOW: { bg: "bg-yellow-100", text: "text-yellow-700" },
                EMPTY: { bg: "bg-red-100", text: "text-red-700" },
              };
              const c = colors[status] || colors.EMPTY;
              return (
                <div className={`p-2 rounded-lg ${c.bg} text-center`}>
                  <p className="text-[10px] text-gray-500 mb-0.5">Catalogue</p>
                  <span className={`text-xs font-medium ${c.text}`}>
                    {status}
                  </span>
                </div>
              );
            })()}

            {/* Vehicle Coverage */}
            {(() => {
              const status = detail.stats.vehicle_coverage ?? "EMPTY";
              const colors: Record<string, { bg: string; text: string }> = {
                COVERED: { bg: "bg-green-100", text: "text-green-700" },
                PARTIAL: { bg: "bg-yellow-100", text: "text-yellow-700" },
                EMPTY: { bg: "bg-red-100", text: "text-red-700" },
              };
              const c = colors[status] || colors.EMPTY;
              return (
                <div className={`p-2 rounded-lg ${c.bg} text-center`}>
                  <p className="text-[10px] text-gray-500 mb-0.5">Véhicules</p>
                  <span className={`text-xs font-medium ${c.text}`}>
                    {status}
                  </span>
                </div>
              );
            })()}

            {/* Content Depth */}
            {(() => {
              const status = detail.stats.content_depth ?? "THIN";
              const colors: Record<string, { bg: string; text: string }> = {
                RICH: { bg: "bg-green-100", text: "text-green-700" },
                OK: { bg: "bg-yellow-100", text: "text-yellow-700" },
                THIN: { bg: "bg-red-100", text: "text-red-700" },
              };
              const c = colors[status] || colors.THIN;
              return (
                <div className={`p-2 rounded-lg ${c.bg} text-center`}>
                  <p className="text-[10px] text-gray-500 mb-0.5">Contenu</p>
                  <span className={`text-xs font-medium ${c.text}`}>
                    {status}
                  </span>
                </div>
              );
            })()}

            {/* Freshness */}
            {(() => {
              const status = detail.stats.freshness_status ?? "EXPIRED";
              const colors: Record<string, { bg: string; text: string }> = {
                FRESH: { bg: "bg-green-100", text: "text-green-700" },
                STALE: { bg: "bg-yellow-100", text: "text-yellow-700" },
                EXPIRED: { bg: "bg-red-100", text: "text-red-700" },
              };
              const c = colors[status] || colors.EXPIRED;
              return (
                <div className={`p-2 rounded-lg ${c.bg} text-center`}>
                  <p className="text-[10px] text-gray-500 mb-0.5">Fraîcheur</p>
                  <span className={`text-xs font-medium ${c.text}`}>
                    {status}
                  </span>
                </div>
              );
            })()}

            {/* Cluster Health */}
            {(() => {
              const status = detail.stats.cluster_health ?? "ISOLATED";
              const colors: Record<string, { bg: string; text: string }> = {
                STRONG: { bg: "bg-green-100", text: "text-green-700" },
                MISSING: { bg: "bg-yellow-100", text: "text-yellow-700" },
                ISOLATED: { bg: "bg-red-100", text: "text-red-700" },
                CANNIBAL: { bg: "bg-purple-100", text: "text-purple-700" },
              };
              const c = colors[status] || colors.ISOLATED;
              return (
                <div className={`p-2 rounded-lg ${c.bg} text-center`}>
                  <p className="text-[10px] text-gray-500 mb-0.5">Cluster</p>
                  <span className={`text-xs font-medium ${c.text}`}>
                    {status}
                  </span>
                </div>
              );
            })()}

            {/* Topic Purity */}
            {(() => {
              const status = detail.stats.topic_purity ?? "PURE";
              const colors: Record<string, { bg: string; text: string }> = {
                PURE: { bg: "bg-green-100", text: "text-green-700" },
                DILUTED: { bg: "bg-orange-100", text: "text-orange-700" },
              };
              const c = colors[status] || colors.PURE;
              return (
                <div className={`p-2 rounded-lg ${c.bg} text-center`}>
                  <p className="text-[10px] text-gray-500 mb-0.5">Topic</p>
                  <span className={`text-xs font-medium ${c.text}`}>
                    {status}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* VERDICT: Execution Status + Smart Actions */}
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Execution Status */}
            {(() => {
              const status = detail.stats.execution_status ?? "FAIL";
              const colors: Record<
                string,
                { border: string; bg: string; text: string; badge: string }
              > = {
                PASS: {
                  border: "border-l-green-500",
                  bg: "bg-green-100",
                  text: "text-green-700",
                  badge: "bg-green-600",
                },
                WARN: {
                  border: "border-l-yellow-500",
                  bg: "bg-yellow-100",
                  text: "text-yellow-700",
                  badge: "bg-yellow-600",
                },
                FAIL: {
                  border: "border-l-red-500",
                  bg: "bg-red-100",
                  text: "text-red-700",
                  badge: "bg-red-600",
                },
              };
              const c = colors[status] || colors.FAIL;
              const issuesCount = detail.stats.catalog_issues?.length ?? 0;
              return (
                <Card className={`border-l-4 ${c.border}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          Exécutabilité
                        </p>
                        <Badge className={`mt-1 ${c.badge}`}>{status}</Badge>
                        {issuesCount > 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            {issuesCount} issue{issuesCount > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                      <div className={`p-2 rounded-full ${c.bg}`}>
                        <CheckCircle2 className={`h-5 w-5 ${c.text}`} />
                      </div>
                    </div>
                    {detail.stats.catalog_issues &&
                      detail.stats.catalog_issues.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {detail.stats.catalog_issues.map(
                            (issue: string, i: number) => (
                              <span
                                key={i}
                                className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-700 rounded"
                              >
                                {issue.replace(/_/g, " ")}
                              </span>
                            ),
                          )}
                        </div>
                      )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Smart Actions */}
            <Card
              className={`border-l-4 ${
                !detail.stats.smart_actions ||
                detail.stats.smart_actions.length === 0
                  ? "border-l-green-500"
                  : detail.stats.smart_actions.some(
                        (a: { priority: string }) => a.priority === "CRITICAL",
                      )
                    ? "border-l-red-500"
                    : "border-l-orange-500"
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Actions Suggérées
                    </p>
                    {!detail.stats.smart_actions ||
                    detail.stats.smart_actions.length === 0 ? (
                      <Badge className="mt-1 bg-green-600">Aucune</Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="mt-1 border-orange-300 text-orange-700"
                      >
                        {detail.stats.smart_actions.length} action
                        {detail.stats.smart_actions.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <div
                    className={`p-2 rounded-full ${
                      !detail.stats.smart_actions ||
                      detail.stats.smart_actions.length === 0
                        ? "bg-green-100"
                        : "bg-orange-100"
                    }`}
                  >
                    <Zap
                      className={`h-5 w-5 ${
                        !detail.stats.smart_actions ||
                        detail.stats.smart_actions.length === 0
                          ? "text-green-600"
                          : "text-orange-600"
                      }`}
                    />
                  </div>
                </div>
                {detail.stats.smart_actions &&
                  detail.stats.smart_actions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {detail.stats.smart_actions.map(
                        (
                          action: { action: string; priority: string },
                          i: number,
                        ) => (
                          <div
                            key={i}
                            className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${
                              action.priority === "CRITICAL"
                                ? "bg-red-50 text-red-700"
                                : action.priority === "HIGH"
                                  ? "bg-orange-50 text-orange-700"
                                  : action.priority === "MEDIUM"
                                    ? "bg-yellow-50 text-yellow-700"
                                    : "bg-gray-50 text-gray-600"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                action.priority === "CRITICAL"
                                  ? "bg-red-500"
                                  : action.priority === "HIGH"
                                    ? "bg-orange-500"
                                    : action.priority === "MEDIUM"
                                      ? "bg-yellow-500"
                                      : "bg-gray-400"
                              }`}
                            />
                            {action.action.replace(/_/g, " ")}
                          </div>
                        ),
                      )}
                    </div>
                  )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="seo" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="seo" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            SEO
          </TabsTrigger>
          <TabsTrigger value="informations" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Informations
          </TabsTrigger>
          <TabsTrigger
            value="equipementiers"
            className="flex items-center gap-2"
          >
            <Package className="h-4 w-4" />
            Équipementiers
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

        {/* TAB SEO */}
        <TabsContent value="seo">
          {/* Google Preview */}
          <Card className="mb-6 border-blue-200 bg-gradient-to-r from-blue-50 to-white">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Aperçu Google</CardTitle>
              </div>
              <CardDescription>
                Prévisualisation de l'affichage dans les résultats de recherche
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-white p-4 rounded-lg border shadow-sm max-w-2xl">
                {/* URL */}
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-orange-600">A</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-700">
                      automecanik.com
                    </span>
                    <span className="text-sm text-gray-500">
                      {" "}
                      › pieces › {detail.gamme.pg_alias}
                    </span>
                  </div>
                </div>
                {/* Title */}
                <h3 className="text-xl text-blue-800 hover:underline cursor-pointer mb-1 leading-tight">
                  {seoForm.sg_title ||
                    detail.gamme.pg_name ||
                    "Titre de la page"}
                </h3>
                {/* Description */}
                <p className="text-sm text-gray-600 leading-relaxed">
                  {seoForm.sg_descrip ||
                    "Ajoutez une meta description pour voir l'aperçu..."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Données SEO</CardTitle>
              <CardDescription>
                Meta title, description, H1 et contenu de la page gamme
              </CardDescription>
            </CardHeader>
            <CardContent>
              <fetcher.Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value="updateSeo" />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="sg_title"
                      className="flex items-center gap-2"
                    >
                      Meta Title
                      {seoForm.sg_title.length > 0 &&
                        seoForm.sg_title.length <= 60 && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      {seoForm.sg_title.length > 60 &&
                        seoForm.sg_title.length <= 70 && (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                      {seoForm.sg_title.length > 70 && (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </Label>
                    <Input
                      id="sg_title"
                      name="sg_title"
                      value={seoForm.sg_title}
                      onChange={(e) =>
                        setSeoForm({ ...seoForm, sg_title: e.target.value })
                      }
                      placeholder="Titre SEO"
                      className={
                        seoForm.sg_title.length > 70 ? "border-red-300" : ""
                      }
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              seoForm.sg_title.length <= 60
                                ? "bg-green-500"
                                : seoForm.sg_title.length <= 70
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            }`}
                            style={{
                              width: `${Math.min((seoForm.sg_title.length / 70) * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <span
                          className={`text-xs font-medium ${getCharCountClass(seoForm.sg_title.length, 60, 70)}`}
                        >
                          {getCharCountStatus(seoForm.sg_title.length, 60, 70)}
                        </span>
                      </div>
                      <span
                        className={`text-xs ${getCharCountClass(seoForm.sg_title.length, 60, 70)}`}
                      >
                        {seoForm.sg_title.length}/60 caractères
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sg_h1">H1</Label>
                    <Input
                      id="sg_h1"
                      name="sg_h1"
                      value={seoForm.sg_h1}
                      onChange={(e) =>
                        setSeoForm({ ...seoForm, sg_h1: e.target.value })
                      }
                      placeholder="Titre H1"
                    />
                    <p className="text-xs text-gray-400">
                      Le H1 s'affiche sur la page, pas dans Google
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="sg_descrip"
                    className="flex items-center gap-2"
                  >
                    Meta Description
                    {seoForm.sg_descrip.length > 0 &&
                      seoForm.sg_descrip.length <= 160 && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    {seoForm.sg_descrip.length > 160 &&
                      seoForm.sg_descrip.length <= 180 && (
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                      )}
                    {seoForm.sg_descrip.length > 180 && (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </Label>
                  <Textarea
                    id="sg_descrip"
                    name="sg_descrip"
                    value={seoForm.sg_descrip}
                    onChange={(e) =>
                      setSeoForm({ ...seoForm, sg_descrip: e.target.value })
                    }
                    placeholder="Description SEO"
                    rows={3}
                    className={
                      seoForm.sg_descrip.length > 180 ? "border-red-300" : ""
                    }
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            seoForm.sg_descrip.length <= 160
                              ? "bg-green-500"
                              : seoForm.sg_descrip.length <= 180
                                ? "bg-yellow-500"
                                : "bg-red-500"
                          }`}
                          style={{
                            width: `${Math.min((seoForm.sg_descrip.length / 180) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span
                        className={`text-xs font-medium ${getCharCountClass(seoForm.sg_descrip.length, 160, 180)}`}
                      >
                        {getCharCountStatus(
                          seoForm.sg_descrip.length,
                          160,
                          180,
                        )}
                      </span>
                    </div>
                    <span
                      className={`text-xs ${getCharCountClass(seoForm.sg_descrip.length, 160, 180)}`}
                    >
                      {seoForm.sg_descrip.length}/160 caractères
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sg_keywords">Keywords</Label>
                  <Input
                    id="sg_keywords"
                    name="sg_keywords"
                    value={seoForm.sg_keywords}
                    onChange={(e) =>
                      setSeoForm({ ...seoForm, sg_keywords: e.target.value })
                    }
                    placeholder="Mots-clés séparés par des virgules"
                  />
                  {seoForm.sg_keywords && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {seoForm.sg_keywords.split(",").map((kw, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {kw.trim()}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="sg_content"
                    className="flex items-center gap-2"
                  >
                    Contenu
                    <span className="text-xs text-gray-400 font-normal">
                      ({seoForm.sg_content.length} caractères)
                    </span>
                  </Label>
                  <Textarea
                    id="sg_content"
                    name="sg_content"
                    value={seoForm.sg_content}
                    onChange={(e) =>
                      setSeoForm({ ...seoForm, sg_content: e.target.value })
                    }
                    placeholder="Contenu principal de la page"
                    rows={6}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={fetcher.state === "submitting"}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {fetcher.state === "submitting"
                      ? "Sauvegarde..."
                      : "Sauvegarder"}
                  </Button>
                </div>
              </fetcher.Form>

              {/* Item Switches - Vue groupée par alias avec dépliable */}
              {detail.switchGroups && detail.switchGroups.length > 0 && (
                <div className="mt-8 border-t pt-6">
                  <h3 className="mb-4 text-lg font-medium">
                    Item Switches{" "}
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      #Switch_1#, #Switch_2#, #Switch_3#
                    </code>
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Switches d'items (alias 1-3). Cliquez pour voir les
                    variations.
                  </p>
                  <div className="space-y-3">
                    {[...detail.switchGroups]
                      .sort((a, b) => parseInt(a.alias) - parseInt(b.alias))
                      .map((group) => {
                        const isOpen = expandedSwitches.has(group.alias);
                        return (
                          <div
                            key={group.alias}
                            className="bg-gray-50 rounded-lg border"
                          >
                            {/* Header cliquable */}
                            <button
                              type="button"
                              onClick={() => toggleSwitch(group.alias)}
                              className="w-full p-4 flex items-center justify-between hover:bg-gray-100 transition-colors rounded-t-lg"
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={`w-5 h-5 flex items-center justify-center rounded-full text-xs ${group.usedInTemplate ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}
                                >
                                  {group.usedInTemplate ? "✓" : "!"}
                                </span>
                                <span className="font-medium text-gray-900">
                                  #{group.alias} -{" "}
                                  {group.name || `Alias ${group.alias}`}
                                </span>
                                <code className="text-xs bg-gray-200 px-1 rounded">
                                  {group.placeholder ||
                                    `#Switch_${group.alias}#`}
                                </code>
                                <Badge variant="secondary">
                                  {group.count} variations
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500 max-w-xs truncate">
                                  {group.sample || "(vide)"}
                                </span>
                                {isOpen ? (
                                  <ChevronUp className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-500" />
                                )}
                              </div>
                            </button>

                            {/* Contenu dépliable avec limite de 5 */}
                            {isOpen &&
                              (() => {
                                const switchKey = `item_${group.alias}`;
                                const showAll =
                                  showAllVariations.has(switchKey);
                                const visibleVariations = showAll
                                  ? group.variations
                                  : group.variations.slice(
                                      0,
                                      MAX_VISIBLE_VARIATIONS,
                                    );
                                const hiddenCount =
                                  group.variations.length -
                                  MAX_VISIBLE_VARIATIONS;

                                return (
                                  <div className="border-t p-4 space-y-2">
                                    {visibleVariations.map((variation, idx) => (
                                      <div
                                        key={variation.sis_id}
                                        className="flex items-center gap-2 p-2 bg-white rounded border text-sm"
                                      >
                                        <span className="text-gray-400 w-6">
                                          #{idx + 1}
                                        </span>
                                        <span className="flex-1 text-gray-700">
                                          {variation.content || "(vide)"}
                                        </span>
                                      </div>
                                    ))}
                                    {hiddenCount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          toggleShowAllVariations(switchKey)
                                        }
                                        className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                      >
                                        {showAll
                                          ? "▲ Réduire"
                                          : `▼ Voir les ${hiddenCount} autres variations`}
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Family Switches - Vue groupée par alias avec dépliable */}
              {detail.familySwitchGroups &&
                detail.familySwitchGroups.length > 0 && (
                  <div className="mt-8 border-t pt-6">
                    <h3 className="mb-4 text-lg font-medium">
                      Family Switches{" "}
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        #FamilySwitch_11# ... #FamilySwitch_16#
                      </code>
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Switches de famille (alias 11-16). Cliquez pour voir les
                      variations.
                    </p>
                    <div className="space-y-3">
                      {[...detail.familySwitchGroups]
                        .sort((a, b) => parseInt(a.alias) - parseInt(b.alias))
                        .map((group) => {
                          const isOpen = expandedSwitches.has(
                            `family_${group.alias}`,
                          );
                          return (
                            <div
                              key={`family_${group.alias}`}
                              className="bg-blue-50 rounded-lg border border-blue-200"
                            >
                              {/* Header cliquable */}
                              <button
                                type="button"
                                onClick={() =>
                                  toggleSwitch(`family_${group.alias}`)
                                }
                                className="w-full p-4 flex items-center justify-between hover:bg-blue-100 transition-colors rounded-t-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`w-5 h-5 flex items-center justify-center rounded-full text-xs ${group.usedInTemplate ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}
                                  >
                                    {group.usedInTemplate ? "✓" : "!"}
                                  </span>
                                  <span className="font-medium text-blue-900">
                                    #{group.alias} -{" "}
                                    {group.name || `Alias ${group.alias}`}
                                  </span>
                                  <code className="text-xs bg-blue-200 px-1 rounded">
                                    {group.placeholder ||
                                      `#FamilySwitch_${group.alias}#`}
                                  </code>
                                  <Badge variant="secondary">
                                    {group.count} variations
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-blue-700 max-w-xs truncate">
                                    {group.sample || "(vide)"}
                                  </span>
                                  {isOpen ? (
                                    <ChevronUp className="h-4 w-4 text-blue-500" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-blue-500" />
                                  )}
                                </div>
                              </button>

                              {/* Contenu dépliable avec limite de 5 */}
                              {isOpen &&
                                (() => {
                                  const switchKey = `family_${group.alias}`;
                                  const showAll =
                                    showAllVariations.has(switchKey);
                                  const visibleVariations = showAll
                                    ? group.variations
                                    : group.variations.slice(
                                        0,
                                        MAX_VISIBLE_VARIATIONS,
                                      );
                                  const hiddenCount =
                                    group.variations.length -
                                    MAX_VISIBLE_VARIATIONS;

                                  return (
                                    <div className="border-t border-blue-200 p-4 space-y-2">
                                      {visibleVariations.map(
                                        (variation, idx) => (
                                          <div
                                            key={variation.id}
                                            className="flex items-center gap-2 p-2 bg-white rounded border text-sm group"
                                          >
                                            <span className="text-blue-400 w-6">
                                              #{idx + 1}
                                            </span>
                                            {editingSwitch?.id ===
                                            variation.id ? (
                                              <>
                                                <input
                                                  type="text"
                                                  value={editingSwitch.content}
                                                  onChange={(e) =>
                                                    setEditingSwitch({
                                                      ...editingSwitch,
                                                      content: e.target.value,
                                                    })
                                                  }
                                                  className="flex-1 px-2 py-1 border rounded text-sm"
                                                  autoFocus
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleUpdateSwitch(
                                                      variation.id,
                                                      editingSwitch.content,
                                                    )
                                                  }
                                                  disabled={switchSaving}
                                                  className="text-green-600 hover:text-green-800 px-2"
                                                >
                                                  ✓
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setEditingSwitch(null)
                                                  }
                                                  className="text-gray-500 hover:text-gray-700 px-2"
                                                >
                                                  ✕
                                                </button>
                                              </>
                                            ) : (
                                              <>
                                                <span className="flex-1 text-gray-700">
                                                  {variation.content ||
                                                    "(vide)"}
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setEditingSwitch({
                                                      id: variation.id,
                                                      content:
                                                        variation.content,
                                                    })
                                                  }
                                                  className="opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700 px-2 transition-opacity"
                                                >
                                                  ✏️
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleDeleteSwitch(
                                                      variation.id,
                                                    )
                                                  }
                                                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 px-2 transition-opacity"
                                                >
                                                  🗑️
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        ),
                                      )}
                                      {hiddenCount > 0 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleShowAllVariations(switchKey)
                                          }
                                          className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                                        >
                                          {showAll
                                            ? "▲ Réduire"
                                            : `▼ Voir les ${hiddenCount} autres variations`}
                                        </button>
                                      )}
                                      {/* Bouton Ajouter */}
                                      {newSwitchAlias ===
                                      parseInt(group.alias) ? (
                                        <div className="flex items-center gap-2 mt-3 p-2 bg-green-50 rounded border border-green-200">
                                          <input
                                            type="text"
                                            value={newSwitchContent}
                                            onChange={(e) =>
                                              setNewSwitchContent(
                                                e.target.value,
                                              )
                                            }
                                            placeholder="Nouveau contenu..."
                                            className="flex-1 px-2 py-1 border rounded text-sm"
                                            autoFocus
                                          />
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleCreateSwitch(
                                                parseInt(group.alias),
                                                newSwitchContent,
                                              )
                                            }
                                            disabled={
                                              switchSaving ||
                                              !newSwitchContent.trim()
                                            }
                                            className="text-green-600 hover:text-green-800 px-2 disabled:opacity-50"
                                          >
                                            ✓ Créer
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setNewSwitchAlias(null);
                                              setNewSwitchContent("");
                                            }}
                                            className="text-gray-500 hover:text-gray-700 px-2"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setNewSwitchAlias(
                                              parseInt(group.alias),
                                            )
                                          }
                                          className="w-full py-2 text-sm text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors border border-dashed border-green-300 mt-2"
                                        >
                                          ➕ Ajouter une variation
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB INFORMATIONS */}
        <TabsContent value="informations">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  Informations Techniques
                </CardTitle>
                <CardDescription>
                  Gérez les informations techniques affichées sur la page gamme
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  const content = prompt("Nouvelle information technique:");
                  if (content && content.trim()) {
                    fetcher.submit(
                      { intent: "addInformation", content: content.trim() },
                      { method: "post" },
                    );
                  }
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Ajouter
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-500 mb-4">
                  Ces informations apparaissent dans la section "Informations"
                  de la page gamme publique. Elles sont automatiquement
                  enrichies avec des liens vers les gammes connexes.
                </p>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <p className="text-center text-gray-500 py-4">
                    Chargement des informations via l'API...
                    <br />
                    <span className="text-xs">
                      Endpoint: GET /api/admin/gammes-seo/{detail.gamme.pg_id}
                      /informations
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB ÉQUIPEMENTIERS */}
        <TabsContent value="equipementiers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-orange-600" />
                  Équipementiers
                </CardTitle>
                <CardDescription>
                  Gérez les descriptions SEO par marque équipementier
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  alert(
                    "Fonctionnalité à implémenter: sélection de marque via dropdown",
                  );
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Ajouter marque
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-500 mb-4">
                  Ces descriptions personnalisées s'affichent pour chaque
                  équipementier sur la page gamme. Exemple: "Les plaquettes de
                  frein BOSCH pour votre véhicule..."
                </p>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <p className="text-center text-gray-500 py-4">
                    Chargement des équipementiers via l'API...
                    <br />
                    <span className="text-xs">
                      Endpoint: GET /api/admin/gammes-seo/{detail.gamme.pg_id}
                      /equipementiers
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
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

        {/* TAB VEHICLES */}
        <TabsContent value="vehicles">
          <div className="space-y-6">
            {/* Barre de recherche */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher un véhicule..."
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <span className="text-sm text-gray-500">
                  Total:{" "}
                  {detail.vehicles.level1.length +
                    detail.vehicles.level2.length +
                    detail.vehicles.level5.length}{" "}
                  véhicules
                </span>
              </div>
            </div>

            {/* Level 1 - Vedettes */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Niveau 1 - Vedettes</CardTitle>
                  <CardDescription>
                    Véhicules affichés en grille sur la page gamme (
                    {filterAndSortVehicles(detail.vehicles.level1).length}{" "}
                    véhicules)
                  </CardDescription>
                </div>
                {detail.vehicles.level1.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportVehiclesToCSV(
                        filterAndSortVehicles(detail.vehicles.level1),
                        `vehicules-niveau1-${detail.gamme.pg_alias}.csv`,
                      )
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {filterAndSortVehicles(detail.vehicles.level1).length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    {vehicleSearch
                      ? "Aucun véhicule trouvé"
                      : "Aucun véhicule vedette"}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {filterAndSortVehicles(detail.vehicles.level1).map((v) => (
                      <Badge
                        key={v.cgc_id}
                        variant="secondary"
                        className={`text-sm ${getFuelBadgeClass(v.fuel)}`}
                      >
                        {v.marque_name} {v.modele_name} {v.type_name}
                        {v.power_ps && ` ${v.power_ps}ch`}
                        {v.year_from &&
                          v.year_to &&
                          ` (${v.year_from}-${v.year_to})`}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Level 2 - Secondaires */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Niveau 2 - Secondaires</CardTitle>
                  <CardDescription>
                    Véhicules secondaires associés à cette gamme (
                    {filterAndSortVehicles(detail.vehicles.level2).length}{" "}
                    véhicules)
                  </CardDescription>
                </div>
                {detail.vehicles.level2.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportVehiclesToCSV(
                        filterAndSortVehicles(detail.vehicles.level2),
                        `vehicules-niveau2-${detail.gamme.pg_alias}.csv`,
                      )
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {filterAndSortVehicles(detail.vehicles.level2).length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    {vehicleSearch
                      ? "Aucun véhicule trouvé"
                      : "Aucun véhicule secondaire"}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {filterAndSortVehicles(detail.vehicles.level2).map((v) => (
                      <Badge
                        key={v.cgc_id}
                        variant="outline"
                        className={`text-sm ${getFuelBadgeClass(v.fuel)}`}
                      >
                        {v.marque_name} {v.modele_name} {v.type_name}
                        {v.power_ps && ` ${v.power_ps}ch`}
                        {v.year_from &&
                          v.year_to &&
                          ` (${v.year_from}-${v.year_to})`}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Level 5 - Blog */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Niveau 5 - Blog</CardTitle>
                  <CardDescription>
                    Véhicules cités dans les articles blog (
                    {filterAndSortVehicles(detail.vehicles.level5).length}{" "}
                    véhicules)
                  </CardDescription>
                </div>
                {detail.vehicles.level5.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportVehiclesToCSV(
                        filterAndSortVehicles(detail.vehicles.level5),
                        `vehicules-niveau5-${detail.gamme.pg_alias}.csv`,
                      )
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {filterAndSortVehicles(detail.vehicles.level5).length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    {vehicleSearch
                      ? "Aucun véhicule trouvé"
                      : "Aucun véhicule blog"}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {filterAndSortVehicles(detail.vehicles.level5).map((v) => (
                      <Badge
                        key={v.cgc_id}
                        variant="outline"
                        className={`text-sm ${getFuelBadgeClass(v.fuel)}`}
                      >
                        {v.marque_name} {v.modele_name} {v.type_name}
                        {v.power_ps && ` ${v.power_ps}ch`}
                        {v.year_from &&
                          v.year_to &&
                          ` (${v.year_from}-${v.year_to})`}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB V-LEVEL - Version complète avec tous les niveaux */}
        <TabsContent value="vlevel">
          <div className="space-y-4">
            {/* Warning si données périmées */}
            {(() => {
              const freshness = getFreshnessStatus(
                detail.stats.vLevel_last_updated,
              );
              if (freshness.status === "stale" || freshness.status === "old") {
                return (
                  <div
                    className={`p-3 rounded-lg flex items-center gap-3 ${
                      freshness.status === "old"
                        ? "bg-red-50 border border-red-200 text-red-800"
                        : "bg-yellow-50 border border-yellow-200 text-yellow-800"
                    }`}
                  >
                    <span className="text-xl">{freshness.icon}</span>
                    <div className="flex-1">
                      <p className="font-medium">
                        {freshness.status === "old"
                          ? "Données V-Level très anciennes"
                          : "Données V-Level à mettre à jour"}
                      </p>
                      <p className="text-sm opacity-80">
                        Dernière mise à jour:{" "}
                        {detail.stats.vLevel_last_updated
                          ? new Date(
                              detail.stats.vLevel_last_updated,
                            ).toLocaleDateString("fr-FR")
                          : "Jamais"}
                        {freshness.status === "old"
                          ? " (> 30 jours). Les classements peuvent être obsolètes."
                          : " (> 7 jours). Un recalcul est recommandé."}
                      </p>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Warning violation V2 (doublons) */}
            {(v2Violations.diesel.length > 0 ||
              v2Violations.essence.length > 0) && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Violation règle V2</p>
                  <p className="text-sm">
                    V2 doit être UNIQUE par gamme+énergie. Doublons détectés:
                    {v2Violations.diesel.length > 0 && (
                      <span className="ml-1">
                        <span className="font-medium">Diesel:</span>{" "}
                        {v2Violations.diesel.join(", ")}
                      </span>
                    )}
                    {v2Violations.essence.length > 0 && (
                      <span className="ml-1">
                        <span className="font-medium">Essence:</span>{" "}
                        {v2Violations.essence.join(", ")}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Barre d'actions: Filtres + Boutons */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              {/* Filtres Diesel/Essence */}
              <div className="flex gap-2">
                <Button
                  variant={energyFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEnergyFilter("all")}
                >
                  Tous
                </Button>
                <Button
                  variant={energyFilter === "diesel" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEnergyFilter("diesel")}
                  className={
                    energyFilter === "diesel"
                      ? ""
                      : "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                  }
                >
                  Diesel
                </Button>
                <Button
                  variant={energyFilter === "essence" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEnergyFilter("essence")}
                  className={
                    energyFilter === "essence"
                      ? ""
                      : "bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                  }
                >
                  Essence
                </Button>
              </div>

              {/* Boutons d'action */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRecalculateVLevel}
                  disabled={isRecalculating}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${isRecalculating ? "animate-spin" : ""}`}
                  />
                  {isRecalculating ? "Recalcul..." : "Recalculer"}
                </Button>
                <Button variant="outline" size="sm" onClick={exportVLevelToCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleValidateV1Rules}
                  disabled={isValidating}
                >
                  <CheckCircle2
                    className={`h-4 w-4 mr-2 ${isValidating ? "animate-pulse" : ""}`}
                  />
                  {isValidating ? "Validation..." : "Valider V1"}
                </Button>
              </div>
            </div>

            {/* Résultats de validation V1 */}
            {validationResult && (
              <Card
                className={
                  validationResult.valid
                    ? "border-green-200 bg-green-50"
                    : "border-red-200 bg-red-50"
                }
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {validationResult.valid ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="text-green-800">Validation V1 OK</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <span className="text-red-800">
                          Violations V1 detectees
                        </span>
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-2">
                    <p>
                      <span className="font-medium">Gammes G1:</span>{" "}
                      {validationResult.g1_count} |
                      <span className="font-medium ml-2">V1 valides:</span>{" "}
                      {validationResult.summary.valid_v1}/
                      {validationResult.summary.total_v1}
                    </p>
                    {validationResult.violations.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium text-red-800 mb-1">
                          Violations (V1 avec {"<"}30% G1):
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                          {validationResult.violations.map((v, idx) => (
                            <li key={idx} className="text-red-700">
                              {v.model_name} ({v.energy}) - {v.percentage}% (
                              {v.v2_count}/{v.g1_total} G1)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* V1 - Champions Modèle */}
            <VLevelCard
              title="V1 - Champions Modele"
              description="Variants GLOBAUX dominants (>=30% G1 gammes)"
              items={filterByEnergy(detail.vLevel.v1)}
              colorClass="border-amber-200 bg-amber-50"
              icon="🏆"
              defaultExpanded={true}
            />

            {/* V2 - Champions Gamme */}
            <VLevelCard
              title="V2 - Champions Gamme"
              description="Champions LOCAUX #1 par gamme+energie (UNIQUE)"
              items={filterByEnergy(detail.vLevel.v2)}
              colorClass="border-green-200 bg-green-50"
              icon="🥇"
              defaultExpanded={true}
            />

            {/* V3 - Challengers */}
            <VLevelCard
              title="V3 - Challengers"
              description="Positions #2, #3, #4..."
              items={filterByEnergy(detail.vLevel.v3)}
              colorClass="border-blue-200 bg-blue-50"
              icon="🥈"
              defaultExpanded={true}
            />

            {/* V4 - Faibles */}
            <VLevelCard
              title="V4 - Faibles"
              description="Variants non recherches"
              items={filterByEnergy(detail.vLevel.v4)}
              colorClass="border-gray-200 bg-gray-50"
              icon="📉"
              defaultExpanded={false}
            />

            {/* V5 - Bloc B */}
            <VLevelCard
              title="V5 - Bloc B"
              description="Variants catalogue hors V1-V4"
              items={filterByEnergy(detail.vLevel.v5)}
              colorClass="border-orange-200 bg-orange-50"
              icon="📦"
              defaultExpanded={false}
            />

            {/* Message si aucune donnée */}
            {detail.stats.vLevel_total_count === 0 && (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-gray-500">
                    Aucune donnee V-Level pour cette gamme
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
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
            {/* Header avec status */}
            <Card
              className={
                detail.purchaseGuide ? "border-green-200" : "border-orange-200"
              }
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${detail.purchaseGuide ? "bg-green-100" : "bg-orange-100"}`}
                    >
                      <BookOpen
                        className={`h-5 w-5 ${detail.purchaseGuide ? "text-green-600" : "text-orange-600"}`}
                      />
                    </div>
                    <div>
                      <CardTitle>
                        Guide d'achat - {detail.gamme.pg_name}
                      </CardTitle>
                      <CardDescription>
                        {detail.purchaseGuide
                          ? `Derniere mise a jour: ${new Date(detail.purchaseGuide.updatedAt || "").toLocaleDateString("fr-FR")}`
                          : "Aucun guide configure - Remplissez les champs ci-dessous"}
                      </CardDescription>
                    </div>
                  </div>
                  <Button onClick={savePurchaseGuide} disabled={guideSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    {guideSaving ? "Sauvegarde..." : "Sauvegarder le guide"}
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* ETAPE 1: Compatibilite */}
            <Card>
              <CardHeader className="bg-blue-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                    1
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      Compatibilite et identification
                    </CardTitle>
                    <CardDescription>
                      Comment identifier la bonne piece
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="step1_title">Titre de l'etape</Label>
                    <Input
                      id="step1_title"
                      value={guideForm.step1.title}
                      onChange={(e) =>
                        updateGuideForm("step1.title", e.target.value)
                      }
                      placeholder={`Identifiez votre ${detail.gamme.pg_name.toLowerCase()}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="step1_highlight">
                      Point cle (mise en avant)
                    </Label>
                    <Input
                      id="step1_highlight"
                      value={guideForm.step1.highlight}
                      onChange={(e) =>
                        updateGuideForm("step1.highlight", e.target.value)
                      }
                      placeholder="Ex: Verifiez la reference OEM sur votre piece actuelle"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="step1_content">Contenu explicatif</Label>
                  <Textarea
                    id="step1_content"
                    value={guideForm.step1.content}
                    onChange={(e) =>
                      updateGuideForm("step1.content", e.target.value)
                    }
                    placeholder="Expliquez comment identifier la bonne piece pour son vehicule..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Points cles (un par ligne)</Label>
                  <Textarea
                    value={(guideForm.step1.bullets || []).join("\n")}
                    onChange={(e) =>
                      updateGuideForm(
                        "step1.bullets",
                        e.target.value.split("\n").filter((b) => b.trim()),
                      )
                    }
                    placeholder="Selectionnez votre vehicule dans notre selecteur&#10;Verifiez la reference OEM&#10;Comparez avec la piece d'origine"
                    rows={4}
                  />
                  <p className="text-xs text-gray-500">
                    Chaque ligne devient un point de la liste
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ETAPE 2: Gammes de prix */}
            <Card>
              <CardHeader className="bg-green-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                    2
                  </div>
                  <div>
                    <CardTitle className="text-lg">Gammes de prix</CardTitle>
                    <CardDescription>
                      Les 3 niveaux de qualite proposes
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-3 gap-6">
                  {/* Economique */}
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🥉</span>
                      <h4 className="font-semibold">Economique</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Sous-titre</Label>
                        <Input
                          value={guideForm.step2.economique.subtitle}
                          onChange={(e) =>
                            updateGuideForm(
                              "step2.economique.subtitle",
                              e.target.value,
                            )
                          }
                          placeholder="Usage standard"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          value={guideForm.step2.economique.description}
                          onChange={(e) =>
                            updateGuideForm(
                              "step2.economique.description",
                              e.target.value,
                            )
                          }
                          placeholder="Description de cette gamme..."
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Specs (une par ligne)</Label>
                        <Textarea
                          value={(guideForm.step2.economique.specs || []).join(
                            "\n",
                          )}
                          onChange={(e) =>
                            updateGuideForm(
                              "step2.economique.specs",
                              e.target.value
                                .split("\n")
                                .filter((s) => s.trim()),
                            )
                          }
                          placeholder="Type : Aftermarket&#10;Garantie : 1 an"
                          rows={3}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Prix</Label>
                        <Input
                          value={guideForm.step2.economique.priceRange}
                          onChange={(e) =>
                            updateGuideForm(
                              "step2.economique.priceRange",
                              e.target.value,
                            )
                          }
                          placeholder="A partir de 29€"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Qualite+ */}
                  <div className="space-y-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🥈</span>
                        <h4 className="font-semibold">Qualite+</h4>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-blue-100 text-blue-700"
                      >
                        {guideForm.step2.qualitePlus.badge || "Le plus choisi"}
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Sous-titre</Label>
                        <Input
                          value={guideForm.step2.qualitePlus.subtitle}
                          onChange={(e) =>
                            updateGuideForm(
                              "step2.qualitePlus.subtitle",
                              e.target.value,
                            )
                          }
                          placeholder="Equipement d'origine"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          value={guideForm.step2.qualitePlus.description}
                          onChange={(e) =>
                            updateGuideForm(
                              "step2.qualitePlus.description",
                              e.target.value,
                            )
                          }
                          placeholder="Description de cette gamme..."
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Specs (une par ligne)</Label>
                        <Textarea
                          value={(guideForm.step2.qualitePlus.specs || []).join(
                            "\n",
                          )}
                          onChange={(e) =>
                            updateGuideForm(
                              "step2.qualitePlus.specs",
                              e.target.value
                                .split("\n")
                                .filter((s) => s.trim()),
                            )
                          }
                          placeholder="Type : Qualite OE&#10;Garantie : 2 ans"
                          rows={3}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Prix</Label>
                        <Input
                          value={guideForm.step2.qualitePlus.priceRange}
                          onChange={(e) =>
                            updateGuideForm(
                              "step2.qualitePlus.priceRange",
                              e.target.value,
                            )
                          }
                          placeholder="A partir de 59€"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Premium */}
                  <div className="space-y-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🥇</span>
                      <h4 className="font-semibold">Premium</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Sous-titre</Label>
                        <Input
                          value={guideForm.step2.premium.subtitle}
                          onChange={(e) =>
                            updateGuideForm(
                              "step2.premium.subtitle",
                              e.target.value,
                            )
                          }
                          placeholder="Haute performance"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          value={guideForm.step2.premium.description}
                          onChange={(e) =>
                            updateGuideForm(
                              "step2.premium.description",
                              e.target.value,
                            )
                          }
                          placeholder="Description de cette gamme..."
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Specs (une par ligne)</Label>
                        <Textarea
                          value={(guideForm.step2.premium.specs || []).join(
                            "\n",
                          )}
                          onChange={(e) =>
                            updateGuideForm(
                              "step2.premium.specs",
                              e.target.value
                                .split("\n")
                                .filter((s) => s.trim()),
                            )
                          }
                          placeholder="Type : Premium OEM&#10;Garantie : 3 ans"
                          rows={3}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Prix</Label>
                        <Input
                          value={guideForm.step2.premium.priceRange}
                          onChange={(e) =>
                            updateGuideForm(
                              "step2.premium.priceRange",
                              e.target.value,
                            )
                          }
                          placeholder="A partir de 99€"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ETAPE 3: Securite et conseils */}
            <Card>
              <CardHeader className="bg-red-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">
                    3
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      Securite et conseils
                    </CardTitle>
                    <CardDescription>
                      Alertes et precautions pour l'installation
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="step3_title">Titre de l'etape</Label>
                    <Input
                      id="step3_title"
                      value={guideForm.step3.title}
                      onChange={(e) =>
                        updateGuideForm("step3.title", e.target.value)
                      }
                      placeholder="Securite et conseils"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="step3_content">Contenu</Label>
                  <Textarea
                    id="step3_content"
                    value={guideForm.step3.content}
                    onChange={(e) =>
                      updateGuideForm("step3.content", e.target.value)
                    }
                    placeholder="Conseils de securite et d'installation..."
                    rows={3}
                  />
                </div>

                {/* Alertes */}
                <div className="space-y-3">
                  <Label>Alertes de securite</Label>
                  <div className="space-y-2">
                    {(guideForm.step3.alerts || []).map((alert, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 p-2 rounded-lg border ${
                          alert.type === "danger"
                            ? "bg-red-50 border-red-200"
                            : alert.type === "warning"
                              ? "bg-yellow-50 border-yellow-200"
                              : "bg-blue-50 border-blue-200"
                        }`}
                      >
                        <select
                          value={alert.type}
                          onChange={(e) => {
                            const newAlerts = [
                              ...(guideForm.step3.alerts || []),
                            ];
                            newAlerts[idx] = {
                              ...newAlerts[idx],
                              type: e.target.value as
                                | "danger"
                                | "warning"
                                | "info",
                            };
                            updateGuideForm("step3.alerts", newAlerts);
                          }}
                          className="h-8 text-sm rounded border px-2"
                        >
                          <option value="danger">Danger</option>
                          <option value="warning">Attention</option>
                          <option value="info">Info</option>
                        </select>
                        <Input
                          value={alert.text}
                          onChange={(e) => {
                            const newAlerts = [
                              ...(guideForm.step3.alerts || []),
                            ];
                            newAlerts[idx] = {
                              ...newAlerts[idx],
                              text: e.target.value,
                            };
                            updateGuideForm("step3.alerts", newAlerts);
                          }}
                          className="flex-1 h-8 text-sm"
                          placeholder="Texte de l'alerte..."
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newAlerts = (
                              guideForm.step3.alerts || []
                            ).filter((_, i) => i !== idx);
                            updateGuideForm("step3.alerts", newAlerts);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newAlerts = [
                          ...(guideForm.step3.alerts || []),
                          { type: "info" as const, text: "" },
                        ];
                        updateGuideForm("step3.alerts", newAlerts);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter une alerte
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bouton de sauvegarde en bas */}
            <div className="flex justify-end">
              <Button
                onClick={savePurchaseGuide}
                disabled={guideSaving}
                size="lg"
              >
                <Save className="mr-2 h-5 w-5" />
                {guideSaving
                  ? "Sauvegarde en cours..."
                  : "Sauvegarder le guide d'achat"}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Article Modal */}
      <Dialog
        open={editingArticle !== null}
        onOpenChange={(open) => !open && setEditingArticle(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifier l'article</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="article-title">Titre</Label>
              <Input
                id="article-title"
                value={editForm.title}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="article-preview">Aperçu</Label>
              <Textarea
                id="article-preview"
                value={editForm.preview}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, preview: e.target.value }))
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingArticle(null)}
              disabled={isEditSaving}
            >
              Annuler
            </Button>
            <Button onClick={saveArticle} disabled={isEditSaving}>
              {isEditSaving ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
