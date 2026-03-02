/**
 * R1 "Comment choisir en 15s" — 4 étapes sélection véhicule.
 * Bloc ultra-court orienté R1 (sélection), pas R3 (guide achat).
 */

const STEPS = [
  {
    num: 1,
    title: "Identifiez votre véhicule",
    desc: "Marque, modèle et année dans le sélecteur",
  },
  {
    num: 2,
    title: "Vérifiez la motorisation",
    desc: "Code moteur sur la carte grise (case D.2)",
  },
  {
    num: 3,
    title: "Comparez les références",
    desc: "Seules les pièces compatibles s'affichent",
  },
  {
    num: 4,
    title: "Commandez la bonne pièce",
    desc: "Livraison rapide, retour simple si erreur",
  },
];

export function R1QuickSteps({ gammeName }: { gammeName: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-5 sm:p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Comment choisir votre {gammeName} en 15 secondes
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STEPS.map((step) => (
          <div
            key={step.num}
            className="flex flex-col items-center text-center gap-2 p-3 bg-white rounded-lg border border-gray-100"
          >
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-600 text-white text-sm font-bold">
              {step.num}
            </span>
            <span className="text-sm font-medium text-gray-900 leading-tight">
              {step.title}
            </span>
            <span className="text-xs text-gray-500 leading-snug">
              {step.desc}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
