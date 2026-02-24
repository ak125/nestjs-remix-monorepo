import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { FileVideo, Clock, Film } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getInternalApiUrl } from "~/utils/internal-api.server";

interface VideoTemplate {
  id: number;
  templateId: string;
  version: number;
  videoType: string;
  platform: string;
  allowedUseCases: string[];
  forbiddenUseCases: string[];
  durationRange: { min: number; max: number };
  structure: Record<string, unknown>;
  createdAt: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    const res = await fetch(`${backendUrl}/api/admin/video/templates`, {
      headers: { Cookie: cookieHeader },
    });

    if (!res.ok) return json({ templates: [], error: "Erreur chargement" });

    const data = await res.json();
    return json({
      templates: (data.data ?? []) as VideoTemplate[],
      error: null,
    });
  } catch {
    return json({ templates: [], error: "Erreur reseau" });
  }
}

export default function VideoTemplatesPage() {
  const { templates, error } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Templates</h2>
        <Badge variant="outline">{templates.length} template(s)</Badge>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {templates.length === 0 && !error ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Aucun template enregistre. Les templates apparaitront ici une fois
            le registre code ou la table DB peuplee.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => {
            const isCodeRegistry =
              (tpl.structure as Record<string, unknown>)?.source ===
              "code_registry";
            return (
              <Card key={tpl.templateId}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileVideo className="h-4 w-4 text-rose-500" />
                      {(tpl.structure as Record<string, unknown>)
                        ?.displayName ?? tpl.templateId}
                    </CardTitle>
                    <Badge
                      className={
                        isCodeRegistry
                          ? "bg-purple-100 text-purple-700 text-xs"
                          : "bg-blue-100 text-blue-700 text-xs"
                      }
                    >
                      {isCodeRegistry ? "Code" : "DB"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-gray-500 font-mono">
                    {tpl.templateId}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      <Film className="h-3 w-3 mr-1" />
                      {tpl.videoType.replace("_", " ")}
                    </Badge>
                    {(tpl.structure as Record<string, unknown>)
                      ?.compositionId != null && (
                      <Badge variant="outline" className="text-xs">
                        {String(
                          (tpl.structure as Record<string, unknown>)
                            .compositionId,
                        )}
                      </Badge>
                    )}
                    {(tpl.structure as Record<string, unknown>)?.status !=
                      null && (
                      <Badge
                        className={
                          (tpl.structure as Record<string, unknown>).status ===
                          "stable"
                            ? "bg-green-100 text-green-700 text-xs"
                            : "bg-amber-100 text-amber-700 text-xs"
                        }
                      >
                        {String(
                          (tpl.structure as Record<string, unknown>).status,
                        )}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {tpl.durationRange.min}–{tpl.durationRange.max}s
                    </div>
                    <div>v{tpl.version}</div>
                    {(tpl.structure as Record<string, unknown>)?.resolution !=
                      null && (
                      <div>
                        {String(
                          (tpl.structure as Record<string, unknown>).resolution,
                        )}
                      </div>
                    )}
                  </div>

                  {tpl.allowedUseCases.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tpl.allowedUseCases.map((uc) => (
                        <Badge
                          key={uc}
                          variant="outline"
                          className="text-xs capitalize"
                        >
                          {uc.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
