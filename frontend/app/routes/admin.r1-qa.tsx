import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Image,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { type R1PromptRow } from "~/types/admin-r1.types";
import { type R1RelatedBlock as RelatedBlock } from "~/types/r1-related.types";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("R1 QA Console - Admin");

// Use centralized types
type R1Prompt = R1PromptRow;

// 10 gammes audit
const AUDIT_GAMMES = [
  { pgId: 7, alias: "filtre-a-huile", name: "Filtre à huile" },
  { pgId: 402, alias: "plaquette-de-frein", name: "Plaquette de frein" },
  { pgId: 82, alias: "disque-de-frein", name: "Disque de frein" },
  { pgId: 854, alias: "amortisseur", name: "Amortisseur" },
  { pgId: 479, alias: "kit-d-embrayage", name: "Kit d'embrayage" },
  {
    pgId: 306,
    alias: "courroie-de-distribution",
    name: "Courroie de distribution",
  },
  { pgId: 4, alias: "alternateur", name: "Alternateur" },
  { pgId: 2, alias: "demarreur", name: "Démarreur" },
  { pgId: 1260, alias: "pompe-a-eau", name: "Pompe à eau" },
  { pgId: 1145, alias: "vanne-egr", name: "Vanne EGR" },
];

interface GammeQAData {
  alias: string;
  name: string;
  pgId: number;
  prompts: R1Prompt[];
  relatedBlocks: RelatedBlock[];
  heroImage: string | null;
}

interface QAScore {
  hero: number;
  types: number;
  confusion: number;
  guide: number;
  relatedParts: number;
  parcours: number;
  credibility: number;
  comment: string;
}

const EMPTY_SCORE: QAScore = {
  hero: -1,
  types: -1,
  confusion: -1,
  guide: -1,
  relatedParts: -1,
  parcours: -1,
  credibility: -1,
  comment: "",
};

const CRITERIA = [
  { key: "hero", label: "Image HERO utile" },
  { key: "types", label: "Image TYPES aide compréhension" },
  { key: "confusion", label: "Bloc confusion pertinent" },
  { key: "guide", label: "Bloc guide utile" },
  { key: "relatedParts", label: "Pièces associées logiques" },
  { key: "parcours", label: "Continuité vers R2" },
  { key: "credibility", label: "Crédibilité globale" },
] as const;

export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";
  const gammeData: GammeQAData[] = [];

  for (const g of AUDIT_GAMMES) {
    // Fetch R1 prompts
    const promptsRes = await fetch(
      getInternalApiUrlFromRequest(
        `/api/admin/r1-image-prompts/${encodeURIComponent(g.alias)}`,
        request,
      ),
      { headers: { Cookie: cookie } },
    ).catch(() => null);
    const prompts: R1Prompt[] = promptsRes?.ok ? await promptsRes.json() : [];

    // Fetch related blocks from page API
    const pageRes = await fetch(
      getInternalApiUrlFromRequest(
        `/api/gamme-rest/${g.pgId}/page-data-rpc-v2`,
        request,
      ),
      { headers: { Cookie: cookie } },
    ).catch(() => null);
    const pageData = pageRes?.ok ? await pageRes.json() : {};

    gammeData.push({
      alias: g.alias,
      name: g.name,
      pgId: g.pgId,
      prompts,
      relatedBlocks: pageData?.relatedResources?.blocks ?? [],
      heroImage: pageData?.hero?.image ?? null,
    });
  }

  return json({ gammeData });
}

function ScoreBadge({ score }: { score: number }) {
  if (score < 0) return <Badge variant="secondary">—</Badge>;
  if (score >= 2.5)
    return (
      <Badge className="bg-green-600 text-white">{score.toFixed(1)}</Badge>
    );
  if (score >= 1.5)
    return (
      <Badge className="bg-amber-500 text-white">{score.toFixed(1)}</Badge>
    );
  return <Badge variant="destructive">{score.toFixed(1)}</Badge>;
}

function ImageStatusBadge({ prompts }: { prompts: R1Prompt[] }) {
  const withUrl = prompts.filter((p) => p.rip_image_url).length;
  const total = prompts.length;
  if (withUrl === 0) return <Badge variant="destructive">0/{total}</Badge>;
  if (withUrl < 3)
    return (
      <Badge className="bg-amber-500 text-white">
        {withUrl}/{total}
      </Badge>
    );
  return (
    <Badge className="bg-green-600 text-white">
      {withUrl}/{total}
    </Badge>
  );
}

function BlocksBadge({ blocks }: { blocks: RelatedBlock[] }) {
  if (blocks.length === 0) return <Badge variant="secondary">0</Badge>;
  return (
    <div className="flex gap-1">
      {blocks.map((b) => (
        <Badge key={b.kind} variant="outline" className="text-[10px]">
          {b.kind === "avoid-confusion"
            ? "confusion"
            : b.kind === "buying-guide"
              ? "guide"
              : "pièces"}
          ({b.items.length})
        </Badge>
      ))}
    </div>
  );
}

function ScoreInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[0, 1, 2, 3].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
            value === n
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function GammeDetail({
  data,
  score,
  onScoreChange,
}: {
  data: GammeQAData;
  score: QAScore;
  onScoreChange: (s: QAScore) => void;
}) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    await fetch(
      `/api/admin/r1-image-prompts/generate/${encodeURIComponent(data.alias)}`,
      {
        method: "POST",
      },
    );
    setGenerating(false);
    window.location.reload();
  };

  const staleCount = data.prompts.filter((p) => p.rip_stale).length;
  const avgRichness =
    data.prompts.length > 0
      ? data.prompts.reduce((s, p) => s + p.rip_rag_richness_score, 0) /
        data.prompts.length
      : 0;

  return (
    <div className="space-y-4 p-4 bg-white border rounded-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{data.name}</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <a
              href={`/admin/r1-images?gamme=${data.alias}`}
              target="_blank"
              rel="noreferrer"
            >
              <Image className="h-3 w-3 mr-1" /> Images
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a
              href={`/pieces/${data.alias}-${data.pgId}.html`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-3 w-3 mr-1" /> Page
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Générer prompts
          </Button>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex gap-3 text-xs">
        <span>
          RAG richness: <strong>{avgRichness.toFixed(1)}</strong>
        </span>
        {staleCount > 0 && (
          <Badge variant="destructive" className="text-[10px]">
            {staleCount} stale
          </Badge>
        )}
        <span>Slots: {data.prompts.length}/5</span>
      </div>

      {/* Image slots */}
      <div className="grid grid-cols-5 gap-2">
        {["HERO", "TYPES", "PRICE", "LOCATION", "OG"].map((slot) => {
          const p = data.prompts.find((pr) => pr.rip_slot_id === slot);
          const hasImage = !!p?.rip_image_url;
          const imageProxy = p?.rip_image_url?.replace(
            /https:\/\/[^/]+\/storage\/v1\/object\/public\//,
            "/img/",
          );
          return (
            <div key={slot} className="text-center">
              <div className="bg-slate-100 rounded-lg h-16 flex items-center justify-center overflow-hidden">
                {imageProxy ? (
                  <img
                    src={imageProxy}
                    alt={slot}
                    className="h-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-slate-300 text-[10px]">{slot}</span>
                )}
              </div>
              <span className="text-[10px] block mt-1">
                {hasImage ? (
                  <CheckCircle className="h-3 w-3 text-green-600 inline" />
                ) : (
                  <XCircle className="h-3 w-3 text-slate-300 inline" />
                )}{" "}
                {slot}
              </span>
            </div>
          );
        })}
      </div>

      {/* Related blocks */}
      {data.relatedBlocks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">
            Blocs maillage :
          </p>
          {data.relatedBlocks.map((b) => (
            <div key={b.kind} className="text-xs bg-slate-50 p-2 rounded">
              <strong>{b.heading}</strong>
              <ul className="mt-1 space-y-0.5">
                {b.items.map((item) => (
                  <li key={item.href} className="text-slate-500">
                    → {item.title}{" "}
                    <span className="text-slate-400">({item.reason})</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* QA Scoring grid */}
      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-slate-600 mb-2">
          Notation QA (/3) :
        </p>
        <div className="grid grid-cols-2 gap-2">
          {CRITERIA.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-600">{label}</span>
              <ScoreInput
                value={score[key as keyof QAScore] as number}
                onChange={(v) => onScoreChange({ ...score, [key]: v })}
              />
            </div>
          ))}
        </div>
        <textarea
          className="mt-2 w-full text-xs border rounded p-2 h-16"
          placeholder="Commentaire / défaut principal / action prioritaire..."
          value={score.comment}
          onChange={(e) => onScoreChange({ ...score, comment: e.target.value })}
        />
      </div>
    </div>
  );
}

export default function AdminR1QA() {
  const { gammeData } = useLoaderData<typeof loader>();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, QAScore>>({});

  // Load scores from localStorage
  useEffect(() => {
    const saved: Record<string, QAScore> = {};
    for (const g of gammeData) {
      const raw = localStorage.getItem(`r1-qa-scores-${g.alias}`);
      if (raw) saved[g.alias] = JSON.parse(raw);
    }
    if (Object.keys(saved).length > 0) setScores(saved);
  }, [gammeData]);

  const updateScore = useCallback((alias: string, s: QAScore) => {
    setScores((prev) => ({ ...prev, [alias]: s }));
    localStorage.setItem(`r1-qa-scores-${alias}`, JSON.stringify(s));
  }, []);

  const getAvgScore = (s?: QAScore): number => {
    if (!s) return -1;
    const vals = CRITERIA.map(
      ({ key }) => s[key as keyof QAScore] as number,
    ).filter((v) => v >= 0);
    if (vals.length === 0) return -1;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const globalScores = gammeData
    .map((g) => getAvgScore(scores[g.alias]))
    .filter((v) => v >= 0);
  const globalAvg =
    globalScores.length > 0
      ? globalScores.reduce((a, b) => a + b, 0) / globalScores.length
      : -1;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">R1 QA Console</h1>
          <p className="text-sm text-slate-500 mt-1">
            Audit qualité éditorial — 10 gammes de référence
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Score global</p>
          <ScoreBadge score={globalAvg} />
          <p className="text-[10px] text-slate-400 mt-1">
            {globalScores.length}/10 auditées — cible ≥ 2.0
          </p>
        </div>
      </div>

      {/* Summary table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-xs text-slate-500">
                <th className="text-left p-3">Gamme</th>
                <th className="text-center p-3">Images</th>
                <th className="text-center p-3">Blocs</th>
                <th className="text-center p-3">RAG</th>
                <th className="text-center p-3">Score QA</th>
                <th className="text-center p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {gammeData.map((g) => {
                const isExpanded = expanded === g.alias;
                const avgRichness =
                  g.prompts.length > 0
                    ? g.prompts.reduce(
                        (s, p) => s + p.rip_rag_richness_score,
                        0,
                      ) / g.prompts.length
                    : 0;
                const staleCount = g.prompts.filter((p) => p.rip_stale).length;

                return (
                  <tr key={g.alias} className="border-b hover:bg-slate-50">
                    <td className="p-3">
                      <button
                        onClick={() => setExpanded(isExpanded ? null : g.alias)}
                        className="flex items-center gap-1 text-left font-medium hover:text-blue-700"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                        {g.name}
                      </button>
                      <span className="text-[10px] text-slate-400">
                        {g.alias}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <ImageStatusBadge prompts={g.prompts} />
                    </td>
                    <td className="p-3 text-center">
                      <BlocksBadge blocks={g.relatedBlocks} />
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-xs">
                        {avgRichness.toFixed(1)}
                        {staleCount > 0 && (
                          <AlertTriangle className="h-3 w-3 text-amber-500 inline ml-1" />
                        )}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <ScoreBadge score={getAvgScore(scores[g.alias])} />
                    </td>
                    <td className="p-3 text-center">
                      <a
                        href={`/admin/r1-images?gamme=${g.alias}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Images
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Expanded detail */}
      {expanded && (
        <GammeDetail
          data={gammeData.find((g) => g.alias === expanded)!}
          score={scores[expanded] ?? EMPTY_SCORE}
          onScoreChange={(s) => updateScore(expanded, s)}
        />
      )}
    </div>
  );
}
