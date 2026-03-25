/**
 * GammeActionBar — Barre d'actions toujours visible sous le sélecteur de gamme.
 *
 * Contrat :
 * - Reçoit la gamme déjà résolue (pas de lookup interne)
 * - Handlers centralisés passés par le parent
 * - États de chargement séparés (content / images)
 * - Double-clic protégé par disabled
 */
import {
  ClipboardCopy,
  ExternalLink,
  ImageIcon,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

interface GammeRow {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
  has_r1: boolean;
  has_r3: boolean;
  has_r4: boolean;
  has_r5: boolean;
  has_r6: boolean;
  kw_count: number;
  rag_status: "ingested" | "file_only" | "none";
  ingest_count: number;
}

interface GammeActionBarProps {
  gamme: GammeRow | null;
  onGenerateContent: () => void;
  onGenerateImages: () => void;
  gammeUrl: string | null;
  isGeneratingContent: boolean;
  isGeneratingImages: boolean;
  contentResult?: {
    command?: string;
    error?: string;
    message?: string;
  } | null;
}

const ROLES = [
  { key: "has_r1", label: "R1" },
  { key: "has_r3", label: "R3" },
  { key: "has_r4", label: "R4" },
  { key: "has_r5", label: "R5" },
  { key: "has_r6", label: "R6" },
] as const;

export function GammeActionBar({
  gamme,
  onGenerateContent,
  onGenerateImages,
  gammeUrl,
  isGeneratingContent,
  isGeneratingImages,
  contentResult,
}: GammeActionBarProps) {
  const [copied, setCopied] = useState(false);

  if (!gamme) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-4 text-center text-sm text-slate-400">
        Sélectionnez une gamme pour voir les actions
      </div>
    );
  }

  const ragLabel =
    gamme.rag_status === "ingested"
      ? `RAG: ${gamme.ingest_count}`
      : gamme.rag_status === "file_only"
        ? "RAG: fichier"
        : "RAG: aucun";
  const ragColor =
    gamme.rag_status === "ingested"
      ? "bg-green-100 text-green-800"
      : gamme.rag_status === "file_only"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Ligne 1 — Status compact */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-500 mr-1">
          {gamme.pg_name}
        </span>
        {ROLES.map((r) => {
          const has = gamme[r.key as keyof GammeRow] as boolean;
          return (
            <Badge
              key={r.label}
              variant={has ? "default" : "outline"}
              className={`text-[10px] px-1.5 py-0 ${
                has
                  ? "bg-green-600 hover:bg-green-600 text-white"
                  : "text-slate-400 border-slate-200"
              }`}
              title={
                has ? `${r.label} : contenu présent` : `${r.label} : manquant`
              }
            >
              {r.label}
            </Badge>
          );
        })}
        <Badge className={`text-[10px] px-1.5 py-0 ${ragColor}`}>
          {ragLabel}
        </Badge>
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-slate-500"
        >
          KW: {gamme.kw_count}
        </Badge>
      </div>

      {/* Ligne 2 — Actions principales */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <Button
          size="lg"
          className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
          onClick={onGenerateContent}
          disabled={isGeneratingContent}
        >
          {isGeneratingContent ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Générer contenu
        </Button>

        <Button
          size="lg"
          className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
          onClick={onGenerateImages}
          disabled={isGeneratingImages}
        >
          {isGeneratingImages ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
          Générer images
        </Button>

        {gammeUrl && (
          <Button size="lg" variant="outline" className="gap-2" asChild>
            <a href={gammeUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Voir la page
            </a>
          </Button>
        )}
      </div>

      {/* Ligne 3 — Résultat (repliable) */}
      {contentResult?.command && (
        <div className="px-4 py-2.5 bg-purple-50 border-t border-purple-100 flex items-center gap-3">
          <code className="flex-1 text-xs font-mono text-purple-800 break-all">
            {contentResult.command}
          </code>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-7 text-xs flex-shrink-0"
            onClick={() => handleCopy(contentResult.command!)}
          >
            <ClipboardCopy className="h-3 w-3" />
            {copied ? "Copié !" : "Copier"}
          </Button>
        </div>
      )}
      {contentResult?.error && (
        <div className="px-4 py-2.5 bg-red-50 border-t border-red-100 text-xs text-red-700">
          {contentResult.error}
        </div>
      )}
      {contentResult?.message && !contentResult.command && (
        <div className="px-4 py-2.5 bg-blue-50 border-t border-blue-100 text-xs text-blue-700">
          {contentResult.message}
        </div>
      )}
    </div>
  );
}
