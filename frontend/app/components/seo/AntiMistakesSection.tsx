import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { pluralizePieceName } from "~/lib/seo-utils";
import { cn } from "~/lib/utils";

interface AntiMistakesSectionProps {
  antiMistakes?: string[] | null;
  gammeName?: string;
  className?: string;
}

/**
 * Section anti-erreurs: points de vigilance concrets avant achat/montage.
 */
export const AntiMistakesSection = memo(function AntiMistakesSection({
  antiMistakes,
  gammeName,
  className,
}: AntiMistakesSectionProps) {
  if (!antiMistakes || antiMistakes.length === 0) return null;

  const pieceType = gammeName?.toLowerCase() || "pièce";
  const pluralType = pluralizePieceName(pieceType);

  return (
    <section
      className={cn("py-8", className)}
      aria-labelledby="anti-mistakes-title"
    >
      <div className="container mx-auto px-4">
        <Card className="border-rose-200 bg-rose-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-rose-600 text-white text-xl">
                ⛔
              </span>
              <CardTitle
                id="anti-mistakes-title"
                className="text-xl text-rose-900"
              >
                Erreurs à éviter sur vos {pluralType}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {antiMistakes.map((item, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 p-3 bg-white rounded-lg border border-rose-200"
                >
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-rose-100 text-rose-700 text-sm font-bold">
                    !
                  </span>
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
});

export default AntiMistakesSection;
