import { AlertTriangle, X } from "lucide-react";

interface GammeErrorsProps {
  errors?: string[];
  gammeName?: string;
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
}: GammeErrorsProps) {
  const items = errors || DEFAULT_ERRORS;

  return (
    <section className="py-7 lg:py-10 bg-slate-50">
      <div className="px-5 lg:px-8 max-w-[1280px] mx-auto">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg bg-red-50 flex items-center justify-center">
            <AlertTriangle size={17} className="text-red-500" />
          </div>
          <h3 className="text-[17px] lg:text-[20px] font-bold text-slate-900 tracking-tight font-v9-heading">
            Erreurs à éviter
          </h3>
        </div>

        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3">
          {items.map((e, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-white border border-red-100 rounded-xl px-4 py-3.5 hover:border-red-200 hover:shadow-md hover:shadow-red-500/[0.03] transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0 group-hover:bg-red-500 transition-colors">
                <X
                  size={14}
                  className="text-red-500 group-hover:text-white transition-colors"
                />
              </div>
              <span className="text-[13px] text-slate-700 font-normal leading-snug font-v9-body">
                {e}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
