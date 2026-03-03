/**
 * MiniDiagnosticTable — "Diagnostic rapide" (S2_DIAG).
 * Renders a pre-formatted HTML table (Symptôme / Cause / Action) with violet styling.
 */

import { Stethoscope } from "lucide-react";
import { type GammeConseil } from "~/components/blog/conseil/section-config";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { GuideCard } from "./GuideCard";

interface MiniDiagnosticTableProps {
  section: GammeConseil;
}

export function MiniDiagnosticTable({ section }: MiniDiagnosticTableProps) {
  return (
    <GuideCard
      title={section.title}
      anchor={section.anchor}
      icon={Stethoscope}
      label="Diagnostic rapide"
      gradient="from-violet-500 to-indigo-500"
      border="border-violet-200"
      labelColor="text-violet-100"
      bodyBg="bg-white"
      sources={section.sources}
    >
      <div className="overflow-x-auto">
        <HtmlContent
          html={section.content}
          className="w-full text-sm
            [&_table]:w-full [&_table]:border-collapse
            [&_th]:bg-violet-50 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-violet-900 [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wide
            [&_td]:px-4 [&_td]:py-3 [&_td]:border-t [&_td]:border-gray-100 [&_td]:align-top [&_td]:text-gray-700
            [&_tr:hover_td]:bg-violet-50/40"
          trackLinks={false}
        />
      </div>
    </GuideCard>
  );
}
