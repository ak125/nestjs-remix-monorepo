import { Link } from "@remix-run/react";
import { ArrowRight, BookOpen } from "lucide-react";
import { Section } from "~/components/layout";

interface GammeGuideCTAProps {
  gammeName: string;
  pgAlias?: string;
}

export default function GammeGuideCTA({
  gammeName,
  pgAlias,
}: GammeGuideCTAProps) {
  if (!pgAlias) return null;

  return (
    <Section variant="white">
      <Link
        to={`/blog-pieces-auto/conseils/${pgAlias}`}
        className="flex items-center gap-3.5 bg-slate-50 border border-slate-200 rounded-[22px] p-4 lg:p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:border-blue-200 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
      >
        <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 group-hover:scale-105 transition-all">
          <BookOpen size={20} className="text-blue-600" />
        </div>
        <div className="flex-1">
          <div className="text-[13px] lg:text-[14px] font-bold text-slate-900 group-hover:text-blue-700 transition-colors font-heading">
            Guide complet : {gammeName}
          </div>
          <div className="text-[11px] lg:text-[12px] text-slate-500 font-normal mt-0.5">
            Critères de choix, budget, marques recommandées
          </div>
        </div>
        <ArrowRight
          size={14}
          className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all flex-shrink-0"
        />
      </Link>
    </Section>
  );
}
