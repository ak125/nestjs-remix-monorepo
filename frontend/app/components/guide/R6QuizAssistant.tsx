/**
 * R6QuizAssistant — Interactive decision tree stepper for R6 Guide d'Achat.
 * Steps through R6DecisionNode[] one question at a time, showing a final verdict.
 */

import { RotateCcw, CheckCircle2, AlertTriangle, Search } from "lucide-react";
import { useState, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { type R6DecisionNode } from "~/types/r6-guide.types";
import { GuideCard } from "./GuideCard";
import { SoftCTA } from "./SoftCTA";

const TERMINAL_OUTCOMES = new Set(["replace", "check", "stop"]);

const VERDICT_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle2; bg: string }
> = {
  replace: {
    label: "Remplacement recommande",
    color: "text-red-700",
    icon: AlertTriangle,
    bg: "bg-red-50 border-red-200",
  },
  check: {
    label: "Verification necessaire",
    color: "text-amber-700",
    icon: Search,
    bg: "bg-amber-50 border-amber-200",
  },
  stop: {
    label: "Pas de remplacement necessaire",
    color: "text-green-700",
    icon: CheckCircle2,
    bg: "bg-green-50 border-green-200",
  },
};

interface R6QuizAssistantProps {
  nodes: R6DecisionNode[];
  gammeName: string;
  pgAlias: string;
  pgId: number;
}

export function R6QuizAssistant({
  nodes,
  gammeName,
  pgAlias,
  pgId,
}: R6QuizAssistantProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [verdict, setVerdict] = useState<string | null>(null);

  const handleOption = useCallback(
    (outcome: string) => {
      if (TERMINAL_OUTCOMES.has(outcome)) {
        setVerdict(outcome);
        return;
      }

      // outcome could be a node id — find its index
      const targetIdx = nodes.findIndex((n) => n.id === outcome);
      if (targetIdx !== -1) {
        setCurrentIndex(targetIdx);
      } else {
        // fallback: advance to next question
        if (currentIndex + 1 < nodes.length) {
          setCurrentIndex(currentIndex + 1);
        } else {
          setVerdict("check"); // ran out of questions
        }
      }
    },
    [nodes, currentIndex],
  );

  const reset = useCallback(() => {
    setCurrentIndex(0);
    setVerdict(null);
  }, []);

  if (nodes.length === 0) return null;

  const current = nodes[currentIndex];
  const progress = verdict
    ? 100
    : Math.round(((currentIndex + 1) / nodes.length) * 100);
  const v = verdict ? (VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.check) : null;

  return (
    <GuideCard
      title="Assistant de choix"
      anchor="quiz-assistant"
      icon={Search}
      label="Diagnostic interactif"
      gradient="from-indigo-500 to-blue-500"
      border="border-indigo-200"
      labelColor="text-indigo-100"
      bodyBg="bg-indigo-50/30"
    >
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-indigo-600">
            {verdict
              ? "Resultat"
              : `Question ${currentIndex + 1}/${nodes.length}`}
          </span>
          <span className="text-xs text-gray-500">{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Question or Verdict */}
      {verdict && v ? (
        <div className={`rounded-lg border p-5 ${v.bg}`}>
          <div className="flex items-center gap-3 mb-3">
            <v.icon className={`w-6 h-6 ${v.color}`} />
            <p className={`text-lg font-bold ${v.color}`}>{v.label}</p>
          </div>
          <p className="text-sm text-gray-700 mb-4">
            {verdict === "replace"
              ? `Il est temps de remplacer votre ${gammeName.toLowerCase()}. Consultez notre catalogue pour trouver la piece compatible.`
              : verdict === "check"
                ? `Nous vous recommandons de faire verifier votre ${gammeName.toLowerCase()} par un professionnel.`
                : `Votre ${gammeName.toLowerCase()} semble en bon etat. Continuez les verifications regulieres.`}
          </p>
          <div className="flex flex-wrap gap-3">
            {verdict === "replace" && (
              <SoftCTA
                label="Voir les pieces compatibles"
                href={`/pieces/${pgAlias}-${pgId}.html`}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              className="text-gray-500"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Recommencer
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-base font-semibold text-gray-900 mb-4">
            {current.question}
          </p>
          <div className="flex flex-col gap-2">
            {current.options.map((opt, idx) => {
              // Handle malformed data: label can be string or {label, outcome}
              const labelText =
                typeof opt.label === "string"
                  ? opt.label
                  : ((opt.label as Record<string, string>)?.label ?? "");
              const outcome =
                opt.outcome ||
                (typeof opt.label === "object"
                  ? ((opt.label as Record<string, string>)?.outcome ?? "")
                  : "");
              return (
                <Button
                  key={idx}
                  variant="outline"
                  className="justify-start text-left h-auto py-3 px-4 whitespace-normal hover:bg-indigo-50 hover:border-indigo-300"
                  onClick={() => handleOption(outcome)}
                >
                  {labelText}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </GuideCard>
  );
}
