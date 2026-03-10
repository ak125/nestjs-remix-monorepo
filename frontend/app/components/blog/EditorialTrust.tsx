/**
 * EditorialTrust — Bloc E-E-A-T "Notre méthode éditoriale"
 * Renforce la confiance et la qualité perçue (SEO + UX)
 */
import { ShieldCheck, RefreshCw, BookCheck, Users } from "lucide-react";

const TRUST_POINTS = [
  {
    icon: Users,
    title: "Rédigé par des experts",
    text: "Nos contenus sont rédigés et validés par des mécaniciens et techniciens automobile certifiés.",
  },
  {
    icon: RefreshCw,
    title: "Mis à jour régulièrement",
    text: "Chaque article est révisé au minimum tous les 6 mois pour refléter les évolutions techniques.",
  },
  {
    icon: BookCheck,
    title: "Sources vérifiées",
    text: "Nous croisons les données constructeurs, les retours atelier et les normes en vigueur.",
  },
  {
    icon: ShieldCheck,
    title: "Objectif : prévention",
    text: "Notre priorité : vous aider à diagnostiquer juste et éviter les réparations inutiles.",
  },
] as const;

export function EditorialTrust() {
  return (
    <section className="py-10 bg-slate-50 border-y border-gray-200">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 text-center">
            Notre méthode éditoriale
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TRUST_POINTS.map((point) => (
              <div
                key={point.title}
                className="flex flex-col items-center text-center gap-2"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <point.icon className="w-5 h-5 text-blue-700" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {point.title}
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {point.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
