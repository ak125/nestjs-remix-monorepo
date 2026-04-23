import { BookOpen, Eye, Gauge, Volume2, Wrench } from "lucide-react";
import { Card } from "~/components/ui/card";

const SIGNS = [
  {
    icon: Volume2,
    canal: "Auditif",
    color: "text-blue-600",
    examples: [
      {
        label: "Crissement au freinage",
        to: "/diagnostic-auto/symptome/brake_noise_metallic",
      },
      {
        label: "Claquement moteur",
        to: "/diagnostic-auto/symptome/bruit_claquement_moteur",
      },
      {
        label: "Bruit d'échappement fort",
        to: "/diagnostic-auto/symptome/bruit_echappement_fort",
      },
    ],
  },
  {
    icon: Eye,
    canal: "Visuel",
    color: "text-amber-600",
    examples: [
      {
        label: "Voyant température",
        to: "/diagnostic-auto/symptome/temp_warning_light",
      },
      { label: "Voyant huile", to: "/diagnostic-auto/symptome/voyant_huile" },
      {
        label: "Fumée noire diesel",
        to: "/diagnostic-auto/symptome/fumee_noire_injection",
      },
    ],
  },
  {
    icon: Wrench,
    canal: "Tactile",
    color: "text-purple-600",
    examples: [
      {
        label: "Rebonds excessifs",
        to: "/diagnostic-auto/symptome/rebonds_excessifs",
      },
      {
        label: "Bruits en braquant",
        to: "/diagnostic-auto/symptome/bruit_direction",
      },
      {
        label: "Bruit au débrayage",
        to: "/diagnostic-auto/symptome/bruit_debrayage",
      },
    ],
  },
  {
    icon: Gauge,
    canal: "Performance",
    color: "text-emerald-600",
    examples: [
      {
        label: "Moteur qui broute",
        to: "/diagnostic-auto/symptome/moteur_broute",
      },
      {
        label: "Ralenti instable",
        to: "/diagnostic-auto/symptome/ralenti_instable",
      },
      {
        label: "Perte de puissance",
        to: "/diagnostic-auto/symptome/perte_puissance_injection",
      },
    ],
  },
];

export function DiagnosticGuide() {
  return (
    <section aria-labelledby="guide-heading">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="h-5 w-5 text-slate-600" />
        <h2 id="guide-heading" className="text-xl font-bold">
          Les 4 canaux sensoriels du diagnostic
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5 max-w-3xl">
        Un diagnostic auto démarre toujours par l'observation d'un signal.
        Classer ce signal par canal sensoriel oriente vers le bon système.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {SIGNS.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.canal} className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`h-5 w-5 ${s.color}`} />
                <h3 className="font-semibold">{s.canal}</h3>
              </div>
              <ul className="space-y-1.5 text-sm">
                {s.examples.map((ex) => (
                  <li key={ex.label}>
                    <a
                      href={ex.to}
                      className="text-muted-foreground hover:text-primary hover:underline"
                    >
                      {ex.label}
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
