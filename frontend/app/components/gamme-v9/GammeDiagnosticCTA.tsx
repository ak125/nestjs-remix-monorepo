import { Link } from "@remix-run/react";
import { CheckCircle, Clock, Stethoscope, User } from "lucide-react";
import { Badge } from "~/components/ui/badge";

export default function GammeDiagnosticCTA() {
  return (
    <section className="px-5 py-7 lg:py-8 bg-slate-50">
      <div className="max-w-[1280px] mx-auto lg:px-8">
        <div className="bg-white rounded-2xl shadow-xl shadow-orange-500/[0.07] border border-orange-100 overflow-hidden">
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md shadow-orange-200 flex-shrink-0">
                <Stethoscope
                  size={17}
                  className="text-white animate-v9-float"
                />
              </div>
              <h2 className="text-[17px] lg:text-[20px] font-extrabold text-slate-900 tracking-tight font-v9-heading">
                Pas sûr de la panne ?
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

          <div className="px-5 pb-3">
            <p className="text-[13px] text-slate-500 font-normal leading-relaxed font-v9-body">
              Notre diagnostic identifie les causes probables et les pièces à
              remplacer.
            </p>
          </div>

          <div className="px-4 pb-4">
            <Link to="/diagnostic-auto">
              <button
                type="button"
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl text-white text-[15px] lg:text-[14px] font-bold flex items-center justify-center gap-2.5 shadow-lg shadow-orange-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/[0.12] to-white/0 animate-v9-shimmer" />
                <Stethoscope size={18} /> Lancer le diagnostic
              </button>
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
              <span className="text-[10px] text-slate-400 font-normal">
                2 847 diagnostics ce mois
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
