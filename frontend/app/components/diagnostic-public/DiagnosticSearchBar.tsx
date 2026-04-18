import { useNavigate } from "@remix-run/react";
import { Search, AlertTriangle, Wrench, ScanLine, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card } from "~/components/ui/card";
import { type SearchHitPublic } from "./types";

const DEBOUNCE_MS = 220;

function TypeIcon({ type }: { type: SearchHitPublic["type"] }) {
  if (type === "dtc") return <ScanLine className="h-4 w-4 text-purple-600" />;
  if (type === "maintenance")
    return <Wrench className="h-4 w-4 text-emerald-600" />;
  return <AlertTriangle className="h-4 w-4 text-amber-600" />;
}

function routeFor(hit: SearchHitPublic): string {
  if (hit.type === "dtc") return `/diagnostic-auto/dtc/${hit.slug}`;
  if (hit.type === "maintenance") return `/entretien/${hit.slug}`;
  return `/diagnostic-auto/symptome/${hit.slug}`;
}

interface DiagnosticSearchBarProps {
  placeholder?: string;
  className?: string;
}

export function DiagnosticSearchBar({
  placeholder = "Rechercher un symptôme, un entretien ou un code OBD (ex: P0300)…",
  className = "",
}: DiagnosticSearchBarProps) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchHitPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/diagnostic-engine/search?q=${encodeURIComponent(trimmed)}&limit=8`,
          { signal: ac.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setResults(Array.isArray(data.results) ? data.results : []);
        setOpen(true);
        setActiveIdx(0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [q]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[activeIdx];
      if (hit) navigate(routeFor(hit));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          className="w-full h-14 pl-12 pr-12 rounded-xl border-2 border-border bg-background text-base shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"
          aria-label="Rechercher dans le moteur diagnostic"
          aria-autocomplete="list"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 max-h-96 overflow-auto shadow-xl">
          <ul role="listbox">
            {results.map((hit, idx) => (
              <li
                key={`${hit.type}:${hit.slug}`}
                role="option"
                aria-selected={idx === activeIdx}
              >
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => navigate(routeFor(hit))}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                    idx === activeIdx ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <div className="mt-0.5">
                    <TypeIcon type={hit.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {hit.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span className="uppercase">{hit.type}</span>
                      {hit.system_slug && (
                        <>
                          <span>•</span>
                          <span>{hit.system_slug}</span>
                        </>
                      )}
                      {hit.urgency && (
                        <>
                          <span>•</span>
                          <span>{hit.urgency}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
