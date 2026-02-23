import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Shield,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getInternalApiUrl } from "~/utils/internal-api.server";

interface GateResult {
  gate: string;
  verdict: "PASS" | "WARN" | "FAIL";
  details: string[];
  measured: number;
  warnThreshold: number;
  failThreshold: number;
}

interface Production {
  id: number;
  briefId: string;
  videoType: string;
  vertical: string;
  status: string;
  qualityScore: number | null;
  qualityFlags: string[];
  gateResults: GateResult[] | null;
  claimTable: unknown[] | null;
  evidencePack: unknown[] | null;
  disclaimerPlan: { disclaimers: unknown[] } | null;
  approvalRecord: { briefId: string; stages: unknown[] } | null;
  knowledgeContract: Record<string, unknown> | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const backendUrl = getInternalApiUrl("");
  const cookieHeader = request.headers.get("Cookie") || "";
  const briefId = params.briefId;

  try {
    const res = await fetch(
      `${backendUrl}/api/admin/video/productions/${briefId}`,
      { headers: { Cookie: cookieHeader } },
    );

    if (!res.ok) return json({ production: null, error: "Not found" });

    const data = await res.json();
    return json({ production: data.data as Production, error: null });
  } catch {
    return json({ production: null, error: "Erreur chargement" });
  }
}

const VERDICT_CONFIG = {
  PASS: {
    icon: CheckCircle,
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
    badge: "bg-green-100 text-green-700",
  },
  WARN: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-700",
  },
  FAIL: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-700",
  },
};

const GATE_LABELS: Record<string, string> = {
  truth: "G1 Truth",
  safety: "G2 Safety (STRICT)",
  brand: "G3 Brand",
  platform: "G4 Platform",
  reuse_risk: "G5 Reuse Risk",
  visual_role: "G6 Visual Role (STRICT)",
  final_qa: "G7 Final QA",
};

const ARTEFACT_KEYS = [
  { key: "claimTable", label: "Claim Table" },
  { key: "evidencePack", label: "Evidence Pack" },
  { key: "disclaimerPlan", label: "Disclaimer Plan" },
  { key: "approvalRecord", label: "Approval Record" },
  { key: "knowledgeContract", label: "Knowledge Contract" },
] as const;

export default function VideoProductionDetail() {
  const { production, error } = useLoaderData<typeof loader>();

  if (!production) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/video-hub/productions"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            {error || "Production introuvable."}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/admin/video-hub/productions"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">
            {production.briefId}
          </h2>
        </div>
        <Badge variant="outline" className="capitalize">
          {production.status}
        </Badge>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">Type</div>
            <div className="font-medium capitalize">
              {production.videoType.replace("_", " ")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">Vertical</div>
            <div className="font-medium capitalize">{production.vertical}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">Score</div>
            <div className="font-medium">{production.qualityScore ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">Cree par</div>
            <div className="font-medium">{production.createdBy}</div>
          </CardContent>
        </Card>
      </div>

      {/* Artefacts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Artefacts (5 obligatoires)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {ARTEFACT_KEYS.map(({ key, label }) => {
              const value = production[key as keyof Production];
              const present = value !== null && value !== undefined;
              return (
                <Badge
                  key={key}
                  className={
                    present
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }
                >
                  {present ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {label}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Gates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Gates (7 — dernier run)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {production.gateResults ? (
            <div className="space-y-3">
              {production.gateResults.map((gate) => {
                const config = VERDICT_CONFIG[gate.verdict];
                const Icon = config.icon;
                return (
                  <div
                    key={gate.gate}
                    className={`flex items-center justify-between p-3 rounded-lg border ${config.bg}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${config.color}`} />
                      <div>
                        <div className="font-medium text-sm">
                          {GATE_LABELS[gate.gate] ?? gate.gate}
                        </div>
                        <div className="text-xs text-gray-500">
                          {gate.details.join(" | ")}
                        </div>
                      </div>
                    </div>
                    <Badge className={config.badge}>{gate.verdict}</Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Aucun gate execute. Utilisez le dry-run pour valider.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quality Flags */}
      {production.qualityFlags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quality Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {production.qualityFlags.map((flag) => (
                <Badge key={flag} variant="outline" className="text-xs">
                  {flag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
