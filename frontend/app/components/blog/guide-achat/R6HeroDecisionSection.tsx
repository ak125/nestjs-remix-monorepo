/**
 * R6HeroDecisionSection — V2 hero with promise, bullets, and CTA.
 * Replaces the generic risk/timing hero from V1.
 */

import { Link } from "@remix-run/react";
import { CheckCircle2 } from "lucide-react";
import { type R6HeroDecision } from "~/types/r6-guide.types";

interface Props {
  heroDecision: R6HeroDecision;
  gammeName: string;
  pgAlias: string;
  pgId: number;
}

export function R6HeroDecisionSection({
  heroDecision,
  gammeName,
  pgAlias,
  pgId,
}: Props) {
  if (!heroDecision?.promise) return null;

  return (
    <section id="decision-achat" className="mb-8">
      <div className="rounded-xl border-2 border-blue-200 overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <p className="text-sm font-medium text-blue-100 leading-relaxed">
            {heroDecision.promise}
          </p>
        </div>
        <div className="bg-blue-50/50 px-6 py-5">
          {heroDecision.bullets.length > 0 && (
            <ul className="space-y-2 mb-4">
              {heroDecision.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{bullet}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to={heroDecision.cta_href || `/pieces/${pgAlias}-${pgId}.html`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {heroDecision.cta_label || `Voir les ${gammeName}`}
          </Link>
        </div>
      </div>
    </section>
  );
}
