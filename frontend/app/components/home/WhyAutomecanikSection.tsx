import {
  Award,
  CheckCircle,
  Headset,
  Package,
  RotateCcw,
  Truck,
} from "lucide-react";
import { Reveal, Section } from "~/components/layout";

const VALUE_PROPS = [
  {
    icon: CheckCircle,
    title: "Compatibilité vérifiée",
    desc: "Recherche par véhicule, référence ou Type Mine.",
  },
  {
    icon: Award,
    title: "Pièces neuves de grandes marques",
    desc: "Aftermarket reconnu et qualité certifiée.",
  },
  {
    icon: Headset,
    title: "Support technique",
    desc: "Une aide claire pour éviter les erreurs de commande.",
  },
  {
    icon: Truck,
    title: "Livraison rapide",
    desc: "Expédition soignée et délais courts.",
  },
  {
    icon: Package,
    title: "500 000+ références",
    desc: "Toutes marques et modèles, pièces neuves uniquement.",
  },
  {
    icon: RotateCcw,
    title: "Retours 30 jours",
    desc: "Satisfait ou remboursé, pièce non montée.",
  },
];

export default function WhyAutomecanikSection() {
  return (
    <Section variant="navy-gradient" spacing="md">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[1.05rem] lg:text-xl font-semibold tracking-[-0.02em] text-white font-v9-heading">
            Pourquoi choisir AutoMecanik
          </h2>
          <p className="mt-1 text-sm text-white/70">
            Les engagements qui font la différence
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
        {VALUE_PROPS.map(({ icon: Icon, title, desc }, i) => (
          <Reveal key={title} delay={i * 80}>
            <article className="rounded-[22px] border border-white/10 bg-white/[0.045] px-3 py-3 sm:px-4 sm:py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm">
              <div className="mb-2 inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-white/10">
                <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
              </div>
              <h3 className="text-sm sm:text-[0.98rem] font-semibold leading-[1.15] text-white">
                {title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-white/60">
                {desc}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
