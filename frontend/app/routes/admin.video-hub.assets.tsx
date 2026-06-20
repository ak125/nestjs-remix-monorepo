import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useSearchParams,
  useFetcher,
} from "@remix-run/react";
import { Image, CheckCircle, XCircle, Loader2, Clock } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getInternalApiUrl } from "~/utils/internal-api.server";

interface VideoAsset {
  id: number;
  assetKey: string;
  visualType: string;
  truthDependency: string;
  tags: string[];
  filePath?: string;
  validated: boolean;
  validatedBy?: string;
  createdAt: string;
}

const VISUAL_TYPES = [
  "",
  "schema",
  "animation",
  "macro",
  "motion_text",
  "ambiance",
  "photo_reelle",
];

const VISUAL_TYPE_LABEL: Record<string, string> = {
  schema: "Schema",
  animation: "Animation",
  macro: "Macro",
  motion_text: "Motion Text",
  ambiance: "Ambiance",
  photo_reelle: "Photo reelle",
};

function buildFilterUrl(
  current: URLSearchParams,
  key: string,
  value: string,
): string {
  const next = new URLSearchParams(current.toString());
  if (value) next.set(key, value);
  else next.delete(key);
  next.delete("page");
  return `?${next}`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const url = new URL(request.url);
  const visualType = url.searchParams.get("visualType") || "";
  const validated = url.searchParams.get("validated") || "";

  try {
    const params = new URLSearchParams();
    if (visualType) params.set("visualType", visualType);
    if (validated) params.set("validated", validated);

    const res = await fetch(`${backendUrl}/api/admin/video/assets?${params}`, {
      headers: { Cookie: cookieHeader },
    });

    if (!res.ok) return json({ assets: [], error: "Erreur chargement" });

    const data = await res.json();
    return json({
      assets: (data.data ?? []) as VideoAsset[],
      error: null,
    });
  } catch {
    return json({ assets: [], error: "Erreur reseau" });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const formData = await request.formData();
  const assetKey = formData.get("assetKey") as string;

  try {
    const res = await fetch(
      `${backendUrl}/api/admin/video/assets/${encodeURIComponent(assetKey)}/validate`,
      {
        method: "PATCH",
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ validatedBy: "admin" }),
      },
    );
    const data = await res.json();
    return json({
      ok: res.ok && data.success,
      error: data.error ?? null,
      assetKey,
    });
  } catch {
    return json({ ok: false, error: "Erreur reseau", assetKey });
  }
}

function AssetCard({ asset }: { asset: VideoAsset }) {
  const fetcher = useFetcher<{
    ok: boolean;
    error: string | null;
    assetKey: string;
  }>();
  const isValidating = fetcher.state !== "idle";
  const justValidated =
    fetcher.data?.ok === true && fetcher.data.assetKey === asset.assetKey;
  const isValidated = asset.validated || justValidated;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono truncate max-w-[200px]">
            {asset.assetKey}
          </CardTitle>
          <Badge
            className={
              isValidated
                ? "bg-green-100 text-green-700 text-xs"
                : "bg-red-100 text-red-700 text-xs"
            }
          >
            {isValidated ? (
              <CheckCircle className="h-3 w-3 mr-1" />
            ) : (
              <XCircle className="h-3 w-3 mr-1" />
            )}
            {isValidated ? "Valide" : "Non valide"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-rose-100 text-rose-700 text-xs">
            {VISUAL_TYPE_LABEL[asset.visualType] ?? asset.visualType}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {asset.truthDependency}
          </Badge>
        </div>

        {asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {asset.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(asset.createdAt).toLocaleDateString("fr-FR")}
          </div>
          {isValidated && asset.validatedBy && (
            <span>par {asset.validatedBy}</span>
          )}
        </div>

        {!isValidated && (
          <fetcher.Form method="post">
            <input type="hidden" name="assetKey" value={asset.assetKey} />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={isValidating}
              className="w-full gap-1 text-xs"
            >
              {isValidating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle className="h-3 w-3" />
              )}
              {isValidating ? "Validation..." : "Valider"}
            </Button>
          </fetcher.Form>
        )}

        {fetcher.data?.ok === false &&
          fetcher.data.assetKey === asset.assetKey && (
            <div className="text-xs text-red-600">
              {fetcher.data.error ?? "Erreur validation"}
            </div>
          )}
      </CardContent>
    </Card>
  );
}

export default function VideoHubAssets() {
  const { assets, error } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const currentVisualType = searchParams.get("visualType") || "";
  const currentValidated = searchParams.get("validated") || "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Assets</h2>
        <Badge variant="outline">{assets.length} asset(s)</Badge>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-gray-500 w-16">Type :</span>
          {VISUAL_TYPES.map((vt) => (
            <Link
              key={vt || "all"}
              to={buildFilterUrl(searchParams, "visualType", vt)}
              className="inline-block"
            >
              <Badge
                variant={currentVisualType === vt ? "default" : "outline"}
                className="cursor-pointer text-xs"
              >
                {vt ? (VISUAL_TYPE_LABEL[vt] ?? vt) : "Tous"}
              </Badge>
            </Link>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-gray-500 w-16">Valide :</span>
          {[
            { value: "", label: "Tous" },
            { value: "true", label: "Oui" },
            { value: "false", label: "Non" },
          ].map((opt) => (
            <Link
              key={opt.value || "all"}
              to={buildFilterUrl(searchParams, "validated", opt.value)}
              className="inline-block"
            >
              <Badge
                variant={currentValidated === opt.value ? "default" : "outline"}
                className="cursor-pointer text-xs"
              >
                {opt.label}
              </Badge>
            </Link>
          ))}
        </div>
      </div>

      {/* Grid */}
      {assets.length === 0 && !error ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <Image className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            Aucun asset trouve.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}
