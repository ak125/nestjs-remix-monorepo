import { Link } from "@remix-run/react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  Info,
  LinkIcon,
  Shield,
  Wrench,
} from "lucide-react";
import { memo } from "react";
import { Card, CardContent } from "~/components/ui/card";
import {
  buildR1MicroBlock,
  type R1Card,
  type R1Proofs,
} from "~/utils/r1-reusable-content";

interface R1ReusableContentProps {
  gammeName: string;
  familleName: string;
  alias: string;
  reference?: { slug: string; title: string; definition: string } | null;
  proofs?: R1Proofs;
  microSeoBlock?: string | null;
  symptoms?: string[] | null;
  syncParts?: string[] | null;
}

const CARD_STYLES: Record<
  R1Card["id"],
  { bg: string; text: string; icon: React.ReactNode }
> = {
  guide: {
    bg: "bg-amber-50 border-amber-200 hover:border-amber-300",
    text: "text-amber-900",
    icon: <BookOpen className="w-5 h-5 text-amber-600" />,
  },
  conseils: {
    bg: "bg-green-50 border-green-200 hover:border-green-300",
    text: "text-green-900",
    icon: <Wrench className="w-5 h-5 text-green-600" />,
  },
  reference: {
    bg: "bg-indigo-50 border-indigo-200 hover:border-indigo-300",
    text: "text-indigo-900",
    icon: <FileText className="w-5 h-5 text-indigo-600" />,
  },
};

/** Max symptoms shown to keep the block scannable */
const MAX_SYMPTOMS = 4;

export const R1ReusableContent = memo(function R1ReusableContent({
  gammeName,
  familleName,
  alias,
  reference,
  proofs,
  microSeoBlock,
  symptoms,
  syncParts,
}: R1ReusableContentProps) {
  const block = buildR1MicroBlock({ gammeName, familleName, alias, proofs });

  // Si reference R4 dispo, override le href de la carte reference
  const cards = block.cards.map((card) =>
    card.id === "reference" && reference?.slug
      ? { ...card, href: `/reference-auto/${reference.slug}` }
      : card,
  );

  const displaySymptoms = symptoms?.slice(0, MAX_SYMPTOMS) ?? [];
  const displaySyncParts = syncParts?.filter(Boolean) ?? [];

  return (
    <section aria-labelledby="r1-guide-title" className="space-y-6">
      {/* Micro-bloc textuel — rendu unifié (structure toujours visible) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6">
        <h2
          id="r1-guide-title"
          className="text-lg sm:text-xl font-bold text-gray-900 mb-3"
        >
          {block.title}
        </h2>

        {/* Intro : LLM enrichi ou fallback template */}
        <p className="text-sm text-gray-700 leading-relaxed mb-4">
          {microSeoBlock || block.intro}
        </p>

        {/* Bullets — toujours affichés */}
        <ul className="space-y-2 mb-4">
          {block.bullets.map((bullet, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-gray-700"
            >
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        {/* Pièces liées (syncParts) */}
        {displaySyncParts.length > 0 && (
          <div className="flex items-start gap-2 mb-3 text-xs text-gray-600">
            <LinkIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
            <p>
              <span className="font-medium text-gray-700">
                Change souvent avec :
              </span>{" "}
              {displaySyncParts.join(", ")}.
            </p>
          </div>
        )}

        {/* Carte grise tip — toujours affiché */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 mb-3">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 leading-relaxed">
            <strong>Astuce carte grise :</strong> {block.carteGriseTip}
          </p>
        </div>

        {/* Signes d'usure à surveiller (symptoms) */}
        {displaySymptoms.length > 0 && (
          <div className="p-3 rounded-lg bg-orange-50 border border-orange-100 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
              <p className="text-xs font-semibold text-orange-900">
                Signes d'usure a surveiller
              </p>
            </div>
            <ul className="space-y-1 ml-6">
              {displaySymptoms.map((symptom, i) => (
                <li key={i} className="text-xs text-orange-800 list-disc">
                  {symptom}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Alerte sécurité — toujours affiché */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
          <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Important :</strong> {block.safetyAlert}
          </p>
        </div>
      </div>

      {/* 3 cartes navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((card) => {
          const style = CARD_STYLES[card.id];
          return (
            <Link key={card.id} to={card.href} prefetch="intent">
              <Card
                className={`${style.bg} transition-all hover:shadow-md h-full`}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">{style.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`${style.text} font-semibold text-sm mb-1`}>
                      {card.label}
                    </h3>
                    <p className="text-xs text-gray-600 leading-snug">
                      {card.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
});
