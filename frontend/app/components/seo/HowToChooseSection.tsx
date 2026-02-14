import { memo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { pluralizePieceName } from "~/lib/seo-utils";
import { cn } from "~/lib/utils";
import { type GammeBuyingGuideV1 } from "~/types/gamme-content-contract.types";

interface HowToChooseSectionProps {
  guide?: GammeBuyingGuideV1 | null;
  gammeName?: string;
  className?: string;
}

/**
 * Section "Comment choisir la bonne piece ?"
 * Full grid: decision tree (Accordion), criteria, use cases, output.
 */
export const HowToChooseSection = memo(function HowToChooseSection({
  guide,
  gammeName,
  className,
}: HowToChooseSectionProps) {
  if (!guide) return null;

  const pieceType = gammeName?.toLowerCase() || "piece";
  const pluralType = pluralizePieceName(pieceType);
  const criteria = guide.selectionCriteria || [];
  const decisionTree = guide.decisionTree || [];
  const useCases = guide.useCases || [];
  const inputs = guide.inputs;
  const output = guide.output;

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
            <div className="space-y-5">
              {inputs && (
                <div>
                  <p className="text-sm font-semibold text-indigo-900 mb-2">
                    Donnees indispensables
                  </p>
                  <ul className="space-y-2">
                    <li className="rounded-lg border border-indigo-200 bg-white p-3 text-sm text-gray-700">
                      {inputs.vehicle}
                    </li>
                    <li className="rounded-lg border border-indigo-200 bg-white p-3 text-sm text-gray-700">
                      {inputs.position}
                    </li>
                    <li className="rounded-lg border border-indigo-200 bg-white p-3 text-sm text-gray-700">
                      {inputs.dimensionsOrReference}
                    </li>
                    <li className="rounded-lg border border-indigo-200 bg-white p-3 text-sm text-gray-700">
                      {inputs.discType}
                    </li>
                  </ul>
                </div>
              )}

              {decisionTree.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-indigo-900 mb-2">
                    Arbre de decision
                  </p>
                  <Accordion
                    type="multiple"
                    defaultValue={[decisionTree[0]?.id]}
                  >
                    {decisionTree.map((node) => (
                      <AccordionItem
                        key={node.id}
                        value={node.id}
                        className="border-indigo-200"
                      >
                        <AccordionTrigger className="text-indigo-900 hover:no-underline text-sm">
                          {node.question}
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2">
                            {(node.options || []).map((opt, index) => (
                              <div
                                key={`${node.id}-${index}`}
                                className="rounded-lg border border-indigo-200 bg-white p-3 flex items-start gap-3"
                              >
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "shrink-0 mt-0.5 text-xs",
                                    opt.outcome === "replace" &&
                                      "border-red-300 text-red-700 bg-red-50",
                                    opt.outcome === "check" &&
                                      "border-amber-300 text-amber-700 bg-amber-50",
                                    opt.outcome === "continue" &&
                                      "border-green-300 text-green-700 bg-green-50",
                                    opt.outcome === "stop" &&
                                      "border-gray-300 text-gray-700 bg-gray-50",
                                  )}
                                >
                                  {opt.outcome}
                                </Badge>
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {opt.label}
                                  </p>
                                  {opt.note && (
                                    <p className="text-sm text-gray-600 mt-1">
                                      {opt.note}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}

              {criteria.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-indigo-900 mb-2">
                    Criteres de selection
                  </p>
                  <ul className="space-y-2">
                    {criteria.map((criterion) => (
                      <li
                        key={criterion.key}
                        className="rounded-lg border border-indigo-200 bg-white p-3"
                      >
                        <p className="font-medium text-gray-900">
                          {criterion.label}
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {criterion.guidance}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {useCases.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-indigo-900 mb-2">
                    Cas d'usage
                  </p>
                  <ul className="space-y-2">
                    {useCases.map((useCase) => (
                      <li
                        key={useCase.id}
                        className="rounded-lg border border-indigo-200 bg-white p-3 text-sm text-gray-700"
                      >
                        <span className="font-medium text-gray-900">
                          {useCase.label}
                        </span>{" "}
                        - {useCase.recommendation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {output?.selectedSpec && (
                <div>
                  <p className="text-sm font-semibold text-indigo-900 mb-2">
                    Resultat du choix
                  </p>
                  <div className="rounded-lg border border-indigo-200 bg-white p-3">
                    <p className="text-sm text-gray-700">
                      {output.selectedSpec}
                    </p>
                    {(output.warnings || []).length > 0 && (
                      <ul className="space-y-2 mt-3">
                        {output.warnings.map((warning, index) => (
                          <li key={index} className="text-sm text-gray-700">
                            • {warning}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
});

export default HowToChooseSection;
