import { Link, useNavigate } from "@remix-run/react";
import { ScanLine } from "lucide-react";

import { Button } from "~/components/ui/button";

const SYMPTOM_TAGS = [
  { label: "Bruit au freinage", param: "bruit-freinage" },
  { label: "Perte de puissance", param: "perte-puissance" },
  { label: "Voyant moteur", param: "voyant-moteur" },
  { label: "Surchauffe", param: "surchauffe" },
  { label: "Vibrations", param: "vibrations" },
];

export default function DiagnosticBanner() {
  const navigate = useNavigate();

  return (
    <section className="bg-gradient-to-r from-navy to-navy-light">
      <div className="mx-auto max-w-[1280px] px-5 py-8 lg:px-8 lg:py-10">
        <div className="flex flex-col items-center gap-5 lg:flex-row lg:gap-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cta/15">
            <ScanLine size={24} className="text-cta-light" />
          </div>

          <div className="flex-1 text-center lg:text-left">
            <h2 className="text-[20px] font-bold tracking-[-0.03em] text-white font-heading">
              Vous ne savez pas quelle pièce changer ?
            </h2>
            <p className="mt-1.5 text-[14px] text-white/60 font-body">
              Décrivez vos symptômes pour identifier les causes et pièces
              concernées. Gratuit, 2 min.
            </p>
            <div className="flex flex-wrap gap-2 mt-3 justify-center lg:justify-start">
              {SYMPTOM_TAGS.map((s) => (
                <Link
                  key={s.param}
                  to={`/diagnostic-auto?symptome=${s.param}`}
                  className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-3 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors min-h-[44px] inline-flex items-center"
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>

          <Button
            onClick={() => navigate("/diagnostic-auto")}
            className="h-12 w-full shrink-0 rounded-2xl bg-cta px-8 text-[15px] font-semibold text-white shadow-[0_12px_24px_rgba(249,115,22,0.28)] hover:bg-cta-hover lg:w-auto"
          >
            <ScanLine size={16} className="mr-2" />
            Lancer le diagnostic
          </Button>
        </div>
      </div>
    </section>
  );
}
