/**
 * CONSEILS & DIAGNOSTIC — Dark glassmorphism section
 *
 * Rupture visuelle dans le flow de la homepage (6 sections claires consécutives).
 * Dark blue brand bg + glass cards monochrome + accent orange sur le diagnostic.
 *
 * Mobile-first : strips compacts pour secondaires, feature card vertical puis horizontal.
 */

import { Link } from "@remix-run/react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Shield,
  Wrench,
} from "lucide-react";
import { memo } from "react";

const ConseilsDiagnosticSection = memo(function ConseilsDiagnosticSection() {
  return (
    <section
      id="conseils-diagnostic"
      className="relative py-12 md:py-16 lg:py-20 overflow-hidden bg-gradient-to-br from-[#0d1b3e] via-[#0f2347] to-[#162d5a]"
      aria-labelledby="conseils-diagnostic-title"
    >
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:4rem_4rem]"
        aria-hidden="true"
      />
      {/* Orange glow top-right */}
      <div
        className="absolute -top-20 -right-20 w-80 h-80 bg-primary-500/[0.08] rounded-full blur-3xl"
        aria-hidden="true"
      />
      {/* Blue glow bottom-left */}
      <div
        className="absolute -bottom-20 -left-20 w-60 h-60 bg-secondary-200/10 rounded-full blur-3xl"
        aria-hidden="true"
      />

      <div className="relative container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
          <h2
            id="conseils-diagnostic-title"
            className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3"
          >
            Conseils & <span className="text-primary-400">Diagnostic</span>
          </h2>
          <div className="h-1 w-16 bg-gradient-to-r from-primary-400 to-primary-500 mx-auto rounded mb-4" />
          <p className="text-sm md:text-base text-white/70 max-w-xl mx-auto">
            L&apos;expertise automobile au service de votre véhicule
          </p>
        </div>

        {/* ===== FEATURE CARD: DIAGNOSTIC AUTO ===== */}
        <Link
          to="/diagnostic-auto"
          className="group relative block mb-5 md:mb-6 rounded-2xl border border-white/10 overflow-hidden transition-all duration-300 hover:-translate-y-1"
          aria-label="Lancer un diagnostic auto"
        >
          {/* Glass bg */}
          <div className="absolute inset-0 bg-white/[0.07] backdrop-blur-sm" />
          {/* Orange left accent */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-400 via-primary-500 to-primary-600" />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-primary-500/0 group-hover:bg-primary-500/5 transition-colors duration-300" />

          <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25 group-hover:shadow-primary-500/40 group-hover:scale-105 transition-all duration-300">
                <Activity className="w-7 h-7 md:w-8 md:h-8 text-white" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl md:text-2xl font-bold text-white">
                  Diagnostic auto
                </h3>
                <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-500/20 text-primary-300 border border-primary-500/30">
                  Gratuit
                </span>
              </div>
              <p className="text-sm md:text-base text-white/70 leading-relaxed mb-3 md:mb-0">
                Identifiez votre panne : vibrations, bruits, voyants moteur
                &mdash; causes et solutions par nos experts.
              </p>
            </div>

            {/* CTA */}
            <div className="flex-shrink-0 flex items-center gap-2 text-primary-400 font-semibold text-sm md:text-base">
              <span className="md:hidden">Diagnostiquer</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
            </div>
          </div>
        </Link>

        {/* ===== SECONDARY CARDS ===== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {/* Guides d'achat */}
          <Link
            to="/blog-pieces-auto/guide-achat"
            className="group relative flex items-center gap-4 p-4 md:p-5 rounded-xl border border-white/10 bg-white/[0.05] backdrop-blur-sm hover:bg-white/[0.09] hover:border-white/20 transition-all duration-300"
            aria-label="Lire les guides d'achat"
          >
            <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/15 transition-colors duration-300">
              <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-white/80" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm md:text-base font-semibold text-white mb-0.5">
                Guides d&apos;achat
              </h3>
              <p className="text-xs text-white/50 line-clamp-1">
                Distribution, freinage, filtration&hellip;
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </Link>

          {/* Référence technique */}
          <Link
            to="/reference-auto"
            className="group relative flex items-center gap-4 p-4 md:p-5 rounded-xl border border-white/10 bg-white/[0.05] backdrop-blur-sm hover:bg-white/[0.09] hover:border-white/20 transition-all duration-300"
            aria-label="Consulter le glossaire technique"
          >
            <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/15 transition-colors duration-300">
              <Wrench className="w-5 h-5 md:w-6 md:h-6 text-white/80" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm md:text-base font-semibold text-white mb-0.5">
                Référence technique
              </h3>
              <p className="text-xs text-white/50 line-clamp-1">
                Glossaire, définitions, specs OE
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </Link>

          {/* Conseils entretien */}
          <Link
            to="/blog-pieces-auto/conseils"
            className="group relative flex items-center gap-4 p-4 md:p-5 rounded-xl border border-white/10 bg-white/[0.05] backdrop-blur-sm hover:bg-white/[0.09] hover:border-white/20 transition-all duration-300"
            aria-label="Lire les conseils d'entretien"
          >
            <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/15 transition-colors duration-300">
              <Shield className="w-5 h-5 md:w-6 md:h-6 text-white/80" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm md:text-base font-semibold text-white mb-0.5">
                Conseils entretien
              </h3>
              <p className="text-xs text-white/50 line-clamp-1">
                Calendrier, astuces mécanicien, pièces à surveiller
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </Link>
        </div>
      </div>
    </section>
  );
});

export default ConseilsDiagnosticSection;
