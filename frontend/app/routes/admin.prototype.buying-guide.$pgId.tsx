/**
 * Route : /admin/prototype/buying-guide/:pgId
 * Page prototype pour preview du buying guide enrichi vs fallback.
 * Admin only, noindex.
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart3,
  Database,
  Layers,
} from "lucide-react";

import { AntiMistakesSection } from "~/components/seo/AntiMistakesSection";
import { FAQSection } from "~/components/seo/FAQSection";
import { PurchaseGuideSection } from "~/components/seo/PurchaseGuideSection";
import { SymptomsSection } from "~/components/seo/SymptomsSection";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { type GammeBuyingGuideV1 } from "~/types/gamme-content-contract.types";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Buying Guide Prototype - Admin");

interface PreviewData {
  pgId: string;
  enriched: GammeBuyingGuideV1 | null;
  fallback: GammeBuyingGuideV1 | null;
  comparison: {
    enrichedAvailable: boolean;
    fallbackAvailable: boolean;
    enrichedQuality: GammeBuyingGuideV1["quality"] | null;
    fallbackQuality: GammeBuyingGuideV1["quality"] | null;
    enrichedSectionSources: Record<string, string> | null;
    delta: Record<string, number> | null;
  };
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const pgId = params.pgId;
  if (!pgId) throw new Response("pgId requis", { status: 400 });

  const url = getInternalApiUrlFromRequest(
    `/api/admin/buying-guide/preview/${pgId}`,
    request,
  );

  const cookie = request.headers.get("Cookie") || "";
  const response = await fetch(url, {
    headers: { Cookie: cookie },
  });

  if (!response.ok) {
    throw new Response(`Erreur API: ${response.status}`, {
      status: response.status,
    });
  }

  const data: PreviewData = await response.json();
  return json(data);
}

function QualityBadge({
  quality,
}: {
  quality: GammeBuyingGuideV1["quality"] | null;
}) {
  if (!quality) return <Badge variant="outline">N/A</Badge>;

  const color =
    quality.score >= 80
      ? "bg-green-100 text-green-800"
      : quality.score >= 60
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";

  return (
    <Badge className={color}>
      {quality.score}/100
      {quality.verified && " (verified)"}
    </Badge>
  );
}

function SectionCount({
  label,
  enriched,
  fallback,
}: {
  label: string;
  enriched: number;
  fallback: number;
}) {
  const diff = enriched - fallback;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-semibold">{enriched}</span>
        {diff !== 0 && (
          <span
            className={`text-xs ${diff > 0 ? "text-green-600" : "text-red-600"}`}
          >
            ({diff > 0 ? "+" : ""}
            {diff})
          </span>
        )}
        <span className="text-xs text-gray-400">vs {fallback}</span>
      </div>
    </div>
  );
}

function GuideRender({
  guide,
  label,
}: {
  guide: GammeBuyingGuideV1;
  label: string;
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-gray-800 border-b pb-2">{label}</h3>
      <PurchaseGuideSection guide={guide} gammeName="Disque de frein" />
      <SymptomsSection symptoms={guide.symptoms} gammeName="Disque de frein" />
      <AntiMistakesSection
        antiMistakes={guide.antiMistakes}
        gammeName="Disque de frein"
      />
      <FAQSection faq={guide.faq} gammeName="Disque de frein" />
    </div>
  );
}

export default function BuyingGuidePrototype() {
  const data = useLoaderData<typeof loader>();
  const { enriched, fallback, comparison } = data;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Buying Guide Prototype
            </h1>
            <p className="text-sm text-gray-500">pgId: {data.pgId}</p>
          </div>
          <div className="flex items-center gap-3">
            {comparison.enrichedAvailable ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Enrichi disponible
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-800">
                <XCircle className="w-3 h-3 mr-1" />
                Pas de donnees enrichies
              </Badge>
            )}
          </div>
        </div>

        {/* Quality & Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Quality Score */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Score qualite
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-gray-500">Enrichi</p>
                  <QualityBadge quality={comparison.enrichedQuality} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Fallback</p>
                  <QualityBadge quality={comparison.fallbackQuality} />
                </div>
              </div>
              {comparison.enrichedQuality?.flags?.length ? (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-1">Flags:</p>
                  <div className="flex flex-wrap gap-1">
                    {comparison.enrichedQuality.flags.map((flag) => (
                      <Badge
                        key={flag}
                        variant="outline"
                        className="text-xs bg-amber-50"
                      >
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {flag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : comparison.enrichedAvailable ? (
                <p className="mt-3 text-xs text-green-600">
                  <CheckCircle2 className="w-3 h-3 inline mr-1" />
                  Aucun flag de qualite
                </p>
              ) : null}
            </CardContent>
          </Card>

          {/* Section Sources */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="w-4 h-4" />
                Sources sections
              </CardTitle>
            </CardHeader>
            <CardContent>
              {comparison.enrichedSectionSources ? (
                <div className="space-y-1">
                  {Object.entries(comparison.enrichedSectionSources).map(
                    ([key, source]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-gray-600">{key}</span>
                        <Badge
                          variant="outline"
                          className={
                            source === "db"
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-50"
                          }
                        >
                          {source}
                        </Badge>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">N/A</p>
              )}
            </CardContent>
          </Card>

          {/* Delta Comparison */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Delta enrichi vs fallback
              </CardTitle>
            </CardHeader>
            <CardContent>
              {enriched && fallback ? (
                <div>
                  <SectionCount
                    label="Criteres"
                    enriched={enriched.selectionCriteria?.length || 0}
                    fallback={fallback.selectionCriteria?.length || 0}
                  />
                  <SectionCount
                    label="Anti-erreurs"
                    enriched={enriched.antiMistakes?.length || 0}
                    fallback={fallback.antiMistakes?.length || 0}
                  />
                  <SectionCount
                    label="FAQ"
                    enriched={enriched.faq?.length || 0}
                    fallback={fallback.faq?.length || 0}
                  />
                  <SectionCount
                    label="Symptomes"
                    enriched={enriched.symptoms?.length || 0}
                    fallback={fallback.symptoms?.length || 0}
                  />
                  <SectionCount
                    label="Decision tree"
                    enriched={enriched.decisionTree?.length || 0}
                    fallback={fallback.decisionTree?.length || 0}
                  />
                  <SectionCount
                    label="Use cases"
                    enriched={enriched.useCases?.length || 0}
                    fallback={fallback.useCases?.length || 0}
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  Comparison non disponible
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content: Enriched vs Fallback */}
        <Tabs defaultValue="enriched" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="enriched">
              Enrichi (DB)
              {enriched && (
                <Badge className="ml-2 bg-green-100 text-green-700 text-xs">
                  {comparison.enrichedQuality?.score ?? "?"}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="fallback">
              Fallback (actuel en prod)
            </TabsTrigger>
            <TabsTrigger value="sidebyside">Cote a cote</TabsTrigger>
          </TabsList>

          <TabsContent value="enriched" className="mt-6">
            {enriched ? (
              <div className="bg-white rounded-xl border p-6">
                <GuideRender guide={enriched} label="Rendu enrichi (DB)" />
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  <XCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
                  <p>Aucune donnee enrichie pour pgId={data.pgId}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="fallback" className="mt-6">
            {fallback ? (
              <div className="bg-white rounded-xl border p-6">
                <GuideRender
                  guide={fallback}
                  label="Rendu fallback (production actuelle)"
                />
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  <p>Pas de fallback</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="sidebyside" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-green-200 p-6">
                {enriched ? (
                  <GuideRender guide={enriched} label="Enrichi (DB)" />
                ) : (
                  <p className="text-center text-gray-400 py-8">
                    Pas de donnees enrichies
                  </p>
                )}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                {fallback ? (
                  <GuideRender guide={fallback} label="Fallback (prod)" />
                ) : (
                  <p className="text-center text-gray-400 py-8">
                    Pas de fallback
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
