import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Image,
  Upload,
  Check,
  Loader2,
  Search,
  Star,
  Globe,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () => createNoIndexMeta("R1 Images - Admin");

interface R1Prompt {
  rip_id: number;
  rip_pg_id: number;
  rip_pg_alias: string;
  rip_gamme_name: string;
  rip_slot_id: string;
  rip_section_id: string;
  rip_prompt_text: string;
  rip_neg_prompt: string;
  rip_alt_text: string;
  rip_caption: string | null;
  rip_aspect_ratio: string;
  rip_image_url: string | null;
  rip_status: string;
  rip_selected: boolean;
  rip_priority_rank: number;
  rip_rag_fields_used: string[];
  rip_rag_richness_score: number;
  rip_stale: boolean;
}

const SLOT_META: Record<
  string,
  { label: string; icon: typeof Image; badge: string; description: string }
> = {
  HERO: {
    label: "Hero",
    icon: Star,
    badge: "Photo",
    description: "Photo produit studio — image principale de la page",
  },
  TYPES: {
    label: "Types",
    icon: Image,
    badge: "Schéma",
    description: "Schéma comparatif des variantes — section S4",
  },
  PRICE: {
    label: "Prix",
    icon: Image,
    badge: "Infographie",
    description: "Infographie fourchettes de prix — section S4",
  },
  LOCATION: {
    label: "Emplacement",
    icon: Image,
    badge: "Technique",
    description: "Vue éclatée technique — section S5",
  },
  OG: {
    label: "Social (OG)",
    icon: Globe,
    badge: "Social",
    description: "Image partage social 1200×630 — meta tags uniquement",
  },
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pgAlias = url.searchParams.get("gamme") || "";

  let prompts: R1Prompt[] = [];
  if (pgAlias) {
    const cookie = request.headers.get("Cookie") || "";
    const res = await fetch(
      getInternalApiUrlFromRequest(
        `/api/admin/r1-image-prompts/${encodeURIComponent(pgAlias)}`,
        request,
      ),
      { headers: { Cookie: cookie } },
    );
    prompts = res.ok ? await res.json() : [];
  }

  return json({ pgAlias, prompts });
}

function StatusBadge({
  status,
  selected,
}: {
  status: string;
  selected: boolean;
}) {
  if (status === "approved" && selected) {
    return <Badge className="bg-green-600 text-white">Active</Badge>;
  }
  if (status === "approved") {
    return (
      <Badge variant="outline" className="border-green-600 text-green-700">
        Approved
      </Badge>
    );
  }
  return <Badge variant="secondary">Pending</Badge>;
}

function SlotCard({
  prompt,
  onUpload,
  onForceSelect,
  onRegenerate,
  uploading,
}: {
  prompt: R1Prompt;
  onUpload: (ripId: number, file: File) => void;
  onForceSelect: (ripId: number) => void;
  onRegenerate: (pgAlias: string) => void;
  uploading: number | null;
}) {
  const meta = SLOT_META[prompt.rip_slot_id] || SLOT_META.HERO;
  const Icon = meta.icon;
  const fileRef = useRef<HTMLInputElement>(null);
  const hasImage = !!prompt.rip_image_url;
  const isOG = prompt.rip_slot_id === "OG";
  const isUploading = uploading === prompt.rip_id;

  const imageProxy = prompt.rip_image_url
    ? prompt.rip_image_url.replace(
        /https:\/\/[^/]+\/storage\/v1\/object\/public\//,
        "/img/",
      )
    : null;

  return (
    <Card className={`${isOG ? "border-amber-300 bg-amber-50/30" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-slate-500" />
            <CardTitle className="text-sm font-semibold">
              {meta.label}
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {meta.badge}
            </Badge>
          </div>
          <StatusBadge
            status={prompt.rip_status}
            selected={prompt.rip_selected}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1">{meta.description}</p>
        {isOG && (
          <p className="text-xs text-amber-700 font-medium mt-1">
            Social uniquement — pas dans le body
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Image preview */}
        <div className="bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center min-h-[120px]">
          {imageProxy ? (
            <img
              src={imageProxy}
              alt={prompt.rip_alt_text}
              className="max-h-48 w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="text-slate-400 text-center py-8">
              <Image className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <span className="text-xs">Pas d'image</span>
            </div>
          )}
        </div>

        {/* Alt text */}
        <p
          className="text-xs text-slate-600 truncate"
          title={prompt.rip_alt_text}
        >
          Alt: {prompt.rip_alt_text}
        </p>

        {/* Prompt (collapsible) */}
        <details className="text-xs">
          <summary className="text-slate-500 cursor-pointer hover:text-slate-700">
            Prompt
          </summary>
          <p className="mt-1 text-slate-600 bg-slate-50 p-2 rounded text-[11px] leading-relaxed">
            {prompt.rip_prompt_text}
          </p>
        </details>

        {/* RAG context + Stale indicator */}
        <div className="flex flex-wrap gap-1.5">
          {prompt.rip_stale && (
            <Badge variant="destructive" className="text-[10px]">
              Stale — RAG changé
            </Badge>
          )}
          {prompt.rip_rag_fields_used?.length > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] text-blue-600 border-blue-300"
            >
              RAG: {prompt.rip_rag_fields_used.join(", ")}
            </Badge>
          )}
          {prompt.rip_rag_richness_score > 0 && (
            <Badge variant="outline" className="text-[10px]">
              Score: {prompt.rip_rag_richness_score}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/webp,image/png,image/jpeg"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(prompt.rip_id, file);
              e.target.value = "";
            }}
          />
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={isUploading}
            onClick={() => fileRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Upload className="h-3 w-3 mr-1" />
            )}
            {hasImage ? "Remplacer" : "Upload"}
          </Button>

          {hasImage && !prompt.rip_selected && (
            <Button
              size="sm"
              variant="default"
              className="flex-1"
              onClick={() => onForceSelect(prompt.rip_id)}
            >
              <Check className="h-3 w-3 mr-1" />
              Activer
            </Button>
          )}
          {prompt.rip_stale && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-amber-400 text-amber-700 hover:bg-amber-50"
              onClick={() => onRegenerate(prompt.rip_pg_alias)}
            >
              Régénérer
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminR1Images() {
  const { pgAlias, prompts } = useLoaderData<typeof loader>();
  const [search, setSearch] = useState(pgAlias || "");
  const [uploading, setUploading] = useState<number | null>(null);
  const [localPrompts, setLocalPrompts] = useState(prompts);

  // Keep in sync when loader data changes
  const prevAlias = useRef(pgAlias);
  if (pgAlias !== prevAlias.current) {
    prevAlias.current = pgAlias;
    setLocalPrompts(prompts);
  }

  const handleSearch = useCallback(() => {
    if (search.trim()) {
      window.location.href = `/admin/r1-images?gamme=${encodeURIComponent(search.trim())}`;
    }
  }, [search]);

  const handleUpload = useCallback(async (ripId: number, file: File) => {
    setUploading(ripId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("forceSelect", "true");

      const res = await fetch(`/api/admin/r1-image-prompts/${ripId}/upload`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const result = await res.json();
        setLocalPrompts((prev) =>
          prev.map((p) =>
            p.rip_id === ripId
              ? {
                  ...p,
                  rip_image_url: result.imageUrl,
                  rip_status: "approved",
                  rip_selected: true,
                }
              : p.rip_slot_id ===
                  prev.find((pp) => pp.rip_id === ripId)?.rip_slot_id
                ? { ...p, rip_selected: false }
                : p,
          ),
        );
      }
    } finally {
      setUploading(null);
    }
  }, []);

  const handleForceSelect = useCallback(
    async (ripId: number) => {
      const prompt = localPrompts.find((p) => p.rip_id === ripId);
      if (!prompt?.rip_image_url) return;

      const res = await fetch(
        `/api/admin/r1-image-prompts/${ripId}/set-image-url`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: prompt.rip_image_url,
            forceSelect: true,
          }),
        },
      );

      if (res.ok) {
        setLocalPrompts((prev) =>
          prev.map((p) =>
            p.rip_id === ripId
              ? { ...p, rip_selected: true, rip_status: "approved" }
              : p.rip_slot_id === prompt.rip_slot_id
                ? { ...p, rip_selected: false }
                : p,
          ),
        );
      }
    },
    [localPrompts],
  );

  const handleRegenerate = useCallback(async (pgAlias: string) => {
    const res = await fetch(
      `/api/admin/r1-image-prompts/generate/${encodeURIComponent(pgAlias)}`,
      { method: "POST" },
    );
    if (res.ok) {
      // Reload page to get fresh prompts
      window.location.reload();
    }
  }, []);

  const slotOrder = ["HERO", "TYPES", "PRICE", "LOCATION", "OG"];
  const sortedPrompts = [...localPrompts].sort(
    (a, b) =>
      slotOrder.indexOf(a.rip_slot_id) - slotOrder.indexOf(b.rip_slot_id),
  );

  const stats = {
    total: localPrompts.length,
    withImage: localPrompts.filter((p) => p.rip_image_url).length,
    approved: localPrompts.filter((p) => p.rip_status === "approved").length,
    active: localPrompts.filter(
      (p) => p.rip_selected && p.rip_status === "approved" && p.rip_image_url,
    ).length,
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">R1 Images</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gestion des 5 slots image par gamme (HERO, TYPES, PRICE, LOCATION, OG)
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Alias gamme (ex: filtre-a-huile)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <Button onClick={handleSearch} disabled={!search.trim()}>
          Charger
        </Button>
      </div>

      {/* Stats */}
      {pgAlias && localPrompts.length > 0 && (
        <div className="flex gap-4 text-sm">
          <span className="text-slate-500">
            Gamme: <strong className="text-slate-900">{pgAlias}</strong>
          </span>
          <span>
            {stats.withImage}/{stats.total} images
          </span>
          <span>{stats.approved} approved</span>
          <span className="text-green-700 font-medium">
            {stats.active} active
          </span>
        </div>
      )}

      {/* No results */}
      {pgAlias && localPrompts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <Image className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucun prompt image R1 pour "{pgAlias}"</p>
            <p className="text-xs mt-1">
              Générez les prompts via POST /api/admin/r1-image-prompts/generate/
              {pgAlias}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Slot cards grid */}
      {sortedPrompts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedPrompts.map((prompt) => (
            <SlotCard
              key={prompt.rip_id}
              prompt={prompt}
              onUpload={handleUpload}
              onForceSelect={handleForceSelect}
              onRegenerate={handleRegenerate}
              uploading={uploading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
