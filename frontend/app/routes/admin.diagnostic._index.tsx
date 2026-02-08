import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import {
  useLoaderData,
  useFetcher,
  useSearchParams,
  Link,
} from "@remix-run/react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  Eye,
  Activity,
  Database,
  Link as LinkIcon,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { AdminBreadcrumb } from "~/components/admin/AdminBreadcrumb";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { logger } from "~/utils/logger";

// Types
interface Observable {
  node_id: string;
  node_label: string;
  node_alias?: string;
  node_category?: string;
  node_type: string;
  input_type?: string;
  perception_channel?: string;
  intensity?: number;
  risk_level?: string;
  dtc_code?: string;
  ctx_phase?: string;
  ctx_temp?: string;
  ctx_speed?: string;
  is_active: boolean;
  status?: string;
  confidence?: number;
  created_at: string;
  updated_at: string;
}

interface KgStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
  avgConfidence: number;
}

// Meta
export const meta = () => [
  { title: "Gestion des Symptomes - Admin | Automecanik" },
  {
    name: "description",
    content:
      "Administration des symptomes du Knowledge Graph pour le diagnostic auto",
  },
];

// Loader
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const search = url.searchParams.get("search") || "";
  const inputType = url.searchParams.get("inputType") || "";
  const riskLevel = url.searchParams.get("riskLevel") || "";
  const limit = 25;
  const offset = (page - 1) * limit;

  try {
    // Fetch observables
    const observablesRes = await fetch(
      `http://127.0.0.1:3000/api/knowledge-graph/nodes?type=Observable&limit=${limit}&offset=${offset}`,
    );
    const observables: Observable[] = observablesRes.ok
      ? await observablesRes.json()
      : [];

    // Fetch stats
    const statsRes = await fetch(
      "http://127.0.0.1:3000/api/knowledge-graph/stats",
    );
    const stats: KgStats = statsRes.ok
      ? await statsRes.json()
      : {
          totalNodes: 0,
          totalEdges: 0,
          nodesByType: {},
          avgConfidence: 0,
        };

    // Filter observables client-side (backend doesn't support all filters)
    let filtered = observables;
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.node_label.toLowerCase().includes(searchLower) ||
          o.node_alias?.toLowerCase().includes(searchLower) ||
          o.dtc_code?.toLowerCase().includes(searchLower),
      );
    }
    if (inputType) {
      filtered = filtered.filter((o) => o.input_type === inputType);
    }
    if (riskLevel) {
      filtered = filtered.filter((o) => o.risk_level === riskLevel);
    }

    const totalObservables =
      stats.nodesByType?.Observable || observables.length;
    const totalPages = Math.ceil(totalObservables / limit);

    return json({
      observables: filtered,
      stats,
      pagination: {
        page,
        limit,
        total: totalObservables,
        totalPages,
      },
      filters: { search, inputType, riskLevel },
      error: undefined as string | undefined,
    });
  } catch (error) {
    logger.error("Loader error:", error);
    return json({
      observables: [],
      stats: {
        totalNodes: 0,
        totalEdges: 0,
        nodesByType: {},
        avgConfidence: 0,
      },
      pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
      filters: { search: "", inputType: "", riskLevel: "" },
      error: "Erreur de chargement",
    });
  }
}

// Action
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const _action = formData.get("_action");

  try {
    switch (_action) {
      case "create": {
        const newNode = {
          node_type: "Observable",
          node_label: formData.get("node_label"),
          node_alias: formData.get("node_alias") || undefined,
          node_category: formData.get("node_category") || undefined,
          input_type: formData.get("input_type") || "symptom",
          perception_channel: formData.get("perception_channel") || "visual",
          risk_level: formData.get("risk_level") || "confort",
          intensity: parseInt(formData.get("intensity") as string) || 3,
          dtc_code: formData.get("dtc_code") || undefined,
          ctx_phase: formData.get("ctx_phase") || "any",
          ctx_temp: formData.get("ctx_temp") || "any",
          ctx_speed: formData.get("ctx_speed") || "any",
          is_active: true,
          status: "draft",
          confidence: 0.8,
          node_data: {},
          sources: ["admin"],
          validation_status: "pending",
        };

        const res = await fetch(
          "http://127.0.0.1:3000/api/knowledge-graph/nodes",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newNode),
          },
        );

        if (!res.ok) {
          const error = await res.text();
          return json({ success: false, error: `Erreur creation: ${error}` });
        }

        return json({ success: true, message: "Symptome cree avec succes" });
      }

      case "delete": {
        const nodeId = formData.get("nodeId") as string;
        const res = await fetch(
          `http://127.0.0.1:3000/api/knowledge-graph/nodes/${nodeId}`,
          {
            method: "DELETE",
          },
        );

        if (!res.ok) {
          return json({ success: false, error: "Erreur suppression" });
        }

        return json({ success: true, message: "Symptome supprime" });
      }

      case "toggle": {
        const nodeId = formData.get("nodeId") as string;
        const isActive = formData.get("isActive") === "true";

        const res = await fetch(
          `http://127.0.0.1:3000/api/knowledge-graph/nodes/${nodeId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_active: !isActive }),
          },
        );

        if (!res.ok) {
          return json({ success: false, error: "Erreur modification" });
        }

        return json({
          success: true,
          message: isActive ? "Symptome desactive" : "Symptome active",
        });
      }

      default:
        return json({ success: false, error: "Action inconnue" });
    }
  } catch (error) {
    logger.error("Action error:", error);
    return json({ success: false, error: "Erreur serveur" });
  }
}

// Component
export default function AdminDiagnosticIndex() {
  const { observables, stats, pagination, filters, error } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);

  // Form state for creation
  const [formData, setFormData] = useState({
    node_label: "",
    node_alias: "",
    node_category: "",
    input_type: "symptom",
    perception_channel: "visual",
    risk_level: "confort",
    intensity: "3",
    dtc_code: "",
    ctx_phase: "any",
    ctx_temp: "any",
    ctx_speed: "any",
  });

  const isSubmitting = fetcher.state === "submitting";

  // Handle filter change
  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1"); // Reset to page 1 on filter change
    setSearchParams(params);
  };

  // Handle pagination
  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    setSearchParams(params);
  };

  // Get badge color based on risk level
  const getRiskBadgeColor = (risk?: string) => {
    switch (risk) {
      case "critique":
        return "bg-red-500 text-white";
      case "securite":
        return "bg-orange-500 text-white";
      case "confort":
        return "bg-green-500 text-white";
      default:
        return "bg-gray-400 text-white";
    }
  };

  // Get badge color based on input type
  const getInputTypeBadgeColor = (type?: string) => {
    switch (type) {
      case "dtc":
        return "bg-purple-500 text-white";
      case "sign":
        return "bg-blue-500 text-white";
      case "symptom":
        return "bg-amber-500 text-white";
      default:
        return "bg-gray-400 text-white";
    }
  };

  // Get perception channel icon/label
  const getPerceptionLabel = (channel?: string) => {
    const labels: Record<string, string> = {
      visual: "Visuel",
      auditory: "Auditif",
      olfactory: "Olfactif",
      tactile: "Tactile",
      electronic: "Electronique",
      performance: "Performance",
    };
    return labels[channel || ""] || channel || "-";
  };

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <AdminBreadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Diagnostic KG", href: "/admin/diagnostic" },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Gestion des Symptomes
          </h1>
          <p className="text-gray-500">
            Knowledge Graph - Observables pour le diagnostic auto
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nouveau symptome
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Creer un nouveau symptome</DialogTitle>
              <DialogDescription>
                Ajoutez un observable au Knowledge Graph pour le diagnostic
              </DialogDescription>
            </DialogHeader>
            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="_action" value="create" />

              {/* Base info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="node_label">Label (requis)</Label>
                  <Input
                    id="node_label"
                    name="node_label"
                    placeholder="Ex: Fumee noire"
                    value={formData.node_label}
                    onChange={(e) =>
                      setFormData({ ...formData, node_label: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="node_alias">Alias URL</Label>
                  <Input
                    id="node_alias"
                    name="node_alias"
                    placeholder="Ex: fumee-noire"
                    value={formData.node_alias}
                    onChange={(e) =>
                      setFormData({ ...formData, node_alias: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="node_category">Categorie</Label>
                <Select
                  name="node_category"
                  value={formData.node_category}
                  onValueChange={(v) =>
                    setFormData({ ...formData, node_category: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une categorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Moteur">Moteur</SelectItem>
                    <SelectItem value="Freinage">Freinage</SelectItem>
                    <SelectItem value="Direction">Direction</SelectItem>
                    <SelectItem value="Suspension">Suspension</SelectItem>
                    <SelectItem value="Transmission">Transmission</SelectItem>
                    <SelectItem value="Refroidissement">
                      Refroidissement
                    </SelectItem>
                    <SelectItem value="Echappement">Echappement</SelectItem>
                    <SelectItem value="Electrique">Electrique</SelectItem>
                    <SelectItem value="Climatisation">Climatisation</SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Observable Pro */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="input_type">Type d'input</Label>
                  <Select
                    name="input_type"
                    value={formData.input_type}
                    onValueChange={(v) =>
                      setFormData({ ...formData, input_type: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="symptom">
                        Symptome (utilisateur)
                      </SelectItem>
                      <SelectItem value="sign">Signe (technicien)</SelectItem>
                      <SelectItem value="dtc">DTC (electronique)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="perception_channel">Canal perception</Label>
                  <Select
                    name="perception_channel"
                    value={formData.perception_channel}
                    onValueChange={(v) =>
                      setFormData({ ...formData, perception_channel: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="visual">Visuel</SelectItem>
                      <SelectItem value="auditory">Auditif</SelectItem>
                      <SelectItem value="olfactory">Olfactif</SelectItem>
                      <SelectItem value="tactile">Tactile</SelectItem>
                      <SelectItem value="electronic">Electronique</SelectItem>
                      <SelectItem value="performance">Performance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="risk_level">Niveau de risque</Label>
                  <Select
                    name="risk_level"
                    value={formData.risk_level}
                    onValueChange={(v) =>
                      setFormData({ ...formData, risk_level: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confort">Confort</SelectItem>
                      <SelectItem value="securite">Securite</SelectItem>
                      <SelectItem value="critique">Critique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* DTC Code (if input_type = dtc) */}
              {formData.input_type === "dtc" && (
                <div className="space-y-2">
                  <Label htmlFor="dtc_code">Code DTC</Label>
                  <Input
                    id="dtc_code"
                    name="dtc_code"
                    placeholder="Ex: P0300"
                    value={formData.dtc_code}
                    onChange={(e) =>
                      setFormData({ ...formData, dtc_code: e.target.value })
                    }
                  />
                </div>
              )}

              {/* Context */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ctx_phase">Phase conduite</Label>
                  <Select
                    name="ctx_phase"
                    value={formData.ctx_phase}
                    onValueChange={(v) =>
                      setFormData({ ...formData, ctx_phase: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Toutes</SelectItem>
                      <SelectItem value="demarrage">Demarrage</SelectItem>
                      <SelectItem value="ralenti">Ralenti</SelectItem>
                      <SelectItem value="acceleration">Acceleration</SelectItem>
                      <SelectItem value="freinage">Freinage</SelectItem>
                      <SelectItem value="virage">Virage</SelectItem>
                      <SelectItem value="vitesse_stable">
                        Vitesse stable
                      </SelectItem>
                      <SelectItem value="arret">Arret</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ctx_temp">Temperature</Label>
                  <Select
                    name="ctx_temp"
                    value={formData.ctx_temp}
                    onValueChange={(v) =>
                      setFormData({ ...formData, ctx_temp: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Toutes</SelectItem>
                      <SelectItem value="froid">Moteur froid</SelectItem>
                      <SelectItem value="chaud">Moteur chaud</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ctx_speed">Vitesse</Label>
                  <Select
                    name="ctx_speed"
                    value={formData.ctx_speed}
                    onValueChange={(v) =>
                      setFormData({ ...formData, ctx_speed: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Toutes</SelectItem>
                      <SelectItem value="0_30">0-30 km/h</SelectItem>
                      <SelectItem value="30_70">30-70 km/h</SelectItem>
                      <SelectItem value="70_110">70-110 km/h</SelectItem>
                      <SelectItem value="110_plus">110+ km/h</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <input
                type="hidden"
                name="intensity"
                value={formData.intensity}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.node_label}
                >
                  {isSubmitting ? "Creation..." : "Creer le symptome"}
                </Button>
              </DialogFooter>
            </fetcher.Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">
                  {(stats.nodesByType as Record<string, number>)?.[
                    "Observable"
                  ] || 0}
                </p>
                <p className="text-sm text-gray-500">Observables</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.totalNodes || 0}</p>
                <p className="text-sm text-gray-500">Nodes total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <LinkIcon className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.totalEdges || 0}</p>
                <p className="text-sm text-gray-500">Edges</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">
                  {Math.round((stats.avgConfidence || 0) * 100)}%
                </p>
                <p className="text-sm text-gray-500">Confiance moy.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="mb-2 block">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Label, alias, code DTC..."
                  className="pl-10"
                  defaultValue={filters.search}
                  onChange={(e) => {
                    const timer = setTimeout(
                      () => handleFilterChange("search", e.target.value),
                      300,
                    );
                    return () => clearTimeout(timer);
                  }}
                />
              </div>
            </div>
            <div className="w-[150px]">
              <Label className="mb-2 block">Type input</Label>
              <Select
                value={filters.inputType}
                onValueChange={(v) => handleFilterChange("inputType", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous</SelectItem>
                  <SelectItem value="symptom">Symptome</SelectItem>
                  <SelectItem value="sign">Signe</SelectItem>
                  <SelectItem value="dtc">DTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <Label className="mb-2 block">Risque</Label>
              <Select
                value={filters.riskLevel}
                onValueChange={(v) => handleFilterChange("riskLevel", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous</SelectItem>
                  <SelectItem value="confort">Confort</SelectItem>
                  <SelectItem value="securite">Securite</SelectItem>
                  <SelectItem value="critique">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => setSearchParams(new URLSearchParams())}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Risque</TableHead>
                <TableHead>Contexte</TableHead>
                <TableHead>Actif</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {observables.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-gray-500"
                  >
                    Aucun observable trouve
                  </TableCell>
                </TableRow>
              ) : (
                observables.map((obs) => (
                  <TableRow key={obs.node_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{obs.node_label}</p>
                        {obs.node_alias && (
                          <p className="text-xs text-gray-400">
                            {obs.node_alias}
                          </p>
                        )}
                        {obs.dtc_code && (
                          <Badge variant="outline" className="mt-1">
                            {obs.dtc_code}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getInputTypeBadgeColor(obs.input_type)}>
                        {obs.input_type || "symptom"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getPerceptionLabel(obs.perception_channel)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getRiskBadgeColor(obs.risk_level)}>
                        {obs.risk_level || "confort"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-gray-500">
                        {obs.ctx_phase && obs.ctx_phase !== "any" && (
                          <div>Phase: {obs.ctx_phase}</div>
                        )}
                        {obs.ctx_temp && obs.ctx_temp !== "any" && (
                          <div>Temp: {obs.ctx_temp}</div>
                        )}
                        {obs.ctx_speed && obs.ctx_speed !== "any" && (
                          <div>Vit: {obs.ctx_speed}</div>
                        )}
                        {(!obs.ctx_phase || obs.ctx_phase === "any") &&
                          (!obs.ctx_temp || obs.ctx_temp === "any") &&
                          (!obs.ctx_speed || obs.ctx_speed === "any") &&
                          "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <fetcher.Form method="post" className="inline">
                        <input type="hidden" name="_action" value="toggle" />
                        <input
                          type="hidden"
                          name="nodeId"
                          value={obs.node_id}
                        />
                        <input
                          type="hidden"
                          name="isActive"
                          value={obs.is_active.toString()}
                        />
                        <Switch
                          checked={obs.is_active}
                          onCheckedChange={() => {
                            const form = new FormData();
                            form.set("_action", "toggle");
                            form.set("nodeId", obs.node_id);
                            form.set("isActive", obs.is_active.toString());
                            fetcher.submit(form, { method: "post" });
                          }}
                        />
                      </fetcher.Form>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Link to={`/admin/diagnostic/${obs.node_id}/edit`}>
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Dialog
                          open={deleteDialogOpen === obs.node_id}
                          onOpenChange={(open) =>
                            setDeleteDialogOpen(open ? obs.node_id : null)
                          }
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>
                                Confirmer la suppression
                              </DialogTitle>
                              <DialogDescription>
                                Etes-vous sur de vouloir supprimer "
                                {obs.node_label}" ? Cette action est
                                irreversible.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => setDeleteDialogOpen(null)}
                              >
                                Annuler
                              </Button>
                              <fetcher.Form method="post">
                                <input
                                  type="hidden"
                                  name="_action"
                                  value="delete"
                                />
                                <input
                                  type="hidden"
                                  name="nodeId"
                                  value={obs.node_id}
                                />
                                <Button
                                  type="submit"
                                  variant="destructive"
                                  onClick={() => setDeleteDialogOpen(null)}
                                >
                                  Supprimer
                                </Button>
                              </fetcher.Form>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Page {pagination.page} sur {pagination.totalPages} (
                {pagination.total} symptomes)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => goToPage(pagination.page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Precedent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => goToPage(pagination.page + 1)}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick link to diagnostic page */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Page Diagnostic Public</h3>
              <p className="text-sm text-gray-500">
                Voir la page utilisateur avec ces symptomes
              </p>
            </div>
            <Link to="/diagnostic">
              <Button variant="outline" className="gap-2">
                <Eye className="h-4 w-4" />
                Voir /diagnostic
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
