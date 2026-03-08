/**
 * ResultRagFacts — Display RAG-sourced evidence facts
 *
 * Shows verified facts from the RAG knowledge base,
 * grouped by evidence type with source citations.
 */
import {
  BookOpen,
  CheckCircle2,
  Search,
  Wrench,
  AlertTriangle,
  GraduationCap,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

interface RagFact {
  evidence_type: string;
  content: string;
  source_file?: string;
  truth_level?: string;
}

interface Props {
  facts: RagFact[];
}

const EVIDENCE_TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof BookOpen; color: string }
> = {
  cause_support_evidence: {
    label: "Causes documentées",
    icon: CheckCircle2,
    color: "text-blue-600",
  },
  verification_support_evidence: {
    label: "Méthodes de vérification",
    icon: Search,
    color: "text-green-600",
  },
  maintenance_support_evidence: {
    label: "Entretien recommandé",
    icon: Wrench,
    color: "text-orange-600",
  },
  weak_point_evidence: {
    label: "Points d'attention",
    icon: AlertTriangle,
    color: "text-red-600",
  },
  symptom_nuance_evidence: {
    label: "Précisions symptômes",
    icon: BookOpen,
    color: "text-purple-600",
  },
  pedagogical_support_evidence: {
    label: "Informations techniques",
    icon: GraduationCap,
    color: "text-gray-600",
  },
};

export function ResultRagFacts({ facts }: Props) {
  if (!facts || facts.length === 0) return null;

  // Group by evidence_type
  const grouped = facts.reduce<Record<string, RagFact[]>>((acc, fact) => {
    const key = fact.evidence_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(fact);
    return acc;
  }, {});

  // Unique sources
  const sources = [...new Set(facts.map((f) => f.source_file).filter(Boolean))];

  return (
    <Card className="border-indigo-100 bg-indigo-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          Documentation technique
          <Badge variant="secondary" className="text-xs ml-auto">
            {facts.length} fait{facts.length > 1 ? "s" : ""} vérifié
            {facts.length > 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(grouped).map(([type, typeFacts]) => {
          const config = EVIDENCE_TYPE_CONFIG[type] || {
            label: type,
            icon: BookOpen,
            color: "text-gray-600",
          };
          const Icon = config.icon;

          return (
            <div key={type}>
              <h4
                className={`text-sm font-medium flex items-center gap-1.5 mb-1 ${config.color}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {config.label}
              </h4>
              <ul className="space-y-0.5 ml-5">
                {typeFacts.map((fact, i) => (
                  <li key={i} className="text-sm text-gray-700 list-disc">
                    {fact.content}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        {sources.length > 0 && (
          <p className="text-xs text-gray-400 pt-1 border-t border-indigo-100">
            Sources : {sources.join(", ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
