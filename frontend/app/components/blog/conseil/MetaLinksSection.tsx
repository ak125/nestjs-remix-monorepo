/**
 * MetaLinksSection — "Pour aller plus loin"
 * Renders META conseil sections with internal links.
 * Placed after SourcesDisclaimer, before ArticleActionsBar.
 */

import { ExternalLink } from "lucide-react";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { type GammeConseil, slugifyTitle } from "./section-config";

interface MetaLinksSectionProps {
  sections: GammeConseil[];
}

export function MetaLinksSection({ sections }: MetaLinksSectionProps) {
  if (sections.length === 0) return null;

  return (
    <div className="mt-8">
      {sections.map((meta, idx) => (
        <div
          key={idx}
          id={slugifyTitle(meta.title || "pour-aller-plus-loin")}
          className="rounded-lg border border-gray-200 bg-gray-50/50 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-200 bg-gray-100">
            <ExternalLink className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-700">
              {meta.title || "Pour aller plus loin"}
            </h2>
          </div>
          <div className="px-5 py-4">
            <HtmlContent
              html={meta.content}
              className="text-sm text-gray-600 leading-relaxed
                [&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-blue-800
                [&_b]:font-semibold [&_b]:text-gray-800
                [&_li]:mb-1"
              trackLinks={true}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
