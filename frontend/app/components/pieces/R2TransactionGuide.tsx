import { Link } from "@remix-run/react";
import {
  ShieldCheck,
  AlertTriangle,
  PackageCheck,
  ChevronRight,
} from "lucide-react";
import { memo } from "react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

interface SelectionCriterion {
  key: string;
  label: string;
  guidance: string;
  priority: "required" | "recommended";
}

interface TrustArgument {
  title: string;
  content: string;
}

interface BuyingGuideSlice {
  compatibilityRules?: string[];
  selectionCriteria?: SelectionCriterion[];
  trustArguments?: TrustArgument[];
  pairing?: { required?: string[]; recommended?: string[] };
  antiMistakes?: string[];
  risk?: { costRange?: string };
}

interface R2TransactionGuideProps {
  guide: BuyingGuideSlice;
  gammeName?: string;
  gammeAlias?: string;
}

export const R2TransactionGuide = memo(function R2TransactionGuide({
  guide,
  gammeAlias,
}: R2TransactionGuideProps) {
  if (!guide) return null;

  const requiredCriteria = (guide.selectionCriteria || [])
    .filter((c) => c.priority === "required")
    .slice(0, 5);

  const compatRules = (guide.compatibilityRules || []).slice(0, 5);
  const trustArgs = (guide.trustArguments || []).slice(0, 4);
  const pairingRequired = guide.pairing?.required || [];
  const antiMistakes = (guide.antiMistakes || []).slice(0, 3);

  const hasChecklist = requiredCriteria.length > 0 || compatRules.length > 0;
  const hasTrust = trustArgs.length > 0;
  const hasPairing = pairingRequired.length > 0;
  const hasAntiMistakes = antiMistakes.length > 0;

  if (!hasChecklist && !hasTrust && !hasPairing && !hasAntiMistakes) {
    return null;
  }

  return (
    <div className="space-y-6" data-page-role="R2">
      {/* Section 1: Checklist avant commande */}
      {hasChecklist && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold tracking-tight text-blue-900">
                Points de compatibilite a verifier avant commande
              </h3>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {requiredCriteria.map((c) => (
                <li
                  key={c.key}
                  className="flex items-start gap-2 text-sm text-gray-700"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>
                    <span className="font-medium text-gray-900">{c.label}</span>{" "}
                    — {c.guidance}
                  </span>
                </li>
              ))}
              {compatRules.map((rule, i) => (
                <li
                  key={`rule-${i}`}
                  className="flex items-start gap-2 text-sm text-gray-700"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
            {gammeAlias && (
              <Link
                to={`/blog-pieces-auto/conseils/${gammeAlias}`}
                className="inline-flex items-center gap-1 mt-3 text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                En savoir plus sur les criteres de compatibilite
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 2: Commander ensemble */}
      {hasPairing && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-semibold tracking-tight text-amber-900">
                A commander ensemble
              </h3>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {pairingRequired.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-700"
                >
                  <PackageCheck className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Section 3: Anti-erreurs commande */}
      {hasAntiMistakes && (
        <Card className="border-rose-200 bg-rose-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <h3 className="text-lg font-semibold tracking-tight text-rose-900">
                Points de vigilance avant commande
              </h3>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {antiMistakes.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-700"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Section 4: Reassurance (trust arguments) */}
      {hasTrust && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {trustArgs.map((arg, i) => (
            <div
              key={i}
              className="rounded-lg border border-green-200 bg-green-50/50 p-3"
            >
              <p className="font-semibold text-green-900 text-sm">
                {arg.title}
              </p>
              <p className="text-xs text-gray-600 mt-1">{arg.content}</p>
            </div>
          ))}
          {guide.risk?.costRange && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              <p className="font-semibold text-blue-900 text-sm">
                Budget moyen
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {guide.risk.costRange} (pieces + main-d'oeuvre)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default R2TransactionGuide;
