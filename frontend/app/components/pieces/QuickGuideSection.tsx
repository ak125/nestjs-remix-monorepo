import { Wrench, AlertTriangle, Clock, Target, ChevronRight, Lightbulb } from 'lucide-react';
import { pluralizePieceName } from '~/lib/seo-utils';

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
  color: 'blue' | 'red' | 'amber' | 'green';
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200 hover:border-blue-300',
    icon: 'bg-blue-600 text-white',
    title: 'text-blue-900',
    text: 'text-blue-800',
    badge: 'bg-blue-100 text-blue-700',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200 hover:border-red-300',
    icon: 'bg-red-600 text-white',
    title: 'text-red-900',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-700',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200 hover:border-amber-300',
    icon: 'bg-amber-600 text-white',
    title: 'text-amber-900',
    text: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-700',
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200 hover:border-green-300',
    icon: 'bg-green-600 text-white',
    title: 'text-green-900',
    text: 'text-green-800',
    badge: 'bg-green-100 text-green-700',
  },
};

function GuideCardComponent({ card }: { card: GuideCard }) {
  const colors = colorClasses[card.color];

  return (
    <div
      className={`${colors.bg} ${colors.border} border rounded-xl p-4 transition-all hover:shadow-md`}
    >
      <div className="flex items-start gap-3">
        <div className={`${colors.icon} w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0`}>
          {card.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`${colors.title} font-bold text-sm mb-1`}>{card.title}</h3>
          <p className={`${colors.text} text-sm leading-snug`}>{card.summary}</p>
          {card.detail && (
            <span className={`${colors.badge} inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium`}>
              {card.detail}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QuickGuideSection({ guide, gammeName }: QuickGuideSectionProps) {
  if (!guide) return null;

  const pluralName = gammeName ? pluralizePieceName(gammeName.toLowerCase()) : 'pièces';

  // Extraire les infos clés du guide pour les 4 cartes
  const cards: GuideCard[] = [
    {
      id: 'role',
      title: 'Rôle & sécurité',
      icon: <Wrench className="w-5 h-5" />,
      summary: guide.intro?.role
        ? guide.intro.role.length > 100
          ? guide.intro.role.substring(0, 100).trim() + '…'
          : guide.intro.role
        : `Découvrez le rôle des ${pluralName} dans votre système de freinage.`,
      color: 'blue',
    },
    {
      id: 'risk',
      title: 'Risques si usé',
      icon: <AlertTriangle className="w-5 h-5" />,
      summary: guide.risk?.explanation
        ? guide.risk.explanation.length > 100
          ? guide.risk.explanation.substring(0, 100).trim() + '…'
          : guide.risk.explanation
        : `Ne jamais négliger l'état de vos ${pluralName}.`,
      detail: guide.risk?.costRange ? `Réparation: ${guide.risk.costRange}` : undefined,
      color: 'red',
    },
    {
      id: 'timing',
      title: 'Quand changer',
      icon: <Clock className="w-5 h-5" />,
      summary: guide.timing?.years && guide.timing?.km
        ? `Tous les ${guide.timing.years} ou ${guide.timing.km}`
        : `Intervalle recommandé pour vos ${pluralName}.`,
      detail: guide.timing?.note
        ? guide.timing.note.length > 40
          ? guide.timing.note.substring(0, 40).trim() + '…'
          : guide.timing.note
        : undefined,
      color: 'amber',
    },
    {
      id: 'choose',
      title: 'Comment choisir',
      icon: <Target className="w-5 h-5" />,
      summary: `Sélectionnez votre véhicule pour afficher les ${pluralName} compatibles avec les bons débits et dimensions.`,
      color: 'green',
    },
  ];

  return (
    <section id="quick-guide" className="mb-8">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header compact */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Lightbulb className="w-6 h-6" />
              Guide rapide : {gammeName || 'pièces auto'}
            </h2>
            <span className="text-indigo-200 text-sm hidden sm:block">
              L'essentiel en 30 secondes
            </span>
          </div>
        </div>

        {/* 4 cartes en grille */}
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cards.map((card) => (
              <GuideCardComponent key={card.id} card={card} />
            ))}
          </div>

          {/* CTA vers sélecteur */}
          <div className="mt-6 text-center">
            <a
              href="#vehicle-selector"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95"
              onClick={(e) => {
                e.preventDefault();
                const element = document.getElementById('vehicle-selector');
                if (element) {
                  const offset = 80;
                  const elementPosition = element.getBoundingClientRect().top + window.scrollY;
                  window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
                }
              }}
            >
              Sélectionner mon véhicule
              <ChevronRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
