/**
 * 🔧 SEO HUB - NEW R5 DIAGNOSTIC
 *
 * Formulaire de création d'une nouvelle page R5 Diagnostic
 */

import {
  json,
  redirect,
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
import { ArrowLeft, AlertTriangle, Save, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
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
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { getInternalApiUrl } from "~/utils/internal-api.server";

interface Gamme {
  pgId: number;
  name: string;
}

interface LoaderData {
  gammes: Gamme[];
  r4Slugs: string[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    const [gammesRes, r4Res] = await Promise.all([
      fetch(`${backendUrl}/api/catalog/gammes?limit=500`, {
        headers: { Cookie: cookieHeader },
      }),
      fetch(`${backendUrl}/api/seo/reference`, {
        headers: { Cookie: cookieHeader },
      }),
    ]);

    const gammesData = gammesRes.ok ? await gammesRes.json() : { data: [] };
    const r4Data = r4Res.ok ? await r4Res.json() : { references: [] };

    return json<LoaderData>({
      gammes: gammesData.data || [],
      r4Slugs: (r4Data.references || []).map((r: { slug: string }) => r.slug),
    });
  } catch (error) {
    console.error("[R5 New] Loader error:", error);
    return json<LoaderData>({ gammes: [], r4Slugs: [] });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const formData = await request.formData();

  const slug = formData.get("slug") as string;
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
  const isPublished = formData.get("is_published") === "on";

  // Validation
  const errors: string[] = [];
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    errors.push("Le slug doit être en minuscules avec tirets uniquement");
  }
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
    const res = await fetch(`${backendUrl}/api/seo/diagnostic`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        slug,
        title,
        meta_description: metaDescription || null,
        observable_type: observableType || "symptom",
        perception_channel: perceptionChannel || "visual",
        risk_level: riskLevel || "confort",
        safety_gate: safetyGate || "warning",
        cluster_id: clusterId || null,
        symptom_description: symptomDescription,
        sign_description: signDescription || null,
        related_gammes: relatedGammes.length > 0 ? relatedGammes : null,
        related_references:
          relatedReferences.length > 0 ? relatedReferences : null,
        is_published: isPublished,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      return json({
        success: false,
        errors: [error.message || "Erreur lors de la création"],
      });
    }

    return redirect(`/admin/seo-hub/content/diagnostics/${slug}`);
  } catch (error) {
    console.error("[R5 New] Action error:", error);
    return json({ success: false, errors: ["Erreur serveur"] });
  }
}

export default function AdminDiagnosticsNew() {
  const { gammes: _gammes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="space-y-6">
      {/* Header */}
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
            Nouveau R5 Diagnostic
          </h1>
          <p className="text-muted-foreground">
            Créer une page symptôme ou diagnostic automobile
          </p>
        </div>
      </div>

      {/* Errors */}
      {actionData?.errors && actionData.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4">
              {actionData.errors.map((error, i) => (
                <li key={i}>{error}</li>
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
                    <Label htmlFor="slug">Slug *</Label>
                    <Input
                      id="slug"
                      name="slug"
                      placeholder="voyant-huile-allume"
                      required
                      pattern="[a-z0-9-]+"
                    />
                    <p className="text-sm text-muted-foreground">
                      URL: /diagnostic-auto/
                      <span className="font-mono">slug</span>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cluster_id">Cluster</Label>
                    <Input
                      id="cluster_id"
                      name="cluster_id"
                      placeholder="lubrification, freinage, embrayage..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Titre *</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="Voyant huile allumé : causes et que faire"
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
                    placeholder="Votre voyant huile s'allume ?"
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
                <CardDescription>
                  Classification selon le système Observable Pro
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="observable_type">Type observable</Label>
                    <Select name="observable_type" defaultValue="symptom">
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
                    <Select name="perception_channel" defaultValue="visual">
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
                    <Select name="risk_level" defaultValue="confort">
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
                    <Select name="safety_gate" defaultValue="warning">
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
                    placeholder="Le voyant huile s'allume au tableau de bord..."
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
                    placeholder="Vérification du niveau à la jauge..."
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
                    placeholder="7, 479, 596"
                  />
                  <p className="text-sm text-muted-foreground">
                    IDs des gammes séparés par des virgules
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="related_references">
                    Références R4 liées
                  </Label>
                  <Input
                    id="related_references"
                    name="related_references"
                    placeholder="filtre-a-huile, pompe-a-huile"
                  />
                  <p className="text-sm text-muted-foreground">
                    Slugs R4 séparés par des virgules
                  </p>
                </div>
                <div className="flex items-center space-x-2 pt-4">
                  <Switch id="is_published" name="is_published" />
                  <Label htmlFor="is_published">Publier immédiatement</Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-end gap-4 mt-6">
          <Button variant="outline" type="button" asChild>
            <Link to="/admin/seo-hub/content/diagnostics">Annuler</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Création..." : "Créer le diagnostic"}
          </Button>
        </div>
      </Form>
    </div>
  );
}
