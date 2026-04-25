// 🎁 R8 Vehicle — S_R8_ENRICHED
// Optional block with variant_difference and maintenance_context from R8 enricher.
// Renders nothing if no matching blocks.

import { Car, Wrench } from "lucide-react";
import { HtmlContent } from "../../../seo/HtmlContent";
import { type LoaderData } from "../r8.types";

interface Props {
  r8Content: LoaderData["r8Content"];
}

export function R8EnrichedSection({ r8Content }: Props) {
  const blocks =
    r8Content?.blocks.filter(
      (b) =>
        b.type === "variant_difference" || b.type === "maintenance_context",
    ) ?? [];

  if (blocks.length === 0) return null;

  return (
    <div className="mb-12 space-y-6" data-section="S_R8_ENRICHED">
      {blocks.map((block) => (
        <div
          key={block.id}
          className={`rounded-2xl border p-6 ${
            block.type === "variant_difference"
              ? "bg-indigo-50 border-indigo-200"
              : "bg-blue-50 border-blue-200"
          }`}
        >
          <div className="flex items-start gap-3 mb-3">
            {block.type === "variant_difference" ? (
              <Car size={24} className="text-indigo-600 flex-shrink-0 mt-0.5" />
            ) : (
              <Wrench
                size={24}
                className="text-blue-600 flex-shrink-0 mt-0.5"
              />
            )}
            <h2 className="text-xl font-bold text-gray-900">{block.title}</h2>
          </div>
          <div className="prose prose-sm max-w-none text-gray-700 ml-9">
            <HtmlContent html={block.renderedText} trackLinks={true} />
          </div>
        </div>
      ))}
    </div>
  );
}
