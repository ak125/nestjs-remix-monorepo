/**
 * 📚 SEO HUB - R4 REFERENCES LIST
 *
 * Liste paginée des pages R4 Reference avec:
 * - Filtres par status (draft/published)
 * - Recherche par titre/slug
 * - Actions: Preview, Edit, Publish, Delete
 * - Sélection bulk
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  useSearchParams,
  Link,
  Form,
  useNavigation,
} from "@remix-run/react";
import {
  BookOpen,
  Edit,
  Eye,
  Filter,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Check,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";

interface Reference {
  slug: string;
  title: string;
  metaDescription: string | null;
  definition: string;
  pgId: number | null;
  gammeName: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LoaderData {
  references: Reference[];
  drafts: Reference[];
  total: number;
  error: string | null;
  authError?: boolean;
}

export const meta: MetaFunction = () =>
  createNoIndexMeta("Références SEO - Admin");

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";

  try {
    // Fetch both published and drafts
    const [publishedRes, draftsRes] = await Promise.all([
      fetch(`${backendUrl}/api/seo/reference`, {
        headers: { Cookie: cookieHeader },
      }),
      fetch(`${backendUrl}/api/seo/reference/drafts`, {
        headers: { Cookie: cookieHeader },
      }),
    ]);

    // Vérifier les erreurs d'autorisation (403)
    if (draftsRes.status === 403) {
      return json<LoaderData>({
        references: [],
        drafts: [],
        total: 0,
        error:
          "Accès refusé : vous devez être connecté en tant qu'administrateur (niveau 7+) pour accéder aux drafts.",
        authError: true,
      });
    }

    const publishedData = publishedRes.ok
      ? await publishedRes.json()
      : { references: [] };
    const draftsData = draftsRes.ok ? await draftsRes.json() : { drafts: [] };

    // Mark published status
    const published = (publishedData.references || []).map((r: Reference) => ({
      ...r,
      isPublished: true,
    }));
    const drafts = (draftsData.drafts || []).map((r: Reference) => ({
      ...r,
      isPublished: false,
    }));

    // Filter based on status
    let references: Reference[] = [];
    if (status === "published") {
      references = published;
    } else if (status === "draft") {
      references = drafts;
    } else {
      references = [...drafts, ...published];
    }

    return json<LoaderData>({
      references,
      drafts,
      total: published.length + drafts.length,
      error: null,
    });
  } catch (error) {
    logger.error("[R4 List] Loader error:", error);
    return json<LoaderData>({
      references: [],
      drafts: [],
      total: 0,
      error: "Erreur connexion backend",
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const slug = formData.get("slug") as string;

  try {
    switch (intent) {
      case "publish": {
        const res = await fetch(
          `${backendUrl}/api/seo/reference/${slug}/publish`,
          {
            method: "PATCH",
            headers: { Cookie: cookieHeader },
          },
        );
        const data = await res.json();
        return json({ success: data.success, action: "publish", slug });
      }
      case "delete": {
        const res = await fetch(`${backendUrl}/api/seo/reference/${slug}`, {
          method: "DELETE",
          headers: { Cookie: cookieHeader },
        });
        const data = await res.json();
        return json({ success: data.success, action: "delete", slug });
      }
      default:
        return json({ success: false, error: "Action non reconnue" });
    }
  } catch (error) {
    logger.error("[R4 Action] Error:", error);
    return json({ success: false, error: "Erreur serveur" });
  }
}

export default function AdminReferencesIndex() {
  const { references, total, error, authError } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isLoading =
    navigation.state === "loading" || navigation.state === "submitting";

  const status = searchParams.get("status") || "all";
  const search = searchParams.get("q") || "";

  // Filter by search
  const filteredReferences = references.filter((ref) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      ref.slug.toLowerCase().includes(searchLower) ||
      ref.title.toLowerCase().includes(searchLower)
    );
  });

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    setSearchParams(params);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get("q") as string;
    const params = new URLSearchParams(searchParams);
    if (q) {
      params.set("q", q);
    } else {
      params.delete("q");
    }
    setSearchParams(params);
  };

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-6 text-center">
          <p className="text-red-700">{error}</p>
          {authError && (
            <p className="mt-4">
              <a
                href="/admin/login"
                className="text-red-600 underline hover:text-red-800"
              >
                Se connecter en tant qu&apos;administrateur →
              </a>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const publishedCount = references.filter((r) => r.isPublished).length;
  const draftCount = references.filter((r) => !r.isPublished).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            R4 References
          </h1>
          <p className="text-muted-foreground">
            Fiches techniques des pièces automobiles
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/admin/seo-hub/content/references/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle R4
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/seo-hub/content/generator">
              <RefreshCw className="mr-2 h-4 w-4" />
              Générateur IA
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Publiées</CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {publishedCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Brouillons</CardTitle>
            <Edit className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {draftCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtres
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  placeholder="Rechercher par titre ou slug..."
                  defaultValue={search}
                  className="pl-10"
                />
              </div>
            </form>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="published">Publiées</SelectItem>
                <SelectItem value="draft">Brouillons</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filteredReferences.length} référence
            {filteredReferences.length > 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredReferences.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Aucune référence trouvée</p>
              <Button asChild className="mt-4">
                <Link to="/admin/seo-hub/content/references/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Créer une référence
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Gamme</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mis à jour</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReferences.map((ref) => (
                  <TableRow
                    key={ref.slug}
                    className={isLoading ? "opacity-50" : ""}
                  >
                    <TableCell className="font-medium">
                      <Link
                        to={`/admin/seo-hub/content/references/${ref.slug}`}
                        className="hover:underline"
                      >
                        {ref.title}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {ref.slug}
                    </TableCell>
                    <TableCell>
                      {ref.gammeName ? (
                        <Badge variant="outline">{ref.gammeName}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {ref.isPublished ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          <Check className="mr-1 h-3 w-3" />
                          Publiée
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-amber-800"
                        >
                          <Edit className="mr-1 h-3 w-3" />
                          Brouillon
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {ref.updatedAt
                        ? new Date(ref.updatedAt).toLocaleDateString("fr-FR")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link
                              to={`/reference-auto/${ref.slug}`}
                              target="_blank"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Prévisualiser
                              <ExternalLink className="ml-2 h-3 w-3" />
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link
                              to={`/admin/seo-hub/content/references/${ref.slug}`}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Éditer
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {!ref.isPublished && (
                            <Form method="post">
                              <input
                                type="hidden"
                                name="intent"
                                value="publish"
                              />
                              <input
                                type="hidden"
                                name="slug"
                                value={ref.slug}
                              />
                              <DropdownMenuItem asChild>
                                <button
                                  type="submit"
                                  className="w-full cursor-pointer"
                                >
                                  <Check className="mr-2 h-4 w-4 text-green-600" />
                                  Publier
                                </button>
                              </DropdownMenuItem>
                            </Form>
                          )}
                          {!ref.isPublished && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Supprimer
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Supprimer cette référence ?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Cette action est irréversible. La référence
                                    "{ref.title}" sera définitivement supprimée.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <Form method="post">
                                    <input
                                      type="hidden"
                                      name="intent"
                                      value="delete"
                                    />
                                    <input
                                      type="hidden"
                                      name="slug"
                                      value={ref.slug}
                                    />
                                    <AlertDialogAction
                                      type="submit"
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Supprimer
                                    </AlertDialogAction>
                                  </Form>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
