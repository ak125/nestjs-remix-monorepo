/**
 * OrchestrationPanel — onglet « Orchestration » du Command Center (ADR-087, shadow).
 *
 * Read-only + preview. Affiche le mode d'orchestration courant (off|shadow|…) et les
 * kinds supportés, et permet de PRÉVISUALISER un plan *would-be* (POST .../shadow) —
 * 0 mutation d'artefact. Le backend reste la source de vérité : l'action_id est en
 * texte libre, validé côté serveur (400 si inconnu, 409 si mode ≠ shadow, 422 si
 * dry-run KO) — pas de catalogue dupliqué ici.
 */
import {
  Activity,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Form, useNavigation } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export interface OrchestrationStatus {
  mode: "off" | "shadow" | "approved" | "auto";
  shadow_enabled: boolean;
  supported_kinds: string[];
}

export interface ShadowPlanView {
  action_id: string;
  kind: string;
  summary: string;
  would_change: boolean;
  reversible: boolean;
  details: Record<string, unknown>;
}

export type OrchestrationActionData =
  | { ok: true; plan: ShadowPlanView }
  | { ok: false; error: string };

function modeBadgeVariant(
  mode: OrchestrationStatus["mode"],
): "secondary" | "success" {
  return mode === "shadow" ? "success" : "secondary";
}

export function OrchestrationPanel({
  status,
  result,
}: {
  status: OrchestrationStatus | null;
  result?: OrchestrationActionData;
}) {
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  if (!status) {
    return (
      <Alert
        variant="info"
        icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
      >
        <AlertTitle>Orchestration indisponible</AlertTitle>
        <AlertDescription>
          L&apos;API d&apos;orchestration n&apos;est pas exposée dans cet
          environnement (Command Center désactivé, ou backend antérieur à
          ADR-087).
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" aria-hidden /> Orchestration (ADR-087)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Mode :</span>
            <Badge variant={modeBadgeVariant(status.mode)}>{status.mode}</Badge>
            {status.shadow_enabled ? (
              <span className="text-muted-foreground">
                — calcul <em>would-be</em> uniquement, 0 mutation
                d&apos;artefact.
              </span>
            ) : (
              <span className="text-muted-foreground">
                — inactif (défaut). Active via{" "}
                <code className="text-xs">
                  COMMAND_CENTER_ORCHESTRATION=shadow
                </code>{" "}
                en DEV/PREPROD ; PROD est forcé{" "}
                <code className="text-xs">off</code>.
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Kinds supportés :</span>
            {status.supported_kinds.length > 0 ? (
              status.supported_kinds.map((k) => (
                <Badge key={k} variant="outline">
                  {k}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">aucun</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlayCircle className="h-4 w-4" aria-hidden /> Prévisualiser un plan
            (shadow)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form
            method="post"
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="orch-kind" className="text-sm font-medium">
                Kind
              </label>
              <select
                id="orch-kind"
                name="kind"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                defaultValue={status.supported_kinds[0] ?? "regen-artifact"}
              >
                {status.supported_kinds.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="orch-action-id" className="text-sm font-medium">
                action_id
              </label>
              <input
                id="orch-action-id"
                name="action_id"
                required
                placeholder="regen:command-center-snapshot"
                className="h-9 rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Calcul…" : "Prévisualiser"}
            </Button>
          </Form>
          <p className="mt-2 text-xs text-muted-foreground">
            Exemples : <code>regen:command-center-snapshot</code>{" "}
            (regen-artifact) · <code>pr:command-center-snapshot-refresh</code>{" "}
            (pr-proposition). Le backend valide l&apos;action_id
            (404/400/409/422 surfacés).
          </p>

          {result ? (
            <div className="mt-4">
              {result.ok ? (
                <Alert
                  variant={result.plan.would_change ? "warning" : "success"}
                  icon={
                    result.plan.would_change ? (
                      <AlertTriangle className="h-5 w-5" aria-hidden />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" aria-hidden />
                    )
                  }
                >
                  <AlertTitle>
                    {result.plan.would_change
                      ? "Changement détecté (would-be)"
                      : "Aucun changement (déjà à jour)"}
                  </AlertTitle>
                  <AlertDescription>
                    <p className="mb-2">{result.plan.summary}</p>
                    <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
                      {JSON.stringify(result.plan.details, null, 2)}
                    </pre>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert
                  variant="error"
                  icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
                >
                  <AlertTitle>Prévisualisation refusée</AlertTitle>
                  <AlertDescription>{result.error}</AlertDescription>
                </Alert>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
