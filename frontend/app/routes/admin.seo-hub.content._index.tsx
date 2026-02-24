/**
 * SEO HUB - CONTENT Dashboard (Index)
 *
 * Vue d'ensemble du contenu SEO:
 * - R4 References (definitions)
 * - R5 Diagnostics (observables)
 * - Articles Blog
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  BookOpen,
  Eye,
  FileText,
  PenTool,
  Plus,
  Search,
  Wand2,
  Zap,
} from "lucide-react";
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
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";

interface ContentStats {
  r4References: {
    total: number;
    published: number;
    draft: number;
    recent: Array<{ slug: string; title: string; updatedAt: string }>;
  };
  r5Diagnostics: {
    total: number;
    published: number;
    draft: number;
    recent: Array<{ slug: string; title: string; updatedAt: string }>;
  };
  blog: {
    total: number;
    guides: number;
    advice: number;
    recent: Array<{
      slug: string;
      title: string;
      type: string;
      publishedAt: string;
    }>;
  };
}

export const meta: MetaFunction = () =>
  createNoIndexMeta("Contenu SEO Hub - Admin");

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    const res = await fetch(
      `${backendUrl}/api/admin/seo-cockpit/content/stats`,
      {
        headers: { Cookie: cookieHeader },
      },
    );

    const data = res.ok ? await res.json() : null;

    return json({
      stats: data?.data as ContentStats | null,
      error: data?.success === false ? "Erreur chargement stats" : null,
    });
  } catch (error) {
    logger.error("[SEO Content] Loader error:", error);
    return json({
      stats: null,
      error: "Erreur connexion backend",
    });
  }
}

export default function SeoHubContentIndex() {
  const { stats, error } = useLoaderData<typeof loader>();

  if (error) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-6 text-center">
          <p className="text-amber-700">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contenu SEO</h1>
          <p className="text-gray-600">
            Gerez vos pages R4, R5 et articles blog
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Rechercher..." className="pl-9 w-64" />
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* R4 References */}
        <Card className="border-indigo-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-indigo-700">
                <Eye className="h-5 w-5" />
                R4 References
              </CardTitle>
              <Badge className="bg-indigo-600">
                {stats?.r4References?.total || 0}
              </Badge>
            </div>
            <CardDescription>Pages de definition mecanique</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-gray-600">
                  {stats?.r4References?.published || 0} publies
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-400" />
                <span className="text-gray-600">
                  {stats?.r4References?.draft || 0} brouillons
                </span>
              </div>
            </div>

            {stats?.r4References?.recent &&
              stats.r4References.recent.length > 0 && (
                <div className="space-y-2 mb-4">
                  <h4 className="text-xs font-medium text-gray-500 uppercase">
                    Recents
                  </h4>
                  {stats.r4References.recent.slice(0, 3).map((item) => (
                    <div
                      key={item.slug}
                      className="text-sm p-2 bg-gray-50 rounded"
                    >
                      <div className="font-medium text-gray-900 truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-gray-500">/{item.slug}</div>
                    </div>
                  ))}
                </div>
              )}

            <Link to="/admin/seo-hub/content/references">
              <Button variant="outline" className="w-full">
                <PenTool className="h-4 w-4 mr-2" />
                Gerer R4
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* R5 Diagnostics */}
        <Card className="border-purple-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-purple-700">
                <Zap className="h-5 w-5" />
                R5 Diagnostics
              </CardTitle>
              <Badge className="bg-purple-600">
                {stats?.r5Diagnostics?.total || 0}
              </Badge>
            </div>
            <CardDescription>Pages de symptomes et pannes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-gray-600">
                  {stats?.r5Diagnostics?.published || 0} publies
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-400" />
                <span className="text-gray-600">
                  {stats?.r5Diagnostics?.draft || 0} brouillons
                </span>
              </div>
            </div>

            {stats?.r5Diagnostics?.recent &&
              stats.r5Diagnostics.recent.length > 0 && (
                <div className="space-y-2 mb-4">
                  <h4 className="text-xs font-medium text-gray-500 uppercase">
                    Recents
                  </h4>
                  {stats.r5Diagnostics.recent.slice(0, 3).map((item) => (
                    <div
                      key={item.slug}
                      className="text-sm p-2 bg-gray-50 rounded"
                    >
                      <div className="font-medium text-gray-900 truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-gray-500">/{item.slug}</div>
                    </div>
                  ))}
                </div>
              )}

            <Link to="/admin/seo-hub/content/diagnostics">
              <Button variant="outline" className="w-full">
                <PenTool className="h-4 w-4 mr-2" />
                Gerer R5
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Blog */}
        <Card className="border-pink-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-pink-700">
                <BookOpen className="h-5 w-5" />
                Blog
              </CardTitle>
              <Badge className="bg-pink-600">{stats?.blog?.total || 0}</Badge>
            </div>
            <CardDescription>Guides et conseils auto</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4 text-sm">
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3 text-blue-500" />
                <span className="text-gray-600">
                  {stats?.blog?.guides || 0} guides
                </span>
              </div>
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3 text-green-500" />
                <span className="text-gray-600">
                  {stats?.blog?.advice || 0} conseils
                </span>
              </div>
            </div>

            {stats?.blog?.recent && stats.blog.recent.length > 0 && (
              <div className="space-y-2 mb-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase">
                  Recents
                </h4>
                {stats.blog.recent.slice(0, 3).map((item) => (
                  <div
                    key={item.slug}
                    className="text-sm p-2 bg-gray-50 rounded"
                  >
                    <div className="font-medium text-gray-900 truncate">
                      {item.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {item.type}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(item.publishedAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Link to="/admin/blog">
              <Button variant="outline" className="w-full">
                <PenTool className="h-4 w-4 mr-2" />
                Gerer Blog
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions Rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/seo-hub/content/references/new">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle R4 Reference
              </Button>
            </Link>
            <Link to="/admin/seo-hub/content/diagnostics/new">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Nouveau R5 Diagnostic
              </Button>
            </Link>
            <Link to="/admin/blog">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Nouvel Article Blog
              </Button>
            </Link>
            <Link to="/admin/seo-hub/content/generator">
              <Button variant="outline">
                <Wand2 className="h-4 w-4 mr-2" />
                Generateur IA
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
