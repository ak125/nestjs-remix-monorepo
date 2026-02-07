/**
 * 📝 SEO HUB - EDIT R4 REFERENCE
 *
 * Formulaire d'édition d'une page R4 Reference existante
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
  BookOpen,
  Save,
  Eye,
  AlertCircle,
  Check,
  ExternalLink,
} from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { getInternalApiUrl } from "~/utils/internal-api.server";

interface Reference {
  slug: string;
  title: string;
  metaDescription: string | null;
  definition: string;
  roleMecanique: string | null;
  composition: string[] | null;
  confusionsCourantes: string[] | null;
  symptomesAssocies: string[] | null;
  contentHtml: string | null;
  gamme: {
    pgId: number | null;
    name: string | null;
  };
  blogSlugs: string[] | null;
  isPublished?: boolean;
  updatedAt: string;
}

interface Gamme {
  pgId: number;
  name: string;
  slug: string;
}

interface LoaderData {
  reference: Reference | null;
  gammes: Gamme[];
  error: string | null;
}

// Action data type union (for future use)
type _ActionData =
  | { success: true; action: "update" | "publish" }
  | { success: false; errors: string[] };

export async function loader({ request, params }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const { slug } = params;

  try {
    const [refRes, gammesRes] = await Promise.all([
      fetch(`${backendUrl}/api/seo/reference/${slug}`, {
        headers: { Cookie: cookieHeader },
      }),
      fetch(`${backendUrl}/api/catalog/gammes?limit=500`, {
        headers: { Cookie: cookieHeader },
      }),
    ]);

    if (!refRes.ok) {
      return json<LoaderData>({
        reference: null,
        gammes: [],
        error: "Référence non trouvée",
      });
    }

    const reference = await refRes.json();
    const gammesData = gammesRes.ok ? await gammesRes.json() : { data: [] };

    return json<LoaderData>({
      reference,
      gammes: gammesData.data || [],
      error: null,
    });
  } catch (error) {
    console.error("[R4 Edit] Loader error:", error);
    return json<LoaderData>({
      reference: null,
      gammes: [],
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
    const res = await fetch(`${backendUrl}/api/seo/reference/${slug}/publish`, {
      method: "PATCH",
      headers: { Cookie: cookieHeader },
    });
    const data = await res.json();
    return json({ success: data.success, action: "publish" });
  }

  // Update reference
  const title = formData.get("title") as string;
  const metaDescription = formData.get("meta_description") as string;
  const definition = formData.get("definition") as string;
  const roleMecanique = formData.get("role_mecanique") as string;
  const compositionRaw = formData.get("composition") as string;
  const confusionsRaw = formData.get("confusions_courantes") as string;
  const symptomesRaw = formData.get("symptomes_associes") as string;
  const contentHtml = formData.get("content_html") as string;

  // Validation
  const errors: string[] = [];
  if (!title || title.length < 10) {
    errors.push("Le titre doit faire au moins 10 caractères");
  }
  if (!definition || definition.length < 50) {
    errors.push("La définition doit faire au moins 50 caractères");
  }

  if (errors.length > 0) {
    return json({ success: false, errors });
  }

  // Parse arrays
  const composition = compositionRaw
    ? compositionRaw.split("\n").filter((l) => l.trim())
    : [];
  const confusions = confusionsRaw
    ? confusionsRaw.split("\n").filter((l) => l.trim())
    : [];
  const symptomes = symptomesRaw
    ? symptomesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  try {
    const res = await fetch(`${backendUrl}/api/seo/reference/${slug}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        title,
        meta_description: metaDescription || null,
        definition,
        role_mecanique: roleMecanique || null,
        composition: composition.length > 0 ? composition : null,
        confusions_courantes: confusions.length > 0 ? confusions : null,
        symptomes_associes: symptomes.length > 0 ? symptomes : null,
        content_html: contentHtml || null,
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
    console.error("[R4 Edit] Action error:", error);
    return json({ success: false, errors: ["Erreur serveur"] });
  }
}

export default function AdminReferencesEdit() {
  const { reference, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (error || !reference) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/seo-hub/content/references">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || "Référence non trouvée"}
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
            <Link to="/admin/seo-hub/content/references">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6" />
              Éditer R4 Reference
            </h1>
            <p className="text-muted-foreground font-mono">
              /reference-auto/{reference.slug}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {reference.isPublished ? (
            <Badge className="bg-green-100 text-green-800">
              <Check className="mr-1 h-3 w-3" />
              Publiée
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              Brouillon
            </Badge>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link to={`/reference-auto/${reference.slug}`} target="_blank">
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
              Référence mise à jour avec succès
            </AlertDescription>
          </Alert>
        )}
      {actionData?.success &&
        "action" in actionData &&
        actionData.action === "publish" && (
          <Alert className="bg-green-50 border-green-200">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Référence publiée avec succès
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
            <TabsTrigger value="content">Contenu</TabsTrigger>
            <TabsTrigger value="links">Liens</TabsTrigger>
          </TabsList>

          {/* Identity Tab */}
          <TabsContent value="identity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Identification</CardTitle>
                <CardDescription>
                  Informations de base pour la page R4
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      value={reference.slug}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-sm text-muted-foreground">
                      Le slug ne peut pas être modifié
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Gamme liée</Label>
                    <Input
                      value={reference.gamme?.name || "Aucune"}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Titre *</Label>
                  <Input
                    id="title"
                    name="title"
                    defaultValue={reference.title}
                    required
                    minLength={10}
                    maxLength={70}
                  />
                  <p className="text-sm text-muted-foreground">
                    Max 70 caractères pour le SEO
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta_description">Meta Description</Label>
                  <Textarea
                    id="meta_description"
                    name="meta_description"
                    defaultValue={reference.metaDescription || ""}
                    maxLength={160}
                    rows={2}
                  />
                  <p className="text-sm text-muted-foreground">
                    Max 160 caractères pour les SERP
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Définition</CardTitle>
                <CardDescription>
                  Contenu principal de la fiche technique
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="definition">Définition *</Label>
                  <Textarea
                    id="definition"
                    name="definition"
                    defaultValue={reference.definition}
                    required
                    minLength={50}
                    rows={6}
                  />
                  <p className="text-sm text-muted-foreground">
                    Min 50 caractères. Texte pur, pas de HTML.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role_mecanique">Rôle mécanique</Label>
                  <Textarea
                    id="role_mecanique"
                    name="role_mecanique"
                    defaultValue={reference.roleMecanique || ""}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content_html">Contenu HTML enrichi</Label>
                  <Textarea
                    id="content_html"
                    name="content_html"
                    defaultValue={reference.contentHtml || ""}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-sm text-muted-foreground">
                    HTML avec balises h2, p, ul, li autorisées
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Listes structurées</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="composition">Composition</Label>
                  <Textarea
                    id="composition"
                    name="composition"
                    defaultValue={reference.composition?.join("\n") || ""}
                    rows={4}
                  />
                  <p className="text-sm text-muted-foreground">
                    Un élément par ligne
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confusions_courantes">
                    Confusions courantes
                  </Label>
                  <Textarea
                    id="confusions_courantes"
                    name="confusions_courantes"
                    defaultValue={
                      reference.confusionsCourantes?.join("\n") || ""
                    }
                    rows={4}
                  />
                  <p className="text-sm text-muted-foreground">
                    Un élément par ligne
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Links Tab */}
          <TabsContent value="links" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Maillage interne</CardTitle>
                <CardDescription>
                  Liens vers les pages R5 Diagnostic et articles blog
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="symptomes_associes">
                    Symptômes R5 associés
                  </Label>
                  <Input
                    id="symptomes_associes"
                    name="symptomes_associes"
                    defaultValue={reference.symptomesAssocies?.join(", ") || ""}
                  />
                  <p className="text-sm text-muted-foreground">
                    Slugs R5 séparés par des virgules
                  </p>
                </div>
                {reference.blogSlugs && reference.blogSlugs.length > 0 && (
                  <div className="space-y-2">
                    <Label>Articles Blog liés</Label>
                    <div className="flex flex-wrap gap-2">
                      {reference.blogSlugs.map((slug) => (
                        <Badge key={slug} variant="outline">
                          {slug}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-between mt-6">
          <div>
            {!reference.isPublished && (
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
              <Link to="/admin/seo-hub/content/references">Annuler</Link>
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
