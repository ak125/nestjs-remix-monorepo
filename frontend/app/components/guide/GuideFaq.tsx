/**
 * GuideFaq — Dedicated S8 FAQ accordion with schema.org-friendly markup.
 * Uses native <details>/<summary> from the HTML content, styled for the guide design system.
 */

import { HelpCircle } from "lucide-react";
import {
  type GammeConseil,
  normalizeFaqHtml,
} from "~/components/blog/conseil/section-config";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { GuideCard } from "./GuideCard";

interface GuideFaqProps {
  section: GammeConseil;
}

export function GuideFaq({ section }: GuideFaqProps) {
  const html = normalizeFaqHtml(section.content);

  return (
    <GuideCard
      title={section.title}
      anchor={section.anchor}
      icon={HelpCircle}
      label="Questions fréquentes"
      gradient="from-violet-500 to-purple-500"
      border="border-violet-200"
      labelColor="text-violet-100"
      bodyBg="bg-violet-50/30"
      sources={section.sources}
    >
      <div className="faq-accordion space-y-3">
        <HtmlContent
          html={html}
          className={`text-sm text-gray-700 leading-relaxed
            [&_details]:rounded-lg [&_details]:border [&_details]:border-violet-200
            [&_details]:bg-white [&_details]:overflow-hidden [&_details]:transition-all
            [&_details[open]]:shadow-md [&_details[open]]:border-violet-300
            [&_summary]:cursor-pointer [&_summary]:px-4 [&_summary]:py-3
            [&_summary]:flex [&_summary]:items-center [&_summary]:gap-2
            [&_summary]:font-medium [&_summary]:text-gray-900
            [&_summary]:hover:bg-violet-50 [&_summary]:transition-colors
            [&_summary]:list-none [&_summary::-webkit-details-marker]:hidden
            [&_details>p]:px-4 [&_details>p]:pb-4 [&_details>p]:pt-0
            [&_details>p]:text-gray-600 [&_details>p]:leading-relaxed
            [&_details>p]:border-t [&_details>p]:border-violet-100
            [&_details>p]:mt-0 [&_details>p]:pt-3
            [&_a]:text-violet-600 [&_a]:underline [&_a]:underline-offset-2
            [&_strong]:font-semibold [&_strong]:text-gray-900`}
          trackLinks={true}
        />
      </div>
    </GuideCard>
  );
}
