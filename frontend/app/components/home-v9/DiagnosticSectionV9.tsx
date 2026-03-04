import { Link } from "@remix-run/react";
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle,
  Clock,
  Shield,
  Stethoscope,
  Thermometer,
  User,
  Volume2,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";

const SYMPTOMS = [
  {
    ico: Activity,
    label: "Vibrations",
    desc: "Volant, pédale",
    bg: "bg-red-50",
    text: "text-red-600",
  },
  {
    ico: Volume2,
    label: "Bruits",
    desc: "Claquement, sifflement",
    bg: "bg-amber-50",
    text: "text-amber-600",
  },
  {
    ico: AlertTriangle,
    label: "Voyants",
    desc: "Moteur, huile, ABS",
    bg: "bg-yellow-50",
    text: "text-yellow-600",
  },
  {
    ico: Shield,
    label: "Freinage",
    desc: "Pédale molle, bruit",
    bg: "bg-blue-50",
    text: "text-blue-600",
  },
  {
    ico: Thermometer,
    label: "Surchauffe",
    desc: "Température, fumée",
    bg: "bg-orange-50",
    text: "text-orange-600",
  },
  {
    ico: Zap,
    label: "Démarrage",
    desc: "Calage, à-coups",
    bg: "bg-purple-50",
    text: "text-purple-600",
  },
];

export default function DiagnosticSectionV9({
  className,
}: {
  className?: string;
}) {
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (i: number) =>
    setSelected((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
    );

  const progressValue = selected.length > 0 ? 25 : 0;

  return (
    <section className={`px-5 py-6 lg:py-8 bg-slate-50 ${className || ""}`}>
      <div className="max-w-[1280px] mx-auto lg:px-8">
        <div className="bg-white rounded-2xl shadow-xl shadow-orange-500/[0.07] border border-orange-100 overflow-hidden">
          {/* Progress bar */}
          <Progress
            value={progressValue}
            className="h-1 rounded-none [&>div]:bg-gradient-to-r [&>div]:from-orange-400 [&>div]:to-orange-500"
          />

          {/* Header */}
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md shadow-orange-200 flex-shrink-0">
                <Stethoscope
                  size={17}
                  className="text-white animate-v9-float"
                />
              </div>
              <h2 className="text-[17px] lg:text-[20px] font-extrabold text-slate-900 tracking-tight font-v9-heading">
                Diagnostic Auto
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border-emerald-200 px-2 py-1"
              >
                <CheckCircle size={9} className="mr-1" /> GRATUIT
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] font-bold text-orange-600 bg-orange-50 border-orange-200 px-2 py-1"
              >
                <Clock size={9} className="mr-1" /> 2 min
              </Badge>
            </div>
          </div>

          <p className="px-5 pb-3 text-[13px] text-slate-500 leading-relaxed font-v9-body">
            Sélectionnez un ou plusieurs symptômes. Nos experts identifient les
            causes probables et les pièces à remplacer.
          </p>

          {/* Symptoms grid */}
          <div className="px-4 pb-4">
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
              {SYMPTOMS.map((s, i) => {
                const isActive = selected.includes(i);
                const Icon = s.ico;
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => toggle(i)}
                    className={`py-3 px-1.5 rounded-xl text-center transition-all duration-200 border relative ${
                      isActive
                        ? "border-orange-400 bg-orange-50 shadow-md shadow-orange-100 -translate-y-1 ring-2 ring-orange-200"
                        : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white hover:shadow-sm hover:-translate-y-0.5"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center shadow-sm animate-v9-fade-in">
                        <CheckCircle size={11} className="text-white" />
                      </div>
                    )}
                    <div
                      className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl mx-auto mb-2 flex items-center justify-center transition-all ${
                        isActive
                          ? "bg-orange-500 shadow-md shadow-orange-200"
                          : s.bg
                      }`}
                    >
                      <Icon
                        size={20}
                        className={isActive ? "text-white" : s.text}
                      />
                    </div>
                    <div
                      className={`text-[11.5px] font-bold leading-tight font-v9-body ${isActive ? "text-orange-700" : "text-slate-700"}`}
                    >
                      {s.label}
                    </div>
                    <div className="text-[9.5px] text-slate-400 mt-0.5 font-normal leading-tight">
                      {s.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview + CTA */}
          <div className="px-4 pb-4">
            {selected.length > 0 && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2.5 animate-v9-fade-in">
                <Brain
                  size={16}
                  className="text-blue-500 mt-0.5 flex-shrink-0"
                />
                <div>
                  <div className="text-[12px] font-semibold text-blue-800 font-v9-body">
                    {selected.length === 1
                      ? "3 à 5 causes probables"
                      : `${selected.length} symptômes → analyse croisée`}
                  </div>
                  <div className="text-[11px] text-blue-600/70 mt-0.5">
                    {selected.length === 1
                      ? "Nous identifierons les pièces à vérifier en priorité."
                      : "L'analyse croisée affine le diagnostic."}
                  </div>
                </div>
              </div>
            )}

            <Link to="/diagnostic-auto">
              <Button
                className={`w-full py-4 h-auto rounded-xl text-[15px] lg:text-[14px] font-bold relative overflow-hidden ${
                  selected.length > 0
                    ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25 hover:shadow-xl hover:-translate-y-0.5"
                    : "bg-slate-100 text-slate-400 pointer-events-none"
                }`}
                disabled={selected.length === 0}
              >
                {selected.length > 0 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/[0.12] to-white/0 animate-v9-shimmer" />
                )}
                <Stethoscope size={18} className="mr-2" />
                {selected.length > 0
                  ? `Lancer le diagnostic${selected.length > 1 ? ` (${selected.length})` : ""}`
                  : "Sélectionnez un symptôme"}
              </Button>
            </Link>

            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="flex -space-x-1.5">
                {["bg-blue-400", "bg-emerald-400", "bg-amber-400"].map((c) => (
                  <div
                    key={c}
                    className={`w-5 h-5 rounded-full ${c} border-2 border-white flex items-center justify-center`}
                  >
                    <User size={9} className="text-white" />
                  </div>
                ))}
              </div>
              <span className="text-[11px] text-slate-400">
                2 847 diagnostics ce mois
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
