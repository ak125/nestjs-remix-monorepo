import { useNavigate } from "@remix-run/react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Brain,
  Car,
  CheckCircle,
  Clock,
  Gauge,
  Play,
  ScanLine,
  Search,
  Shield,
  Thermometer,
  User,
  Volume2,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Progress } from "~/components/ui/progress";
import VehicleSelector from "~/components/vehicle/VehicleSelector";

const TAB_ITEMS = [
  { label: "Par véhicule", icon: Gauge },
  { label: "Type Mine", icon: BookOpen },
  { label: "Référence", icon: Search },
];

const SYMPTOMS = [
  {
    ico: Activity,
    label: "Vibrations",
    desc: "Volant, pédale",
    bg: "bg-red-500/20",
    text: "text-red-400",
    bgActive: "bg-red-600",
  },
  {
    ico: Volume2,
    label: "Bruits",
    desc: "Claquement, sifflement",
    bg: "bg-amber-500/20",
    text: "text-amber-400",
    bgActive: "bg-amber-600",
  },
  {
    ico: AlertTriangle,
    label: "Voyants",
    desc: "Moteur, huile, ABS",
    bg: "bg-yellow-500/20",
    text: "text-yellow-400",
    bgActive: "bg-yellow-600",
  },
  {
    ico: Shield,
    label: "Freinage",
    desc: "Pédale molle, bruit",
    bg: "bg-blue-500/20",
    text: "text-blue-400",
    bgActive: "bg-blue-600",
  },
  {
    ico: Thermometer,
    label: "Surchauffe",
    desc: "Température, fumée",
    bg: "bg-orange-500/20",
    text: "text-orange-400",
    bgActive: "bg-orange-600",
  },
  {
    ico: Zap,
    label: "Démarrage",
    desc: "Calage, à-coups",
    bg: "bg-purple-500/20",
    text: "text-purple-400",
    bgActive: "bg-purple-600",
  },
];

export default function HeroSectionV9() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [mineCode, setMineCode] = useState("");
  const [refQuery, setRefQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (i: number) =>
    setSelected((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
    );

  const hasSymptoms = selected.length > 0;
  const progressValue = hasSymptoms ? 25 : 0;

  return (
    <>
      {/* Skip link */}
      <a
        href="#hero-v9"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:bg-blue-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg"
      >
        Aller au contenu principal
      </a>

      <section
        id="hero-v9"
        className="bg-gradient-to-b from-v9-navy to-v9-navy-light"
      >
        <div className="px-5 pt-6 pb-8 lg:pt-10 lg:pb-14 max-w-[1280px] mx-auto lg:px-8">
          {/* ═══ TITRE ═══ */}
          <h1 className="text-[28px] lg:text-[42px] font-extrabold leading-[1.1] tracking-tight font-v9-heading text-white lg:text-center">
            Votre panne, <span className="text-cta-light">nos pièces.</span>
          </h1>
          <p className="text-[14px] text-white/45 mt-3 lg:text-center">
            500 000+ références · 50+ marques · Expédié sous 24h
          </p>

          {/* ═══ 2-COL LAYOUT: OUTILS (gauche) + VIDEO (droite) ═══ */}
          <div className="mt-5 lg:mt-8 lg:grid lg:grid-cols-2 lg:gap-6">
            {/* ═══ COL GAUCHE — SÉLECTEUR + DIAGNOSTIC ═══ */}
            <div className="flex flex-col gap-4">
              {/* Sélecteur véhicule */}
              <div className="rounded-2xl border border-white/20 overflow-hidden bg-white shadow-xl shadow-white/10">
                {/* Header */}
                <div className="px-5 pt-5 pb-2">
                  <h2 className="text-[16px] font-bold text-slate-800 font-v9-heading flex items-center gap-2">
                    <Car size={18} className="text-cta" />
                    Trouvez vos pièces
                  </h2>
                  <p className="text-[12px] text-slate-400 mt-1 ml-[26px]">
                    Sélectionnez votre véhicule
                  </p>
                </div>
                {/* Tabs */}
                <div
                  className="flex bg-v9-navy lg:bg-transparent"
                  role="tablist"
                  aria-label="Mode de recherche"
                >
                  {TAB_ITEMS.map((t, i) => {
                    const Icon = t.icon;
                    const isActive = activeTab === i;
                    return (
                      <button
                        key={t.label}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`tabpanel-${i}`}
                        id={`tab-${i}`}
                        onClick={() => setActiveTab(i)}
                        className={`flex-1 py-3.5 text-center text-[11.5px] font-semibold flex items-center justify-center gap-1.5 relative transition-all ${
                          isActive
                            ? "text-white lg:text-slate-900 lg:bg-slate-50"
                            : "text-white/40 lg:text-slate-400 lg:hover:text-slate-600"
                        }`}
                      >
                        <Icon size={12} />
                        {t.label}
                        {isActive && (
                          <span className="absolute bottom-0 left-[15%] w-[70%] h-[2.5px] bg-cta rounded" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Tab content */}
                <div
                  className="p-4 pt-3.5"
                  role="tabpanel"
                  id={`tabpanel-${activeTab}`}
                  aria-labelledby={`tab-${activeTab}`}
                >
                  {activeTab === 0 && (
                    <>
                      <div className="lg:hidden">
                        <VehicleSelector
                          mode="mobile-premium"
                          context="homepage"
                        />
                      </div>
                      <div className="hidden lg:block">
                        <VehicleSelector mode="compact" context="homepage" />
                      </div>
                    </>
                  )}

                  {activeTab === 1 && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (mineCode.length >= 5) {
                          navigate(
                            `/search/mine?code=${mineCode.toUpperCase()}`,
                          );
                        }
                      }}
                    >
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        <Car size={12} /> Numéro de Type Mine ou CNIT
                      </label>
                      <Input
                        value={mineCode}
                        onChange={(e) =>
                          setMineCode(e.target.value.toUpperCase())
                        }
                        placeholder="Ex : M10RENVP0A5G35"
                        maxLength={20}
                        className="bg-slate-50 border-slate-200 rounded-xl text-slate-900 text-[13px] font-bold tracking-[2px] font-mono uppercase placeholder-slate-400 focus-visible:border-cta focus-visible:ring-cta/10 mb-2.5"
                      />
                      <Button
                        type="submit"
                        disabled={mineCode.length < 5}
                        className="w-full py-3.5 h-auto bg-cta rounded-xl text-white text-[14px] font-bold shadow-lg shadow-cta/20 hover:bg-cta-hover hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                      >
                        <Search size={15} className="mr-2" /> Rechercher
                      </Button>
                      <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                        Repère D.2.1 sur votre carte grise
                      </p>
                    </form>
                  )}

                  {activeTab === 2 && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (refQuery.trim()) {
                          navigate(
                            `/recherche?q=${encodeURIComponent(refQuery.trim())}`,
                          );
                        }
                      }}
                    >
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        <Search size={12} /> Référence ou nom de pièce
                      </label>
                      <Input
                        value={refQuery}
                        onChange={(e) => setRefQuery(e.target.value)}
                        placeholder="Référence OE, marque ou pièce…"
                        className="bg-slate-50 border-slate-200 rounded-xl text-slate-900 text-[13px] placeholder-slate-400 focus-visible:border-cta focus-visible:ring-cta/10 mb-2.5"
                      />
                      <Button
                        type="submit"
                        disabled={!refQuery.trim()}
                        className="w-full py-3.5 h-auto bg-cta rounded-xl text-white text-[14px] font-bold shadow-lg shadow-cta/20 hover:bg-cta-hover hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                      >
                        <Search size={15} className="mr-2" /> Rechercher
                      </Button>
                    </form>
                  )}
                </div>
              </div>

              {/* Séparateur "OU" (mobile only) */}
              <div className="flex items-center gap-4 lg:hidden">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                <span className="text-[11px] font-semibold text-white/30 tracking-widest">
                  OU
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
              </div>

              {/* Diagnostic auto */}
              <div className="bg-white/[0.03] border border-cta/15 rounded-2xl overflow-hidden">
                {/* Progress bar */}
                <Progress
                  value={progressValue}
                  className="h-1 rounded-none [&>div]:bg-gradient-to-r [&>div]:from-cta-light [&>div]:to-cta"
                />

                {/* Header */}
                <div className="px-5 pt-4 pb-2 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-cta to-cta-hover flex items-center justify-center shadow-lg shadow-cta/25 flex-shrink-0">
                      <ScanLine
                        size={20}
                        className="text-white animate-v9-float"
                      />
                    </div>
                    <div>
                      <h3 className="text-[17px] lg:text-[20px] font-extrabold text-white tracking-tight font-v9-heading">
                        Diagnostic Auto
                      </h3>
                      <p className="text-[13px] text-white/40 leading-relaxed mt-1 font-v9-body">
                        Décrivez vos symptômes. Notre IA identifie les causes et
                        pièces concernées.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold text-emerald-300 bg-emerald-500/[0.12] border-emerald-500/20 px-2 py-1"
                    >
                      <CheckCircle size={9} className="mr-1" /> GRATUIT
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold text-cta-light bg-cta/[0.12] border-cta/20 px-2 py-1"
                    >
                      <Clock size={9} className="mr-1" /> 2 min
                    </Badge>
                  </div>
                </div>

                {/* Symptoms grid */}
                <div className="px-4 pb-4 pt-2">
                  <div className="grid grid-cols-3 gap-2">
                    {SYMPTOMS.map((s, i) => {
                      const isActive = selected.includes(i);
                      const Icon = s.ico;
                      return (
                        <button
                          key={s.label}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => toggle(i)}
                          className={`py-4 px-1.5 rounded-xl text-center transition-all duration-200 border relative ${
                            isActive
                              ? "border-cta/60 bg-cta/[0.08] shadow-md shadow-cta/10 -translate-y-1 ring-2 ring-cta/20"
                              : "border-white/[0.08] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05] hover:-translate-y-0.5"
                          }`}
                        >
                          {isActive && (
                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-cta rounded-full flex items-center justify-center shadow-sm animate-v9-fade-in">
                              <CheckCircle size={11} className="text-white" />
                            </div>
                          )}
                          <div
                            className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl mx-auto mb-2 flex items-center justify-center transition-all ${
                              isActive ? "bg-cta shadow-md shadow-cta/30" : s.bg
                            }`}
                          >
                            <Icon
                              size={20}
                              className={isActive ? "text-white" : s.text}
                            />
                          </div>
                          <div
                            className={`text-[11.5px] font-bold leading-tight font-v9-body ${isActive ? "text-cta-light" : "text-white/65"}`}
                          >
                            {s.label}
                          </div>
                          <div className="text-[9.5px] text-white/40 mt-0.5 font-normal leading-tight">
                            {s.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preview + CTA */}
                <div className="px-4 pb-4">
                  {hasSymptoms && (
                    <div className="mb-3 p-3 bg-blue-500/[0.06] border border-blue-500/[0.12] rounded-xl flex items-start gap-2.5 animate-v9-fade-in">
                      <Brain
                        size={16}
                        className="text-blue-400 mt-0.5 flex-shrink-0"
                      />
                      <div>
                        <div className="text-[12px] font-semibold text-blue-300/80 font-v9-body">
                          {selected.length === 1
                            ? "3 à 5 causes probables — pièces à vérifier identifiées"
                            : `Analyse croisée de ${selected.length} symptômes — diagnostic affiné`}
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    className={`w-full py-4 h-auto rounded-xl text-[15px] lg:text-[14px] font-bold relative overflow-hidden ${
                      hasSymptoms
                        ? "bg-gradient-to-r from-cta to-cta-hover text-white shadow-lg shadow-cta/25 hover:shadow-xl hover:-translate-y-0.5"
                        : "bg-white/[0.04] text-white/25 border border-white/[0.06]"
                    }`}
                    disabled={!hasSymptoms}
                    onClick={() => {
                      if (hasSymptoms) navigate("/diagnostic-auto");
                    }}
                  >
                    {hasSymptoms && (
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/[0.12] to-white/0 animate-v9-shimmer" />
                    )}
                    <ScanLine size={18} className="mr-2" />
                    {hasSymptoms
                      ? `Lancer le diagnostic${selected.length > 1 ? ` (${selected.length})` : ""}`
                      : "Sélectionnez un symptôme"}
                    {hasSymptoms && <ArrowRight size={15} className="ml-2" />}
                  </Button>

                  <div className="flex items-center justify-center gap-2 mt-3">
                    <div className="flex -space-x-1.5">
                      {["bg-blue-400", "bg-emerald-400", "bg-amber-400"].map(
                        (c) => (
                          <div
                            key={c}
                            className={`w-5 h-5 rounded-full ${c} border-2 border-v9-navy-light flex items-center justify-center`}
                          >
                            <User size={9} className="text-white" />
                          </div>
                        ),
                      )}
                    </div>
                    <span className="text-[11px] text-white/40">
                      2 847 diagnostics ce mois
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {/* end col gauche */}

            {/* ═══ COL DROITE — VIDEO PLACEHOLDER (desktop) ═══ */}
            <div className="hidden lg:flex rounded-2xl overflow-hidden border border-white/[0.1] bg-white/[0.03] items-center justify-center group cursor-pointer hover:bg-white/[0.06] transition-all">
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-white/20 group-hover:scale-110 transition-all shadow-lg">
                  <Play size={28} className="text-white/60 ml-1" />
                </div>
                <p className="text-[13px] text-white/50 font-v9-body font-semibold">
                  Découvrir AutoMecanik
                </p>
                <p className="text-[11px] text-white/30 mt-1">
                  Vidéo de présentation
                </p>
              </div>
            </div>

            {/* ═══ VIDEO MOBILE (sous diagnostic) ═══ */}
            <div className="lg:hidden mt-6 rounded-2xl overflow-hidden border border-white/[0.1] bg-white/[0.03] flex items-center justify-center aspect-video group cursor-pointer hover:bg-white/[0.06] transition-all">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-white/20 group-hover:scale-110 transition-all shadow-lg">
                  <Play size={24} className="text-white/60 ml-1" />
                </div>
                <p className="text-[12px] text-white/50 font-v9-body font-semibold">
                  Découvrir AutoMecanik
                </p>
              </div>
            </div>
          </div>
          {/* end 2-col grid */}
        </div>
      </section>
    </>
  );
}
