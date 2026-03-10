/**
 * QuickChecklist — "En 60 secondes : 5 contrôles avant de remplacer une pièce"
 * Contenu actionnable court (SEO + UX confiance)
 */
import { CheckCircle2, Clock } from "lucide-react";

const CHECKS = [
  "Vérifiez la batterie (tension > 12,4V moteur arrêté)",
  "Inspectez les connecteurs et faisceaux électriques",
  "Contrôlez les fusibles associés au circuit",
  "Lisez les codes défauts avec un lecteur OBD",
  "Cherchez une fuite visible (liquide, huile, air)",
] as const;

export function QuickChecklist() {
  return (
    <section className="py-10 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-4 justify-center">
            <Clock className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-bold text-gray-900">
              En 60 secondes : 5 contrôles avant de remplacer une pièce
            </h2>
          </div>
          <p className="text-sm text-gray-600 text-center mb-6">
            Avant de commander, vérifiez ces points pour éviter un remplacement
            inutile.
          </p>
          <ol className="space-y-3">
            {CHECKS.map((check, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-sm text-gray-700">{check}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
