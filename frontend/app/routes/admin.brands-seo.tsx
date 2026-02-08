/**
 * 🏷️ ADMIN MARQUES SEO
 *
 * Page d'administration pour gérer le contenu SEO des marques
 * Table: __seo_marque
 * Éditeur: TipTap WYSIWYG
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Form, useNavigation } from "@remix-run/react";
import { useState, lazy, Suspense } from "react";
import { HtmlContent } from "~/components/seo/HtmlContent";
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
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () => createNoIndexMeta("Brands SEO - Admin");

// Lazy load TipTap editor to reduce initial bundle size (~370KB -> ~50KB)
const RichTextEditor = lazy(() =>
  import("~/components/RichTextEditor").then((m) => ({
    default: m.RichTextEditor,
  })),
);

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const brandSlug = url.searchParams.get("brand") || "renault";

  try {
    // Récupérer données marque avec SEO
    const brandRes = await fetch(
      `${getInternalApiUrl("")}/api/brands/brand/${brandSlug}`,
    );
    const brandData = await brandRes.json();

    if (!brandData.success) {
      throw new Error("Marque introuvable");
    }

    // Liste toutes les marques pour sélecteur
    const brandsRes = await fetch(
      `${getInternalApiUrl("")}/api/brands?limit=100`,
    );
    const brandsData = await brandsRes.json();

    return json({
      brand: brandData.data,
      brands: brandsData.data || [],
    });
  } catch (error) {
    logger.error("[Brands SEO Admin] Error:", error);
    return json({
      brand: null,
      brands: [],
      error: "Erreur chargement données",
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("_action");

  if (action === "update-seo") {
    // TODO: Implémenter API update
    return json({ success: true, message: "SEO mis à jour" });
  }

  return json({ success: false, message: "Action inconnue" });
}

export default function AdminBrandsSeo() {
  const { brand, brands } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [content, setContent] = useState(brand?.seo?.content || "");
  const isSubmitting = navigation.state === "submitting";

  if (!brand) {
    return (
      <div className="container mx-auto p-6">
        <Alert intent="error">❌ Marque introuvable</Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🏷️ SEO Marques</h1>
          <p className="text-gray-600">
            Gérer le contenu SEO des pages marque (table __seo_marque)
          </p>
        </div>
        <Badge variant="secondary">{brands.length} marques</Badge>
      </div>

      {/* Sélecteur de marque */}
      <Card>
        <CardHeader>
          <CardTitle>Sélectionner une marque</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {brands.slice(0, 20).map((b: any) => (
              <a
                key={b.marque_id}
                href={`/admin/brands-seo?brand=${b.marque_alias}`}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  b.marque_id === brand.marque_id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-blue-300"
                }`}
              >
                <div className="font-semibold">{b.marque_name}</div>
                <div className="text-xs text-gray-500">{b.marque_alias}</div>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Formulaire SEO */}
      <Form method="post" className="space-y-6">
        <input type="hidden" name="_action" value="update-seo" />
        <input type="hidden" name="marque_id" value={brand.marque_id} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ✏️ Éditer SEO - {brand.marque_name}
              {brand.seo ? (
                <Badge variant="success">SEO Custom</Badge>
              ) : (
                <Badge variant="secondary">SEO par défaut</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Optimisez le référencement de la page marque
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="sm_title">
                📋 Titre Meta
                <span className="text-xs text-gray-500 ml-2">
                  (Variables: #VMarque#, #PrixPasCher#)
                </span>
              </Label>
              <Input
                id="sm_title"
                name="sm_title"
                defaultValue={
                  brand.seo?.title ||
                  `Pièce #VMarque# #PrixPasCher# pour tous les modèles de véhicule`
                }
                maxLength={100}
                className="font-medium"
              />
              <p className="text-xs text-gray-500">
                ✨ Exemple: "Pièce RENAULT à prix pas cher pour tous les modèles
                de véhicule"
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="sm_descrip">📄 Description Meta</Label>
              <Input
                id="sm_descrip"
                name="sm_descrip"
                defaultValue={brand.seo?.description || ""}
                maxLength={200}
              />
            </div>

            {/* H1 */}
            <div className="space-y-2">
              <Label htmlFor="sm_h1">🎯 Titre H1</Label>
              <Input
                id="sm_h1"
                name="sm_h1"
                defaultValue={
                  brand.seo?.h1 || `Modèles du constructeur #VMarque#`
                }
                maxLength={100}
              />
            </div>

            {/* Content - Éditeur riche */}
            <div className="space-y-2">
              <Label>
                📝 Contenu Riche
                <span className="text-xs text-gray-500 ml-2">
                  (Utilisez{" "}
                  <code className="bg-gray-100 px-1 rounded">&lt;b&gt;</code>{" "}
                  pour gras)
                </span>
              </Label>
              <Suspense
                fallback={
                  <div className="border rounded-lg p-4 bg-gray-50 animate-pulse">
                    <div className="h-8 bg-gray-200 rounded mb-4"></div>
                    <div className="h-32 bg-gray-200 rounded"></div>
                  </div>
                }
              >
                <RichTextEditor
                  name="sm_content"
                  content={content}
                  onChange={setContent}
                  placeholder={`Écrivez le contenu SEO pour ${brand.marque_name}...`}
                />
              </Suspense>
              <Alert intent="info">
                💡 Le contenu supporte le HTML basique: <strong>gras</strong>,{" "}
                <em>italique</em>, listes
              </Alert>
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <Label htmlFor="sm_keywords">🏷️ Mots-clés (optionnel)</Label>
              <Input
                id="sm_keywords"
                name="sm_keywords"
                defaultValue={brand.seo?.keywords || ""}
                placeholder="pièces auto renault, freinage renault, distribution renault"
              />
            </div>

            {/* Prévisualisation */}
            <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed">
              <h3 className="font-semibold mb-2">👁️ Prévisualisation</h3>
              <div className="prose prose-sm max-w-none">
                <h1 className="text-2xl font-bold text-gray-900">
                  {brand.seo?.h1 ||
                    `Modèles du constructeur ${brand.marque_name}`}
                </h1>
                <HtmlContent
                  html={content || brand.seo?.content || "<p>Aucun contenu</p>"}
                  className="mt-4 text-gray-700"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? "⏳ Enregistrement..." : "💾 Enregistrer"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.location.reload()}
              >
                🔄 Réinitialiser
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Statistiques SEO actuelles */}
        {brand.seo && (
          <Card>
            <CardHeader>
              <CardTitle>📊 Statistiques SEO</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600">Titre</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {brand.seo.title?.length || 0}
                  </div>
                  <div className="text-xs text-gray-500">caractères</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600">Description</div>
                  <div className="text-2xl font-bold text-green-600">
                    {brand.seo.description?.length || 0}
                  </div>
                  <div className="text-xs text-gray-500">caractères</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="text-sm text-gray-600">Contenu HTML</div>
                  <div className="text-2xl font-bold text-purple-600">
                    {brand.seo.content?.length || 0}
                  </div>
                  <div className="text-xs text-gray-500">caractères</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <div className="text-sm text-gray-600">Contenu Texte</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {brand.seo.contentText?.length || 0}
                  </div>
                  <div className="text-xs text-gray-500">caractères</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </Form>
    </div>
  );
}
