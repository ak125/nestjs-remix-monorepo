import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { cn } from '~/lib/utils';

// Types matching backend PurchaseGuideData V2 (orientée client)
export interface PurchaseGuideData {
  id?: number;
  pgId?: string;

  // Section 1: À quoi ça sert
  intro: {
    title: string;
    role: string;
    syncParts: string[];
  };

  // Section 2: Pourquoi c'est critique (réduction de la peur)
  risk: {
    title: string;
    explanation: string;
    consequences: string[];
    costRange: string;
    conclusion: string;
  };

  // Section 3: Quand changer
  timing: {
    title: string;
    years: string;
    km: string;
    note: string;
  };

  // Section 4: Pourquoi acheter chez nous (4 arguments)
  arguments: Array<{
    title: string;
    content: string;
    icon?: string;
  }>;

  // Nouvelles sections (Phase 2)
  h1Override?: string | null;
  howToChoose?: string | null;
  symptoms?: string[] | null;
  faq?: Array<{ question: string; answer: string }> | null;

  createdAt?: string;
  updatedAt?: string;
}

interface PurchaseGuideSectionProps {
  guide: PurchaseGuideData;
  gammeName?: string;
  className?: string;
}

/**
 * Composant complet du guide d'achat (pour rétrocompatibilité)
 * Contient toutes les sections ensemble
 */
export function PurchaseGuideSection({
  guide,
  gammeName,
  className,
}: PurchaseGuideSectionProps) {
  if (!guide) return null;

  return (
    <div className={cn('space-y-8', className)}>
      <IntroSection intro={guide.intro} gammeName={gammeName} />
      <RiskSection risk={guide.risk} gammeName={gammeName} />
      <TimingSection timing={guide.timing} gammeName={gammeName} />
      <ArgumentsSection arguments={guide.arguments} gammeName={gammeName} />
    </div>
  );
}

// ============================================================================
// SECTIONS EXPORTÉES INDIVIDUELLEMENT (pour nouvelle structure avec H2)
// ============================================================================

interface IntroSectionProps {
  intro: PurchaseGuideData['intro'];
  gammeName?: string;
  className?: string;
}

/**
 * Section 1: À quoi ça sert / Rôle et sécurité
 * H2: {Gamme} : rôle et sécurité
 */
export function IntroSection({ intro, gammeName, className }: IntroSectionProps) {
  if (!intro.title && !intro.role) return null;

  const pieceType = gammeName?.toLowerCase() || 'cette pièce';

  return (
    <section
      className={cn('py-8', className)}
      aria-labelledby="intro-section-title"
    >
      <div className="container mx-auto px-4">
        <h2
          id="intro-section-title"
          className="text-2xl font-bold text-gray-900 mb-6"
        >
          {gammeName} : rôle et sécurité
        </h2>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white text-xl">
                🔧
              </span>
              <CardTitle className="text-xl text-blue-900">
                {intro.title || 'À quoi ça sert ?'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {intro.role && (
              <p className="text-gray-700 text-lg leading-relaxed">{intro.role}</p>
            )}

            {intro.syncParts && intro.syncParts.length > 0 && (
              <div className="pt-2">
                <p className="text-sm text-gray-600 mb-2">Fonctionne avec :</p>
                <ul className="space-y-2 ml-4">
                  {intro.syncParts.map((part, index) => (
                    <li key={index} className="flex items-start gap-2 text-gray-700">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{part}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

interface RiskSectionProps {
  risk: PurchaseGuideData['risk'];
  gammeName?: string;
  className?: string;
}

/**
 * Section 2: Pourquoi c'est critique
 * H2: Pourquoi ne jamais rouler avec {gamme} usée ?
 */
export function RiskSection({ risk, gammeName, className }: RiskSectionProps) {
  if (!risk.title && !risk.explanation) return null;

  const pieceType = gammeName?.toLowerCase() || 'cette pièce';

  return (
    <section
      className={cn('py-8', className)}
      aria-labelledby="risk-section-title"
    >
      <div className="container mx-auto px-4">
        <h2
          id="risk-section-title"
          className="text-2xl font-bold text-gray-900 mb-6"
        >
          Pourquoi ne jamais rouler avec {pieceType} usée ?
        </h2>
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 text-white text-xl">
                ⚠️
              </span>
              <CardTitle className="text-xl text-red-900">
                {risk.title || 'Pourquoi ne jamais attendre ?'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {risk.explanation && (
              <p className="text-gray-700 text-lg leading-relaxed">
                {risk.explanation}
              </p>
            )}

            {risk.consequences && risk.consequences.length > 0 && (
              <div className="p-4 bg-red-100 rounded-lg border border-red-200">
                <p className="text-red-900 font-semibold mb-3 flex items-center gap-2">
                  <span>💥</span> En cas de défaillance :
                </p>
                <ul className="space-y-2 ml-4">
                  {risk.consequences.map((consequence, index) => (
                    <li key={index} className="flex items-start gap-2 text-red-800">
                      <span className="text-red-600 mt-1">•</span>
                      <span>{consequence}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {risk.costRange && (
              <p className="text-gray-700">
                <span className="font-medium">Coût des réparations :</span>{' '}
                <span className="text-red-700 font-bold">{risk.costRange}</span>
              </p>
            )}

            {risk.conclusion && (
              <div className="flex items-start gap-2 p-3 bg-green-100 rounded-lg border border-green-200 mt-4">
                <span className="text-green-600 text-xl">👉</span>
                <p className="text-green-900 font-medium">{risk.conclusion}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

interface TimingSectionProps {
  timing: PurchaseGuideData['timing'];
  gammeName?: string;
  className?: string;
}

/**
 * Section 3: Quand changer
 * H2: Quand faut-il changer {gamme} ?
 */
export function TimingSection({ timing, gammeName, className }: TimingSectionProps) {
  if (!timing.title && !timing.years && !timing.km) return null;

  const pieceType = gammeName?.toLowerCase() || 'cette pièce';

  return (
    <section
      className={cn('py-8', className)}
      aria-labelledby="timing-section-title"
    >
      <div className="container mx-auto px-4">
        <h2
          id="timing-section-title"
          className="text-2xl font-bold text-gray-900 mb-6"
        >
          Quand faut-il changer {pieceType} ?
        </h2>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-600 text-white text-xl">
                ⏱️
              </span>
              <CardTitle className="text-xl text-amber-900">
                {timing.title || 'Quand faut-il la changer ?'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700 text-lg">En général :</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {timing.years && (
                <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-amber-200">
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className="text-sm text-gray-600">Intervalle temps</p>
                    <p className="text-lg font-bold text-amber-900">
                      tous les {timing.years}
                    </p>
                  </div>
                </div>
              )}

              {timing.km && (
                <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-amber-200">
                  <span className="text-2xl">🚗</span>
                  <div>
                    <p className="text-sm text-gray-600">Intervalle kilométrage</p>
                    <p className="text-lg font-bold text-amber-900">
                      entre {timing.km}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {timing.note && (
              <div className="flex items-start gap-2 p-3 bg-amber-100 rounded-lg border border-amber-200 mt-4">
                <span className="text-amber-600 text-xl">📌</span>
                <p className="text-amber-900">{timing.note}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

interface ArgumentsSectionProps {
  arguments: PurchaseGuideData['arguments'];
  gammeName?: string;
  className?: string;
}

/**
 * Section 4: Pourquoi acheter chez nous
 * H2: Pourquoi acheter votre {gamme} sur Automecanik ?
 */
export function ArgumentsSection({
  arguments: args,
  gammeName,
  className,
}: ArgumentsSectionProps) {
  if (!args || args.length === 0) return null;

  const pieceType = gammeName?.toLowerCase() || 'pièce';

  const iconMap: Record<string, string> = {
    'check-circle': '✅',
    'shield-check': '🛡️',
    'currency-euro': '💰',
    cube: '📦',
  };

  return (
    <section
      className={cn('py-8', className)}
      aria-labelledby="arguments-section-title"
    >
      <div className="container mx-auto px-4">
        <h2
          id="arguments-section-title"
          className="text-2xl font-bold text-gray-900 mb-6"
        >
          Pourquoi acheter votre {pieceType} sur Automecanik ?
        </h2>
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-green-600 text-white text-xl">
                🛒
              </span>
              <CardTitle className="text-xl text-green-900">
                Pourquoi acheter votre pièce en ligne ?
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {args.map((arg, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 bg-white rounded-lg border border-green-200"
                >
                  <span className="text-2xl flex-shrink-0">
                    {iconMap[arg.icon || ''] || '✅'}
                  </span>
                  <div>
                    <h4 className="font-bold text-green-900 mb-1">{arg.title}</h4>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {arg.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export default PurchaseGuideSection;
