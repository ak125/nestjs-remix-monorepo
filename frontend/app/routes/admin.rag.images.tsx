import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Image,
  Copy,
  Check,
  ArrowLeft,
  Filter,
  Upload,
  Link2,
  Loader2,
} from "lucide-react";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () => createNoIndexMeta("Images RAG - Admin");

interface RagImage {
  hash: string;
  ext: string;
  size: number;
  url: string;
  prompt: string | null;
  gamme: string | null;
  type: string | null;
  usage: string | null;
  style: string | null;
  priority: string | null;
}

interface R3Slot {
  rip_id: number;
  rip_slot_id: string;
  rip_section_id: string;
  rip_status: string;
  rip_image_url: string | null;
  rip_selected: boolean;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";

  const res = await fetch(
    getInternalApiUrlFromRequest("/api/rag/admin/images", request),
    { headers: { Cookie: cookie } },
  );

  const images: RagImage[] = res.ok ? await res.json() : [];
  return json({ images });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TYPE_COLORS: Record<string, string> = {
  product: "bg-blue-100 text-blue-800",
  schema: "bg-purple-100 text-purple-800",
  diagnostic: "bg-orange-100 text-orange-800",
  montage: "bg-green-100 text-green-800",
  fixation: "bg-gray-100 text-gray-800",
  hero: "bg-indigo-100 text-indigo-800",
  symptom: "bg-red-100 text-red-800",
};

const SLOT_LABELS: Record<string, string> = {
  HERO_IMAGE: "Hero (bandeau)",
  S2_SYMPTOM_IMAGE: "S2 Symptomes",
  S3_SCHEMA_IMAGE: "S3 Schema",
  S4D_SCHEMA_IMAGE: "S4D Schema detail",
};

export default function AdminRagImages() {
  const { images } = useLoaderData<typeof loader>();
  const [selected, setSelected] = useState<RagImage | null>(null);
  const [copied, setCopied] = useState(false);
  const [filterGamme, setFilterGamme] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Assign state
  const [assigning, setAssigning] = useState(false);
  const [assignTarget, setAssignTarget] = useState<string>("pg_pic");
  const [assignSlot, setAssignSlot] = useState<string>("");
  const [assignResult, setAssignResult] = useState<string | null>(null);
  const [r3Slots, setR3Slots] = useState<R3Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Gamme resolver state
  const [resolvedGamme, setResolvedGamme] = useState<string | null>(null);

  // Auto-resolve gamme when image is selected
  useEffect(() => {
    if (!selected?.gamme) {
      setResolvedGamme(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/rag/admin/images/resolve-gamme/${selected.gamme}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) {
          setResolvedGamme(data?.resolvedAlias ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setResolvedGamme(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.gamme]);

  const gammes = useMemo(
    () => [...new Set(images.map((i) => i.gamme).filter(Boolean))] as string[],
    [images],
  );
  const types = useMemo(
    () => [...new Set(images.map((i) => i.type).filter(Boolean))] as string[],
    [images],
  );

  const filtered = useMemo(() => {
    return images.filter((img) => {
      if (filterGamme !== "all" && img.gamme !== filterGamme) return false;
      if (filterType !== "all" && img.type !== filterType) return false;
      return true;
    });
  }, [images, filterGamme, filterType]);

  const withPrompt = images.filter((i) => i.prompt).length;

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function resetUploadState() {
    setUploadedUrl(null);
    setUploadError(null);
    setAssignResult(null);
    setAssignTarget("pg_pic");
    setAssignSlot("");
    setR3Slots([]);
  }

  async function handleUpload(file: File) {
    if (!selected) return;
    setUploading(true);
    setUploadError(null);
    setUploadedUrl(null);

    const hashOnly = selected.hash.replace(/\.[^.]+$/, "");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(
        `/api/rag/admin/images/${hashOnly}/upload-generated`,
        { method: "POST", body: formData },
      );
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.message || "Erreur upload");
      } else {
        setUploadedUrl(data.url);
      }
    } catch (err) {
      setUploadError("Erreur reseau");
    } finally {
      setUploading(false);
    }
  }

  const loadR3Slots = useCallback(async (pgAlias: string) => {
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/rag/admin/images/r3-slots/${pgAlias}`);
      if (res.ok) {
        const slots: R3Slot[] = await res.json();
        setR3Slots(slots);
        if (slots.length > 0) {
          setAssignSlot(slots[0].rip_slot_id);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  async function handleAssign() {
    const gammeToUse = resolvedGamme || selected?.gamme;
    if (!gammeToUse || !uploadedUrl) return;
    setAssigning(true);
    setAssignResult(null);

    try {
      const body: Record<string, string> = {
        imageUrl: uploadedUrl,
        pgAlias: gammeToUse,
        target: assignTarget,
      };
      if (assignTarget === "r3_slot" && assignSlot) {
        body.slotId = assignSlot;
      }

      const res = await fetch("/api/rag/admin/images/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setAssignResult(`Erreur: ${data.message || "echec"}`);
      } else {
        setAssignResult(`Assigne a ${selected.gamme} → ${data.target}`);
      }
    } catch {
      setAssignResult("Erreur reseau");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a
            href="/admin/rag"
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Images RAG — Prompts
            </h1>
            <p className="text-sm text-gray-500">
              {images.length} images &middot; {withPrompt} avec prompt &middot;{" "}
              {formatSize(images.reduce((s, i) => s + i.size, 0))} total
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <Select value={filterGamme} onValueChange={setFilterGamme}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Gamme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les gammes</SelectItem>
            {gammes.sort().map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {types.sort().map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterGamme !== "all" || filterType !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterGamme("all");
              setFilterType("all");
            }}
          >
            Effacer filtres
          </Button>
        )}
        <span className="text-sm text-gray-400 ml-auto">
          {filtered.length} image{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filtered.map((img) => (
          <Card
            key={img.hash}
            className="group cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all overflow-hidden"
            onClick={() => {
              setSelected(img);
              setCopied(false);
              resetUploadState();
            }}
          >
            <CardContent className="p-0">
              <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden relative">
                <img
                  src={img.url}
                  alt={img.hash}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
                {img.prompt ? (
                  <Badge className="absolute top-1 right-1 bg-green-600 text-white text-[9px] px-1 py-0">
                    Prompt
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="absolute top-1 right-1 text-[9px] px-1 py-0"
                  >
                    Sans
                  </Badge>
                )}
              </div>
              <div className="p-2 space-y-1">
                <p className="text-xs font-mono text-gray-500 truncate">
                  {img.hash.replace(/\.[^.]+$/, "")}
                </p>
                <div className="flex items-center gap-1 flex-wrap">
                  <Badge variant="outline" className="text-[10px] px-1">
                    {img.ext.toUpperCase()}
                  </Badge>
                  {img.type && (
                    <Badge
                      className={`text-[10px] px-1 ${TYPE_COLORS[img.type] || "bg-gray-100 text-gray-800"}`}
                    >
                      {img.type}
                    </Badge>
                  )}
                  {img.gamme && (
                    <span className="text-[10px] text-gray-400 truncate">
                      {img.gamme}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Image className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Aucune image trouvee</p>
        </div>
      )}

      {/* Modal detail */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            resetUploadState();
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm font-mono">
                  <Image className="h-4 w-4" />
                  {selected.hash.replace(/\.[^.]+$/, "")}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Image preview */}
                <div className="bg-gray-50 rounded-lg p-2 flex items-center justify-center">
                  <img
                    src={selected.url}
                    alt={selected.hash}
                    className="max-h-[400px] max-w-full object-contain rounded"
                  />
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{selected.ext.toUpperCase()}</Badge>
                  <Badge variant="secondary">{formatSize(selected.size)}</Badge>
                  {selected.gamme && (
                    <Badge variant="outline">{selected.gamme}</Badge>
                  )}
                  {selected.type && (
                    <Badge
                      className={
                        TYPE_COLORS[selected.type] ||
                        "bg-gray-100 text-gray-800"
                      }
                    >
                      {selected.type}
                    </Badge>
                  )}
                  {selected.usage && (
                    <Badge variant="outline">{selected.usage}</Badge>
                  )}
                  {selected.style && (
                    <Badge variant="outline">{selected.style}</Badge>
                  )}
                  {selected.priority && (
                    <Badge
                      variant={
                        selected.priority === "haute"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {selected.priority}
                    </Badge>
                  )}
                </div>

                {/* Prompt */}
                {selected.prompt ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Prompt pour recreation
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(selected.prompt!)}
                        className="h-8"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1 text-green-600" />
                            <span className="text-green-600">Copie</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            Copier
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {selected.prompt}
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                    Pas de description disponible. Utiliser{" "}
                    <code className="bg-amber-100 px-1 rounded">
                      /rag-ops describe-images
                    </code>{" "}
                    pour generer le prompt.
                  </div>
                )}

                {/* Upload generated image */}
                <div className="border-t pt-4 space-y-3">
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload image generee
                  </span>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/webp,image/png,image/jpeg"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                    }}
                  />

                  {!uploadedUrl ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          Upload en cours...
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5 mr-1" />
                          Choisir fichier (webp, png, jpg)
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="h-4 w-4" />
                        Image uploadee
                      </div>
                      <p className="text-xs font-mono break-all text-green-600">
                        {uploadedUrl}
                      </p>
                    </div>
                  )}

                  {uploadError && (
                    <p className="text-sm text-red-600">{uploadError}</p>
                  )}
                </div>

                {/* Assign to gamme */}
                {uploadedUrl && selected.gamme && (
                  <div className="border-t pt-4 space-y-3">
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-2 flex-wrap">
                      <Link2 className="h-4 w-4" />
                      Associer a la gamme{" "}
                      <Badge variant="outline">
                        {resolvedGamme || selected.gamme}
                      </Badge>
                      {resolvedGamme && resolvedGamme !== selected.gamme && (
                        <span className="text-xs text-amber-600">
                          (resolu depuis "{selected.gamme}")
                        </span>
                      )}
                      {!resolvedGamme && (
                        <span className="text-xs text-red-500">
                          (gamme non trouvee en DB)
                        </span>
                      )}
                    </span>

                    <div className="flex items-center gap-3">
                      <Select
                        value={assignTarget}
                        onValueChange={(v) => {
                          setAssignTarget(v);
                          const g = resolvedGamme || selected.gamme;
                          if (v === "r3_slot" && g) {
                            loadR3Slots(g);
                          }
                        }}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pg_pic">
                            pg_pic (hero R1/R3)
                          </SelectItem>
                          <SelectItem value="pg_img">
                            pg_img (vignette)
                          </SelectItem>
                          <SelectItem value="pg_wall">
                            pg_wall (wallpaper)
                          </SelectItem>
                          <SelectItem value="r3_slot">
                            Slot R3 (image article)
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {assignTarget === "r3_slot" && (
                        <Select
                          value={assignSlot}
                          onValueChange={setAssignSlot}
                          disabled={loadingSlots || r3Slots.length === 0}
                        >
                          <SelectTrigger className="w-56">
                            <SelectValue
                              placeholder={
                                loadingSlots
                                  ? "Chargement..."
                                  : r3Slots.length === 0
                                    ? "Aucun slot"
                                    : "Slot"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {r3Slots.map((s) => (
                              <SelectItem
                                key={s.rip_slot_id}
                                value={s.rip_slot_id}
                              >
                                {SLOT_LABELS[s.rip_slot_id] || s.rip_slot_id}
                                {s.rip_image_url ? " (a deja image)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      <Button
                        size="sm"
                        disabled={
                          assigning ||
                          (assignTarget === "r3_slot" && !assignSlot)
                        }
                        onClick={handleAssign}
                      >
                        {assigning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Associer"
                        )}
                      </Button>
                    </div>

                    {assignResult && (
                      <p
                        className={`text-sm ${assignResult.startsWith("Erreur") ? "text-red-600" : "text-green-600"}`}
                      >
                        {assignResult}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
