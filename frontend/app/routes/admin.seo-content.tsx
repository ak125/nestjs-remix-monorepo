// app/routes/admin.seo-content.tsx
// Dashboard de validation du contenu SEO R4 (References) et R5 (Diagnostics)
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Form,
  useLoaderData,
  useActionData,
  useNavigation,
} from "@remix-run/react";
import { CheckCircle, Eye, Trash2, FolderOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { requireUser } from "../auth/unified.server";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { AdminBreadcrumb } from "~/components/admin/AdminBreadcrumb";
import { Alert, Badge } from "~/components/ui";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Contenu SEO - Admin");

interface R4Draft {
  id: number;
  slug: string;
  title: string;
  definition: string;
  role_mecanique: string | null;
  pg_id: number | null;
  created_at: string;
}

interface R5Draft {
  id: number;
  slug: string;
  title: string;
  observable_type: string;
  perception_channel: string;
  risk_level: string;
  safety_gate: string;
  cluster_id: string | null;
  created_at: string;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireUser({ context });

  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    // Charger les drafts R4 et R5 en parallèle
    const [r4Res, r5Res] = await Promise.all([
      fetch(`${backendUrl}/api/seo/reference/drafts`, {
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
      }).catch(() => null),
      fetch(`${backendUrl}/api/seo/diagnostic/drafts`, {
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
      }).catch(() => null),
    ]);

    // L'API retourne { drafts: [...], total: N }
    const r4Data = r4Res?.ok
      ? await r4Res.json().catch(() => ({ drafts: [] }))
      : { drafts: [] };
    const r5Data = r5Res?.ok
      ? await r5Res.json().catch(() => ({ drafts: [] }))
      : { drafts: [] };

    const r4Drafts: R4Draft[] = Array.isArray(r4Data)
      ? r4Data
      : r4Data.drafts || [];
    const r5Drafts: R5Draft[] = Array.isArray(r5Data)
      ? r5Data
      : r5Data.drafts || [];

    return json({
      r4Drafts,
      r5Drafts,
      success: true,
      error: null,
    });
  } catch (error) {
    logger.error("[SEO Content] Erreur:", error);
    return json({
      r4Drafts: [],
      r5Drafts: [],
      error:
        error instanceof Error
          ? error.message
          : "Erreur de connexion au backend",
      success: false,
    });
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  await requireUser({ context });

  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    switch (intent) {
      case "publish-r4": {
        const slug = formData.get("slug") as string;
        const response = await fetch(
          `${backendUrl}/api/seo/reference/${slug}/publish`,
          {
            method: "PATCH",
            headers: {
              Cookie: cookieHeader,
              "Content-Type": "application/json",
            },
          },
        );
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return json({ success: true, message: `R4 "${slug}" publié` });
      }

      case "publish-r5": {
        const slug = formData.get("slug") as string;
        const response = await fetch(
          `${backendUrl}/api/seo/diagnostic/${slug}/publish`,
          {
            method: "PATCH",
            headers: {
              Cookie: cookieHeader,
              "Content-Type": "application/json",
            },
          },
        );
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return json({ success: true, message: `R5 "${slug}" publié` });
      }

      case "delete-r4": {
        const slug = formData.get("slug") as string;
        const response = await fetch(
          `${backendUrl}/api/seo/reference/${slug}`,
          {
            method: "DELETE",
            headers: {
              Cookie: cookieHeader,
              "Content-Type": "application/json",
            },
          },
        );
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return json({ success: true, message: `R4 "${slug}" supprimé` });
      }

      case "delete-r5": {
        const slug = formData.get("slug") as string;
        const response = await fetch(
          `${backendUrl}/api/seo/diagnostic/${slug}`,
          {
            method: "DELETE",
            headers: {
              Cookie: cookieHeader,
              "Content-Type": "application/json",
            },
          },
        );
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return json({ success: true, message: `R5 "${slug}" supprimé` });
      }

      case "publish-all-r4": {
        const slugs = JSON.parse((formData.get("slugs") as string) || "[]");
        let published = 0;
        for (const slug of slugs) {
          const response = await fetch(
            `${backendUrl}/api/seo/reference/${slug}/publish`,
            {
              method: "PATCH",
              headers: {
                Cookie: cookieHeader,
                "Content-Type": "application/json",
              },
            },
          );
          if (response.ok) published++;
        }
        return json({ success: true, message: `${published} R4 publiés` });
      }

      case "publish-all-r5": {
        const slugs = JSON.parse((formData.get("slugs") as string) || "[]");
        let published = 0;
        for (const slug of slugs) {
          const response = await fetch(
            `${backendUrl}/api/seo/diagnostic/${slug}/publish`,
            {
              method: "PATCH",
              headers: {
                Cookie: cookieHeader,
                "Content-Type": "application/json",
              },
            },
          );
          if (response.ok) published++;
        }
        return json({ success: true, message: `${published} R5 publiés` });
      }

      default:
        return json({ success: false, message: "Action inconnue" });
    }
  } catch (error) {
    logger.error("[SEO Content Action] Erreur:", error);
    return json({
      success: false,
      message: error instanceof Error ? error.message : "Erreur",
    });
  }
}

// Cluster labels pour affichage
const CLUSTER_LABELS: Record<string, string> = {
  "securite-freinage": "🛑 Sécurité / Freinage",
  "moteur-performance": "🔧 Moteur / Performance",
  transmission: "⚙️ Transmission",
  "chassis-direction": "🚗 Châssis / Direction",
  electricite: "⚡ Électricité",
  "refroidissement-climatisation": "❄️ Refroidissement / Climatisation",
  "echappement-antipollution": "💨 Échappement / Antipollution",
  "autres-pieces": "📦 Autres pièces",
};

export default function AdminSeoContent() {
  const { r4Drafts, r5Drafts, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [selectedR4, setSelectedR4] = useState<string[]>([]);
  const [selectedR5, setSelectedR5] = useState<string[]>([]);

  // Grouper les R5 par cluster_id
  const r5ByCluster = useMemo(() => {
    const grouped: Record<string, R5Draft[]> = {};
    for (const draft of r5Drafts) {
      if (!draft) continue; // Skip null entries
      const cluster = draft.cluster_id || "autres-pieces";
      if (!grouped[cluster]) grouped[cluster] = [];
      grouped[cluster].push(draft as R5Draft);
    }
    // Trier les clusters par label
    return Object.entries(grouped).sort((a, b) =>
      (CLUSTER_LABELS[a[0]] || a[0]).localeCompare(
        CLUSTER_LABELS[b[0]] || b[0],
      ),
    );
  }, [r5Drafts]);

  const toggleR4 = (slug: string) => {
    setSelectedR4((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const toggleR5 = (slug: string) => {
    setSelectedR5((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const selectAllR4 = () => {
    setSelectedR4(r4Drafts.map((d) => d.slug));
  };

  const selectAllR5 = () => {
    setSelectedR5(r5Drafts.map((d) => d.slug));
  };

  // Sélectionner tous les drafts d'un cluster
  const selectCluster = (cluster: string) => {
    const clusterDrafts = r5ByCluster.find(([c]) => c === cluster)?.[1] || [];
    const clusterSlugs = clusterDrafts.map((d) => d.slug);
    setSelectedR5((prev) => {
      const withoutCluster = prev.filter((s) => !clusterSlugs.includes(s));
      const allSelected = clusterSlugs.every((s) => prev.includes(s));
      return allSelected
        ? withoutCluster
        : [...withoutCluster, ...clusterSlugs];
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <AdminBreadcrumb currentPage="SEO Content Validation" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Validation Contenu SEO</h1>
          <p className="text-muted-foreground">
            R4 References ({r4Drafts.length} drafts) | R5 Diagnostics (
            {r5Drafts.length} drafts)
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <p>{error}</p>
        </Alert>
      )}

      {actionData?.message && (
        <Alert variant={actionData.success ? "default" : "destructive"}>
          <p>{actionData.message}</p>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>R4 Drafts</CardDescription>
            <CardTitle className="text-3xl">{r4Drafts.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">References</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>R5 Drafts</CardDescription>
            <CardTitle className="text-3xl">{r5Drafts.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">Diagnostics</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-3xl">
              {r4Drafts.length + r5Drafts.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge>A valider</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Form method="post">
              <input type="hidden" name="intent" value="publish-all-r4" />
              <input
                type="hidden"
                name="slugs"
                value={JSON.stringify(r4Drafts.map((d) => d.slug))}
              />
              <Button
                type="submit"
                size="sm"
                className="w-full"
                disabled={isSubmitting || r4Drafts.length === 0}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Publier tous R4
              </Button>
            </Form>
            <Form method="post">
              <input type="hidden" name="intent" value="publish-all-r5" />
              <input
                type="hidden"
                name="slugs"
                value={JSON.stringify(r5Drafts.map((d) => d.slug))}
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="w-full"
                disabled={isSubmitting || r5Drafts.length === 0}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Publier tous R5
              </Button>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="r4" className="space-y-4">
        <TabsList>
          <TabsTrigger value="r4">
            R4 References ({r4Drafts.length})
          </TabsTrigger>
          <TabsTrigger value="r5">
            R5 Diagnostics ({r5Drafts.length})
          </TabsTrigger>
        </TabsList>

        {/* R4 Tab */}
        <TabsContent value="r4" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>References (R4)</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllR4}>
                    Tout sélectionner
                  </Button>
                  {selectedR4.length > 0 && (
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="publish-all-r4"
                      />
                      <input
                        type="hidden"
                        name="slugs"
                        value={JSON.stringify(selectedR4)}
                      />
                      <Button type="submit" size="sm" disabled={isSubmitting}>
                        Publier sélection ({selectedR4.length})
                      </Button>
                    </Form>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {r4Drafts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun draft R4
                </p>
              ) : (
                <div className="divide-y">
                  {r4Drafts.map((draft) => (
                    <div
                      key={draft.slug}
                      className="py-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedR4.includes(draft.slug)}
                          onChange={() => toggleR4(draft.slug)}
                        />
                        <div>
                          <p className="font-medium">{draft.title}</p>
                          <p className="text-sm text-muted-foreground">
                            /{draft.slug} | pg_id: {draft.pg_id || "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/reference-auto/${draft.slug}?preview=true`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </a>
                        <Form method="post">
                          <input
                            type="hidden"
                            name="intent"
                            value="publish-r4"
                          />
                          <input type="hidden" name="slug" value={draft.slug} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="default"
                            disabled={isSubmitting}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        </Form>
                        <Form method="post">
                          <input
                            type="hidden"
                            name="intent"
                            value="delete-r4"
                          />
                          <input type="hidden" name="slug" value={draft.slug} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="destructive"
                            disabled={isSubmitting}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </Form>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* R5 Tab - Groupé par Cluster */}
        <TabsContent value="r5" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Diagnostics (R5) - Par Catégorie</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllR5}>
                    Tout sélectionner
                  </Button>
                  {selectedR5.length > 0 && (
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="publish-all-r5"
                      />
                      <input
                        type="hidden"
                        name="slugs"
                        value={JSON.stringify(selectedR5)}
                      />
                      <Button type="submit" size="sm" disabled={isSubmitting}>
                        Publier sélection ({selectedR5.length})
                      </Button>
                    </Form>
                  )}
                </div>
              </div>
              <CardDescription>
                {r5ByCluster.length} catégories | {r5Drafts.length} diagnostics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {r5Drafts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun draft R5
                </p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {r5ByCluster.map(([cluster, drafts]) => {
                    const clusterLabel = CLUSTER_LABELS[cluster] || cluster;
                    const allSelected = drafts.every((d) =>
                      selectedR5.includes(d.slug),
                    );

                    return (
                      <AccordionItem key={cluster} value={cluster}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3 w-full">
                            <FolderOpen className="w-5 h-5 text-muted-foreground" />
                            <span className="font-medium">{clusterLabel}</span>
                            <Badge variant="secondary" className="ml-2">
                              {drafts.length}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-auto mr-4"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectCluster(cluster);
                              }}
                            >
                              {allSelected
                                ? "Désélectionner"
                                : "Sélectionner tout"}
                            </Button>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="divide-y pl-4 border-l-2 border-muted ml-2">
                            {drafts.map((draft) => (
                              <div
                                key={draft.slug}
                                className="py-3 flex items-center justify-between"
                              >
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={selectedR5.includes(draft.slug)}
                                    onChange={() => toggleR5(draft.slug)}
                                  />
                                  <div>
                                    <p className="font-medium">{draft.title}</p>
                                    <p className="text-sm text-muted-foreground">
                                      /{draft.slug} | {draft.observable_type} |{" "}
                                      {draft.risk_level}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      draft.risk_level === "critique"
                                        ? "destructive"
                                        : draft.risk_level === "securite"
                                          ? "default"
                                          : "secondary"
                                    }
                                  >
                                    {draft.risk_level}
                                  </Badge>
                                  <a
                                    href={`/diagnostic-auto/${draft.slug}?preview=true`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Button variant="ghost" size="sm">
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </a>
                                  <Form method="post">
                                    <input
                                      type="hidden"
                                      name="intent"
                                      value="publish-r5"
                                    />
                                    <input
                                      type="hidden"
                                      name="slug"
                                      value={draft.slug}
                                    />
                                    <Button
                                      type="submit"
                                      size="sm"
                                      variant="default"
                                      disabled={isSubmitting}
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </Button>
                                  </Form>
                                  <Form method="post">
                                    <input
                                      type="hidden"
                                      name="intent"
                                      value="delete-r5"
                                    />
                                    <input
                                      type="hidden"
                                      name="slug"
                                      value={draft.slug}
                                    />
                                    <Button
                                      type="submit"
                                      size="sm"
                                      variant="destructive"
                                      disabled={isSubmitting}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </Form>
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
