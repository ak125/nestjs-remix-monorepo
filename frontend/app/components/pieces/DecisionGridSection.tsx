import { HelpCircle, ArrowRight, Target } from "lucide-react";
import { memo } from "react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { pluralizePieceName } from "~/lib/seo-utils";

interface UseCase {
  id: string;
  label: string;
  recommendation: string;
}

interface DecisionOption {
  label: string;
  outcome: string;
  note?: string;
}

interface DecisionNode {
  id: string;
  question: string;
  options: DecisionOption[];
}

interface DecisionGridSectionProps {
  useCases?: UseCase[];
  decisionTree?: DecisionNode[];
  gammeName?: string;
}

const OUTCOME_STYLES: Record<string, string> = {
  replace: "bg-red-100 text-red-800 border-red-200",
  check: "bg-amber-100 text-amber-800 border-amber-200",
  continue: "bg-blue-100 text-blue-800 border-blue-200",
  stop: "bg-green-100 text-green-800 border-green-200",
};

const OUTCOME_LABELS: Record<string, string> = {
  replace: "Remplacer",
  check: "A verifier",
  continue: "Question suivante",
  stop: "OK",
};

export const DecisionGridSection = memo(function DecisionGridSection({
  useCases,
  decisionTree,
  gammeName,
}: DecisionGridSectionProps) {
  const hasUseCases = useCases && useCases.length > 0;
  const hasDecisionTree = decisionTree && decisionTree.length > 0;

  if (!hasUseCases && !hasDecisionTree) return null;

  const pluralName = gammeName
    ? pluralizePieceName(gammeName.toLowerCase())
    : "pieces";

  return (
    <section id="decision-grid" className="mb-8">
      <div className="space-y-6">
        {/* Partie A : Table comparative use-cases */}
        {hasUseCases && (
          <Card className="border-slate-200 bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#0d1b3e] text-white">
                  <Target className="w-5 h-5" />
                </span>
                <h2 className="text-xl sm:text-2xl md:text-[28px] font-bold tracking-tight text-slate-900">
                  Quel type de {pluralName} selon votre usage ?
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              {/* Desktop : table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px] font-semibold text-slate-900">
                        Profil
                      </TableHead>
                      <TableHead className="font-semibold text-slate-900">
                        Recommandation
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {useCases!.map((uc) => (
                      <TableRow key={uc.id}>
                        <TableCell className="font-medium text-slate-900">
                          {uc.label}
                        </TableCell>
                        <TableCell className="text-slate-700">
                          {uc.recommendation}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile : cards empilees */}
              <div className="sm:hidden space-y-3">
                {useCases!.map((uc) => (
                  <div
                    key={uc.id}
                    className="p-3 bg-white rounded-lg border border-slate-200"
                  >
                    <p className="font-semibold text-slate-900 text-base">
                      {uc.label}
                    </p>
                    <p className="text-slate-700 text-base mt-1">
                      {uc.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Partie B : Arbre de decision */}
        {hasDecisionTree && (
          <Card className="border-slate-200 bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#0d1b3e] text-white">
                  <HelpCircle className="w-5 h-5" />
                </span>
                <h2 className="text-xl sm:text-2xl md:text-[28px] font-bold tracking-tight text-slate-900">
                  Diagnostic rapide
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {decisionTree!.map((node, nodeIdx) => (
                  <div key={node.id} className="relative">
                    {/* Question */}
                    <div className="flex items-start gap-3 mb-2">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-bold mt-0.5">
                        {nodeIdx + 1}
                      </span>
                      <p className="font-medium text-slate-900 text-base leading-relaxed">
                        {node.question}
                      </p>
                    </div>

                    {/* Options / reponses */}
                    <div className="ml-10 space-y-2">
                      {node.options.map((opt, optIdx) => {
                        const style =
                          OUTCOME_STYLES[opt.outcome] ||
                          OUTCOME_STYLES.continue;
                        const outcomeLabel =
                          OUTCOME_LABELS[opt.outcome] || opt.outcome;

                        return (
                          <div
                            key={optIdx}
                            className="flex items-start gap-2 text-sm"
                          >
                            <ArrowRight className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-slate-800">
                                {opt.label}
                              </span>
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}
                              >
                                {outcomeLabel}
                              </span>
                              {opt.note && (
                                <span className="text-slate-500 text-xs">
                                  — {opt.note}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Separateur entre questions */}
                    {nodeIdx < decisionTree!.length - 1 && (
                      <div className="ml-3 mt-3 mb-1 border-l-2 border-slate-200 h-4" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
});

export default DecisionGridSection;
