import { useNavigate } from "@remix-run/react";
import { ScanLine } from "lucide-react";

import { Button } from "~/components/ui/button";

export default function DiagnosticBanner() {
  const navigate = useNavigate();

  return (
    <section className="bg-gradient-to-r from-v9-navy to-v9-navy-light">
      <div className="mx-auto max-w-[1280px] px-5 py-8 lg:px-8 lg:py-10">
        <div className="flex flex-col items-center gap-5 lg:flex-row lg:gap-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cta/15">
            <ScanLine size={24} className="text-cta-light" />
          </div>

          <div className="flex-1 text-center lg:text-left">
            <h2 className="text-[20px] font-bold tracking-[-0.03em] text-white font-v9-heading">
              Vous ne savez pas quelle pièce changer ?
            </h2>
            <p className="mt-1.5 text-[14px] text-white/60 font-v9-body">
              Décrivez vos symptômes pour identifier les causes et pièces
              concernées. Gratuit, 2 min.
            </p>
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
