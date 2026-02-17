import {
  ShieldAlert,
  Clock,
  Info,
  AlertTriangle,
  ChevronRight,
  Link2,
} from "lucide-react";
import { memo } from "react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

interface PurchaseNarrativeProps {
  intro: { title: string; role: string; syncParts: string[] };
  risk: {
    title: string;
    explanation: string;
    consequences: string[];
    costRange: string;
    conclusion: string;
  };
  timing: { title: string; years: string; km: string; note: string };
  arguments: Array<{ title: string; content: string; icon?: string }>;
  howToChoose?: string | null;
  gammeName: string;
}

function getArgIcon(index: number) {
  const icons = [ShieldAlert, Info, ShieldAlert, ChevronRight];
  return icons[index % icons.length];
}

export const PurchaseNarrativeSection = memo(function PurchaseNarrativeSection({
  intro,
  risk,
  timing,
  arguments: args,
  howToChoose,
  gammeName,
}: PurchaseNarrativeProps) {
  // Parse howToChoose steps from numbered text
  const steps = howToChoose
    ? howToChoose
        .split(/\d+\)\s*/)
        .filter((s) => s.trim().length > 0)
        .map((s) => s.trim().replace(/\.$/, ""))
    : [];

  return (
    <Card className="border-slate-200 bg-white mb-6 md:mb-8">
      <CardHeader className="pb-3">
        <h2 className="text-xl sm:text-2xl md:text-[28px] font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <span
            className="flex-shrink-0 w-10 h-10 rounded-full bg-[#0d1b3e] text-white flex items-center justify-center"
            aria-hidden="true"
          >
            <Info className="w-5 h-5" />
          </span>
          Pourquoi remplacer vos {gammeName.toLowerCase()} ?
        </h2>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bloc 1: Role + pieces liees */}
        <div className="flex gap-4 p-4 bg-white rounded-lg border border-slate-200">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-full bg-[#0d1b3e]/10 text-[#0d1b3e] flex items-center justify-center font-bold"
            aria-hidden="true"
          >
            1
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{intro.title}</h3>
            <p className="text-gray-700 mt-1 text-base leading-relaxed">
              {intro.role}
            </p>
            {intro.syncParts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {intro.syncParts.map((part) => (
                  <span
                    key={part}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-800 text-xs rounded-full font-medium"
                  >
                    <Link2 className="w-3 h-3" />
                    {part}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bloc 2: Risques + cout */}
        <div className="flex gap-4 p-4 bg-white rounded-lg border border-red-200">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold"
            aria-hidden="true"
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{risk.title}</h3>
            <p className="text-gray-700 mt-1 text-base leading-relaxed">
              {risk.explanation}
            </p>
            {risk.consequences.length > 0 && (
              <ul className="mt-2 space-y-1">
                {risk.consequences.map((c, i) => (
                  <li
                    key={i}
                    className="text-sm text-gray-600 flex items-start gap-2"
                  >
                    <span className="text-red-500 mt-0.5" aria-hidden="true">
                      -
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-sm font-semibold text-red-800">
                Budget : {risk.costRange}
              </span>
            </div>
            {risk.conclusion && (
              <p className="mt-2 text-sm font-medium text-gray-800">
                {risk.conclusion}
              </p>
            )}
          </div>
        </div>

        {/* Bloc 3: Timing */}
        <div className="flex gap-4 p-4 bg-white rounded-lg border border-slate-200">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-full bg-[#e8590c]/10 text-[#e8590c] flex items-center justify-center font-bold"
            aria-hidden="true"
          >
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{timing.title}</h3>
            <div className="mt-2 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800">
                {timing.km}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800">
                {timing.years}
              </span>
            </div>
            {timing.note && (
              <p className="mt-2 text-sm text-gray-600 italic">{timing.note}</p>
            )}
          </div>
        </div>

        {/* Grille 4 arguments */}
        {args.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {args.map((arg, i) => {
              const ArgIcon = getArgIcon(i);
              return (
                <div
                  key={i}
                  className="p-3 bg-white rounded-lg border border-slate-200 hover:border-[#e8590c]/30 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ArgIcon
                      className="w-4 h-4 text-[#e8590c]"
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-gray-900 text-base">
                      {arg.title}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {arg.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* HowToChoose: 5 etapes */}
        {steps.length > 0 && (
          <div className="p-4 bg-slate-100/50 rounded-lg border border-slate-200">
            <h3 className="font-semibold text-slate-900 text-base mb-3">
              Comment bien choisir en {steps.length} etapes
            </h3>
            <div className="flex flex-wrap gap-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span
                    className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0d1b3e] text-white flex items-center justify-center text-xs font-bold"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-700">{step}</span>
                  {i < steps.length - 1 && (
                    <ChevronRight
                      className="w-4 h-4 text-slate-400 mx-1"
                      aria-hidden="true"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
