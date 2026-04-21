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
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
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

// ── Types éditoriaux R7 ──────────────────────────────────
// Sources of truth : BrandEditorialPayloadSchema + sub-schemas (Zod backend)
// backend/src/config/brand-rag-frontmatter.schema.ts
type FaqEntry = { q: string; a: string };
type IssueEntry = { symptom: string; cause?: string; fix_hint?: string };
type MaintTipEntry = {
  part: string;
  interval_km?: number;
  interval_years?: number;
  note?: string;
};

// Limits : voir brand-rag-frontmatter.schema.ts (z.string().min().max())
const LIMITS = {
  faq: { max: 15, q: { min: 5, max: 200 }, a: { min: 20, max: 1000 } },
  issue: {
    max: 20,
    symptom: { min: 5, max: 200 },
    cause: { min: 5, max: 300 },
    fix_hint: { min: 5, max: 300 },
  },
  maint: {
    max: 20,
    part: { min: 1, max: 80 },
    note: { min: 0, max: 300 },
  },
} as const;

// Helpers char counter : affiche "42/200" en rouge hors bornes.
function CharCount({
  value,
  min,
  max,
}: {
  value: string | undefined;
  min: number;
  max: number;
}) {
  const n = (value ?? "").length;
  const out = n > 0 && (n < min || n > max);
  return (
    <span
      className={`text-xs tabular-nums ${
        out ? "text-red-600 font-semibold" : "text-gray-500"
      }`}
      aria-live="polite"
    >
      {n}/{max}
      {min > 0 && n > 0 && n < min ? ` · min ${min}` : ""}
    </span>
  );
}

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

  // Éditeurs de listes (prefill depuis loader). Sérialisés en hidden inputs
  // au submit (mêmes noms de champs côté backend : faq/common_issues/maintenance_tips).
  const [faq, setFaq] = useState<FaqEntry[]>(
    (editorial?.faq ?? []) as FaqEntry[],
  );
  const [issues, setIssues] = useState<IssueEntry[]>(
    (editorial?.common_issues ?? []) as IssueEntry[],
  );
  const [maint, setMaint] = useState<MaintTipEntry[]>(
    (editorial?.maintenance_tips ?? []) as MaintTipEntry[],
  );
  const [showJsonPreview, setShowJsonPreview] = useState(false);

  // Update helpers : immutable patches sur un index donné.
  const updateFaq = (i: number, patch: Partial<FaqEntry>) =>
    setFaq((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    );
  const updateIssue = (i: number, patch: Partial<IssueEntry>) =>
    setIssues((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    );
  const updateMaint = (i: number, patch: Partial<MaintTipEntry>) =>
    setMaint((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    );

  // Payload JSON complet prévisualisé / envoyé en submit.
  const editorialPayload = {
    faq,
    common_issues: issues,
    maintenance_tips: maint,
  };
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

            {/* Hidden inputs : sérialisation du state pour le submit
                — le backend attend ces champs au format JSON string. */}
            <input type="hidden" name="faq" value={JSON.stringify(faq)} />
            <input
              type="hidden"
              name="common_issues"
              value={JSON.stringify(issues)}
            />
            <input
              type="hidden"
              name="maintenance_tips"
              value={JSON.stringify(maint)}
            />

            {/* ── FAQ ─────────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  ❓ FAQ
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    {faq.length}/{LIMITS.faq.max} entrées — q:{" "}
                    {LIMITS.faq.q.min}–{LIMITS.faq.q.max} car · a:{" "}
                    {LIMITS.faq.a.min}–{LIMITS.faq.a.max} car
                  </span>
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={faq.length >= LIMITS.faq.max}
                  onClick={() => setFaq((prev) => [...prev, { q: "", a: "" }])}
                >
                  <Plus className="h-4 w-4 mr-1" /> Ajouter une FAQ
                </Button>
              </div>
              {faq.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                  Aucune FAQ. Cliquez « Ajouter une FAQ » pour démarrer.
                </div>
              )}
              {faq.map((entry, i) => (
                <div
                  key={`faq-${i}`}
                  className="rounded-lg border border-gray-200 bg-white p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-500">
                      Entrée #{i + 1}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setFaq((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      aria-label={`Supprimer FAQ ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor={`faq-q-${i}`}
                        className="text-xs text-gray-600"
                      >
                        Question
                      </Label>
                      <CharCount
                        value={entry.q}
                        min={LIMITS.faq.q.min}
                        max={LIMITS.faq.q.max}
                      />
                    </div>
                    <Input
                      id={`faq-q-${i}`}
                      value={entry.q}
                      onChange={(e) => updateFaq(i, { q: e.target.value })}
                      maxLength={LIMITS.faq.q.max}
                      placeholder="Question marque-spécifique ?"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor={`faq-a-${i}`}
                        className="text-xs text-gray-600"
                      >
                        Réponse
                      </Label>
                      <CharCount
                        value={entry.a}
                        min={LIMITS.faq.a.min}
                        max={LIMITS.faq.a.max}
                      />
                    </div>
                    <Textarea
                      id={`faq-a-${i}`}
                      value={entry.a}
                      onChange={(e) => updateFaq(i, { a: e.target.value })}
                      maxLength={LIMITS.faq.a.max}
                      rows={3}
                      placeholder="Réponse actionnable ≥ 20 caractères."
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* ── Problèmes courants ──────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  🔧 Problèmes courants
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    {issues.length}/{LIMITS.issue.max} entrées
                  </span>
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={issues.length >= LIMITS.issue.max}
                  onClick={() =>
                    setIssues((prev) => [...prev, { symptom: "" }])
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Ajouter un problème
                </Button>
              </div>
              {issues.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                  Aucun problème connu. Ajoutez un symptôme pour démarrer.
                </div>
              )}
              {issues.map((entry, i) => (
                <div
                  key={`issue-${i}`}
                  className="rounded-lg border border-gray-200 bg-white p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-500">
                      Problème #{i + 1}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setIssues((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      aria-label={`Supprimer problème ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor={`issue-symptom-${i}`}
                        className="text-xs text-gray-600"
                      >
                        Symptôme <span className="text-red-500">*</span>
                      </Label>
                      <CharCount
                        value={entry.symptom}
                        min={LIMITS.issue.symptom.min}
                        max={LIMITS.issue.symptom.max}
                      />
                    </div>
                    <Input
                      id={`issue-symptom-${i}`}
                      value={entry.symptom}
                      onChange={(e) =>
                        updateIssue(i, { symptom: e.target.value })
                      }
                      maxLength={LIMITS.issue.symptom.max}
                      placeholder="Consommation d'huile anormale 1.4 TBi"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor={`issue-cause-${i}`}
                          className="text-xs text-gray-600"
                        >
                          Cause (optionnel)
                        </Label>
                        <CharCount
                          value={entry.cause}
                          min={LIMITS.issue.cause.min}
                          max={LIMITS.issue.cause.max}
                        />
                      </div>
                      <Textarea
                        id={`issue-cause-${i}`}
                        value={entry.cause ?? ""}
                        onChange={(e) =>
                          updateIssue(i, {
                            cause: e.target.value || undefined,
                          })
                        }
                        maxLength={LIMITS.issue.cause.max}
                        rows={2}
                        placeholder="Usure segmentation moteur"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor={`issue-fix-${i}`}
                          className="text-xs text-gray-600"
                        >
                          Piste de résolution (optionnel)
                        </Label>
                        <CharCount
                          value={entry.fix_hint}
                          min={LIMITS.issue.fix_hint.min}
                          max={LIMITS.issue.fix_hint.max}
                        />
                      </div>
                      <Textarea
                        id={`issue-fix-${i}`}
                        value={entry.fix_hint ?? ""}
                        onChange={(e) =>
                          updateIssue(i, {
                            fix_hint: e.target.value || undefined,
                          })
                        }
                        maxLength={LIMITS.issue.fix_hint.max}
                        rows={2}
                        placeholder="Décalaminage préventif à 80 000 km"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Intervalles d'entretien ─────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  🛠️ Intervalles d&apos;entretien
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    {maint.length}/{LIMITS.maint.max} entrées
                  </span>
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={maint.length >= LIMITS.maint.max}
                  onClick={() => setMaint((prev) => [...prev, { part: "" }])}
                >
                  <Plus className="h-4 w-4 mr-1" /> Ajouter un intervalle
                </Button>
              </div>
              {maint.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                  Aucun intervalle d&apos;entretien. Ajoutez une pièce pour
                  démarrer.
                </div>
              )}
              {maint.map((entry, i) => (
                <div
                  key={`maint-${i}`}
                  className="rounded-lg border border-gray-200 bg-white p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-500">
                      Intervalle #{i + 1}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setMaint((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      aria-label={`Supprimer intervalle ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor={`maint-part-${i}`}
                        className="text-xs text-gray-600"
                      >
                        Pièce <span className="text-red-500">*</span>
                      </Label>
                      <CharCount
                        value={entry.part}
                        min={LIMITS.maint.part.min}
                        max={LIMITS.maint.part.max}
                      />
                    </div>
                    <Input
                      id={`maint-part-${i}`}
                      value={entry.part}
                      onChange={(e) => updateMaint(i, { part: e.target.value })}
                      maxLength={LIMITS.maint.part.max}
                      placeholder="Courroie de distribution Multiair"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label
                        htmlFor={`maint-km-${i}`}
                        className="text-xs text-gray-600"
                      >
                        Intervalle (km)
                      </Label>
                      <Input
                        id={`maint-km-${i}`}
                        type="number"
                        min={1}
                        value={entry.interval_km ?? ""}
                        onChange={(e) =>
                          updateMaint(i, {
                            interval_km: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                        placeholder="120000"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor={`maint-years-${i}`}
                        className="text-xs text-gray-600"
                      >
                        Intervalle (années)
                      </Label>
                      <Input
                        id={`maint-years-${i}`}
                        type="number"
                        min={1}
                        value={entry.interval_years ?? ""}
                        onChange={(e) =>
                          updateMaint(i, {
                            interval_years: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                        placeholder="5"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor={`maint-note-${i}`}
                        className="text-xs text-gray-600"
                      >
                        Note (optionnel)
                      </Label>
                      <CharCount
                        value={entry.note}
                        min={0}
                        max={LIMITS.maint.note.max}
                      />
                    </div>
                    <Textarea
                      id={`maint-note-${i}`}
                      value={entry.note ?? ""}
                      onChange={(e) =>
                        updateMaint(i, { note: e.target.value || undefined })
                      }
                      maxLength={LIMITS.maint.note.max}
                      rows={2}
                      placeholder="Incluant galets tendeurs et pompe à eau"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* ── Preview JSON (debug) ────────────────────── */}
            <div className="rounded-lg border border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => setShowJsonPreview((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                aria-expanded={showJsonPreview}
              >
                <span>
                  🔍 Prévisualisation du payload JSON envoyé au backend
                </span>
                {showJsonPreview ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {showJsonPreview && (
                <pre className="m-0 px-4 py-3 text-xs font-mono overflow-auto max-h-64 border-t border-gray-200 bg-white">
                  {JSON.stringify(editorialPayload, null, 2)}
                </pre>
              )}
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
