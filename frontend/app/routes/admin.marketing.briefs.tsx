/**
 * Admin Marketing Briefs — list view + status workflow (ADR-036 Phase 1.4).
 *
 * Source de vérité backend : `/api/admin/marketing/briefs` (NestJS controller
 * `MarketingBriefsController`). DTO Zod côté backend valide chaque PATCH.
 *
 * Phase 1 = lecture + workflow validation manuelle (draft → reviewed → approved).
 * Pas de CREATE depuis admin UI — les briefs viennent des agents (Phase 1.5).
 *
 * Filtres : `?unit=ECOMMERCE|LOCAL|HYBRID`, `?status=draft|reviewed|...`,
 * `?agent_id=...`. Pagination simple.
 */
import { Calendar, FileText, MapPin, ShoppingBag, Zap } from "lucide-react";
import {
  data,
  type LoaderFunctionArgs,
  useLoaderData,
  Link,
  Form,
  useSubmit,
} from "react-router";
import { z } from "zod";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";

const briefRowSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  business_unit: z.enum(["ECOMMERCE", "LOCAL", "HYBRID"]),
  channel: z.string(),
  conversion_goal: z.enum(["CALL", "VISIT", "QUOTE", "ORDER"]),
  cta: z.string(),
  target_segment: z.string(),
  brand_gate_level: z.enum(["PASS", "WARN", "FAIL"]).nullable(),
  status: z.enum(["draft", "reviewed", "approved", "published", "archived"]),
  created_at: z.string(),
  reviewed_by: z.string().nullable(),
  approved_by: z.string().nullable(),
});
type BriefRow = z.infer<typeof briefRowSchema>;

const briefsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(briefRowSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  }),
});

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const params = new URLSearchParams();

  // Filtre business_unit (vue 2-units du dashboard)
  const unit = url.searchParams.get("unit");
  if (unit) params.set("business_unit", unit);

  const status = url.searchParams.get("status");
  if (status) params.set("status", status);

  const page = url.searchParams.get("page") || "1";
  params.set("page", page);
  params.set("limit", "50");

  const unavailable = (httpStatus: number) => {
    const error =
      httpStatus === 400
        ? "Les filtres demandés sont invalides. Modifiez-les puis réessayez."
        : httpStatus === 401
          ? "Reconnectez-vous pour consulter les briefs."
          : httpStatus === 403
            ? "Vous n’avez pas accès aux briefs marketing."
            : "Impossible de charger les briefs. Réessayez.";
    return data(
      { items: null, total: null, page: null, limit: 50, unit, status, error },
      { status: httpStatus },
    );
  };

  let res: Response;
  try {
    const apiUrl = getInternalApiUrlFromRequest(
      `/api/admin/marketing/briefs?${params.toString()}`,
      request,
    );
    res = await fetch(apiUrl, {
      headers: { Cookie: request.headers.get("Cookie") || "" },
    });
  } catch {
    return unavailable(503);
  }

  if (!res.ok) {
    return unavailable(
      res.status >= 400 && res.status <= 599 ? res.status : 502,
    );
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return unavailable(502);
  }
  const result = briefsResponseSchema.safeParse(payload);
  if (!result.success) return unavailable(502);

  return { ...result.data.data, unit, status, error: null };
}

const businessUnitIcon: Record<BriefRow["business_unit"], typeof MapPin> = {
  ECOMMERCE: ShoppingBag,
  LOCAL: MapPin,
  HYBRID: Zap,
};

const statusVariant: Record<
  BriefRow["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  reviewed: "secondary",
  approved: "default",
  published: "default",
  archived: "destructive",
};

const gateVariant: Record<
  NonNullable<BriefRow["brand_gate_level"]>,
  "default" | "secondary" | "destructive"
> = {
  PASS: "default",
  WARN: "secondary",
  FAIL: "destructive",
};

export default function MarketingBriefsList() {
  const data = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const onUnitChange = (value: string) => {
    const formData = new FormData();
    if (value !== "ALL") formData.set("unit", value);
    if (data.status) formData.set("status", data.status);
    submit(formData, { method: "get" });
  };

  const onStatusChange = (value: string) => {
    const formData = new FormData();
    if (data.unit) formData.set("unit", data.unit);
    if (value !== "ALL") formData.set("status", value);
    submit(formData, { method: "get" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Marketing briefs
        </h2>
        <div className="flex gap-2">
          <Form method="get" className="flex gap-2">
            <Select
              name="unit"
              defaultValue={data.unit || "ALL"}
              onValueChange={onUnitChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Business unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes unités</SelectItem>
                <SelectItem value="ECOMMERCE">ECOMMERCE</SelectItem>
                <SelectItem value="LOCAL">LOCAL</SelectItem>
                <SelectItem value="HYBRID">HYBRID</SelectItem>
              </SelectContent>
            </Select>
            <Select
              name="status"
              defaultValue={data.status || "ALL"}
              onValueChange={onStatusChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous statuts</SelectItem>
                <SelectItem value="draft">draft</SelectItem>
                <SelectItem value="reviewed">reviewed</SelectItem>
                <SelectItem value="approved">approved</SelectItem>
                <SelectItem value="published">published</SelectItem>
                <SelectItem value="archived">archived</SelectItem>
              </SelectContent>
            </Select>
          </Form>
        </div>
      </div>

      {data.error !== null ? (
        <Card>
          <CardContent className="p-6">
            <p role="alert" className="text-sm text-destructive">
              {data.error}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {data.total} brief{data.total > 1 ? "s" : ""}
              {data.unit && ` · ${data.unit}`}
              {data.status && ` · ${data.status}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun brief pour ce filtre. Les agents marketing (Phase 1.5)
                produiront des briefs automatiquement une fois activés.
              </p>
            ) : (
              <div className="space-y-2">
                {data.items.map((brief) => {
                  const Icon = businessUnitIcon[brief.business_unit];
                  return (
                    <Link
                      key={brief.id}
                      to={`/admin/marketing/briefs/${brief.id}`}
                      className="block p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <Badge variant="outline">{brief.business_unit}</Badge>
                          <Badge variant="outline">{brief.channel}</Badge>
                          <Badge variant="outline">
                            {brief.conversion_goal}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {brief.brand_gate_level && (
                            <Badge
                              variant={gateVariant[brief.brand_gate_level]}
                            >
                              gate: {brief.brand_gate_level}
                            </Badge>
                          )}
                          <Badge variant={statusVariant[brief.status]}>
                            {brief.status}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm font-medium mb-1">{brief.cta}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>agent: {brief.agent_id}</span>
                        <span>segment: {brief.target_segment}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(brief.created_at).toLocaleString("fr-FR")}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
