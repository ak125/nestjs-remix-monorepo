/**
 * SummarySnippet — "L'essentiel en N points"
 * Featured snippet block: numbered summary from conseil sections.
 * Placed after S1, before the lead. Only renders with >= 3 points.
 */

import { ListOrdered } from "lucide-react";
import { type GammeConseil, extractSummaryPoints } from "./section-config";

interface SummarySnippetProps {
  conseil: GammeConseil[] | null;
}

export function SummarySnippet({ conseil }: SummarySnippetProps) {
  const points = extractSummaryPoints(conseil);
  if (points.length === 0) return null;

  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3 bg-slate-100 border-b border-slate-200">
        <ListOrdered className="w-5 h-5 text-blue-600" />
        <h2 className="text-base font-bold text-slate-800">
          L&apos;essentiel en {points.length} points
        </h2>
      </div>
      <ol className="px-5 py-4 space-y-3">
        {points.map((point, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {point.label}
              </span>
              <p className="text-sm text-slate-700 leading-relaxed">
                {point.text}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
