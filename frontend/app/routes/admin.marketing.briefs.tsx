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
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, Form, useSubmit } from "@remix-run/react";
import { Calendar, FileText, MapPin, ShoppingBag, Zap } from "lucide-react";
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

interface BriefRow {
  id: string;
  agent_id: string;
  business_unit: "ECOMMERCE" | "LOCAL" | "HYBRID";
  channel: string;
  conversion_goal: "CALL" | "VISIT" | "QUOTE" | "ORDER";
  cta: string;
  target_segment: string;
  brand_gate_level: "PASS" | "WARN" | "FAIL" | null;
  status: "draft" | "reviewed" | "approved" | "published" | "archived";
  created_at: string;
  reviewed_by: string | null;
  approved_by: string | null;
}

interface BriefsResponse {
  success: boolean;
  data: {
    items: BriefRow[];
    total: number;
    page: number;
    limit: number;
  };
}

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

  try {
    const apiUrl = getInternalApiUrlFromRequest(
      `/api/admin/marketing/briefs?${params.toString()}`,
      request,
    );
    const res = await fetch(apiUrl, {
      headers: { Cookie: request.headers.get("Cookie") || "" },
    });
    if (!res.ok) {
      return json({
        items: [] as BriefRow[],
        total: 0,
        page: 1,
        limit: 50,
        unit,
        status,
        error: `Backend ${res.status}`,
      });
    }
    const result = (await res.json()) as BriefsResponse;
    return json({
      items: result.data.items,
      total: result.data.total,
      page: result.data.page,
      limit: result.data.limit,
      unit,
      status,
      error: null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json({
      items: [] as BriefRow[],
      total: 0,
      page: 1,
      limit: 50,
      unit,
      status,
      error: message,
    });
  }
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

      {data.error && (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive">
              Backend indisponible : {data.error}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Phase 1 ADR-036 — la table <code>__marketing_brief</code> est vide
              tant que les agents (Phase 1.5) ne sont pas activés.
            </p>
          </CardContent>
        </Card>
      )}

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
                        <Badge variant="outline">{brief.conversion_goal}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {brief.brand_gate_level && (
                          <Badge variant={gateVariant[brief.brand_gate_level]}>
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
    </div>
  );
}
