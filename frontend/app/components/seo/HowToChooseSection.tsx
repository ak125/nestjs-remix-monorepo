import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { pluralizePieceName } from "~/lib/seo-utils";
import { cn } from "~/lib/utils";

interface HowToChooseSectionProps {
  content?: string | null;
  gammeName?: string;
  className?: string;
}

/**
 * Section "Comment choisir la bonne pièce ?"
 * Contenu sur les matériaux, qualité OE, type de conduite
 */
export const HowToChooseSection = memo(function HowToChooseSection({
  content,
  gammeName,
  className,
}: HowToChooseSectionProps) {
  if (!content) return null;

  const pieceType = gammeName?.toLowerCase() || "pièce";
  const pluralType = pluralizePieceName(pieceType);

  return (
    <section
      className={cn("py-8", className)}
      aria-labelledby="how-to-choose-title"
    >
      <div className="container mx-auto px-4">
        <Card className="border-indigo-200 bg-indigo-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white text-xl">
                🎯
              </span>
              <CardTitle
                id="how-to-choose-title"
                className="text-xl text-indigo-900"
              >
                Comment choisir les bonnes {pluralType} ?
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-indigo max-w-none">
              <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-line">
                {content}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
});

export default HowToChooseSection;
