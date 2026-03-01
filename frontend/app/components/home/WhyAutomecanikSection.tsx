import { Reveal, Section } from "~/components/layout";
import { Card, CardContent } from "~/components/ui/card";
import { ADVANTAGES } from "./constants";

export default function WhyAutomecanikSection() {
  return (
    <Section variant="navy-gradient" spacing="md">
      <h2 className="sr-only">Pourquoi choisir Automecanik</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {ADVANTAGES.map(({ icon: Icon, title, desc }, i) => (
          <Reveal key={title} delay={i * 80}>
            <Card className="bg-white/[0.06] border-white/10 hover:bg-white/[0.09] hover:border-white/20 transition-all duration-200 rounded-2xl">
              <CardContent className="p-4 sm:p-5 text-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-cta/15 flex items-center justify-center mx-auto mb-2.5 sm:mb-3">
                  <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-cta" />
                </div>
                <div className="text-sm sm:text-[15px] font-semibold text-white mb-0.5">
                  {title}
                </div>
                <div className="text-[11px] sm:text-xs text-white/60 leading-relaxed">
                  {desc}
                </div>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
