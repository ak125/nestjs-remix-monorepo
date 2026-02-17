import { Wrench, Clock, Banknote, ChevronRight } from "lucide-react";
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

interface QuickGuideSectionProps {
  guide: PurchaseGuideData;
  gammeName?: string;
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
}: QuickGuideSectionProps) {
  if (!guide) return null;

  const pluralName = gammeName
    ? pluralizePieceName(gammeName.toLowerCase())
    : "pièces";

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
