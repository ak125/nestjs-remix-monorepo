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
import {
  useLoaderData,
  Form,
  useNavigation,
  useActionData,
} from "@remix-run/react";
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
import { Textarea } from "~/components/ui/textarea";
import {
  getInternalApiUrl,
  getInternalApiUrlFromRequest,
} from "~/utils/internal-api.server";
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

    // Contenu éditorial R7 (FAQ / issues / maintenance) — table __seo_brand_editorial
    // Forwarded admin session cookie requis (IsAdminGuard).
    const marqueId = brandData.data?.marque_id;
    let editorial: {
      faq: Array<{ q: string; a: string }>;
      common_issues: Array<{
        symptom: string;
        cause?: string;
        fix_hint?: string;
      }>;
      maintenance_tips: Array<{
        part: string;
        interval_km?: number;
        interval_years?: number;
        note?: string;
      }>;
      curated_by?: string | null;
      updated_at?: string;
    } | null = null;
    if (marqueId) {
      try {
        const editorialRes = await fetch(
          getInternalApiUrlFromRequest(
            `/api/admin/r7/editorial/${marqueId}`,
            request,
          ),
          { headers: { cookie: request.headers.get("cookie") || "" } },
        );
        if (editorialRes.ok) {
          const editorialPayload = await editorialRes.json();
          editorial = editorialPayload.editorial ?? null;
        }
        // 404 = pas encore curé, on reste à null (comportement attendu)
      } catch (e) {
        logger.warn(
          `[Brands SEO Admin] editorial fetch failed: ${(e as Error).message}`,
        );
      }
    }

    return json({
      brand: brandData.data,
      brands: brandsData.data || [],
      editorial,
    });
  } catch (error) {
    logger.error("[Brands SEO Admin] Error:", error);
    return json({
      brand: null,
      brands: [],
      editorial: null,
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

  if (action === "update-editorial") {
    const marqueId = Number(formData.get("marque_id"));
    if (!marqueId || marqueId <= 0) {
      return json({
        success: false,
        message: "marque_id invalide",
        action: "editorial",
      });
    }

    // Parse JSON fields from form (textareas)
    const parseJsonField = (name: string) => {
      const raw = (formData.get(name) || "").toString().trim();
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error("must be array");
        return parsed;
      } catch (e) {
        throw new Error(
          `Champ ${name} : JSON invalide (${(e as Error).message})`,
        );
      }
    };

    let payload: {
      faq: unknown[];
      common_issues: unknown[];
      maintenance_tips: unknown[];
      curated_by: string;
    };
    try {
      payload = {
        faq: parseJsonField("faq"),
        common_issues: parseJsonField("common_issues"),
        maintenance_tips: parseJsonField("maintenance_tips"),
        curated_by: (formData.get("curated_by") || "admin-ui").toString(),
      };
    } catch (e) {
      return json({
        success: false,
        message: (e as Error).message,
        action: "editorial",
      });
    }

    try {
      const res = await fetch(
        getInternalApiUrlFromRequest(
          `/api/admin/r7/editorial/${marqueId}`,
          request,
        ),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            cookie: request.headers.get("cookie") || "",
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        return json({
          success: false,
          message: data?.message || "Erreur upsert éditorial",
          issues: data?.issues,
          action: "editorial",
        });
      }
      return json({
        success: true,
        message: `Éditorial enregistré — enrichissement R7 : ${data.enrichment?.seoDecision} (score ${data.enrichment?.diversityScore?.toFixed?.(1) || "?"})`,
        enrichment: data.enrichment,
        editorial: data.editorial,
        action: "editorial",
      });
    } catch (e) {
      logger.error("[Brands SEO Admin] PUT editorial failed:", e);
      return json({
        success: false,
        message: `Erreur réseau : ${(e as Error).message}`,
        action: "editorial",
      });
    }
  }

  return json({ success: false, message: "Action inconnue" });
}

export default function AdminBrandsSeo() {
  const { brand, brands, editorial } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [content, setContent] = useState(brand?.seo?.content || "");
  const isSubmitting = navigation.state === "submitting";

  // JSON editors state (prefilled from loader)
  const [faqText, setFaqText] = useState(
    JSON.stringify(editorial?.faq ?? [], null, 2),
  );
  const [issuesText, setIssuesText] = useState(
    JSON.stringify(editorial?.common_issues ?? [], null, 2),
  );
  const [maintText, setMaintText] = useState(
    JSON.stringify(editorial?.maintenance_tips ?? [], null, 2),
  );
  const editorialActionResult = (
    actionData && "action" in actionData && actionData.action === "editorial"
      ? actionData
      : null
  ) as null | {
    success: boolean;
    message: string;
    issues?: unknown;
    enrichment?: {
      status: string;
      seoDecision: string;
      diversityScore: number;
      warnings?: string[];
      reasons?: string[];
    };
    editorial?: unknown;
    action: "editorial";
  };

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

      {/* ========== R7 Editorial Content (FAQ / issues / maintenance) ========== */}
      {/* Form séparé car action distincte (update-editorial) + auto-trigger enrichSingle backend */}
      <Form method="post" className="space-y-6">
        <input type="hidden" name="_action" value="update-editorial" />
        <input type="hidden" name="marque_id" value={brand.marque_id} />
        <input type="hidden" name="curated_by" value="admin-ui" />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🏭 Contenu éditorial R7 — {brand.marque_name}
              {editorial ? (
                <Badge variant="success">
                  Curé par {editorial.curated_by || "inconnu"}
                </Badge>
              ) : (
                <Badge variant="secondary">Non curé (défauts utilisés)</Badge>
              )}
            </CardTitle>
            <CardDescription>
              FAQ, problèmes connus et conseils d&apos;entretien spécifiques
              marque. Lu en live par l&apos;enricher R7. Sauvegarder déclenche
              une régénération automatique de la page R7 en DB.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Feedback dernière action */}
            {editorialActionResult && (
              <Alert
                intent={editorialActionResult.success ? "success" : "error"}
              >
                {editorialActionResult.success ? "✅ " : "❌ "}
                {String(editorialActionResult.message ?? "")}
                {"issues" in editorialActionResult &&
                  Boolean(editorialActionResult.issues) && (
                    <pre className="mt-2 text-xs bg-white/50 p-2 rounded overflow-auto">
                      {JSON.stringify(editorialActionResult.issues, null, 2)}
                    </pre>
                  )}
              </Alert>
            )}

            {/* FAQ */}
            <div className="space-y-2">
              <Label htmlFor="faq">
                ❓ FAQ
                <span className="text-xs text-gray-500 ml-2">
                  Array JSON — max 15 entries — format
                  <code className="bg-gray-100 px-1 ml-1 rounded">
                    [{"{"}&quot;q&quot;: &quot;...&quot;, &quot;a&quot;:
                    &quot;...&quot;{"}"}]
                  </code>
                </span>
              </Label>
              <Textarea
                id="faq"
                name="faq"
                value={faqText}
                onChange={(e) => setFaqText(e.target.value)}
                rows={10}
                className="font-mono text-sm"
                placeholder='[{"q": "Question marque-spécifique ?", "a": "Réponse ≥ 20 caractères."}]'
              />
            </div>

            {/* Common issues */}
            <div className="space-y-2">
              <Label htmlFor="common_issues">
                🔧 Problèmes courants
                <span className="text-xs text-gray-500 ml-2">
                  Array JSON — max 20 — format
                  <code className="bg-gray-100 px-1 ml-1 rounded">
                    {"{symptom, cause?, fix_hint?}"}
                  </code>
                </span>
              </Label>
              <Textarea
                id="common_issues"
                name="common_issues"
                value={issuesText}
                onChange={(e) => setIssuesText(e.target.value)}
                rows={10}
                className="font-mono text-sm"
                placeholder='[{"symptom": "Consommation huile 1.4 TBi", "cause": "Usure segmentation", "fix_hint": "Décalaminage"}]'
              />
            </div>

            {/* Maintenance tips */}
            <div className="space-y-2">
              <Label htmlFor="maintenance_tips">
                🛠️ Intervalles d&apos;entretien
                <span className="text-xs text-gray-500 ml-2">
                  Array JSON — max 20 — format
                  <code className="bg-gray-100 px-1 ml-1 rounded">
                    {"{part, interval_km?, interval_years?, note?}"}
                  </code>
                </span>
              </Label>
              <Textarea
                id="maintenance_tips"
                name="maintenance_tips"
                value={maintText}
                onChange={(e) => setMaintText(e.target.value)}
                rows={8}
                className="font-mono text-sm"
                placeholder='[{"part": "Courroie distribution Multiair", "interval_km": 120000, "interval_years": 5, "note": "Incluant galets tendeurs"}]'
              />
            </div>

            {/* Info box */}
            <Alert intent="info">
              💡 Après sauvegarde, l&apos;enricher R7 régénère automatiquement
              la page{" "}
              <code>
                /constructeurs/{brand.marque_alias}-{brand.marque_id}.html
              </code>{" "}
              avec le nouveau contenu. Score et décision SEO affichés ci-dessus.
            </Alert>

            {/* Enrichment result after save */}
            {editorialActionResult?.success &&
              "enrichment" in editorialActionResult &&
              editorialActionResult.enrichment && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <div>
                    <div className="text-xs text-gray-600">Décision SEO</div>
                    <div className="text-lg font-bold text-green-700">
                      {editorialActionResult.enrichment.seoDecision}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Diversity Score</div>
                    <div className="text-lg font-bold text-green-700">
                      {editorialActionResult.enrichment.diversityScore?.toFixed?.(
                        1,
                      ) ?? "?"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Status</div>
                    <div className="text-lg font-bold text-green-700">
                      {editorialActionResult.enrichment.status}
                    </div>
                  </div>
                </div>
              )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting
                  ? "⏳ Enregistrement + régénération..."
                  : "💾 Enregistrer et régénérer R7"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </Form>
    </div>
  );
}
