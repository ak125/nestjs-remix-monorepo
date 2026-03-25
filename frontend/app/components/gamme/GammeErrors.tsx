import { AlertTriangle, X } from "lucide-react";
import { Reveal, Section } from "~/components/layout";

interface GammeErrorsProps {
  errors?: string[];
  gammeName?: string;
  h2Override?: string | null;
}

const DEFAULT_ERRORS = [
  "Confondre 90ch vs 110ch",
  "Ignorer case D.2 carte grise",
  "Modèle sans vérifier type",
  "Sans comparer réf. OE",
];

export default function GammeErrors({
  errors,
  gammeName: _gammeName,
  h2Override,
}: GammeErrorsProps) {
  const items = errors || DEFAULT_ERRORS;

  return (
    <Section variant="slate">
      <div className="flex items-center gap-2.5 mb-5 sm:mb-6">
        <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg bg-red-50 flex items-center justify-center">
          <AlertTriangle size={17} className="text-red-500" />
        </div>
        {(!h2Override || h2Override.trim()) && (
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 tracking-tight font-heading">
            {h2Override || "Erreurs à éviter"}
          </h2>
        )}
      </div>

      <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3">
        {items.map((e, i) => (
          <Reveal key={i} delay={i * 60}>
            <div className="flex items-center gap-3 bg-white border border-red-100 rounded-[18px] px-4 py-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:border-red-200 hover:shadow-lg transition-all group">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0 group-hover:bg-red-500 transition-colors">
                <X
                  size={14}
                  className="text-red-500 group-hover:text-white transition-colors"
                />
              </div>
              <span className="text-[13px] text-slate-700 font-normal leading-snug font-body">
                {e}
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
