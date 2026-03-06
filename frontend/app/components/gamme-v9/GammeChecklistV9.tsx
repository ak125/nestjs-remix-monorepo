import {
  Car,
  CheckCircle,
  FileSearch,
  Filter,
  Search,
  Settings,
  Shield,
  Zap,
} from "lucide-react";
import { useState } from "react";

interface CheckItem {
  label: string;
  desc: string;
  icon?: typeof Car;
}

interface GammeChecklistV9Props {
  items?: CheckItem[];
  gammeName?: string;
}

/** Assign an icon based on keywords in the label. */
function inferIcon(label: string): typeof Car {
  const l = label.toLowerCase();
  if (l.includes("véhicule") || l.includes("montage")) return Car;
  if (l.includes("moteur") || l.includes("motorisation")) return Filter;
  if (l.includes("référence") || l.includes("oe") || l.includes("réf"))
    return FileSearch;
  if (l.includes("diamètre") || l.includes("épaisseur") || l.includes("cote"))
    return Search;
  if (l.includes("paire") || l.includes("essieu")) return Settings;
  if (l.includes("ampérage") || l.includes("électr") || l.includes("connecti"))
    return Zap;
  if (l.includes("retour") || l.includes("garantie") || l.includes("échange"))
    return Shield;
  return Filter;
}

export default function GammeChecklistV9({
  items,
  gammeName: _gammeName,
}: GammeChecklistV9Props) {
  const checks = items && items.length > 0 ? items : [];
  const [checked, setChecked] = useState<number[]>([]);

  if (checks.length === 0) return null;

  const toggle = (i: number) =>
    setChecked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  const total = checks.length;

  return (
    <section className="py-7 lg:py-10 bg-white">
      <div className="px-5 lg:px-8 max-w-[1280px] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[20px] lg:text-[24px] font-bold text-slate-900 tracking-tight font-v9-heading">
            Checklist
          </h2>
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
              checked.length === total
                ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                : "text-slate-500 bg-slate-100"
            }`}
          >
            {checked.length}/{total}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-100 rounded-full mb-5">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(checked.length / total) * 100}%` }}
          />
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-2.5">
          {checks.map((s, i) => {
            const ok = checked.includes(i);
            const Icon = s.icon || inferIcon(s.label);
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => toggle(i)}
                className={`border rounded-xl p-3.5 text-left transition-all duration-200 relative ${
                  ok
                    ? "bg-emerald-50 border-emerald-300 shadow-md shadow-emerald-100 -translate-y-0.5 ring-2 ring-emerald-200"
                    : "bg-slate-50/50 border-slate-200 hover:border-blue-200 hover:bg-white hover:shadow-sm hover:-translate-y-0.5"
                }`}
              >
                {ok ? (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm animate-v9-fade-in">
                    <CheckCircle size={11} className="text-white" />
                  </div>
                ) : (
                  <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm border-2 border-white text-[9px] font-bold text-white">
                    {i + 1}
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                      ok
                        ? "bg-emerald-500 shadow-md shadow-emerald-200"
                        : "bg-blue-50"
                    }`}
                  >
                    <Icon
                      size={15}
                      className={ok ? "text-white" : "text-blue-600"}
                    />
                  </div>
                  <div>
                    <div
                      className={`text-[12px] font-semibold leading-tight ${
                        ok ? "text-emerald-700" : "text-slate-800"
                      }`}
                    >
                      {s.label}
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                      {s.desc}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {checked.length === total && (
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 animate-v9-fade-in">
            <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
            <span className="text-[12px] font-semibold text-emerald-700">
              Tout validé — commandez en confiance.
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
