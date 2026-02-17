import {
  Wrench,
  Clock,
  Banknote,
  ChevronRight,
  CheckCircle2,
  ListOrdered,
  Search,
} from "lucide-react";
import { memo } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { pluralizePieceName } from "~/lib/seo-utils";

export interface PurchaseGuideData {
  intro: {
    title: string;
    role: string;
    syncParts: string[];
  };
  risk: {
    title: string;
    explanation: string;
    consequences: string[];
    costRange: string;
    conclusion: string;
  };
  timing: {
    title: string;
    years: string;
    km: string;
    note: string;
  };
  arguments: Array<{
    title: string;
    content: string;
    icon?: string;
  }>;
}

interface SelectionCriterion {
  label: string;
  guidance: string;
  priority: string;
}

interface QuickGuideSectionProps {
  guide: PurchaseGuideData;
  gammeName?: string;
  selectionCriteria?: SelectionCriterion[];
  howToChoose?: string | null;
  symptoms?: string[];
}

interface GuideCard {
  id: string;
  title: string;
  icon: React.ReactNode;
  summary: string;
  detail?: string;
  color: "blue" | "amber" | "green";
}

const colorClasses = {
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200 hover:border-blue-300",
    icon: "bg-blue-600 text-white",
    title: "text-blue-900",
    text: "text-blue-800",
    badge: "bg-blue-100 text-blue-700",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200 hover:border-amber-300",
    icon: "bg-amber-600 text-white",
    title: "text-amber-900",
    text: "text-amber-800",
    badge: "bg-amber-100 text-amber-700",
  },
  green: {
    bg: "bg-green-50",
    border: "border-green-200 hover:border-green-300",
    icon: "bg-green-600 text-white",
    title: "text-green-900",
    text: "text-green-800",
    badge: "bg-green-100 text-green-700",
  },
};

function GuideCardComponent({ card }: { card: GuideCard }) {
  const colors = colorClasses[card.color];

  return (
    <Card
      className={`${colors.bg} ${colors.border} transition-all hover:shadow-md`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`${colors.icon} w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0`}
          >
            {card.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`${colors.title} font-bold text-base mb-1`}>
              {card.title}
            </h3>
            <p className={`${colors.text} text-sm leading-snug`}>
              {card.summary}
            </p>
            {card.detail && (
              <Badge
                variant="secondary"
                size="xs"
                className={`${colors.badge} mt-2`}
              >
                {card.detail}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const QuickGuideSection = memo(function QuickGuideSection({
  guide,
  gammeName,
  selectionCriteria,
  howToChoose,
  symptoms,
}: QuickGuideSectionProps) {
  if (!guide) return null;

  const pluralName = gammeName
    ? pluralizePieceName(gammeName.toLowerCase())
    : "pièces";

  // Parse howToChoose steps (pattern: "1) step text 2) step text ...")
  const methodSteps = howToChoose
    ? howToChoose
        .split(/\d+\)\s*/)
        .filter((s) => s.trim().length > 0)
        .map((s) => s.trim().replace(/\.$/, ""))
    : [];

  // 3 cartes essentielles : rôle, timing, budget
  const cards: GuideCard[] = [
    {
      id: "role",
      title: "À quoi ça sert",
      icon: <Wrench className="w-5 h-5" />,
      summary: guide.intro?.role
        ? guide.intro.role.length > 80
          ? guide.intro.role.substring(0, 80).trim() + "…"
          : guide.intro.role
        : `Rôle des ${pluralName} dans votre véhicule.`,
      color: "blue",
    },
    {
      id: "timing",
      title: "Quand changer",
      icon: <Clock className="w-5 h-5" />,
      summary:
        guide.timing?.years && guide.timing?.km
          ? `Tous les ${guide.timing.years} ou ${guide.timing.km}`
          : `Intervalle recommandé pour vos ${pluralName}.`,
      detail: guide.timing?.note
        ? guide.timing.note.length > 40
          ? guide.timing.note.substring(0, 40).trim() + "…"
          : guide.timing.note
        : undefined,
      color: "amber",
    },
    {
      id: "budget",
      title: "Budget réparation",
      icon: <Banknote className="w-5 h-5" />,
      summary: guide.risk?.costRange
        ? `Coût moyen : ${guide.risk.costRange} (pièces + main-d'œuvre).`
        : `Consultez nos tarifs pour vos ${pluralName}.`,
      color: "green",
    },
  ];

  return (
    <section id="quick-guide" className="mb-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* 3 cartes en grille */}
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {cards.map((card) => (
              <GuideCardComponent key={card.id} card={card} />
            ))}
          </div>

          {/* Methode de selection — B3 R2D2 (etapes numerotees) */}
          {methodSteps.length > 0 && (
            <div className="mt-5 border-l-4 border-[#e8590c] bg-slate-50 rounded-r-lg p-4">
              <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-[#e8590c]" />
                Comment choisir vos {pluralName} en {methodSteps.length} etapes
              </h3>
              <ol className="space-y-2">
                {methodSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#e8590c] text-white flex items-center justify-center text-xs font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-700 leading-relaxed">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Checklist rapide — B1 R2D2 (visible en 10 sec) */}
          {selectionCriteria && selectionCriteria.length > 0 && (
            <div className="mt-5 border-l-4 border-[#0d1b3e] bg-slate-50 rounded-r-lg p-4">
              <h3 className="text-base font-bold text-slate-900 mb-3">
                Avant de commander vos {pluralName}
              </h3>
              <ul className="space-y-2">
                {selectionCriteria.slice(0, 7).map((criterion, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0d1b3e] mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">
                      <span className="font-medium text-gray-900">
                        {criterion.label}
                      </span>
                      {criterion.guidance ? ` — ${criterion.guidance}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 🔍 R2D2 U6: comment vérifier l'usure (test concret) */}
          {symptoms && symptoms.length > 0 && (
            <div className="mt-5 border-l-4 border-amber-400 bg-amber-50 rounded-r-lg p-4">
              <h3 className="text-base font-bold text-amber-900 mb-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-600" />
                Comment vérifier l&apos;usure de vos {pluralName}
              </h3>
              <ul className="space-y-2">
                {symptoms.slice(0, 3).map((symptom, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-amber-800 leading-relaxed">
                      Vérifiez :{" "}
                      {symptom.charAt(0).toLowerCase() + symptom.slice(1)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-amber-600">
                Si un ou plusieurs signes sont présents, le remplacement est
                recommandé.
              </p>
            </div>
          )}

          {/* CTA vers sélecteur */}
          <div className="mt-5 text-center">
            <Button
              variant="green"
              asChild
              className="shadow-sm active:scale-95"
            >
              <a href="#vehicle-selector">
                Sélectionner mon véhicule
                <ChevronRight className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
});

export default QuickGuideSection;
