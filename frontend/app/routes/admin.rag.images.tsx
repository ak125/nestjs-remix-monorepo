import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Image, Copy, Sparkles, Check, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () => createNoIndexMeta("Images RAG - Admin");

interface RagImage {
  hash: string;
  ext: string;
  size: number;
  url: string;
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

export default function AdminRagImages() {
  const { images } = useLoaderData<typeof loader>();
  const [selected, setSelected] = useState<RagImage | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleDescribe(img: RagImage) {
    setLoading(true);
    setPrompt("");
    try {
      const res = await fetch(`/api/rag/admin/images/${img.hash}/describe`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setPrompt(data.prompt || "Erreur: pas de prompt retourné");
      } else {
        setPrompt(`Erreur ${res.status}: ${res.statusText}`);
      }
    } catch (err) {
      setPrompt(`Erreur: ${err instanceof Error ? err.message : "inconnu"}`);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const totalSize = images.reduce((sum, img) => sum + img.size, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a
            href="/admin/rag"
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Images RAG</h1>
            <p className="text-sm text-gray-500">
              {images.length} images &middot; {formatSize(totalSize)} total
            </p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {images.map((img) => (
          <Card
            key={img.hash}
            className="group cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all overflow-hidden"
            onClick={() => {
              setSelected(img);
              setPrompt("");
              setCopied(false);
            }}
          >
            <CardContent className="p-0">
              <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                <img
                  src={img.url}
                  alt={img.hash}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
              </div>
              <div className="p-2 space-y-1">
                <p className="text-xs font-mono text-gray-500 truncate">
                  {img.hash}
                </p>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px] px-1">
                    {img.ext.toUpperCase()}
                  </Badge>
                  <span className="text-[10px] text-gray-400">
                    {formatSize(img.size)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {images.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Image className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Aucune image dans le corpus RAG</p>
        </div>
      )}

      {/* Modal detail + describe */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm font-mono">
                  <Image className="h-4 w-4" />
                  {selected.hash}
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
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{selected.ext.toUpperCase()}</Badge>
                  <Badge variant="secondary">{formatSize(selected.size)}</Badge>
                </div>

                {/* Describe button */}
                <Button
                  onClick={() => handleDescribe(selected)}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Générer descriptif IA
                    </>
                  )}
                </Button>

                {/* Prompt result */}
                {prompt && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Prompt pour recréation
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopy}
                        className="h-8"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1 text-green-600" />
                            <span className="text-green-600">Copié</span>
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
                      {prompt}
                    </div>
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
