import { memo, useMemo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import { type GammeBuyingGuideV1 } from "~/types/gamme-content-contract.types";

interface PurchaseGuideSectionProps {
  guide: GammeBuyingGuideV1;
  gammeName?: string;
  className?: string;
}

export const PurchaseGuideSection = memo(function PurchaseGuideSection({
  guide,
  gammeName,
  className,
}: PurchaseGuideSectionProps) {
  const criteria = guide?.selectionCriteria;
  const { requiredCriteria, recommendedCriteria } = useMemo(() => {
    const list = criteria || [];
    const required = list.filter((c) => c.priority === "required");
    const recommended = list.filter((c) => c.priority === "recommended");
    return { requiredCriteria: required, recommendedCriteria: recommended };
  }, [criteria]);

  if (!guide) return null;

  const compatibilityRules = guide.compatibilityRules || [];
  const decisionNodes = guide.decisionTree || [];
  const allCriteria = guide.selectionCriteria || [];
  const inputs = guide.inputs;
  const output = guide.output;

  return (
    <div className={cn("space-y-8", className)}>
      {/* Compatibility & inputs */}
      <section className="py-8" aria-labelledby="guide-compat-title">
        <div className="container mx-auto px-4">
          <h2
            id="guide-compat-title"
            className="text-2xl font-bold text-gray-900 mb-6"
          >
            {gammeName} : compatibilite et points critiques avant commande
          </h2>
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-blue-900">
                Eviter les erreurs de reference
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {inputs && (
                <div className="rounded-lg border border-blue-200 bg-white p-4">
                  <p className="font-semibold text-blue-900 mb-2">
                    Entrees a verifier avant filtrage
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>• {inputs.vehicle}</li>
                    <li>• {inputs.position}</li>
                    <li>• {inputs.dimensionsOrReference}</li>
                    <li>• {inputs.discType}</li>
                    {(inputs.constraints || []).map((item, index) => (
                      <li key={index}>• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {compatibilityRules.map((rule, index) => (
                <p
                  key={index}
                  className={cn(
                    "text-gray-700 leading-relaxed",
                    index === 0 && "text-lg",
                  )}
                >
                  {rule}
                </p>
              ))}
              {guide.pairing?.required?.length > 0 && (
                <div className="rounded-lg border border-blue-200 bg-white p-4">
                  <p className="font-semibold text-blue-900 mb-2">
                    A verifier en meme temps
                  </p>
                  <ul className="space-y-2">
                    {guide.pairing.required.map((item, index) => (
                      <li key={index} className="text-gray-700">
                        • {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Decision tree — Accordion */}
      {decisionNodes.length > 0 && (
        <section className="py-8" aria-labelledby="guide-decision-title">
          <div className="container mx-auto px-4">
            <h2
              id="guide-decision-title"
              className="text-2xl font-bold text-gray-900 mb-6"
            >
              Arbre de decision rapide
            </h2>
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="pt-6">
                <Accordion
                  type="multiple"
                  defaultValue={[decisionNodes[0]?.id]}
                >
                  {decisionNodes.map((node) => (
                    <AccordionItem
                      key={node.id}
                      value={node.id}
                      className="border-amber-200"
                    >
                      <AccordionTrigger className="text-amber-900 hover:no-underline">
                        {node.question}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {(node.options || []).map((option, index) => (
                            <div
                              key={`${node.id}-${index}`}
                              className="rounded-lg border border-amber-200 bg-white p-3 flex items-start gap-3"
                            >
                              <Badge
                                variant="outline"
                                className={cn(
                                  "shrink-0 mt-0.5 text-xs",
                                  option.outcome === "replace" &&
                                    "border-red-300 text-red-700 bg-red-50",
                                  option.outcome === "check" &&
                                    "border-amber-300 text-amber-700 bg-amber-50",
                                  option.outcome === "continue" &&
                                    "border-green-300 text-green-700 bg-green-50",
                                  option.outcome === "stop" &&
                                    "border-gray-300 text-gray-700 bg-gray-50",
                                )}
                              >
                                {option.outcome}
                              </Badge>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {option.label}
                                </p>
                                {option.note && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    {option.note}
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
              </CardContent>
            </Card>
            {(output?.warnings || []).length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                <p className="font-semibold text-amber-900 mb-2">
                  Warnings compatibilite
                </p>
                <ul className="space-y-2">
                  {output.warnings.map((warning, index) => (
                    <li key={index} className="text-sm text-gray-700">
                      • {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Selection criteria — Tabs required/recommended */}
      {allCriteria.length > 0 && (
        <section className="py-8" aria-labelledby="guide-criteria-title">
          <div className="container mx-auto px-4">
            <h2
              id="guide-criteria-title"
              className="text-2xl font-bold text-gray-900 mb-6"
            >
              Criteres de selection selon votre usage
            </h2>
            <Card className="border-indigo-200 bg-indigo-50/50">
              <CardContent className="pt-6">
                {requiredCriteria.length > 0 &&
                recommendedCriteria.length > 0 ? (
                  <Tabs defaultValue="required">
                    <TabsList className="mb-4">
                      <TabsTrigger value="required">
                        Obligatoires ({requiredCriteria.length})
                      </TabsTrigger>
                      <TabsTrigger value="recommended">
                        Recommandes ({recommendedCriteria.length})
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="required">
                      <CriteriaGrid criteria={requiredCriteria} />
                    </TabsContent>
                    <TabsContent value="recommended">
                      <CriteriaGrid criteria={recommendedCriteria} />
                    </TabsContent>
                  </Tabs>
                ) : (
                  <CriteriaGrid criteria={allCriteria} />
                )}

                {(guide.useCases || []).length > 0 && (
                  <div className="mt-5 rounded-lg border border-indigo-200 bg-white p-4">
                    <p className="font-semibold text-indigo-900 mb-2">
                      Cas d'usage
                    </p>
                    <ul className="space-y-2">
                      {guide.useCases.map((item) => (
                        <li key={item.id} className="text-sm text-gray-700">
                          <span className="font-medium">{item.label}:</span>{" "}
                          {item.recommendation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {output?.selectedSpec && (
                  <div className="mt-5 rounded-lg border border-indigo-200 bg-white p-4">
                    <p className="font-semibold text-indigo-900 mb-2">
                      Sortie attendue
                    </p>
                    <p className="text-sm text-gray-700">
                      {output.selectedSpec}
                    </p>
                    {(output.pairingAdvice || []).length > 0 && (
                      <ul className="space-y-2 mt-3">
                        {output.pairingAdvice.map((item, index) => (
                          <li key={index} className="text-sm text-gray-700">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Trust arguments */}
      {(guide.trustArguments || []).length > 0 && (
        <section className="py-8" aria-labelledby="guide-trust-title">
          <div className="container mx-auto px-4">
            <h2
              id="guide-trust-title"
              className="text-2xl font-bold text-gray-900 mb-6"
            >
              Pourquoi commander sur Automecanik
            </h2>
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {guide.trustArguments.map((arg) => (
                    <div
                      key={arg.title}
                      className="rounded-lg border border-green-200 bg-white p-4"
                    >
                      <p className="font-semibold text-green-900">
                        {arg.title}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        {arg.content}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
});

/** Reusable grid for selection criteria */
function CriteriaGrid({
  criteria,
}: {
  criteria: GammeBuyingGuideV1["selectionCriteria"];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {criteria.map((criterion) => (
        <div
          key={criterion.key}
          className="rounded-lg border border-indigo-200 bg-white p-4"
        >
          <p className="font-semibold text-indigo-900">{criterion.label}</p>
          <p className="text-sm text-gray-700 mt-1">{criterion.guidance}</p>
        </div>
      ))}
    </div>
  );
}

export default PurchaseGuideSection;
