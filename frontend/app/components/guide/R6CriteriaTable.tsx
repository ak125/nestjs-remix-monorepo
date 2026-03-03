/**
 * R6CriteriaTable — Filterable selection criteria by priority (required/recommended/optional).
 * Uses shadcn Tabs with criteria cards grouped by priority level.
 */

import { ListChecks } from "lucide-react";
import { useMemo } from "react";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { type R6SelectionCriterion } from "~/types/r6-guide.types";
import { annotateGlossaryTerms } from "./GlossaryTooltip";
import { GuideCard } from "./GuideCard";

const PRIORITY_CONFIG = {
  required: {
    label: "Essentiels",
    badge: "bg-green-100 text-green-800 border-green-200",
    cardBorder: "border-green-200",
    dot: "bg-green-500",
  },
  recommended: {
    label: "Recommandes",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    cardBorder: "border-blue-200",
    dot: "bg-blue-500",
  },
  optional: {
    label: "Optionnels",
    badge: "bg-gray-100 text-gray-600 border-gray-200",
    cardBorder: "border-gray-200",
    dot: "bg-gray-400",
  },
} as const;

type Priority = keyof typeof PRIORITY_CONFIG;

interface R6CriteriaTableProps {
  criteria: R6SelectionCriterion[];
  gammeName: string;
}

export function R6CriteriaTable({ criteria, gammeName }: R6CriteriaTableProps) {
  const grouped = useMemo(() => {
    const map: Record<Priority, R6SelectionCriterion[]> = {
      required: [],
      recommended: [],
      optional: [],
    };
    for (const c of criteria) {
      const p = c.priority as Priority;
      if (map[p]) map[p].push(c);
      else map.recommended.push(c);
    }
    return map;
  }, [criteria]);

  if (criteria.length === 0) return null;

  // Find first non-empty tab for default
  const defaultTab =
    grouped.required.length > 0
      ? "required"
      : grouped.recommended.length > 0
        ? "recommended"
        : "optional";

  return (
    <GuideCard
      title={`Criteres de selection : ${gammeName}`}
      anchor="criteres-selection"
      icon={ListChecks}
      label="Comment choisir"
      gradient="from-emerald-500 to-teal-500"
      border="border-emerald-200"
      labelColor="text-emerald-100"
      bodyBg="bg-emerald-50/30"
    >
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          {(["required", "recommended", "optional"] as const).map((p) => (
            <TabsTrigger key={p} value={p} disabled={grouped[p].length === 0}>
              {PRIORITY_CONFIG[p].label}
              {grouped[p].length > 0 && (
                <span className="ml-1.5 text-xs opacity-60">
                  ({grouped[p].length})
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {(["required", "recommended", "optional"] as const).map((p) => (
          <TabsContent key={p} value={p}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {grouped[p].map((c) => (
                <div
                  key={c.key}
                  className={`rounded-lg border p-4 bg-white ${PRIORITY_CONFIG[p].cardBorder}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`w-2 h-2 rounded-full ${PRIORITY_CONFIG[p].dot}`}
                    />
                    <span className="font-semibold text-sm text-gray-900">
                      {c.label}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ml-auto ${PRIORITY_CONFIG[p].badge}`}
                    >
                      {PRIORITY_CONFIG[p].label}
                    </Badge>
                  </div>
                  <HtmlContent
                    html={annotateGlossaryTerms(c.guidance)}
                    className="text-sm text-gray-600 leading-relaxed [&_a]:text-emerald-600 [&_a]:underline [&_strong]:font-semibold [&_strong]:text-gray-800"
                  />
                </div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </GuideCard>
  );
}
