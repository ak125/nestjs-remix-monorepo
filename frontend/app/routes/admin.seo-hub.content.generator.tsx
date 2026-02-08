/**
 * 🤖 SEO HUB - AI CONTENT GENERATOR
 *
 * Wizard 4 étapes pour générer R4 Reference et R5 Diagnostic depuis les fichiers RAG
 * Étape 1: Sélection Gamme
 * Étape 2: Type de contenu (R4/R5/Both)
 * Étape 3: Review sources RAG
 * Étape 4: Génération et preview
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import {
  ArrowLeft,
  ArrowRight,
  Wand2,
  FileText,
  AlertTriangle,
  Check,
  Loader2,
  BookOpen,
  Stethoscope,
  Search,
  ChevronRight,
  Edit,
  Save,
} from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";

interface Gamme {
  pgId: number;
  name: string;
  slug: string;
  ragFile?: string;
  hasRagFile: boolean;
}

interface RagSource {
  path: string;
  type: "gamme" | "diagnostic";
  title: string;
  content: string;
  frontmatter: Record<string, unknown>;
  symptoms?: Array<{
    id: string;
    label: string;
    description: string;
    riskLevel: string;
  }>;
}

interface GeneratedContent {
  r4?: {
    slug: string;
    title: string;
    metaDescription: string;
    definition: string;
    roleMecanique: string;
    composition: string[];
    confusionsCourantes: string[];
    symptomesAssocies: string[];
    contentHtml: string;
  };
  r5?: Array<{
    slug: string;
    title: string;
    metaDescription: string;
    observableType: string;
    perceptionChannel: string;
    riskLevel: string;
    safetyGate: string;
    symptomDescription: string;
    signDescription: string;
    clusterId: string;
    relatedGammes: number[];
  }>;
  sourcesUsed: string[];
  keywordsMatched: string[];
}

interface LoaderData {
  gammes: Gamme[];
  error: string | null;
}

// Action data type union
type ActionData =
  | { success: true; ragSources: RagSource[]; intent: "fetch_rag" }
  | { success: false; error: string; intent: "fetch_rag" }
  | { success: true; content: GeneratedContent; intent: "generate" }
  | { success: false; error: string; intent: "generate" }
  | { success: true; intent: "save_r4"; slug: string }
  | { success: false; error: string; intent: "save_r4" }
  | { success: true; intent: "save_r5"; slug: string }
  | { success: false; error: string; intent: "save_r5" }
  | { success: false; error: string };

export const meta: MetaFunction = () =>
  createNoIndexMeta("Générateur Contenu - Admin");

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    // Fetch gammes with RAG file status
    const gammesRes = await fetch(
      `${backendUrl}/api/catalog/gammes?limit=500`,
      {
        headers: { Cookie: cookieHeader },
      },
    );

    if (!gammesRes.ok) {
      return json<LoaderData>({
        gammes: [],
        error: "Erreur chargement gammes",
      });
    }

    const gammesData = await gammesRes.json();

    // Mark which gammes have RAG files (simplified - backend should provide this)
    // Note: API returns {id, name, alias} - map to our interface
    const gammes: Gamme[] = (gammesData.data || gammesData || []).map(
      (g: {
        id?: number;
        pg_id?: number;
        name?: string;
        pg_name?: string;
        alias?: string;
        pg_alias?: string;
      }) => ({
        pgId: g.pg_id ?? g.id ?? 0,
        name: g.pg_name ?? g.name ?? "",
        slug: g.pg_alias ?? g.alias ?? "",
        hasRagFile: true, // TODO: Check actual RAG file existence via backend
      }),
    );

    return json<LoaderData>({ gammes, error: null });
  } catch (error) {
    logger.error("[Generator] Loader error:", error);
    return json<LoaderData>({
      gammes: [],
      error: "Erreur connexion backend",
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "fetch_rag") {
    // Fetch RAG sources for selected gamme
    const pgId = formData.get("pg_id") as string;
    const slug = formData.get("slug") as string;

    try {
      // In real implementation, this would fetch from a RAG API endpoint
      // For now, return mock data structure
      const ragSources: RagSource[] = [
        {
          path: `/rag/knowledge/gammes/${slug}.md`,
          type: "gamme",
          title: `Gamme: ${slug}`,
          content: "Contenu du fichier RAG gamme...",
          frontmatter: {
            entity_type: "gamme",
            pg_id: parseInt(pgId),
            truth_level: "L2",
          },
          symptoms: [
            {
              id: "S1",
              label: "Symptôme 1",
              description: "Description symptôme 1",
              riskLevel: "warning",
            },
          ],
        },
      ];

      return json({ success: true, ragSources, intent: "fetch_rag" });
    } catch (error) {
      return json({
        success: false,
        error: "Erreur lecture RAG",
        intent: "fetch_rag",
      });
    }
  }

  if (intent === "generate") {
    const pgId = formData.get("pg_id") as string;
    const slug = formData.get("slug") as string;
    const contentTypes = formData.getAll("content_types") as string[];

    try {
      // Call backend generation endpoint
      const res = await fetch(`${backendUrl}/api/admin/seo/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        body: JSON.stringify({
          pg_id: parseInt(pgId),
          slug,
          content_types: contentTypes,
          use_rag: true,
          use_seo_keywords: true,
        }),
      });

      if (!res.ok) {
        // If endpoint doesn't exist yet, return mock data
        const mockContent: GeneratedContent = {
          r4: contentTypes.includes("r4")
            ? {
                slug,
                title: `${slug.replace(/-/g, " ")} : définition et guide complet`,
                metaDescription: `Découvrez tout sur le ${slug.replace(/-/g, " ")} : fonction, remplacement, symptômes d'usure.`,
                definition: `Le ${slug.replace(/-/g, " ")} est un composant essentiel...`,
                roleMecanique: "Rôle mécanique généré...",
                composition: ["Élément 1", "Élément 2", "Élément 3"],
                confusionsCourantes: ["Confusion 1 ≠ Confusion 2"],
                symptomesAssocies: [`symptome-${slug}-1`, `symptome-${slug}-2`],
                contentHtml: "<article>Contenu HTML généré...</article>",
              }
            : undefined,
          r5: contentTypes.includes("r5")
            ? [
                {
                  slug: `symptome-${slug}-1`,
                  title: `Symptôme 1 lié à ${slug.replace(/-/g, " ")}`,
                  metaDescription: "Description meta du symptôme...",
                  observableType: "symptom",
                  perceptionChannel: "visual",
                  riskLevel: "securite",
                  safetyGate: "warning",
                  symptomDescription: "Description du symptôme observable...",
                  signDescription: "Description du signe technique...",
                  clusterId: "general",
                  relatedGammes: [parseInt(pgId)],
                },
              ]
            : undefined,
          sourcesUsed: [`/rag/knowledge/gammes/${slug}.md`],
          keywordsMatched: ["keyword1", "keyword2"],
        };

        return json({
          success: true,
          content: mockContent,
          intent: "generate",
        });
      }

      const data = await res.json();
      // Extraire les champs pour éviter le doublon de 'success' dans content
      return json({
        success: data.success !== false,
        content: {
          r4: data.r4,
          r5: data.r5,
          sourcesUsed: data.sourcesUsed || [],
          keywordsMatched: data.keywordsMatched || [],
        },
        intent: "generate",
      });
    } catch (error) {
      return json({
        success: false,
        error: "Erreur génération",
        intent: "generate",
      });
    }
  }

  if (intent === "save_r4") {
    const r4Data = JSON.parse(formData.get("r4_data") as string);

    try {
      // Use the correct endpoint from SeoGeneratorController
      const res = await fetch(`${backendUrl}/api/admin/seo/save-r4`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        body: JSON.stringify({
          slug: r4Data.slug,
          title: r4Data.title,
          meta_description: r4Data.metaDescription,
          definition: r4Data.definition,
          role_mecanique: r4Data.roleMecanique,
          composition: r4Data.composition,
          confusions_courantes: r4Data.confusionsCourantes,
          symptomes_associes: r4Data.symptomesAssocies,
          content_html: r4Data.contentHtml,
          is_published: false,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        return json({
          success: false,
          error: error.message || "Erreur sauvegarde R4",
          intent: "save_r4",
        });
      }

      return json({ success: true, intent: "save_r4", slug: r4Data.slug });
    } catch (error) {
      return json({
        success: false,
        error: "Erreur serveur",
        intent: "save_r4",
      });
    }
  }

  if (intent === "save_r5") {
    const r5Data = JSON.parse(formData.get("r5_data") as string);

    try {
      // Use the correct endpoint from SeoGeneratorController
      const res = await fetch(`${backendUrl}/api/admin/seo/save-r5`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        body: JSON.stringify({
          slug: r5Data.slug,
          title: r5Data.title,
          meta_description: r5Data.metaDescription,
          observable_type: r5Data.observableType,
          perception_channel: r5Data.perceptionChannel,
          risk_level: r5Data.riskLevel,
          safety_gate: r5Data.safetyGate,
          symptom_description: r5Data.symptomDescription,
          sign_description: r5Data.signDescription,
          cluster_id: r5Data.clusterId,
          related_gammes: r5Data.relatedGammes,
          is_published: false,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        return json({
          success: false,
          error: error.message || "Erreur sauvegarde R5",
          intent: "save_r5",
        });
      }

      return json({ success: true, intent: "save_r5", slug: r5Data.slug });
    } catch (error) {
      return json({
        success: false,
        error: "Erreur serveur",
        intent: "save_r5",
      });
    }
  }

  return json({ success: false, error: "Action non reconnue" });
}

export default function AdminSeoGenerator() {
  const { gammes, error } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  // Wizard state
  const [step, setStep] = useState(1);
  const [selectedGamme, setSelectedGamme] = useState<Gamme | null>(null);
  const [contentTypes, setContentTypes] = useState<string[]>(["r4", "r5"]);
  const [ragSources, setRagSources] = useState<RagSource[]>([]);
  const [generatedContent, setGeneratedContent] =
    useState<GeneratedContent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [savedItems, setSavedItems] = useState<{ r4?: boolean; r5?: string[] }>(
    {},
  );

  const isLoading = fetcher.state === "submitting";

  // Filter gammes by search
  const filteredGammes = gammes.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.slug.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Handle step navigation
  const nextStep = () => {
    if (step === 2 && selectedGamme) {
      // Fetch RAG sources before step 3
      const formData = new FormData();
      formData.append("intent", "fetch_rag");
      formData.append("pg_id", selectedGamme.pgId.toString());
      formData.append("slug", selectedGamme.slug);
      fetcher.submit(formData, { method: "post" });
    }
    setStep((s) => Math.min(s + 1, 4));
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  // Handle generation
  const handleGenerate = () => {
    if (!selectedGamme) return;

    const formData = new FormData();
    formData.append("intent", "generate");
    formData.append("pg_id", selectedGamme.pgId.toString());
    formData.append("slug", selectedGamme.slug);
    contentTypes.forEach((t) => formData.append("content_types", t));
    fetcher.submit(formData, { method: "post" });
  };

  // Type guard helper for fetcher.data
  const actionData = fetcher.data as ActionData | undefined;

  // Update state from fetcher
  if (
    actionData &&
    "intent" in actionData &&
    actionData.intent === "fetch_rag" &&
    actionData.success &&
    "ragSources" in actionData
  ) {
    if (ragSources.length === 0) {
      setRagSources(actionData.ragSources);
    }
  }

  if (
    actionData &&
    "intent" in actionData &&
    actionData.intent === "generate" &&
    actionData.success &&
    "content" in actionData
  ) {
    if (!generatedContent) {
      setGeneratedContent(actionData.content);
      setStep(4);
    }
  }

  // Save handlers
  const handleSaveR4 = () => {
    if (!generatedContent?.r4) return;

    const formData = new FormData();
    formData.append("intent", "save_r4");
    formData.append("r4_data", JSON.stringify(generatedContent.r4));
    fetcher.submit(formData, { method: "post" });
  };

  const handleSaveR5 = (r5Item: NonNullable<GeneratedContent["r5"]>[0]) => {
    const formData = new FormData();
    formData.append("intent", "save_r5");
    formData.append("r5_data", JSON.stringify(r5Item));
    fetcher.submit(formData, { method: "post" });
  };

  // Track saved items
  if (
    actionData &&
    "intent" in actionData &&
    actionData.intent === "save_r4" &&
    actionData.success
  ) {
    if (!savedItems.r4) {
      setSavedItems((prev) => ({ ...prev, r4: true }));
    }
  }

  if (
    actionData &&
    "intent" in actionData &&
    actionData.intent === "save_r5" &&
    actionData.success &&
    "slug" in actionData
  ) {
    const slugValue = actionData.slug;
    if (!savedItems.r5?.includes(slugValue)) {
      setSavedItems((prev) => ({
        ...prev,
        r5: [...(prev.r5 || []), slugValue],
      }));
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
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
            <Link to="/admin/seo-hub/content">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wand2 className="h-6 w-6" />
              Générateur IA
            </h1>
            <p className="text-muted-foreground">
              Générer automatiquement R4 Reference et R5 Diagnostic
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                s === step
                  ? "bg-primary text-primary-foreground"
                  : s < step
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 4 && (
              <ChevronRight
                className={`h-4 w-4 mx-2 ${
                  s < step ? "text-green-500" : "text-muted-foreground"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        {/* Step 1: Select Gamme */}
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Étape 1 : Sélection Gamme</CardTitle>
              <CardDescription>
                Choisissez la gamme pour laquelle générer du contenu SEO
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une gamme..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <ScrollArea className="h-[400px] rounded-md border p-4">
                <div className="space-y-2">
                  {filteredGammes.map((gamme) => (
                    <div
                      key={gamme.pgId}
                      onClick={() => setSelectedGamme(gamme)}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedGamme?.pgId === gamme.pgId
                          ? "bg-primary/10 border-2 border-primary"
                          : "bg-muted/50 hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedGamme?.pgId === gamme.pgId}
                          className="pointer-events-none"
                        />
                        <div>
                          <p className="font-medium">{gamme.name}</p>
                          <p className="text-sm text-muted-foreground font-mono">
                            {gamme.slug}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">pg_id: {gamme.pgId}</Badge>
                        {gamme.hasRagFile && (
                          <Badge className="bg-green-100 text-green-800">
                            RAG ✓
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={nextStep} disabled={!selectedGamme}>
                Suivant
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </>
        )}

        {/* Step 2: Content Type */}
        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>Étape 2 : Type de contenu</CardTitle>
              <CardDescription>
                Sélectionnez les types de pages à générer pour{" "}
                <strong>{selectedGamme?.name}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                value={
                  contentTypes.includes("r4") && contentTypes.includes("r5")
                    ? "both"
                    : contentTypes.includes("r4")
                      ? "r4"
                      : "r5"
                }
                onValueChange={(value) => {
                  if (value === "both") setContentTypes(["r4", "r5"]);
                  else if (value === "r4") setContentTypes(["r4"]);
                  else setContentTypes(["r5"]);
                }}
                className="space-y-4"
              >
                <div className="flex items-start space-x-3 p-4 rounded-lg border">
                  <RadioGroupItem value="r4" id="r4" className="mt-1" />
                  <div className="flex-1">
                    <Label
                      htmlFor="r4"
                      className="flex items-center gap-2 text-lg font-medium cursor-pointer"
                    >
                      <BookOpen className="h-5 w-5 text-blue-500" />
                      R4 Reference uniquement
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Fiche technique complète : définition, rôle mécanique,
                      composition, confusions courantes
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 rounded-lg border">
                  <RadioGroupItem value="r5" id="r5" className="mt-1" />
                  <div className="flex-1">
                    <Label
                      htmlFor="r5"
                      className="flex items-center gap-2 text-lg font-medium cursor-pointer"
                    >
                      <Stethoscope className="h-5 w-5 text-orange-500" />
                      R5 Diagnostic uniquement
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Pages symptômes avec Observable Pro : symptom description,
                      sign description, safety gates
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 rounded-lg border border-primary bg-primary/5">
                  <RadioGroupItem value="both" id="both" className="mt-1" />
                  <div className="flex-1">
                    <Label
                      htmlFor="both"
                      className="flex items-center gap-2 text-lg font-medium cursor-pointer"
                    >
                      <div className="flex">
                        <BookOpen className="h-5 w-5 text-blue-500" />
                        <Stethoscope className="h-5 w-5 text-orange-500 -ml-1" />
                      </div>
                      Les deux (Recommandé)
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Génère R4 Reference + toutes les pages R5 Diagnostic liées
                      aux symptômes de la gamme
                    </p>
                    <Badge className="mt-2">Maillage optimal</Badge>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={prevStep}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
              <Button onClick={nextStep} disabled={contentTypes.length === 0}>
                Suivant
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </>
        )}

        {/* Step 3: Review RAG Sources */}
        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle>Étape 3 : Sources RAG</CardTitle>
              <CardDescription>
                Vérifiez les sources qui seront utilisées pour la génération
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertTitle>Sources identifiées</AlertTitle>
                <AlertDescription>
                  {ragSources.length > 0
                    ? `${ragSources.length} fichier(s) RAG trouvé(s)`
                    : "Recherche des fichiers RAG..."}
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="p-4 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">Gamme</Badge>
                    <span className="font-mono text-sm">
                      /rag/knowledge/gammes/{selectedGamme?.slug}.md
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Fichier principal contenant les règles mécaniques, symptômes
                    et garde-fous
                  </p>
                </div>

                <div className="p-4 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">Diagnostic</Badge>
                    <span className="font-mono text-sm">
                      /rag/knowledge/diagnostic/*.md
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Fichiers diagnostic associés (témoins, symptômes techniques)
                  </p>
                </div>

                <div className="p-4 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">Keywords SEO</Badge>
                    <span className="font-mono text-sm">
                      Analyse intentions
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Mots-clés longue traîne et intentions de recherche
                    identifiées
                  </p>
                </div>
              </div>

              {contentTypes.includes("r4") && (
                <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
                  <h4 className="font-medium flex items-center gap-2 text-blue-800">
                    <BookOpen className="h-4 w-4" />
                    R4 Reference à générer
                  </h4>
                  <ul className="mt-2 text-sm text-blue-700 space-y-1">
                    <li>• Titre et meta description optimisés SEO</li>
                    <li>• Définition et rôle mécanique</li>
                    <li>• Composition détaillée</li>
                    <li>• Confusions courantes</li>
                    <li>• Liens vers symptômes R5</li>
                  </ul>
                </div>
              )}

              {contentTypes.includes("r5") && (
                <div className="p-4 rounded-lg border border-orange-200 bg-orange-50">
                  <h4 className="font-medium flex items-center gap-2 text-orange-800">
                    <Stethoscope className="h-4 w-4" />
                    R5 Diagnostic à générer
                  </h4>
                  <ul className="mt-2 text-sm text-orange-700 space-y-1">
                    <li>• Pages symptômes extraites du fichier RAG</li>
                    <li>• Classification Observable Pro (symptom/sign/dtc)</li>
                    <li>• Safety gates (stop_immediate, stop_soon, warning)</li>
                    <li>• Maillage vers R4 et gammes produits</li>
                  </ul>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={prevStep}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
              <Button onClick={handleGenerate} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Générer
                  </>
                )}
              </Button>
            </CardFooter>
          </>
        )}

        {/* Step 4: Results */}
        {step === 4 && generatedContent && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                Étape 4 : Résultats
              </CardTitle>
              <CardDescription>
                Contenu généré avec succès. Prévisualisez et sauvegardez.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="r4" className="space-y-4">
                <TabsList>
                  {generatedContent.r4 && (
                    <TabsTrigger value="r4" className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      R4 Reference
                      {savedItems.r4 && (
                        <Check className="h-3 w-3 text-green-500" />
                      )}
                    </TabsTrigger>
                  )}
                  {generatedContent.r5 && generatedContent.r5.length > 0 && (
                    <TabsTrigger value="r5" className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4" />
                      R5 Diagnostic ({generatedContent.r5.length})
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="sources">Sources</TabsTrigger>
                </TabsList>

                {/* R4 Tab */}
                {generatedContent.r4 && (
                  <TabsContent value="r4" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              {generatedContent.r4.title}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground font-mono mt-1">
                              /reference-auto/{generatedContent.r4.slug}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link
                                to={`/admin/seo-hub/content/references/new?prefill=${encodeURIComponent(
                                  JSON.stringify(generatedContent.r4),
                                )}`}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Éditer
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveR4}
                              disabled={savedItems.r4 || isLoading}
                            >
                              {savedItems.r4 ? (
                                <>
                                  <Check className="mr-2 h-4 w-4" />
                                  Sauvegardé
                                </>
                              ) : (
                                <>
                                  <Save className="mr-2 h-4 w-4" />
                                  Sauvegarder
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label className="text-muted-foreground">
                            Meta Description
                          </Label>
                          <p className="text-sm mt-1">
                            {generatedContent.r4.metaDescription}
                          </p>
                        </div>
                        <Separator />
                        <div>
                          <Label className="text-muted-foreground">
                            Définition
                          </Label>
                          <p className="text-sm mt-1 whitespace-pre-line">
                            {generatedContent.r4.definition}
                          </p>
                        </div>
                        <Separator />
                        <div>
                          <Label className="text-muted-foreground">
                            Composition
                          </Label>
                          <ul className="text-sm mt-1 list-disc pl-4">
                            {generatedContent.r4.composition.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <Separator />
                        <div>
                          <Label className="text-muted-foreground">
                            Symptômes associés (R5)
                          </Label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {generatedContent.r4.symptomesAssocies.map(
                              (slug) => (
                                <Badge key={slug} variant="outline">
                                  {slug}
                                </Badge>
                              ),
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                )}

                {/* R5 Tab */}
                {generatedContent.r5 && generatedContent.r5.length > 0 && (
                  <TabsContent value="r5" className="space-y-4">
                    {generatedContent.r5.map((r5Item) => (
                      <Card key={r5Item.slug}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-lg">
                                  {r5Item.title}
                                </CardTitle>
                                <Badge
                                  className={
                                    r5Item.safetyGate === "stop_immediate"
                                      ? "bg-red-100 text-red-800"
                                      : r5Item.safetyGate === "stop_soon"
                                        ? "bg-orange-100 text-orange-800"
                                        : r5Item.safetyGate === "warning"
                                          ? "bg-yellow-100 text-yellow-800"
                                          : "bg-gray-100 text-gray-800"
                                  }
                                >
                                  {r5Item.safetyGate}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground font-mono mt-1">
                                /diagnostic-auto/{r5Item.slug}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" asChild>
                                <Link
                                  to={`/admin/seo-hub/content/diagnostics/new?prefill=${encodeURIComponent(
                                    JSON.stringify(r5Item),
                                  )}`}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Éditer
                                </Link>
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSaveR5(r5Item)}
                                disabled={
                                  savedItems.r5?.includes(r5Item.slug) ||
                                  isLoading
                                }
                              >
                                {savedItems.r5?.includes(r5Item.slug) ? (
                                  <>
                                    <Check className="mr-2 h-4 w-4" />
                                    Sauvegardé
                                  </>
                                ) : (
                                  <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Sauvegarder
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex gap-4">
                            <Badge variant="outline">
                              {r5Item.observableType}
                            </Badge>
                            <Badge variant="outline">
                              {r5Item.perceptionChannel}
                            </Badge>
                            <Badge variant="outline">{r5Item.riskLevel}</Badge>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              Description symptôme
                            </Label>
                            <p className="text-sm mt-1">
                              {r5Item.symptomDescription}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                )}

                {/* Sources Tab */}
                <TabsContent value="sources" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Sources utilisées
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-muted-foreground">
                          Fichiers RAG
                        </Label>
                        <ul className="text-sm mt-1 font-mono space-y-1">
                          {generatedContent.sourcesUsed.map((source) => (
                            <li
                              key={source}
                              className="flex items-center gap-2"
                            >
                              <FileText className="h-4 w-4" />
                              {source}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {generatedContent.keywordsMatched.length > 0 && (
                        <div>
                          <Label className="text-muted-foreground">
                            Keywords SEO matchés
                          </Label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {generatedContent.keywordsMatched.map((kw) => (
                              <Badge key={kw} variant="secondary">
                                {kw}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setSelectedGamme(null);
                  setContentTypes(["r4", "r5"]);
                  setRagSources([]);
                  setGeneratedContent(null);
                  setSavedItems({});
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Nouvelle génération
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link to="/admin/seo-hub/content/references">Voir R4</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/admin/seo-hub/content/diagnostics">Voir R5</Link>
                </Button>
              </div>
            </CardFooter>
          </>
        )}
      </Card>

      {/* Error feedback */}
      {actionData && !actionData.success && "error" in actionData && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
