import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import { ArrowLeft, Save, AlertTriangle } from "lucide-react";
import { AdminBreadcrumb } from "~/components/admin/AdminBreadcrumb";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

// Types
interface Observable {
  node_id: string;
  node_label: string;
  node_alias?: string;
  node_category?: string;
  node_type: string;
  node_data: Record<string, unknown>;
  input_type?: string;
  perception_channel?: string;
  intensity?: number;
  risk_level?: string;
  dtc_code?: string;
  ctx_phase?: string;
  ctx_temp?: string;
  ctx_speed?: string;
  ctx_road?: string;
  ctx_load?: string;
  ctx_freq?: string;
  is_active: boolean;
  status?: string;
  confidence?: number;
  sources?: string[];
  validation_status?: string;
  created_at: string;
  updated_at: string;
}

// Meta
export const meta = () => [{ title: "Editer Symptome - Admin | Automecanik" }];

// Loader
export async function loader({ params }: LoaderFunctionArgs) {
  const nodeId = params.id;

  if (!nodeId) {
    throw new Response("ID manquant", { status: 400 });
  }

  try {
    const res = await fetch(
      `http://127.0.0.1:3000/api/knowledge-graph/nodes/${nodeId}`,
    );

    if (!res.ok) {
      throw new Response("Symptome non trouve", { status: 404 });
    }

    const observable: Observable = await res.json();

    return json({ observable });
  } catch (error) {
    console.error("Loader error:", error);
    throw new Response("Erreur serveur", { status: 500 });
  }
}

// Action
export async function action({ request, params }: ActionFunctionArgs) {
  const nodeId = params.id;
  const formData = await request.formData();

  const updatedNode = {
    node_label: formData.get("node_label"),
    node_alias: formData.get("node_alias") || null,
    node_category: formData.get("node_category") || null,
    input_type: formData.get("input_type"),
    perception_channel: formData.get("perception_channel"),
    risk_level: formData.get("risk_level"),
    intensity: parseInt(formData.get("intensity") as string) || 3,
    dtc_code: formData.get("dtc_code") || null,
    ctx_phase: formData.get("ctx_phase") || "any",
    ctx_temp: formData.get("ctx_temp") || "any",
    ctx_speed: formData.get("ctx_speed") || "any",
    ctx_road: formData.get("ctx_road") || "any",
    ctx_load: formData.get("ctx_load") || "any",
    ctx_freq: formData.get("ctx_freq") || "any",
    is_active: formData.get("is_active") === "true",
    status: formData.get("status") || "draft",
    confidence: parseFloat(formData.get("confidence") as string) || 0.8,
  };

  try {
    const res = await fetch(
      `http://127.0.0.1:3000/api/knowledge-graph/nodes/${nodeId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedNode),
      },
    );

    if (!res.ok) {
      const error = await res.text();
      return json({ success: false, error: `Erreur mise a jour: ${error}` });
    }

    return redirect("/admin/diagnostic?updated=true");
  } catch (error) {
    console.error("Action error:", error);
    return json({ success: false, error: "Erreur serveur" });
  }
}

// Component
export default function AdminDiagnosticEdit() {
  const { observable } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const isSubmitting = fetcher.state === "submitting";

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <AdminBreadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Diagnostic KG", href: "/admin/diagnostic" },
          {
            label: "Editer",
            href: `/admin/diagnostic/${observable.node_id}/edit`,
          },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/diagnostic">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              Editer: {observable.node_label}
            </h1>
            <p className="text-gray-500">ID: {observable.node_id}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <fetcher.Form method="post">
        <Tabs defaultValue="base" className="space-y-6">
          <TabsList>
            <TabsTrigger value="base">Informations de base</TabsTrigger>
            <TabsTrigger value="perception">Perception</TabsTrigger>
            <TabsTrigger value="context">Contexte</TabsTrigger>
            <TabsTrigger value="advanced">Avance</TabsTrigger>
          </TabsList>

          {/* Tab: Base */}
          <TabsContent value="base">
            <Card>
              <CardHeader>
                <CardTitle>Informations de base</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="node_label">Label (requis)</Label>
                    <Input
                      id="node_label"
                      name="node_label"
                      defaultValue={observable.node_label}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="node_alias">Alias URL</Label>
                    <Input
                      id="node_alias"
                      name="node_alias"
                      defaultValue={observable.node_alias || ""}
                      placeholder="ex: fumee-noire"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="node_category">Categorie</Label>
                  <Select
                    name="node_category"
                    defaultValue={observable.node_category || ""}
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
                      <SelectItem value="Climatisation">
                        Climatisation
                      </SelectItem>
                      <SelectItem value="Autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="space-y-1">
                    <Label>Statut actif</Label>
                    <p className="text-sm text-gray-500">
                      Le symptome apparait dans le diagnostic
                    </p>
                  </div>
                  <input
                    type="hidden"
                    name="is_active"
                    value={observable.is_active ? "true" : "false"}
                  />
                  <Switch
                    defaultChecked={observable.is_active}
                    onCheckedChange={(checked) => {
                      const input = document.querySelector(
                        'input[name="is_active"]',
                      ) as HTMLInputElement;
                      if (input) input.value = checked ? "true" : "false";
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Perception */}
          <TabsContent value="perception">
            <Card>
              <CardHeader>
                <CardTitle>Type et perception</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="input_type">Type d'input</Label>
                    <Select
                      name="input_type"
                      defaultValue={observable.input_type || "symptom"}
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
                    <p className="text-xs text-gray-500">
                      Symptome: confiance 60% | Signe: 85% | DTC: 95%
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="perception_channel">Canal perception</Label>
                    <Select
                      name="perception_channel"
                      defaultValue={observable.perception_channel || "visual"}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visual">
                          Visuel (fumee, voyant)
                        </SelectItem>
                        <SelectItem value="auditory">
                          Auditif (bruit, sifflement)
                        </SelectItem>
                        <SelectItem value="olfactory">
                          Olfactif (odeur)
                        </SelectItem>
                        <SelectItem value="tactile">
                          Tactile (vibration)
                        </SelectItem>
                        <SelectItem value="electronic">
                          Electronique (code)
                        </SelectItem>
                        <SelectItem value="performance">
                          Performance (perte puissance)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="risk_level">Niveau de risque</Label>
                    <Select
                      name="risk_level"
                      defaultValue={observable.risk_level || "confort"}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confort">
                          Confort (non urgent)
                        </SelectItem>
                        <SelectItem value="securite">
                          Securite (a verifier)
                        </SelectItem>
                        <SelectItem value="critique">
                          Critique (arret immediat)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dtc_code">Code DTC (si applicable)</Label>
                  <Input
                    id="dtc_code"
                    name="dtc_code"
                    defaultValue={observable.dtc_code || ""}
                    placeholder="Ex: P0300, C1234"
                  />
                  <p className="text-xs text-gray-500">
                    Format: Pxxxx (moteur), Cxxxx (chassis), Bxxxx
                    (carrosserie), Uxxxx (reseau)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Intensite: {observable.intensity || 3}/5</Label>
                  <input
                    type="hidden"
                    name="intensity"
                    defaultValue={observable.intensity || 3}
                  />
                  <Slider
                    defaultValue={[observable.intensity || 3]}
                    max={5}
                    min={1}
                    step={1}
                    onValueChange={(v) => {
                      const input = document.querySelector(
                        'input[name="intensity"]',
                      ) as HTMLInputElement;
                      if (input) input.value = v[0].toString();
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1 - Leger</span>
                    <span>3 - Modere</span>
                    <span>5 - Severe</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Context */}
          <TabsContent value="context">
            <Card>
              <CardHeader>
                <CardTitle>Contexte d'apparition</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-500 mb-4">
                  Definissez dans quelles conditions le symptome apparait.
                  "Toutes" = pas de contrainte.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ctx_phase">Phase de conduite</Label>
                    <Select
                      name="ctx_phase"
                      defaultValue={observable.ctx_phase || "any"}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Toutes phases</SelectItem>
                        <SelectItem value="demarrage">Demarrage</SelectItem>
                        <SelectItem value="ralenti">Ralenti</SelectItem>
                        <SelectItem value="acceleration">
                          Acceleration
                        </SelectItem>
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
                    <Label htmlFor="ctx_temp">Temperature moteur</Label>
                    <Select
                      name="ctx_temp"
                      defaultValue={observable.ctx_temp || "any"}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Toutes temperatures</SelectItem>
                        <SelectItem value="froid">Moteur froid</SelectItem>
                        <SelectItem value="chaud">Moteur chaud</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ctx_speed">Plage de vitesse</Label>
                    <Select
                      name="ctx_speed"
                      defaultValue={observable.ctx_speed || "any"}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Toutes vitesses</SelectItem>
                        <SelectItem value="0_30">0-30 km/h (ville)</SelectItem>
                        <SelectItem value="30_70">
                          30-70 km/h (periurbain)
                        </SelectItem>
                        <SelectItem value="70_110">
                          70-110 km/h (route)
                        </SelectItem>
                        <SelectItem value="110_plus">
                          110+ km/h (autoroute)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ctx_road">Type de route</Label>
                    <Select
                      name="ctx_road"
                      defaultValue={observable.ctx_road || "any"}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Toutes routes</SelectItem>
                        <SelectItem value="lisse">Route lisse</SelectItem>
                        <SelectItem value="degradee">Route degradee</SelectItem>
                        <SelectItem value="pluie">Route mouillee</SelectItem>
                        <SelectItem value="neige">Neige/verglas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ctx_load">Charge vehicule</Label>
                    <Select
                      name="ctx_load"
                      defaultValue={observable.ctx_load || "any"}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Toutes charges</SelectItem>
                        <SelectItem value="seul">Conducteur seul</SelectItem>
                        <SelectItem value="charge">Vehicule charge</SelectItem>
                        <SelectItem value="montee">En montee</SelectItem>
                        <SelectItem value="descente">En descente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ctx_freq">Frequence</Label>
                    <Select
                      name="ctx_freq"
                      defaultValue={observable.ctx_freq || "any"}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Variable</SelectItem>
                        <SelectItem value="intermittent">
                          Intermittent
                        </SelectItem>
                        <SelectItem value="permanent">Permanent</SelectItem>
                        <SelectItem value="progressif">Progressif</SelectItem>
                        <SelectItem value="sporadique">Sporadique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Advanced */}
          <TabsContent value="advanced">
            <Card>
              <CardHeader>
                <CardTitle>Parametres avances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Statut workflow</Label>
                    <Select
                      name="status"
                      defaultValue={observable.status || "draft"}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Brouillon</SelectItem>
                        <SelectItem value="active">
                          Actif (production)
                        </SelectItem>
                        <SelectItem value="deprecated">Obsolete</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confidence">Confiance de base</Label>
                    <Input
                      id="confidence"
                      name="confidence"
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      defaultValue={observable.confidence || 0.8}
                    />
                    <p className="text-xs text-gray-500">
                      Entre 0 et 1 (ex: 0.85 = 85%)
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">Metadonnees</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Cree le:</span>{" "}
                      {new Date(observable.created_at).toLocaleString("fr-FR")}
                    </div>
                    <div>
                      <span className="text-gray-500">Modifie le:</span>{" "}
                      {new Date(observable.updated_at).toLocaleString("fr-FR")}
                    </div>
                    <div>
                      <span className="text-gray-500">Sources:</span>{" "}
                      {observable.sources?.join(", ") || "-"}
                    </div>
                    <div>
                      <span className="text-gray-500">Validation:</span>{" "}
                      {observable.validation_status || "-"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Submit button */}
        <div className="flex justify-end gap-4 mt-6">
          <Link to="/admin/diagnostic">
            <Button variant="outline">Annuler</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            <Save className="h-4 w-4" />
            {isSubmitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </fetcher.Form>
    </div>
  );
}
