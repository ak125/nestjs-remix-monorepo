import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  redirect,
} from "react-router";
import { z } from "zod";
import { requireAdmin } from "~/auth/unified.server";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  briefDecisionSchema,
  briefDetailResponseSchema,
  briefDetailSchema,
  briefSocialLinkSchema,
  briefSocialReceiptSchema,
  socialLinkCandidateSchema,
  socialWeekSchema,
} from "~/services/api/marketing-briefs.api";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";

export const headers = () => ({ "Cache-Control": "private, no-store" });

async function loadSocial(
  brief: z.infer<typeof briefDetailSchema>,
  request: Request,
) {
  const week = new URL(request.url).searchParams.get("week") ?? "";
  const result = {
    week,
    candidates: [] as z.infer<typeof socialLinkCandidateSchema>[],
    error: null as string | null,
  };
  if (
    brief.status !== "approved" ||
    !["social_facebook", "social_instagram"].includes(brief.channel)
  )
    return result;
  if (!brief.social_post_id && !week) return result;
  if (!brief.social_post_id && !socialWeekSchema.safeParse(week).success)
    return { ...result, error: "Choisissez une semaine valide." };
  try {
    const path = brief.social_post_id
      ? `/api/admin/marketing/social/posts/${brief.social_post_id}`
      : `/api/admin/marketing/social/posts?${new URLSearchParams({ week })}`;
    const response = await fetch(getInternalApiUrlFromRequest(path, request), {
      headers: { Cookie: request.headers.get("Cookie") || "" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Unavailable source");
    const json = await response.json();
    const candidates = z
      .array(socialLinkCandidateSchema)
      .parse(brief.social_post_id ? [json.data] : json.data);
    const channel = brief.channel.replace("social_", "");
    return {
      ...result,
      candidates: candidates.filter(
        (post) =>
          (!brief.social_post_id || post.id === brief.social_post_id) &&
          (brief.social_post_id || post.week_iso === week) &&
          !post.source_brief &&
          !["published", "archived"].includes(post.status) &&
          post.channels_list.includes(channel) &&
          !!post.channels[channel]?.caption?.trim(),
      ),
    };
  } catch {
    return {
      ...result,
      error:
        "Contenus sociaux indisponibles. Rechargez avant tout raccordement.",
    };
  }
}

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  await requireAdmin({ context });
  const unavailable = {
    brief: null,
    review: null,
    error: "Détail du brief indisponible. Réessayez le chargement.",
    social: {
      week: "",
      candidates: [] as z.infer<typeof socialLinkCandidateSchema>[],
      error: null as string | null,
    },
  };
  if (!z.string().uuid().safeParse(params.id).success)
    return { ...unavailable, error: "Brief introuvable." };
  try {
    const response = await fetch(
      getInternalApiUrlFromRequest(
        `/api/admin/marketing/briefs/${params.id}`,
        request,
      ),
      {
        headers: { Cookie: request.headers.get("Cookie") || "" },
        cache: "no-store",
      },
    );
    if (response.status === 404)
      return { ...unavailable, error: "Brief introuvable." };
    if (!response.ok) return unavailable;
    const parsed = briefDetailResponseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.data.id !== params.id)
      return unavailable;
    return {
      brief: parsed.data.data,
      review: parsed.data.review,
      error: null,
      social: await loadSocial(parsed.data.data, request),
    };
  } catch {
    return unavailable;
  }
}

export async function action({ request, context, params }: ActionFunctionArgs) {
  await requireAdmin({ context });
  if (request.method !== "POST") throw new Response(null, { status: 405 });
  if (request.headers.get("Origin") !== new URL(request.url).origin)
    throw new Response(null, { status: 403 });
  if (!z.string().uuid().safeParse(params.id).success)
    return { error: "Identifiant de brief invalide." };
  const fields = Object.fromEntries(await request.formData());
  if (fields.intent === "link-social") {
    const values = { ...fields };
    delete values.intent;
    const link = briefSocialLinkSchema.safeParse(values);
    if (!link.success)
      return {
        error: "Raccordement invalide. Rechargez le brief et le contenu.",
      };
    try {
      const response = await fetch(
        getInternalApiUrlFromRequest(
          `/api/admin/marketing/briefs/${params.id}/social-content`,
          request,
        ),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: request.headers.get("Cookie") || "",
          },
          body: JSON.stringify(link.data),
        },
      );
      if (response.status === 409)
        return {
          error:
            "Le brief, le contenu ou ses décisions ont changé. Rechargez avant de raccorder.",
        };
      if (response.status === 400)
        return {
          error:
            "Raccordement refusé. Vérifiez l’approbation du brief et le réseau du contenu.",
        };
      if (!response.ok) throw new Error("Unconfirmed association");
      const receipt = briefSocialReceiptSchema.parse(await response.json());
      if (
        receipt.data.id !== link.data.post_id ||
        receipt.data.source_brief.brief.id !== params.id ||
        receipt.data.source_brief.linked_content_revision !==
          link.data.content_revision + 1 ||
        receipt.data.content_revision < link.data.content_revision + 1 ||
        receipt.data.review_version < link.data.review_version + 1
      )
        throw new Error("Unexpected association");
      return redirect(
        `/admin/marketing/social-hub/posts?${new URLSearchParams({ week: receipt.data.week_iso, post_id: String(receipt.data.id) })}`,
      );
    } catch {
      return {
        error:
          "Raccordement non confirmé. Rechargez le brief pour vérifier son lien avant de réessayer.",
      };
    }
  }
  const parsed = briefDecisionSchema.safeParse(fields);
  if (!parsed.success)
    return {
      error: "Décision invalide. Rechargez le brief avant de réessayer.",
    };
  try {
    const response = await fetch(
      getInternalApiUrlFromRequest(
        `/api/admin/marketing/briefs/${params.id}/status`,
        request,
      ),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("Cookie") || "",
        },
        body: JSON.stringify(parsed.data),
      },
    );
    if (response.status === 409)
      return {
        error:
          "Le brief a été modifié ou cette transition est refusée. Rechargez-le et vérifiez son état avant une nouvelle décision.",
      };
    if (response.status === 400)
      return {
        error:
          "La décision est refusée : vérifiez le contenu, la revue et les contrôles du brief.",
      };
    if (!response.ok)
      return {
        error:
          "Décision non confirmée. Rechargez le brief pour vérifier son état.",
      };
    const result = z
      .object({ success: z.literal(true), data: briefDetailSchema })
      .safeParse(await response.json());
    if (
      !result.success ||
      result.data.data.id !== params.id ||
      result.data.data.status !== parsed.data.status
    )
      return {
        error:
          "Décision non confirmée. Rechargez le brief pour vérifier son état.",
      };
    return { error: null };
  } catch {
    return {
      error:
        "Décision non confirmée. Rechargez le brief pour vérifier son état.",
    };
  }
}

const labels = {
  reviewed: "Marquer comme revu",
  approved: "Approuver le brief",
  archived: "Archiver le brief",
};

export default function MarketingBriefDetail() {
  const { brief, review, error, social } = useLoaderData<typeof loader>();
  const decision = useActionData<typeof action>();
  const navigation = useNavigation();
  return (
    <div className="space-y-4">
      <Link to="/admin/marketing/briefs" className="underline">
        Retour aux briefs
      </Link>
      <h2 className="text-2xl font-semibold">Détail du brief</h2>
      {error || !brief || !review ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{brief.cta}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge>{brief.status}</Badge>
                <Badge variant="outline">{brief.business_unit}</Badge>
                <Badge variant="outline">{brief.channel}</Badge>
              </div>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt>Objectif</dt>
                  <dd>{brief.conversion_goal}</dd>
                </div>
                <div>
                  <dt>Audience</dt>
                  <dd>{brief.target_segment}</dd>
                </div>
                <div>
                  <dt>Agent source</dt>
                  <dd>{brief.agent_id}</dd>
                </div>
                <div>
                  <dt>Version affichée</dt>
                  <dd className="break-all">{brief.updated_at}</dd>
                </div>
              </dl>
              {brief.social_post_id && (
                <p>
                  Contenu social associé : #{brief.social_post_id}.{" "}
                  <Link
                    className="underline"
                    to={`/admin/marketing/social-hub/posts?post_id=${brief.social_post_id}`}
                  >
                    Ouvrir le Social Hub
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>
          {brief.status === "approved" &&
            ["social_facebook", "social_instagram"].includes(brief.channel) &&
            (!brief.social_post_id ||
              social.candidates.length > 0 ||
              social.error) && (
              <Card>
                <CardHeader>
                  <CardTitle>Raccorder au Social Hub</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p>
                    Choisissez le contenu existant correspondant à ce brief. Le
                    raccordement conserve la source approuvée dans une nouvelle
                    version. Chaque réseau devra ensuite être contrôlé et
                    approuvé sur cette version.
                  </p>
                  {!brief.social_post_id && (
                    <Form method="get" className="flex flex-wrap gap-2">
                      <label>
                        Semaine des contenus{" "}
                        <input
                          type="week"
                          name="week"
                          required
                          defaultValue={social.week}
                          className="rounded border p-2"
                        />
                      </label>
                      <Button variant="outline">Consulter les contenus</Button>
                    </Form>
                  )}
                  {social.error && <p role="alert">{social.error}</p>}
                  {social.week &&
                    !social.error &&
                    !brief.social_post_id &&
                    social.candidates.length === 0 && (
                      <p>
                        Aucun contenu compatible disponible pour cette semaine.
                        Consultez les contenus dans le Social Hub.
                      </p>
                    )}
                  {social.candidates.map((post) => (
                    <Form
                      method="post"
                      key={post.id}
                      className="space-y-2 rounded border p-3"
                    >
                      <p>
                        Contenu #{post.id} · {post.week_iso} · version{" "}
                        {post.content_revision} · décision {post.review_version}
                      </p>
                      <p className="whitespace-pre-wrap">
                        {
                          post.channels[brief.channel.replace("social_", "")]
                            ?.caption
                        }
                      </p>
                      <input type="hidden" name="intent" value="link-social" />
                      <input type="hidden" name="post_id" value={post.id} />
                      <input
                        type="hidden"
                        name="expected_updated_at"
                        value={brief.updated_at}
                      />
                      <input
                        type="hidden"
                        name="content_revision"
                        value={post.content_revision}
                      />
                      <input
                        type="hidden"
                        name="review_version"
                        value={post.review_version}
                      />
                      <Button disabled={navigation.state !== "idle"}>
                        Raccorder le contenu #{post.id}
                      </Button>
                    </Form>
                  ))}
                </CardContent>
              </Card>
            )}
          <Card>
            <CardHeader>
              <CardTitle>Contenu et preuves</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="font-semibold">Contenu proposé</h3>
              <pre className="whitespace-pre-wrap break-words text-sm">
                {JSON.stringify(brief.payload, null, 2)}
              </pre>
              <h3 className="font-semibold">Périmètre et limites déclarés</h3>
              <pre className="whitespace-pre-wrap break-words text-sm">
                {JSON.stringify(brief.coverage_manifest, null, 2)}
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Revue et approbation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p>
                Marque : {brief.brand_gate_level ?? "Non évaluée"} · Conformité
                : {brief.compliance_gate_level ?? "Non évaluée"}
              </p>
              <details>
                <summary>Détail des contrôles enregistrés</summary>
                <pre className="whitespace-pre-wrap break-words text-sm">
                  {JSON.stringify(brief.gate_summary, null, 2)}
                </pre>
              </details>
              <p>
                Revue :{" "}
                {brief.reviewed_by
                  ? `${brief.reviewed_by} · ${brief.reviewed_at ?? "date inconnue"}`
                  : "Non enregistrée"}
              </p>
              <p>
                Approbation :{" "}
                {brief.approved_by
                  ? `${brief.approved_by} · ${brief.approved_at ?? "date inconnue"}`
                  : "Non enregistrée"}
              </p>
              <p className="text-sm text-muted-foreground">
                L’approbation porte sur ce brief. Elle ne publie aucun contenu
                et ne remplace pas les validations par réseau dans le Social
                Hub.
              </p>
              {review.blocked_reason && <p>{review.blocked_reason}</p>}
              {decision?.error && (
                <p role="alert" className="text-destructive">
                  {decision.error}
                </p>
              )}
              {decision && decision.error === null && (
                <p role="status">Décision enregistrée.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {review.allowed_actions.map((status) => (
                  <Form method="post" key={status}>
                    <input
                      type="hidden"
                      name="expected_updated_at"
                      value={brief.updated_at}
                    />
                    <Button
                      type="submit"
                      name="status"
                      value={status}
                      disabled={navigation.state !== "idle"}
                      variant={status === "archived" ? "outline" : "default"}
                    >
                      {labels[status]}
                    </Button>
                  </Form>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
