/**
 * GuideSteps — Numbered step-by-step procedure (S4_DEPOSE / S4_REPOSE).
 * Uses step-prose CSS for numbered circles and vertical connector line.
 */

import { Wrench } from "lucide-react";
import {
  type GammeConseil,
  normalizeStepHtml,
} from "~/components/blog/conseil/section-config";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { GuideCard } from "./GuideCard";

interface GuideStepsProps {
  section: GammeConseil;
  variant?: "depose" | "repose";
}

const LABELS = {
  depose: "Démontage",
  repose: "Remontage",
} as const;

export function GuideSteps({ section, variant = "depose" }: GuideStepsProps) {
  return (
    <GuideCard
      title={section.title}
      anchor={section.anchor}
      icon={Wrench}
      label={LABELS[variant]}
      gradient="from-slate-600 to-gray-700"
      border="border-slate-200"
      labelColor="text-slate-300"
      sources={section.sources}
    >
      <div className="step-prose">
        <HtmlContent
          html={normalizeStepHtml(section.content)}
          className="text-sm text-gray-700 leading-relaxed
            [&_p]:mb-3 [&_a]:text-blue-600 [&_a]:underline-offset-2
            [&_strong]:font-semibold [&_strong]:text-gray-900"
          trackLinks={true}
        />
      </div>
    </GuideCard>
  );
}
