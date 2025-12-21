/**
 * 🎯 ADMIN GAMME SEO DETAIL
 *
 * Dashboard centralisé pour gérer tout le contenu SEO d'une gamme
 * - SEO: Meta title, description, H1, content, switches
 * - Blog: Articles conseil liés
 * - Véhicules: Compatibilités par niveau
 * - V-Level: Motorisations championnes
 * - Conseils: Conseils remplacement
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import {
  useLoaderData,
  useNavigation,
  Link,
  useFetcher,
} from "@remix-run/react";
import {
  ArrowLeft,
  CheckCircle,
  Eye,
  FileText,
  Car,
  TrendingUp,
  Wrench,
  Save,
  Package,
  Calendar,
  ExternalLink,
  Plus,
  Edit2,
  Trash2,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { AdminBreadcrumb } from "~/components/admin/AdminBreadcrumb";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ui/tabs";

// Types
interface GammeDetail {
  gamme: {
    pg_id: number;
    pg_name: string;
    pg_alias: string;
    pg_level: string;
    pg_top: string;
    pg_relfollow: string;
    pg_sitemap: string;
    pg_display: string;
    pg_img: string | null;
  };
  seo: {
    sg_id: number | null;
    sg_title: string;
    sg_descrip: string;
    sg_keywords: string;
    sg_h1: string;
    sg_content: string;
  };
  conseils: Array<{
    sgc_id: number;
    sgc_title: string;
    sgc_content: string;
  }>;
  switches: Array<{
    sis_id: number;
    sis_alias: string;
    sis_content: string;
  }>;
  articles: Array<{
    ba_id: number;
    ba_title: string;
    ba_alias: string;
    ba_preview: string;
    ba_visit: string;
    ba_create: string;
    ba_update: string;
    sections_count: number;
  }>;
  vehicles: {
    level1: Array<{
      cgc_id: number;
      type_id: number;
      type_name: string;
      marque_name: string;
      modele_name: string;
    }>;
    level2: Array<any>;
    level5: Array<any>;
  };
  vLevel: Array<{
    id: number;
    gamme_name: string;
    model_name: string;
    brand: string;
    variant_name: string;
    energy: string;
    v_level: string;
    rank: number;
    score: number;
  }>;
  stats: {
    products_count: number;
    articles_count: number;
    vehicles_level1_count: number;
    last_article_date: string | null;
  };
}

// Loader
export async function loader({ request, params }: LoaderFunctionArgs) {
  const pgId = params.pgId;
  if (!pgId) {
    throw new Response("pgId manquant", { status: 400 });
  }

  const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
  const cookieHeader = request.headers.get("Cookie") || "";

  const response = await fetch(
    `${backendUrl}/api/admin/gammes-seo/${pgId}/detail`,
    {
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Response("Gamme non trouvée", { status: 404 });
  }

  const result = await response.json();

  if (!result.success) {
    throw new Response(result.message || "Erreur", { status: 500 });
  }

  return json({ detail: result.data as GammeDetail });
}

// Action
export async function action({ request, params }: ActionFunctionArgs) {
  const pgId = params.pgId;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    if (intent === "updateSeo") {
      const seoData = {
        sg_title: formData.get("sg_title") as string,
        sg_descrip: formData.get("sg_descrip") as string,
        sg_keywords: formData.get("sg_keywords") as string,
        sg_h1: formData.get("sg_h1") as string,
        sg_content: formData.get("sg_content") as string,
      };

      const response = await fetch(
        `${backendUrl}/api/admin/gammes-seo/${pgId}/seo`,
        {
          method: "PATCH",
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(seoData),
        }
      );

      const result = await response.json();
      return json(result);
    }

    if (intent === "updateSwitch") {
      const alias = formData.get("alias") as string;
      const content = formData.get("content") as string;

      const response = await fetch(
        `${backendUrl}/api/admin/gammes-seo/${pgId}/switch/${alias}`,
        {
          method: "PATCH",
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        }
      );

      const result = await response.json();
      return json(result);
    }

    return json({ success: false, message: "Action non reconnue" });
  } catch (error) {
    return json({
      success: false,
      message: error instanceof Error ? error.message : "Erreur",
    });
  }
}

// Component
export default function AdminGammeSeoDetail() {
  const { detail } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const fetcher = useFetcher();

  const isSubmitting = navigation.state === "submitting";

  // Local state for SEO form
  const [seoForm, setSeoForm] = useState({
    sg_title: detail.seo.sg_title || "",
    sg_descrip: detail.seo.sg_descrip || "",
    sg_keywords: detail.seo.sg_keywords || "",
    sg_h1: detail.seo.sg_h1 || "",
    sg_content: detail.seo.sg_content || "",
  });

  // Status badges
  const isIndexed = detail.gamme.pg_level === "1";
  const isG1 = detail.gamme.pg_top === "1";
  const inSitemap = detail.gamme.pg_sitemap === "1";

  // Group V-Level by model
  const vLevelByModel = detail.vLevel.reduce(
    (acc, item) => {
      if (!acc[item.model_name]) {
        acc[item.model_name] = { diesel: [], essence: [] };
      }
      if (item.energy === "diesel") {
        acc[item.model_name].diesel.push(item);
      } else {
        acc[item.model_name].essence.push(item);
      }
      return acc;
    },
    {} as Record<string, { diesel: typeof detail.vLevel; essence: typeof detail.vLevel }>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Breadcrumb */}
      <AdminBreadcrumb currentPage={`Gammes SEO > ${detail.gamme.pg_name}`} />

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/gammes-seo">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{detail.gamme.pg_name}</h1>
            <p className="text-sm text-gray-500">/{detail.gamme.pg_alias}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isIndexed ? "default" : "secondary"}>
            {isIndexed ? "INDEX" : "NOINDEX"}
          </Badge>
          {isG1 && <Badge variant="default">G1</Badge>}
          {inSitemap && (
            <Badge variant="outline">Sitemap</Badge>
          )}
          <a
            href={`https://automecanik.com/pieces-auto/${detail.gamme.pg_alias}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              Voir la page
            </Button>
          </a>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Produits</p>
                <p className="text-2xl font-bold">{detail.stats.products_count}</p>
              </div>
              <Package className="h-8 w-8 text-gray-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Articles</p>
                <p className="text-2xl font-bold">{detail.stats.articles_count}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Vehicules (Vedettes)</p>
                <p className="text-2xl font-bold">
                  {detail.stats.vehicles_level1_count}
                </p>
              </div>
              <Car className="h-8 w-8 text-gray-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Dernier article</p>
                <p className="text-lg font-medium">
                  {detail.stats.last_article_date
                    ? new Date(detail.stats.last_article_date).toLocaleDateString(
                        "fr-FR"
                      )
                    : "Aucun"}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-gray-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="seo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="seo" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            SEO
          </TabsTrigger>
          <TabsTrigger value="blog" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Blog ({detail.articles.length})
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="flex items-center gap-2">
            <Car className="h-4 w-4" />
            Vehicules
          </TabsTrigger>
          <TabsTrigger value="vlevel" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            V-Level
          </TabsTrigger>
          <TabsTrigger value="conseils" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Conseils ({detail.conseils.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB SEO */}
        <TabsContent value="seo">
          <Card>
            <CardHeader>
              <CardTitle>Donnees SEO</CardTitle>
              <CardDescription>
                Meta title, description, H1 et contenu de la page gamme
              </CardDescription>
            </CardHeader>
            <CardContent>
              <fetcher.Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value="updateSeo" />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sg_title">Meta Title</Label>
                    <Input
                      id="sg_title"
                      name="sg_title"
                      value={seoForm.sg_title}
                      onChange={(e) =>
                        setSeoForm({ ...seoForm, sg_title: e.target.value })
                      }
                      placeholder="Titre SEO"
                    />
                    <p className="text-xs text-gray-500">
                      {seoForm.sg_title.length}/60 caracteres
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sg_h1">H1</Label>
                    <Input
                      id="sg_h1"
                      name="sg_h1"
                      value={seoForm.sg_h1}
                      onChange={(e) =>
                        setSeoForm({ ...seoForm, sg_h1: e.target.value })
                      }
                      placeholder="Titre H1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sg_descrip">Meta Description</Label>
                  <Textarea
                    id="sg_descrip"
                    name="sg_descrip"
                    value={seoForm.sg_descrip}
                    onChange={(e) =>
                      setSeoForm({ ...seoForm, sg_descrip: e.target.value })
                    }
                    placeholder="Description SEO"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500">
                    {seoForm.sg_descrip.length}/160 caracteres
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sg_keywords">Keywords</Label>
                  <Input
                    id="sg_keywords"
                    name="sg_keywords"
                    value={seoForm.sg_keywords}
                    onChange={(e) =>
                      setSeoForm({ ...seoForm, sg_keywords: e.target.value })
                    }
                    placeholder="Mots-cles separes par des virgules"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sg_content">Contenu</Label>
                  <Textarea
                    id="sg_content"
                    name="sg_content"
                    value={seoForm.sg_content}
                    onChange={(e) =>
                      setSeoForm({ ...seoForm, sg_content: e.target.value })
                    }
                    placeholder="Contenu principal de la page"
                    rows={6}
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={fetcher.state === "submitting"}>
                    <Save className="mr-2 h-4 w-4" />
                    {fetcher.state === "submitting"
                      ? "Sauvegarde..."
                      : "Sauvegarder"}
                  </Button>
                </div>
              </fetcher.Form>

              {/* SEO Switches */}
              {detail.switches.length > 0 && (
                <div className="mt-8 border-t pt-6">
                  <h3 className="mb-4 text-lg font-medium">Switches SEO</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {detail.switches.map((sw) => (
                      <div key={sw.sis_id} className="space-y-2">
                        <Label>Alias {sw.sis_alias}</Label>
                        <Input
                          defaultValue={sw.sis_content}
                          placeholder={`Contenu switch ${sw.sis_alias}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB BLOG */}
        <TabsContent value="blog">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Articles Blog</CardTitle>
                <CardDescription>
                  Articles conseil lies a cette gamme
                </CardDescription>
              </div>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nouvel article
              </Button>
            </CardHeader>
            <CardContent>
              {detail.articles.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Aucun article pour cette gamme
                </p>
              ) : (
                <div className="space-y-4">
                  {detail.articles.map((article) => (
                    <div
                      key={article.ba_id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium">{article.ba_title}</h4>
                        <p className="text-sm text-gray-500 line-clamp-1">
                          {article.ba_preview}
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                          <span>{article.ba_visit} visites</span>
                          <span>{article.sections_count} sections</span>
                          <span>
                            Maj:{" "}
                            {new Date(article.ba_update).toLocaleDateString(
                              "fr-FR"
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://automecanik.com/conseil/${article.ba_alias}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                        <Button variant="ghost" size="sm">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB VEHICLES */}
        <TabsContent value="vehicles">
          <div className="space-y-6">
            {/* Level 1 - Vedettes */}
            <Card>
              <CardHeader>
                <CardTitle>Niveau 1 - Vedettes</CardTitle>
                <CardDescription>
                  Vehicules affiches en grille sur la page gamme (max 20)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {detail.vehicles.level1.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    Aucun vehicule vedette
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {detail.vehicles.level1.map((v) => (
                      <Badge
                        key={v.cgc_id}
                        variant="secondary"
                        className="text-sm"
                      >
                        {v.marque_name} {v.modele_name} {v.type_name}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Level 5 - Blog */}
            <Card>
              <CardHeader>
                <CardTitle>Niveau 5 - Blog</CardTitle>
                <CardDescription>
                  Vehicules cites dans les articles blog
                </CardDescription>
              </CardHeader>
              <CardContent>
                {detail.vehicles.level5.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    Aucun vehicule blog
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {detail.vehicles.level5.map((v) => (
                      <Badge
                        key={v.cgc_id}
                        variant="outline"
                        className="text-sm"
                      >
                        {v.marque_name} {v.modele_name} {v.type_name}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB V-LEVEL */}
        <TabsContent value="vlevel">
          <Card>
            <CardHeader>
              <CardTitle>Donnees V-Level</CardTitle>
              <CardDescription>
                Motorisations championnes (V2) par modele et energie
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(vLevelByModel).length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Aucune donnee V-Level pour cette gamme
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left">Modele</th>
                        <th className="px-4 py-2 text-left">Diesel (V2)</th>
                        <th className="px-4 py-2 text-left">Essence (V2)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(vLevelByModel).map(([model, data]) => {
                        const dieselV2 = data.diesel.find(
                          (v) => v.v_level === "V2"
                        );
                        const essenceV2 = data.essence.find(
                          (v) => v.v_level === "V2"
                        );
                        return (
                          <tr key={model} className="border-b">
                            <td className="px-4 py-3 font-medium">{model}</td>
                            <td className="px-4 py-3">
                              {dieselV2 ? (
                                <span className="inline-flex items-center gap-1">
                                  <Badge variant="default" className="text-xs">
                                    V2
                                  </Badge>
                                  {dieselV2.variant_name}
                                  <span className="text-gray-400">
                                    ({dieselV2.score})
                                  </span>
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {essenceV2 ? (
                                <span className="inline-flex items-center gap-1">
                                  <Badge variant="default" className="text-xs">
                                    V2
                                  </Badge>
                                  {essenceV2.variant_name}
                                  <span className="text-gray-400">
                                    ({essenceV2.score})
                                  </span>
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB CONSEILS */}
        <TabsContent value="conseils">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Conseils Remplacement</CardTitle>
                <CardDescription>
                  Conseils affiches sur la page gamme
                </CardDescription>
              </div>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau conseil
              </Button>
            </CardHeader>
            <CardContent>
              {detail.conseils.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Aucun conseil pour cette gamme
                </p>
              ) : (
                <div className="space-y-4">
                  {detail.conseils.map((conseil) => (
                    <div
                      key={conseil.sgc_id}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{conseil.sgc_title}</h4>
                          <p className="mt-1 text-sm text-gray-600">
                            {conseil.sgc_content}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
