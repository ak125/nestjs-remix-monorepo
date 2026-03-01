import { Reveal, Section } from "~/components/layout";
import { Card, CardContent } from "~/components/ui/card";
import { STATS } from "./constants";

export default function StatsSection() {
  return (
    <Section variant="white" spacing="sm">
      <Reveal>
        <h2 className="sr-only">Automecanik en chiffres</h2>
        <Card className="rounded-2xl bg-navy border-0 overflow-hidden">
          <CardContent className="grid grid-cols-2 md:grid-cols-4 p-0">
            {STATS.map(({ value, label, icon: Icon }, i) => (
              <div
                key={label}
                className={`flex items-center gap-3 p-4 sm:p-5 ${i < STATS.length - 1 ? "md:border-r md:border-white/10" : ""}`}
              >
                <Icon className="w-5 h-5 text-cta flex-shrink-0" />
                <div>
                  <div className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
                    {value}
                  </div>
                  <div className="text-[10px] sm:text-xs text-white/50 font-medium">
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <p className="text-center text-xs text-slate-400 mt-3">
          Des milliers de clients nous font confiance depuis 2011.
        </p>
      </Reveal>
    </Section>
  );
}
