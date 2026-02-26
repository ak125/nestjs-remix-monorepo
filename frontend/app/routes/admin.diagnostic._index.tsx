import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import {
  useLoaderData,
  useFetcher,
  Link,
  useNavigation,
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
} from "lucide-react";
import { useState } from "react";
import { AdminDataTable, type DataColumn } from "~/components/admin/patterns";
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
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { useTableUrlState } from "~/hooks/useTableUrlState";
import { logger } from "~/utils/logger";

// --- Types ---

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

// --- Helpers ---

const RISK_COLORS: Record<string, string> = {
  critique: "bg-red-500 text-white",
  securite: "bg-orange-500 text-white",
  confort: "bg-green-500 text-white",
};

const INPUT_TYPE_COLORS: Record<string, string> = {
  dtc: "bg-purple-500 text-white",
  sign: "bg-blue-500 text-white",
  symptom: "bg-amber-500 text-white",
};

const PERCEPTION_LABELS: Record<string, string> = {
  visual: "Visuel",
  auditory: "Auditif",
  olfactory: "Olfactif",
  tactile: "Tactile",
  electronic: "Electronique",
  performance: "Performance",
};

// --- Meta ---

export const meta = () => [
  { title: "Gestion des Symptomes - Admin | Automecanik" },
  {
    name: "description",
    content:
      "Administration des symptomes du Knowledge Graph pour le diagnostic auto",
  },
];

// --- Loader ---

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const search = url.searchParams.get("q") || "";
  const inputType = url.searchParams.get("inputType") || "";
  const riskLevel = url.searchParams.get("riskLevel") || "";
  const limit = 25;
  const offset = (page - 1) * limit;

  try {
    const [observablesRes, statsRes] = await Promise.all([
      fetch(
        `http://127.0.0.1:3000/api/knowledge-graph/nodes?type=Observable&limit=${limit}&offset=${offset}`,
      ),
      fetch("http://127.0.0.1:3000/api/knowledge-graph/stats"),
    ]);

    const observables: Observable[] = observablesRes.ok
      ? await observablesRes.json()
      : [];
    const stats: KgStats = statsRes.ok
      ? await statsRes.json()
      : { totalNodes: 0, totalEdges: 0, nodesByType: {}, avgConfidence: 0 };

    // Client-side filtering (backend doesn't support all filters)
    let filtered = observables;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.node_label.toLowerCase().includes(q) ||
          o.node_alias?.toLowerCase().includes(q) ||
          o.dtc_code?.toLowerCase().includes(q),
      );
    }
    if (inputType)
      filtered = filtered.filter((o) => o.input_type === inputType);
    if (riskLevel)
      filtered = filtered.filter((o) => o.risk_level === riskLevel);

    const totalObservables =
      stats.nodesByType?.Observable || observables.length;

    return json({
      observables: filtered,
      stats,
      pagination: {
        page,
        limit,
        total: totalObservables,
        totalPages: Math.ceil(totalObservables / limit),
      },
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
      error: "Erreur de chargement",
    });
  }
}

// --- Action ---

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
          { method: "DELETE" },
        );
        if (!res.ok)
          return json({ success: false, error: "Erreur suppression" });
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
        if (!res.ok)
          return json({ success: false, error: "Erreur modification" });
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

// --- Column definitions ---

const observableColumns: DataColumn<Observable>[] = [
  {
    key: "node_label" as keyof Observable,
    header: "Label",
    render: (_val, row) => (
      <div>
        <p className="font-medium">{row.node_label}</p>
        {row.node_alias && (
          <p className="text-xs text-gray-400">{row.node_alias}</p>
        )}
        {row.dtc_code && (
          <Badge variant="outline" className="mt-1">
            {row.dtc_code}
          </Badge>
        )}
      </div>
    ),
  },
  {
    key: "input_type" as keyof Observable,
    header: "Type",
    render: (val) => (
      <Badge
        className={INPUT_TYPE_COLORS[String(val)] || "bg-gray-400 text-white"}
      >
        {String(val || "symptom")}
      </Badge>
    ),
  },
  {
    key: "perception_channel" as keyof Observable,
    header: "Canal",
    render: (val) => (
      <>{PERCEPTION_LABELS[String(val)] || String(val || "-")}</>
    ),
  },
  {
    key: "risk_level" as keyof Observable,
    header: "Risque",
    render: (val) => (
      <Badge className={RISK_COLORS[String(val)] || "bg-gray-400 text-white"}>
        {String(val || "confort")}
      </Badge>
    ),
  },
  {
    key: "ctx_phase" as keyof Observable,
    header: "Contexte",
    render: (_val, row) => {
      const parts: string[] = [];
      if (row.ctx_phase && row.ctx_phase !== "any")
        parts.push(`Phase: ${row.ctx_phase}`);
      if (row.ctx_temp && row.ctx_temp !== "any")
        parts.push(`Temp: ${row.ctx_temp}`);
      if (row.ctx_speed && row.ctx_speed !== "any")
        parts.push(`Vit: ${row.ctx_speed}`);
      return (
        <div className="text-xs text-gray-500">
          {parts.length > 0 ? parts.map((p, i) => <div key={i}>{p}</div>) : "-"}
        </div>
      );
    },
  },
  {
    key: "is_active" as keyof Observable,
    header: "Actif",
    render: (_val, row) => <ObservableToggle obs={row} />,
  },
  {
    key: "node_id" as keyof Observable,
    header: "Actions",
    align: "right" as const,
    width: "100px",
    render: (_val, row) => <ObservableActions obs={row} />,
  },
];

// --- Cell components (need fetcher) ---

function ObservableToggle({ obs }: { obs: Observable }) {
  const fetcher = useFetcher();
  return (
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
  );
}

function ObservableActions({ obs }: { obs: Observable }) {
  const fetcher = useFetcher();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex gap-2 justify-end">
      <Link to={`/admin/diagnostic/${obs.node_id}/edit`}>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4" />
        </Button>
      </Link>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Etes-vous sur de vouloir supprimer "{obs.node_label}" ? Cette
              action est irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Annuler
            </Button>
            <fetcher.Form method="post">
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="nodeId" value={obs.node_id} />
              <Button
                type="submit"
                variant="destructive"
                onClick={() => setDeleteOpen(false)}
              >
                Supprimer
              </Button>
            </fetcher.Form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Create Dialog ---

function CreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state === "submitting";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                {[
                  "Moteur",
                  "Freinage",
                  "Direction",
                  "Suspension",
                  "Transmission",
                  "Refroidissement",
                  "Echappement",
                  "Electrique",
                  "Climatisation",
                  "Autre",
                ].map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Type d'input</Label>
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
              <Label>Canal perception</Label>
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
                  {Object.entries(PERCEPTION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Niveau de risque</Label>
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
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Phase conduite</Label>
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
                  {[
                    ["any", "Toutes"],
                    ["demarrage", "Demarrage"],
                    ["ralenti", "Ralenti"],
                    ["acceleration", "Acceleration"],
                    ["freinage", "Freinage"],
                    ["virage", "Virage"],
                    ["vitesse_stable", "Vitesse stable"],
                    ["arret", "Arret"],
                  ].map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Temperature</Label>
              <Select
                name="ctx_temp"
                value={formData.ctx_temp}
                onValueChange={(v) => setFormData({ ...formData, ctx_temp: v })}
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
              <Label>Vitesse</Label>
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
                  {[
                    ["any", "Toutes"],
                    ["0_30", "0-30 km/h"],
                    ["30_70", "30-70 km/h"],
                    ["70_110", "70-110 km/h"],
                    ["110_plus", "110+ km/h"],
                  ].map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <input type="hidden" name="intensity" value={formData.intensity} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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
  );
}

// --- Page component ---

export default function AdminDiagnosticIndex() {
  const { observables, stats, pagination, error } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const table = useTableUrlState({
    filterKeys: ["inputType", "riskLevel"],
    pageSize: 25,
  });

  return (
    <div className="space-y-6 p-6">
      <PublicBreadcrumb
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
        <CreateDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">
                  {(stats.nodesByType as Record<string, number>)?.Observable ||
                    0}
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

      {/* Table with filters as toolbar */}
      <Card>
        <CardContent className="pt-6">
          <AdminDataTable<Observable>
            data={observables as Observable[]}
            columns={observableColumns}
            getRowKey={(row) => row.node_id}
            isLoading={isLoading}
            emptyMessage="Aucun observable trouve"
            serverPagination={{
              total: pagination.total,
              page: pagination.page,
              pageSize: pagination.limit,
              onPageChange: table.setPage,
            }}
            toolbar={
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label className="mb-2 block">Recherche</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Label, alias, code DTC..."
                      className="pl-10"
                      value={table.search}
                      onChange={(e) => table.setSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="w-[150px]">
                  <Label className="mb-2 block">Type input</Label>
                  <Select
                    value={table.filters.inputType || ""}
                    onValueChange={(v) => table.setFilter("inputType", v)}
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
                    value={table.filters.riskLevel || ""}
                    onValueChange={(v) => table.setFilter("riskLevel", v)}
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
                  onClick={table.resetFilters}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* Quick link */}
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
