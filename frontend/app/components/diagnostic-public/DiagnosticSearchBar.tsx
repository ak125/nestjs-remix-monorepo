import { useNavigate } from "@remix-run/react";
import { AlertTriangle, Loader2, ScanLine, Wrench } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";
import { cn } from "~/lib/utils";

import { type SearchHitPublic } from "./types";

const DEBOUNCE_MS = 220;
const MIN_CHARS = 2;
const LIMIT = 10;

type HitType = SearchHitPublic["type"];

const TYPE_LABEL: Record<HitType, string> = {
  symptom: "Symptômes",
  maintenance: "Entretien",
  dtc: "Codes OBD-II",
};

const TYPE_ORDER: HitType[] = ["symptom", "maintenance", "dtc"];

function TypeIcon({ type }: { type: HitType }) {
  if (type === "dtc") return <ScanLine className="text-purple-600" />;
  if (type === "maintenance") return <Wrench className="text-emerald-600" />;
  return <AlertTriangle className="text-amber-600" />;
}

function routeFor(hit: SearchHitPublic, vehicleTypeId?: number): string {
  const base =
    hit.type === "dtc"
      ? `/diagnostic-auto/dtc/${hit.slug}`
      : hit.type === "maintenance"
        ? `/entretien/${hit.slug}`
        : `/diagnostic-auto/symptome/${hit.slug}`;
  return vehicleTypeId ? `${base}?type=${vehicleTypeId}` : base;
}

function urgencyClass(urgency: string | null): string {
  if (!urgency) return "";
  const u = urgency.toLowerCase();
  if (u === "critical" || u === "high")
    return "bg-red-100 text-red-700 border-red-200";
  if (u === "medium") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function highlight(label: string, q: string) {
  const trimmed = q.trim();
  if (!trimmed) return label;
  const i = label.toLowerCase().indexOf(trimmed.toLowerCase());
  if (i < 0) return label;
  return (
    <>
      {label.slice(0, i)}
      <mark className="bg-yellow-100 text-inherit rounded-sm px-0.5">
        {label.slice(i, i + trimmed.length)}
      </mark>
      {label.slice(i + trimmed.length)}
    </>
  );
}

function useDebouncedSearch(q: string) {
  const [results, setResults] = useState<SearchHitPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < MIN_CHARS) {
      setResults([]);
      setLoading(false);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/diagnostic-engine/search?q=${encodeURIComponent(trimmed)}&limit=${LIMIT}`,
          { signal: ac.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setResults(Array.isArray(data.results) ? data.results : []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  const grouped = useMemo(() => {
    const map: Record<HitType, SearchHitPublic[]> = {
      symptom: [],
      maintenance: [],
      dtc: [],
    };
    for (const hit of results) map[hit.type]?.push(hit);
    return map;
  }, [results]);

  return { results, grouped, loading };
}

function HitRow({
  hit,
  q,
  onSelect,
}: {
  hit: SearchHitPublic;
  q: string;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={`${hit.type}:${hit.slug}`}
      onSelect={onSelect}
      className="min-h-[44px] gap-3 py-2.5"
    >
      <TypeIcon type={hit.type} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {highlight(hit.label, q)}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {hit.system_slug && (
            <span className="truncate">{hit.system_slug}</span>
          )}
          {hit.urgency && (
            <span
              className={cn(
                "rounded-full border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
                urgencyClass(hit.urgency),
              )}
            >
              {hit.urgency}
            </span>
          )}
        </div>
      </div>
    </CommandItem>
  );
}

interface SearchBodyProps {
  q: string;
  setQ: (v: string) => void;
  onPick: (hit: SearchHitPublic) => void;
  placeholder: string;
  inputClassName?: string;
  listClassName?: string;
}

function SearchBody({
  q,
  setQ,
  onPick,
  placeholder,
  inputClassName,
  listClassName,
}: SearchBodyProps) {
  const { grouped, loading } = useDebouncedSearch(q);
  const trimmed = q.trim();
  const showResults = trimmed.length >= MIN_CHARS;

  return (
    <>
      <CommandInput
        value={q}
        onValueChange={setQ}
        placeholder={placeholder}
        className={inputClassName}
        aria-label="Rechercher dans le moteur diagnostic"
      />
      {showResults && (
        <CommandList className={listClassName}>
          {loading && (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Recherche en cours…
            </div>
          )}
          {!loading && (
            <CommandEmpty>Aucun résultat pour « {trimmed} ».</CommandEmpty>
          )}
          {TYPE_ORDER.map((type, idx) => {
            const items = grouped[type];
            if (!items.length) return null;
            return (
              <div key={type}>
                {idx > 0 && <CommandSeparator />}
                <CommandGroup heading={TYPE_LABEL[type]}>
                  {items.map((hit) => (
                    <HitRow
                      key={`${hit.type}:${hit.slug}`}
                      hit={hit}
                      q={q}
                      onSelect={() => onPick(hit)}
                    />
                  ))}
                </CommandGroup>
              </div>
            );
          })}
        </CommandList>
      )}
    </>
  );
}

interface DiagnosticSearchBarProps {
  placeholder?: string;
  className?: string;
  /** Active le raccourci global ⌘K / Ctrl+K (default: true) */
  enableShortcut?: boolean;
  /** type_id véhicule — propagé en query param ?type= sur la navigation */
  vehicleTypeId?: number;
}

export function DiagnosticSearchBar({
  placeholder = "Rechercher un symptôme, un entretien ou un code OBD (ex: P0300)…",
  className = "",
  enableShortcut = true,
  vehicleTypeId,
}: DiagnosticSearchBarProps) {
  const navigate = useNavigate();
  const [inlineQ, setInlineQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogQ, setDialogQ] = useState("");

  useEffect(() => {
    if (!enableShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setDialogOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enableShortcut]);

  const pickInline = (hit: SearchHitPublic) => {
    setInlineQ("");
    navigate(routeFor(hit, vehicleTypeId));
  };
  const pickDialog = (hit: SearchHitPublic) => {
    setDialogOpen(false);
    setDialogQ("");
    navigate(routeFor(hit, vehicleTypeId));
  };

  return (
    <div className={cn("relative", className)}>
      <Command
        shouldFilter={false}
        loop
        className="overflow-visible rounded-xl border-2 border-border bg-background shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10"
      >
        <SearchBody
          q={inlineQ}
          setQ={setInlineQ}
          onPick={pickInline}
          placeholder={placeholder}
          inputClassName="h-14 text-base"
          listClassName="absolute top-full left-0 right-0 z-50 mt-2 max-h-96 overflow-auto rounded-xl border bg-popover shadow-xl"
        />
      </Command>

      {enableShortcut && (
        <div className="mt-2 text-right">
          <kbd className="inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
          <span className="ml-2 text-xs text-muted-foreground">
            pour ouvrir la recherche
          </span>
        </div>
      )}

      <CommandDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setDialogQ("");
        }}
        shouldFilter={false}
      >
        <SearchBody
          q={dialogQ}
          setQ={setDialogQ}
          onPick={pickDialog}
          placeholder={placeholder}
        />
      </CommandDialog>
    </div>
  );
}
