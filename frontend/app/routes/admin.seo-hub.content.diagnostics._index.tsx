/**
 * 🔧 SEO HUB - R5 DIAGNOSTICS LIST
 *
 * Liste paginée des pages R5 Diagnostic avec:
 * - Filtres par status, type, safety gate, cluster
 * - Groupement par cluster (accordion)
 * - Actions: Preview, Edit, Publish, Delete
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import {
  useLoaderData,
  useSearchParams,
  Link,
  Form,
  useNavigation,
} from "@remix-run/react";
import {
  AlertTriangle,
  Edit,
  Eye,
  Filter,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Check,
  StopCircle,
  AlertCircle,
  Zap,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
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

interface Diagnostic {
  slug: string;
  title: string;
  metaDescription: string | null;
  observableType: string;
  perceptionChannel: string;
  riskLevel: string;
  safetyGate: string;
  clusterId: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LoaderData {
  diagnostics: Diagnostic[];
  total: number;
  clusters: string[];
  error: string | null;
  authError?: boolean;
}

const SAFETY_GATE_COLORS: Record<string, string> = {
  stop_immediate: "bg-red-100 text-red-800 border-red-300",
  stop_soon: "bg-orange-100 text-orange-800 border-orange-300",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-300",
  none: "bg-gray-100 text-gray-800 border-gray-300",
};

const SAFETY_GATE_ICONS: Record<string, typeof StopCircle> = {
  stop_immediate: StopCircle,
  stop_soon: AlertTriangle,
  warning: AlertCircle,
  none: Zap,
};

const SAFETY_GATE_LABELS: Record<string, string> = {
  stop_immediate: "STOP Immédiat",
  stop_soon: "STOP Bientôt",
  warning: "Attention",
  none: "Info",
};

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";

  try {
    // Fetch both published and drafts
    const [featuredRes, draftsRes] = await Promise.all([
      fetch(`${backendUrl}/api/seo/diagnostic/featured?limit=200`, {
        headers: { Cookie: cookieHeader },
      }),
      fetch(`${backendUrl}/api/seo/diagnostic/drafts`, {
        headers: { Cookie: cookieHeader },
      }),
    ]);

    // Vérifier les erreurs d'autorisation (403)
    if (draftsRes.status === 403) {
      return json<LoaderData>({
        diagnostics: [],
        total: 0,
        clusters: [],
        error:
          "Accès refusé : vous devez être connecté en tant qu'administrateur (niveau 7+) pour accéder aux drafts.",
        authError: true,
      });
    }

    const featuredData = featuredRes.ok
      ? await featuredRes.json()
      : { data: [] };
    const draftsData = draftsRes.ok ? await draftsRes.json() : { drafts: [] };

    // Mark published status
    const published = (featuredData.data || []).map((d: Diagnostic) => ({
      ...d,
      isPublished: true,
    }));
    const drafts = (draftsData.drafts || []).map((d: Diagnostic) => ({
      ...d,
      isPublished: false,
    }));

    // Combine and filter
    let diagnostics: Diagnostic[] = [];
    if (status === "published") {
      diagnostics = published;
    } else if (status === "draft") {
      diagnostics = drafts;
    } else {
      diagnostics = [...drafts, ...published];
    }

    // Extract unique clusters
    const clusters = [
      ...new Set(diagnostics.map((d) => d.clusterId).filter(Boolean)),
    ] as string[];

    return json<LoaderData>({
      diagnostics,
      total: published.length + drafts.length,
      clusters,
      error: null,
    });
  } catch (error) {
    console.error("[R5 List] Loader error:", error);
    return json<LoaderData>({
      diagnostics: [],
      total: 0,
      clusters: [],
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
          `${backendUrl}/api/seo/diagnostic/${slug}/publish`,
          {
            method: "PATCH",
            headers: { Cookie: cookieHeader },
          },
        );
        const data = await res.json();
        return json({ success: data.success, action: "publish", slug });
      }
      case "delete": {
        const res = await fetch(`${backendUrl}/api/seo/diagnostic/${slug}`, {
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
    console.error("[R5 Action] Error:", error);
    return json({ success: false, error: "Erreur serveur" });
  }
}

export default function AdminDiagnosticsIndex() {
  const {
    diagnostics,
    total,
    clusters: _clusters,
    error,
    authError,
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isLoading =
    navigation.state === "loading" || navigation.state === "submitting";

  const status = searchParams.get("status") || "all";
  const safetyGate = searchParams.get("safety_gate") || "all";
  const search = searchParams.get("q") || "";

  // Filter diagnostics
  const filteredDiagnostics = diagnostics.filter((diag) => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !diag.slug.toLowerCase().includes(searchLower) &&
        !diag.title.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }
    if (safetyGate !== "all" && diag.safetyGate !== safetyGate) {
      return false;
    }
    return true;
  });

  // Group by cluster
  const groupedByCluster = filteredDiagnostics.reduce(
    (acc, diag) => {
      const cluster = diag.clusterId || "non-classé";
      if (!acc[cluster]) {
        acc[cluster] = [];
      }
      acc[cluster].push(diag);
      return acc;
    },
    {} as Record<string, Diagnostic[]>,
  );

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    setSearchParams(params);
  };

  const handleSafetyGateChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("safety_gate");
    } else {
      params.set("safety_gate", value);
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

  const _publishedCount = diagnostics.filter((d) => d.isPublished).length;
  const draftCount = diagnostics.filter((d) => !d.isPublished).length;

  // Count by safety gate
  const safetyGateCounts = diagnostics.reduce(
    (acc, d) => {
      acc[d.safetyGate] = (acc[d.safetyGate] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            R5 Diagnostics
          </h1>
          <p className="text-muted-foreground">
            Pages symptômes et diagnostics automobiles
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/admin/seo-hub/content/diagnostics/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau R5
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
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">STOP Immédiat</CardTitle>
            <StopCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {safetyGateCounts["stop_immediate"] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">STOP Bientôt</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {safetyGateCounts["stop_soon"] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attention</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {safetyGateCounts["warning"] || 0}
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
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  placeholder="Rechercher..."
                  defaultValue={search}
                  className="pl-10"
                />
              </div>
            </form>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="published">Publiés</SelectItem>
                <SelectItem value="draft">Brouillons</SelectItem>
              </SelectContent>
            </Select>
            <Select value={safetyGate} onValueChange={handleSafetyGateChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Safety Gate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="stop_immediate">STOP Immédiat</SelectItem>
                <SelectItem value="stop_soon">STOP Bientôt</SelectItem>
                <SelectItem value="warning">Attention</SelectItem>
                <SelectItem value="none">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grouped by Cluster */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filteredDiagnostics.length} diagnostic
            {filteredDiagnostics.length > 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDiagnostics.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Aucun diagnostic trouvé</p>
              <Button asChild className="mt-4">
                <Link to="/admin/seo-hub/content/diagnostics/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Créer un diagnostic
                </Link>
              </Button>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {Object.entries(groupedByCluster).map(([cluster, items]) => (
                <AccordionItem
                  key={cluster}
                  value={cluster}
                  className="border rounded-lg"
                >
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="capitalize">
                        {cluster}
                      </Badge>
                      <span className="text-muted-foreground text-sm">
                        {items.length} page{items.length > 1 ? "s" : ""}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Titre</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Safety Gate</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((diag) => {
                          const SafetyIcon =
                            SAFETY_GATE_ICONS[diag.safetyGate] || Zap;
                          return (
                            <TableRow
                              key={diag.slug}
                              className={isLoading ? "opacity-50" : ""}
                            >
                              <TableCell>
                                <Link
                                  to={`/admin/seo-hub/content/diagnostics/${diag.slug}`}
                                  className="font-medium hover:underline"
                                >
                                  {diag.title}
                                </Link>
                                <p className="text-sm text-muted-foreground font-mono">
                                  {diag.slug}
                                </p>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className="capitalize"
                                >
                                  {diag.observableType}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    SAFETY_GATE_COLORS[diag.safetyGate]
                                  }
                                >
                                  <SafetyIcon className="mr-1 h-3 w-3" />
                                  {SAFETY_GATE_LABELS[diag.safetyGate]}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {diag.isPublished ? (
                                  <Badge className="bg-green-100 text-green-800">
                                    <Check className="mr-1 h-3 w-3" />
                                    Publié
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="secondary"
                                    className="bg-amber-100 text-amber-800"
                                  >
                                    Brouillon
                                  </Badge>
                                )}
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
                                        to={`/diagnostic-auto/${diag.slug}`}
                                        target="_blank"
                                      >
                                        <Eye className="mr-2 h-4 w-4" />
                                        Prévisualiser
                                        <ExternalLink className="ml-2 h-3 w-3" />
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link
                                        to={`/admin/seo-hub/content/diagnostics/${diag.slug}`}
                                      >
                                        <Edit className="mr-2 h-4 w-4" />
                                        Éditer
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {!diag.isPublished && (
                                      <Form method="post">
                                        <input
                                          type="hidden"
                                          name="intent"
                                          value="publish"
                                        />
                                        <input
                                          type="hidden"
                                          name="slug"
                                          value={diag.slug}
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
                                    {!diag.isPublished && (
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
                                              Supprimer ce diagnostic ?
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Cette action est irréversible.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>
                                              Annuler
                                            </AlertDialogCancel>
                                            <Form method="post">
                                              <input
                                                type="hidden"
                                                name="intent"
                                                value="delete"
                                              />
                                              <input
                                                type="hidden"
                                                name="slug"
                                                value={diag.slug}
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
                          );
                        })}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
