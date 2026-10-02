import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { z } from "zod";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";

// Validate the fields consumed by this screen, not the business rules owned by Nest.
const gate = z.enum(["PASS", "WARN", "FAIL"]).nullable();
const briefSchema = z.object({
  id: z.string().uuid(),
  agent_id: z.string(),
  business_unit: z.enum(["ECOMMERCE", "LOCAL", "HYBRID"]),
  channel: z.string(),
  conversion_goal: z.enum(["CALL", "VISIT", "QUOTE", "ORDER"]),
  cta: z.string(),
  target_segment: z.string(),
  payload: z.record(z.string(), z.unknown()),
  coverage_manifest: z.record(z.string(), z.unknown()),
  brand_gate_level: gate,
  compliance_gate_level: gate,
  gate_summary: z.record(z.string(), z.unknown()).nullable(),
  status: z.enum(["draft", "reviewed", "approved", "published", "archived"]),
  reviewed_by: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  approved_by: z.string().nullable(),
  approved_at: z.string().nullable(),
  published_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
const envelope = z.object({ success: z.literal(true), data: briefSchema });
const nextStatusSchema = z.enum([
  "reviewed",
  "approved",
  "published",
  "archived",
]);
type Brief = z.infer<typeof briefSchema>;
type NextStatus = z.infer<typeof nextStatusSchema>;

function errorMessage(status: number, reason?: unknown): string {
  if (status === 400)
    return "La demande est invalide. Vérifiez le brief et les confirmations.";
  if (status === 401)
    return "Reconnectez-vous pour consulter ou valider ce brief.";
  if (status === 403)
    return "Vous n’avez pas l’autorisation d’effectuer cette action.";
  if (status === 404) return "Ce brief est introuvable.";
  if (status === 409)
    return "Le brief a changé ou cette transition est interdite. Rechargez-le avant de réessayer.";
  if (status === 422) {
    if (reason === "local_canon_unvalidated")
      return "Le contexte local n’est pas validé. La progression du brief est bloquée.";
    if (reason === "marketing_gates_not_passed")
      return "Les contrôles marketing ne permettent pas la progression du brief.";
    if (reason === "marketing_brief_invalid")
      return "Le brief ne respecte pas les contraintes métier. Sa progression est bloquée.";
    return "La progression est refusée par les contrôles métier.";
  }
  return "Impossible de confirmer l’opération. Rechargez le brief pour vérifier son état avant de réessayer.";
}

async function apiError(res: Response) {
  const status = res.status >= 400 && res.status <= 599 ? res.status : 502;
  let reason: unknown;
  if (status === 422) {
    try {
      const body: unknown = await res.json();
      if (body && typeof body === "object" && "message" in body)
        reason = body.message;
    } catch {
      /* Only public allowlisted reasons are exposed. */
    }
  }
  return { status, message: errorMessage(status, reason) };
}

async function readBrief(res: Response, id: string): Promise<Brief | null> {
  try {
    const parsed = envelope.safeParse(await res.json());
    return parsed.success && parsed.data.data.id === id
      ? parsed.data.data
      : null;
  } catch {
    return null;
  }
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const fail = (status: number, error = errorMessage(status)) =>
    data(
      { brief: null, error },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  const id = z.string().uuid().safeParse(params.id);
  if (!id.success) return fail(400);
  let res: Response;
  try {
    res = await fetch(
      getInternalApiUrlFromRequest(
        `/api/admin/marketing/briefs/${id.data}`,
        request,
      ),
      {
        headers: { Cookie: request.headers.get("Cookie") || "" },
      },
    );
  } catch {
    return fail(503);
  }
  if (!res.ok) {
    const error = await apiError(res);
    return fail(error.status, error.message);
  }
  const brief = await readBrief(res, id.data);
  if (!brief) return fail(502);
  return data(
    { brief, error: null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function action({ request, params }: ActionFunctionArgs) {
  const fail = (status: number, error = errorMessage(status)) =>
    data({ error }, { status, headers: { "Cache-Control": "no-store" } });
  if (request.method !== "POST") return fail(405);
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return fail(403);
  const id = z.string().uuid().safeParse(params.id);
  if (!id.success) return fail(400);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400);
  }
  const status = nextStatusSchema.safeParse(form.get("status"));
  if (!status.success || form.getAll("status").length !== 1) return fail(400);
  if (
    (status.data === "published" || status.data === "archived") &&
    form.get("confirmed") !== "yes"
  )
    return fail(400);
  let res: Response;
  try {
    res = await fetch(
      getInternalApiUrlFromRequest(
        `/api/admin/marketing/briefs/${id.data}/status`,
        request,
      ),
      {
        method: "PATCH",
        headers: {
          Cookie: request.headers.get("Cookie") || "",
          "Content-Type": "application/json",
        },
        // Actor and business preconditions belong exclusively to the existing backend.
        body: JSON.stringify({ status: status.data }),
      },
    );
  } catch {
    return fail(503);
  }
  if (!res.ok) {
    const error = await apiError(res);
    return fail(error.status, error.message);
  }
  const brief = await readBrief(res, id.data);
  if (!brief || brief.status !== status.data) return fail(502);
  return redirect(`/admin/marketing/briefs/${id.data}`, 303);
}

// Presentation only: NestJS checks the current status, gates and concurrent writes.
const actions: Record<Brief["status"], NextStatus[]> = {
  draft: ["reviewed", "archived"],
  reviewed: ["approved", "archived"],
  approved: ["published", "archived"],
  published: ["archived"],
  archived: [],
};
const labels: Record<NextStatus | "draft", string> = {
  draft: "Brouillon",
  reviewed: "Revu",
  approved: "Approuvé",
  published: "Déclaré publié",
  archived: "Archivé",
};
const actionLabels: Record<NextStatus, string> = {
  reviewed: "Revoir",
  approved: "Approuver",
  published: "Déclarer publié",
  archived: "Archiver",
};

export default function MarketingBriefDetail() {
  const { brief, error } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  return (
    <div className="space-y-6">
      <Link to="/admin/marketing/briefs" className="underline">
        Retour aux briefs
      </Link>
      {(error || result?.error) && (
        <div role="alert" className="rounded border border-destructive p-4">
          <p>{error || result?.error}</p>
          <Link to="." reloadDocument className="underline">
            Recharger le brief
          </Link>
        </div>
      )}
      {brief && (
        <>
          <header className="space-y-2">
            <h2 className="text-2xl font-semibold">{brief.cta}</h2>
            <Badge>{labels[brief.status]}</Badge>
            <p>
              {brief.business_unit} · {brief.channel} · {brief.conversion_goal}
            </p>
            <p>Public : {brief.target_segment}</p>
            <p className="text-sm text-muted-foreground">
              Agent : {brief.agent_id} · Référence : {brief.id}
            </p>
          </header>
          <Card>
            <CardHeader>
              <CardTitle>
                <h3>Contenu du brief</h3>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap break-words text-sm">
                {JSON.stringify(brief.payload, null, 2)}
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h3>Contrôles enregistrés</h3>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>Marque : {brief.brand_gate_level ?? "Non renseigné"}</p>
              <p>
                Conformité : {brief.compliance_gate_level ?? "Non renseigné"}
              </p>
              <pre className="whitespace-pre-wrap break-words text-sm">
                {brief.gate_summary
                  ? JSON.stringify(brief.gate_summary, null, 2)
                  : "Aucun détail enregistré."}
              </pre>
              <p className="text-sm">
                Le serveur revérifie les conditions métier à chaque progression
                ; ces résultats enregistrés ne garantissent pas son
                autorisation.
              </p>
              <details>
                <summary className="cursor-pointer">
                  Périmètre et limites de l’analyse
                </summary>
                <pre className="whitespace-pre-wrap break-words text-sm">
                  {JSON.stringify(brief.coverage_manifest, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h3>Historique des validations</h3>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Création : {brief.created_at}</p>
              <p>Dernière modification : {brief.updated_at}</p>
              <p>
                Revue : {brief.reviewed_by ?? "Non renseignée"} ·{" "}
                {brief.reviewed_at ?? "—"}
              </p>
              <p>
                Approbation : {brief.approved_by ?? "Non renseignée"} ·{" "}
                {brief.approved_at ?? "—"}
              </p>
              <p>
                Publication déclarée : {brief.published_at ?? "Non renseignée"}
              </p>
            </CardContent>
          </Card>
          <section
            aria-label="Actions humaines"
            className="space-y-4"
            key={`${brief.id}:${brief.updated_at}`}
          >
            <h3 className="text-lg font-semibold">Actions humaines</h3>
            <p>
              Déclarer publié enregistre une déclaration manuelle : aucune
              publication automatique n’est effectuée.
            </p>
            {brief.status === "archived" && (
              <p>Ce brief est archivé. Aucune transition disponible.</p>
            )}
            {actions[brief.status].map((status) => (
              <Form
                method="post"
                key={status}
                className="space-y-2 rounded border p-4"
              >
                <input type="hidden" name="status" value={status} />
                {(status === "published" || status === "archived") && (
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="confirmed"
                      value="yes"
                      required
                      disabled={busy}
                    />
                    {status === "published"
                      ? "Je confirme qu’une publication a été réalisée hors de cet outil."
                      : "Je confirme l’archivage de ce brief, sans transition de retour disponible."}
                  </label>
                )}
                <Button
                  type="submit"
                  disabled={busy}
                  variant={status === "archived" ? "outline" : "default"}
                >
                  {actionLabels[status]}
                </Button>
              </Form>
            ))}
            {busy && <p role="status">Opération en cours…</p>}
          </section>
        </>
      )}
    </div>
  );
}
