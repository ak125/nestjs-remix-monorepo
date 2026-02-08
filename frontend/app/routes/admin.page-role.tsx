/**
 * PageRole Validator Dashboard
 *
 * Interface admin pour visualiser et valider les PageRoles SEO:
 * - Détecter le rôle d'une URL
 * - Valider le contenu d'une page
 * - Vérifier si un lien est autorisé
 * - Visualiser la matrice des liens
 */

import {
  type LoaderFunctionArgs,
  type MetaFunction,
  json,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Shield,
  Search,
  FileText,
  Link2,
  Grid3X3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Info,
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
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";

export const meta: MetaFunction = () => [
  { title: "PageRole Validator | Admin" },
];

interface RoleMeta {
  label: string;
  intention: string;
  maxWords?: number;
  indexable: boolean;
}

interface RoleInfo {
  id: string;
  label: string;
  intention: string;
}

interface MatrixData {
  matrix: Record<string, { allowedTargets: string[]; description: string }>;
  table: Record<string, Record<string, boolean>>;
  roles: RoleInfo[];
}

interface HierarchyItem {
  role: string;
  label: string;
  position: number;
  description: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const apiUrl = getInternalApiUrl("");

  try {
    const [matrixRes, hierarchyRes, rulesRes] = await Promise.all([
      fetch(`${apiUrl}/api/admin/page-role/matrix`, {
        headers: { Cookie: request.headers.get("Cookie") || "" },
      }),
      fetch(`${apiUrl}/api/admin/page-role/hierarchy`, {
        headers: { Cookie: request.headers.get("Cookie") || "" },
      }),
      fetch(`${apiUrl}/api/admin/page-role/rules`, {
        headers: { Cookie: request.headers.get("Cookie") || "" },
      }),
    ]);

    const matrix: MatrixData = matrixRes.ok
      ? await matrixRes.json()
      : { matrix: {}, table: {}, roles: [] };
    const hierarchy = hierarchyRes.ok
      ? await hierarchyRes.json()
      : { hierarchy: [] };
    const rules = rulesRes.ok ? await rulesRes.json() : { rules: {} };

    return json({ matrix, hierarchy, rules });
  } catch {
    return json({
      matrix: { matrix: {}, table: {}, roles: [] },
      hierarchy: { hierarchy: [] },
      rules: { rules: {} },
    });
  }
}

export default function AdminPageRoleDashboard() {
  const { matrix, hierarchy, rules } = useLoaderData<typeof loader>();

  // URL Detector state
  const [urlToDetect, setUrlToDetect] = useState("");
  const [detectedRole, setDetectedRole] = useState<{
    url: string;
    role: string | null;
    roleLabel: string | null;
    meta: RoleMeta | null;
  } | null>(null);
  const [detectLoading, setDetectLoading] = useState(false);

  // Content Validator state
  const [validateUrl, setValidateUrl] = useState("");
  const [validateContent, setValidateContent] = useState("");
  const [validationResult, setValidationResult] = useState<{
    url: string;
    detectedRole: string | null;
    isValid: boolean;
    violations: Array<{
      type: string;
      message: string;
      severity: "warning" | "error";
    }>;
    summary: { totalViolations: number; errors: number; warnings: number };
  } | null>(null);
  const [validateLoading, setValidateLoading] = useState(false);

  // Link Checker state
  const [linkSource, setLinkSource] = useState("");
  const [linkTarget, setLinkTarget] = useState("");
  const [linkResult, setLinkResult] = useState<{
    source: string;
    target: string;
    sourceRole: string | null;
    targetRole: string | null;
    isAllowed: boolean;
    violation: { type: string; message: string; severity: string } | null;
  } | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);

  // Handlers
  const handleDetectRole = async () => {
    if (!urlToDetect) return;
    setDetectLoading(true);
    try {
      const res = await fetch(
        `/api/admin/page-role/detect?url=${encodeURIComponent(urlToDetect)}`,
      );
      const data = await res.json();
      setDetectedRole(data);
    } catch (err) {
      logger.error("Error detecting role:", err);
    } finally {
      setDetectLoading(false);
    }
  };

  const handleValidateContent = async () => {
    if (!validateUrl || !validateContent) return;
    setValidateLoading(true);
    try {
      const res = await fetch("/api/admin/page-role/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: validateUrl, content: validateContent }),
      });
      const data = await res.json();
      setValidationResult(data);
    } catch (err) {
      logger.error("Error validating content:", err);
    } finally {
      setValidateLoading(false);
    }
  };

  const handleCheckLink = async () => {
    if (!linkSource || !linkTarget) return;
    setLinkLoading(true);
    try {
      const res = await fetch(
        `/api/admin/page-role/check-link?source=${encodeURIComponent(linkSource)}&target=${encodeURIComponent(linkTarget)}`,
      );
      const data = await res.json();
      setLinkResult(data);
    } catch (err) {
      logger.error("Error checking link:", err);
    } finally {
      setLinkLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string | null) => {
    if (!role) return "secondary";
    const colors: Record<string, string> = {
      R1: "bg-blue-100 text-blue-800",
      R2: "bg-green-100 text-green-800",
      R3: "bg-purple-100 text-purple-800",
      R4: "bg-amber-100 text-amber-800",
      R5: "bg-red-100 text-red-800",
      R6: "bg-gray-100 text-gray-800",
    };
    return colors[role] || "secondary";
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">PageRole Validator</h1>
          <p className="text-muted-foreground">
            Validation des rôles SEO et règles de maillage interne
          </p>
        </div>
      </div>

      {/* Hierarchy Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Hiérarchie des rôles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {(hierarchy.hierarchy as HierarchyItem[]).map(
              (item: HierarchyItem, index: number) => (
                <div key={item.role} className="flex items-center gap-2">
                  <Badge className={getRoleBadgeColor(item.role)}>
                    {item.role} - {item.label}
                  </Badge>
                  {index < hierarchy.hierarchy.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              ),
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="detect" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="detect" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            URL Detector
          </TabsTrigger>
          <TabsTrigger value="validate" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Content Validator
          </TabsTrigger>
          <TabsTrigger value="links" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Link Checker
          </TabsTrigger>
          <TabsTrigger value="matrix" className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" />
            Matrice
          </TabsTrigger>
        </TabsList>

        {/* URL Detector Tab */}
        <TabsContent value="detect">
          <Card>
            <CardHeader>
              <CardTitle>Détecter le rôle d&apos;une URL</CardTitle>
              <CardDescription>
                Saisissez une URL pour connaître son rôle SEO assigné
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="url-detect">URL</Label>
                  <Input
                    id="url-detect"
                    placeholder="/pieces/freinage-1.html"
                    value={urlToDetect}
                    onChange={(e) => setUrlToDetect(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleDetectRole()}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleDetectRole} disabled={detectLoading}>
                    {detectLoading ? "Analyse..." : "Détecter"}
                  </Button>
                </div>
              </div>

              {detectedRole && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          URL:
                        </span>
                        <code className="text-sm bg-background px-2 py-1 rounded">
                          {detectedRole.url}
                        </code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Rôle détecté:
                        </span>
                        {detectedRole.role ? (
                          <Badge
                            className={getRoleBadgeColor(detectedRole.role)}
                          >
                            {detectedRole.role} -{" "}
                            {detectedRole.meta?.label || "Unknown"}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            Exclu (noindex/privé)
                          </Badge>
                        )}
                      </div>
                      {detectedRole.meta && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Intention:
                            </span>
                            <span className="text-sm">
                              {detectedRole.meta.intention}
                            </span>
                          </div>
                          {detectedRole.meta.maxWords && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Max mots:
                              </span>
                              <span className="text-sm">
                                {detectedRole.meta.maxWords}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Indexable:
                            </span>
                            <Badge
                              variant={
                                detectedRole.meta.indexable
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {detectedRole.meta.indexable ? "Oui" : "Non"}
                            </Badge>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Validator Tab */}
        <TabsContent value="validate">
          <Card>
            <CardHeader>
              <CardTitle>Valider le contenu d&apos;une page</CardTitle>
              <CardDescription>
                Collez le contenu texte d&apos;une page pour vérifier les
                violations de règles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="validate-url">URL de la page</Label>
                <Input
                  id="validate-url"
                  placeholder="/reference-auto/definition-abs"
                  value={validateUrl}
                  onChange={(e) => setValidateUrl(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="validate-content">Contenu texte</Label>
                <Textarea
                  id="validate-content"
                  placeholder="Collez ici le contenu textuel de la page..."
                  value={validateContent}
                  onChange={(e) => setValidateContent(e.target.value)}
                  className="min-h-[150px]"
                />
              </div>
              <Button
                onClick={handleValidateContent}
                disabled={validateLoading}
              >
                {validateLoading ? "Validation..." : "Valider le contenu"}
              </Button>

              {validationResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Badge
                      className={getRoleBadgeColor(
                        validationResult.detectedRole,
                      )}
                    >
                      Rôle: {validationResult.detectedRole || "Exclu"}
                    </Badge>
                    {validationResult.isValid ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Valide
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">
                        <XCircle className="h-4 w-4 mr-1" />
                        {validationResult.summary.errors} erreur(s),{" "}
                        {validationResult.summary.warnings} warning(s)
                      </Badge>
                    )}
                  </div>

                  {validationResult.violations.length > 0 && (
                    <div className="space-y-2">
                      {validationResult.violations.map((v, i) => (
                        <Alert
                          key={i}
                          variant={
                            v.severity === "error" ? "destructive" : "default"
                          }
                        >
                          {v.severity === "error" ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                          <AlertTitle>{v.type}</AlertTitle>
                          <AlertDescription>{v.message}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Link Checker Tab */}
        <TabsContent value="links">
          <Card>
            <CardHeader>
              <CardTitle>Vérifier un lien</CardTitle>
              <CardDescription>
                Testez si un lien source → target est autorisé selon la
                hiérarchie SEO
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="link-source">URL Source</Label>
                  <Input
                    id="link-source"
                    placeholder="/reference-auto/definition-abs"
                    value={linkSource}
                    onChange={(e) => setLinkSource(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="link-target">URL Cible</Label>
                  <Input
                    id="link-target"
                    placeholder="/pieces/disque-frein/peugeot/308/1.6-hdi.html"
                    value={linkTarget}
                    onChange={(e) => setLinkTarget(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleCheckLink} disabled={linkLoading}>
                {linkLoading ? "Vérification..." : "Vérifier le lien"}
              </Button>

              {linkResult && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={getRoleBadgeColor(linkResult.sourceRole)}
                        >
                          {linkResult.sourceRole || "Exclu"}
                        </Badge>
                        <ArrowRight className="h-4 w-4" />
                        <Badge
                          className={getRoleBadgeColor(linkResult.targetRole)}
                        >
                          {linkResult.targetRole || "Exclu"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {linkResult.isAllowed ? (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="text-green-700 font-medium">
                              Lien autorisé
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-5 w-5 text-red-600" />
                            <span className="text-red-700 font-medium">
                              Lien interdit
                            </span>
                          </>
                        )}
                      </div>
                      {linkResult.violation && (
                        <Alert
                          variant={
                            linkResult.violation.severity === "error"
                              ? "destructive"
                              : "default"
                          }
                        >
                          <Info className="h-4 w-4" />
                          <AlertDescription>
                            {linkResult.violation.message}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Matrix Tab */}
        <TabsContent value="matrix">
          <Card>
            <CardHeader>
              <CardTitle>Matrice des liens autorisés</CardTitle>
              <CardDescription>
                Vue d&apos;ensemble de tous les liens autorisés entre rôles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">De ↓ / Vers →</TableHead>
                      {(matrix.roles as RoleInfo[]).map((role: RoleInfo) => (
                        <TableHead key={role.id} className="text-center">
                          <Badge className={getRoleBadgeColor(role.id)}>
                            {role.id}
                          </Badge>
                          <div className="text-xs font-normal mt-1">
                            {role.label}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(matrix.roles as RoleInfo[]).map((fromRole: RoleInfo) => (
                      <TableRow key={fromRole.id}>
                        <TableCell>
                          <Badge className={getRoleBadgeColor(fromRole.id)}>
                            {fromRole.id}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            {fromRole.label}
                          </div>
                        </TableCell>
                        {(matrix.roles as RoleInfo[]).map(
                          (toRole: RoleInfo) => {
                            const allowed =
                              matrix.table[fromRole.id]?.[toRole.id] || false;
                            const isSame = fromRole.id === toRole.id;
                            return (
                              <TableCell
                                key={toRole.id}
                                className="text-center"
                              >
                                {isSame ? (
                                  <span className="text-muted-foreground">
                                    -
                                  </span>
                                ) : allowed ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-400 mx-auto" />
                                )}
                              </TableCell>
                            );
                          },
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Rules Summary */}
              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(rules.rules || {}).map(
                  ([roleId, rule]: [string, unknown]) => {
                    const ruleData = rule as {
                      label: string;
                      intention: string;
                      description: string;
                      allowedLinks: string[];
                    };
                    return (
                      <Card key={roleId}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Badge className={getRoleBadgeColor(roleId)}>
                              {roleId}
                            </Badge>
                            {ruleData.label}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground mb-2">
                            {ruleData.description}
                          </p>
                          <div className="text-xs">
                            <span className="font-medium">Liens vers: </span>
                            {ruleData.allowedLinks?.length > 0
                              ? ruleData.allowedLinks.join(", ")
                              : "Aucun"}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  },
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
