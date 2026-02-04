/**
 * 🔧 SEO HUB - EDIT R5 DIAGNOSTIC
 *
 * Formulaire d'édition d'une page R5 Diagnostic existante
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import {
  useLoaderData,
  useNavigation,
  Form,
  Link,
  useActionData,
} from "@remix-run/react";
import {
  ArrowLeft,
  AlertTriangle,
  Save,
  AlertCircle,
  Check,
  Eye,
  ExternalLink,
  StopCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { getInternalApiUrl } from "~/utils/internal-api.server";

interface Diagnostic {
  slug: string;
  title: string;
  metaDescription: string | null;
  observableType: string;
  perceptionChannel: string;
  riskLevel: string;
  safetyGate: string;
  clusterId: string | null;
  symptomDescription: string;
  signDescription: string | null;
  dtcCodes: string[] | null;
  relatedGammes: number[] | null;
  relatedReferences: string[] | null;
  recommendedActions: Array<{ action: string; urgency: string }> | null;
  estimatedRepairCostMin: number | null;
  estimatedRepairCostMax: number | null;
  isPublished?: boolean;
  updatedAt: string;
}

interface LoaderData {
  diagnostic: Diagnostic | null;
  error: string | null;
}

// Action data type union (for future use)
type _ActionData =
  | { success: true; action: "update" | "publish" }
  | { success: false; errors: string[] };

const SAFETY_GATE_COLORS: Record<string, string> = {
  stop_immediate: "bg-red-100 text-red-800",
  stop_soon: "bg-orange-100 text-orange-800",
  warning: "bg-yellow-100 text-yellow-800",
  none: "bg-gray-100 text-gray-800",
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const { slug } = params;

  try {
    const res = await fetch(`${backendUrl}/api/seo/diagnostic/${slug}`, {
      headers: { Cookie: cookieHeader },
    });

    if (!res.ok) {
      return json<LoaderData>({
        diagnostic: null,
        error: "Diagnostic non trouvé",
      });
    }

    const diagnostic = await res.json();

    return json<LoaderData>({
      diagnostic,
      error: null,
    });
  } catch (error) {
    console.error("[R5 Edit] Loader error:", error);
    return json<LoaderData>({
      diagnostic: null,
      error: "Erreur connexion backend",
    });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const { slug } = params;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "publish") {
    const res = await fetch(
      `${backendUrl}/api/seo/diagnostic/${slug}/publish`,
      {
        method: "PATCH",
        headers: { Cookie: cookieHeader },
      },
    );
    const data = await res.json();
    return json({ success: data.success, action: "publish" });
  }

  // Update diagnostic
  const title = formData.get("title") as string;
  const metaDescription = formData.get("meta_description") as string;
  const observableType = formData.get("observable_type") as string;
  const perceptionChannel = formData.get("perception_channel") as string;
  const riskLevel = formData.get("risk_level") as string;
  const safetyGate = formData.get("safety_gate") as string;
  const clusterId = formData.get("cluster_id") as string;
  const symptomDescription = formData.get("symptom_description") as string;
  const signDescription = formData.get("sign_description") as string;
  const relatedGammesRaw = formData.get("related_gammes") as string;
  const relatedReferencesRaw = formData.get("related_references") as string;

  // Validation
  const errors: string[] = [];
  if (!title || title.length < 10) {
    errors.push("Le titre doit faire au moins 10 caractères");
  }
  if (!symptomDescription || symptomDescription.length < 20) {
    errors.push("La description symptôme doit faire au moins 20 caractères");
  }

  if (errors.length > 0) {
    return json({ success: false, errors });
  }

  // Parse arrays
  const relatedGammes = relatedGammesRaw
    ? relatedGammesRaw
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n))
    : [];
  const relatedReferences = relatedReferencesRaw
    ? relatedReferencesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  try {
    const res = await fetch(`${backendUrl}/api/seo/diagnostic/${slug}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        title,
        meta_description: metaDescription || null,
        observable_type: observableType,
        perception_channel: perceptionChannel,
        risk_level: riskLevel,
        safety_gate: safetyGate,
        cluster_id: clusterId || null,
        symptom_description: symptomDescription,
        sign_description: signDescription || null,
        related_gammes: relatedGammes.length > 0 ? relatedGammes : null,
        related_references:
          relatedReferences.length > 0 ? relatedReferences : null,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      return json({
        success: false,
        errors: [error.message || "Erreur lors de la mise à jour"],
      });
    }

    return json({ success: true, action: "update" });
  } catch (error) {
    console.error("[R5 Edit] Action error:", error);
    return json({ success: false, errors: ["Erreur serveur"] });
  }
}

export default function AdminDiagnosticsEdit() {
  const { diagnostic, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (error || !diagnostic) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/seo-hub/content/diagnostics">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || "Diagnostic non trouvé"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/seo-hub/content/diagnostics">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" />
              Éditer R5 Diagnostic
            </h1>
            <p className="text-muted-foreground font-mono">
              /diagnostic-auto/{diagnostic.slug}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={SAFETY_GATE_COLORS[diagnostic.safetyGate]}>
            {diagnostic.safetyGate === "stop_immediate" && (
              <StopCircle className="mr-1 h-3 w-3" />
            )}
            {diagnostic.safetyGate.replace("_", " ").toUpperCase()}
          </Badge>
          {diagnostic.isPublished ? (
            <Badge className="bg-green-100 text-green-800">
              <Check className="mr-1 h-3 w-3" />
              Publié
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              Brouillon
            </Badge>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link to={`/diagnostic-auto/${diagnostic.slug}`} target="_blank">
              <Eye className="mr-2 h-4 w-4" />
              Prévisualiser
              <ExternalLink className="ml-2 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {actionData?.success &&
        "action" in actionData &&
        actionData.action === "update" && (
          <Alert className="bg-green-50 border-green-200">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Diagnostic mis à jour avec succès
            </AlertDescription>
          </Alert>
        )}
      {actionData?.success &&
        "action" in actionData &&
        actionData.action === "publish" && (
          <Alert className="bg-green-50 border-green-200">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Diagnostic publié avec succès
            </AlertDescription>
          </Alert>
        )}
      {actionData &&
        !actionData.success &&
        "errors" in actionData &&
        actionData.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc pl-4">
                {actionData.errors.map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

      <Form method="post">
        <Tabs defaultValue="identity" className="space-y-6">
          <TabsList>
            <TabsTrigger value="identity">Identité</TabsTrigger>
            <TabsTrigger value="classification">Classification</TabsTrigger>
            <TabsTrigger value="content">Contenu</TabsTrigger>
            <TabsTrigger value="links">Liens</TabsTrigger>
          </TabsList>

          {/* Identity Tab */}
          <TabsContent value="identity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Identification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input
                      value={diagnostic.slug}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cluster_id">Cluster</Label>
                    <Input
                      id="cluster_id"
                      name="cluster_id"
                      defaultValue={diagnostic.clusterId || ""}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Titre *</Label>
                  <Input
                    id="title"
                    name="title"
                    defaultValue={diagnostic.title}
                    required
                    minLength={10}
                    maxLength={70}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta_description">Meta Description</Label>
                  <Textarea
                    id="meta_description"
                    name="meta_description"
                    defaultValue={diagnostic.metaDescription || ""}
                    maxLength={160}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Classification Tab */}
          <TabsContent value="classification" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Observable Pro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="observable_type">Type observable</Label>
                    <Select
                      name="observable_type"
                      defaultValue={diagnostic.observableType}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="symptom">Symptom (60%)</SelectItem>
                        <SelectItem value="sign">Sign (85%)</SelectItem>
                        <SelectItem value="dtc">DTC (95%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="perception_channel">Canal perception</Label>
                    <Select
                      name="perception_channel"
                      defaultValue={diagnostic.perceptionChannel}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visual">Visuel</SelectItem>
                        <SelectItem value="auditory">Auditif</SelectItem>
                        <SelectItem value="olfactory">Olfactif</SelectItem>
                        <SelectItem value="tactile">Tactile</SelectItem>
                        <SelectItem value="electronic">Électronique</SelectItem>
                        <SelectItem value="performance">Performance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="risk_level">Niveau de risque</Label>
                    <Select
                      name="risk_level"
                      defaultValue={diagnostic.riskLevel}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confort">Confort</SelectItem>
                        <SelectItem value="securite">Sécurité</SelectItem>
                        <SelectItem value="critique">Critique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="safety_gate">Safety Gate</Label>
                    <Select
                      name="safety_gate"
                      defaultValue={diagnostic.safetyGate}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        <SelectItem value="warning">Attention</SelectItem>
                        <SelectItem value="stop_soon">STOP Bientôt</SelectItem>
                        <SelectItem value="stop_immediate">
                          STOP Immédiat
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Descriptions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="symptom_description">
                    Description symptôme *
                  </Label>
                  <Textarea
                    id="symptom_description"
                    name="symptom_description"
                    defaultValue={diagnostic.symptomDescription}
                    required
                    minLength={20}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sign_description">Description signe</Label>
                  <Textarea
                    id="sign_description"
                    name="sign_description"
                    defaultValue={diagnostic.signDescription || ""}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Links Tab */}
          <TabsContent value="links" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Maillage interne</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="related_gammes">Gammes liées (pg_id)</Label>
                  <Input
                    id="related_gammes"
                    name="related_gammes"
                    defaultValue={diagnostic.relatedGammes?.join(", ") || ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="related_references">
                    Références R4 liées
                  </Label>
                  <Input
                    id="related_references"
                    name="related_references"
                    defaultValue={
                      diagnostic.relatedReferences?.join(", ") || ""
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-between mt-6">
          <div>
            {!diagnostic.isPublished && (
              <Form method="post">
                <input type="hidden" name="intent" value="publish" />
                <Button
                  type="submit"
                  variant="outline"
                  className="text-green-600"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Publier
                </Button>
              </Form>
            )}
          </div>
          <div className="flex gap-4">
            <Button variant="outline" type="button" asChild>
              <Link to="/admin/seo-hub/content/diagnostics">Annuler</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </div>
      </Form>
    </div>
  );
}
