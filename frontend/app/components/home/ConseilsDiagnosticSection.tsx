import { Link } from "@remix-run/react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Shield,
  Wrench,
} from "lucide-react";
import { Reveal, Section } from "~/components/layout";
import { Badge } from "~/components/ui/badge";

export default function ConseilsDiagnosticSection() {
  return (
    <Section variant="dark" spacing="md" decorations id="conseils-diagnostic">
      <Reveal>
        <div className="text-center mb-8 md:mb-12">
          <h2
            id="conseils-diagnostic-title"
            className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 tracking-tight text-balance"
          >
            Conseils & <span className="text-cta-light">Diagnostic</span>
          </h2>
          <div className="h-1 w-16 bg-gradient-to-r from-cta-light to-cta mx-auto rounded mb-4" />
          <p className="text-sm md:text-base text-white/70 max-w-xl mx-auto">
            L&apos;expertise automobile au service de votre v&eacute;hicule
          </p>
        </div>
      </Reveal>

      <Reveal>
        <Link
          to="/diagnostic-auto"
          className="group relative block mb-5 md:mb-6 rounded-2xl border border-white/10 overflow-hidden transition-all duration-300 hover:-translate-y-1"
          aria-label="Lancer un diagnostic auto"
        >
          <div className="absolute inset-0 bg-white/[0.07] backdrop-blur-sm" />
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cta-light via-cta to-cta-dark" />
          <div className="absolute inset-0 bg-cta/0 group-hover:bg-cta/5 transition-colors duration-300" />

          <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
            <div className="flex-shrink-0">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-gradient-to-br from-cta to-cta-dark flex items-center justify-center shadow-lg shadow-cta/25 group-hover:shadow-cta/40 group-hover:scale-105 transition-all duration-300">
                <Activity className="w-7 h-7 md:w-8 md:h-8 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl md:text-2xl font-bold text-white">
                  Diagnostic auto
                </h3>
                <Badge className="hidden md:inline-flex bg-cta/20 text-cta-light border-cta/30 hover:bg-cta/20">
                  Gratuit
                </Badge>
              </div>
              <p className="text-sm md:text-base text-white/70 leading-relaxed mb-3 md:mb-0">
                Identifiez votre panne : vibrations, bruits, voyants moteur
                &mdash; causes et solutions par nos experts.
              </p>
              <div className="flex flex-wrap gap-2 md:mt-3">
                {["Vibrations", "Bruits moteur", "Voyants", "Freinage"].map(
                  (tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="bg-white/[0.06] text-white/60 border-white/10 hover:bg-white/[0.06] font-normal"
                    >
                      {tag}
                    </Badge>
                  ),
                )}
              </div>
            </div>
            <div className="flex-shrink-0 flex items-center gap-2 text-cta-light font-bold text-sm md:text-base">
              <span className="md:hidden">Diagnostiquer</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
            </div>
          </div>
        </Link>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {[
          {
            icon: BookOpen,
            t: "Guides d\u2019achat",
            d: "Distribution, freinage, filtration\u2026",
            link: "/blog-pieces-auto/guide-achat",
          },
          {
            icon: Wrench,
            t: "R\u00e9f\u00e9rence technique",
            d: "Glossaire, d\u00e9finitions, specs OE",
            link: "/reference-auto",
          },
          {
            icon: Shield,
            t: "Conseils entretien",
            d: "Calendrier, astuces m\u00e9canicien, pi\u00e8ces \u00e0 surveiller",
            link: "/blog-pieces-auto/conseils",
          },
        ].map((c, i) => (
          <Reveal key={c.t} delay={i * 80}>
            <Link
              to={c.link}
              className="group relative flex items-center gap-4 p-4 md:p-5 rounded-xl border border-white/10 bg-white/[0.05] backdrop-blur-sm hover:bg-white/[0.09] hover:border-white/20 transition-all duration-300"
            >
              <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/15 transition-colors duration-300">
                <c.icon className="w-5 h-5 md:w-6 md:h-6 text-white/80" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm md:text-base font-semibold text-white mb-0.5">
                  {c.t}
                </h3>
                <p className="text-xs text-white/50 line-clamp-1">{c.d}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </Link>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
