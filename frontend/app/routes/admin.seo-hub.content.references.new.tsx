/**
 * 📝 SEO HUB - NEW R4 REFERENCE
 *
 * Formulaire de création d'une nouvelle page R4 Reference
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
import { ArrowLeft, BookOpen, Save, AlertCircle } from "lucide-react";
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
  slug: string;
}

interface R5Slug {
  slug: string;
  title: string;
}

interface LoaderData {
  gammes: Gamme[];
  r5Slugs: R5Slug[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    // Fetch available gammes and R5 slugs for autocomplete
    const [gammesRes, r5Res] = await Promise.all([
      fetch(`${backendUrl}/api/catalog/gammes?limit=500`, {
        headers: { Cookie: cookieHeader },
      }),
      fetch(`${backendUrl}/api/seo/diagnostic/featured?limit=100`, {
        headers: { Cookie: cookieHeader },
      }),
    ]);

    const gammesData = gammesRes.ok ? await gammesRes.json() : { data: [] };
    const r5Data = r5Res.ok ? await r5Res.json() : { data: [] };

    return json<LoaderData>({
      gammes: gammesData.data || [],
      r5Slugs: r5Data.data || [],
    });
  } catch (error) {
    console.error("[R4 New] Loader error:", error);
    return json<LoaderData>({
      gammes: [],
      r5Slugs: [],
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const formData = await request.formData();

  const slug = formData.get("slug") as string;
  const title = formData.get("title") as string;
  const metaDescription = formData.get("meta_description") as string;
  const definition = formData.get("definition") as string;
  const roleMecanique = formData.get("role_mecanique") as string;
  const pgId = formData.get("pg_id") as string;
  const compositionRaw = formData.get("composition") as string;
  const confusionsRaw = formData.get("confusions_courantes") as string;
  const symptomesRaw = formData.get("symptomes_associes") as string;
  const contentHtml = formData.get("content_html") as string;
  const isPublished = formData.get("is_published") === "on";

  // Validation
  const errors: string[] = [];
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    errors.push("Le slug doit être en minuscules avec tirets uniquement");
  }
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
    // Create the reference via API
    const res = await fetch(`${backendUrl}/api/seo/reference`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        slug,
        title,
        meta_description: metaDescription || null,
        definition,
        role_mecanique: roleMecanique || null,
        pg_id: pgId ? parseInt(pgId, 10) : null,
        composition: composition.length > 0 ? composition : null,
        confusions_courantes: confusions.length > 0 ? confusions : null,
        symptomes_associes: symptomes.length > 0 ? symptomes : null,
        content_html: contentHtml || null,
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

    return redirect(`/admin/seo-hub/content/references/${slug}`);
  } catch (error) {
    console.error("[R4 New] Action error:", error);
    return json({ success: false, errors: ["Erreur serveur"] });
  }
}

export default function AdminReferencesNew() {
  const { gammes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="space-y-6">
      {/* Header */}
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
            Nouvelle R4 Reference
          </h1>
          <p className="text-muted-foreground">
            Créer une fiche technique pour une pièce automobile
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
            <TabsTrigger value="content">Contenu</TabsTrigger>
            <TabsTrigger value="links">Liens</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
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
                    <Label htmlFor="slug">Slug *</Label>
                    <Input
                      id="slug"
                      name="slug"
                      placeholder="filtre-a-huile"
                      required
                      pattern="[a-z0-9-]+"
                    />
                    <p className="text-sm text-muted-foreground">
                      URL: /reference-auto/
                      <span className="font-mono">slug</span>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pg_id">Gamme liée</Label>
                    <Select name="pg_id">
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une gamme" />
                      </SelectTrigger>
                      <SelectContent>
                        {gammes.map((g) => (
                          <SelectItem key={g.pgId} value={String(g.pgId)}>
                            {g.name} (pg_id: {g.pgId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Titre *</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="Filtre à huile : définition, rôle et remplacement"
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
                    placeholder="Découvrez tout sur le filtre à huile..."
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
                    placeholder="Le filtre à huile est un composant essentiel du circuit de lubrification moteur..."
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
                    placeholder="Dans le système de lubrification..."
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content_html">Contenu HTML enrichi</Label>
                  <Textarea
                    id="content_html"
                    name="content_html"
                    placeholder="<article>...</article>"
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
                    placeholder="Élément filtrant : papier plissé&#10;Joint torique : étanchéité&#10;Clapet anti-retour"
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
                    placeholder="Filtre à huile ≠ Filtre à air&#10;Cartouche ≠ Filtre vissé"
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
                    placeholder="voyant-huile-allume, bruit-cliquetis-moteur"
                  />
                  <p className="text-sm text-muted-foreground">
                    Slugs R5 séparés par des virgules
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SEO Tab */}
          <TabsContent value="seo" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Publication</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch id="is_published" name="is_published" />
                  <Label htmlFor="is_published">Publier immédiatement</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Si désactivé, la page sera créée en brouillon
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-end gap-4 mt-6">
          <Button variant="outline" type="button" asChild>
            <Link to="/admin/seo-hub/content/references">Annuler</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Création..." : "Créer la référence"}
          </Button>
        </div>
      </Form>
    </div>
  );
}
