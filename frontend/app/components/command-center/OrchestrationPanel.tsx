/**
 * OrchestrationPanel — onglet « Orchestration » du Command Center (ADR-087).
 *
 * Deux étages HITL (Human-In-The-Loop), le backend restant seule autorité :
 *  1. PRÉVISUALISER (POST .../shadow) — plan *would-be* + `plan_hash` déterministe,
 *     0 mutation. L'action_id vient du catalogue `available_actions` (#1019), filtré
 *     par kind ; fallback saisie libre. Le serveur valide (400/409/422).
 *  2. APPROUVER + EXÉCUTER (POST .../approve) — visible UNIQUEMENT en mode `approved`,
 *     renvoie le `plan_hash` du plan prévisualisé (garde TOCTOU). L'exécution réelle
 *     ouvre une PR draft (réversible) et exige un 2ᵉ flag executor côté backend
 *     (`COMMAND_CENTER_EXECUTOR=pr`) — sinon 409/501/503 surfacés. Inerte par défaut.
 */
import {
  Activity,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
  Rocket,
} from "lucide-react";
import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export interface AvailableAction {
  kind: string;
  action_id: string;
}

export interface OrchestrationStatus {
  mode: "off" | "shadow" | "approved" | "auto";
  shadow_enabled: boolean;
  supported_kinds: string[];
  /** Catalogue (kind × action_id) fourni par le backend (#1019). Optionnel : si absent
   *  (ancien backend), l'UI retombe sur la saisie texte libre. */
  available_actions?: AvailableAction[];
}

export interface ShadowPlanView {
  action_id: string;
  kind: string;
  summary: string;
  would_change: boolean;
  reversible: boolean;
  details: Record<string, unknown>;
  /** hash déterministe du plan — renvoyé tel quel à approve (garde TOCTOU, HITL). */
  plan_hash: string;
}

/** Reçu d'une exécution approuvée (Phase 2) — ce qui A ÉTÉ fait + comment l'annuler. */
export interface ExecutionReceiptView {
  action_id: string;
  kind: string;
  applied: boolean;
  plan_hash: string;
  reverted_by: string | null;
  details: Record<string, unknown>;
}

export type OrchestrationActionData =
  | { ok: true; intent: "preview"; plan: ShadowPlanView }
  | { ok: true; intent: "approve"; receipt: ExecutionReceiptView }
  | { ok: false; error: string };

function modeBadgeVariant(
  mode: OrchestrationStatus["mode"],
): "secondary" | "success" | "warning" {
  if (mode === "shadow") return "success";
  if (mode === "approved") return "warning"; // mode HITL : peut muter (double-flag)
  return "secondary";
}

/** URL de PR éventuelle portée par le reçu d'exécution (details.pr_url). */
function receiptPrUrl(receipt: ExecutionReceiptView): string | null {
  const u = receipt.details?.pr_url;
  return typeof u === "string" && u.length > 0 ? u : null;
}

export function OrchestrationPanel({
  status,
  result,
}: {
  status: OrchestrationStatus | null;
  result?: OrchestrationActionData;
}) {
  const navigation = useNavigation();
  // Intent en cours de soumission (pour désactiver le bon bouton uniquement).
  const submittingIntent =
    navigation.state === "submitting"
      ? String(navigation.formData?.get("intent") ?? "preview")
      : null;
  const previewing = submittingIntent === "preview";
  const approving = submittingIntent === "approve";
  // Hook AVANT tout early-return (rules of hooks). Vide → défaut dérivé du statut.
  const [kind, setKind] = useState("");

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

  // Kind effectif (état contrôlé, défaut = 1er supporté) + actions du catalogue filtrées.
  const selectedKind = kind || status.supported_kinds[0] || "regen-artifact";
  const actionsForKind = (status.available_actions ?? []).filter(
    (a) => a.kind === selectedKind,
  );

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
            {status.mode === "shadow" ? (
              <span className="text-muted-foreground">
                — calcul <em>would-be</em> uniquement, 0 mutation
                d&apos;artefact.
              </span>
            ) : status.mode === "approved" ? (
              <span className="text-muted-foreground">
                — HITL : prévisualise puis <strong>approuve</strong> pour
                exécuter (ouvre une PR draft ; requiert aussi{" "}
                <code className="text-xs">COMMAND_CENTER_EXECUTOR=pr</code>).
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
            <input type="hidden" name="intent" value="preview" />
            <div className="flex flex-col gap-1">
              <label htmlFor="orch-kind" className="text-sm font-medium">
                Kind
              </label>
              <select
                id="orch-kind"
                name="kind"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={selectedKind}
                onChange={(e) => setKind(e.target.value)}
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
              {actionsForKind.length > 0 ? (
                // Catalogue dispo (#1019) → menu déroulant filtré par kind.
                <select
                  id="orch-action-id"
                  name="action_id"
                  required
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  {actionsForKind.map((a) => (
                    <option key={a.action_id} value={a.action_id}>
                      {a.action_id}
                    </option>
                  ))}
                </select>
              ) : (
                // Fallback (backend sans catalogue) → saisie libre, validée serveur.
                <input
                  id="orch-action-id"
                  name="action_id"
                  required
                  placeholder="regen:command-center-snapshot"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                />
              )}
            </div>
            <Button type="submit" disabled={previewing}>
              {previewing ? "Calcul…" : "Prévisualiser"}
            </Button>
          </Form>
          <p className="mt-2 text-xs text-muted-foreground">
            Exemples : <code>regen:command-center-snapshot</code>{" "}
            (regen-artifact) · <code>pr:command-center-snapshot-refresh</code>{" "}
            (pr-proposition). Le backend valide l&apos;action_id
            (404/400/409/422 surfacés).
          </p>

          {result ? (
            <div className="mt-4 space-y-3">
              {!result.ok ? (
                <Alert
                  variant="error"
                  icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
                >
                  <AlertTitle>Action refusée</AlertTitle>
                  <AlertDescription>{result.error}</AlertDescription>
                </Alert>
              ) : result.intent === "preview" ? (
                <>
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

                  {/* Étape 2 HITL — n'apparaît que si le plan muterait ET mode approved. */}
                  {result.plan.would_change &&
                  result.plan.reversible &&
                  status.mode === "approved" ? (
                    <Form method="post" className="space-y-2">
                      <input type="hidden" name="intent" value="approve" />
                      <input
                        type="hidden"
                        name="kind"
                        value={result.plan.kind}
                      />
                      <input
                        type="hidden"
                        name="action_id"
                        value={result.plan.action_id}
                      />
                      <input
                        type="hidden"
                        name="plan_hash"
                        value={result.plan.plan_hash}
                      />
                      <p className="text-xs text-muted-foreground">
                        L&apos;approbation exécute réellement CE plan (hash{" "}
                        <code className="text-xs">
                          {result.plan.plan_hash.slice(0, 12)}
                        </code>
                        ) : elle <strong>ouvre une PR draft</strong> — rien
                        n&apos;atterrit sur{" "}
                        <code className="text-xs">main</code> sans review +
                        merge humain. Réversible (fermer la PR).
                      </p>
                      <Button
                        type="submit"
                        variant="destructive"
                        disabled={approving}
                      >
                        <Rocket className="mr-2 h-4 w-4" aria-hidden />
                        {approving
                          ? "Exécution…"
                          : "Approuver + exécuter (PR draft)"}
                      </Button>
                    </Form>
                  ) : result.plan.would_change && status.mode !== "approved" ? (
                    <p className="text-xs text-muted-foreground">
                      Pour exécuter ce plan : passe l&apos;orchestration en mode{" "}
                      <code className="text-xs">
                        COMMAND_CENTER_ORCHESTRATION=approved
                      </code>{" "}
                      et active l&apos;executor{" "}
                      <code className="text-xs">
                        COMMAND_CENTER_EXECUTOR=pr
                      </code>{" "}
                      (DEV/PREPROD ; PROD reste forcé <code>off</code>).
                    </p>
                  ) : null}
                </>
              ) : (
                // intent === "approve" → reçu d'exécution.
                <Alert
                  variant={result.receipt.applied ? "success" : "info"}
                  icon={
                    result.receipt.applied ? (
                      <Rocket className="h-5 w-5" aria-hidden />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" aria-hidden />
                    )
                  }
                >
                  <AlertTitle>
                    {result.receipt.applied
                      ? "Exécuté — PR draft ouverte"
                      : "Aucune exécution (no-op, déjà à jour)"}
                  </AlertTitle>
                  <AlertDescription>
                    {receiptPrUrl(result.receipt) ? (
                      <p className="mb-2">
                        PR :{" "}
                        <a
                          href={receiptPrUrl(result.receipt) as string}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium underline"
                        >
                          {receiptPrUrl(result.receipt)}
                        </a>
                      </p>
                    ) : null}
                    {result.receipt.reverted_by ? (
                      <p className="text-xs">
                        Annuler :{" "}
                        <code className="text-xs">
                          {result.receipt.reverted_by}
                        </code>
                      </p>
                    ) : null}
                    <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
                      {JSON.stringify(result.receipt.details, null, 2)}
                    </pre>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
