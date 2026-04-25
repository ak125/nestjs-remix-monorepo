// 📝 R8 Vehicle — S_SEO_INTRO
// R8 enriched content blocks (vehicle_identity, selection_help) or fallback SEO.

import { HtmlContent } from "../../../seo/HtmlContent";
import { type LoaderData } from "../r8.types";

interface Props {
  r8Content: LoaderData["r8Content"];
  seo: LoaderData["seo"];
}

export function SeoIntroSection({ r8Content, seo }: Props) {
  return (
    <div
      className="bg-white rounded-lg shadow-sm p-6 mb-8"
      data-section="S_SEO_INTRO"
    >
      {r8Content && r8Content.blocks.length > 0 ? (
        <div className="space-y-6">
          {r8Content.blocks
            .filter(
              (b) =>
                b.type === "vehicle_identity" || b.type === "selection_help",
            )
            .map((block) => (
              <div key={block.id}>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {block.title}
                </h2>
                <div className="prose prose-sm max-w-none text-gray-700">
                  <HtmlContent html={block.renderedText} trackLinks={true} />
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="prose max-w-none">
          <HtmlContent html={seo.content} trackLinks={true} />
          <HtmlContent html={seo.content2} trackLinks={true} />
        </div>
      )}
    </div>
  );
}
