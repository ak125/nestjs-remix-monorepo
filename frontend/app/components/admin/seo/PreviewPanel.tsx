/**
 * PreviewPanel - Preview et validation pour contenu SEO R4/R5
 *
 * Affiche une prévisualisation du contenu avec checklist de validation SEO
 * Utilisé dans le générateur et les formulaires d'édition
 */

import {
  Check,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Gauge,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

export type ContentType = "r4" | "r5";

export interface R4Content {
  slug: string;
  title: string;
  metaDescription?: string | null;
  definition: string;
  roleMecanique?: string | null;
  composition?: string[] | null;
  confusionsCourantes?: string[] | null;
  symptomesAssocies?: string[] | null;
  contentHtml?: string | null;
  pgId?: number | null;
  isPublished?: boolean;
}

export interface R5Content {
  slug: string;
  title: string;
  metaDescription?: string | null;
  observableType: string;
  perceptionChannel: string;
  riskLevel: string;
  safetyGate: string;
  symptomDescription: string;
  signDescription?: string | null;
  clusterId?: string | null;
  relatedGammes?: number[] | null;
  relatedReferences?: string[] | null;
  isPublished?: boolean;
}

export interface ValidationCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: "error" | "warning" | "info";
  message?: string;
}

export interface PreviewPanelProps {
  type: ContentType;
  content: R4Content | R5Content;
  onApprove?: () => void;
  onReject?: (reason: string) => void;
  onEdit?: () => void;
  showActions?: boolean;
  className?: string;
}

/**
 * Validates R4 Reference content
 */
function validateR4(content: R4Content): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  // Title validation
  const titleLength = content.title?.length || 0;
  checks.push({
    id: "title-length",
    label: "Titre < 70 caractères",
    passed: titleLength > 0 && titleLength <= 70,
    severity:
      titleLength === 0 ? "error" : titleLength > 70 ? "warning" : "info",
    message: `${titleLength}/70 caractères`,
  });

  // Meta description validation
  const metaLength = content.metaDescription?.length || 0;
  checks.push({
    id: "meta-length",
    label: "Meta description < 160 caractères",
    passed: metaLength > 0 && metaLength <= 160,
    severity:
      metaLength === 0 ? "warning" : metaLength > 160 ? "warning" : "info",
    message: `${metaLength}/160 caractères`,
  });

  // Definition validation
  const defLength = content.definition?.length || 0;
  checks.push({
    id: "definition",
    label: "Définition présente (min 50 car.)",
    passed: defLength >= 50,
    severity: defLength < 50 ? "error" : "info",
    message: `${defLength} caractères`,
  });

  // Slug format
  const slugValid = /^[a-z0-9-]+$/.test(content.slug || "");
  checks.push({
    id: "slug-format",
    label: "Slug format valide (kebab-case)",
    passed: slugValid,
    severity: slugValid ? "info" : "error",
  });

  // Composition
  const hasComposition = (content.composition?.length || 0) > 0;
  checks.push({
    id: "composition",
    label: "Composition renseignée",
    passed: hasComposition,
    severity: hasComposition ? "info" : "warning",
    message: hasComposition
      ? `${content.composition?.length} éléments`
      : "Optionnel",
  });

  // R5 links
  const hasR5Links = (content.symptomesAssocies?.length || 0) > 0;
  checks.push({
    id: "r5-links",
    label: "Symptômes R5 liés",
    passed: hasR5Links,
    severity: hasR5Links ? "info" : "warning",
    message: hasR5Links
      ? `${content.symptomesAssocies?.length} liens`
      : "Recommandé",
  });

  return checks;
}

/**
 * Validates R5 Diagnostic content
 */
function validateR5(content: R5Content): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  // Title validation
  const titleLength = content.title?.length || 0;
  checks.push({
    id: "title-length",
    label: "Titre < 70 caractères",
    passed: titleLength > 0 && titleLength <= 70,
    severity:
      titleLength === 0 ? "error" : titleLength > 70 ? "warning" : "info",
    message: `${titleLength}/70 caractères`,
  });

  // Meta description validation
  const metaLength = content.metaDescription?.length || 0;
  checks.push({
    id: "meta-length",
    label: "Meta description < 160 caractères",
    passed: metaLength > 0 && metaLength <= 160,
    severity:
      metaLength === 0 ? "warning" : metaLength > 160 ? "warning" : "info",
    message: `${metaLength}/160 caractères`,
  });

  // Symptom description
  const symptomLength = content.symptomDescription?.length || 0;
  checks.push({
    id: "symptom-desc",
    label: "Description symptôme présente",
    passed: symptomLength >= 20,
    severity: symptomLength < 20 ? "error" : "info",
    message: `${symptomLength} caractères`,
  });

  // Observable type
  const validTypes = ["symptom", "sign", "dtc"];
  checks.push({
    id: "observable-type",
    label: "Type observable valide",
    passed: validTypes.includes(content.observableType),
    severity: validTypes.includes(content.observableType) ? "info" : "error",
    message: content.observableType,
  });

  // Safety gate
  const validGates = ["none", "warning", "stop_soon", "stop_immediate"];
  checks.push({
    id: "safety-gate",
    label: "Safety gate définie",
    passed: validGates.includes(content.safetyGate),
    severity: validGates.includes(content.safetyGate) ? "info" : "error",
    message: content.safetyGate,
  });

  // Related gammes
  const hasGammes = (content.relatedGammes?.length || 0) > 0;
  checks.push({
    id: "related-gammes",
    label: "Gammes liées",
    passed: hasGammes,
    severity: hasGammes ? "info" : "warning",
    message: hasGammes
      ? `${content.relatedGammes?.length} gamme(s)`
      : "Recommandé",
  });

  return checks;
}

/**
 * Calculate SEO score from validation checks
 */
function calculateScore(checks: ValidationCheck[]): number {
  const weights = {
    error: 0,
    warning: 0.5,
    info: 1,
  };

  let totalWeight = 0;
  let earnedWeight = 0;

  for (const check of checks) {
    const weight =
      check.severity === "error" ? 2 : check.severity === "warning" ? 1.5 : 1;
    totalWeight += weight;
    if (check.passed) {
      earnedWeight +=
        weight *
        weights[
          check.severity === "error" && check.passed ? "info" : check.severity
        ];
    }
  }

  return Math.round((earnedWeight / totalWeight) * 100);
}

export function PreviewPanel({
  type,
  content,
  onApprove,
  onReject,
  onEdit,
  showActions = true,
  className,
}: PreviewPanelProps) {
  const [showPreview, setShowPreview] = useState(true);
  const [rejectReason, _setRejectReason] = useState("");

  const isR4 = type === "r4";
  const r4Content = isR4 ? (content as R4Content) : null;
  const r5Content = !isR4 ? (content as R5Content) : null;

  const checks = isR4 ? validateR4(r4Content!) : validateR5(r5Content!);
  const score = calculateScore(checks);
  const hasErrors = checks.some((c) => !c.passed && c.severity === "error");
  const hasWarnings = checks.some((c) => !c.passed && c.severity === "warning");

  const scoreColor =
    score >= 80
      ? "text-green-600"
      : score >= 60
        ? "text-yellow-600"
        : "text-red-600";
  const progressColor =
    score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500";

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            {isR4 ? (
              <FileText className="h-5 w-5 text-blue-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            )}
            Preview {isR4 ? "R4 Reference" : "R5 Diagnostic"}
          </CardTitle>
          <Badge
            variant={content.isPublished ? "default" : "secondary"}
            className={content.isPublished ? "bg-green-100 text-green-800" : ""}
          >
            {content.isPublished ? "Publié" : "Brouillon"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <Gauge className={cn("h-4 w-4", scoreColor)} />
                  <span className={cn("font-bold", scoreColor)}>{score}%</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Score SEO</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress value={score} className={cn("h-2", progressColor)} />
          <p className="text-xs text-muted-foreground">
            {hasErrors
              ? "Corrigez les erreurs avant publication"
              : hasWarnings
                ? "Quelques améliorations recommandées"
                : "Contenu prêt pour publication"}
          </p>
        </div>

        <Separator />

        {/* Validation Checklist */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Validation SEO</h4>
          <div className="grid gap-1">
            {checks.map((check) => (
              <div
                key={check.id}
                className={cn(
                  "flex items-center justify-between py-1 px-2 rounded text-sm",
                  !check.passed &&
                    check.severity === "error" &&
                    "bg-red-50 dark:bg-red-900/20",
                  !check.passed &&
                    check.severity === "warning" &&
                    "bg-yellow-50 dark:bg-yellow-900/20",
                )}
              >
                <div className="flex items-center gap-2">
                  {check.passed ? (
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                  ) : check.severity === "error" ? (
                    <X className="h-4 w-4 text-red-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                  )}
                  <span className={cn(!check.passed && "font-medium")}>
                    {check.label}
                  </span>
                </div>
                {check.message && (
                  <span className="text-xs text-muted-foreground">
                    {check.message}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Content Preview */}
        {showPreview && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Aperçu SERP
            </h4>
            <div className="rounded-lg border p-4 bg-white dark:bg-gray-950">
              {/* Google-style preview */}
              <div className="space-y-1">
                <p className="text-xs text-green-700 dark:text-green-400 font-mono">
                  automecanik.fr › {isR4 ? "reference-auto" : "diagnostic-auto"}{" "}
                  › {content.slug}
                </p>
                <h3 className="text-lg text-blue-800 dark:text-blue-400 hover:underline cursor-pointer">
                  {content.title || "Titre manquant"}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {content.metaDescription ||
                    (isR4
                      ? r4Content?.definition?.slice(0, 160)
                      : r5Content?.symptomDescription?.slice(0, 160)) ||
                    "Meta description manquante"}
                </p>
              </div>
            </div>

            {/* Content details */}
            <ScrollArea className="h-[200px] rounded-md border p-4">
              {isR4 && r4Content && (
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Définition</p>
                    <p className="whitespace-pre-line">
                      {r4Content.definition}
                    </p>
                  </div>
                  {r4Content.roleMecanique && (
                    <div>
                      <p className="text-muted-foreground mb-1">
                        Rôle mécanique
                      </p>
                      <p className="whitespace-pre-line">
                        {r4Content.roleMecanique}
                      </p>
                    </div>
                  )}
                  {r4Content.composition &&
                    r4Content.composition.length > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-1">
                          Composition
                        </p>
                        <ul className="list-disc pl-4">
                          {r4Content.composition.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}

              {!isR4 && r5Content && (
                <div className="space-y-4 text-sm">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">{r5Content.observableType}</Badge>
                    <Badge variant="outline">
                      {r5Content.perceptionChannel}
                    </Badge>
                    <Badge
                      className={cn(
                        r5Content.safetyGate === "stop_immediate" &&
                          "bg-red-100 text-red-800",
                        r5Content.safetyGate === "stop_soon" &&
                          "bg-orange-100 text-orange-800",
                        r5Content.safetyGate === "warning" &&
                          "bg-yellow-100 text-yellow-800",
                      )}
                    >
                      {r5Content.safetyGate}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">
                      Description symptôme
                    </p>
                    <p className="whitespace-pre-line">
                      {r5Content.symptomDescription}
                    </p>
                  </div>
                  {r5Content.signDescription && (
                    <div>
                      <p className="text-muted-foreground mb-1">
                        Description signe
                      </p>
                      <p className="whitespace-pre-line">
                        {r5Content.signDescription}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-2">
                {onEdit && (
                  <Button variant="outline" size="sm" onClick={onEdit}>
                    Modifier
                  </Button>
                )}
                <Button variant="ghost" size="sm" asChild>
                  <a
                    href={`/${isR4 ? "reference-auto" : "diagnostic-auto"}/${content.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Voir page
                  </a>
                </Button>
              </div>
              <div className="flex gap-2">
                {onReject && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600"
                    onClick={() => onReject(rejectReason || "Non spécifié")}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Rejeter
                  </Button>
                )}
                {onApprove && (
                  <Button
                    size="sm"
                    disabled={hasErrors}
                    onClick={onApprove}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approuver
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
